import type { Command } from 'commander';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { SeriesUseCase } from '../../application/use-cases/series.usecase.ts';
import { SqliteSeriesRepository } from '../../infrastructure/persistence/repositories/sqlite-series-repository.ts';
import * as ui from '../ui.ts';
import { withCliError } from '../error-handler.ts';

export function registerSeriesCommand(program: Command): void {
  program
    .command('create_series')
    .description('Create a new series')
    .argument('<name>', 'Series name')
    .option('-d, --description <text>', 'Series description')
    .action(async (name: string, options: { description?: string }) => {
      await withCliError(logger, 'Series create', async () => {
        const db = getDatabase();
        const repo = new SqliteSeriesRepository(db);
        const useCase = new SeriesUseCase(repo, logger);

        const result = await useCase.create(name, options.description);
        if (!result.ok) {
          ui.error(`Failed to create series: ${result.error}`);
          process.exit(1);
        }

        ui.success(`Series created: ${result.value.name}`);
        ui.meta('ID', result.value.id);

        db.close();
      });
    });

  program
    .command('list_series')
    .description('List all series')
    .action(async () => {
      await withCliError(logger, 'Series list', async () => {
        const db = getDatabase();
        const repo = new SqliteSeriesRepository(db);
        const useCase = new SeriesUseCase(repo, logger);

        const result = await useCase.list();
        if (!result.ok) {
          ui.error(`Failed to list series: ${result.error}`);
          process.exit(1);
        }

        if (result.value.length === 0) {
          ui.empty('No series created yet.');
          ui.nextSteps(['thoth create_series <name>']);
          db.close();
          return;
        }

        ui.heading('Series');
        for (const series of result.value) {
          ui.item(series.id.slice(0, 8), `${series.name} (${series.articleIds.length} articles)`);
          if (series.description) {
            ui.empty(`  ${series.description}`);
          }
        }

        db.close();
      });
    });

  program
    .command('add_to_series')
    .description('Add an article to a series')
    .argument('<series-id>', 'Series ID')
    .argument('<article-id>', 'Article ID')
    .action(async (seriesId: string, articleId: string) => {
      await withCliError(logger, 'Series add', async () => {
        const db = getDatabase();
        const repo = new SqliteSeriesRepository(db);
        const useCase = new SeriesUseCase(repo, logger);

        const result = await useCase.addArticle(seriesId, articleId);
        if (!result.ok) {
          ui.error(`Failed to add article: ${result.error}`);
          process.exit(1);
        }

        ui.success(`Article ${articleId.slice(0, 8)} added to series ${seriesId.slice(0, 8)}`);

        db.close();
      });
    });

  program
    .command('get_series')
    .description('Show series details')
    .argument('<id>', 'Series ID')
    .action(async (id: string) => {
      await withCliError(logger, 'Series get', async () => {
        const db = getDatabase();
        const repo = new SqliteSeriesRepository(db);
        const useCase = new SeriesUseCase(repo, logger);

        const result = await useCase.get(id);
        if (!result.ok) {
          ui.error(`Failed to get series: ${result.error}`);
          process.exit(1);
        }

        if (!result.value) {
          ui.error(`Series not found: ${id}`);
          process.exit(1);
        }

        ui.heading(result.value.name);
        if (result.value.description) ui.meta('Description', result.value.description);
        ui.meta('Created', result.value.createdAt.toLocaleString());
        ui.meta('Articles', result.value.articleIds.length);
        ui.blank();
        for (const articleId of result.value.articleIds) {
          ui.item(articleId.slice(0, 8), articleId);
        }

        db.close();
      });
    });
}
