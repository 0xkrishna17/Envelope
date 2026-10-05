import { describe, expect, it } from 'vitest';
import {
  createHouseholdInvitationDocument,
  householdInvitationDocId,
  normalizeInvitationEmail,
  shouldDetachPreviousSharedHousehold,
  validateInvitationEmail,
} from './householdInvitations';

describe('householdInvitations helpers', () => {
  it('normalizes invitee emails for request lookup', () => {
    expect(normalizeInvitationEmail(' Partner@Example.COM ')).toBe('partner@example.com');
  });

  it('validates Google-account-style email inputs before writing requests', () => {
    expect(validateInvitationEmail('partner@example.com')).toBe('partner@example.com');
    expect(validateInvitationEmail('not-an-email')).toBeNull();
    expect(validateInvitationEmail('')).toBeNull();
  });

  it('uses an internal deterministic invitation document id without exposing it in URLs', () => {
    expect(householdInvitationDocId('hh_household', ' Partner@Example.COM ')).toBe('hh_household__partner@example.com');
  });

  it('preserves inviter email casing for Firestore rule comparison while normalizing invitee email', () => {
    const createdAt = { seconds: 1 };
    const updatedAt = { seconds: 2 };

    expect(createHouseholdInvitationDocument({
      householdId: 'hh_household',
      householdName: 'Family Budget',
      inviterUid: 'owner-uid',
      inviterEmail: ' Owner.Account@Example.COM ',
      inviteeEmail: ' Partner@Example.COM ',
      nowIso: '2026-10-05T10:00:00.000Z',
      createdAt,
      updatedAt,
    })).toEqual({
      household_id: 'hh_household',
      household_name: 'Family Budget',
      inviter_uid: 'owner-uid',
      inviter_email: 'Owner.Account@Example.COM',
      invitee_email: 'partner@example.com',
      status: 'pending',
      created_at: '2026-10-05T10:00:00.000Z',
      updated_at: '2026-10-05T10:00:00.000Z',
      createdAt,
      updatedAt,
    });
  });

  it('detaches only a different existing shared household when accepting a new one', () => {
    expect(shouldDetachPreviousSharedHousehold({
      acceptedHouseholdId: 'hh_newshared',
      previousSharedHouseholdId: 'hh_oldshared',
      privateLedgerId: 'hh_private',
    })).toBe(true);
    expect(shouldDetachPreviousSharedHousehold({
      acceptedHouseholdId: 'hh_newshared',
      previousSharedHouseholdId: null,
      privateLedgerId: 'hh_private',
    })).toBe(false);
    expect(shouldDetachPreviousSharedHousehold({
      acceptedHouseholdId: 'hh_newshared',
      previousSharedHouseholdId: 'hh_newshared',
      privateLedgerId: 'hh_private',
    })).toBe(false);
    expect(shouldDetachPreviousSharedHousehold({
      acceptedHouseholdId: 'hh_newshared',
      previousSharedHouseholdId: 'hh_private',
      privateLedgerId: 'hh_private',
    })).toBe(false);
  });
});
