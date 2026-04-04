import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    exclude: [
      'node_modules/**',
      'tests/e2e/**',
      'dist/**',
      '.idea/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/**/*.js'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    },
    testTimeout: 15000,
    hookTimeout: 15000,
    isolate: true,
    threads: true,
    maxThreads: 4,
    minThreads: 1
  }
});
