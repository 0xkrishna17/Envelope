import { describe, expect, it } from 'vitest';
import {
  formatLastCloudSync,
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

  it('uses status-specific connection descriptions', () => {
    expect(getCloudSyncHeadline('synced')).toBe('Cloud Sync Connected');
    expect(getCloudSyncDescription('offline')).toContain('saved locally');
    expect(getCloudSyncDescription('error')).toContain('could not confirm');
  });
});
