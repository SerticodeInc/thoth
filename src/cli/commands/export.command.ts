import type { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../../infrastructure/logging/logger.ts';
import { loadConfig } from '../../infrastructure/config/config-loader.ts';
import {
  createExportArticleUseCase,
  createExportSeriesUseCase,
  createExportResearchUseCase,
  closeDb,
} from '../../infrastructure/composition-root.ts';
import type { ExportFormat } from '../../application/use-cases/export-article.usecase.ts';
import type { SeriesExportFormat } from '../../application/use-cases/export-series.usecase.ts';
import * as ui from '../ui.ts';
import { withCliError } from '../error-handler.ts';

const VALID_ARTICLE_FORMATS = ['md', 'html', 'txt'];
const VALID_SERIES_FORMATS = ['md', 'html', 'rss'];

function defaultOutputDir(type: 'singles' | 'series'): string {
  const config = loadConfig();
  if (config.export?.outputDir) return join(config.export.outputDir, type);
  return join(homedir(), 'Documents', 'Thoth', type);
}

export function registerExportCommand(program: Command): void {
  program
    .command('export_article')
    .description('Export an article (--format md|html|txt, --output <path>, --stdout)')
    .argument('<id>', 'Article ID')
    .option('-f, --format <format>', 'Output format (md, html, txt)', 'md')
    .option('-o, --output <path>', 'Output directory', defaultOutputDir('singles'))
    .option('--stdout', 'Print to stdout instead of writing to file', false)
    .action(async (id: string, options: { format: string; output: string; stdout: boolean }) => {
      await withCliError(logger, 'Export article', async () => {
        if (!VALID_ARTICLE_FORMATS.includes(options.format)) {
          ui.error(`Invalid format. Choose one of: ${VALID_ARTICLE_FORMATS.join(', ')}`);
          process.exit(1);
        }

        const useCase = createExportArticleUseCase();

        const result = await useCase.execute({
          articleId: id,
          format: options.format as ExportFormat,
        });

        if (!result.ok) {
          ui.error(`Export failed: ${result.error}`);
          process.exit(1);
        }

        if (options.stdout) {
          process.stdout.write(result.value.content);
        } else {
          const outDir = resolve(options.output);
          if (!existsSync(outDir)) {
            mkdirSync(outDir, { recursive: true });
          }

          const outPath = join(outDir, result.value.filename);
          writeFileSync(outPath, result.value.content, 'utf-8');

          ui.blank();
          ui.success('Article exported.');
          ui.summary({
            Title: result.value.filename.replace(/\.[^.]+$/, ''),
            Format: options.format,
            Path: outPath,
          });
        }

        closeDb();
      });
    });

  program
    .command('export_research')
    .description('Export a research note (--output <path>, --stdout)')
    .argument('<id>', 'Research note ID')
    .option('-o, --output <path>', 'Output directory', defaultOutputDir('singles'))
    .option('--stdout', 'Print to stdout instead of writing to file', false)
    .action(async (id: string, options: { output: string; stdout: boolean }) => {
      await withCliError(logger, 'Export research', async () => {
        const useCase = createExportResearchUseCase();

        const result = await useCase.execute({ researchId: id });

        if (!result.ok) {
          ui.error(`Export failed: ${result.error}`);
          process.exit(1);
        }

        if (options.stdout) {
          process.stdout.write(result.value.content);
        } else {
          const outDir = resolve(options.output);
          if (!existsSync(outDir)) {
            mkdirSync(outDir, { recursive: true });
          }

          const outPath = join(outDir, result.value.filename);
          writeFileSync(outPath, result.value.content, 'utf-8');

          ui.blank();
          ui.success('Research exported.');
          ui.summary({
            Topic: result.value.filename.replace(/\.md$/, ''),
            Format: 'md',
            Path: outPath,
          });
        }

        closeDb();
      });
    });

  program
    .command('export_series')
    .description('Export a series (--format md|html|rss, --output <path>)')
    .argument('<id>', 'Series ID')
    .option('-f, --format <format>', 'Output format (md, html, rss)', 'md')
    .option('-o, --output <path>', 'Output directory', defaultOutputDir('series'))
    .action(async (id: string, options: { format: string; output: string }) => {
      await withCliError(logger, 'Export series', async () => {
        if (!VALID_SERIES_FORMATS.includes(options.format)) {
          ui.error(`Invalid format. Choose one of: ${VALID_SERIES_FORMATS.join(', ')}`);
          process.exit(1);
        }

        const useCase = createExportSeriesUseCase();

        const result = await useCase.execute({
          seriesId: id,
          format: options.format as SeriesExportFormat,
        });

        if (!result.ok) {
          ui.error(`Export failed: ${result.error}`);
          process.exit(1);
        }

        const outDir = resolve(options.output);
        if (!existsSync(outDir)) {
          mkdirSync(outDir, { recursive: true });
        }

        const outPath = join(outDir, result.value.filename);
        writeFileSync(outPath, result.value.content, 'utf-8');

        ui.blank();
        ui.success('Series exported.');
        ui.summary({
          Title: result.value.filename.replace(/\.[^.]+$/, ''),
          Format: options.format,
          Path: outPath,
        });

        closeDb();
      });
    });
}
