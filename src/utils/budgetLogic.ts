import { Allocation, Transaction, ReconciliationLine, ReconciliationStatus } from '../types';

/**
 * CategoryBalance (derived, "available now")
 * Specified in Plan v3 §3:
 *   sum(allocation.planned_amount where transferred and not deleted, this category)
 * - sum(transaction.amount where not deleted, this category)
 *
 * NOTE: Reconciliation NEVER appears in this formula.
 * A reconciliation moves money between bank accounts to pay off a credit card bill;
 * the envelope was already debited at the moment of the original Transaction.
 */
export function calculateCategoryBalance(
  categoryId: string,
  allocations: Allocation[],
  transactions: Transaction[]
): number {
  const totalAllocated = allocations
    .filter(a => a.category_id === categoryId && a.transferred && !a.deleted_at)
    .reduce((sum, a) => sum + a.planned_amount, 0);

  const totalSpent = transactions
    .filter(t => t.category_id === categoryId && !t.deleted_at)
    .reduce((sum, t) => sum + t.amount, 0);

  return totalAllocated - totalSpent;
}

/**
 * Calculate month-scoped informational numbers:
 * "This month: allocated ₹Y · spent ₹Z"
 * yearMonth format: 'YYYY-MM'
 */
export function calculateMonthSummary(
  categoryId: string,
  allocations: Allocation[],
  transactions: Transaction[],
  yearMonth: string
): { allocated: number; spent: number } {
  const monthAllocated = allocations
    .filter(a => {
      if (a.category_id !== categoryId || a.deleted_at) return false;
      const dateStr = a.created_at.slice(0, 7);
      return dateStr === yearMonth;
    })
    .reduce((sum, a) => sum + a.planned_amount, 0);

  const monthSpent = transactions
    .filter(t => {
      if (t.category_id !== categoryId || t.deleted_at) return false;
      const dateStr = t.date.slice(0, 7);
      return dateStr === yearMonth;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  return { allocated: monthAllocated, spent: monthSpent };
}

/**
 * Compute outstanding unreconciled card debt for a category
 */
export function calculateCategoryPendingDebt(
  categoryId: string,
  transactions: Transaction[],
  lines: ReconciliationLine[]
): {
  totalPendingDebt: number;
  pendingTransactions: (Transaction & { outstandingPaise: number })[];
} {
  // Only non-deleted credit_card transactions that are pending or partially_reconciled
  const candidateTxs = transactions.filter(
    t =>
      t.category_id === categoryId &&
      !t.deleted_at &&
      t.payment_method === 'credit_card' &&
      (t.reconciliation_status === 'pending' || t.reconciliation_status === 'partially_reconciled')
  );

  // Sort oldest first (FIFO)
  candidateTtxsSorted(candidateTxs);

  const pendingWithOutstanding = candidateTxs.map(t => {
    const appliedLines = lines.filter(l => l.transaction_id === t.id);
    const totalApplied = appliedLines.reduce((sum, l) => sum + l.amount_applied, 0);
    const outstanding = Math.max(0, t.amount - totalApplied);
    return {
      ...t,
      outstandingPaise: outstanding,
    };
  }).filter(t => t.outstandingPaise > 0);

  const totalPendingDebt = pendingWithOutstanding.reduce((sum, t) => sum + t.outstandingPaise, 0);

  return { totalPendingDebt, pendingTransactions: pendingWithOutstanding };
}

function candidateTtxsSorted(txs: Transaction[]) {
  txs.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return a.created_at.localeCompare(b.created_at);
  });
}

/**
 * FIFO Reconciliation Matcher (§4.4)
 * Applies a payoff amount against pending transactions, oldest date first.
 * For each: apply min(remaining, outstanding), write ReconciliationLine.
 * Updates status to reconciled or partially_reconciled.
 */
export function executeFifoReconciliation(
  reconciliationId: string,
  categoryId: string,
  amountToPay: number, // in integer paise
  transactions: Transaction[],
  existingLines: ReconciliationLine[]
): {
  createdLines: ReconciliationLine[];
  transactionStatusUpdates: { transactionId: string; status: ReconciliationStatus }[];
} {
  const { pendingTransactions } = calculateCategoryPendingDebt(categoryId, transactions, existingLines);

  let remainingToPay = amountToPay;
  const createdLines: ReconciliationLine[] = [];
  const transactionStatusUpdates: { transactionId: string; status: ReconciliationStatus }[] = [];

  for (const tx of pendingTransactions) {
    if (remainingToPay <= 0) break;

    const applyAmount = Math.min(remainingToPay, tx.outstandingPaise);
    if (applyAmount <= 0) continue;

    const line: ReconciliationLine = {
      id: `recline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      reconciliation_id: reconciliationId,
      transaction_id: tx.id,
      amount_applied: applyAmount,
    };
    createdLines.push(line);

    remainingToPay -= applyAmount;

    // Check if fully satisfied
    const totalWillBeApplied = (tx.amount - tx.outstandingPaise) + applyAmount;
    const newStatus: ReconciliationStatus =
      totalWillBeApplied >= tx.amount ? 'reconciled' : 'partially_reconciled';

    transactionStatusUpdates.push({
      transactionId: tx.id,
      status: newStatus,
    });
  }

  return { createdLines, transactionStatusUpdates };
}

/**
 * Recomputes transaction reconciliation statuses after a Reconciliation or Transaction is deleted/altered
 */
export function recomputeTransactionStatuses(
  transactions: Transaction[],
  reconciliationLines: ReconciliationLine[]
): Map<string, ReconciliationStatus> {
  const statusMap = new Map<string, ReconciliationStatus>();

  for (const tx of transactions) {
    if (tx.payment_method !== 'credit_card') {
      statusMap.set(tx.id, 'n/a');
      continue;
    }

    const lines = reconciliationLines.filter(l => l.transaction_id === tx.id);
    const totalApplied = lines.reduce((sum, l) => sum + l.amount_applied, 0);

    if (totalApplied <= 0) {
      statusMap.set(tx.id, 'pending');
    } else if (totalApplied >= tx.amount) {
      statusMap.set(tx.id, 'reconciled');
    } else {
      statusMap.set(tx.id, 'partially_reconciled');
    }
  }

  return statusMap;
}
