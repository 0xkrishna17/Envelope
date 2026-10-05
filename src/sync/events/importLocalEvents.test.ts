import { describe, expect, it } from 'vitest';
import { createLocalStorageEventStore } from './eventStore';
import { importLocalEventsToCloudScope } from './importLocalEvents';
import { EventScope, LedgerEvent } from './types';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => Array.from(values.keys())[index] ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

const localScope: EventScope = { kind: 'local' };
const cloudScope: Extract<EventScope, { kind: 'cloud' }> = {
  kind: 'cloud',
  userUid: 'uid_1',
  householdId: 'hh_cloud',
};

function localTransactionEvent(): LedgerEvent {
  return {
    id: 'evt_device_000000000001',
    householdId: 'local',
    actorUid: null,
    actorMemberId: 'usr_me',
    type: 'transaction.added',
    payload: {
      transaction: {
        id: 'tx_1',
        household_id: 'local',
        category_id: 'cat_groceries',
        amount: 10000,
        date: '2026-10-05',
        logged_by_user_id: 'usr_me',
        payment_method: 'cash',
        reconciliation_status: 'n/a',
        created_at: '2026-10-05T00:00:00.000Z',
        updated_at: '2026-10-05T00:00:00.000Z',
      },
    },
    occurredAt: '2026-10-05T00:00:00.000Z',
    schemaVersion: 1,
    deviceId: 'device',
    sequence: 1,
    baseRemoteRevision: null,
  };
}

describe('importLocalEventsToCloudScope', () => {
  it('copies local events into the cloud scope with cloud household metadata', () => {
    const storage = createMemoryStorage();
    const store = createLocalStorageEventStore(storage);
    store.appendEvents(localScope, [localTransactionEvent()], 'pending');

    const imported = importLocalEventsToCloudScope({
      storage,
      localScope,
      cloudScope,
      actorName: 'Priya',
      actorEmail: 'priya@example.com',
    });
    const cloudEvents = store.readEvents(cloudScope);

    expect(imported).toHaveLength(1);
    expect(cloudEvents).toHaveLength(1);
    expect(cloudEvents[0]).toMatchObject({
      id: 'evt_device_000000000001',
      householdId: 'hh_cloud',
      actorUid: 'uid_1',
      type: 'transaction.added',
    });
    const importedTransactionEvent = cloudEvents
      .filter((event): event is Extract<LedgerEvent, { type: 'transaction.added' }> => event.type === 'transaction.added')[0];
    expect(importedTransactionEvent?.payload.transaction.household_id).toBe('hh_cloud');
    expect(importedTransactionEvent?.payload.transaction.logged_by_user_id).toBe('uid_1');
  });

  it('normalizes local salary earner identity to the signed-in Google user', () => {
    const storage = createMemoryStorage();
    const store = createLocalStorageEventStore(storage);
    store.appendEvents(localScope, [{
      id: 'evt_device_000000000002',
      householdId: 'local',
      actorUid: null,
      actorMemberId: 'usr_me',
      type: 'salary.received',
      payload: {
        salaryEvent: {
          id: 'sal_1',
          household_id: 'local',
          earner_user_id: 'usr_me',
          amount: 100000,
          date: '2026-10-01',
          created_at: '2026-10-01T00:00:00.000Z',
        },
        allocations: [],
      },
      occurredAt: '2026-10-01T00:00:00.000Z',
      schemaVersion: 1,
      deviceId: 'device',
      sequence: 2,
      baseRemoteRevision: null,
    }], 'pending');

    importLocalEventsToCloudScope({ storage, localScope, cloudScope, actorName: 'Priya' });

    const importedSalaryEvent = store
      .readEvents(cloudScope)
      .filter((event): event is Extract<LedgerEvent, { type: 'salary.received' }> => event.type === 'salary.received')[0];
    expect(importedSalaryEvent?.actorMemberId).toBe('uid_1');
    expect(importedSalaryEvent?.payload.salaryEvent.earner_user_id).toBe('uid_1');
  });

  it('does nothing when no local events exist', () => {
    const storage = createMemoryStorage();

    expect(importLocalEventsToCloudScope({ storage, localScope, cloudScope, actorName: 'Priya' })).toEqual([]);
  });
});
