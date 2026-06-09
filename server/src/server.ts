import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

/**
 * Process entry point. Starts the HTTP listener and wires up graceful
 * shutdown plus last-resort handlers for unexpected failures.
 */
function start(): void {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `CollabBoard server listening on http://localhost:${env.PORT}`,
    );
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutting down gracefully');
    server.close((err) => {
      if (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
      process.exit(0);
    });

    // Force-exit if connections do not drain in time.
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — exiting');
    process.exit(1);
  });
}

start();
