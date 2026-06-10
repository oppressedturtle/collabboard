import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      SMTP_HOST: 'disabled',
      // Pin the mongodb-memory-server binary so it doesn't try to auto-detect
      // an unavailable distro version at test time.
      MONGOMS_VERSION: '7.0.14',
      MONGOMS_DISTRO: 'debian-12',
    },
    testTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/server.ts',
        'src/lib/db.ts',
        'src/lib/logger.ts',
        'src/lib/socket.ts',
        'src/lib/mail.ts',
        'src/types/**',
      ],
      thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 },
    },
  },
});
