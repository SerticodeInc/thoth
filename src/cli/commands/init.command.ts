import type { Command } from 'commander';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { getSourceCountByType } from '../../infrastructure/persistence/repositories/source-repository.ts';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize Thoth — create database and run migrations')
    .action(() => {
      try {
        logger.info('Initializing Thoth');

        const db = getDatabase();

        const counts = {
          voice: getSourceCountByType(db, 'voice'),
          knowledge: getSourceCountByType(db, 'knowledge'),
          publication: getSourceCountByType(db, 'publication'),
        };

        logger.info(
          { dbPath: process.env.THOTH_DB_PATH ?? '~/.thoth/thoth.db', ...counts },
          'Thoth initialized successfully',
        );

        console.log('Thoth initialized.');
        console.log(`  Database: ~/.thoth/thoth.db`);
        console.log(
          `  Sources: ${counts.voice} voice, ${counts.knowledge} knowledge, ${counts.publication} publication`,
        );
        console.log();

        const isLocal = process.env.THOTH_LOCAL === 'true';
        if (!isLocal) {
          console.log('Privacy notice:');
          console.log(
            '  Thoth sends source content to external AI providers (OpenAI, Groq, Gemini)',
          );
          console.log('  for profile generation and embedding.');
          console.log('  Run with --local to use only local AI (Ollama) and keep data on-device.');
          console.log();
        }

        console.log('Next steps:');
        console.log('  thoth import voice <path>        Import voice sources');
        console.log('  thoth import knowledge <path>    Import knowledge sources');
        console.log('  thoth import publications <path> Import publication sources');
        console.log('  thoth profile generate           Generate identity profiles');

        db.close();
      } catch (error) {
        logger.error({ error }, 'Init failed');
        console.error('Init failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
