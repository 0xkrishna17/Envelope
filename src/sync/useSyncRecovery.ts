import { useEffect } from 'react';
import { SyncResult } from './types';

interface UseSyncRecoveryParams {
  enabled: boolean;
  isSyncing: boolean;
  refreshIntervalMs?: number;
  onRecover: () => Promise<SyncResult>;
}

const DEFAULT_REFRESH_INTERVAL_MS = 3 * 60 * 1000;

export function shouldAttemptSyncRecovery(params: {
  enabled: boolean;
  isSyncing: boolean;
  visibilityState: DocumentVisibilityState;
}): boolean {
  return params.enabled && !params.isSyncing && params.visibilityState === 'visible';
}

export function useSyncRecovery({
  enabled,
  isSyncing,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
  onRecover,
}: UseSyncRecoveryParams): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') return;

    let disposed = false;

    const recover = () => {
      if (disposed || !shouldAttemptSyncRecovery({ enabled, isSyncing, visibilityState: document.visibilityState })) return;
      onRecover().catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') recover();
    };

    window.addEventListener('online', recover);
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = window.setInterval(recover, refreshIntervalMs);

    return () => {
      disposed = true;
      window.removeEventListener('online', recover);
      window.removeEventListener('focus', recover);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [enabled, isSyncing, onRecover, refreshIntervalMs]);
}
