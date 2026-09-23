import {
  Transaction,
  SalaryEvent,
  Reconciliation,
  ReconciliationLine,
  EnvelopeTransfer,
  Category,
  Membership,
  PaymentMethod,
  ReconciliationStatus,
  Allocation,
} from '../types';

export type LedgerEntryType = 'spend' | 'salary_credit' | 'reconcile' | 'fund_move' | 'category_topup';

export interface UnifiedLedgerEntry {
  id: string;
  type: LedgerEntryType;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO string
  amountPaise: number; // Signed: negative for spend (or positive if refund), positive for salary, positive for reconcile / fund move / top-up
  
  // Categorization
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;

  // Specific to Fund Moves (Envelopes)
  fromCategoryId?: string;
  fromCategoryName?: string;
  fromCategoryIcon?: string;
  fromCategoryColor?: string;
  toCategoryId?: string;
  toCategoryName?: string;
  toCategoryIcon?: string;
  toCategoryColor?: string;

  // Actor / Logged by
  loggedByUserId: string;
  loggedByName: string;
  loggedByAvatarColor: string;

  // Text representation
  title: string;
  subtitle: string;
  note?: string;

  // Spends
  paymentMethod?: PaymentMethod;
  reconciliationStatus?: ReconciliationStatus;

  // Reconcile
  reconciliationLinesCount?: number;

  // Category Top-Up
  topupSource?: string;
  depositHolding?: 'secondary_account' | 'cash' | 'primary_account';
  transferred?: boolean;
  allocationId?: string;

  // Raw source object
  raw: Transaction | SalaryEvent | Reconciliation | EnvelopeTransfer | Allocation;
}

export interface LedgerFilterOptions {
  selectedMonth?: string; // YYYY-MM
  timeframe?: 'current_month' | 'all';
  typeFilter?: 'all' | LedgerEntryType;
  categoryFilter?: string; // category_id or 'all'
  memberFilter?: string; // user_id or 'all'
  paymentMethodFilter?: string; // 'all' | PaymentMethod
  reconciliationStatusFilter?: string; // 'all' | ReconciliationStatus
  searchQuery?: string;
}

export interface LedgerSummaryStats {
  totalCount: number;
  spendCount: number;
  salaryCount: number;
  reconcileCount: number;
  fundMoveCount: number;
  topupCount: number;
  totalSpentPaise: number;
  totalSalaryPaise: number;
  totalReconciledPaise: number;
  totalMovedPaise: number;
  totalTopupPaise: number;
}

/**
 * Builds a unified list of ledger entries across spends, salary credits, reconciliations, fund moves, and category top-ups.
 */
