import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncMiddleware, STORAGE_KEYS } from './syncMiddleware';
import { ledgerActions } from './ledgerSlice';
import { RootState } from './index';
import { INITIAL_HOUSEHOLD, INITIAL_MEMBERS, INITIAL_CATEGORIES } from '../data/initialData';

// Provide globalThis.localStorage mock for Node test environment
const storageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => storageStore[key] || null,
  setItem: (key: string, value: string) => {
    storageStore[key] = String(value);
  },
  removeItem: (key: string) => {
    delete storageStore[key];
  },
  clear: () => {
    for (const key of Object.keys(storageStore)) {
      delete storageStore[key];
    }
  },
};
(globalThis as any).localStorage = localStorageMock;

describe('syncMiddleware Unit Tests', () => {
  let mockState: RootState;
  let mockStore: any;
  let next: any;

  beforeEach(() => {
    localStorageMock.clear();
    mockState = {
      ledger: {
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
      },
    };

    mockStore = {
      getState: () => mockState,
      dispatch: vi.fn(),
    };

    next = vi.fn(action => action);
  });

  it('persists transactions and categories to localStorage when a mutation action is dispatched', () => {
    mockState.ledger.transactions = [
      {
        id: 'tx_1',
        household_id: 'hh_main',
        category_id: 'cat_groceries',
        amount: 250000,
        date: '2026-09-15',
        logged_by_user_id: 'usr_me',
        payment_method: 'secondary_account_debit',
        reconciliation_status: 'n/a',
        created_at: '2026-09-15T00:00:00Z',
        updated_at: '2026-09-15T00:00:00Z',
      },
    ];

    const action = ledgerActions.addTransaction({
      categoryId: 'cat_groceries',
      amount: 250000,
      paymentMethod: 'secondary_account_debit',
      date: '2026-09-15',
    });

    syncMiddleware(mockStore)(next)(action);

    expect(next).toHaveBeenCalledWith(action);

    const savedTx = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]');
    expect(savedTx.length).toBe(1);
    expect(savedTx[0].amount).toBe(250000);
  });

  it('skips localStorage writes for internal sync status actions to avoid redundant overhead', () => {
    const action = ledgerActions.setSyncStatus('syncing');

    syncMiddleware(mockStore)(next)(action);

    expect(next).toHaveBeenCalledWith(action);
    // LocalStorage should not have been updated with categories or transactions
    expect(localStorage.getItem(STORAGE_KEYS.CATEGORIES)).toBeNull();
  });

  it('writes reset flags to localStorage when resetLedgerToZero is dispatched', () => {
    const resetIso = '2026-09-27T12:00:00.000Z';
    mockState.ledger.lastResetAt = resetIso;

    const action = ledgerActions.resetLedgerToZero({
      resetIso,
      userName: 'User',
    });

    syncMiddleware(mockStore)(next)(action);

    expect(next).toHaveBeenCalledWith(action);
    expect(localStorage.getItem('env_budget_tour_completed')).toBe('true');
    expect(localStorage.getItem('env_budget_first_time_intro_done')).toBe('true');
    expect(localStorage.getItem('env_budget_last_reset_timestamp')).toBe(resetIso);
  });
});
