import type { Command } from 'commander';
import { logger } from '../../infrastructure/logging/logger.ts';
import { createResearchUseCase, closeDb } from '../../infrastructure/composition-root.ts';
import * as ui from '../ui.ts';
import { withCliError } from '../error-handler.ts';

export function registerResearchCommand(program: Command): void {
  program
    .command('research')
    .description('Research a topic using imported knowledge sources')
    .argument('<topic>', 'Topic to research')
    .action(async (topic: string) => {
      await withCliError(logger, 'Research', async () => {
        if (topic.length > 500) {
          ui.error('Topic must be under 500 characters.');
          process.exit(1);
        }

        const useCase = createResearchUseCase();

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
        ui.meta('Sources compiled', result.value.sourceCount);
        ui.meta('Search queries', result.value.searchQueries.length);
        ui.meta('Research ID', result.value.id);
        ui.blank();

        ui.section('Citations');
        for (const citation of result.value.citations) {
          const displayPath = citation.sourcePath.length > 80
            ? citation.sourcePath.slice(0, 77) + '...'
            : citation.sourcePath;
          ui.item(`[${citation.sourceId.slice(0, 8)}]`, displayPath);
          ui.meta('Relevance', `${(citation.relevanceScore * 100).toFixed(0)}%`);
          ui.empty(`  "${citation.excerpt.slice(0, 120)}..."`);
          ui.blank();
        }

        closeDb();
      });
    });
}
