import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Result } from '../../domain/entities/result.ts';
import type {
  MediumAdapter,
  MediumConnectParams,
  MediumPublishParams,
  MediumPublishResult,
} from '../../domain/repositories/medium-adapter.ts';
import type { LoggerPort } from '../../application/ports/logger.ts';

const SESSION_DIR = join(homedir(), '.thoth');
const CREDENTIALS_FILE = join(SESSION_DIR, 'medium-credentials.json');

interface MediumCredentials {
  sid: string;
  uid: string;
}

export class MediumHttpAdapter implements MediumAdapter {
  constructor(private readonly logger: LoggerPort) {}

  connect(params: MediumConnectParams): Promise<Result<void>> {
    if (!existsSync(SESSION_DIR)) {
      mkdirSync(SESSION_DIR, { recursive: true });
    }

    const credentials: MediumCredentials = {
      sid: params.sid.trim(),
      uid: params.uid.trim(),
    };

    writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials), { mode: 0o600 });

    this.logger.info({ action: 'connect_medium_saved' }, 'Medium credentials saved.');

    return Promise.resolve({ ok: true, value: undefined });
  }

  isAuthenticated(): Promise<boolean> {
    if (!existsSync(CREDENTIALS_FILE)) return Promise.resolve(false);

    try {
      const raw = readFileSync(CREDENTIALS_FILE, 'utf-8');
      const creds = JSON.parse(raw) as MediumCredentials;
      return Promise.resolve(typeof creds.sid === 'string' && typeof creds.uid === 'string');
    } catch {
      return Promise.resolve(false);
    }
  }

  async publish(params: MediumPublishParams): Promise<Result<MediumPublishResult>> {
    if (!existsSync(CREDENTIALS_FILE)) {
      return {
        ok: false,
        error: 'Not authenticated. Run `thoth connect medium` first.',
      };
    }

    let credentials: MediumCredentials;
    try {
      credentials = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf-8')) as MediumCredentials;
    } catch {
      return { ok: false, error: 'Credentials file is corrupted. Run `thoth connect medium` again.' };
    }

    const cookie = `uid=${credentials.uid}; sid=${credentials.sid}`;

    try {
      this.logger.info({ action: 'publish' }, 'Creating Medium draft via API...');

      const response = await fetch('https://medium.com/_/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          title: params.title,
          content: params.content,
          contentFormat: 'markdown',
          publishStatus: 'draft',
          tags: [],
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.error(
          { status: response.status, body: text.slice(0, 500) },
          'Medium API returned error',
        );
        return {
          ok: false,
          error:
            response.status === 401 || response.status === 403
              ? 'Medium rejected the credentials. Your session may have expired. Run `thoth connect medium` again.'
              : `Medium API error (${response.status}). The API may have changed.`,
        };
      }

      const body = (await response.json()) as Record<string, unknown>;
      const payload = body.payload as Record<string, unknown> | undefined;
      const mediumPostId = (payload?.id as string) ?? '';
      const mediumUrl = mediumPostId
        ? `https://medium.com/p/${mediumPostId}`
        : 'https://medium.com/me/stories';

      const result: MediumPublishResult = { mediumPostId, mediumUrl };

      this.logger.info({ action: 'publish_success', mediumUrl }, 'Draft created on Medium.');

      return { ok: true, value: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Publish failed: ${message}` };
    }
  }
}
