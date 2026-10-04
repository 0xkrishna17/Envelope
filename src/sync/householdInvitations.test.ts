import { describe, expect, it } from 'vitest';
import {
  householdInvitationDocId,
  normalizeInvitationEmail,
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
});
