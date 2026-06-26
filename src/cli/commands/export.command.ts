import type { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { SqliteArticleRepository } from '../../infrastructure/persistence/repositories/sqlite-article-repository.ts';
import { SqliteSeriesRepository } from '../../infrastructure/persistence/repositories/sqlite-series-repository.ts';
import { ExportArticleUseCase } from '../../application/use-cases/export-article.usecase.ts';
import { ExportSeriesUseCase } from '../../application/use-cases/export-series.usecase.ts';
import type { ExportFormat } from '../../application/use-cases/export-article.usecase.ts';
import type { SeriesExportFormat } from '../../application/use-cases/export-series.usecase.ts';

const VALID_ARTICLE_FORMATS = ['md', 'html', 'txt'];
const VALID_SERIES_FORMATS = ['md', 'html', 'rss'];

export function registerExportCommand(program: Command): void {
  program
    .command('export_article')
    .description('Export an article to file')
    .argument('<id>', 'Article ID')
    .option('-f, --format <format>', 'Output format (md, html, txt)', 'md')
    .option('-o, --output <path>', 'Output directory', '.')
    .action(async (id: string, options: { format: string; output: string }) => {
      try {
        if (!VALID_ARTICLE_FORMATS.includes(options.format)) {
          console.error(`Invalid format. Choose one of: ${VALID_ARTICLE_FORMATS.join(', ')}`);
          process.exit(1);
        }

        const db = getDatabase();
        const articleRepo = new SqliteArticleRepository(db);
        const useCase = new ExportArticleUseCase(articleRepo);

        const result = await useCase.execute({
          articleId: id,
          format: options.format as ExportFormat,
        });

        if (!result.ok) {
          console.error(`Export failed: ${result.error}`);
          process.exit(1);
        }

        const outDir = resolve(options.output);
        if (!existsSync(outDir)) {
          mkdirSync(outDir, { recursive: true });
        }

        const outPath = join(outDir, result.value.filename);
        writeFileSync(outPath, result.value.content, 'utf-8');

        console.log(`Exported: ${outPath}`);

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Export article command failed');
        console.error('Export failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  program
    .command('export_series')
    .description('Export a series to file')
    .argument('<id>', 'Series ID')
    .option('-f, --format <format>', 'Output format (md, html, rss)', 'md')
    .option('-o, --output <path>', 'Output directory', '.')
    .action(async (id: string, options: { format: string; output: string }) => {
      try {
        if (!VALID_SERIES_FORMATS.includes(options.format)) {
          console.error(`Invalid format. Choose one of: ${VALID_SERIES_FORMATS.join(', ')}`);
          process.exit(1);
        }

        const db = getDatabase();
        const seriesRepo = new SqliteSeriesRepository(db);
        const articleRepo = new SqliteArticleRepository(db);
        const useCase = new ExportSeriesUseCase(seriesRepo, articleRepo);

        const result = await useCase.execute({
          seriesId: id,
          format: options.format as SeriesExportFormat,
        });

        if (!result.ok) {
          console.error(`Export failed: ${result.error}`);
          process.exit(1);
        }

        const outDir = resolve(options.output);
        if (!existsSync(outDir)) {
          mkdirSync(outDir, { recursive: true });
        }

        const outPath = join(outDir, result.value.filename);
        writeFileSync(outPath, result.value.content, 'utf-8');

        console.log(`Exported: ${outPath}`);

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Export series command failed');
        console.error('Export failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
