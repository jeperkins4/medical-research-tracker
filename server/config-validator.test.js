import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateConfig } from './config-validator.js';

describe('validateConfig', () => {
  let exitSpy;
  const savedEnv = {};
  const KEYS = ['JWT_SECRET', 'DB_ENCRYPTION_KEY', 'BACKUP_ENCRYPTION_KEY', 'ALLOWED_ORIGINS', 'NODE_ENV'];

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Snapshot and clear relevant keys
    for (const k of KEYS) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const k of KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it('exits when JWT_SECRET is missing', () => {
    process.env.DB_ENCRYPTION_KEY = 'x'.repeat(64);
    validateConfig();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when JWT_SECRET is shorter than 32 characters', () => {
    process.env.JWT_SECRET = 'tooshort';
    process.env.DB_ENCRYPTION_KEY = 'x'.repeat(64);
    validateConfig();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when DB_ENCRYPTION_KEY is missing', () => {
    process.env.JWT_SECRET = 'x'.repeat(32);
    validateConfig();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when DB_ENCRYPTION_KEY is shorter than 64 characters', () => {
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.DB_ENCRYPTION_KEY = 'x'.repeat(32);
    validateConfig();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does not exit when both required keys meet minimum length', () => {
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.DB_ENCRYPTION_KEY = 'x'.repeat(64);
    validateConfig();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits in production when ALLOWED_ORIGINS is missing', () => {
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.DB_ENCRYPTION_KEY = 'x'.repeat(64);
    process.env.NODE_ENV = 'production';
    validateConfig();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does not exit in production when ALLOWED_ORIGINS is set', () => {
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.DB_ENCRYPTION_KEY = 'x'.repeat(64);
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://myapp.com';
    validateConfig();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
