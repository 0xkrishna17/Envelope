import { describe, expect, it } from 'vitest';
import {
  cacheKeyForLocalLedger,
  cacheKeyForUserHousehold,
  persistLocalLedgerCache,
  persistUserHouseholdLedgerCache,
  readLocalLedgerCache,
  readUserHouseholdLedgerCache,
} from './localCache';

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, value),
  };
}

describe('localCache', () => {
  it('uses a dedicated anonymous local cache key', () => {
    expect(cacheKeyForLocalLedger()).toBe('env_budget_cache_v4_local');
  });

  it('scopes cloud cache by user and household', () => {
    expect(cacheKeyForUserHousehold('uid 1', 'hh_demo')).toBe('env_budget_cache_v4_user_uid_1_household_hh_demo');
    expect(cacheKeyForUserHousehold('uid_2', 'hh_demo')).not.toBe(cacheKeyForUserHousehold('uid_1', 'hh_demo'));
  });

  it('does not leak local cache into user household cache', () => {
    const storage = createStorage();

    persistLocalLedgerCache(storage, {
      householdId: 'local',
      selectedMonth: '2026-09',
    });
    persistUserHouseholdLedgerCache(storage, 'uid_1', 'hh_demo', {
      householdId: 'hh_demo',
      selectedMonth: '2026-10',
    });

    expect(readLocalLedgerCache(storage)?.selectedMonth).toBe('2026-09');
    expect(readUserHouseholdLedgerCache(storage, 'uid_1', 'hh_demo')?.selectedMonth).toBe('2026-10');
    expect(readUserHouseholdLedgerCache(storage, 'uid_2', 'hh_demo')).toBeNull();
  });
});
