import type { Command } from 'commander';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { GenerateArticleUseCase } from '../../application/use-cases/generate-article.usecase.ts';
import { OpenAiAiService } from '../../infrastructure/ai/ai.service.ts';
import { SqliteArticleRepository } from '../../infrastructure/persistence/repositories/sqlite-article-repository.ts';
import { SqliteProfileRepository } from '../../infrastructure/persistence/repositories/sqlite-profile-repository.ts';
import { SqliteResearchRepository } from '../../infrastructure/persistence/repositories/sqlite-research-repository.ts';
import * as ui from '../ui.ts';
import { withCliError } from '../error-handler.ts';

export function registerArticleCommand(program: Command): void {
  program
    .command('generate_article')
    .description('Generate an article from research and voice profile')
    .option('-t, --topic <topic>', 'Topic to write about')
    .option('-r, --research <id>', 'Research note ID to use as source')
    .action(async (options: { topic?: string; research?: string }) => {
      await withCliError(logger, 'Article generation', async () => {
        if (!options.topic && !options.research) {
          ui.error('Provide a topic (--topic) or research ID (--research).');
          process.exit(1);
        }

        const db = getDatabase();
        const ai = new OpenAiAiService();
        const articleRepo = new SqliteArticleRepository(db);
        const profileRepo = new SqliteProfileRepository(db);
        const researchRepo = new SqliteResearchRepository(db);
        const useCase = new GenerateArticleUseCase(ai, articleRepo, profileRepo, researchRepo, logger);

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

        db.close();
      });
    });

  program
    .command('list_articles')
    .description('List generated articles')
    .action(async () => {
      await withCliError(logger, 'Article list', async () => {
        const db = getDatabase();
        const repo = new SqliteArticleRepository(db);

        const result = await repo.list();
        if (!result.ok) {
          ui.error(`Failed to list articles: ${result.error}`);
          process.exit(1);
        }

        if (result.value.length === 0) {
          ui.empty('No articles generated yet.');
          ui.nextSteps(['thoth generate_article --topic "<topic>"']);
          db.close();
          return;
        }

        ui.heading('Articles');
        for (const article of result.value) {
          ui.item(article.id.slice(0, 8), `${article.title} (${article.wordCount} words, ${article.status})`);
        }

        db.close();
      });
    });

  program
    .command('get_article')
    .description('Show an article by ID')
    .argument('<id>', 'Article ID')
    .action(async (id: string) => {
      await withCliError(logger, 'Article get', async () => {
        const db = getDatabase();
        const repo = new SqliteArticleRepository(db);

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
        ui.output(result.value.content);
        ui.divider();

        db.close();
      });
    });
}
