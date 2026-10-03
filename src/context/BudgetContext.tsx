import React, { createContext, useContext, useEffect, useMemo, ReactNode, useCallback } from 'react';
import { Provider } from 'react-redux';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { useApiLoading } from './ApiLoadingContext';
import { store, useAppDispatch, useAppSelector } from '../store';
import { ledgerActions } from '../store/ledgerSlice';
import {
  selectHousehold,
  selectMembers,
  selectActiveMember,
  selectCategories,
  selectActiveCategories,
  selectSalaryEvents,
  selectAllocations,
  selectTransactions,
  selectReconciliations,
  selectReconciliationLines,
  selectEnvelopeTransfers,
  selectInvites,
  selectSelectedMonth,
  selectCategoryBalances,
  selectTotalAvailablePaise,
  selectTotalPendingPaybackPaise,
  selectPendingTransfersList,
  selectPushSettings,
  selectFirstTimeIntroCompleted,
  selectHouseholdId,
  selectSyncStatus,
  selectLastCloudSync,
  selectPermissionDenied,
} from '../store/selectors';
import {
  STORAGE_KEYS,
  subscribeToFirestoreHousehold,
  flushSyncNow,
} from '../store/syncMiddleware';
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
  Invite,
  PushSubscriptionSetting,
  CategoryBalanceInfo,
} from '../types';

