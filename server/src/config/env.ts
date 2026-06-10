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

  // --- Auth / tokens ---
  JWT_ACCESS_SECRET: z
    .string()
    .min(32)
    .default('dev-access-secret-change-me-please-0123456789'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32)
    .default('dev-refresh-secret-change-me-please-0123456789'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),

  // --- Cookies ---
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  // --- Application URL (used in email links) ---
  APP_URL: z.string().url().default('http://localhost:5173'),

  // --- Email (SMTP / Mailhog in dev) ---
  // Set SMTP_HOST=disabled to silence all email sending (useful in CI).
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('"CollabBoard" <noreply@collabboard.local>'),
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

// Refuse to boot in production with the built-in development secrets — these
// are public in the repo and would make tokens trivially forgeable.
if (isProduction) {
  const usingDefault =
    env.JWT_ACCESS_SECRET.includes('change-me') ||
    env.JWT_REFRESH_SECRET.includes('change-me');
  if (usingDefault) {
    // eslint-disable-next-line no-console
    console.error(
      'Refusing to start in production with default JWT secrets. ' +
        'Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET to strong random values.',
    );
    process.exit(1);
  }
}
