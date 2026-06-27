import type { Command } from 'commander';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { ResearchUseCase } from '../../application/use-cases/research.usecase.ts';
import { OpenAiAiService } from '../../infrastructure/ai/ai.service.ts';
import { SqliteResearchRepository } from '../../infrastructure/persistence/repositories/sqlite-research-repository.ts';
import { SqliteSourceRepository } from '../../infrastructure/persistence/repositories/sqlite-source-repository.ts';
import * as ui from '../ui.ts';
import { withCliError } from '../error-handler.ts';

export function registerResearchCommand(program: Command): void {
  program
    .command('research')
    .description('Research a topic using imported knowledge sources')
    .argument('<topic>', 'Topic to research')
    .action(async (topic: string) => {
      await withCliError(logger, 'Research', async () => {
        const db = getDatabase();
        const ai = new OpenAiAiService();
        const researchRepo = new SqliteResearchRepository(db);
        const sourceRepo = new SqliteSourceRepository(db);
        const useCase = new ResearchUseCase(ai, researchRepo, sourceRepo, logger);

        ui.heading('Researching');
        ui.meta('Topic', topic);
        ui.blank();

        const spin = ui.spinner('Researching...');
        const startTime = process.hrtime();
        spin.start();

        const result = await useCase.execute(topic);

        spin.stop();
        const duration = ui.timer(startTime);

        if (!result.ok) {
          ui.error(`Research failed: ${result.error}`);
          process.exit(1);
        }

        ui.divider();
        ui.output(result.value.content);
        ui.divider();
        ui.blank();
        ui.success('Research complete.');
        ui.meta('Duration', duration);
        ui.meta('Sources cited', result.value.citations.length);
        ui.meta('Research ID', result.value.id);
        ui.blank();

        ui.section('Citations');
        for (const citation of result.value.citations) {
          ui.item(`[${citation.sourceId.slice(0, 8)}]`, citation.sourcePath);
          ui.meta('Relevance', `${(citation.relevanceScore * 100).toFixed(0)}%`);
          ui.empty(`  "${citation.excerpt.slice(0, 120)}..."`);
          ui.blank();
        }

        db.close();
      });
    });
}
