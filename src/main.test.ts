import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync('src/main.tsx', 'utf8');

describe('legacy offline cleanup', () => {
  it('unregisters old service workers and clears caches without registering a new worker', () => {
    expect(mainSource).toContain('navigator.serviceWorker.getRegistrations()');
    expect(mainSource).toContain('registration.unregister()');
    expect(mainSource).toContain('caches.keys()');
    expect(mainSource).toContain('caches.delete(key)');
    expect(mainSource).not.toContain("register('/sw.js')");
  });
});
