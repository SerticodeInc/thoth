import type { Command } from 'commander';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { GenerateArticleUseCase } from '../../application/use-cases/generate-article.usecase.ts';
import { OpenAiAiService } from '../../infrastructure/ai/ai.service.ts';
import { SqliteArticleRepository } from '../../infrastructure/persistence/repositories/sqlite-article-repository.ts';
import { SqliteProfileRepository } from '../../infrastructure/persistence/repositories/sqlite-profile-repository.ts';
import { SqliteResearchRepository } from '../../infrastructure/persistence/repositories/sqlite-research-repository.ts';

export function registerArticleCommand(program: Command): void {
  const articleCmd = program.command('article').description('Manage articles');

  articleCmd
    .command('generate')
    .description('Generate an article from research and voice profile')
    .option('-t, --topic <topic>', 'Topic to write about')
    .option('-r, --research <id>', 'Research note ID to use as source')
    .action(async (options: { topic?: string; research?: string }) => {
      try {
        if (!options.topic && !options.research) {
          console.error('Provide a topic (--topic) or research ID (--research)');
          process.exit(1);
        }

        const db = getDatabase();
        const ai = new OpenAiAiService();
        const articleRepo = new SqliteArticleRepository(db);
        const profileRepo = new SqliteProfileRepository(db);
        const researchRepo = new SqliteResearchRepository(db);
        const useCase = new GenerateArticleUseCase(ai, articleRepo, profileRepo, researchRepo, logger);

        console.log('Generating article...');
        if (options.topic) console.log(`  Topic: ${options.topic}`);
        if (options.research) console.log(`  Research ID: ${options.research}`);
        console.log();

        const result = await useCase.execute({
          topic: options.topic,
          researchId: options.research,
        });

        if (!result.ok) {
          console.error(`Generation failed: ${result.error}`);
          process.exit(1);
        }

        console.log(`Title: ${result.value.title}`);
        console.log(`Words: ${result.value.wordCount}`);
        console.log(`ID: ${result.value.id}`);
        console.log();
        console.log(result.value.content);

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Article generation command failed');
        console.error('Article generation failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  articleCmd
    .command('list')
    .description('List generated articles')
    .action(async () => {
      try {
        const db = getDatabase();
        const repo = new SqliteArticleRepository(db);

        const result = await repo.list();
        if (!result.ok) {
          console.error(`Failed to list articles: ${result.error}`);
          process.exit(1);
        }

        if (result.value.length === 0) {
          console.log('No articles generated yet. Run `thoth article generate --topic "<topic>"`');
          db.close();
          return;
        }

        console.log('Articles:');
        for (const article of result.value) {
          console.log(`  ${article.id.slice(0, 8)}  ${article.title} (${article.wordCount} words, ${article.status})`);
        }

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Article list command failed');
        console.error('Failed to list articles:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  articleCmd
    .command('get')
    .description('Show an article by ID')
    .argument('<id>', 'Article ID')
    .action(async (id: string) => {
      try {
        const db = getDatabase();
        const repo = new SqliteArticleRepository(db);

        const result = await repo.get(id);
        if (!result.ok) {
          console.error(`Failed to get article: ${result.error}`);
          process.exit(1);
        }

        if (!result.value) {
          console.error(`Article not found: ${id}`);
          process.exit(1);
        }

        console.log(`Title: ${result.value.title}`);
        console.log(`Words: ${result.value.wordCount}`);
        console.log(`Status: ${result.value.status}`);
        console.log(`Created: ${result.value.createdAt.toLocaleString()}`);
        console.log();
        console.log(result.value.content);

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Article get command failed');
        console.error('Failed to get article:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
