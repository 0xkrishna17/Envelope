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
      return 'Sign In Required';
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
      return 'Cloud Unavailable';
  }
};

export const getCloudSyncDescription = (status: CloudSyncBadgeStatus): string => {
  switch (status) {
    case 'local_only':
      return 'Sign in with an authorized Google account before creating or changing ledger data.';
    case 'access_denied':
      return 'This Google account is not authorized for the selected cloud ledger. Ask the household owner to invite this email, or switch accounts.';
    case 'not_synced':
      return 'Your cloud household is ready. Run your first sync to load the latest authorized ledger state.';
    case 'synced':
      return 'Your latest ledger is available on authorized household devices. New expenses, salary events, transfers, and card reconciliations require cloud connectivity.';
    case 'syncing':
      return 'Envelope changes are currently being checked or exchanged with your cloud household ledger.';
    case 'error':
      return 'The app could not confirm the latest cloud sync. Reconnect or check account access before making more changes.';
    case 'offline':
      return 'Changes were not saved. Reconnect to Cloud Firestore and try again.';
  }
};

export const formatLastCloudSync = (lastCloudSync: string | null): string => {
  return lastCloudSync?.trim() || 'Not synced yet';
};
