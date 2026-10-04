import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncMiddleware, configureSyncAuth, flushSyncNow } from './syncMiddleware';
import { ledgerActions } from './ledgerSlice';
import { RootState } from './index';
import { INITIAL_HOUSEHOLD, INITIAL_MEMBERS, INITIAL_CATEGORIES } from '../data/initialData';
import { DEFAULT_HOUSEHOLD_DOC_ID } from '../sync/householdIdentity';
import { cacheKeyForLocalLedger } from '../sync/localCache';

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
    configureSyncAuth({ uid: null, email: null, isAccessAllowed: false });
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
        household_id: DEFAULT_HOUSEHOLD_DOC_ID,
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

    const cached = JSON.parse(localStorage.getItem(cacheKeyForLocalLedger()) || '{}');
    expect(cached.ledger.transactions.length).toBe(1);
    expect(cached.ledger.transactions[0].amount).toBe(250000);
  });

  it('skips localStorage writes for internal sync status actions to avoid redundant overhead', () => {
    const action = ledgerActions.setSyncStatus('syncing');

    syncMiddleware(mockStore)(next)(action);

    expect(next).toHaveBeenCalledWith(action);
    // LocalStorage should not have been updated with scoped ledger cache
    expect(localStorage.getItem(cacheKeyForLocalLedger())).toBeNull();
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

  it('does not attempt cloud sync when no authenticated authorized user is configured', async () => {
    syncMiddleware(mockStore)(next)(
      ledgerActions.addTransaction({
        categoryId: 'cat_groceries',
        amount: 250000,
        paymentMethod: 'cash',
        date: '2026-09-15',
      })
    );

    const result = await flushSyncNow();

    expect(result).toEqual({
      ok: false,
      reason: 'signed_out',
      message: 'Create or join a cloud household before syncing to cloud.',
    });
    expect(mockStore.dispatch).not.toHaveBeenCalledWith(ledgerActions.setSyncStatus('syncing'));
  });
});
