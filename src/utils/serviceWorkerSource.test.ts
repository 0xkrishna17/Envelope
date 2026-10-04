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
});
