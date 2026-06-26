import type { Command } from 'commander';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { GenerateProfilesUseCase } from '../../application/use-cases/generate-profiles.usecase.ts';
import { OpenAiAiService } from '../../infrastructure/ai/ai.service.ts';
import { SqliteProfileRepository } from '../../infrastructure/persistence/repositories/sqlite-profile-repository.ts';
import { SqliteSourceRepository } from '../../infrastructure/persistence/repositories/sqlite-source-repository.ts';

export function registerProfileCommand(program: Command): void {
  program
    .command('generate_profile')
    .description('Generate identity profiles from imported sources')
    .action(async () => {
      try {
        const db = getDatabase();
        const ai = new OpenAiAiService();
        const profileRepo = new SqliteProfileRepository(db);
        const sourceRepo = new SqliteSourceRepository(db);
        const useCase = new GenerateProfilesUseCase(ai, profileRepo, sourceRepo, logger);

        const voiceCount = sourceRepo.getSourceCountByType('voice');
        const knowledgeCount = sourceRepo.getSourceCountByType('knowledge');
        const pubCount = sourceRepo.getSourceCountByType('publication');

        const counts = {
          voice: voiceCount.ok ? voiceCount.value : 0,
          knowledge: knowledgeCount.ok ? knowledgeCount.value : 0,
          publication: pubCount.ok ? pubCount.value : 0,
        };

        if (counts.voice === 0 && counts.knowledge === 0 && counts.publication === 0) {
          console.error('No sources imported. Run `thoth import_voice` first.');
          process.exit(1);
        }

        console.log('Generating identity profiles...');

        if (counts.voice > 0) {
          console.log('  Generating voice profile...');
          const result = await useCase.generateVoiceProfile();
          if (!result.ok) {
            console.error(`  Voice profile failed: ${result.error}`);
          } else {
            console.log(`  Voice profile: ${result.value.id}`);
            console.log(`    Summary: ${result.value.summary}`);
          }
        }

        if (counts.knowledge > 0) {
          console.log('  Generating knowledge profile...');
          const result = await useCase.generateKnowledgeProfile();
          if (!result.ok) {
            console.error(`  Knowledge profile failed: ${result.error}`);
          } else {
            console.log(`  Knowledge profile: ${result.value.id}`);
            console.log(`    Domains: ${result.value.domains.join(', ')}`);
          }
        }

        if (counts.publication > 0) {
          console.log('  Generating publication profile...');
          const result = await useCase.generatePublicationProfile();
          if (!result.ok) {
            console.error(`  Publication profile failed: ${result.error}`);
          } else {
            console.log(`  Publication profile: ${result.value.id}`);
            console.log(`    Themes: ${result.value.themes.join(', ')}`);
          }
        }

        console.log();
        console.log('Identity profiles generated successfully.');

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Profile generation failed');
        console.error('Profile generation failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  program
    .command('profile_status')
    .description('Show profile generation status')
    .action(() => {
      try {
        const db = getDatabase();

        const voiceProfile = db
          .prepare(
            'SELECT id, summary, created_at FROM voice_profiles ORDER BY created_at DESC LIMIT 1',
          )
          .get() as Record<string, unknown> | undefined;
        const knowledgeProfile = db
          .prepare(
            'SELECT id, domains, created_at FROM knowledge_profiles ORDER BY created_at DESC LIMIT 1',
          )
          .get() as Record<string, unknown> | undefined;
        const pubProfile = db
          .prepare(
            'SELECT id, themes, created_at FROM publication_profiles ORDER BY created_at DESC LIMIT 1',
          )
          .get() as Record<string, unknown> | undefined;

        const sourceRepo = new SqliteSourceRepository(db);
        const voiceCount = sourceRepo.getSourceCountByType('voice');
        const knowledgeCount = sourceRepo.getSourceCountByType('knowledge');
        const pubCount = sourceRepo.getSourceCountByType('publication');

        console.log('Thoth Status');
        console.log();
        console.log('Sources:');
        console.log(`  Voice:        ${voiceCount.ok ? voiceCount.value : 0} chunks`);
        console.log(`  Knowledge:    ${knowledgeCount.ok ? knowledgeCount.value : 0} chunks`);
        console.log(`  Publications: ${pubCount.ok ? pubCount.value : 0} chunks`);
        console.log();
        console.log('Profiles:');
        console.log(
          `  Voice:        ${voiceProfile ? `✅ ${(voiceProfile.summary as string)?.slice(0, 60)}...` : '❌ Not generated'}`,
        );
        console.log(
          `  Knowledge:    ${knowledgeProfile ? `✅ ${(knowledgeProfile.domains as string)?.slice(0, 60)}...` : '❌ Not generated'}`,
        );
        console.log(
          `  Publication:  ${pubProfile ? `✅ ${(pubProfile.themes as string)?.slice(0, 60)}...` : '❌ Not generated'}`,
        );

        db.close();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Status check failed');
        console.error('Status check failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
