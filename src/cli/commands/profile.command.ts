import type { Command } from 'commander';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { GenerateProfilesUseCase } from '../../application/use-cases/generate-profiles.usecase.ts';
import { getSourceCountByType } from '../../infrastructure/persistence/repositories/source-repository.ts';

export function registerProfileCommand(program: Command): void {
  const profileCmd = program.command('profile').description('Manage identity profiles');

  profileCmd
    .command('generate')
    .description('Generate identity profiles from imported sources')
    .action(async () => {
      try {
        const db = getDatabase();
        const useCase = new GenerateProfilesUseCase(db);

        const counts = {
          voice: getSourceCountByType(db, 'voice'),
          knowledge: getSourceCountByType(db, 'knowledge'),
          publication: getSourceCountByType(db, 'publication'),
        };

        if (counts.voice === 0 && counts.knowledge === 0 && counts.publication === 0) {
          console.error('No sources imported. Run `thoth import` first.');
          process.exit(1);
        }

        console.log('Generating identity profiles...');

        if (counts.voice > 0) {
          console.log('  Generating voice profile...');
          const voice = await useCase.generateVoiceProfile();
          console.log(`  Voice profile: ${voice.id}`);
          console.log(`    Summary: ${voice.summary}`);
        }

        if (counts.knowledge > 0) {
          console.log('  Generating knowledge profile...');
          const knowledge = await useCase.generateKnowledgeProfile();
          console.log(`  Knowledge profile: ${knowledge.id}`);
          console.log(`    Domains: ${knowledge.domains.join(', ')}`);
        }

        if (counts.publication > 0) {
          console.log('  Generating publication profile...');
          const pub = await useCase.generatePublicationProfile();
          console.log(`  Publication profile: ${pub.id}`);
          console.log(`    Themes: ${pub.themes.join(', ')}`);
        }

        console.log();
        console.log('Identity profiles generated successfully.');

        db.close();
      } catch (error) {
        logger.error({ error }, 'Profile generation failed');
        console.error('Profile generation failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  profileCmd
    .command('status')
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

        const voiceCount = getSourceCountByType(db, 'voice');
        const knowledgeCount = getSourceCountByType(db, 'knowledge');
        const pubCount = getSourceCountByType(db, 'publication');

        console.log('Thoth Status');
        console.log();
        console.log('Sources:');
        console.log(`  Voice:        ${voiceCount} chunks`);
        console.log(`  Knowledge:    ${knowledgeCount} chunks`);
        console.log(`  Publications: ${pubCount} chunks`);
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
        logger.error({ error }, 'Status check failed');
        console.error('Status check failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
