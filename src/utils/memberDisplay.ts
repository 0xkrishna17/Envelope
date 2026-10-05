import { Membership } from '../types';

export const FALLBACK_MEMBER_NAME = 'Household Member';
export const FALLBACK_MEMBER_INITIAL = 'H';

type MemberDisplayInput = Pick<Partial<Membership>, 'name'> | null | undefined;

export function getMemberDisplayName(member: MemberDisplayInput): string {
  const name = member?.name?.trim();
  return name || FALLBACK_MEMBER_NAME;
}

export function getMemberInitial(member: MemberDisplayInput): string {
  return getMemberDisplayName(member).charAt(0).toUpperCase() || FALLBACK_MEMBER_INITIAL;
}
