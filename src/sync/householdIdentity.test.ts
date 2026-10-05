import { describe, expect, it } from 'vitest';
import {
  createCloudHouseholdDocId,
  DEFAULT_HOUSEHOLD_DOC_ID,
  LOCAL_HOUSEHOLD_ID,
  isLocalHouseholdId,
  isValidCloudHouseholdId,
  normalizeCloudHouseholdDocId,
  normalizeHouseholdDocId,
} from './householdIdentity';

describe('householdIdentity', () => {
  it('uses local as the default household id', () => {
    expect(DEFAULT_HOUSEHOLD_DOC_ID).toBe(LOCAL_HOUSEHOLD_ID);
    expect(isLocalHouseholdId(null)).toBe(true);
    expect(isLocalHouseholdId('local')).toBe(true);
    expect(isLocalHouseholdId('hh_valid_household')).toBe(false);
  });

  it('accepts only generated cloud household ids for cloud sync', () => {
    expect(isValidCloudHouseholdId(LOCAL_HOUSEHOLD_ID)).toBe(false);
    expect(isValidCloudHouseholdId('household_without_prefix')).toBe(false);
    expect(isValidCloudHouseholdId('hh_valid_household')).toBe(true);
    expect(normalizeCloudHouseholdDocId(' hh_valid_household ')).toBe('hh_valid_household');
    expect(normalizeCloudHouseholdDocId(LOCAL_HOUSEHOLD_ID)).toBeNull();
  });

  it('creates generated cloud household ids with the required prefix', () => {
    expect(createCloudHouseholdDocId()).toMatch(/^hh_/);
  });

  it('normalizes blank household values to local', () => {
    expect(normalizeHouseholdDocId('')).toBe(LOCAL_HOUSEHOLD_ID);
    expect(normalizeHouseholdDocId(' hh_valid_household ')).toBe('hh_valid_household');
  });
});
