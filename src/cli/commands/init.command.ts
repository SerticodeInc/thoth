import type { Command } from 'commander';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { SqliteSourceRepository } from '../../infrastructure/persistence/repositories/sqlite-source-repository.ts';

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
        console.log('  thoth import_voice <path>         Import voice sources');
        console.log('  thoth import_knowledge <path>     Import knowledge sources');
        console.log('  thoth import_publications <path>  Import publication sources');
        console.log('  thoth generate_profile            Generate identity profiles');
        console.log('  thoth research "<topic>"          Research a topic using your knowledge');
        console.log('  thoth generate_article --topic    Generate an article in your voice');
        console.log('  thoth create_series <name>        Group articles into series');

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Init failed');
        console.error('Init failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
