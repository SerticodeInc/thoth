import type { Command } from 'commander';
import { logger } from '../../infrastructure/logging/logger.ts';
import {
  createPublishArticleUseCase,
  createMediumAdapter,
  closeDb,
} from '../../infrastructure/composition-root.ts';
import * as ui from '../ui.ts';
import { withCliError } from '../error-handler.ts';

async function promptCookie(label: string): Promise<string> {
  const { stdin, stdout } = process;
  return new Promise((resolve) => {
    stdout.write(`  ${label}: `);
    stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

export function registerPublishCommand(program: Command): void {
  program
    .command('connect_medium')
    .description('Save Medium session cookies for publishing (no password handling)')
    .action(async () => {
      await withCliError(logger, 'Connect Medium', async () => {
        ui.heading('Connect to Medium');
        ui.empty('');
        ui.info('Open medium.com in your browser and log in.');
        ui.info('Then open DevTools:');
        ui.info('  Chrome:  View → Developer → Developer Tools → Application → Cookies');
        ui.info('  Firefox: Tools → Web Developer → Storage Inspector → Cookies');
        ui.info('  Safari:  Develop → Show Web Inspector → Storage → Cookies');
        ui.empty('');
        ui.info('Copy the values for these two cookies:');
        ui.empty('');

        const sid = await promptCookie('sid');
        const uid = await promptCookie('uid');

        if (!sid || !uid) {
          ui.error('Both sid and uid cookies are required.');
          process.exit(1);
        }

        const adapter = createMediumAdapter();
        const result = await adapter.connect({ sid, uid });

        if (!result.ok) {
          ui.error(`Failed to save credentials: ${result.error}`);
          process.exit(1);
        }

        ui.blank();
        ui.success('Credentials saved to ~/.thoth/medium-credentials.json');
        ui.info('You can now run `thoth publish <article-id>` to publish to Medium.');
        closeDb();
      });
    });

  program
    .command('publish')
    .description('Publish an article to Medium as a draft')
    .argument('<id>', 'Article ID to publish')
    .action(async (id: string) => {
      await withCliError(logger, 'Publish to Medium', async () => {
        const adapter = createMediumAdapter();
        const authenticated = await adapter.isAuthenticated();

        if (!authenticated) {
          ui.error('Not authenticated. Run `thoth connect_medium` first.');
          process.exit(1);
        }

        const spin = ui.spinner('Publishing to Medium...');
        spin.start();

        const useCase = createPublishArticleUseCase();
        const result = await useCase.execute(id);

        spin.stop();

        if (!result.ok) {
          ui.error(`Publish failed: ${result.error}`);
          process.exit(1);
        }

        ui.blank();
        ui.success('Article published to Medium.');
        ui.summary({
          Article: result.value.title,
          URL: result.value.mediumUrl ?? '(not set)',
          Status: result.value.status,
        });

        closeDb();
      });
    });
}
