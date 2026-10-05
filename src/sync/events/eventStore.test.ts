import { describe, expect, it } from 'vitest';
import { createCategoryFundsAddedEvent, createTransactionAddedEvent } from './commands';
import { createLocalStorageEventStore, eventLogKey } from './eventStore';
import { EventScope } from './types';

function createMemoryStorage(): Pick<Storage, 'getItem' | 'setItem'> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) || null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const localScope: EventScope = { kind: 'local' };
const cloudScope: EventScope = { kind: 'cloud', userUid: 'uid_1', householdId: 'hh_cloud' };

describe('eventStore', () => {
  it('appends events durably and de-duplicates by id', () => {
    const storage = createMemoryStorage();
    storage.setItem('env_budget_event_device_id_v1', 'device_a');
    const store = createLocalStorageEventStore(storage);
    const event = createTransactionAddedEvent(
      {
        storage,
        scope: localScope,
        householdId: 'local',
        actorUid: null,
        actorMemberId: 'usr_me',
        baseRemoteRevision: null,
        nowIso: '2026-09-10T00:00:00Z',
      },
      {
        categoryId: 'cat_groceries',
        amount: 10000,
        paymentMethod: 'cash',
        date: '2026-09-10',
        transactionId: 'tx_1',
      }
    );

    store.appendEvents(localScope, [event]);
    store.appendEvents(localScope, [event]);

    expect(store.readEvents(localScope)).toHaveLength(1);
    expect(store.readEvents(localScope)[0].id).toBe('evt_device_a_000000000001');
    expect(storage.data.has(eventLogKey(localScope))).toBe(true);
  });

  it('keeps local and cloud scopes isolated', () => {
    const storage = createMemoryStorage();
    storage.setItem('env_budget_event_device_id_v1', 'device_a');
    const store = createLocalStorageEventStore(storage);
    const localEvent = createTransactionAddedEvent(
      {
        storage,
        scope: localScope,
        householdId: 'local',
        actorUid: null,
        actorMemberId: 'usr_me',
        baseRemoteRevision: null,
        nowIso: '2026-09-10T00:00:00Z',
      },
      {
        categoryId: 'cat_groceries',
        amount: 10000,
        paymentMethod: 'cash',
        date: '2026-09-10',
        transactionId: 'tx_local',
      }
    );
    const cloudEvent = createCategoryFundsAddedEvent(
      {
        storage,
        scope: cloudScope,
        householdId: 'hh_cloud',
        actorUid: 'uid_1',
        actorMemberId: 'usr_me',
        baseRemoteRevision: 4,
        nowIso: '2026-09-11T00:00:00Z',
      },
      {
        categoryId: 'cat_groceries',
        amount: 50000,
        allocationId: 'alloc_cloud',
      }
    );

    store.appendEvents(localScope, [localEvent]);
    store.appendEvents(cloudScope, [cloudEvent]);

    expect(store.readEvents(localScope).map(event => event.householdId)).toEqual(['local']);
    expect(store.readEvents(cloudScope).map(event => event.householdId)).toEqual(['hh_cloud']);
    expect(eventLogKey(localScope)).not.toBe(eventLogKey(cloudScope));
  });

  it('marks acknowledged events without changing event payloads', () => {
    const storage = createMemoryStorage();
    storage.setItem('env_budget_event_device_id_v1', 'device_a');
    const store = createLocalStorageEventStore(storage);
    const event = createTransactionAddedEvent(
      {
        storage,
        scope: localScope,
        householdId: 'local',
        actorUid: null,
        actorMemberId: 'usr_me',
        baseRemoteRevision: null,
        nowIso: '2026-09-10T00:00:00Z',
      },
      {
        categoryId: 'cat_groceries',
        amount: 10000,
        paymentMethod: 'cash',
        date: '2026-09-10',
        transactionId: 'tx_1',
      }
    );

    store.appendEvents(localScope, [event]);
    const acked = store.markAcked(localScope, [event.id], '2026-09-10T00:01:00Z');

    expect(acked[0].syncState).toBe('acked');
    expect(acked[0].event).toEqual(event);
    expect(store.readEvents(localScope)).toEqual([event]);
  });

  it('stores and recovers sync metadata per scope', () => {
    const storage = createMemoryStorage();
    const store = createLocalStorageEventStore(storage);

    store.writeMetadata(cloudScope, {
      householdId: 'hh_cloud',
      lastPulledRemoteRevision: 12,
      lastAckedLocalSequenceByDevice: { device_a: 3 },
    });

    expect(store.readMetadata(cloudScope)).toEqual({
      householdId: 'hh_cloud',
      lastPulledRemoteRevision: 12,
      lastAckedLocalSequenceByDevice: { device_a: 3 },
    });
    expect(store.readMetadata(localScope)).toEqual({
      householdId: 'local',
      lastPulledRemoteRevision: 0,
      lastAckedLocalSequenceByDevice: {},
    });
  });
});
