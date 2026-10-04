import { LedgerState } from '../store/types';
import { LOCAL_HOUSEHOLD_ID, normalizeHouseholdDocId } from './householdIdentity';

const CACHE_PREFIX = 'env_budget_cache_v4_';
const LOCAL_CACHE_KEY = `${CACHE_PREFIX}local`;

export interface LedgerCacheV4 {
  version: 4;
  scope: 'local' | 'cloud';
  uid?: string;
  householdId: string;
  cachedAt: string;
  ledger: Partial<LedgerState>;
}

function sanitizeCachePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function cacheKeyForLocalLedger(): string {
  return LOCAL_CACHE_KEY;
}

export function cacheKeyForUserHousehold(userUid: string, householdDocId: string): string {
  return `${CACHE_PREFIX}user_${sanitizeCachePart(userUid)}_household_${sanitizeCachePart(normalizeHouseholdDocId(householdDocId))}`;
}

export function cacheKeyForHousehold(householdDocId: string): string {
  return `${CACHE_PREFIX}${normalizeHouseholdDocId(householdDocId)}`;
}

function writeCache(storage: Pick<Storage, 'setItem'>, key: string, cache: LedgerCacheV4): void {
  storage.setItem(key, JSON.stringify(cache));
}

function readCache(storage: Pick<Storage, 'getItem'>, key: string): Partial<LedgerState> | null {
  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<LedgerCacheV4>;
    return parsed?.ledger || null;
  } catch {
    return null;
  }
}

export function persistLocalLedgerCache(
  storage: Pick<Storage, 'setItem'>,
  ledger: Partial<LedgerState>
): void {
  writeCache(storage, cacheKeyForLocalLedger(), {
    version: 4,
    scope: 'local',
    householdId: LOCAL_HOUSEHOLD_ID,
    cachedAt: new Date().toISOString(),
    ledger,
  });
}

export function readLocalLedgerCache(storage: Pick<Storage, 'getItem'>): Partial<LedgerState> | null {
  return readCache(storage, cacheKeyForLocalLedger());
}

export function persistUserHouseholdLedgerCache(
  storage: Pick<Storage, 'setItem'>,
  userUid: string,
  householdDocId: string,
  ledger: Partial<LedgerState>
): void {
  const householdId = normalizeHouseholdDocId(householdDocId);
  writeCache(storage, cacheKeyForUserHousehold(userUid, householdId), {
    version: 4,
    scope: 'cloud',
    uid: userUid,
    householdId,
    cachedAt: new Date().toISOString(),
    ledger,
  });
}

export function readUserHouseholdLedgerCache(
  storage: Pick<Storage, 'getItem'>,
  userUid: string,
  householdDocId: string
): Partial<LedgerState> | null {
  return readCache(storage, cacheKeyForUserHousehold(userUid, householdDocId));
}

export function persistLedgerCache(
  storage: Pick<Storage, 'setItem'>,
  householdDocId: string,
  ledger: Partial<LedgerState>
): void {
  writeCache(storage, cacheKeyForHousehold(householdDocId), {
    version: 4,
    scope: 'cloud',
    householdId: normalizeHouseholdDocId(householdDocId),
    cachedAt: new Date().toISOString(),
    ledger,
  });
}

export function readLedgerCache(
  storage: Pick<Storage, 'getItem'>,
  householdDocId: string
): Partial<LedgerState> | null {
  return readCache(storage, cacheKeyForHousehold(householdDocId));
}
