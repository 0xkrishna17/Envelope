import { describe, expect, it } from 'vitest';
import { INITIAL_CATEGORIES, INITIAL_HOUSEHOLD, INITIAL_MEMBERS } from '../../data/initialData';
import { Allocation, Transaction } from '../../types';
import {
  createAllocationTransferToggledEvent,
  createAllAllocationsMarkedTransferredEvent,
  createCategoryFundsDeletedEvent,
  createLedgerResetToZeroEvent,
  createSalaryReceivedEvent,
  createTransactionDeletedEvent,
  createTransactionUpdateEvents,
} from './commands';
import { EventScope } from './types';

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

const scope: EventScope = { kind: 'local' };

function context(storage: Storage) {
  return {
    storage,
    scope,
    householdId: 'local',
    actorUid: null,
    actorMemberId: 'usr_me',
    baseRemoteRevision: null,
    nowIso: '2026-09-15T10:00:00.000Z',
  };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx_1',
    household_id: 'local',
    category_id: 'cat_groceries',
    amount: 10000,
    date: '2026-09-15',
    logged_by_user_id: 'usr_me',
    payment_method: 'cash',
    reconciliation_status: 'n/a',
    created_at: '2026-09-15T09:00:00.000Z',
    updated_at: '2026-09-15T09:00:00.000Z',
    ...overrides,
  };
}

function allocation(overrides: Partial<Allocation> = {}): Allocation {
  return {
    id: 'alloc_1',
    salary_event_id: 'sal_1',
    category_id: 'cat_groceries',
    planned_amount: 40000,
    transferred: false,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('event command builders', () => {
  it('creates append-only correction events for transaction amount edits', () => {
    const events = createTransactionUpdateEvents(context(createMemoryStorage()), {
      existing: transaction(),
      categoryId: 'cat_groceries',
      amount: 12500,
      paymentMethod: 'cash',
      note: 'updated note',
      date: '2026-09-15',
      generatedSuffix: 'fixed',
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('transaction.correction_logged');
    expect(events[0].payload.transaction).toMatchObject({
      id: 'tx_adj_fixed',
      amount: 2500,
      ledger_entry_type: 'adjustment',
      related_transaction_id: 'tx_1',
    });
  });

  it('creates reversal and replacement events when a transaction moves financial buckets', () => {
    const events = createTransactionUpdateEvents(context(createMemoryStorage()), {
      existing: transaction(),
      categoryId: 'cat_transport',
      amount: 12500,
      paymentMethod: 'credit_card',
      note: 'moved',
      date: '2026-09-16',
      generatedSuffix: 'fixed',
    });

    expect(events.map(event => event.payload.transaction.id)).toEqual(['tx_rev_fixed', 'tx_repl_fixed']);
    expect(events.map(event => event.payload.transaction.amount)).toEqual([-10000, 12500]);
    expect(events[1].payload.transaction.reconciliation_status).toBe('pending');
  });

  it('creates a delete reversal event linked to the original transaction', () => {
    const event = createTransactionDeletedEvent(context(createMemoryStorage()), transaction(), 'deleted');

    expect(event?.type).toBe('transaction.correction_logged');
    expect(event?.payload.transaction).toMatchObject({
      id: 'tx_del_deleted',
      amount: -10000,
      ledger_entry_type: 'reversal',
      related_transaction_id: 'tx_1',
    });
  });

  it('creates salary and residual unallocated allocation events', () => {
    const event = createSalaryReceivedEvent(context(createMemoryStorage()), {
      salaryEventId: 'sal_1',
      salaryAmount: 100000,
      date: '2026-09-01',
      earnerUserId: 'usr_me',
      allocations: [{ categoryId: 'cat_groceries', amount: 40000 }],
      unallocatedCategoryId: 'cat_unallocated',
    });

    expect(event.type).toBe('salary.received');
    expect(event.payload.salaryEvent.amount).toBe(100000);
    expect(event.payload.allocations.map(item => [item.category_id, item.planned_amount])).toEqual([
      ['cat_groceries', 40000],
      ['cat_unallocated', 60000],
    ]);
  });

  it('creates allocation transfer toggle and mark-all events', () => {
    const storage = createMemoryStorage();
    const toggleEvent = createAllocationTransferToggledEvent(context(storage), allocation());
    const markAllEvent = createAllAllocationsMarkedTransferredEvent(context(storage), [
      allocation({ id: 'alloc_1' }),
      allocation({ id: 'alloc_2', transferred: true }),
    ]);

    expect(toggleEvent.payload.allocation.transferred).toBe(true);
    expect(toggleEvent.payload.allocation.transferred_at).toBe('2026-09-15T10:00:00.000Z');
    expect(markAllEvent?.payload.allocations).toHaveLength(1);
    expect(markAllEvent?.payload.allocations[0].id).toBe('alloc_1');
  });

  it('creates direct category funds reversal events', () => {
    const event = createCategoryFundsDeletedEvent(context(createMemoryStorage()), allocation({ transferred: true }), 'alloc_rev_1');

    expect(event?.type).toBe('category_funds.added');
    expect(event?.payload.allocation).toMatchObject({
      id: 'alloc_rev_1',
      planned_amount: -40000,
      source: 'Reversal',
    });
  });

  it('creates reset boundary events that keep configuration but clear ledger arrays in projection', () => {
    const event = createLedgerResetToZeroEvent(
      context(createMemoryStorage()),
      {
        household: INITIAL_HOUSEHOLD,
        members: INITIAL_MEMBERS,
        categories: INITIAL_CATEGORIES,
        salaryEvents: [],
        allocations: [allocation()],
        transactions: [transaction()],
        reconciliations: [],
        reconciliationLines: [],
        envelopeTransfers: [],
        selectedMonth: '2026-09',
        activeMemberId: 'usr_me',
        pushSettings: {
          id: 'push_1',
          user_id: 'usr_me',
          reminder_time: '21:00',
          timezone: 'Asia/Kolkata',
          enabled: false,
          created_at: '2026-09-01T00:00:00.000Z',
        },
        firstTimeIntroCompleted: false,
        householdId: 'local',
        syncStatus: 'idle',
        lastCloudSync: null,
        permissionDenied: false,
        isRemoteSync: false,
        lastResetAt: null,
      },
      '2026-09-20T00:00:00.000Z',
      'New Name'
    );

    expect(event.type).toBe('ledger.reset_to_zero');
    expect(event.payload.firstTimeIntroCompleted).toBe(true);
    expect(event.payload.members.some(member => member.name === 'New Name')).toBe(true);
  });
});
