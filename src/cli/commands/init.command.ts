import type { Command } from 'commander';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { SqliteSourceRepository } from '../../infrastructure/persistence/repositories/sqlite-source-repository.ts';
import * as ui from '../ui.ts';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize Thoth — create database and run migrations')
    .action(() => {
      try {
        logger.info('Initializing Thoth');

        const db = getDatabase();
        const sourceRepo = new SqliteSourceRepository(db);

        const voiceCount = sourceRepo.getSourceCountByType('voice');
        const knowledgeCount = sourceRepo.getSourceCountByType('knowledge');
        const pubCount = sourceRepo.getSourceCountByType('publication');

        const counts = {
          voice: voiceCount.ok ? voiceCount.value : 0,
          knowledge: knowledgeCount.ok ? knowledgeCount.value : 0,
          publication: pubCount.ok ? pubCount.value : 0,
        };

        logger.info(
          { dbPath: process.env.THOTH_DB_PATH ?? '~/.thoth/thoth.db', ...counts },
          'Thoth initialized successfully',
        );

        ui.success('Thoth initialized.');
        ui.meta('Database', '~/.thoth/thoth.db');
        ui.meta('Sources', `${counts.voice} voice, ${counts.knowledge} knowledge, ${counts.publication} publication`);
        ui.blank();

        const isLocal = process.env.THOTH_LOCAL === 'true';
        if (!isLocal) {
          ui.section('Privacy notice');
          ui.warn(
            '  Thoth sends source content to external AI providers (OpenAI, Groq, Gemini)',
          );
          ui.warn('  for profile generation and embedding.');
          ui.info('Run with --local to use only local AI (Ollama) and keep data on-device.');
          ui.blank();
        }

        ui.nextSteps([
          'thoth import_voice <path>         Import voice sources',
          'thoth import_knowledge <path>     Import knowledge sources',
          'thoth import_publications <path>  Import publication sources',
          'thoth generate_profile            Generate identity profiles',
          'thoth research "<topic>"          Research a topic using your knowledge',
          'thoth generate_article --topic    Generate an article in your voice',
          'thoth create_series <name>        Group articles into series',
        ]);

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Init failed');
        ui.error(`Init failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
