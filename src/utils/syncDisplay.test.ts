import { describe, expect, it } from 'vitest';
import {
  formatLastCloudSync,
  getCloudSyncBadgeStatus,
  getCloudSyncDescription,
  getCloudSyncHeadline,
} from './syncDisplay';

describe('sync display copy', () => {
  it('does not claim a missing sync timestamp happened just now', () => {
    expect(formatLastCloudSync(null)).toBe('Not synced yet');
    expect(formatLastCloudSync('   ')).toBe('Not synced yet');
  });

  it('preserves an actual sync timestamp', () => {
    expect(formatLastCloudSync('03:45 PM')).toBe('03:45 PM');
  });

  it('reports local-only state before a cloud household is verified', () => {
    expect(getCloudSyncBadgeStatus('synced', null, 'local_only')).toBe('local_only');
    expect(getCloudSyncHeadline('local_only')).toBe('Local Ledger Only');
    expect(getCloudSyncDescription('local_only')).toContain('create or join a cloud household');
  });

  it('reports access-denied state before raw sync status details', () => {
    expect(getCloudSyncBadgeStatus('synced', '03:45 PM', 'access_denied')).toBe('access_denied');
    expect(getCloudSyncHeadline('access_denied')).toBe('Cloud Access Not Verified');
    expect(getCloudSyncDescription('access_denied')).toContain('not authorized');
  });

  it('reports verifying state as syncing/checking cloud sync', () => {
    expect(getCloudSyncBadgeStatus('synced', null, 'verifying')).toBe('syncing');
    expect(getCloudSyncHeadline('syncing')).toBe('Checking Cloud Sync...');
  });

  it('shows a ready state instead of synced when a verified cloud household has no sync timestamp', () => {
    expect(getCloudSyncBadgeStatus('synced', null, 'verified')).toBe('not_synced');
    expect(getCloudSyncBadgeStatus('synced', '   ', 'verified')).toBe('not_synced');
    expect(getCloudSyncHeadline('not_synced')).toBe('Cloud Sync Ready');
    expect(getCloudSyncDescription('not_synced')).toContain('Run your first sync');
  });

  it('preserves synced status after a verified cloud household has a successful sync timestamp', () => {
    expect(getCloudSyncBadgeStatus('synced', '03:45 PM', 'verified')).toBe('synced');
    expect(getCloudSyncHeadline('synced')).toBe('Cloud Sync Connected');
  });

  it('uses status-specific connection descriptions', () => {
    expect(getCloudSyncBadgeStatus('syncing', null, 'verified')).toBe('syncing');
    expect(getCloudSyncDescription('offline')).toContain('saved locally');
    expect(getCloudSyncDescription('error')).toContain('could not confirm');
  });
});
