import type { Command } from 'commander';
import cliProgress from 'cli-progress';
import { ImportSourcesUseCase } from '../../application/use-cases/import-sources.usecase.ts';
import type { SourceType } from '../../domain/entities/source-reference.ts';
import { FileSourceAdapter } from '../../infrastructure/adapters/file-source.adapter.ts';
import { OpenAiAiService } from '../../infrastructure/ai/ai.service.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { SqliteSourceRepository } from '../../infrastructure/persistence/repositories/sqlite-source-repository.ts';
import * as ui from '../ui.ts';

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
  try {
    const db = getDatabase();
    const ai = new OpenAiAiService();
    const sourceRepo = new SqliteSourceRepository(db);
    const fileSource = new FileSourceAdapter();
    const useCase = new ImportSourcesUseCase(sourceRepo, fileSource, ai, logger);

    ui.heading(`Importing ${type} sources`);
    ui.meta('Path', sourcePath);

    const count = await useCase.execute(sourcePath, type);

    ui.success(`Imported ${count} chunks.`);

    const embedBar = new cliProgress.SingleBar({
      format: `  ${ui.color.cyan('Embedding')} [{bar}] {percentage}% | {value}/{total} chunks | {duration_formatted}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    ui.step('Generating embeddings...');
    try {
      embedBar.start(count, 0);
      await useCase.generateEmbeddingsForType(type, (current: number) => {
        embedBar.update(current);
      });
      embedBar.stop();
      ui.success('Embeddings complete.');
    } catch (error) {
      embedBar.stop();
      ui.warn('Embedding generation failed. You can retry by running import again.');
      const message = error instanceof Error ? error.message : String(error);
      ui.warn(message);
    }

    db.close();

    ui.blank();
    ui.success('Import complete.');
    ui.nextSteps(['thoth generate_profile  Create identity profiles from imported sources']);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), type },
      'Import failed',
    );
    ui.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
