import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOUSEHOLD_DOC_ID,
  LEGACY_SHARED_HOUSEHOLD_DOC_ID,
  LOCAL_HOUSEHOLD_ID,
  createCloudHouseholdDocId,
  isLocalHouseholdId,
  isReservedCloudHouseholdId,
  isValidCloudHouseholdId,
  normalizeCloudHouseholdDocId,
  normalizeHouseholdDocId,
  normalizeHouseholdEntity,
  normalizeHouseholdScopedEntity,
} from './householdIdentity';

describe('householdIdentity', () => {
  it('normalizes empty household ids to the local-only sentinel', () => {
    expect(DEFAULT_HOUSEHOLD_DOC_ID).toBe(LOCAL_HOUSEHOLD_ID);
    expect(normalizeHouseholdDocId(null)).toBe(LOCAL_HOUSEHOLD_ID);
    expect(normalizeHouseholdDocId(undefined)).toBe(LOCAL_HOUSEHOLD_ID);
    expect(normalizeHouseholdDocId('   ')).toBe(LOCAL_HOUSEHOLD_ID);
    expect(normalizeHouseholdDocId(' hh_partner ')).toBe('hh_partner');
  });

  it('distinguishes local, reserved, and valid cloud household ids', () => {
    expect(isLocalHouseholdId(null)).toBe(true);
    expect(isLocalHouseholdId(LOCAL_HOUSEHOLD_ID)).toBe(true);
    expect(isReservedCloudHouseholdId(LOCAL_HOUSEHOLD_ID)).toBe(true);
    expect(isReservedCloudHouseholdId(LEGACY_SHARED_HOUSEHOLD_DOC_ID)).toBe(true);
    expect(isValidCloudHouseholdId(LOCAL_HOUSEHOLD_ID)).toBe(false);
    expect(isValidCloudHouseholdId(LEGACY_SHARED_HOUSEHOLD_DOC_ID)).toBe(false);
    expect(isValidCloudHouseholdId('hh_valid_household')).toBe(true);
  });

  it('generates unique valid cloud household ids', () => {
    const first = createCloudHouseholdDocId();
    const second = createCloudHouseholdDocId();

    expect(first).not.toBe(second);
    expect(isValidCloudHouseholdId(first)).toBe(true);
    expect(isValidCloudHouseholdId(second)).toBe(true);
  });

  it('normalizes cloud household ids only when they are valid and non-reserved', () => {
    expect(normalizeCloudHouseholdDocId(' hh_partner ')).toBe('hh_partner');
    expect(normalizeCloudHouseholdDocId(LOCAL_HOUSEHOLD_ID)).toBeNull();
    expect(normalizeCloudHouseholdDocId(LEGACY_SHARED_HOUSEHOLD_DOC_ID)).toBeNull();
    expect(normalizeCloudHouseholdDocId('household_without_prefix')).toBeNull();
  });

  it('normalizes household and household-scoped entities to the active document id', () => {
    expect(
      normalizeHouseholdEntity(
        { id: 'legacy', name: 'Family Budget', created_by: 'usr_me' },
        'hh_active'
      )
    ).toMatchObject({ id: 'hh_active' });

    expect(
      normalizeHouseholdScopedEntity({ id: 'tx_1', household_id: 'legacy' }, 'hh_active')
    ).toMatchObject({ id: 'tx_1', household_id: 'hh_active' });
  });
});
