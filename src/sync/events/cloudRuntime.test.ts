import { describe, expect, it } from 'vitest';
import { INITIAL_CATEGORIES, INITIAL_HOUSEHOLD, INITIAL_MEMBERS } from '../../data/initialData';
import { LedgerState } from '../../store/types';
import { createTransactionAddedEvent } from './commands';
import { createLocalStorageEventStore } from './eventStore';
import { syncCloudEventRuntime } from './cloudRuntime';
import { EventScope, LedgerEvent, ProjectionSeed } from './types';

function createMemoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) || null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function createLedger(): LedgerState {
  return {
    household: { ...INITIAL_HOUSEHOLD, id: 'hh_cloud' },
    members: INITIAL_MEMBERS,
    categories: INITIAL_CATEGORIES,
    salaryEvents: [],
    allocations: [],
    transactions: [],
    reconciliations: [],
    reconciliationLines: [],
    envelopeTransfers: [],
    selectedMonth: '2026-09',
    activeMemberId: 'usr_me',
    pushSettings: {
      id: 'push_default',
      user_id: 'usr_me',
      reminder_time: '21:00',
      timezone: 'Asia/Kolkata',
      enabled: false,
      created_at: '2026-09-01T00:00:00Z',
    },
    firstTimeIntroCompleted: false,
    householdId: 'hh_cloud',
    syncStatus: 'idle',
    lastCloudSync: null,
    permissionDenied: false,
    isRemoteSync: false,
    lastResetAt: null,
  };
}

function seedFromLedger(ledger: LedgerState): ProjectionSeed {
  return {
    household: ledger.household,
    members: ledger.members,
    categories: ledger.categories,
    pushSettings: ledger.pushSettings,
    selectedMonth: ledger.selectedMonth,
    activeMemberId: ledger.activeMemberId,
    firstTimeIntroCompleted: ledger.firstTimeIntroCompleted,
    householdId: ledger.householdId,
  };
}

function remoteTransactionEvent(): Extract<LedgerEvent, { type: 'transaction.added' }> {
  return {
    id: 'evt_remote_000000000009',
    householdId: 'hh_cloud',
    actorUid: 'uid_other',
    actorMemberId: 'usr_other',
    type: 'transaction.added',
    payload: {
      transaction: {
        id: 'tx_remote',
        household_id: 'hh_cloud',
        category_id: 'cat_groceries',
        amount: 35000,
        date: '2026-09-12',
        logged_by_user_id: 'usr_other',
        payment_method: 'cash',
        reconciliation_status: 'n/a',
        created_at: '2026-09-12T00:00:00Z',
        updated_at: '2026-09-12T00:00:00Z',
      },
    },
    occurredAt: '2026-09-12T00:00:00Z',
    schemaVersion: 1,
    deviceId: 'remote_device',
    sequence: 9,
    baseRemoteRevision: 4,
    serverRevision: 5,
  };
}

describe('cloud event runtime', () => {
  const scope: Extract<EventScope, { kind: 'cloud' }> = {
    kind: 'cloud',
    userUid: 'uid_1',
    householdId: 'hh_cloud',
  };

  it('pulls remote events into an empty event store without fabricating extra events', async () => {
    const storage = createMemoryStorage();
    const ledger = createLedger();
    const pulled = [remoteTransactionEvent()];
    const pushedEvents: LedgerEvent[][] = [];
    const pulledAfterRevisions: number[] = [];
    const remote = {
      pullEvents: async (afterRevision: number) => {
        pulledAfterRevisions.push(afterRevision);
        return pulled;
      },
      pushEvents: async (events: LedgerEvent[]) => {
        pushedEvents.push(events);
      },
    };

    const result = await syncCloudEventRuntime({
      storage,
      scope,
      seed: seedFromLedger(ledger),
      nowIso: '2026-09-13T00:00:00Z',
      remote,
    });

    expect(pulledAfterRevisions).toEqual([0]);
    expect(result.pulledCount).toBe(1);
    expect(result.pushedCount).toBe(0);
    expect(pushedEvents).toEqual([]);
    expect(result.projected.transactions.map(tx => tx.id)).toEqual(['tx_remote']);

    const envelopes = createLocalStorageEventStore(storage).readEnvelopes(scope);
    expect(envelopes).toHaveLength(1);
    expect(envelopes.every(envelope => envelope.syncState === 'acked')).toBe(true);
  });

  it('pulls before pushing existing pending local events', async () => {
    const storage = createMemoryStorage();
    storage.setItem('env_budget_event_device_id_v1', 'device_a');
    const store = createLocalStorageEventStore(storage);
    const ledger = createLedger();
    const localEvent = createTransactionAddedEvent(
      {
        storage,
        scope,
        householdId: 'hh_cloud',
        actorUid: 'uid_1',
        actorMemberId: 'usr_me',
        baseRemoteRevision: 4,
        nowIso: '2026-09-11T00:00:00Z',
      },
      {
        transactionId: 'tx_local',
        categoryId: 'cat_groceries',
        amount: 12000,
        paymentMethod: 'cash',
        date: '2026-09-11',
      }
    );
    store.appendEvents(scope, [localEvent]);
    store.writeMetadata(scope, {
      householdId: 'hh_cloud',
      lastPulledRemoteRevision: 4,
      lastAckedLocalSequenceByDevice: {},
    });

    const order: string[] = [];
    const remote = {
      pullEvents: async () => {
        order.push('pull');
        return [remoteTransactionEvent()];
      },
      pushEvents: async () => {
        order.push('push');
      },
    };

    const result = await syncCloudEventRuntime({
      storage,
      scope,
      seed: seedFromLedger(ledger),
      nowIso: '2026-09-13T00:00:00Z',
      remote,
    });

    expect(order).toEqual(['pull', 'push']);
    expect(result.pushedCount).toBe(1);
    expect(result.projected.transactions.map(tx => tx.id).sort()).toEqual(['tx_local', 'tx_remote']);
    expect(createLocalStorageEventStore(storage).readMetadata(scope).lastPulledRemoteRevision).toBe(5);
  });
});
