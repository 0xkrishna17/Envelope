import { describe, it, expect } from 'vitest';
import {
  calculateCategoryBalance,
  calculateMonthSummary,
  calculateCategoryPendingDebt,
  executeFifoReconciliation,
  recomputeTransactionStatuses,
} from './budgetLogic';
import { Allocation, Transaction, ReconciliationLine } from '../types';

describe('Envelope Budget Logic Unit Tests', () => {
  const catGroceries = 'cat_groceries';
  const catDining = 'cat_dining';

  describe('calculateCategoryBalance', () => {
    it('correctly calculates balance with transferred and non-transferred allocations', () => {
      const allocations: Allocation[] = [
        {
          id: 'a1',
          salary_event_id: 's1',
          category_id: catGroceries,
          planned_amount: 1000000, // ₹10,000 in paise
          transferred: true,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'a2',
          salary_event_id: 's1',
          category_id: catGroceries,
          planned_amount: 500000, // ₹5,000 (not transferred yet)
          transferred: false,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
      ];

      const transactions: Transaction[] = [
        {
          id: 't1',
          household_id: 'h1',
          category_id: catGroceries,
          amount: 250000, // ₹2,500 spent
          date: '2026-09-02',
          logged_by_user_id: 'u1',
          payment_method: 'credit_card',
          reconciliation_status: 'pending',
          created_at: '2026-09-02T10:00:00Z',
          updated_at: '2026-09-02T10:00:00Z',
        },
      ];

      // Available now must ONLY include transferred allocations: 1000000 - 250000 = 750000
      const balance = calculateCategoryBalance(catGroceries, allocations, transactions);
      expect(balance).toBe(750000);
    });

    it('ignores deleted allocations and deleted transactions (soft-delete compliance)', () => {
      const allocations: Allocation[] = [
        {
          id: 'a1',
          salary_event_id: 's1',
          category_id: catGroceries,
          planned_amount: 500000,
          transferred: true,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'a2_deleted',
          salary_event_id: 's1',
          category_id: catGroceries,
          planned_amount: 300000,
          transferred: true,
          deleted_at: '2026-09-02T10:00:00Z',
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-02T10:00:00Z',
        },
      ];

      const transactions: Transaction[] = [
        {
          id: 't1_active',
          household_id: 'h1',
          category_id: catGroceries,
          amount: 150000,
          date: '2026-09-03',
          logged_by_user_id: 'u1',
          payment_method: 'cash',
          reconciliation_status: 'n/a',
          created_at: '2026-09-03T10:00:00Z',
          updated_at: '2026-09-03T10:00:00Z',
        },
        {
          id: 't2_deleted',
          household_id: 'h1',
          category_id: catGroceries,
          amount: 200000,
          date: '2026-09-03',
          logged_by_user_id: 'u1',
          payment_method: 'cash',
          reconciliation_status: 'n/a',
          deleted_at: '2026-09-04T10:00:00Z',
          created_at: '2026-09-03T10:00:00Z',
          updated_at: '2026-09-04T10:00:00Z',
        },
      ];

      // 500000 - 150000 = 350000
      const balance = calculateCategoryBalance(catGroceries, allocations, transactions);
      expect(balance).toBe(350000);
    });

    it('handles negative transaction amounts as credit/refund properly', () => {
      const allocations: Allocation[] = [
        {
          id: 'a1',
          salary_event_id: 's1',
          category_id: catGroceries,
          planned_amount: 100000,
          transferred: true,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
      ];

      const transactions: Transaction[] = [
        {
          id: 't_refund',
          household_id: 'h1',
          category_id: catGroceries,
          amount: -50000, // ₹500 refunded back into envelope
          date: '2026-09-05',
          logged_by_user_id: 'u1',
          payment_method: 'credit_card',
          reconciliation_status: 'pending',
          created_at: '2026-09-05T10:00:00Z',
          updated_at: '2026-09-05T10:00:00Z',
        },
      ];

      // 100000 - (-50000) = 150000
      const balance = calculateCategoryBalance(catGroceries, allocations, transactions);
      expect(balance).toBe(150000);
    });
  });

  describe('calculateMonthSummary', () => {
    it('isolates monthly slices strictly to the selected year-month string', () => {
      const allocations: Allocation[] = [
        {
          id: 'a_aug',
          salary_event_id: 's_aug',
          category_id: catGroceries,
          planned_amount: 1200000,
          transferred: true,
          created_at: '2026-08-01T10:00:00Z',
          updated_at: '2026-08-01T10:00:00Z',
        },
        {
          id: 'a_sep',
          salary_event_id: 's_sep',
          category_id: catGroceries,
          planned_amount: 1500000,
          transferred: true,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
      ];

      const transactions: Transaction[] = [
        {
          id: 't_aug',
          household_id: 'h1',
          category_id: catGroceries,
          amount: 800000,
          date: '2026-08-15',
          logged_by_user_id: 'u1',
          payment_method: 'secondary_account_debit',
          reconciliation_status: 'n/a',
          created_at: '2026-08-15T10:00:00Z',
          updated_at: '2026-08-15T10:00:00Z',
        },
        {
          id: 't_sep',
          household_id: 'h1',
          category_id: catGroceries,
          amount: 600000,
          date: '2026-09-10',
          logged_by_user_id: 'u1',
          payment_method: 'credit_card',
          reconciliation_status: 'pending',
          created_at: '2026-09-10T10:00:00Z',
          updated_at: '2026-09-10T10:00:00Z',
        },
      ];

      const augSummary = calculateMonthSummary(catGroceries, allocations, transactions, '2026-08');
      expect(augSummary.allocated).toBe(1200000);
      expect(augSummary.spent).toBe(800000);

      const sepSummary = calculateMonthSummary(catGroceries, allocations, transactions, '2026-09');
      expect(sepSummary.allocated).toBe(1500000);
      expect(sepSummary.spent).toBe(600000);
    });
  });

  describe('FIFO Credit Card Reconciliation', () => {
    it('calculates pending debt strictly on credit_card transactions that are not deleted', () => {
      const txs: Transaction[] = [
        {
          id: 't_cc1',
          household_id: 'h1',
          category_id: catGroceries,
          amount: 400000,
          date: '2026-09-01',
          logged_by_user_id: 'u1',
          payment_method: 'credit_card',
          reconciliation_status: 'pending',
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 't_debit',
          household_id: 'h1',
          category_id: catGroceries,
          amount: 200000,
          date: '2026-09-02',
          logged_by_user_id: 'u1',
          payment_method: 'secondary_account_debit',
          reconciliation_status: 'n/a',
          created_at: '2026-09-02T10:00:00Z',
          updated_at: '2026-09-02T10:00:00Z',
        },
      ];

      const lines: ReconciliationLine[] = [];
      const debt = calculateCategoryPendingDebt(catGroceries, txs, lines);
      expect(debt.totalPendingDebt).toBe(400000);
      expect(debt.pendingTransactions.length).toBe(1);
    });

    it('executes FIFO settlement across multiple transactions in chronological order', () => {
      const txs: Transaction[] = [
        {
          id: 't_old',
          household_id: 'h1',
          category_id: catDining,
          amount: 150000, // ₹1,500
          date: '2026-09-01',
          logged_by_user_id: 'u1',
          payment_method: 'credit_card',
          reconciliation_status: 'pending',
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T08:00:00Z',
        },
        {
          id: 't_newer',
          household_id: 'h1',
          category_id: catDining,
          amount: 200000, // ₹2,000
          date: '2026-09-05',
          logged_by_user_id: 'u1',
          payment_method: 'credit_card',
          reconciliation_status: 'pending',
          created_at: '2026-09-05T08:00:00Z',
          updated_at: '2026-09-05T08:00:00Z',
        },
      ];

      // Pay off ₹2,500 (250000 paise): should fully settle t_old (150000) and partially settle t_newer (100000)
      const res = executeFifoReconciliation('rec_123', catDining, 250000, txs, []);

      expect(res.createdLines.length).toBe(2);
      expect(res.createdLines[0].transaction_id).toBe('t_old');
      expect(res.createdLines[0].amount_applied).toBe(150000);

      expect(res.createdLines[1].transaction_id).toBe('t_newer');
      expect(res.createdLines[1].amount_applied).toBe(100000);

      expect(res.transactionStatusUpdates).toEqual([
        { transactionId: 't_old', status: 'reconciled' },
        { transactionId: 't_newer', status: 'partially_reconciled' },
      ]);
    });

    it('accurately recomputes statuses across existing and updated reconciliation lines', () => {
      const txs: Transaction[] = [
        {
          id: 'tx_part',
          household_id: 'h1',
          category_id: catDining,
          amount: 300000,
          date: '2026-09-01',
          logged_by_user_id: 'u1',
          payment_method: 'credit_card',
          reconciliation_status: 'pending',
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T08:00:00Z',
        },
      ];

      const singleLine: ReconciliationLine[] = [
        {
          id: 'l1',
          reconciliation_id: 'r1',
          transaction_id: 'tx_part',
          amount_applied: 100000,
        },
      ];

      const statuses = recomputeTransactionStatuses(txs, singleLine);
      expect(statuses.get('tx_part')).toBe('partially_reconciled');

      const fullLines: ReconciliationLine[] = [
        ...singleLine,
        {
          id: 'l2',
          reconciliation_id: 'r2',
          transaction_id: 'tx_part',
          amount_applied: 200000,
        },
      ];

      const updatedStatuses = recomputeTransactionStatuses(txs, fullLines);
      expect(updatedStatuses.get('tx_part')).toBe('reconciled');
    });
  });
});