export interface BudgetContextType {
  household: Household;
  members: Membership[];
  activeMember: Membership;
  categories: Category[];
  activeCategories: Category[];
  salaryEvents: SalaryEvent[];
  allocations: Allocation[];
  transactions: Transaction[];
  reconciliations: Reconciliation[];
  reconciliationLines: ReconciliationLine[];
  invites: Invite[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  categoryBalances: CategoryBalanceInfo[];
  totalAvailablePaise: number;
  totalPendingPaybackPaise: number;
  pendingTransfersList: (Allocation & { categoryName: string; categoryIcon: string; categoryColor: string })[];
  pushSettings: PushSubscriptionSetting;

  // Actions
  setActiveMemberId: (id: string) => void;
  addTransaction: (tx: {
    category_id: string;
    amount: number;
    date: string;
    payment_method: Transaction['payment_method'];
    note?: string;
  }) => Transaction;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  logCorrection: (originalTx: Transaction, differencePaise: number, note?: string) => Transaction;

  addSalaryAndAllocations: (
    earnerUserId: string,
    amountPaise: number,
    date: string,
    allocationsList: { categoryId: string; amountPaise: number }[]
  ) => { salaryEvent: SalaryEvent; allocations: Allocation[] };

  toggleAllocationTransferred: (allocationId: string) => void;
  markAllAllocationsTransferred: (salaryEventId?: string) => void;

  reconcileCategoryCardSpend: (
    categoryId: string,
    amountToPayPaise: number,
    date: string
  ) => { reconciliation: Reconciliation; lines: ReconciliationLine[] };
  deleteReconciliation: (reconciliationId: string) => void;

  envelopeTransfers: EnvelopeTransfer[];
  moveEnvelopeFunds: (params: {
    fromCategoryId: string;
    toCategoryId: string;
    amountPaise: number;
    date?: string;
    note?: string;
  }) => { success: boolean; error?: string; transfer?: EnvelopeTransfer };
  deleteEnvelopeTransfer: (transferId: string) => void;

  addCategoryFunds: (params: {
    categoryId: string;
    amountPaise: number;
    source?: string;
    note?: string;
    date?: string;
    depositHolding?: 'secondary_account' | 'cash' | 'primary_account';
    transferred?: boolean;
    loggedByUserId?: string;
  }) => { success: boolean; error?: string; allocation?: Allocation };
  deleteCategoryFunds: (allocationId: string) => void;

  createCategory: (name: string, icon: string, color: string, target_amount?: number) => { success: boolean; error?: string };
  updateCategory: (id: string, updates: Partial<Category>) => { success: boolean; error?: string };
  archiveCategory: (id: string) => void;
  unarchiveCategory: (id: string) => void;

  updateMemberName: (userId: string, newName: string) => void;
  updateMemberProfile: (
    userId: string,
    updates: { name?: string; avatar_url?: string; avatar_color?: string }
  ) => void;
  deleteMember: (userId: string) => { success: boolean; error?: string };
  createInvite: () => Invite;
  revokeInvite: (inviteId: string) => void;
  updatePushSettings: (time: string, enabled: boolean) => void;
  resetLedgerToZero: (isFirstTimeIntro?: boolean) => Promise<void>;
  isFirstTimeIntroCompleted: boolean;

  // Cloud & Cross-Device Synchronization
  householdId: string;
  cloudSyncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  lastCloudSync: string | null;
  syncNow: () => Promise<void>;

  // Google Account Allowlist & Access Control
  isAccessAllowed: boolean;
  authLoading: boolean;
  accessBlockedReason: 'none' | 'auth_required' | 'not_in_allowlist';
  isOwner: boolean;
  addAllowedEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  removeAllowedEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

const BudgetProviderContent: React.FC<{ children: ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { user, loading: authLoading, householdId: authHouseholdId, setSyncStatus: setAuthSyncStatus } = useAuth();
  const { startApiCall } = useApiLoading();

  // Redux Selectors
  const household = useAppSelector(selectHousehold);
  const members = useAppSelector(selectMembers);
  const activeMember = useAppSelector(selectActiveMember);
  const categories = useAppSelector(selectCategories);
  const activeCategories = useAppSelector(selectActiveCategories);
  const salaryEvents = useAppSelector(selectSalaryEvents);
  const allocations = useAppSelector(selectAllocations);
  const transactions = useAppSelector(selectTransactions);
  const reconciliations = useAppSelector(selectReconciliations);
  const reconciliationLines = useAppSelector(selectReconciliationLines);
  const envelopeTransfers = useAppSelector(selectEnvelopeTransfers);
  const invites = useAppSelector(selectInvites);
  const selectedMonth = useAppSelector(selectSelectedMonth);
  const categoryBalances = useAppSelector(selectCategoryBalances);
  const totalAvailablePaise = useAppSelector(selectTotalAvailablePaise);
  const totalPendingPaybackPaise = useAppSelector(selectTotalPendingPaybackPaise);
  const pendingTransfersList = useAppSelector(selectPendingTransfersList);
  const pushSettings = useAppSelector(selectPushSettings);
  const isFirstTimeIntroCompleted = useAppSelector(selectFirstTimeIntroCompleted);
  const householdId = useAppSelector(selectHouseholdId);
  const syncStatus = useAppSelector(selectSyncStatus);
  const lastCloudSync = useAppSelector(selectLastCloudSync);
  const permissionDenied = useAppSelector(selectPermissionDenied);

  // Sync auth household ID with Redux store
  useEffect(() => {
    if (authHouseholdId && authHouseholdId !== householdId) {
      dispatch(ledgerActions.setHouseholdId(authHouseholdId));
    }
  }, [authHouseholdId, householdId, dispatch]);

  // Keep auth sync status in sync
  useEffect(() => {
    if (syncStatus === 'syncing' || syncStatus === 'synced' || syncStatus === 'offline' || syncStatus === 'error') {
      setAuthSyncStatus(syncStatus);
    }
  }, [syncStatus, setAuthSyncStatus]);

  // 1. Initial Storage Hydration on Mount
  useEffect(() => {
    try {
      const savedHh = localStorage.getItem(STORAGE_KEYS.HOUSEHOLD);
      const savedCats = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      const savedSal = localStorage.getItem(STORAGE_KEYS.SALARY_EVENTS);
      const savedAllocs = localStorage.getItem(STORAGE_KEYS.ALLOCATIONS);
      const savedTxs = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      const savedRecs = localStorage.getItem(STORAGE_KEYS.RECONCILIATIONS);
      const savedLines = localStorage.getItem(STORAGE_KEYS.RECONCILIATION_LINES);
      const savedTrs = localStorage.getItem(STORAGE_KEYS.ENVELOPE_TRANSFERS);
      const savedMems = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      const savedInvs = localStorage.getItem(STORAGE_KEYS.INVITES);
      const savedPush = localStorage.getItem(STORAGE_KEYS.PUSH_SETTINGS);
      const lastReset = localStorage.getItem('env_budget_last_reset_timestamp');
      const introDone = localStorage.getItem('env_budget_first_time_intro_done') === 'true';

      dispatch(
        ledgerActions.hydrateFromStorage({
          household: savedHh ? JSON.parse(savedHh) : undefined,
          categories: savedCats ? JSON.parse(savedCats) : undefined,
          salaryEvents: savedSal ? JSON.parse(savedSal) : undefined,
          allocations: savedAllocs ? JSON.parse(savedAllocs) : undefined,
          transactions: savedTxs ? JSON.parse(savedTxs) : undefined,
          reconciliations: savedRecs ? JSON.parse(savedRecs) : undefined,
          reconciliationLines: savedLines ? JSON.parse(savedLines) : undefined,
          envelopeTransfers: savedTrs ? JSON.parse(savedTrs) : undefined,
          members: savedMems ? JSON.parse(savedMems) : undefined,
          invites: savedInvs ? JSON.parse(savedInvs) : undefined,
          pushSettings: savedPush ? JSON.parse(savedPush) : undefined,
          firstTimeIntroCompleted: introDone,
          lastResetAt: lastReset,
        })
      );
    } catch (e) {
      console.warn('Initial storage hydration note:', e);
    }
  }, [dispatch]);

  // 2. Google Account Allowlist & Access Control verification
  const { isAccessAllowed, accessBlockedReason, isOwner } = useMemo(() => {
    if (
      !householdId ||
      householdId === 'hh_family_ledger_main' ||
      householdId.startsWith('hh_demo') ||
      householdId.startsWith('hh_preview')
    ) {
      return {
        isAccessAllowed: true,
        accessBlockedReason: 'none' as const,
        isOwner: true,
      };
    }

    if (authLoading) {
      return {
        isAccessAllowed: true,
        accessBlockedReason: 'none' as const,
        isOwner: false,
      };
    }

    if (!user) {
      return {
        isAccessAllowed: false,
        accessBlockedReason: 'auth_required' as const,
        isOwner: false,
      };
    }

    if (permissionDenied) {
      return {
        isAccessAllowed: false,
        accessBlockedReason: 'not_in_allowlist' as const,
        isOwner: false,
      };
    }

    const currentEmail = (user.email || '').trim().toLowerCase();
    const ownerEmail = (household.owner_email || '').trim().toLowerCase();
    const allowedEmails = (household.allowed_emails || []).map(e => e.trim().toLowerCase());
    const hasRestrictions = Boolean(ownerEmail || allowedEmails.length > 0);

    if (!hasRestrictions) {
      return {
        isAccessAllowed: true,
        accessBlockedReason: 'none' as const,
        isOwner: true,
      };
    }

    const isCurrentOwner = (ownerEmail && currentEmail === ownerEmail) || (household.created_by && user.uid === household.created_by);
    const isCurrentAllowed = allowedEmails.includes(currentEmail);

    if (isCurrentOwner || isCurrentAllowed) {
      return {
        isAccessAllowed: true,
        accessBlockedReason: 'none' as const,
        isOwner: Boolean(isCurrentOwner),
      };
    }

    return {
      isAccessAllowed: false,
      accessBlockedReason: 'not_in_allowlist' as const,
      isOwner: false,
    };
  }, [household, householdId, user, permissionDenied, authLoading]);

  // 3. Realtime Firestore Subscription
  useEffect(() => {
    if (!householdId || !isAccessAllowed) return;
    const unsubscribe = subscribeToFirestoreHousehold(householdId, user?.email, dispatch);
    return () => {
      unsubscribe();
    };
  }, [householdId, isAccessAllowed, user?.email, dispatch]);

  // 4. If user signs into a household with no established owner, claim ownership
  useEffect(() => {
    if (!user || !user.email) return;
    const email = user.email.trim().toLowerCase();

    if (!household.owner_email && (!household.allowed_emails || household.allowed_emails.length === 0)) {
      dispatch(
        ledgerActions.setHousehold({
          ...household,
          owner_email: email,
          allowed_emails: [email],
          created_by: user.uid,
          updated_at: new Date().toISOString(),
        })
      );
    }
  }, [user, household, dispatch]);

  // 5. Auto-sync Google user profile into household members roster
  useEffect(() => {
    if (!user || !isAccessAllowed) return;
    const uid = user.uid;

    try {
      const deletedList: string[] = JSON.parse(
        localStorage.getItem('env_budget_deleted_members') || '[]'
      );
      if (deletedList.includes(uid)) return;
    } catch {}

    const name = user.displayName || user.email?.split('@')[0] || 'User';
    const avatar_url = user.photoURL || undefined;

    const existing = members.find(m => m.user_id === uid);
    if (!existing) {
      dispatch(
        ledgerActions.updateMemberProfile({
          userId: uid,
          updates: { name, avatar_url },
        })
      );
    }
  }, [user, isAccessAllowed, members, dispatch]);

  // Actions Facade
  const setSelectedMonthHandler = useCallback((month: string) => {
    dispatch(ledgerActions.setSelectedMonth(month));
  }, [dispatch]);

  const setActiveMemberIdHandler = useCallback((id: string) => {
    dispatch(ledgerActions.setActiveMemberId(id));
  }, [dispatch]);

  const addTransactionHandler = useCallback((data: {
    category_id: string;
    amount: number;
    date: string;
    payment_method: Transaction['payment_method'];
    note?: string;
  }): Transaction => {
    const newId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    dispatch(
      ledgerActions.addTransaction({
        id: newId,
        categoryId: data.category_id,
        amount: data.amount,
        paymentMethod: data.payment_method,
        note: data.note,
        date: data.date,
        loggedByUserId: activeMember.user_id,
      })
    );

    const nowIso = new Date().toISOString();
    return {
      id: newId,
      household_id: household.id,
      category_id: data.category_id,
      amount: data.amount,
      date: data.date,
      payment_method: data.payment_method,
      note: data.note?.trim() || undefined,
      logged_by_user_id: activeMember.user_id,
      reconciliation_status: data.payment_method === 'credit_card' ? 'pending' : 'n/a',
      created_at: nowIso,
      updated_at: nowIso,
    };
  }, [dispatch, activeMember.user_id, household.id]);

  const updateTransactionHandler = useCallback((id: string, updates: Partial<Transaction>) => {
    const existing = transactions.find(t => t.id === id);
    if (!existing) return;
    dispatch(
      ledgerActions.updateTransaction({
        id,
        categoryId: updates.category_id || existing.category_id,
        amount: updates.amount !== undefined ? updates.amount : existing.amount,
        paymentMethod: updates.payment_method || existing.payment_method,
        note: updates.note !== undefined ? updates.note : existing.note,
        date: updates.date || existing.date,
      })
    );
  }, [dispatch, transactions]);

  const deleteTransactionHandler = useCallback((id: string) => {
    dispatch(ledgerActions.deleteTransaction(id));
  }, [dispatch]);

  const logCorrectionHandler = useCallback((originalTx: Transaction, differencePaise: number, note?: string): Transaction => {
    const corrNote = note || `Adjustment for "${originalTx.note || 'Transaction'}"`;
    dispatch(
      ledgerActions.logCorrection({
        categoryId: originalTx.category_id,
        amountPaise: differencePaise,
        note: corrNote,
        loggedByUserId: activeMember.user_id,
      })
    );

    const nowIso = new Date().toISOString();
    return {
      id: `tx_corr_${Date.now()}`,
      household_id: household.id,
      category_id: originalTx.category_id,
      amount: differencePaise,
      payment_method: 'secondary_account_debit',
      note: `[Correction] ${corrNote}`,
      date: nowIso.split('T')[0],
      logged_by_user_id: activeMember.user_id,
      reconciliation_status: 'n/a',
      created_at: nowIso,
      updated_at: nowIso,
    };
  }, [dispatch, activeMember.user_id, household.id]);

  const addSalaryAndAllocationsHandler = useCallback((
    earnerUserId: string,
    amountPaise: number,
    date: string,
    allocationsList: { categoryId: string; amountPaise: number }[]
  ) => {
    dispatch(
      ledgerActions.addSalaryAndAllocations({
        earnerUserId,
        salaryAmountPaise: amountPaise,
        date,
        allocations: allocationsList,
      })
    );

    const salaryId = `sal_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const mockSalary: SalaryEvent = {
      id: salaryId,
      household_id: household.id,
      earner_user_id: earnerUserId,
      amount: amountPaise,
      date,
      created_at: nowIso,
    };

    return { salaryEvent: mockSalary, allocations: [] };
  }, [dispatch, household.id]);

  const toggleAllocationTransferredHandler = useCallback((allocationId: string) => {
    dispatch(ledgerActions.toggleAllocationTransferred(allocationId));
  }, [dispatch]);

  const markAllAllocationsTransferredHandler = useCallback((salaryEventId?: string) => {
    dispatch(ledgerActions.markAllAllocationsTransferred(salaryEventId));
  }, [dispatch]);

  const reconcileCategoryCardSpendHandler = useCallback((
    categoryId: string,
    amountToPayPaise: number,
    date: string
  ) => {
    const recId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    dispatch(
      ledgerActions.reconcileCategoryCardSpend({
        categoryId,
        amountToPayPaise,
        date,
        loggedByUserId: activeMember.user_id,
        reconciliationId: recId,
      })
    );

    const nowIso = new Date().toISOString();
    return {
      reconciliation: {
        id: recId,
        household_id: household.id,
        category_id: categoryId,
        total_amount: amountToPayPaise,
        date,
        logged_by_user_id: activeMember.user_id,
        created_at: nowIso,
      },
      lines: [],
    };
  }, [dispatch, activeMember.user_id, household.id]);

  const deleteReconciliationHandler = useCallback((reconciliationId: string) => {
    dispatch(ledgerActions.deleteReconciliation(reconciliationId));
  }, [dispatch]);

  const moveEnvelopeFundsHandler = useCallback((params: {
    fromCategoryId: string;
    toCategoryId: string;
    amountPaise: number;
    date?: string;
    note?: string;
  }) => {
    const { fromCategoryId, toCategoryId, amountPaise, date, note } = params;
    if (!fromCategoryId || !toCategoryId) {
      return { success: false, error: 'Please select both source and destination envelopes.' };
    }
    if (fromCategoryId === toCategoryId) {
      return { success: false, error: 'Source and destination envelopes must be different.' };
    }
    if (!amountPaise || amountPaise <= 0) {
      return { success: false, error: 'Transfer amount must be greater than zero.' };
    }

    dispatch(
      ledgerActions.moveEnvelopeFunds({
        fromCategoryId,
        toCategoryId,
        amountPaise,
        date,
        note,
        loggedByUserId: activeMember.user_id,
      })
    );

    return { success: true };
  }, [dispatch, activeMember.user_id]);

  const deleteEnvelopeTransferHandler = useCallback((transferId: string) => {
    dispatch(ledgerActions.deleteEnvelopeTransfer(transferId));
  }, [dispatch]);

  const addCategoryFundsHandler = useCallback((params: {
    categoryId: string;
    amountPaise: number;
    source?: string;
    note?: string;
    date?: string;
    depositHolding?: 'secondary_account' | 'cash' | 'primary_account';
    transferred?: boolean;
    loggedByUserId?: string;
  }) => {
    const { categoryId, amountPaise, source, note, date, depositHolding, transferred, loggedByUserId } = params;
    const cat = categories.find(c => c.id === categoryId && !c.deleted_at);
    if (!cat) {
      return { success: false, error: 'Envelope not found or has been deleted.' };
    }
    if (!amountPaise || amountPaise <= 0) {
      return { success: false, error: 'Amount must be greater than zero.' };
    }

    dispatch(
      ledgerActions.addCategoryFunds({
        categoryId,
        amountPaise,
        source,
        note,
        date,
        depositHolding,
        transferred,
        loggedByUserId: loggedByUserId || activeMember.user_id,
      })
    );

    return { success: true };
  }, [dispatch, categories, activeMember.user_id]);

  const deleteCategoryFundsHandler = useCallback((allocationId: string) => {
    dispatch(ledgerActions.deleteCategoryFunds(allocationId));
  }, [dispatch]);

  const createCategoryHandler = useCallback((name: string, icon: string, color: string, target_amount?: number) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: 'Category name is required' };
    }

    const collision = categories.some(
      c => !c.deleted_at && c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (collision) {
      return { success: false, error: `A category named "${trimmed}" already exists.` };
    }

    dispatch(
      ledgerActions.createCategory({
        name: trimmed,
        icon,
        color,
        target_amount,
      })
    );
    return { success: true };
  }, [dispatch, categories]);

  const updateCategoryHandler = useCallback((id: string, updates: Partial<Category>) => {
    if (updates.name) {
      const trimmed = updates.name.trim();
      const collision = categories.some(
        c => c.id !== id && !c.deleted_at && c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (collision) {
        return { success: false, error: `A category named "${trimmed}" already exists.` };
      }
    }

    dispatch(ledgerActions.updateCategory({ id, updates }));
    return { success: true };
  }, [dispatch, categories]);

  const archiveCategoryHandler = useCallback((id: string) => {
    dispatch(ledgerActions.archiveCategory(id));
  }, [dispatch]);

  const unarchiveCategoryHandler = useCallback((id: string) => {
    dispatch(ledgerActions.unarchiveCategory(id));
  }, [dispatch]);

  const updateMemberNameHandler = useCallback((userId: string, newName: string) => {
    dispatch(ledgerActions.updateMemberName({ userId, newName }));
  }, [dispatch]);

  const updateMemberProfileHandler = useCallback((
    userId: string,
    updates: { name?: string; avatar_url?: string; avatar_color?: string }
  ) => {
    dispatch(ledgerActions.updateMemberProfile({ userId, updates }));
  }, [dispatch]);

  const deleteMemberHandler = useCallback((userId: string) => {
    if (userId === activeMember.user_id) {
      return { success: false, error: 'You cannot delete yourself from the household.' };
    }
    dispatch(ledgerActions.deleteMember(userId));
    return { success: true };
  }, [dispatch, activeMember.user_id]);

  const createInviteHandler = useCallback((): Invite => {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    dispatch(ledgerActions.createInvite({ code, createdBy: activeMember.user_id }));
    const now = new Date();
    return {
      id: `inv_${Date.now()}`,
      household_id: household.id,
      code,
      created_by: activeMember.user_id,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
    };
  }, [dispatch, activeMember.user_id, household.id]);

  const revokeInviteHandler = useCallback((inviteId: string) => {
    dispatch(ledgerActions.revokeInvite(inviteId));
  }, [dispatch]);

  const updatePushSettingsHandler = useCallback((reminder_time: string, enabled: boolean) => {
    dispatch(ledgerActions.updatePushSettings({ reminder_time, enabled }));
  }, [dispatch]);

  // ATOMIC ZERO RESET
  const resetLedgerToZeroHandler = useCallback(async (isFirstTimeIntro: boolean = false) => {
    const resetIso = new Date().toISOString();
    const customUserName = localStorage.getItem('env_budget_user_name') || undefined;

    // 1. Dispatch atomic zero reset to Redux Store
    dispatch(
      ledgerActions.resetLedgerToZero({
        resetIso,
        userName: customUserName,
      })
    );

    // 2. Mark intro completed on server API if present
    try {
      fetch(`/api/household/${householdId}/complete-intro`, { method: 'POST' }).catch(() => {});
    } catch {}

    // 3. Immediately flush state to Firestore
    await flushSyncNow();
  }, [dispatch, householdId]);

  const syncNowHandler = useCallback(async () => {
    dispatch(ledgerActions.setPermissionDenied(false));
    const stopLoader = startApiCall('Syncing ledger with Firestore...');
    try {
      await flushSyncNow();
    } finally {
      stopLoader();
    }
  }, [dispatch, startApiCall]);

  const addAllowedEmailHandler = useCallback(async (emailInput: string) => {
    const email = emailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return { success: false, error: 'Please enter a valid Google email address (e.g., spouse@gmail.com).' };
    }

    const currentAllowed = (household.allowed_emails || []).map(e => e.trim().toLowerCase());
    if (currentAllowed.includes(email)) {
      return { success: false, error: 'This email is already on the allowlist.' };
    }

    const ownerEmail = (household.owner_email || user?.email || '').trim().toLowerCase();
    const newAllowed = Array.from(new Set([...(ownerEmail ? [ownerEmail] : []), ...currentAllowed, email]));

    const updatedHousehold: Household = {
      ...household,
      owner_email: household.owner_email || ownerEmail || email,
      allowed_emails: newAllowed,
      updated_at: new Date().toISOString(),
    };

    dispatch(ledgerActions.setHousehold(updatedHousehold));
    await flushSyncNow();
    return { success: true };
  }, [household, user?.email, dispatch]);

  const removeAllowedEmailHandler = useCallback(async (emailInput: string) => {
    const email = emailInput.trim().toLowerCase();
    const ownerEmail = (household.owner_email || '').trim().toLowerCase();
    if (email === ownerEmail) {
      return { success: false, error: 'Cannot remove the primary household owner from the allowlist.' };
    }

    const currentAllowed = (household.allowed_emails || []).map(e => e.trim().toLowerCase());
    const newAllowed = currentAllowed.filter(e => e !== email);

    const updatedHousehold: Household = {
      ...household,
      allowed_emails: newAllowed,
      updated_at: new Date().toISOString(),
    };

    dispatch(ledgerActions.setHousehold(updatedHousehold));
    await flushSyncNow();
    return { success: true };
  }, [household, dispatch]);

  const contextValue: BudgetContextType = useMemo(
    () => ({
      household,
      members,
      activeMember,
      categories,
      activeCategories,
      salaryEvents,
      allocations,
      transactions,
      reconciliations,
      reconciliationLines,
      envelopeTransfers,
      invites,
      selectedMonth,
      setSelectedMonth: setSelectedMonthHandler,
      categoryBalances,
      totalAvailablePaise,
      totalPendingPaybackPaise,
      pendingTransfersList,
      pushSettings,
      setActiveMemberId: setActiveMemberIdHandler,
      addTransaction: addTransactionHandler,
      updateTransaction: updateTransactionHandler,
      deleteTransaction: deleteTransactionHandler,
      logCorrection: logCorrectionHandler,
      addSalaryAndAllocations: addSalaryAndAllocationsHandler,
      toggleAllocationTransferred: toggleAllocationTransferredHandler,
      markAllAllocationsTransferred: markAllAllocationsTransferredHandler,
      reconcileCategoryCardSpend: reconcileCategoryCardSpendHandler,
      deleteReconciliation: deleteReconciliationHandler,
      moveEnvelopeFunds: moveEnvelopeFundsHandler,
      deleteEnvelopeTransfer: deleteEnvelopeTransferHandler,
      addCategoryFunds: addCategoryFundsHandler,
      deleteCategoryFunds: deleteCategoryFundsHandler,
      createCategory: createCategoryHandler,
      updateCategory: updateCategoryHandler,
      archiveCategory: archiveCategoryHandler,
      unarchiveCategory: unarchiveCategoryHandler,
      updateMemberName: updateMemberNameHandler,
      updateMemberProfile: updateMemberProfileHandler,
      deleteMember: deleteMemberHandler,
      createInvite: createInviteHandler,
      revokeInvite: revokeInviteHandler,
      updatePushSettings: updatePushSettingsHandler,
      resetLedgerToZero: resetLedgerToZeroHandler,
      isFirstTimeIntroCompleted,
      householdId,
      cloudSyncStatus: syncStatus === 'idle' ? 'synced' : syncStatus,
      lastCloudSync,
      syncNow: syncNowHandler,
      isAccessAllowed,
      authLoading,
      accessBlockedReason,
      isOwner,
      addAllowedEmail: addAllowedEmailHandler,
      removeAllowedEmail: removeAllowedEmailHandler,
    }),
    [
      household,
      members,
      activeMember,
      categories,
      activeCategories,
      salaryEvents,
      allocations,
      transactions,
      reconciliations,
      reconciliationLines,
      envelopeTransfers,
      invites,
      selectedMonth,
      setSelectedMonthHandler,
      categoryBalances,
      totalAvailablePaise,
      totalPendingPaybackPaise,
      pendingTransfersList,
      pushSettings,
      setActiveMemberIdHandler,
      addTransactionHandler,
      updateTransactionHandler,
      deleteTransactionHandler,
      logCorrectionHandler,
      addSalaryAndAllocationsHandler,
      toggleAllocationTransferredHandler,
      markAllAllocationsTransferredHandler,
      reconcileCategoryCardSpendHandler,
      deleteReconciliationHandler,
      moveEnvelopeFundsHandler,
      deleteEnvelopeTransferHandler,
      addCategoryFundsHandler,
      deleteCategoryFundsHandler,
      createCategoryHandler,
      updateCategoryHandler,
      archiveCategoryHandler,
      unarchiveCategoryHandler,
      updateMemberNameHandler,
      updateMemberProfileHandler,
      deleteMemberHandler,
      createInviteHandler,
      revokeInviteHandler,
      updatePushSettingsHandler,
      resetLedgerToZeroHandler,
      isFirstTimeIntroCompleted,
      householdId,
      syncStatus,
      lastCloudSync,
      syncNowHandler,
      isAccessAllowed,
      authLoading,
      accessBlockedReason,
      isOwner,
      addAllowedEmailHandler,
      removeAllowedEmailHandler,
    ]
  );

  return (
    <BudgetContext.Provider value={contextValue}>
      {children}
    </BudgetContext.Provider>
  );
};

export const BudgetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <Provider store={store}>
      <BudgetProviderContent>{children}</BudgetProviderContent>
    </Provider>
  );
};

export const useBudget = (): BudgetContextType => {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
};
