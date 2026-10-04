import { describe, it, expect } from 'vitest';
import {
  selectCategoryBalances,
  selectTotalAvailablePaise,
  selectTotalPendingPaybackPaise,
  selectUnallocatedBalance,
  selectPendingTransfersList,
  selectActiveMember,
} from './selectors';
import { RootState } from './index';
import { INITIAL_HOUSEHOLD, INITIAL_MEMBERS, INITIAL_CATEGORIES } from '../data/initialData';
import { DEFAULT_HOUSEHOLD_DOC_ID } from '../sync/householdIdentity';

describe('Redux Selectors Unit Tests', () => {
  const createMockRootState = (overrides?: Partial<RootState['ledger']>): RootState => ({
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
      firstTimeIntroCompleted: true,
      householdId: DEFAULT_HOUSEHOLD_DOC_ID,
      syncStatus: 'synced',
      lastCloudSync: null,
      permissionDenied: false,
      isRemoteSync: false,
      lastResetAt: null,
      ...overrides,
    },
  });

  describe('selectCategoryBalances', () => {
    it('calculates availableNow, month metrics, and card debt per category', () => {
      const state = createMockRootState({
        allocations: [
          // Groceries: ₹10,000 transferred
          {
            id: 'a1',
            salary_event_id: 's1',
            category_id: 'cat_groceries',
            planned_amount: 1000000,
            transferred: true,
            created_at: '2026-09-01T10:00:00Z',
            updated_at: '2026-09-01T10:00:00Z',
          },
          // Dining: ₹5,000 transferred
          {
            id: 'a2',
            salary_event_id: 's1',
            category_id: 'cat_dining',
            planned_amount: 500000,
            transferred: true,
            created_at: '2026-09-01T10:00:00Z',
            updated_at: '2026-09-01T10:00:00Z',
          },
          // Dining: ₹2,000 not transferred yet (should NOT count towards availableNow)
          {
            id: 'a3',
            salary_event_id: 's1',
            category_id: 'cat_dining',
            planned_amount: 200000,
            transferred: false,
            created_at: '2026-09-01T10:00:00Z',
            updated_at: '2026-09-01T10:00:00Z',
          },
        ],
        transactions: [
          // Groceries spend: ₹3,000 via Debit
          {
            id: 't1',
            household_id: DEFAULT_HOUSEHOLD_DOC_ID,
            category_id: 'cat_groceries',
            amount: 300000,
            date: '2026-09-05',
            logged_by_user_id: 'usr_me',
            payment_method: 'secondary_account_debit',
            reconciliation_status: 'n/a',
            created_at: '2026-09-05T10:00:00Z',
            updated_at: '2026-09-05T10:00:00Z',
          },
          // Dining spend: ₹2,000 via Credit Card (pending)
          {
            id: 't2',
            household_id: DEFAULT_HOUSEHOLD_DOC_ID,
            category_id: 'cat_dining',
            amount: 200000,
            date: '2026-09-08',
            logged_by_user_id: 'usr_me',
            payment_method: 'credit_card',
            reconciliation_status: 'pending',
            created_at: '2026-09-08T10:00:00Z',
            updated_at: '2026-09-08T10:00:00Z',
          },
        ],
      });

      const balances = selectCategoryBalances(state);

      const groc = balances.find(b => b.category.id === 'cat_groceries');
      expect(groc?.availableNow).toBe(700000); // 10,000 - 3,000 = 7,000
      expect(groc?.thisMonthAllocated).toBe(1000000);
      expect(groc?.thisMonthSpent).toBe(300000);
      expect(groc?.pendingCardDebt).toBe(0);

      const dine = balances.find(b => b.category.id === 'cat_dining');
      expect(dine?.availableNow).toBe(300000); // 5,000 (transferred only) - 2,000 = 3,000
      expect(dine?.pendingCardDebt).toBe(200000); // ₹2,000 unreconciled CC debt
    });

    it('always sorts the unallocated category to the very last position', () => {
      const state = createMockRootState();
      const balances = selectCategoryBalances(state);
      expect(balances.length).toBeGreaterThan(1);
      const lastItem = balances[balances.length - 1];
      expect(lastItem.category.is_unallocated).toBe(true);

      // Verify no earlier item is unallocated
      const otherItems = balances.slice(0, -1);
      expect(otherItems.every(b => !b.category.is_unallocated)).toBe(true);
    });
  });

  describe('selectTotalAvailablePaise and selectTotalPendingPaybackPaise', () => {
    it('aggregates available and pending debt across all categories', () => {
      const state = createMockRootState({
        allocations: [
          {
            id: 'a1',
            salary_event_id: 's1',
            category_id: 'cat_groceries',
            planned_amount: 1000000,
            transferred: true,
            created_at: '2026-09-01T10:00:00Z',
            updated_at: '2026-09-01T10:00:00Z',
          },
        ],
        transactions: [
          {
            id: 't1',
            household_id: DEFAULT_HOUSEHOLD_DOC_ID,
            category_id: 'cat_groceries',
            amount: 400000,
            date: '2026-09-05',
            logged_by_user_id: 'usr_me',
            payment_method: 'credit_card',
            reconciliation_status: 'pending',
            created_at: '2026-09-05T10:00:00Z',
            updated_at: '2026-09-05T10:00:00Z',
          },
        ],
      });

      const totalAvailable = selectTotalAvailablePaise(state);
      expect(totalAvailable).toBe(600000); // 10,000 - 4,000

      const totalDebt = selectTotalPendingPaybackPaise(state);
      expect(totalDebt).toBe(400000);
    });
  });

  describe('selectUnallocatedBalance', () => {
    it('returns balance specifically for the unallocated surplus envelope', () => {
      const state = createMockRootState({
        allocations: [
          {
            id: 'a_unalloc',
            salary_event_id: 's1',
            category_id: 'cat_unallocated',
            planned_amount: 1500000, // ₹15,000 surplus
            transferred: true,
            created_at: '2026-09-01T10:00:00Z',
            updated_at: '2026-09-01T10:00:00Z',
          },
        ],
      });

      const unallocBal = selectUnallocatedBalance(state);
      expect(unallocBal).toBe(1500000);
    });
  });

  describe('selectPendingTransfersList', () => {
    it('returns only allocations not yet marked transferred', () => {
      const state = createMockRootState({
        allocations: [
          {
            id: 'a1',
            salary_event_id: 's1',
            category_id: 'cat_groceries',
            planned_amount: 1000000,
            transferred: true,
            created_at: '2026-09-01T10:00:00Z',
            updated_at: '2026-09-01T10:00:00Z',
          },
          {
            id: 'a2',
            salary_event_id: 's1',
            category_id: 'cat_dining',
            planned_amount: 500000,
            transferred: false,
            created_at: '2026-09-01T10:00:00Z',
            updated_at: '2026-09-01T10:00:00Z',
          },
        ],
      });

      const pending = selectPendingTransfersList(state);
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe('a2');
      expect(pending[0].categoryName).toBe('Dining & Cafes');
    });
  });

  describe('selectActiveMember', () => {
    it('returns a fallback member when remote hydration temporarily has no members', () => {
      const state = createMockRootState({ members: [] });

      expect(selectActiveMember(state)).toMatchObject({
        household_id: DEFAULT_HOUSEHOLD_DOC_ID,
        user_id: 'usr_me',
        name: 'You',
      });
    });
  });
});
