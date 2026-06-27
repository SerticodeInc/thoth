import pino from 'pino';
import type { LoggerPort } from '../../application/ports/logger.ts';

const pinoInstance = pino({
  level: process.env.LOG_LEVEL ?? 'warn',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino/file', options: { destination: 2 } }
      : undefined,
});

export const logger: LoggerPort = {
  info(obj: Record<string, unknown> | string, msg?: string) {
    if (typeof obj === 'string') {
      pinoInstance.info(obj);
    } else {
      pinoInstance.info(obj, msg ?? '');
    }
  },
  warn(obj: Record<string, unknown> | string, msg?: string) {
    if (typeof obj === 'string') {
      pinoInstance.warn(obj);
    } else {
      pinoInstance.warn(obj, msg ?? '');
    }
  },
  error(obj: Record<string, unknown> | string, msg?: string) {
    if (typeof obj === 'string') {
      pinoInstance.error(obj);
    } else {
      pinoInstance.error(obj, msg ?? '');
    }
  },
  debug(obj: Record<string, unknown> | string, msg?: string) {
    if (typeof obj === 'string') {
      pinoInstance.debug(obj);
    } else {
      pinoInstance.debug(obj, msg ?? '');
    }
  },
};
