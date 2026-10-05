import { describe, expect, it } from 'vitest';
import { INITIAL_CATEGORIES, INITIAL_HOUSEHOLD, INITIAL_MEMBERS } from '../../data/initialData';
import { LedgerState } from '../../store/types';
import { createTransactionAddedEvent } from './commands';
import { appendEventAndProject, hasStoredEvents } from './runtime';
import { EventScope, ProjectionSeed } from './types';

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
    household: INITIAL_HOUSEHOLD,
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
    householdId: 'local',
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

describe('event runtime', () => {
  it('projects appended local events from the canonical event log', () => {
    const storage = createMemoryStorage();
    storage.setItem('env_budget_event_device_id_v1', 'device_a');
    const scope: EventScope = { kind: 'local' };
    const ledger = createLedger();
    expect(hasStoredEvents({ storage, scope })).toBe(false);
    const event = createTransactionAddedEvent(
      {
        storage,
        scope,
        householdId: 'local',
        actorUid: null,
        actorMemberId: 'usr_me',
        baseRemoteRevision: null,
        nowIso: '2026-09-10T00:00:00Z',
      },
      {
        transactionId: 'tx_1',
        categoryId: 'cat_groceries',
        amount: 10000,
        paymentMethod: 'cash',
        date: '2026-09-10',
      }
    );

    const projected = appendEventAndProject({
      storage,
      scope,
      seed: seedFromLedger(ledger),
      event,
    });

    expect(projected.transactions).toHaveLength(1);
    expect(projected.transactions[0].id).toBe('tx_1');
    expect(hasStoredEvents({ storage, scope })).toBe(true);

    const nextEvent = createTransactionAddedEvent(
      {
        storage,
        scope,
        householdId: 'local',
        actorUid: null,
        actorMemberId: 'usr_me',
        baseRemoteRevision: null,
        nowIso: '2026-09-11T00:00:00Z',
      },
      {
        transactionId: 'tx_2',
        categoryId: 'cat_groceries',
        amount: 20000,
        paymentMethod: 'cash',
        date: '2026-09-11',
      }
    );

    const projectedAgain = appendEventAndProject({
      storage,
      scope,
      seed: seedFromLedger(projected),
      event: nextEvent,
    });

    expect(projectedAgain.transactions.map(tx => tx.id)).toEqual(['tx_1', 'tx_2']);
  });
});
