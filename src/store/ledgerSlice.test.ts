import { describe, it, expect } from 'vitest';
import { ledgerReducer, ledgerActions } from './ledgerSlice';
import { LedgerState } from './types';
import { INITIAL_HOUSEHOLD, INITIAL_MEMBERS, INITIAL_CATEGORIES } from '../data/initialData';

describe('Redux Ledger Slice Unit Tests', () => {
  const getInitialState = (): LedgerState => ({
    household: INITIAL_HOUSEHOLD,
    members: INITIAL_MEMBERS,
    categories: INITIAL_CATEGORIES,
    salaryEvents: [],
    allocations: [],
    transactions: [],
    reconciliations: [],
    reconciliationLines: [],
    envelopeTransfers: [],
    invites: [],
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
    householdId: 'hh_main',
    syncStatus: 'idle',
    lastCloudSync: null,
    permissionDenied: false,
    isRemoteSync: false,
    lastResetAt: null,
  });

  describe('Transactions Reducer', () => {
    it('adds a transaction with correct reconciliation status based on payment method', () => {
      const state = getInitialState();

      // Credit card spend -> pending status
      const state1 = ledgerReducer(
        state,
        ledgerActions.addTransaction({
          categoryId: 'cat_groceries',
          amount: 150000,
          paymentMethod: 'credit_card',
          note: 'Supermarket',
          date: '2026-09-10',
        })
      );

      expect(state1.transactions.length).toBe(1);
      expect(state1.transactions[0].amount).toBe(150000);
      expect(state1.transactions[0].payment_method).toBe('credit_card');
      expect(state1.transactions[0].reconciliation_status).toBe('pending');

      // Cash spend -> n/a status
      const state2 = ledgerReducer(
        state1,
        ledgerActions.addTransaction({
          categoryId: 'cat_dining',
          amount: 50000,
          paymentMethod: 'cash',
          note: 'Street snacks',
          date: '2026-09-11',
        })
      );

      expect(state2.transactions.length).toBe(2);
      expect(state2.transactions[0].reconciliation_status).toBe('n/a');
    });

    it('updates an existing transaction and adjusts reconciliation status if payment method changes', () => {
      const state = getInitialState();
      const state1 = ledgerReducer(
        state,
        ledgerActions.addTransaction({
          id: 'tx_test_1',
          categoryId: 'cat_groceries',
          amount: 100000,
          paymentMethod: 'secondary_account_debit',
          date: '2026-09-10',
        })
      );

      expect(state1.transactions[0].reconciliation_status).toBe('n/a');

      // Update to credit card
      const state2 = ledgerReducer(
        state1,
        ledgerActions.updateTransaction({
          id: 'tx_test_1',
          categoryId: 'cat_groceries',
          amount: 120000,
          paymentMethod: 'credit_card',
          note: 'Changed to CC',
          date: '2026-09-10',
        })
      );

      expect(state2.transactions[0].amount).toBe(120000);
      expect(state2.transactions[0].payment_method).toBe('credit_card');
      expect(state2.transactions[0].reconciliation_status).toBe('pending');
    });

    it('soft-deletes a transaction by setting deleted_at timestamp', () => {
      const state = getInitialState();
      const state1 = ledgerReducer(
        state,
        ledgerActions.addTransaction({
          id: 'tx_del',
          categoryId: 'cat_groceries',
          amount: 50000,
          paymentMethod: 'cash',
          date: '2026-09-12',
        })
      );

      const state2 = ledgerReducer(state1, ledgerActions.deleteTransaction('tx_del'));
      expect(state2.transactions[0].deleted_at).toBeDefined();
      expect(typeof state2.transactions[0].deleted_at).toBe('string');
    });
  });

  describe('Salary and Allocations', () => {
    it('adds salary and divides planned amounts, automatically assigning residual to unallocated surplus', () => {
      const state = getInitialState();

      // Salary ₹50,000 (5,000,000 paise). Explicitly allocate ₹30,000 to groceries and ₹10,000 to dining.
      // Residual ₹10,000 should automatically go to unallocated surplus.
      const action = ledgerActions.addSalaryAndAllocations({
        salaryAmountPaise: 5000000,
        date: '2026-09-01',
        earnerUserId: 'usr_me',
        allocations: [
          { categoryId: 'cat_groceries', amountPaise: 3000000 },
          { categoryId: 'cat_dining', amountPaise: 1000000 },
        ],
      });

      const nextState = ledgerReducer(state, action);

      expect(nextState.salaryEvents.length).toBe(1);
      expect(nextState.salaryEvents[0].amount).toBe(5000000);

      // Allocations should have groceries, dining, and unallocated surplus
      expect(nextState.allocations.length).toBe(3);
      const grocAlloc = nextState.allocations.find(a => a.category_id === 'cat_groceries');
      const dineAlloc = nextState.allocations.find(a => a.category_id === 'cat_dining');
      const unallocAlloc = nextState.allocations.find(a => a.category_id === 'cat_unallocated');

      expect(grocAlloc?.planned_amount).toBe(3000000);
      expect(dineAlloc?.planned_amount).toBe(1000000);
      expect(unallocAlloc?.planned_amount).toBe(1000000); // 50,000 - 40,000 = 10,000 surplus
    });

    it('toggles allocation transferred state and updates timestamp', () => {
      const state = getInitialState();
      state.allocations = [
        {
          id: 'alloc_1',
          salary_event_id: 'sal_1',
          category_id: 'cat_groceries',
          planned_amount: 1000000,
          transferred: false,
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ];

      const state1 = ledgerReducer(state, ledgerActions.toggleAllocationTransferred('alloc_1'));
      expect(state1.allocations[0].transferred).toBe(true);
      expect(state1.allocations[0].transferred_at).toBeDefined();

      const state2 = ledgerReducer(state1, ledgerActions.toggleAllocationTransferred('alloc_1'));
      expect(state2.allocations[0].transferred).toBe(false);
      expect(state2.allocations[0].transferred_at).toBeNull();
    });
  });

  describe('Envelope Transfers', () => {
    it('records envelope transfer with twin positive and negative allocations atomically', () => {
      const state = getInitialState();

      const action = ledgerActions.moveEnvelopeFunds({
        fromCategoryId: 'cat_unallocated',
        toCategoryId: 'cat_groceries',
        amountPaise: 200000,
        note: 'Add groceries from surplus',
      });

      const nextState = ledgerReducer(state, action);

      expect(nextState.envelopeTransfers.length).toBe(1);
      expect(nextState.envelopeTransfers[0].amount).toBe(200000);
      expect(nextState.envelopeTransfers[0].from_category_id).toBe('cat_unallocated');
      expect(nextState.envelopeTransfers[0].to_category_id).toBe('cat_groceries');

      // Check twin allocations
      expect(nextState.allocations.length).toBe(2);
      const toAlloc = nextState.allocations.find(a => a.category_id === 'cat_groceries');
      const fromAlloc = nextState.allocations.find(a => a.category_id === 'cat_unallocated');

      expect(toAlloc?.planned_amount).toBe(200000);
      expect(toAlloc?.transferred).toBe(true);
      expect(fromAlloc?.planned_amount).toBe(-200000);
      expect(fromAlloc?.transferred).toBe(true);
    });
  });

  describe('Direct Category Top-Ups', () => {
    it('creates an allocation for manual category funds top-up', () => {
      const state = getInitialState();

      const action = ledgerActions.addCategoryFunds({
        categoryId: 'cat_groceries',
        amountPaise: 500000,
        source: 'Gift / Family',
        note: 'Birthday gift',
        depositHolding: 'secondary_account',
      });

      const nextState = ledgerReducer(state, action);

      expect(nextState.allocations.length).toBe(1);
      expect(nextState.allocations[0].planned_amount).toBe(500000);
      expect(nextState.allocations[0].source).toBe('Gift / Family');
      expect(nextState.allocations[0].transferred).toBe(true);
    });
  });

  describe('Atomic Zero Reset', () => {
    it('wipes all 6 transactional arrays atomically and sets intro completed flags', () => {
      const state = getInitialState();

      // Seed state with sample data
      state.transactions = [
        {
          id: 'tx_1',
          household_id: 'hh_main',
          category_id: 'cat_groceries',
          amount: 50000,
          date: '2026-09-01',
          logged_by_user_id: 'usr_me',
          payment_method: 'cash',
          reconciliation_status: 'n/a',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ];
      state.allocations = [
        {
          id: 'alloc_1',
          salary_event_id: 'sal_1',
          category_id: 'cat_groceries',
          planned_amount: 500000,
          transferred: true,
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ];
      state.salaryEvents = [
        {
          id: 'sal_1',
          household_id: 'hh_main',
          earner_user_id: 'usr_me',
          amount: 500000,
          date: '2026-09-01',
          created_at: '2026-09-01T00:00:00Z',
        },
      ];
      state.reconciliations = [
        {
          id: 'rec_1',
          household_id: 'hh_main',
          category_id: 'cat_groceries',
          total_amount: 50000,
          date: '2026-09-05',
          logged_by_user_id: 'usr_me',
          created_at: '2026-09-05T00:00:00Z',
        },
      ];
      state.reconciliationLines = [
        {
          id: 'line_1',
          reconciliation_id: 'rec_1',
          transaction_id: 'tx_1',
          amount_applied: 50000,
        },
      ];
      state.envelopeTransfers = [
        {
          id: 'tr_1',
          household_id: 'hh_main',
          from_category_id: 'cat_unallocated',
          to_category_id: 'cat_groceries',
          amount: 100000,
          date: '2026-09-02',
          logged_by_user_id: 'usr_me',
          created_at: '2026-09-02T00:00:00Z',
        },
      ];

      const resetIso = '2026-09-27T10:00:00.000Z';
      const nextState = ledgerReducer(
        state,
        ledgerActions.resetLedgerToZero({
          resetIso,
          userName: 'Krishna',
        })
      );

      // Verify complete atomic wipe
      expect(nextState.transactions).toEqual([]);
      expect(nextState.allocations).toEqual([]);
      expect(nextState.salaryEvents).toEqual([]);
      expect(nextState.reconciliations).toEqual([]);
      expect(nextState.reconciliationLines).toEqual([]);
      expect(nextState.envelopeTransfers).toEqual([]);

      // Verify intro completed and reset timestamp
      expect(nextState.firstTimeIntroCompleted).toBe(true);
      expect(nextState.lastResetAt).toBe(resetIso);
      expect(nextState.household.first_time_intro_completed).toBe(true);
      expect(nextState.household.first_time_intro_completed_at).toBe(resetIso);

      // Verify member name updated
      const me = nextState.members.find(m => m.user_id === 'usr_me');
      expect(me?.name).toBe('Krishna');
    });
  });

  describe('Authoritative Remote Snapshot', () => {
    it('replaces local state with remote Firestore snapshot cleanly', () => {
      const state = getInitialState();

      const remoteData = {
        household: {
          ...INITIAL_HOUSEHOLD,
          name: 'Synced Cloud Household',
        },
        categories: INITIAL_CATEGORIES,
        salaryEvents: [],
        allocations: [],
        transactions: [
          {
            id: 'tx_cloud_1',
            household_id: 'hh_main',
            category_id: 'cat_groceries',
            amount: 75000,
            date: '2026-09-20',
            logged_by_user_id: 'usr_me',
            payment_method: 'cash',
            reconciliation_status: 'n/a',
            created_at: '2026-09-20T00:00:00Z',
            updated_at: '2026-09-20T00:00:00Z',
          },
        ],
        lastSyncedAt: '03:45 PM',
        first_time_intro_completed: true,
      };

      const nextState = ledgerReducer(
        state,
        ledgerActions.remoteSnapshotReceived(remoteData)
      );

      expect(nextState.household.name).toBe('Synced Cloud Household');
      expect(nextState.transactions.length).toBe(1);
      expect(nextState.transactions[0].id).toBe('tx_cloud_1');
      expect(nextState.lastCloudSync).toBe('03:45 PM');
      expect(nextState.syncStatus).toBe('synced');
      expect(nextState.firstTimeIntroCompleted).toBe(true);
    });
  });
});
