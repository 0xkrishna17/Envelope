import { describe, expect, it } from 'vitest';
import { INITIAL_HOUSEHOLD, INITIAL_MEMBERS } from './initialData';
import { LOCAL_HOUSEHOLD_ID } from '../sync/householdIdentity';

describe('initial data', () => {
  it('keeps the default household explicitly local-only', () => {
    expect(INITIAL_HOUSEHOLD).toMatchObject({
      id: LOCAL_HOUSEHOLD_ID,
      created_by: 'usr_me',
      allowed_emails: [],
      member_uids: [],
    });
    expect(INITIAL_HOUSEHOLD.owner_uid).toBeUndefined();
    expect(INITIAL_HOUSEHOLD.owner_email).toBeUndefined();
  });

  it('keeps the default local member aligned with the local household seed', () => {
    expect(INITIAL_MEMBERS).toHaveLength(1);
    expect(INITIAL_MEMBERS[0]).toMatchObject({
      household_id: LOCAL_HOUSEHOLD_ID,
      user_id: INITIAL_HOUSEHOLD.created_by,
      role: 'owner',
    });
  });
});
