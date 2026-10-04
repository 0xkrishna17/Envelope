import { describe, expect, it } from 'vitest';
import { INITIAL_CATEGORIES, INITIAL_HOUSEHOLD, INITIAL_MEMBERS } from '../data/initialData';
import { LedgerState } from '../store/types';
import { mapLedgerActionToPendingMutations } from './mutationMapper';

const baseLedger: LedgerState = {
  household: INITIAL_HOUSEHOLD,
  members: INITIAL_MEMBERS,
  categories: INITIAL_CATEGORIES,
  salaryEvents: [],
  allocations: [],
  transactions: [
    {
      id: 'tx_1',
      household_id: 'hh_test',
      category_id: 'cat_groceries',
      amount: 10000,
      date: '2026-09-01',
      logged_by_user_id: 'usr_me',
      payment_method: 'cash',
      reconciliation_status: 'n/a',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
  ],
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
    created_at: '2026-09-01T00:00:00Z',
  },
  firstTimeIntroCompleted: false,
  householdId: 'hh_test',
  syncStatus: 'idle',
  lastCloudSync: null,
  permissionDenied: false,
  isRemoteSync: false,
  lastResetAt: null,
};

describe('mutationMapper', () => {
  it('maps transaction actions to transaction pending mutations', () => {
    const mutations = mapLedgerActionToPendingMutations(
      { type: 'ledger/addTransaction' },
      baseLedger
    );

    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({
      householdId: 'hh_test',
      collection: 'transactions',
      entityId: 'tx_1',
      operation: 'upsert',
    });
  });

  it('ignores non-sync actions', () => {
    expect(
      mapLedgerActionToPendingMutations({ type: 'ledger/setSyncStatus' }, baseLedger)
    ).toEqual([]);
  });
});
