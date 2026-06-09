import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './lib/db.js';
import { logger } from './lib/logger.js';

/**
 * Process entry point. Connects to MongoDB, starts the HTTP listener, and
 * wires up graceful shutdown plus last-resort handlers for unexpected
 * failures.
 */
async function start(): Promise<void> {
  // Connect to the database before binding the port so the server never
  // accepts traffic it cannot serve.
  await connectDb();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `CollabBoard server listening on http://localhost:${env.PORT}`,
    );
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully');

    // Force-exit if connections do not drain in time.
    const forceTimer = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
    forceTimer.unref();

    server.close((err) => {
      void (async () => {
        try {
          await disconnectDb();
        } catch (dbErr) {
          logger.error({ err: dbErr }, 'Error closing MongoDB connection');
        }
        clearTimeout(forceTimer);
        if (err) {
          logger.error({ err }, 'Error during shutdown');
          process.exit(1);
        }
        process.exit(0);
      })();
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
