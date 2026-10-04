import { describe, it, expect } from 'vitest';
import { ledgerReducer, ledgerActions } from './ledgerSlice';
import { LedgerState } from './types';
import { INITIAL_HOUSEHOLD, INITIAL_MEMBERS, INITIAL_CATEGORIES } from '../data/initialData';
import { DEFAULT_HOUSEHOLD_DOC_ID } from '../sync/householdIdentity';

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
    householdId: DEFAULT_HOUSEHOLD_DOC_ID,
    syncStatus: 'idle',
    lastCloudSync: null,
    permissionDenied: false,
    isRemoteSync: false,
    lastResetAt: null,
  });

  describe('Household Identity Reducer', () => {
    it('keeps householdId and household.id aligned when active household changes', () => {
      const state = getInitialState();

      const nextState = ledgerReducer(state, ledgerActions.setHouseholdId(' hh_shared '));

      expect(nextState.householdId).toBe('hh_shared');
      expect(nextState.household.id).toBe('hh_shared');
    });

    it('normalizes setHousehold payload id into both household fields', () => {
      const state = getInitialState();

      const nextState = ledgerReducer(
        state,
        ledgerActions.setHousehold({
          ...state.household,
          id: 'hh_cloud',
        })
      );

      expect(nextState.householdId).toBe('hh_cloud');
      expect(nextState.household.id).toBe('hh_cloud');
    });
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

    it('clamps future transaction dates before storing ledger entries', () => {
      const state = getInitialState();
      const nextState = ledgerReducer(
        state,
        ledgerActions.addTransaction({
          id: 'tx_future',
          categoryId: 'cat_groceries',
          amount: 100000,
          paymentMethod: 'cash',
          date: '2999-12-31',
        })
      );

      expect(nextState.transactions[0].date).not.toBe('2999-12-31');
    });

    it('appends an adjustment transaction instead of mutating the original transaction amount', () => {
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

      const state2 = ledgerReducer(
        state1,
        ledgerActions.updateTransaction({
          id: 'tx_test_1',
          categoryId: 'cat_groceries',
          amount: 120000,
          paymentMethod: 'secondary_account_debit',
          note: 'Changed amount',
          date: '2026-09-10',
        })
      );

      expect(state2.transactions).toHaveLength(2);
      const original = state2.transactions.find(tx => tx.id === 'tx_test_1');
      const adjustment = state2.transactions.find(tx => tx.related_transaction_id === 'tx_test_1');

      expect(original?.amount).toBe(100000);
      expect(original?.payment_method).toBe('secondary_account_debit');
      expect(adjustment?.id).not.toBe('tx_test_1');
      expect(adjustment?.ledger_entry_type).toBe('adjustment');
      expect(adjustment?.amount).toBe(20000);
      expect(adjustment?.note).toBe('Changed amount');
      expect(state2.transactions.reduce((sum, tx) => sum + tx.amount, 0)).toBe(120000);
    });

    it('appends reversal and replacement transactions when category or payment method changes', () => {
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

      const state2 = ledgerReducer(
        state1,
        ledgerActions.updateTransaction({
          id: 'tx_test_1',
          categoryId: 'cat_dining',
          amount: 120000,
          paymentMethod: 'credit_card',
          note: 'Moved to dining card spend',
          date: '2026-09-11',
        })
      );

      const original = state2.transactions.find(tx => tx.id === 'tx_test_1');
      const reversal = state2.transactions.find(tx => tx.ledger_entry_type === 'reversal');
      const replacement = state2.transactions.find(tx => tx.ledger_entry_type === 'replacement');

      expect(original?.category_id).toBe('cat_groceries');
      expect(original?.amount).toBe(100000);
      expect(reversal?.id).not.toBe(original?.id);
      expect(reversal?.related_transaction_id).toBe('tx_test_1');
      expect(reversal?.category_id).toBe('cat_groceries');
      expect(reversal?.amount).toBe(-100000);
      expect(replacement?.id).not.toBe(original?.id);
      expect(replacement?.related_transaction_id).toBe('tx_test_1');
      expect(replacement?.category_id).toBe('cat_dining');
      expect(replacement?.amount).toBe(120000);
      expect(replacement?.reconciliation_status).toBe('pending');
    });

    it('reverses a transaction by appending a new row instead of deleting history', () => {
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
      const original = state2.transactions.find(tx => tx.id === 'tx_del');
      const reversal = state2.transactions.find(tx => tx.related_transaction_id === 'tx_del');

      expect(state2.transactions).toHaveLength(2);
      expect(original?.deleted_at).toBeUndefined();
      expect(original?.amount).toBe(50000);
      expect(reversal?.id).not.toBe('tx_del');
      expect(reversal?.ledger_entry_type).toBe('reversal');
      expect(reversal?.amount).toBe(-50000);
      expect(state2.transactions.reduce((sum, tx) => sum + tx.amount, 0)).toBe(0);
    });

    it('reverses an adjustment against the original transaction relationship', () => {
      const state = getInitialState();
      const state1 = ledgerReducer(
        state,
        ledgerActions.addTransaction({
          id: 'tx_base',
          categoryId: 'cat_groceries',
          amount: 50000,
          paymentMethod: 'credit_card',
          date: '2026-09-12',
        })
      );
      const state2 = ledgerReducer(
        state1,
        ledgerActions.updateTransaction({
          id: 'tx_base',
          categoryId: 'cat_groceries',
          amount: 70000,
          paymentMethod: 'credit_card',
          date: '2026-09-12',
        })
      );
      const adjustment = state2.transactions.find(tx => tx.ledger_entry_type === 'adjustment');

      const state3 = ledgerReducer(state2, ledgerActions.deleteTransaction(adjustment?.id || ''));
      const reversal = state3.transactions.find(tx => tx.id !== adjustment?.id && tx.ledger_entry_type === 'reversal');

      expect(adjustment?.related_transaction_id).toBe('tx_base');
      expect(reversal?.related_transaction_id).toBe('tx_base');
      expect(state3.transactions.reduce((sum, tx) => sum + tx.amount, 0)).toBe(50000);
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

    it('reverts an envelope transfer by appending reverse entries instead of deleting history', () => {
      const state = getInitialState();
      const state1 = ledgerReducer(
        state,
        ledgerActions.moveEnvelopeFunds({
          fromCategoryId: 'cat_unallocated',
          toCategoryId: 'cat_groceries',
          amountPaise: 200000,
          note: 'Add groceries from surplus',
        })
      );
      const originalTransferId = state1.envelopeTransfers[0].id;

      const state2 = ledgerReducer(state1, ledgerActions.deleteEnvelopeTransfer(originalTransferId));

      expect(state2.envelopeTransfers).toHaveLength(2);
      expect(state2.envelopeTransfers.some(transfer => transfer.id === originalTransferId)).toBe(true);
      const reversalTransfer = state2.envelopeTransfers.find(transfer => transfer.id !== originalTransferId);
      expect(reversalTransfer?.from_category_id).toBe('cat_groceries');
      expect(reversalTransfer?.to_category_id).toBe('cat_unallocated');
      expect(reversalTransfer?.amount).toBe(200000);
      expect(state2.allocations.reduce((sum, allocation) => sum + allocation.planned_amount, 0)).toBe(0);
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

    it('reverts a top-up by appending a negative allocation instead of deleting history', () => {
      const state = getInitialState();
      const state1 = ledgerReducer(
        state,
        ledgerActions.addCategoryFunds({
          categoryId: 'cat_groceries',
          amountPaise: 500000,
          source: 'Gift / Family',
          note: 'Birthday gift',
          depositHolding: 'secondary_account',
        })
      );
      const originalId = state1.allocations[0].id;

      const state2 = ledgerReducer(state1, ledgerActions.deleteCategoryFunds(originalId));

      expect(state2.allocations).toHaveLength(2);
      expect(state2.allocations.find(a => a.id === originalId)?.planned_amount).toBe(500000);
      const reversal = state2.allocations.find(a => a.id !== originalId);
      expect(reversal?.planned_amount).toBe(-500000);
      expect(reversal?.source).toBe('Reversal');
      expect(state2.allocations.reduce((sum, allocation) => sum + allocation.planned_amount, 0)).toBe(0);
    });
  });

  describe('Atomic Zero Reset', () => {
    it('wipes all 6 transactional arrays atomically and sets intro completed flags', () => {
      const state = getInitialState();

      // Seed state with sample data
      state.transactions = [
        {
          id: 'tx_1',
          household_id: DEFAULT_HOUSEHOLD_DOC_ID,
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
          household_id: DEFAULT_HOUSEHOLD_DOC_ID,
          earner_user_id: 'usr_me',
          amount: 500000,
          date: '2026-09-01',
          created_at: '2026-09-01T00:00:00Z',
        },
      ];
      state.reconciliations = [
        {
          id: 'rec_1',
          household_id: DEFAULT_HOUSEHOLD_DOC_ID,
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
          household_id: DEFAULT_HOUSEHOLD_DOC_ID,
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
        owner_uid: 'firebase_uid_owner',
        owner_email: 'owner@example.com',
        allowed_emails: ['owner@example.com', 'partner@example.com'],
        created_by: 'firebase_uid_owner',
        categories: INITIAL_CATEGORIES,
        salaryEvents: [],
        allocations: [],
        transactions: [
          {
            id: 'tx_cloud_1',
            household_id: DEFAULT_HOUSEHOLD_DOC_ID,
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
      expect(nextState.household.owner_uid).toBe('firebase_uid_owner');
      expect(nextState.household.owner_email).toBe('owner@example.com');
      expect(nextState.household.allowed_emails).toEqual(['owner@example.com', 'partner@example.com']);
      expect(nextState.household.created_by).toBe('firebase_uid_owner');
      expect(nextState.transactions.length).toBe(1);
      expect(nextState.transactions[0].id).toBe('tx_cloud_1');
      expect(nextState.lastCloudSync).toBe('03:45 PM');
      expect(nextState.syncStatus).toBe('synced');
      expect(nextState.firstTimeIntroCompleted).toBe(true);
    });
  });
});
