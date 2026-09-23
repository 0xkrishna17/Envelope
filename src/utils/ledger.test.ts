import { describe, it, expect } from 'vitest';
import { buildUnifiedLedger, LedgerEntryType } from './ledger';
import {
  Transaction,
  SalaryEvent,
  Reconciliation,
  ReconciliationLine,
  EnvelopeTransfer,
  Allocation,
  Category,
  Membership,
} from '../types';

describe('Unified Ledger Processing Unit Tests', () => {
  const members: Membership[] = [
    {
      id: 'm1',
      household_id: 'hh1',
      user_id: 'u_user1',
      name: 'Alex',
      role: 'owner',
      avatar_color: '#4E785E',
      joined_at: '2026-08-01T00:00:00Z',
    },
    {
      id: 'm2',
      household_id: 'hh1',
      user_id: 'u_user2',
      name: 'Sam',
      role: 'member',
      avatar_color: '#B85D43',
      joined_at: '2026-08-01T00:00:00Z',
    },
  ];

  const categories: Category[] = [
    {
      id: 'c_groc',
      household_id: 'hh1',
      name: 'Groceries',
      icon: 'ShoppingBag',
      color: '#4E785E',
      is_archived: false,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
    {
      id: 'c_dine',
      household_id: 'hh1',
      name: 'Dining Out',
      icon: 'Utensils',
      color: '#B85D43',
      is_archived: false,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
  ];

  const transactions: Transaction[] = [
    {
      id: 't1',
      household_id: 'hh1',
      category_id: 'c_groc',
      amount: 45000, // ₹450
      date: '2026-09-02',
      logged_by_user_id: 'u_user1',
      payment_method: 'credit_card',
      note: 'Supermarket vegetables',
      reconciliation_status: 'pending',
      created_at: '2026-09-02T10:00:00Z',
      updated_at: '2026-09-02T10:00:00Z',
    },
    {
      id: 't_deleted',
      household_id: 'hh1',
      category_id: 'c_groc',
      amount: 10000,
      date: '2026-09-03',
      logged_by_user_id: 'u_user1',
      payment_method: 'cash',
      reconciliation_status: 'n/a',
      deleted_at: '2026-09-04T00:00:00Z',
      created_at: '2026-09-03T10:00:00Z',
      updated_at: '2026-09-04T00:00:00Z',
    },
  ];

  const salaryEvents: SalaryEvent[] = [
    {
      id: 'sal1',
      household_id: 'hh1',
      earner_user_id: 'u_user1',
      amount: 15000000, // ₹1,50,000
      date: '2026-09-01',
      created_at: '2026-09-01T09:00:00Z',
    },
  ];

  const reconciliations: Reconciliation[] = [
    {
      id: 'rec1',
      household_id: 'hh1',
      category_id: 'c_groc',
      total_amount: 325000, // ₹3,250
      date: '2026-09-05',
      logged_by_user_id: 'u_user1',
      created_at: '2026-09-05T12:00:00Z',
    },
  ];

  const reconciliationLines: ReconciliationLine[] = [
    {
      id: 'line1',
      reconciliation_id: 'rec1',
      transaction_id: 't1',
      amount_applied: 45000,
    },
  ];

  const envelopeTransfers: EnvelopeTransfer[] = [
    {
      id: 'tr1',
      household_id: 'hh1',
      from_category_id: 'c_groc',
      to_category_id: 'c_dine',
      amount: 100000, // ₹1,000
      date: '2026-09-06',
      logged_by_user_id: 'u_user2',
      note: 'Dinner party reallocation',
      created_at: '2026-09-06T18:00:00Z',
    },
  ];

  const allocations: Allocation[] = [
    {
      id: 'topup_alloc_1',
      salary_event_id: 'env_topup_1725500000',
      category_id: 'c_dine',
      planned_amount: 500000, // ₹5,000 top up
      transferred: true,
      source: 'Quarterly Bonus',
      note: 'Extra dining celebration',
      deposit_holding: 'secondary_account',
      created_at: '2026-09-07T14:00:00Z',
      updated_at: '2026-09-07T14:00:00Z',
    },
    {
      id: 'sal_alloc_1',
      salary_event_id: 'sal1',
      category_id: 'c_groc',
      planned_amount: 10000000,
      transferred: true,
      created_at: '2026-09-01T09:00:00Z',
      updated_at: '2026-09-01T09:00:00Z',
    },
  ];

  it('unifies all 5 entry types (spends, salary credits, reconciliations, fund moves, category top-ups)', () => {
    const { entries, stats } = buildUnifiedLedger(
      transactions,
      salaryEvents,
      reconciliations,
      reconciliationLines,
      envelopeTransfers,
      categories,
      members,
      { timeframe: 'all' },
      allocations
    );

    expect(entries.length).toBe(5);
    expect(stats.totalCount).toBe(5);
    expect(stats.spendCount).toBe(1);
    expect(stats.salaryCount).toBe(1);
    expect(stats.reconcileCount).toBe(1);
    expect(stats.fundMoveCount).toBe(1);
    expect(stats.topupCount).toBe(1);
    expect(stats.totalTopupPaise).toBe(500000);

    // Check individual types are present
    const types = entries.map(e => e.type);
    expect(types).toContain('spend');
    expect(types).toContain('salary_credit');
    expect(types).toContain('reconcile');
    expect(types).toContain('fund_move');
    expect(types).toContain('category_topup');
  });

  it('orders entries in reverse chronological order (latest date first)', () => {
    const { entries } = buildUnifiedLedger(
      transactions,
      salaryEvents,
      reconciliations,
      reconciliationLines,
      envelopeTransfers,
      categories,
      members,
      { timeframe: 'all' },
      allocations
    );

    // topup_alloc_1: 2026-09-07, tr1: 2026-09-06, rec1: 2026-09-05, t1: 2026-09-02, sal1: 2026-09-01
    expect(entries[0].id).toBe('topup_topup_alloc_1');
    expect(entries[1].id).toBe('move_tr1');
    expect(entries[2].id).toBe('rec_rec1');
    expect(entries[3].id).toBe('tx_t1');
    expect(entries[4].id).toBe('sal_sal1');
  });

  it('correctly filters by typeFilter (e.g. category_topup only)', () => {
    const { entries } = buildUnifiedLedger(
      transactions,
      salaryEvents,
      reconciliations,
      reconciliationLines,
      envelopeTransfers,
      categories,
      members,
      { timeframe: 'all', typeFilter: 'category_topup' },
      allocations
    );

    expect(entries.length).toBe(1);
    expect(entries[0].type).toBe('category_topup');
    expect(entries[0].amountPaise).toBe(500000);
    expect(entries[0].categoryName).toBe('Dining Out');
    expect(entries[0].topupSource).toBe('Quarterly Bonus');
    expect(entries[0].depositHolding).toBe('secondary_account');
  });

  it('correctly filters by typeFilter (e.g. fund_move only) while keeping all tab counts non-zero in stats', () => {
    const { entries, stats } = buildUnifiedLedger(
      transactions,
      salaryEvents,
      reconciliations,
      reconciliationLines,
      envelopeTransfers,
      categories,
      members,
      { timeframe: 'all', typeFilter: 'fund_move' },
      allocations
    );

    // Filtered entries contains only fund moves
    expect(entries.length).toBe(1);
    expect(entries[0].type).toBe('fund_move');
    expect(entries[0].amountPaise).toBe(100000);
    expect(entries[0].fromCategoryName).toBe('Groceries');
    expect(entries[0].toCategoryName).toBe('Dining Out');

    // All tabs like Spends, Salary In, Top-ups, etc. maintain their true contextual totals and DO NOT zero out!
    expect(stats.totalCount).toBe(5);
    expect(stats.spendCount).toBe(1);
    expect(stats.totalSpentPaise).toBe(45000);
    expect(stats.salaryCount).toBe(1);
    expect(stats.totalSalaryPaise).toBe(15000000);
    expect(stats.reconcileCount).toBe(1);
    expect(stats.fundMoveCount).toBe(1);
    expect(stats.topupCount).toBe(1);
  });

  it('correctly filters by envelope (categoryFilter) including top-ups', () => {
    const dineResult = buildUnifiedLedger(
      transactions,
      salaryEvents,
      reconciliations,
      reconciliationLines,
      envelopeTransfers,
      categories,
      members,
      { timeframe: 'all', categoryFilter: 'c_dine' },
      allocations
    );
    // Should match tr1 (to c_dine) and topup_alloc_1 (c_dine)
    expect(dineResult.entries.length).toBe(2);
    const types = dineResult.entries.map(e => e.type);
    expect(types).toContain('fund_move');
    expect(types).toContain('category_topup');
  });

  it('supports fuzzy search across top-up sources and notes', () => {
    const sourceSearch = buildUnifiedLedger(
      transactions,
      salaryEvents,
      reconciliations,
      reconciliationLines,
      envelopeTransfers,
      categories,
      members,
      { timeframe: 'all', searchQuery: 'Bonus' },
      allocations
    );
    expect(sourceSearch.entries.length).toBe(1);
    expect(sourceSearch.entries[0].id).toBe('topup_topup_alloc_1');

    const noteSearch = buildUnifiedLedger(
      transactions,
      salaryEvents,
      reconciliations,
      reconciliationLines,
      envelopeTransfers,
      categories,
      members,
      { timeframe: 'all', searchQuery: 'vegetables' },
      allocations
    );
    expect(noteSearch.entries.length).toBe(1);
    expect(noteSearch.entries[0].id).toBe('tx_t1');
  });
});
