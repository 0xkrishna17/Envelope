import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync('src/main.tsx', 'utf8');

describe('service worker registration', () => {
  it('checks for updates and reloads once when a new worker takes control', () => {
    expect(mainSource).toContain("navigator.serviceWorker.register('/sw.js').then(registration =>");
    expect(mainSource).toContain('registration.update()');
    expect(mainSource).toContain('const hadController = Boolean(navigator.serviceWorker.controller);');
    expect(mainSource).toContain("navigator.serviceWorker.addEventListener('controllerchange'");
    expect(mainSource).toContain('window.location.reload()');
    expect(mainSource).toContain('if (!hadController || isRefreshing) return;');
  });
});
