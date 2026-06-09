import mongoose from 'mongoose';

import { env, isTest } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Mongoose connection management.
 *
 * Connecting is done explicitly at startup (before the HTTP listener binds)
 * so the process fails fast if the database is unreachable, rather than
 * accepting requests it cannot serve. Disconnecting is wired into graceful
 * shutdown so in-flight operations can drain.
 */

// Fail queries fast instead of buffering them indefinitely when the
// connection is down — surfaces problems instead of hanging requests.
mongoose.set('bufferTimeoutMS', 10_000);
mongoose.set('strictQuery', true);

let listenersBound = false;

function bindConnectionListeners(): void {
  if (listenersBound) return;
  listenersBound = true;

  const connection = mongoose.connection;
  connection.on('connected', () => {
    logger.info('MongoDB connected');
  });
  connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
  connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
  connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });
}

export interface ConnectOptions {
  /** Override the connection string (used by tests). */
  uri?: string;
  /** How many times to retry the initial connection before giving up. */
  retries?: number;
  /** Base delay between retries in ms (grows linearly with each attempt). */
  retryDelayMs?: number;
}

/**
 * Establish the initial connection, retrying a few times so transient
 * startup races (e.g. the DB container still booting) don't crash the app.
 */
export async function connectDb(options: ConnectOptions = {}): Promise<typeof mongoose> {
  const {
    uri = env.MONGODB_URI,
    retries = isTest ? 1 : 5,
    retryDelayMs = 2_000,
  } = options;

  bindConnectionListeners();

  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5_000,
        // Keep the pool modest; tune per deployment.
        maxPoolSize: 10,
      });
      return mongoose;
    } catch (err) {
      lastError = err;
      logger.warn(
        { attempt, retries, err: err instanceof Error ? err.message : err },
        'MongoDB connection attempt failed',
      );
      if (attempt < retries) {
        await delay(retryDelayMs * attempt);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to connect to MongoDB');
}

/** Cleanly close the connection (idempotent). */
export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}
