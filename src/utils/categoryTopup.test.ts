import { describe, it, expect } from 'vitest';
import { calculateCategoryBalance, calculateMonthSummary } from './budgetLogic';
import { Allocation, Transaction, Category } from '../types';

describe('Category Top-Up (Non-Salary Flow) Unit Tests', () => {
  const groceriesId = 'cat_groceries';
  const diningId = 'cat_dining';

  it('adds money to a category without requiring a salary event', () => {
    // Top-up directly with a generated ad-hoc top-up id and source metadata
    const topupAllocation: Allocation = {
      id: 'alloc_topup_1',
      salary_event_id: 'env_topup_1725500000',
      category_id: groceriesId,
      planned_amount: 300000, // ₹3,000 top up
      transferred: true,
      source: 'Diwali Gift from Family',
      note: 'Festival sweets & groceries',
      deposit_holding: 'secondary_account',
      created_at: '2026-09-05T12:00:00Z',
      updated_at: '2026-09-05T12:00:00Z',
    };

    const transactions: Transaction[] = [
      {
        id: 'tx_sweets',
        household_id: 'hh1',
        category_id: groceriesId,
        amount: 120000, // ₹1,200 spent
        date: '2026-09-06',
        logged_by_user_id: 'u1',
        payment_method: 'secondary_account_debit',
        reconciliation_status: 'n/a',
        created_at: '2026-09-06T10:00:00Z',
        updated_at: '2026-09-06T10:00:00Z',
      },
    ];

    // Balance should immediately reflect ₹3,000 - ₹1,200 = ₹1,800 (180000 paise)
    const available = calculateCategoryBalance(groceriesId, [topupAllocation], transactions);
    expect(available).toBe(180000);
  });

  it('marks funds as pending transfer when deposited into primary_account', () => {
    // If user deposited into primary salary account, transferred is false until bank transfer is done
    const pendingTopup: Allocation = {
      id: 'alloc_pending_transfer',
      salary_event_id: 'env_topup_1725500001',
      category_id: diningId,
      planned_amount: 500000, // ₹5,000
      transferred: false, // Bank transfer not yet executed
      source: 'Cash deposit into salary a/c',
      deposit_holding: 'primary_account',
      created_at: '2026-09-07T10:00:00Z',
      updated_at: '2026-09-07T10:00:00Z',
    };

    // Available balance must NOT count non-transferred funds (§4.1 constraint)
    const availableBeforeTransfer = calculateCategoryBalance(diningId, [pendingTopup], []);
    expect(availableBeforeTransfer).toBe(0);

    // Once bank transfer is marked complete:
    const completedTopup: Allocation = {
      ...pendingTopup,
      transferred: true,
      updated_at: '2026-09-07T12:00:00Z',
    };

    const availableAfterTransfer = calculateCategoryBalance(diningId, [completedTopup], []);
    expect(availableAfterTransfer).toBe(500000);
  });

  it('reverting/soft-deleting a top-up immediately restores original category balance', () => {
    const activeTopup: Allocation = {
      id: 'alloc_revertible',
      salary_event_id: 'env_topup_1725500002',
      category_id: groceriesId,
      planned_amount: 200000, // ₹2,000
      transferred: true,
      source: 'Mistakenly added fund',
      deposit_holding: 'secondary_account',
      created_at: '2026-09-08T10:00:00Z',
      updated_at: '2026-09-08T10:00:00Z',
    };

    const initialBalance = calculateCategoryBalance(groceriesId, [activeTopup], []);
    expect(initialBalance).toBe(200000);

    // When reverted (soft-deleted with deleted_at timestamp)
    const deletedTopup: Allocation = {
      ...activeTopup,
      deleted_at: '2026-09-08T10:05:00Z',
    };

    const revertedBalance = calculateCategoryBalance(groceriesId, [deletedTopup], []);
    expect(revertedBalance).toBe(0);
  });

  it('correctly aggregates direct top-ups alongside salary allocations in monthly summary', () => {
    const salaryAllocation: Allocation = {
      id: 'alloc_sal',
      salary_event_id: 'sal_sep_2026',
      category_id: diningId,
      planned_amount: 800000, // ₹8,000 salary allocation
      transferred: true,
      created_at: '2026-09-01T09:00:00Z',
      updated_at: '2026-09-01T09:00:00Z',
    };

    const topupAllocation: Allocation = {
      id: 'alloc_topup_extra',
      salary_event_id: 'env_topup_bonus',
      category_id: diningId,
      planned_amount: 250000, // ₹2,500 extra top-up
      transferred: true,
      source: 'Freelance project gig',
      deposit_holding: 'secondary_account',
      created_at: '2026-09-12T14:00:00Z',
      updated_at: '2026-09-12T14:00:00Z',
    };

    const tx: Transaction = {
      id: 'tx_dinner',
      household_id: 'hh1',
      category_id: diningId,
      amount: 400000, // ₹4,000 spent
      date: '2026-09-15',
      logged_by_user_id: 'u1',
      payment_method: 'credit_card',
      reconciliation_status: 'pending',
      created_at: '2026-09-15T20:00:00Z',
      updated_at: '2026-09-15T20:00:00Z',
    };

    const monthSummary = calculateMonthSummary(
      diningId,
      [salaryAllocation, topupAllocation],
      [tx],
      '2026-09'
    );

    // Total allocated in September = 800000 + 250000 = 1050000
    expect(monthSummary.allocated).toBe(1050000);
    expect(monthSummary.spent).toBe(400000);

    const overallBalance = calculateCategoryBalance(
      diningId,
      [salaryAllocation, topupAllocation],
      [tx]
    );
    // Available = 1050000 - 400000 = 650000
    expect(overallBalance).toBe(650000);
  });
});
