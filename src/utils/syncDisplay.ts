import type { SyncState } from '../store/types';

export type CloudSyncDisplayStatus = Exclude<SyncState, 'idle'>;

export const getCloudSyncHeadline = (status: CloudSyncDisplayStatus): string => {
  switch (status) {
    case 'synced':
      return 'Cloud Sync Connected';
    case 'syncing':
      return 'Syncing Ledger Updates...';
    case 'error':
      return 'Cloud Sync Needs Attention';
    case 'offline':
      return 'Working Offline (Local Storage Active)';
  }
};

export const getCloudSyncDescription = (status: CloudSyncDisplayStatus): string => {
  switch (status) {
    case 'synced':
      return 'Your latest synced ledger is available on authorized household devices. New expenses, salary events, transfers, and card reconciliations will continue syncing when connected.';
    case 'syncing':
      return 'Envelope changes are currently being exchanged with your cloud household ledger. Keep this screen open until the sync finishes.';
    case 'error':
      return 'The app could not confirm the latest cloud sync. Your local ledger remains available while you retry or check account access.';
    case 'offline':
      return 'Changes are saved locally on this device and will not appear on partner devices until cloud sync reconnects.';
  }
};

export const formatLastCloudSync = (lastCloudSync: string | null): string => {
  return lastCloudSync?.trim() || 'Not synced yet';
};
