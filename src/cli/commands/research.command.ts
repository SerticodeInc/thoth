import type { Command } from 'commander';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { ResearchUseCase } from '../../application/use-cases/research.usecase.ts';
import { OpenAiAiService } from '../../infrastructure/ai/ai.service.ts';
import { SqliteResearchRepository } from '../../infrastructure/persistence/repositories/sqlite-research-repository.ts';
import { SqliteSourceRepository } from '../../infrastructure/persistence/repositories/sqlite-source-repository.ts';

export function registerResearchCommand(program: Command): void {
  program
    .command('research')
    .description('Research a topic using imported knowledge sources')
    .argument('<topic>', 'Topic to research')
    .action(async (topic: string) => {
      try {
        const db = getDatabase();
        const ai = new OpenAiAiService();
        const researchRepo = new SqliteResearchRepository(db);
        const sourceRepo = new SqliteSourceRepository(db);
        const useCase = new ResearchUseCase(ai, researchRepo, sourceRepo, logger);

        console.log(`Researching: "${topic}"`);
        console.log();

        const result = await useCase.execute(topic);

        if (!result.ok) {
          console.error(`Research failed: ${result.error}`);
          process.exit(1);
        }

        console.log(result.value.content);
        console.log();
        console.log(`Sources cited: ${result.value.citations.length}`);
        console.log(`Research ID: ${result.value.id}`);
        console.log();

        for (const citation of result.value.citations) {
          console.log(`  [${citation.sourceId.slice(0, 8)}] ${citation.sourcePath}`);
          console.log(`       Relevance: ${(citation.relevanceScore * 100).toFixed(0)}%`);
          console.log(`       "${citation.excerpt.slice(0, 120)}..."`);
          console.log();
        }

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Research command failed');
        console.error('Research failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
