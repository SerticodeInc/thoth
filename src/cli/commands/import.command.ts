import type { Command } from 'commander';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { SqliteSourceRepository } from '../../infrastructure/persistence/repositories/sqlite-source-repository.ts';
import { FileSourceAdapter } from '../../infrastructure/adapters/file-source.adapter.ts';
import { ImportSourcesUseCase } from '../../application/use-cases/import-sources.usecase.ts';
import { OpenAiAiService } from '../../infrastructure/ai/ai.service.ts';
import type { SourceType } from '../../domain/entities/source-reference.ts';

export function registerImportCommand(program: Command): void {
  const importCmd = program.command('import').description('Import sources for profile generation');

  importCmd
    .command('voice')
    .description('Import voice sources (journals, essays, blog posts)')
    .argument('<path>', 'File or directory path')
    .action(async (sourcePath: string) => {
      await runImport(sourcePath, 'voice');
    });

  importCmd
    .command('knowledge')
    .description('Import knowledge sources (technical notes, docs, repos)')
    .argument('<path>', 'File or directory path')
    .action(async (sourcePath: string) => {
      await runImport(sourcePath, 'knowledge');
    });

  importCmd
    .command('publications')
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

    console.log(`Importing ${type} sources from: ${sourcePath}`);

    const count = await useCase.execute(sourcePath, type);

    console.log(`  Imported ${count} chunks.`);

    console.log('  Generating embeddings...');
    try {
      await useCase.generateEmbeddingsForType(type);
      console.log('  Embeddings complete.');
    } catch (error) {
      console.warn(
        '  Warning: Embedding generation failed. You can retry by running import again.',
      );
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`    ${message}`);
    }

    db.close();

    console.log();
    console.log('Import complete. Run `thoth profile generate` to create identity profiles.');
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error), type }, 'Import failed');
    console.error('Import failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
