import type { Command } from 'commander';
import cliProgress from 'cli-progress';
import type { SourceType } from '../../domain/entities/source-reference.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { createImportSourcesUseCase, closeDb } from '../../infrastructure/composition-root.ts';
import * as ui from '../ui.ts';
import { withCliError } from '../error-handler.ts';

export function registerImportCommand(program: Command): void {
  program
    .command('import_voice')
    .description('Import voice sources (journals, essays, blog posts)')
    .argument('<path>', 'File or directory path')
    .action(async (sourcePath: string) => {
      await runImport(sourcePath, 'voice');
    });

  program
    .command('import_knowledge')
    .description('Import knowledge sources (technical notes, docs, repos)')
    .argument('<path>', 'File or directory path')
    .action(async (sourcePath: string) => {
      await runImport(sourcePath, 'knowledge');
    });

  program
    .command('import_publications')
    .description('Import publication sources (articles, series)')
    .argument('<path>', 'File or directory path')
    .action(async (sourcePath: string) => {
      await runImport(sourcePath, 'publication');
    });
}

async function runImport(sourcePath: string, type: SourceType): Promise<void> {
  await withCliError(logger, 'Import', async () => {
    const useCase = createImportSourcesUseCase();

    const startTime = process.hrtime();

    ui.heading(`Importing ${type} sources`);
    ui.meta('Path', sourcePath);

    const importResult = await useCase.execute(sourcePath, type);

    if (!importResult.ok) {
      ui.error(`Import failed: ${importResult.error}`);
      closeDb();
      return;
    }

    const count = importResult.value;
    ui.success(`Imported ${count} chunks.`);

    const embedBar = new cliProgress.SingleBar({
      format: `  ${ui.color.cyan('Embedding')} [{bar}] {percentage}% | {value}/{total} chunks | {duration_formatted}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    let embedOk = true;
    let embedFailed = 0;
    let embedTotal = 0;

    if (count > 0) {
      ui.step('Generating embeddings...');
      try {
        embedBar.start(count, 0);
        const embedResult = await useCase.generateEmbeddingsForType(type, (current: number) => {
          embedBar.update(current);
        });
        embedBar.stop();
        if (!embedResult.ok) {
          ui.warn(`Embedding failed: ${embedResult.error}`);
          embedOk = false;
        } else {
          embedFailed = embedResult.value.failed;
          embedTotal = embedResult.value.total;
          if (embedFailed > 0) {
            ui.warn(`${embedFailed} of ${embedTotal} embeddings failed.`);
            if (embedFailed === embedTotal) {
              ui.warn('Check that your embedding provider is configured correctly.');
            }
          } else {
            ui.success('Embeddings complete.');
          }
        }
      } catch (error) {
        embedBar.stop();
        ui.warn('Embedding generation failed. You can retry by running import again.');
        const message = error instanceof Error ? error.message : String(error);
        ui.warn(message);
        embedOk = false;
      }
    }

    closeDb();

    const duration = ui.timer(startTime);

    ui.blank();
    ui.success('Import complete.');
    ui.divider();
    ui.summary({
      Type: type,
      'Chunks imported': String(count),
      Embeddings: count === 0
        ? 'none'
        : !embedOk
          ? 'failed'
          : embedFailed === 0
            ? 'complete'
            : `${embedFailed}/${embedTotal} failed`,
      Duration: duration,
    });
    ui.blank();
    ui.nextSteps(['thoth generate_profile  Create identity profiles from imported sources']);
  });
}
