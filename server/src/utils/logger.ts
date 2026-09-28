/**
 * Structured logger based on Pino.
 *
 * In development, logs are pretty-printed via pino-pretty.
 * In production, logs are JSON for ingestion by log aggregators.
 *
 * Sensitive fields (passwords, tokens, API keys) are redacted
 * automatically from request logs.
 */

import pino from 'pino';
import { createRequire } from 'node:module';

const isProd = process.env['NODE_ENV'] === 'production';

/** pino-pretty is a dev dependency — only use it when it is installed */
function hasPretty(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

export const logger = pino({
  level: process.env['LOG_LEVEL'] || (isProd ? 'info' : 'debug'),
  ...(isProd || !hasPretty()
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'body.password',
      'body.token',
      'body.secret',
      'body.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
});
