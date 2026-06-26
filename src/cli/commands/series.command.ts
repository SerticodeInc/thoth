import type { Command } from 'commander';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { SeriesUseCase } from '../../application/use-cases/series.usecase.ts';
import { SqliteSeriesRepository } from '../../infrastructure/persistence/repositories/sqlite-series-repository.ts';

export function registerSeriesCommand(program: Command): void {
  program
    .command('create_series')
    .description('Create a new series')
    .argument('<name>', 'Series name')
    .option('-d, --description <text>', 'Series description')
    .action(async (name: string, options: { description?: string }) => {
      try {
        const db = getDatabase();
        const repo = new SqliteSeriesRepository(db);
        const useCase = new SeriesUseCase(repo, logger);

        const result = await useCase.create(name, options.description);
        if (!result.ok) {
          console.error(`Failed to create series: ${result.error}`);
          process.exit(1);
        }

        console.log(`Series created: ${result.value.name}`);
        console.log(`ID: ${result.value.id}`);

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Series create command failed');
        console.error('Failed to create series:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  program
    .command('list_series')
    .description('List all series')
    .action(async () => {
      try {
        const db = getDatabase();
        const repo = new SqliteSeriesRepository(db);
        const useCase = new SeriesUseCase(repo, logger);

        const result = await useCase.list();
        if (!result.ok) {
          console.error(`Failed to list series: ${result.error}`);
          process.exit(1);
        }

        if (result.value.length === 0) {
          console.log('No series created yet. Run `thoth create_series <name>`');
          db.close();
          return;
        }

        console.log('Series:');
        for (const series of result.value) {
          console.log(`  ${series.id.slice(0, 8)}  ${series.name} (${series.articleIds.length} articles)`);
          if (series.description) {
            console.log(`       ${series.description}`);
          }
        }

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Series list command failed');
        console.error('Failed to list series:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  program
    .command('add_to_series')
    .description('Add an article to a series')
    .argument('<series-id>', 'Series ID')
    .argument('<article-id>', 'Article ID')
    .action(async (seriesId: string, articleId: string) => {
      try {
        const db = getDatabase();
        const repo = new SqliteSeriesRepository(db);
        const useCase = new SeriesUseCase(repo, logger);

        const result = await useCase.addArticle(seriesId, articleId);
        if (!result.ok) {
          console.error(`Failed to add article: ${result.error}`);
          process.exit(1);
        }

        console.log(`Article ${articleId.slice(0, 8)} added to series ${seriesId.slice(0, 8)}`);

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Series add command failed');
        console.error('Failed to add article:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  program
    .command('get_series')
    .description('Show series details')
    .argument('<id>', 'Series ID')
    .action(async (id: string) => {
      try {
        const db = getDatabase();
        const repo = new SqliteSeriesRepository(db);
        const useCase = new SeriesUseCase(repo, logger);

        const result = await useCase.get(id);
        if (!result.ok) {
          console.error(`Failed to get series: ${result.error}`);
          process.exit(1);
        }

        if (!result.value) {
          console.error(`Series not found: ${id}`);
          process.exit(1);
        }

        console.log(`Series: ${result.value.name}`);
        if (result.value.description) console.log(`Description: ${result.value.description}`);
        console.log(`Created: ${result.value.createdAt.toLocaleString()}`);
        console.log(`Articles: ${result.value.articleIds.length}`);
        console.log();
        for (const articleId of result.value.articleIds) {
          console.log(`  ${articleId}`);
        }

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Series get command failed');
        console.error('Failed to get series:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
