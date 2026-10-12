import { LedgerState } from '../store/types';

export interface TrustedRootAccessMetadata {
  owner_uid?: string;
  owner_email?: string;
  allowed_emails?: string[];
  member_uids?: string[];
}

export function trustedRootAccessFromHousehold(household: TrustedRootAccessMetadata): TrustedRootAccessMetadata {
  return {
    owner_uid: household.owner_uid,
    owner_email: household.owner_email,
    allowed_emails: household.allowed_emails || [],
    member_uids: household.member_uids || [],
  };
}

export function mergeProjectedLedgerWithTrustedRootAccess(
  projected: LedgerState,
  trustedAccess: TrustedRootAccessMetadata | null
): LedgerState {
  if (!trustedAccess) return projected;

  return {
    ...projected,
    household: {
      ...projected.household,
      owner_uid: trustedAccess.owner_uid,
      owner_email: trustedAccess.owner_email,
      allowed_emails: trustedAccess.allowed_emails,
      member_uids: trustedAccess.member_uids,
    },
  };
}
