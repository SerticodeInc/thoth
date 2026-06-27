import type { Command } from 'commander';
import { getDatabase } from '../../infrastructure/persistence/database.ts';
import { logger } from '../../infrastructure/logging/logger.ts';
import { GenerateProfilesUseCase } from '../../application/use-cases/generate-profiles.usecase.ts';
import { OpenAiAiService } from '../../infrastructure/ai/ai.service.ts';
import { SqliteProfileRepository } from '../../infrastructure/persistence/repositories/sqlite-profile-repository.ts';
import { SqliteSourceRepository } from '../../infrastructure/persistence/repositories/sqlite-source-repository.ts';
import * as ui from '../ui.ts';
import { withCliError } from '../error-handler.ts';

function preview(value: unknown): string {
  if (typeof value !== 'string') return '';
  return `${value.slice(0, 60)}...`;
}

export function registerProfileCommand(program: Command): void {
  program
    .command('generate_profile')
    .description('Generate identity profiles from imported sources')
    .action(async () => {
      await withCliError(logger, 'Profile generation', async () => {
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
          ui.error('No sources imported.');
          ui.nextSteps(['thoth import_voice <path>  Import writing samples']);
          process.exit(1);
        }

        ui.heading('Generating identity profiles');
        ui.meta('Voice chunks', counts.voice);
        ui.meta('Knowledge chunks', counts.knowledge);
        ui.meta('Publication chunks', counts.publication);
        ui.blank();
        let generatedCount = 0;
        const failures: string[] = [];
        const startTime = process.hrtime();

        if (counts.voice > 0) {
          const spin = ui.spinner('Generating voice profile...');
          spin.start();
          const result = await useCase.generateVoiceProfile();
          spin.stop();
          if (!result.ok) {
            ui.error(`Voice profile failed: ${result.error}`);
            failures.push(`voice: ${result.error}`);
          } else {
            generatedCount += 1;
            ui.success('Voice profile generated');
            ui.meta('Summary', result.value.summary ?? 'No summary');
          }
        }

        if (counts.knowledge > 0) {
          const spin = ui.spinner('Generating knowledge profile...');
          spin.start();
          const result = await useCase.generateKnowledgeProfile();
          spin.stop();
          if (!result.ok) {
            ui.error(`Knowledge profile failed: ${result.error}`);
            failures.push(`knowledge: ${result.error}`);
          } else {
            generatedCount += 1;
            ui.success('Knowledge profile generated');
            ui.meta('Domains', result.value.domains.join(', '));
          }
        }

        if (counts.publication > 0) {
          const spin = ui.spinner('Generating publication profile...');
          spin.start();
          const result = await useCase.generatePublicationProfile();
          spin.stop();
          if (!result.ok) {
            ui.error(`Publication profile failed: ${result.error}`);
            failures.push(`publication: ${result.error}`);
          } else {
            generatedCount += 1;
            ui.success('Publication profile generated');
            ui.meta('Themes', result.value.themes.join(', '));
          }
        }

        const duration = ui.timer(startTime);
        ui.blank();
        if (failures.length > 0) {
          ui.error(
            generatedCount > 0
              ? `Profile generation completed with ${failures.length} failure(s).`
              : 'Profile generation failed.',
          );
          db.close();
          process.exit(1);
        }

        ui.divider();
        ui.summary({
          Generated: `${generatedCount} of 3`,
          Duration: duration,
        });
        ui.blank();
        ui.nextSteps([
          'thoth profile_status             Review profile readiness',
          'thoth research "<topic>"         Research from imported knowledge',
          'thoth generate_article --topic   Draft in your voice',
        ]);

        db.close();
      });
    });

  program
    .command('profile_status')
    .description('Show profile generation status')
    .action(async () => {
      await withCliError(logger, 'Status check', async () => {
        const db = getDatabase();
        const profileRepo = new SqliteProfileRepository(db);
        const sourceRepo = new SqliteSourceRepository(db);

        const voiceCount = sourceRepo.getSourceCountByType('voice');
        const knowledgeCount = sourceRepo.getSourceCountByType('knowledge');
        const pubCount = sourceRepo.getSourceCountByType('publication');
        const statusResult = await profileRepo.getProfileStatus();

        if (!statusResult.ok) {
          ui.error(`Status check failed: ${statusResult.error}`);
          process.exit(1);
        }

        const status = statusResult.value;

        ui.heading('Thoth status');
        ui.section('Sources');
        ui.meta('Voice', `${voiceCount.ok ? voiceCount.value : 0} chunks`);
        ui.meta('Knowledge', `${knowledgeCount.ok ? knowledgeCount.value : 0} chunks`);
        ui.meta('Publications', `${pubCount.ok ? pubCount.value : 0} chunks`);
        ui.blank();
        ui.section('Profiles');
        ui.meta(
          'Voice',
          status.voice.exists
            ? `${ui.color.green('[ready]')} ${preview(status.voice.summary)}`
            : `${ui.color.yellow('[missing]')} Not generated`,
        );
        ui.meta(
          'Knowledge',
          status.knowledge.exists
            ? `${ui.color.green('[ready]')} ${preview(status.knowledge.domains)}`
            : `${ui.color.yellow('[missing]')} Not generated`,
        );
        ui.meta(
          'Publication',
          status.publication.exists
            ? `${ui.color.green('[ready]')} ${preview(status.publication.themes)}`
            : `${ui.color.yellow('[missing]')} Not generated`,
        );

        db.close();
      });
    });
}
