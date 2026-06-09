import { pino } from 'pino';

import { env, isProduction } from '../config/env.js';

/**
 * Application logger. In development we pretty-print for readability; in
 * production we emit structured JSON for log aggregators. Tests run silent
 * unless LOG_LEVEL is overridden.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isProduction
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
});

export type Logger = typeof logger;
