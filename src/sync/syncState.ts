import { SyncMode } from './types';

export interface SyncStatusInput {
  mode?: SyncMode;
  isSignedIn: boolean;
  isCloudBacked: boolean;
  isOnline: boolean;
  isConnecting?: boolean;
  isSyncing?: boolean;
  permissionDenied?: boolean;
  hasConflict?: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: string | null;
  lastError?: string | null;
}

export interface SyncStatusView {
  mode: SyncMode;
  label: string;
  detail?: string;
  isCloudBacked: boolean;
  isCurrent: boolean;
  canManualSync: boolean;
  pendingCount: number;
}

export function deriveSyncStatusView(input: SyncStatusInput): SyncStatusView {
  if (!input.isSignedIn) {
    return {
      mode: 'signed_out',
      label: 'Local only',
      detail: 'Sign in with Google to sync across devices.',
      isCloudBacked: false,
      isCurrent: true,
      canManualSync: false,
      pendingCount: input.pendingCount,
    };
  }

  if (!input.isCloudBacked) {
    return {
      mode: 'needs_import',
      label: 'Needs cloud import',
      detail: 'Import this device ledger before syncing with other devices.',
      isCloudBacked: false,
      isCurrent: input.pendingCount === 0,
      canManualSync: false,
      pendingCount: input.pendingCount,
    };
  }

  if (input.permissionDenied) {
    return {
      mode: 'permission_denied',
      label: 'Access denied',
      detail: 'This Google account is not allowed to access the shared ledger.',
      isCloudBacked: true,
      isCurrent: false,
      canManualSync: false,
      pendingCount: input.pendingCount,
    };
  }

  if (input.hasConflict) {
    return {
      mode: 'conflict',
      label: 'Conflict detected',
      detail: 'The ledger changed on another device. Reload the latest cloud data before retrying.',
      isCloudBacked: true,
      isCurrent: false,
      canManualSync: true,
      pendingCount: input.pendingCount,
    };
  }

  if (!input.isOnline) {
    return {
      mode: 'offline',
      label: 'Cloud unavailable',
      detail: 'Changes are blocked while this device is offline. Reconnect and try again.',
      isCloudBacked: true,
      isCurrent: input.pendingCount === 0,
      canManualSync: false,
      pendingCount: input.pendingCount,
    };
  }

  if (input.failedCount > 0) {
    return {
      mode: 'error',
      label: 'Sync error',
      detail: input.lastError || `${input.failedCount} change${input.failedCount === 1 ? '' : 's'} could not sync.`,
      isCloudBacked: true,
      isCurrent: false,
      canManualSync: true,
      pendingCount: input.pendingCount,
    };
  }

  if (input.isConnecting) {
    return {
      mode: 'connecting',
      label: 'Connecting...',
      isCloudBacked: true,
      isCurrent: false,
      canManualSync: false,
      pendingCount: input.pendingCount,
    };
  }

  if (input.isSyncing) {
    return {
      mode: 'syncing',
      label: 'Saving...',
      isCloudBacked: true,
      isCurrent: false,
      canManualSync: false,
      pendingCount: input.pendingCount,
    };
  }

  if (input.pendingCount > 0) {
    return {
      mode: 'pending_changes',
      label: `${input.pendingCount} cloud change${input.pendingCount === 1 ? '' : 's'} pending verification`,
      detail: 'Refresh cloud sync before making more changes.',
      isCloudBacked: true,
      isCurrent: false,
      canManualSync: true,
      pendingCount: input.pendingCount,
    };
  }

  return {
    mode: input.mode || 'synced',
    label: input.lastSyncedAt ? `Synced ${input.lastSyncedAt}` : 'Synced',
    isCloudBacked: true,
    isCurrent: true,
    canManualSync: true,
    pendingCount: 0,
  };
}
