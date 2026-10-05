import { describe, expect, it } from 'vitest';
import { getMemberDisplayName, getMemberInitial } from './memberDisplay';

describe('memberDisplay', () => {
  it('returns display name and uppercase initial for valid member names', () => {
    expect(getMemberDisplayName({ name: ' priya ' })).toBe('priya');
    expect(getMemberInitial({ name: ' priya ' })).toBe('P');
  });

  it('falls back when first-load member name data is missing', () => {
    expect(getMemberDisplayName(undefined)).toBe('Household Member');
    expect(getMemberInitial(undefined)).toBe('H');
    expect(getMemberDisplayName({ name: undefined })).toBe('Household Member');
    expect(getMemberInitial({ name: undefined })).toBe('H');
    expect(getMemberInitial({ name: '' })).toBe('H');
  });
});
