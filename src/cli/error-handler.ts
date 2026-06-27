import type { LoggerPort } from '../application/ports/logger.ts';
import * as ui from './ui.ts';

export async function withCliError<T>(
  logger: LoggerPort,
  label: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, `${label} failed`);
    ui.error(`${label} failed: ${message}`);
    process.exit(1);
  }
}
