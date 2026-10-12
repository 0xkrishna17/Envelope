import { describe, expect, it } from 'vitest';
import { INITIAL_HOUSEHOLD, INITIAL_MEMBERS, INITIAL_CATEGORIES } from '../data/initialData';
import { LedgerState } from '../store/types';
import { mergeProjectedLedgerWithTrustedRootAccess, trustedRootAccessFromHousehold } from './rootAccess';

function ledgerWithAccess(allowedEmails: string[], memberUids: string[]): LedgerState {
  return {
    household: {
      ...INITIAL_HOUSEHOLD,
      id: 'hh_cloud',
      owner_uid: 'owner_uid',
      owner_email: 'owner@example.com',
      allowed_emails: allowedEmails,
      member_uids: memberUids,
    },
    members: INITIAL_MEMBERS,
    categories: INITIAL_CATEGORIES,
    salaryEvents: [],
    allocations: [],
    transactions: [],
    reconciliations: [],
    reconciliationLines: [],
    envelopeTransfers: [],
    selectedMonth: '2026-10',
    activeMemberId: 'usr_me',
    pushSettings: {
      id: 'push_default',
      user_id: 'usr_me',
      reminder_time: '21:00',
      timezone: 'Asia/Kolkata',
      enabled: false,
      created_at: '2026-10-01T00:00:00.000Z',
    },
    firstTimeIntroCompleted: false,
    householdId: 'hh_cloud',
    syncStatus: 'idle',
    lastCloudSync: null,
    permissionDenied: false,
    isRemoteSync: false,
    lastResetAt: null,
  };
}

describe('trusted root access metadata', () => {
  it('preserves an accepted invited member when stale event projection omits them', () => {
    const projected = ledgerWithAccess(['owner@example.com'], ['owner_uid']);
    const trustedRoot = trustedRootAccessFromHousehold(
      ledgerWithAccess(['owner@example.com', 'invited@example.com'], ['owner_uid', 'invitee_uid']).household
    );

    const merged = mergeProjectedLedgerWithTrustedRootAccess(projected, trustedRoot);

    expect(merged.household.allowed_emails).toEqual(['owner@example.com', 'invited@example.com']);
    expect(merged.household.member_uids).toEqual(['owner_uid', 'invitee_uid']);
  });

  it('does not resurrect a revoked member from stale event projection', () => {
    const projected = ledgerWithAccess(['owner@example.com', 'revoked@example.com'], ['owner_uid', 'revoked_uid']);
    const trustedRoot = trustedRootAccessFromHousehold(
      ledgerWithAccess(['owner@example.com'], ['owner_uid']).household
    );

    const merged = mergeProjectedLedgerWithTrustedRootAccess(projected, trustedRoot);

    expect(merged.household.allowed_emails).toEqual(['owner@example.com']);
    expect(merged.household.member_uids).toEqual(['owner_uid']);
  });

  it('leaves projected ledger unchanged when no trusted root ACL has been loaded', () => {
    const projected = ledgerWithAccess(['owner@example.com'], ['owner_uid']);

    expect(mergeProjectedLedgerWithTrustedRootAccess(projected, null)).toBe(projected);
  });
});