export function buildUnifiedLedger(
  transactions: Transaction[],
  salaryEvents: SalaryEvent[],
  reconciliations: Reconciliation[],
  reconciliationLines: ReconciliationLine[],
  envelopeTransfers: EnvelopeTransfer[],
  categories: Category[],
  members: Membership[],
  options: LedgerFilterOptions = {},
  allocations: Allocation[] = []
): { entries: UnifiedLedgerEntry[]; stats: LedgerSummaryStats } {
  const {
    selectedMonth,
    timeframe = 'current_month',
    typeFilter = 'all',
    categoryFilter = 'all',
    memberFilter = 'all',
    paymentMethodFilter = 'all',
    reconciliationStatusFilter = 'all',
    searchQuery = '',
  } = options;

  const categoryMap = new Map<string, Category>(categories.map(c => [c.id, c]));
  const memberMap = new Map<string, Membership>(members.map(m => [m.user_id, m]));

  const allEntries: UnifiedLedgerEntry[] = [];

  // 1. Process Spends (Transactions)
  for (const tx of transactions) {
    if (tx.deleted_at) continue;
    const cat = categoryMap.get(tx.category_id);
    const member = memberMap.get(tx.logged_by_user_id);

    allEntries.push({
      id: `tx_${tx.id}`,
      type: 'spend',
      date: tx.date,
      timestamp: tx.created_at || tx.date,
      amountPaise: tx.amount, // Positive for spend, negative for refund in raw Transaction
      categoryId: tx.category_id,
      categoryName: cat?.name || 'General Expense',
      categoryIcon: cat?.icon || 'Wallet',
      categoryColor: cat?.color || '#78716C',
      loggedByUserId: tx.logged_by_user_id,
      loggedByName: member?.name || 'Household Member',
      loggedByAvatarColor: member?.avatar_color || '#78716C',
      title: tx.note || cat?.name || 'Expense',
      subtitle: `${cat?.name || 'Envelope'} • ${tx.payment_method.replace(/_/g, ' ')}`,
      note: tx.note,
      paymentMethod: tx.payment_method,
      reconciliationStatus: tx.reconciliation_status,
      raw: tx,
    });
  }

  // 2. Process Salary Credits (SalaryEvent)
  for (const sal of salaryEvents) {
    const earner = memberMap.get(sal.earner_user_id);

    allEntries.push({
      id: `sal_${sal.id}`,
      type: 'salary_credit',
      date: sal.date,
      timestamp: sal.created_at || sal.date,
      amountPaise: sal.amount,
      loggedByUserId: sal.earner_user_id,
      loggedByName: earner?.name || 'Earner',
      loggedByAvatarColor: earner?.avatar_color || '#4E785E',
      title: `Salary Credit (${earner?.name || 'Primary'})`,
      subtitle: 'Deposited to Primary Salary Account',
      note: 'Monthly salary inflow received into household account',
      raw: sal,
    });
  }

  // 3. Process Reconciliations (Credit card settlements)
  for (const rec of reconciliations) {
    if (rec.deleted_at) continue;
    const cat = categoryMap.get(rec.category_id);
    const member = memberMap.get(rec.logged_by_user_id);
    const linesCount = reconciliationLines.filter(l => l.reconciliation_id === rec.id).length;

    allEntries.push({
      id: `rec_${rec.id}`,
      type: 'reconcile',
      date: rec.date,
      timestamp: rec.created_at || rec.date,
      amountPaise: rec.total_amount,
      categoryId: rec.category_id,
      categoryName: cat?.name || 'Credit Card Payoff',
      categoryIcon: cat?.icon || 'CreditCard',
      categoryColor: cat?.color || '#B85D43',
      loggedByUserId: rec.logged_by_user_id,
      loggedByName: member?.name || 'Household Member',
      loggedByAvatarColor: member?.avatar_color || '#B85D43',
      title: `Credit Card Payback (${cat?.name || 'Card'})`,
      subtitle: 'Spend A/c → Primary Salary A/c (CC Settle)',
      note: `Settled ${linesCount} card transaction${linesCount === 1 ? '' : 's'}`,
      reconciliationLinesCount: linesCount,
      raw: rec,
    });
  }

  // 4. Process Fund Moves (Envelope Transfers)
  for (const tr of envelopeTransfers) {
    const fromCat = categoryMap.get(tr.from_category_id);
    const toCat = categoryMap.get(tr.to_category_id);
    const member = memberMap.get(tr.logged_by_user_id);

    allEntries.push({
      id: `move_${tr.id}`,
      type: 'fund_move',
      date: tr.date,
      timestamp: tr.created_at || tr.date,
      amountPaise: tr.amount,
      fromCategoryId: tr.from_category_id,
      fromCategoryName: fromCat?.name || 'Source Envelope',
      fromCategoryIcon: fromCat?.icon || 'Folder',
      fromCategoryColor: fromCat?.color || '#78716C',
      toCategoryId: tr.to_category_id,
      toCategoryName: toCat?.name || 'Destination Envelope',
      toCategoryIcon: toCat?.icon || 'Folder',
      toCategoryColor: toCat?.color || '#4E785E',
      loggedByUserId: tr.logged_by_user_id,
      loggedByName: member?.name || 'Household Member',
      loggedByAvatarColor: member?.avatar_color || '#AF7832',
      title: `Envelope Transfer: ${fromCat?.name || 'From'} → ${toCat?.name || 'To'}`,
      subtitle: `${fromCat?.name || 'Envelope'} reallocated to ${toCat?.name || 'Envelope'}`,
      note: tr.note,
      raw: tr,
    });
  }

  // 5. Process Direct Envelope Top-Ups (non-salary additions)
  for (const alloc of allocations) {
    if (alloc.deleted_at) continue;
    // Topups have salary_event_id starting with 'topup_' or 'env_topup_' or have source defined
    const isTopup =
      alloc.salary_event_id?.startsWith('topup_') ||
      alloc.salary_event_id?.startsWith('env_topup_') ||
      Boolean(alloc.source);
    if (!isTopup) continue;

    const cat = categoryMap.get(alloc.category_id);
    const member = memberMap.get(alloc.logged_by_user_id || '');
    const entryDate = alloc.created_at.slice(0, 10);

    allEntries.push({
      id: `topup_${alloc.id}`,
      type: 'category_topup',
      date: entryDate,
      timestamp: alloc.created_at,
      amountPaise: alloc.planned_amount,
      categoryId: alloc.category_id,
      categoryName: cat?.name || 'Envelope',
      categoryIcon: cat?.icon || 'Wallet',
      categoryColor: cat?.color || '#2C523B',
      loggedByUserId: alloc.logged_by_user_id || members[0]?.user_id || '',
      loggedByName: member?.name || 'Household Member',
      loggedByAvatarColor: member?.avatar_color || '#2C523B',
      title: `Top-Up: ${cat?.name || 'Envelope'}`,
      subtitle: `${alloc.source || 'Direct Deposit'} • ${alloc.transferred ? 'Available' : 'Pending Transfer'}`,
      note: alloc.note,
      topupSource: alloc.source || 'Manual Top-Up',
      depositHolding: alloc.deposit_holding,
      transferred: alloc.transferred,
      allocationId: alloc.id,
      raw: alloc,
    });
  }

  // Calculate overall stats before filter (or stats on current dataset)
  // Let's filter first by timeframe and criteria
  const query = searchQuery.trim().toLowerCase();

  // Compute tab summary stats across entries matching all contextual filters EXCEPT typeFilter,
  // so when a user switches tabs/pills (e.g. fund moves), the other tab counts (spends, salary, etc.) remain visible and accurate.
  const stats: LedgerSummaryStats = {
    totalCount: 0,
    spendCount: 0,
    salaryCount: 0,
    reconcileCount: 0,
    fundMoveCount: 0,
    topupCount: 0,
    totalSpentPaise: 0,
    totalSalaryPaise: 0,
    totalReconciledPaise: 0,
    totalMovedPaise: 0,
    totalTopupPaise: 0,
  };

  const filteredEntries: UnifiedLedgerEntry[] = [];

  for (const entry of allEntries) {
    // Timeframe filter
    if (timeframe === 'current_month' && selectedMonth) {
      if (entry.date.slice(0, 7) !== selectedMonth) continue;
    }

    // Category / Envelope filter
    if (categoryFilter !== 'all') {
      if (entry.type === 'spend' || entry.type === 'reconcile' || entry.type === 'category_topup') {
        if (entry.categoryId !== categoryFilter) continue;
      } else if (entry.type === 'fund_move') {
        if (entry.fromCategoryId !== categoryFilter && entry.toCategoryId !== categoryFilter) {
          continue;
        }
      } else if (entry.type === 'salary_credit') {
        // Salary credits do not belong to a single envelope; filter out if specific envelope is picked
        continue;
      }
    }

    // Member filter
    if (memberFilter !== 'all') {
      if (entry.loggedByUserId !== memberFilter) continue;
    }

    // Payment method filter (only affects spends; non-spends excluded if specific method picked)
    if (paymentMethodFilter !== 'all') {
      if (entry.type !== 'spend' || entry.paymentMethod !== paymentMethodFilter) {
        continue;
      }
    }

    // Card reconciliation status filter (only affects credit card spends)
    if (reconciliationStatusFilter !== 'all') {
      if (entry.type !== 'spend' || entry.reconciliationStatus !== reconciliationStatusFilter) {
        continue;
      }
    }

    // Search query filter
    if (query) {
      const matchTitle = entry.title.toLowerCase().includes(query);
      const matchSubtitle = entry.subtitle.toLowerCase().includes(query);
      const matchNote = (entry.note || '').toLowerCase().includes(query);
      const matchCat = (entry.categoryName || '').toLowerCase().includes(query);
      const matchFrom = (entry.fromCategoryName || '').toLowerCase().includes(query);
      const matchTo = (entry.toCategoryName || '').toLowerCase().includes(query);
      const matchMember = entry.loggedByName.toLowerCase().includes(query);
      const matchAmount = (Math.abs(entry.amountPaise) / 100).toString().includes(query);
      const matchType = entry.type.toLowerCase().includes(query);
      const matchSource = (entry.topupSource || '').toLowerCase().includes(query);

      if (
        !matchTitle &&
        !matchSubtitle &&
        !matchNote &&
        !matchCat &&
        !matchFrom &&
        !matchTo &&
        !matchMember &&
        !matchAmount &&
        !matchType &&
        !matchSource
      ) {
        continue;
      }
    }

    // This entry matches all current search, timeframe, envelope, member, and method criteria.
    // Record into global category stats:
    stats.totalCount++;
    if (entry.type === 'spend') {
      stats.spendCount++;
      stats.totalSpentPaise += entry.amountPaise;
    } else if (entry.type === 'salary_credit') {
      stats.salaryCount++;
      stats.totalSalaryPaise += entry.amountPaise;
    } else if (entry.type === 'reconcile') {
      stats.reconcileCount++;
      stats.totalReconciledPaise += entry.amountPaise;
    } else if (entry.type === 'fund_move') {
      stats.fundMoveCount++;
      stats.totalMovedPaise += entry.amountPaise;
    } else if (entry.type === 'category_topup') {
      stats.topupCount++;
      stats.totalTopupPaise += entry.amountPaise;
    }

    // Now check if it matches the selected type filter for the rendered ledger list
    if (typeFilter === 'all' || entry.type === typeFilter) {
      filteredEntries.push(entry);
    }
  }

  // Sort descending: Date first, then timestamp
  filteredEntries.sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return b.timestamp.localeCompare(a.timestamp);
  });

  return {
    entries: filteredEntries,
    stats,
  };
}
