import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Load variables from a local .env file when present. In production the
// environment is expected to be provided by the platform, so a missing file
// is not an error.
loadDotenv();

/**
 * Schema for all environment variables the server depends on. Validating at
 * startup means the process fails fast with a clear message instead of
 * surfacing `undefined` deep inside request handlers later.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  MONGODB_URI: z
    .string()
    .url()
    .default('mongodb://localhost:27017/collabboard'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Surface every invalid/missing variable at once, then exit.
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export type Env = z.infer<typeof envSchema>;

export const env: Env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
