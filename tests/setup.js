/**
 * Vitest Setup
 * Runs before all tests
 */

import { beforeAll, afterAll, afterEach } from 'vitest';
import { join } from 'path';
import { existsSync, rmSync, mkdirSync } from 'fs';

// Test database path
const testDbDir = join(import.meta.url.replace('file://', ''), '..', '..', '.test-data');
const testDbPath = join(testDbDir, 'test-health.db');

beforeAll(() => {
  // Clean up test database before running tests
  if (existsSync(testDbPath)) {
    rmSync(testDbPath);
  }
  if (!existsSync(testDbDir)) {
    mkdirSync(testDbDir, { recursive: true });
  }
});

afterEach(() => {
  // Clean up after each test if needed
});

afterAll(() => {
  // Clean up test database after all tests
  if (existsSync(testDbPath)) {
    rmSync(testDbPath);
  }
});

export { testDbPath, testDbDir };
