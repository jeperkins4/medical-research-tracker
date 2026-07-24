import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch } from './apiFetch.js';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('always sends credentials: include', async () => {
    await apiFetch('/api/test');
    const [, opts] = fetch.mock.calls[0];
    expect(opts.credentials).toBe('include');
  });

  it('always sets Content-Type to application/json', async () => {
    await apiFetch('/api/test');
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('merges caller headers without dropping Content-Type', async () => {
    await apiFetch('/api/test', { headers: { Authorization: 'Bearer tok' } });
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.headers['Authorization']).toBe('Bearer tok');
  });

  it('caller can override Content-Type', async () => {
    await apiFetch('/api/test', { headers: { 'Content-Type': 'text/plain' } });
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('text/plain');
  });

  it('passes method and body through to fetch', async () => {
    await apiFetch('/api/test', { method: 'POST', body: JSON.stringify({ x: 1 }) });
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('/api/test');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe('{"x":1}');
  });
});
