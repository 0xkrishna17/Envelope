import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const serviceWorkerSource = readFileSync('public/sw.js', 'utf8');

describe('service worker source', () => {
  it('only uses the cached app shell for navigation fallback', () => {
    expect(serviceWorkerSource).toContain('isNavigationRequest(event.request)');
    expect(serviceWorkerSource).toContain('handleNavigationRequest(event.request)');
    expect(serviceWorkerSource).toContain('handleAssetRequest(event.request)');
    expect(serviceWorkerSource).not.toContain(".catch(() => caches.match('/'))");
  });

  it('rejects html responses for non-navigation asset requests', () => {
    expect(serviceWorkerSource).toContain('return !isHtmlResponse(response);');
    expect(serviceWorkerSource).toContain('return Response.error();');
  });

  it('versions caches and activates updated workers promptly', () => {
    expect(serviceWorkerSource).toContain("const APP_VERSION = 'v1.0.1';");
    expect(serviceWorkerSource).toContain('const CACHE_NAME = `envelope-budget-${APP_VERSION}`;');
    expect(serviceWorkerSource).toContain('self.skipWaiting()');
    expect(serviceWorkerSource).toContain('self.clients.claim()');
    expect(serviceWorkerSource).toContain("event.data?.type === 'SKIP_WAITING'");
    expect(serviceWorkerSource).toContain('caches.delete(key)');
  });
});
