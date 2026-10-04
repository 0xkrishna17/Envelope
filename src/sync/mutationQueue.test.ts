import { describe, expect, it } from 'vitest';
import {
  createPendingMutation,
  enqueueMutations,
  enqueueUserHouseholdMutations,
  mutationQueueKey,
  mutationQueueKeyForUserHousehold,
  readMutationQueue,
  readUserHouseholdMutationQueue,
  summarizeMutationQueue,
} from './mutationQueue';

describe('mutationQueue', () => {
  it('persists and de-duplicates mutations by collection/entity/operation', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) || null,
      setItem: (key: string, value: string) => store.set(key, value),
    };

    const first = createPendingMutation({
      householdId: 'hh_test',
      collection: 'transactions',
      entityId: 'tx_1',
      operation: 'upsert',
      payload: { id: 'tx_1', amount: 100 },
      nowIso: '2026-09-01T00:00:00Z',
    });
    const replacement = createPendingMutation({
      householdId: 'hh_test',
      collection: 'transactions',
      entityId: 'tx_1',
      operation: 'upsert',
      payload: { id: 'tx_1', amount: 200 },
      nowIso: '2026-09-01T00:01:00Z',
    });

    enqueueMutations(storage, 'hh_test', [first]);
    const queue = enqueueMutations(storage, 'hh_test', [replacement]);

    expect(queue).toHaveLength(1);
    expect(queue[0].payload).toEqual({ id: 'tx_1', amount: 200 });
    expect(readMutationQueue(storage, 'hh_test')).toHaveLength(1);
    expect(store.has(mutationQueueKey('hh_test'))).toBe(true);
  });

  it('scopes authenticated queues by user and household', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) || null,
      setItem: (key: string, value: string) => store.set(key, value),
    };
    const mutation = createPendingMutation({
      householdId: 'hh_test',
      collection: 'transactions',
      entityId: 'tx_1',
      operation: 'upsert',
      payload: { id: 'tx_1', amount: 100 },
    });

    enqueueUserHouseholdMutations(storage, 'uid_a', 'hh_test', [mutation]);

    expect(readUserHouseholdMutationQueue(storage, 'uid_a', 'hh_test')).toHaveLength(1);
    expect(readUserHouseholdMutationQueue(storage, 'uid_b', 'hh_test')).toHaveLength(0);
    expect(readMutationQueue(storage, 'hh_test')).toHaveLength(0);
    expect(store.has(mutationQueueKeyForUserHousehold('uid_a', 'hh_test'))).toBe(true);
    expect(store.has(mutationQueueKey('hh_test'))).toBe(false);
  });

  it('summarizes pending and failed mutations', () => {
    const queue = [
      createPendingMutation({
        householdId: 'hh_test',
        collection: 'transactions',
        entityId: 'tx_1',
        operation: 'upsert',
        payload: {},
      }),
      {
        ...createPendingMutation({
          householdId: 'hh_test',
          collection: 'categories',
          entityId: 'cat_1',
          operation: 'upsert',
          payload: {},
        }),
        lastError: 'Failed',
      },
    ];

    expect(summarizeMutationQueue(queue)).toEqual({
      pendingCount: 2,
      failedCount: 1,
      lastError: 'Failed',
    });
  });
});
