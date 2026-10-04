import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  Household,
  Membership,
  Category,
  SalaryEvent,
  Allocation,
  Transaction,
  Reconciliation,
  ReconciliationLine,
  EnvelopeTransfer,
  PushSubscriptionSetting,
  PaymentMethod,
  ReconciliationStatus,
} from '../types';
import { INITIAL_HOUSEHOLD, INITIAL_MEMBERS, INITIAL_CATEGORIES } from '../data/initialData';
import { executeFifoReconciliation, recomputeTransactionStatuses } from '../utils/budgetLogic';
import { LedgerState, SyncState } from './types';
import { DEFAULT_HOUSEHOLD_DOC_ID, normalizeHouseholdDocId } from '../sync/householdIdentity';

const currentYearMonth = new Date().toISOString().slice(0, 7);

const initialPushSettings: PushSubscriptionSetting = {
  id: 'push_default',
  user_id: 'usr_me',
  reminder_time: '21:00',
  timezone: 'Asia/Kolkata',
  enabled: false,
  created_at: new Date().toISOString(),
};

export function sanitizeHousehold(hh: Household): Household {
  const name = (hh.name || '').trim();
  if (!name || /preview/i.test(name) || name === 'Our Household Ledger' || name.toLowerCase() === 'preview ledger') {
    return { ...hh, name: 'Family Budget' };
  }
  return hh;
}

const initialState: LedgerState = {
  household: sanitizeHousehold(INITIAL_HOUSEHOLD),
  members: INITIAL_MEMBERS,
  categories: INITIAL_CATEGORIES,
  salaryEvents: [],
  allocations: [],
  transactions: [],
  reconciliations: [],
  reconciliationLines: [],
  envelopeTransfers: [],
  selectedMonth: currentYearMonth,
  activeMemberId: 'usr_me',
  pushSettings: initialPushSettings,
  firstTimeIntroCompleted: false,

  householdId: DEFAULT_HOUSEHOLD_DOC_ID,
  syncStatus: 'idle',
  lastCloudSync: null,
  permissionDenied: false,
  isRemoteSync: false,
  lastResetAt: null,
};

