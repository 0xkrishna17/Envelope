import type { SyncState } from '../store/types';

export type CloudSyncDisplayStatus = Exclude<SyncState, 'idle'>;
export type CloudSetupDisplayStatus = 'local_only' | 'verifying' | 'verified' | 'access_denied';
export type CloudSyncBadgeStatus = CloudSyncDisplayStatus | 'not_synced' | 'local_only' | 'access_denied';

export const getCloudSyncBadgeStatus = (
  status: CloudSyncDisplayStatus,
  lastCloudSync: string | null,
  setupStatus: CloudSetupDisplayStatus = 'verified'
): CloudSyncBadgeStatus => {
  if (setupStatus === 'local_only') {
    return 'local_only';
  }

  if (setupStatus === 'access_denied') {
    return 'access_denied';
  }

  if (setupStatus === 'verifying') {
    return 'syncing';
  }

  if (status === 'synced' && !lastCloudSync?.trim()) {
    return 'not_synced';
  }

  return status;
};

export const getCloudSyncHeadline = (status: CloudSyncBadgeStatus): string => {
  switch (status) {
    case 'local_only':
      return 'Local Ledger Only';
    case 'access_denied':
      return 'Cloud Access Not Verified';
    case 'not_synced':
      return 'Cloud Sync Ready';
    case 'synced':
      return 'Cloud Sync Connected';
    case 'syncing':
      return 'Checking Cloud Sync...';
    case 'error':
      return 'Cloud Sync Needs Attention';
    case 'offline':
      return 'Working Offline (Local Storage Active)';
  }
};

export const getCloudSyncDescription = (status: CloudSyncBadgeStatus): string => {
  switch (status) {
    case 'local_only':
      return 'This ledger is saved on this device. Sign in and create or join a cloud household before syncing across authorized devices.';
    case 'access_denied':
      return 'This Google account is not authorized for the selected cloud ledger. Ask the household owner to invite this email, or switch accounts.';
    case 'not_synced':
      return 'Your cloud household is ready. Run your first sync to make this ledger available on authorized household devices.';
    case 'synced':
      return 'Your latest ledger is available on authorized household devices. New expenses, salary events, transfers, and card reconciliations will continue syncing when connected.';
    case 'syncing':
      return 'Envelope changes are currently being checked or exchanged with your cloud household ledger.';
    case 'error':
      return 'The app could not confirm the latest cloud sync. Your local ledger remains available while you retry or check account access.';
    case 'offline':
      return 'Changes are saved locally on this device and will not appear on partner devices until cloud sync reconnects.';
  }
};

export const formatLastCloudSync = (lastCloudSync: string | null): string => {
  return lastCloudSync?.trim() || 'Not synced yet';
};
