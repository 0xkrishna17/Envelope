import { describe, expect, it } from 'vitest';
import { shouldAttemptSyncRecovery } from './useSyncRecovery';

describe('shouldAttemptSyncRecovery', () => {
  it('allows recovery only when enabled, visible, and not already syncing', () => {
    expect(
      shouldAttemptSyncRecovery({
        enabled: true,
        isSyncing: false,
        visibilityState: 'visible',
      })
    ).toBe(true);

    expect(
      shouldAttemptSyncRecovery({
        enabled: false,
        isSyncing: false,
        visibilityState: 'visible',
      })
    ).toBe(false);

    expect(
      shouldAttemptSyncRecovery({
        enabled: true,
        isSyncing: true,
        visibilityState: 'visible',
      })
    ).toBe(false);

    expect(
      shouldAttemptSyncRecovery({
        enabled: true,
        isSyncing: false,
        visibilityState: 'hidden',
      })
    ).toBe(false);
  });
});