export const ledgerSlice = createSlice({
  name: 'ledger',
  initialState,
  reducers: {
    // Household ID & Metadata
    setHouseholdId: (state, action: PayloadAction<string>) => {
      const normalizedHouseholdId = normalizeHouseholdDocId(action.payload);
      state.householdId = normalizedHouseholdId;
      state.household.id = normalizedHouseholdId;
    },
    setHousehold: (state, action: PayloadAction<Household>) => {
      const normalizedHouseholdId = normalizeHouseholdDocId(action.payload.id || state.householdId);
      state.householdId = normalizedHouseholdId;
      state.household = sanitizeHousehold({ ...action.payload, id: normalizedHouseholdId });
      if (action.payload.first_time_intro_completed) {
        state.firstTimeIntroCompleted = true;
      }
    },
    setActiveMemberId: (state, action: PayloadAction<string>) => {
      state.activeMemberId = action.payload;
    },
    setSelectedMonth: (state, action: PayloadAction<string>) => {
      state.selectedMonth = action.payload;
    },
    setSyncStatus: (state, action: PayloadAction<SyncState>) => {
      state.syncStatus = action.payload;
    },
    setLastCloudSync: (state, action: PayloadAction<string | null>) => {
      state.lastCloudSync = action.payload;
    },
    setPermissionDenied: (state, action: PayloadAction<boolean>) => {
      state.permissionDenied = action.payload;
    },
    setIsRemoteSync: (state, action: PayloadAction<boolean>) => {
      state.isRemoteSync = action.payload;
    },
    resetLedgerState: () => initialState,

    // Cache / LocalStorage Hydration
    hydrateFromStorage: (state, action: PayloadAction<Partial<LedgerState>>) => {
      const data = action.payload;
      const normalizedHouseholdId = normalizeHouseholdDocId(data.householdId || data.household?.id || state.householdId);
      state.householdId = normalizedHouseholdId;
      if (data.household) {
        state.household = sanitizeHousehold({ ...data.household, id: normalizedHouseholdId });
      } else {
        state.household.id = normalizedHouseholdId;
      }
      if (data.members && data.members.length > 0) state.members = data.members;
      if (data.categories && data.categories.length > 0) state.categories = data.categories;
      if (data.salaryEvents) state.salaryEvents = data.salaryEvents;
      if (data.allocations) state.allocations = data.allocations;
      if (data.transactions) state.transactions = data.transactions;
      if (data.reconciliations) state.reconciliations = data.reconciliations;
      if (data.reconciliationLines) state.reconciliationLines = data.reconciliationLines;
      if (data.envelopeTransfers) state.envelopeTransfers = data.envelopeTransfers;
      if (data.pushSettings) state.pushSettings = data.pushSettings;
      if (data.firstTimeIntroCompleted !== undefined) state.firstTimeIntroCompleted = data.firstTimeIntroCompleted;
      if (data.lastResetAt) state.lastResetAt = data.lastResetAt;
    },

    // Authoritative Cloud Snapshot
    remoteSnapshotReceived: (state, action: PayloadAction<any>) => {
      const data = action.payload;
      if (!data) return;
      const normalizedHouseholdId = normalizeHouseholdDocId(data.__householdDocId || data.householdId || data.household?.id || state.householdId);
      state.householdId = normalizedHouseholdId;

      if (data.household) {
        state.household = sanitizeHousehold({
          ...data.household,
          id: normalizedHouseholdId,
          owner_uid: data.owner_uid || data.household.owner_uid,
          owner_email: data.owner_email || data.household.owner_email,
          allowed_emails: Array.isArray(data.allowed_emails)
            ? data.allowed_emails
            : data.household.allowed_emails,
          created_by: data.created_by || data.household.created_by,
        });
      } else {
        state.household.id = normalizedHouseholdId;
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        state.categories = data.categories;
      }
      if (Array.isArray(data.salaryEvents)) {
        state.salaryEvents = data.salaryEvents;
      }
      if (Array.isArray(data.allocations)) {
        state.allocations = data.allocations;
      }
      if (Array.isArray(data.transactions)) {
        state.transactions = data.transactions;
      }
      if (Array.isArray(data.reconciliations)) {
        state.reconciliations = data.reconciliations;
      }
      if (Array.isArray(data.reconciliationLines)) {
        state.reconciliationLines = data.reconciliationLines;
      }
      if (Array.isArray(data.envelopeTransfers)) {
        state.envelopeTransfers = data.envelopeTransfers;
      }
      if (Array.isArray(data.members) && data.members.length > 0) {
        state.members = data.members;
      }
      if (data.first_time_intro_completed) {
        state.firstTimeIntroCompleted = true;
        state.household.first_time_intro_completed = true;
      }
      if (data.lastSyncedAt) {
        state.lastCloudSync = data.lastSyncedAt;
      }
      state.syncStatus = 'synced';
    },

    // Transactions CRUD
    addTransaction: (
      state,
      action: PayloadAction<{
        id?: string;
        categoryId: string;
        amount: number;
        paymentMethod: PaymentMethod;
        note?: string;
        date: string;
        loggedByUserId?: string;
      }>
    ) => {
      const { id, categoryId, amount, paymentMethod, note, date, loggedByUserId } = action.payload;
      const nowIso = new Date().toISOString();
      const newTx: Transaction = {
        id: id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        household_id: state.household.id,
        category_id: categoryId,
        amount,
        payment_method: paymentMethod,
        note: note ? note.trim() : undefined,
        date,
        logged_by_user_id: loggedByUserId || state.activeMemberId,
        reconciliation_status: paymentMethod === 'credit_card' ? 'pending' : 'n/a',
        created_at: nowIso,
        updated_at: nowIso,
      };
      state.transactions.unshift(newTx);
    },

    updateTransaction: (
      state,
      action: PayloadAction<{
        id: string;
        categoryId: string;
        amount: number;
        paymentMethod: PaymentMethod;
        note?: string;
        date: string;
      }>
    ) => {
      const { id, categoryId, amount, paymentMethod, note, date } = action.payload;
      const nowIso = new Date().toISOString();
      const tx = state.transactions.find(t => t.id === id);
      if (!tx) return;

      const trimmedNote = note ? note.trim() : undefined;
      const isSameFinancialBucket = tx.category_id === categoryId && tx.payment_method === paymentMethod;
      const amountDelta = amount - tx.amount;
      const metadataChanged = tx.date !== date || (tx.note || undefined) !== trimmedNote;
      const financialBucketChanged = !isSameFinancialBucket;
      const generatedSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nextStatus: ReconciliationStatus = paymentMethod === 'credit_card' ? 'pending' : 'n/a';

      if (!financialBucketChanged) {
        if (amountDelta === 0 && !metadataChanged) return;

        const adjustmentNote = trimmedNote ||
          (amountDelta === 0
            ? `Audit note update for transaction ${tx.id}`
            : `Amount adjustment for transaction ${tx.id}`);
        const adjustment: Transaction = {
          id: `tx_adj_${generatedSuffix}`,
          household_id: state.household.id,
          category_id: categoryId,
          amount: amountDelta,
          payment_method: paymentMethod,
          note: adjustmentNote,
          date,
          logged_by_user_id: tx.logged_by_user_id,
          reconciliation_status: 'n/a',
          created_at: nowIso,
          updated_at: nowIso,
          ledger_entry_type: 'adjustment',
          related_transaction_id: tx.id,
        };
        state.transactions.unshift(adjustment);
        return;
      }

      const reversal: Transaction = {
        id: `tx_rev_${generatedSuffix}`,
        household_id: state.household.id,
        category_id: tx.category_id,
        amount: -tx.amount,
        payment_method: tx.payment_method,
        note: `Reversal for transaction ${tx.id}`,
        date,
        logged_by_user_id: tx.logged_by_user_id,
        reconciliation_status: 'n/a',
        created_at: nowIso,
        updated_at: nowIso,
        ledger_entry_type: 'reversal',
        related_transaction_id: tx.id,
      };

      const replacement: Transaction = {
        id: `tx_repl_${generatedSuffix}`,
        household_id: state.household.id,
        category_id: categoryId,
        amount,
        payment_method: paymentMethod,
        note: trimmedNote || `Replacement for transaction ${tx.id}`,
        date,
        logged_by_user_id: tx.logged_by_user_id,
        reconciliation_status: nextStatus,
        created_at: nowIso,
        updated_at: nowIso,
        ledger_entry_type: 'replacement',
        related_transaction_id: tx.id,
      };

      state.transactions.unshift(replacement, reversal);
    },

    deleteTransaction: (state, action: PayloadAction<string>) => {
      const nowIso = new Date().toISOString();
      const tx = state.transactions.find(t => t.id === action.payload);
      if (!tx || tx.amount === 0) return;

      const relatedTransactionId =
        (tx.ledger_entry_type === 'adjustment' || tx.ledger_entry_type === 'reversal') && tx.related_transaction_id
          ? tx.related_transaction_id
          : tx.id;
      const reversal: Transaction = {
        id: `tx_del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        household_id: state.household.id,
        category_id: tx.category_id,
        amount: -tx.amount,
        payment_method: tx.payment_method,
        note: `Delete reversal for transaction ${tx.id}`,
        date: nowIso.split('T')[0],
        logged_by_user_id: tx.logged_by_user_id,
        reconciliation_status: 'n/a',
        created_at: nowIso,
        updated_at: nowIso,
        ledger_entry_type: 'reversal',
        related_transaction_id: relatedTransactionId,
      };
      state.transactions.unshift(reversal);
    },

    logCorrection: (
      state,
      action: PayloadAction<{
        categoryId: string;
        amountPaise: number;
        note: string;
        date?: string;
        loggedByUserId?: string;
      }>
    ) => {
      const { categoryId, amountPaise, note, date, loggedByUserId } = action.payload;
      const nowIso = new Date().toISOString();
      const newTx: Transaction = {
        id: `tx_corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        household_id: state.household.id,
        category_id: categoryId,
        amount: amountPaise,
        payment_method: 'secondary_account_debit',
        note: `[Correction] ${note.trim()}`,
        date: date || nowIso.split('T')[0],
        logged_by_user_id: loggedByUserId || state.activeMemberId,
        reconciliation_status: 'n/a',
        created_at: nowIso,
        updated_at: nowIso,
      };
      state.transactions.unshift(newTx);
    },

    // Salary & Allocations
    addSalaryAndAllocations: (
      state,
      action: PayloadAction<{
        salaryAmountPaise: number;
        date: string;
        earnerUserId: string;
        allocations: { categoryId: string; amountPaise: number }[];
      }>
    ) => {
      const { salaryAmountPaise, date, earnerUserId, allocations: inputAllocations } = action.payload;
      const nowIso = new Date().toISOString();
      const salaryId = `sal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const newSalaryEvent: SalaryEvent = {
        id: salaryId,
        household_id: state.household.id,
        earner_user_id: earnerUserId,
        amount: salaryAmountPaise,
        date,
        created_at: nowIso,
      };

      const newAllocations: Allocation[] = [];
      let totalAllocated = 0;

      for (const item of inputAllocations) {
        if (item.amountPaise > 0) {
          totalAllocated += item.amountPaise;
          newAllocations.push({
            id: `alloc_${salaryId}_${item.categoryId}`,
            salary_event_id: salaryId,
            category_id: item.categoryId,
            planned_amount: item.amountPaise,
            transferred: false,
            created_at: nowIso,
            updated_at: nowIso,
          });
        }
      }

      // Residual to unallocated
      const unallocatedAmount = Math.max(0, salaryAmountPaise - totalAllocated);
      const unallocatedCat = state.categories.find(c => c.is_unallocated);
      const unallocatedCatId = unallocatedCat?.id || 'cat_unallocated';

      if (unallocatedAmount > 0) {
        newAllocations.push({
          id: `alloc_${salaryId}_unallocated`,
          salary_event_id: salaryId,
          category_id: unallocatedCatId,
          planned_amount: unallocatedAmount,
          transferred: false,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }

      state.salaryEvents.unshift(newSalaryEvent);
      state.allocations = [...newAllocations, ...state.allocations];
    },

    toggleAllocationTransferred: (state, action: PayloadAction<string>) => {
      const nowIso = new Date().toISOString();
      const a = state.allocations.find(item => item.id === action.payload);
      if (a) {
        a.transferred = !a.transferred;
        a.transferred_at = a.transferred ? nowIso : null;
        a.updated_at = nowIso;
      }
    },

    markAllAllocationsTransferred: (state, action: PayloadAction<string | undefined>) => {
      const salaryEventId = action.payload;
      const nowIso = new Date().toISOString();
      for (const a of state.allocations) {
        if (salaryEventId && a.salary_event_id !== salaryEventId) continue;
        if (!a.transferred) {
          a.transferred = true;
          a.transferred_at = nowIso;
          a.updated_at = nowIso;
        }
      }
    },

    // Credit Card Reconciliations
    reconcileCategoryCardSpend: (
      state,
      action: PayloadAction<{
        categoryId: string;
        amountToPayPaise: number;
        date: string;
        loggedByUserId?: string;
        reconciliationId?: string;
      }>
    ) => {
      const { categoryId, amountToPayPaise, date, loggedByUserId, reconciliationId: customId } = action.payload;
      const nowIso = new Date().toISOString();
      const recId = customId || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const { createdLines, transactionStatusUpdates } = executeFifoReconciliation(
        recId,
        categoryId,
        amountToPayPaise,
        state.transactions,
        state.reconciliationLines
      );

      const newReconciliation: Reconciliation = {
        id: recId,
        household_id: state.household.id,
        category_id: categoryId,
        total_amount: amountToPayPaise,
        date,
        logged_by_user_id: loggedByUserId || state.activeMemberId,
        created_at: nowIso,
      };

      for (const update of transactionStatusUpdates) {
        const tx = state.transactions.find(t => t.id === update.transactionId);
        if (tx) {
          tx.reconciliation_status = update.status;
          tx.updated_at = nowIso;
        }
      }

      state.reconciliationLines.push(...createdLines);
      state.reconciliations.unshift(newReconciliation);
    },

    deleteReconciliation: (state, action: PayloadAction<string>) => {
      const reconciliationId = action.payload;
      const nowIso = new Date().toISOString();
      const rec = state.reconciliations.find(r => r.id === reconciliationId);
      if (!rec || rec.total_amount === 0) return;

      const reversalId = `rec_rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const reversal: Reconciliation = {
        id: reversalId,
        household_id: state.household.id,
        category_id: rec.category_id,
        total_amount: -rec.total_amount,
        date: nowIso.split('T')[0],
        logged_by_user_id: rec.logged_by_user_id,
        created_at: nowIso,
      };
      const reversalLines: ReconciliationLine[] = state.reconciliationLines
        .filter(line => line.reconciliation_id === reconciliationId)
        .map(line => ({
          id: `recline_rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          reconciliation_id: reversalId,
          transaction_id: line.transaction_id,
          amount_applied: -line.amount_applied,
        }));

      state.reconciliations.unshift(reversal);
      state.reconciliationLines.push(...reversalLines);

      const statusMap = recomputeTransactionStatuses(state.transactions, state.reconciliationLines);
      for (const tx of state.transactions) {
        const newStatus = statusMap.get(tx.id);
        if (newStatus) {
          tx.reconciliation_status = newStatus;
          tx.updated_at = nowIso;
        }
      }
    },

    // Envelope Transfers
    moveEnvelopeFunds: (
      state,
      action: PayloadAction<{
        fromCategoryId: string;
        toCategoryId: string;
        amountPaise: number;
        date?: string;
        note?: string;
        loggedByUserId?: string;
      }>
    ) => {
      const { fromCategoryId, toCategoryId, amountPaise, date, note, loggedByUserId } = action.payload;
      const nowIso = new Date().toISOString();
      const transferDate = date || nowIso.split('T')[0];
      const transferId = `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const newTransfer: EnvelopeTransfer = {
        id: transferId,
        household_id: state.household.id,
        from_category_id: fromCategoryId,
        to_category_id: toCategoryId,
        amount: amountPaise,
        date: transferDate,
        logged_by_user_id: loggedByUserId || state.activeMemberId,
        note: note ? note.trim() : undefined,
        created_at: nowIso,
      };

      const allocTo: Allocation = {
        id: `alloc_${transferId}_to`,
        salary_event_id: transferId,
        category_id: toCategoryId,
        planned_amount: amountPaise,
        transferred: true,
        transferred_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const allocFrom: Allocation = {
        id: `alloc_${transferId}_from`,
        salary_event_id: transferId,
        category_id: fromCategoryId,
        planned_amount: -amountPaise,
        transferred: true,
        transferred_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };

      state.allocations.unshift(allocTo, allocFrom);
      state.envelopeTransfers.unshift(newTransfer);
    },

    deleteEnvelopeTransfer: (state, action: PayloadAction<string>) => {
      const transferId = action.payload;
      const original = state.envelopeTransfers.find(t => t.id === transferId);
      if (!original || original.amount === 0) return;

      const nowIso = new Date().toISOString();
      const reversalId = `tr_rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const reversalTransfer: EnvelopeTransfer = {
        id: reversalId,
        household_id: state.household.id,
        from_category_id: original.to_category_id,
        to_category_id: original.from_category_id,
        amount: original.amount,
        date: nowIso.split('T')[0],
        logged_by_user_id: original.logged_by_user_id,
        note: `Reversal for transfer ${original.id}`,
        created_at: nowIso,
      };
      const allocToOriginalFrom: Allocation = {
        id: `alloc_${reversalId}_to_original_from`,
        salary_event_id: reversalId,
        category_id: original.from_category_id,
        planned_amount: original.amount,
        transferred: true,
        transferred_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };
      const allocFromOriginalTo: Allocation = {
        id: `alloc_${reversalId}_from_original_to`,
        salary_event_id: reversalId,
        category_id: original.to_category_id,
        planned_amount: -original.amount,
        transferred: true,
        transferred_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };

      state.envelopeTransfers.unshift(reversalTransfer);
      state.allocations.unshift(allocToOriginalFrom, allocFromOriginalTo);
    },

    // Direct Category Top-Up Funds
    addCategoryFunds: (
      state,
      action: PayloadAction<{
        categoryId: string;
        amountPaise: number;
        source?: string;
        note?: string;
        date?: string;
        depositHolding?: 'secondary_account' | 'cash' | 'primary_account';
        transferred?: boolean;
        loggedByUserId?: string;
      }>
    ) => {
      const {
        categoryId,
        amountPaise,
        source = 'Manual Top-Up',
        note,
        date,
        depositHolding = 'secondary_account',
        transferred: explicitTransferred,
        loggedByUserId,
      } = action.payload;

      const nowIso = new Date().toISOString();
      const entryDate = date || nowIso.split('T')[0];
      const topupId = `env_topup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const isTransferred = explicitTransferred !== undefined ? explicitTransferred : depositHolding !== 'primary_account';

      const newAllocation: Allocation = {
        id: `alloc_${topupId}`,
        salary_event_id: topupId,
        category_id: categoryId,
        planned_amount: amountPaise,
        transferred: isTransferred,
        transferred_at: isTransferred ? nowIso : null,
        created_at: entryDate ? `${entryDate}T12:00:00.000Z` : nowIso,
        updated_at: nowIso,
        source,
        note: note ? note.trim() : undefined,
        logged_by_user_id: loggedByUserId || state.activeMemberId,
        deposit_holding: depositHolding,
      };

      state.allocations.unshift(newAllocation);
    },

    deleteCategoryFunds: (state, action: PayloadAction<string>) => {
      const original = state.allocations.find(a => a.id === action.payload);
      if (!original || original.planned_amount === 0) return;

      const nowIso = new Date().toISOString();
      const reversal: Allocation = {
        id: `alloc_rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        salary_event_id: `env_reversal_${Date.now()}`,
        category_id: original.category_id,
        planned_amount: -original.planned_amount,
        transferred: original.transferred,
        transferred_at: original.transferred ? nowIso : null,
        created_at: nowIso,
        updated_at: nowIso,
        source: 'Reversal',
        note: `Reversal for top-up ${original.id}`,
        logged_by_user_id: original.logged_by_user_id || state.activeMemberId,
        deposit_holding: original.deposit_holding,
      };
      state.allocations.unshift(reversal);
    },

    // Categories CRUD
    createCategory: (
      state,
      action: PayloadAction<{
        name: string;
        icon: string;
        color: string;
        target_amount?: number;
      }>
    ) => {
      const { name, icon, color, target_amount } = action.payload;
      const trimmed = name.trim();
      const nowIso = new Date().toISOString();
      const newCat: Category = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        household_id: state.household.id,
        name: trimmed,
        icon,
        color,
        target_amount: target_amount && target_amount > 0 ? target_amount : undefined,
        is_archived: false,
        created_at: nowIso,
        updated_at: nowIso,
      };
      state.categories.push(newCat);
    },

    updateCategory: (
      state,
      action: PayloadAction<{
        id: string;
        updates: Partial<Category>;
      }>
    ) => {
      const { id, updates } = action.payload;
      const nowIso = new Date().toISOString();
      const cat = state.categories.find(c => c.id === id);
      if (cat) {
        Object.assign(cat, updates, { updated_at: nowIso });
      }
    },

    archiveCategory: (state, action: PayloadAction<string>) => {
      const nowIso = new Date().toISOString();
      const cat = state.categories.find(c => c.id === action.payload);
      if (cat) {
        cat.is_archived = true;
        cat.updated_at = nowIso;
      }
    },

    unarchiveCategory: (state, action: PayloadAction<string>) => {
      const nowIso = new Date().toISOString();
      const cat = state.categories.find(c => c.id === action.payload);
      if (cat) {
        cat.is_archived = false;
        cat.updated_at = nowIso;
      }
    },

    // Members & Profiles
    updateMemberName: (state, action: PayloadAction<{ userId: string; newName: string }>) => {
      const { userId, newName } = action.payload;
      const mem = state.members.find(m => m.user_id === userId);
      if (mem) {
        mem.name = newName.trim();
      }
    },

    updateMemberProfile: (
      state,
      action: PayloadAction<{
        userId: string;
        updates: { name?: string; avatar_url?: string; avatar_color?: string };
      }>
    ) => {
      const { userId, updates } = action.payload;
      const mem = state.members.find(m => m.user_id === userId);
      if (mem) {
        if (updates.name !== undefined) mem.name = updates.name.trim();
        if (updates.avatar_url !== undefined) mem.avatar_url = updates.avatar_url;
        if (updates.avatar_color !== undefined) mem.avatar_color = updates.avatar_color;
      }
    },

    deleteMember: (state, action: PayloadAction<string>) => {
      state.members = state.members.filter(m => m.user_id !== action.payload);
    },

    updatePushSettings: (
      state,
      action: PayloadAction<{ reminder_time: string; enabled: boolean }>
    ) => {
      state.pushSettings.reminder_time = action.payload.reminder_time;
      state.pushSettings.enabled = action.payload.enabled;
    },

    // ATOMIC ZERO RESET
    resetLedgerToZero: (
      state,
      action: PayloadAction<{ resetIso: string; userName?: string }>
    ) => {
      const { resetIso, userName } = action.payload;

      // 1. Wipe all transactional arrays completely
      state.salaryEvents = [];
      state.allocations = [];
      state.transactions = [];
      state.reconciliations = [];
      state.reconciliationLines = [];
      state.envelopeTransfers = [];

      // 2. Mark intro completed & set timestamps
      state.firstTimeIntroCompleted = true;
      state.lastResetAt = resetIso;
      state.household.name = 'Family Budget';
      state.household.first_time_intro_completed = true;
      state.household.first_time_intro_completed_at = resetIso;
      state.household.updated_at = resetIso;

      // 3. Update member name if provided
      if (userName) {
        const mem = state.members.find(m => m.user_id === 'usr_me');
        if (mem) mem.name = userName;
      }
    },
  },
});

export const ledgerActions = ledgerSlice.actions;
export const ledgerReducer = ledgerSlice.reducer;
