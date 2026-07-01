import type { Command } from 'commander';
import { logger } from '../../infrastructure/logging/logger.ts';
import {
  createGenerateArticleUseCase,
  createArticleRepository,
  closeDb,
} from '../../infrastructure/composition-root.ts';
import * as ui from '../ui.ts';
import { withCliError } from '../error-handler.ts';

export function registerArticleCommand(program: Command): void {
  program
    .command('generate_article')
    .description('Generate an article using your voice profile (--topic, --research)')
    .option('-t, --topic <topic>', 'Topic to write about')
    .option('-r, --research <id>', 'Research note ID to use as source')
    .action(async (options: { topic?: string; research?: string }) => {
      await withCliError(logger, 'Article generation', async () => {
        if (!options.topic && !options.research) {
          ui.error('Provide a topic (--topic) or research ID (--research).');
          process.exit(1);
        }

        if (options.topic && options.topic.length > 500) {
          ui.error('Topic must be under 500 characters.');
          process.exit(1);
        }

        const useCase = createGenerateArticleUseCase();

        ui.heading('Generating article');
        if (options.topic) ui.meta('Topic', options.topic);
        if (options.research) ui.meta('Research ID', options.research);
        ui.blank();

        const spin = ui.spinner('Drafting article...');
        const startTime = process.hrtime();
        spin.start();

        const result = await useCase.execute({
          topic: options.topic,
          researchId: options.research,
        });

        spin.stop();
        const duration = ui.timer(startTime);

        if (!result.ok) {
          ui.error(`Generation failed: ${result.error}`);
          process.exit(1);
        }

        ui.success('Article generated.');
        ui.meta('Title', result.value.title);
        ui.meta('Words', result.value.wordCount);
        ui.meta('ID', result.value.id);
        ui.meta('Duration', duration);
        ui.blank();
        ui.divider();
        ui.output(result.value.content);
        ui.divider();

        closeDb();
      });
    });

  program
    .command('list_articles')
    .description('List generated articles')
    .action(async () => {
      await withCliError(logger, 'Article list', async () => {
        const repo = createArticleRepository();

        const result = await repo.list();
        if (!result.ok) {
          ui.error(`Failed to list articles: ${result.error}`);
          process.exit(1);
        }

        if (result.value.length === 0) {
          ui.empty('No articles generated yet.');
          ui.nextSteps(['thoth generate_article --topic "<topic>"']);
          closeDb();
          return;
        }

        ui.heading('Articles');
        for (const article of result.value) {
          ui.item(article.id, `${article.title} (${article.wordCount} words, ${article.status})`);
        }

        closeDb();
      });
    });

  program
    .command('get_article')
    .description('Show an article by ID')
    .argument('<id>', 'Article ID')
    .action(async (id: string) => {
      await withCliError(logger, 'Article get', async () => {
        const repo = createArticleRepository();

        const result = await repo.get(id);
        if (!result.ok) {
          ui.error(`Failed to get article: ${result.error}`);
          process.exit(1);
        }

        if (!result.value) {
          ui.error(`Article not found: ${id}`);
          process.exit(1);
        }

        ui.heading(result.value.title);
        ui.meta('Words', result.value.wordCount);
        ui.meta('Status', result.value.status);
        ui.meta('Created', result.value.createdAt.toLocaleString());
        ui.blank();
        ui.divider();
        ui.article(result.value.content);
        ui.divider();

        closeDb();
      });
    });
}
