export const LOCAL_HOUSEHOLD_ID = 'local';
export const LEGACY_SHARED_HOUSEHOLD_DOC_ID = 'hh_family_ledger_main';
export const DEFAULT_HOUSEHOLD_DOC_ID = LOCAL_HOUSEHOLD_ID;

const CLOUD_HOUSEHOLD_PREFIX = 'hh_';

export function normalizeLocalHouseholdId(value: string | null | undefined): string {
  const clean = value?.trim();
  return clean || LOCAL_HOUSEHOLD_ID;
}

export function normalizeHouseholdDocId(value: string | null | undefined): string {
  return normalizeLocalHouseholdId(value);
}

export function normalizeCloudHouseholdDocId(value: string | null | undefined): string | null {
  const clean = value?.trim();
  return clean && isValidCloudHouseholdId(clean) ? clean : null;
}

export function createCloudHouseholdDocId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${CLOUD_HOUSEHOLD_PREFIX}${crypto.randomUUID()}`;
  }

  return `${CLOUD_HOUSEHOLD_PREFIX}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function isLocalHouseholdId(value: string | null | undefined): boolean {
  return normalizeLocalHouseholdId(value) === LOCAL_HOUSEHOLD_ID;
}

export function isReservedCloudHouseholdId(value: string | null | undefined): boolean {
  const clean = value?.trim();
  return !clean || clean === LOCAL_HOUSEHOLD_ID || clean === LEGACY_SHARED_HOUSEHOLD_DOC_ID;
}

export function isValidCloudHouseholdId(value: string | null | undefined): boolean {
  const clean = value?.trim();
  return Boolean(clean && clean.startsWith(CLOUD_HOUSEHOLD_PREFIX) && !isReservedCloudHouseholdId(clean));
}

export function normalizeHouseholdEntity<T extends { id: string; created_by: string }>(
  household: T,
  activeHouseholdDocId: string
): T {
  return {
    ...household,
    id: normalizeLocalHouseholdId(activeHouseholdDocId),
  };
}

export function normalizeHouseholdScopedEntity<T extends { household_id: string }>(
  entity: T,
  activeHouseholdDocId: string
): T {
  return {
    ...entity,
    household_id: normalizeLocalHouseholdId(activeHouseholdDocId),
  };
}
