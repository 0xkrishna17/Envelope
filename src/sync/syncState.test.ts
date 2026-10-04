import { describe, expect, it } from 'vitest';
import { deriveSyncStatusView } from './syncState';

describe('deriveSyncStatusView', () => {
  it('reports signed-out local-only state', () => {
    const view = deriveSyncStatusView({
      isSignedIn: false,
      isCloudBacked: false,
      isOnline: true,
      pendingCount: 0,
      failedCount: 0,
      lastSyncedAt: null,
    });

    expect(view.mode).toBe('signed_out');
    expect(view.isCurrent).toBe(true);
    expect(view.canManualSync).toBe(false);
  });

  it('reports pending cloud changes', () => {
    const view = deriveSyncStatusView({
      isSignedIn: true,
      isCloudBacked: true,
      isOnline: true,
      pendingCount: 2,
      failedCount: 0,
      lastSyncedAt: null,
    });

    expect(view.mode).toBe('pending_changes');
    expect(view.isCurrent).toBe(false);
    expect(view.canManualSync).toBe(true);
  });

  it('prioritizes permission denied over pending changes', () => {
    const view = deriveSyncStatusView({
      isSignedIn: true,
      isCloudBacked: true,
      isOnline: true,
      permissionDenied: true,
      pendingCount: 1,
      failedCount: 0,
      lastSyncedAt: null,
    });

    expect(view.mode).toBe('permission_denied');
    expect(view.canManualSync).toBe(false);
  });
});
