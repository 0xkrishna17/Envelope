import { describe, expect, it } from 'vitest';
import { describeErrorCode, maskIdentifier, summarizeSyncResult } from './syncDebug';

describe('sync debug helpers', () => {
  it('masks identifiers before they are logged', () => {
    expect(maskIdentifier('household_abcdef123456')).toBe('hous…3456');
    expect(maskIdentifier('abcd')).toBe('ab…cd');
    expect(maskIdentifier(null)).toBeNull();
  });

  it('summarizes sync results without adding credentials', () => {
    expect(summarizeSyncResult({ ok: true, syncedAt: '03:45 PM', version: 4 })).toEqual({
      ok: true,
      syncedAt: '03:45 PM',
      version: 4,
    });
    expect(summarizeSyncResult({ ok: false, reason: 'permission_denied', message: 'Denied' })).toEqual({
      ok: false,
      reason: 'permission_denied',
      message: 'Denied',
    });
  });

  it('extracts only error codes for safe logging', () => {
    expect(describeErrorCode({ code: 'permission-denied', message: 'private details' })).toBe('permission-denied');
    expect(describeErrorCode(new TypeError('private details'))).toBe('TypeError');
  });
});
