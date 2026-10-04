import React, { createContext, useContext, useEffect, useMemo, ReactNode, useCallback, useState } from 'react';
import { Provider } from 'react-redux';
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
  subscribeToFirestoreHousehold,
  flushSyncNow,
  configureSyncAuth,
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
  HouseholdInvitation,
  PushSubscriptionSetting,
  CategoryBalanceInfo,
} from '../types';
import { SyncResult } from '../sync/types';
import { isValidCloudHouseholdId } from '../sync/householdIdentity';
import { loadHouseholdOnce } from '../sync/syncEngine';
import {
  acceptHouseholdInvitation,
  createHouseholdInvitation,
  declineHouseholdInvitation,
  leaveHousehold,
  listOwnedHouseholdInvitations,
  listPendingHouseholdInvitations,
  revokeHouseholdInvitation,
  revokeHouseholdMemberAccess,
} from '../sync/householdInvitations';
import {
  persistLocalLedgerCache,
  persistUserHouseholdLedgerCache,
  readLocalLedgerCache,
  readUserHouseholdLedgerCache,
} from '../sync/localCache';
import { useSyncRecovery } from '../sync/useSyncRecovery';

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
  updatePushSettings: (time: string, enabled: boolean) => void;
  resetLedgerToZero: (isFirstTimeIntro?: boolean) => Promise<SyncResult>;
  isFirstTimeIntroCompleted: boolean;

  // Cloud & Cross-Device Synchronization
  householdId: string;
  cloudSyncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  cloudSetupStatus: 'local_only' | 'verifying' | 'verified' | 'access_denied';
  lastCloudSync: string | null;
  pendingInvitations: HouseholdInvitation[];
  sentInvitations: HouseholdInvitation[];
  refreshHouseholdInvitations: () => Promise<void>;
  syncNow: () => Promise<SyncResult>;

  // Google Account Household Access
  isAccessAllowed: boolean;
  authLoading: boolean;
  accessBlockedReason: 'none' | 'auth_required' | 'not_in_allowlist';
  isOwner: boolean;
  addAllowedEmail: (email: string) => Promise<SyncResult>;
  removeAllowedEmail: (email: string) => Promise<SyncResult>;
  acceptInvitation: (invitationId: string) => Promise<SyncResult>;
  declineInvitation: (invitationId: string) => Promise<SyncResult>;
  revokeInvitation: (invitationId: string) => Promise<SyncResult>;
  leaveCurrentHousehold: () => Promise<SyncResult>;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

const BudgetProviderContent: React.FC<{ children: ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const {
    user,
    loading: authLoading,
    profileLoading,
    householdId: authHouseholdId,
    privateLedgerId,
    setVerifiedHouseholdId,
    setSyncStatus: setAuthSyncStatus,
  } = useAuth();
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
  const [pendingInvitations, setPendingInvitations] = useState<HouseholdInvitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<HouseholdInvitation[]>([]);

  // Sync auth household ID with Redux store after it has been verified or explicitly created.
  useEffect(() => {
    dispatch(ledgerActions.resetLedgerState());

    if (user && isValidCloudHouseholdId(authHouseholdId)) {
      dispatch(ledgerActions.setHouseholdId(authHouseholdId));
      const cached = readUserHouseholdLedgerCache(localStorage, user.uid, authHouseholdId);
      if (cached) {
        dispatch(ledgerActions.hydrateFromStorage(cached));
      }
      return;
    }

    const cached = readLocalLedgerCache(localStorage);
    if (cached) {
      dispatch(ledgerActions.hydrateFromStorage(cached));
    }
  }, [authHouseholdId, user?.uid, dispatch]);

  // Verify profile-controlled active cloud ledger on sign-in/profile changes.
  useEffect(() => {
    if (!user || profileLoading || !isValidCloudHouseholdId(authHouseholdId)) return;
    if (household.owner_uid || household.owner_email || permissionDenied) return;

    let cancelled = false;
    dispatch(ledgerActions.setSyncStatus('syncing'));
    loadHouseholdOnce({
      householdDocId: authHouseholdId,
      dispatch,
      userUid: user.uid,
      storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
    }).then(result => {
      if (cancelled) return;
      if (result.ok) {
        dispatch(ledgerActions.setLastCloudSync(result.syncedAt));
        dispatch(ledgerActions.setSyncStatus('synced'));
      } else {
        dispatch(ledgerActions.setPermissionDenied(result.reason === 'permission_denied'));
        dispatch(ledgerActions.setSyncStatus(result.reason === 'permission_denied' ? 'offline' : 'error'));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authHouseholdId, dispatch, household.owner_email, household.owner_uid, permissionDenied, profileLoading, user]);

  useEffect(() => {
    if (
      !user ||
      !permissionDenied ||
      !privateLedgerId ||
      authHouseholdId === privateLedgerId ||
      !isValidCloudHouseholdId(privateLedgerId)
    ) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await setVerifiedHouseholdId(privateLedgerId);
        if (!cancelled) {
          dispatch(ledgerActions.setPermissionDenied(false));
          dispatch(ledgerActions.resetLedgerState());
        }
      } catch {
        if (!cancelled) {
          dispatch(ledgerActions.setSyncStatus('error'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authHouseholdId, dispatch, permissionDenied, privateLedgerId, setVerifiedHouseholdId, user]);

  // Keep auth sync status in sync
  useEffect(() => {
    if (syncStatus === 'syncing' || syncStatus === 'synced' || syncStatus === 'offline' || syncStatus === 'error') {
      setAuthSyncStatus(syncStatus);
    }
  }, [syncStatus, setAuthSyncStatus]);

  // 2. Google Account household access verification
  const { isAccessAllowed, accessBlockedReason, isOwner } = useMemo(() => {
    if (authLoading || profileLoading) {
      return {
        isAccessAllowed: true,
        accessBlockedReason: 'auth_required' as const,
        isOwner: false,
      };
    }

    if (!user) {
      return {
        isAccessAllowed: true,
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
    const hasCloudAcl = Boolean(household.owner_uid || ownerEmail || allowedEmails.length > 0);
    if (!hasCloudAcl) {
      return {
        isAccessAllowed: true,
        accessBlockedReason: 'none' as const,
        isOwner: false,
      };
    }

    const isCurrentOwner =
      Boolean(household.owner_uid && user.uid === household.owner_uid) ||
      Boolean(household.created_by && user.uid === household.created_by);
    const isCurrentAllowed = Boolean(currentEmail && (allowedEmails.includes(currentEmail) || ownerEmail === currentEmail));

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
  }, [household, user, permissionDenied, authLoading, profileLoading]);

  const hasCloudAcl = Boolean(household.owner_uid || household.owner_email || (household.allowed_emails || []).length > 0);
  const hasVerifiedCloudHousehold = Boolean(user && hasCloudAcl && isValidCloudHouseholdId(householdId));

  useEffect(() => {
    configureSyncAuth({
      uid: user?.uid || null,
      email: user?.email || null,
      isAccessAllowed: Boolean(user && isAccessAllowed && hasVerifiedCloudHousehold),
    });
  }, [user?.uid, user?.email, isAccessAllowed, hasVerifiedCloudHousehold]);

  // 3. Realtime Firestore Subscription
  useEffect(() => {
    if (!householdId || !user?.email || !isAccessAllowed || !hasVerifiedCloudHousehold) return;
    const unsubscribe = subscribeToFirestoreHousehold(householdId, user.email, dispatch);
    return () => {
      unsubscribe();
    };
  }, [householdId, isAccessAllowed, hasVerifiedCloudHousehold, user?.email, dispatch]);

  // 4. Auto-sync Google user profile into household members roster
  useEffect(() => {
    if (!user || !isAccessAllowed || !hasVerifiedCloudHousehold) return;
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
  }, [user, isAccessAllowed, hasVerifiedCloudHousehold, members, dispatch]);

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

  const updatePushSettingsHandler = useCallback((reminder_time: string, enabled: boolean) => {
    dispatch(ledgerActions.updatePushSettings({ reminder_time, enabled }));
  }, [dispatch]);

  // ATOMIC ZERO RESET
  const resetLedgerToZeroHandler = useCallback(async (_isFirstTimeIntro: boolean = false): Promise<SyncResult> => {
    if (user && hasVerifiedCloudHousehold && !isOwner) {
      return { ok: false, reason: 'permission_denied', message: 'Only the household owner can reset a shared cloud ledger.' };
    }

    const resetIso = new Date().toISOString();
    const customUserName = localStorage.getItem('env_budget_user_name') || undefined;

    // 1. Dispatch atomic zero reset to Redux Store
    dispatch(
      ledgerActions.resetLedgerToZero({
        resetIso,
        userName: customUserName,
      })
    );

    // 2. Immediately flush state to Firestore when Google-authenticated sync is allowed.
    if (user && hasVerifiedCloudHousehold) {
      return await flushSyncNow();
    }

    return { ok: true, syncedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), version: 0 };
  }, [dispatch, hasVerifiedCloudHousehold, isOwner, user]);

  const syncNowHandler = useCallback(async (): Promise<SyncResult> => {
    dispatch(ledgerActions.setPermissionDenied(false));
    const stopLoader = startApiCall('Syncing ledger with Firestore...');
    try {
      return await flushSyncNow();
    } finally {
      stopLoader();
    }
  }, [dispatch, startApiCall]);

  const recoverSyncHandler = useCallback(async (): Promise<SyncResult> => {
    return await flushSyncNow();
  }, []);

  const refreshHouseholdInvitationsHandler = useCallback(async (): Promise<void> => {
    if (!user?.email) {
      setPendingInvitations([]);
      setSentInvitations([]);
      return;
    }

    const [pending, sent] = await Promise.all([
      listPendingHouseholdInvitations(user.email),
      isOwner && isValidCloudHouseholdId(householdId)
        ? listOwnedHouseholdInvitations({ householdId, inviterUid: user.uid })
        : Promise.resolve([]),
    ]);
    setPendingInvitations(pending);
    setSentInvitations(sent);
  }, [householdId, isOwner, user?.email, user?.uid]);

  const addAllowedEmailHandler = useCallback(async (emailInput: string): Promise<SyncResult> => {
    if (!user || !user.email || !isOwner) {
      return { ok: false, reason: 'permission_denied', message: 'Only the household owner can send household requests.' };
    }

    const result = await createHouseholdInvitation({
      householdId,
      householdName: household.name,
      inviterUid: user.uid,
      inviterEmail: user.email,
      inviteeEmail: emailInput,
    });
    if (result.ok) await refreshHouseholdInvitationsHandler();
    return result;
  }, [household.name, householdId, isOwner, refreshHouseholdInvitationsHandler, user]);

  const removeAllowedEmailHandler = useCallback(async (emailInput: string): Promise<SyncResult> => {
    if (!user || !isOwner) {
      return { ok: false, reason: 'permission_denied', message: 'Only the household owner can manage Google account access.' };
    }

    const email = emailInput.trim().toLowerCase();
    const ownerEmail = (household.owner_email || user.email || '').trim().toLowerCase();
    if (email === ownerEmail) {
      return { ok: false, reason: 'permission_denied', message: 'Cannot remove the primary household owner from household access.' };
    }

    const member = members.find(item => item.email?.trim().toLowerCase() === email && !item.deleted_at);
    if (!member) {
      return { ok: false, reason: 'unknown', message: 'Only accepted household members can be revoked here. Revoke pending requests from the requests list.' };
    }

    const ownerUid = household.owner_uid || household.created_by || user.uid;
    const result = await revokeHouseholdMemberAccess({
      householdId,
      ownerUid,
      memberUid: member.user_id,
      memberEmail: email,
    });
    if (!result.ok) return result;

    const currentAllowed = (household.allowed_emails || []).map(e => e.trim().toLowerCase());
    const currentMemberUids = household.member_uids || [];
    dispatch(ledgerActions.setHousehold({
      ...household,
      owner_uid: ownerUid,
      owner_email: ownerEmail,
      allowed_emails: Array.from(new Set([...(ownerEmail ? [ownerEmail] : []), ...currentAllowed.filter(item => item !== email)])),
      member_uids: currentMemberUids.filter(uid => uid !== member.user_id),
      created_by: ownerUid,
      updated_at: new Date().toISOString(),
    }));
    dispatch(ledgerActions.deleteMember(member.user_id));
    await refreshHouseholdInvitationsHandler();
    return result;
  }, [dispatch, household, householdId, isOwner, members, refreshHouseholdInvitationsHandler, user]);

  useEffect(() => {
    void refreshHouseholdInvitationsHandler();
  }, [refreshHouseholdInvitationsHandler]);

  const acceptInvitationHandler = useCallback(async (invitationId: string): Promise<SyncResult> => {
    if (!user?.email) {
      return { ok: false, reason: 'signed_out', message: 'Sign in before accepting a household request.' };
    }

    const result = await acceptHouseholdInvitation({
      invitationId,
      userUid: user.uid,
      userEmail: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    });
    if (result.ok && result.householdId) {
      await setVerifiedHouseholdId(result.householdId);
      await refreshHouseholdInvitationsHandler();
      dispatch(ledgerActions.resetLedgerState());
    }
    return result;
  }, [dispatch, refreshHouseholdInvitationsHandler, setVerifiedHouseholdId, user]);

  const declineInvitationHandler = useCallback(async (invitationId: string): Promise<SyncResult> => {
    if (!user?.email) {
      return { ok: false, reason: 'signed_out', message: 'Sign in before declining a household request.' };
    }

    const result = await declineHouseholdInvitation({ invitationId, userEmail: user.email });
    if (result.ok) await refreshHouseholdInvitationsHandler();
    return result;
  }, [refreshHouseholdInvitationsHandler, user?.email]);

  const revokeInvitationHandler = useCallback(async (invitationId: string): Promise<SyncResult> => {
    if (!user || !isOwner) {
      return { ok: false, reason: 'permission_denied', message: 'Only the household owner can revoke household requests.' };
    }

    const result = await revokeHouseholdInvitation({ invitationId });
    if (result.ok) await refreshHouseholdInvitationsHandler();
    return result;
  }, [isOwner, refreshHouseholdInvitationsHandler, user]);

  const leaveCurrentHouseholdHandler = useCallback(async (): Promise<SyncResult> => {
    if (!user?.email || !privateLedgerId) {
      return { ok: false, reason: 'signed_out', message: 'Sign in before leaving a household.' };
    }
    if (isOwner) {
      return { ok: false, reason: 'permission_denied', message: 'The owner cannot leave their owned household. Reset or delete the household instead.' };
    }

    const result = await leaveHousehold({
      householdId,
      privateLedgerId,
      userUid: user.uid,
      userEmail: user.email,
    });
    if (result.ok) {
      await setVerifiedHouseholdId(privateLedgerId);
      dispatch(ledgerActions.resetLedgerState());
    }
    return result;
  }, [dispatch, householdId, isOwner, privateLedgerId, setVerifiedHouseholdId, user]);

  useEffect(() => {
    if (!user || !hasVerifiedCloudHousehold) {
      persistLocalLedgerCache(localStorage, store.getState().ledger);
    }
  }, [user, hasVerifiedCloudHousehold, householdId, members, categories, salaryEvents, allocations, transactions, reconciliations, reconciliationLines, envelopeTransfers]);

  useSyncRecovery({
    enabled: Boolean(user && hasVerifiedCloudHousehold && isAccessAllowed),
    isSyncing: syncStatus === 'syncing',
    onRecover: recoverSyncHandler,
  });

  const cloudSetupStatus = useMemo(() => {
    if (authLoading || profileLoading || syncStatus === 'syncing') return 'verifying' as const;
    if (!user) return 'local_only' as const;
    if (permissionDenied || !isAccessAllowed) return 'access_denied' as const;
    if (hasVerifiedCloudHousehold) return 'verified' as const;
    return 'local_only' as const;
  }, [authLoading, hasVerifiedCloudHousehold, isAccessAllowed, permissionDenied, profileLoading, syncStatus, user]);

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
      updatePushSettings: updatePushSettingsHandler,
      resetLedgerToZero: resetLedgerToZeroHandler,
      isFirstTimeIntroCompleted,
      householdId,
      cloudSyncStatus: syncStatus === 'idle' ? 'synced' : syncStatus,
      cloudSetupStatus,
      lastCloudSync,
      pendingInvitations,
      sentInvitations,
      refreshHouseholdInvitations: refreshHouseholdInvitationsHandler,
      syncNow: syncNowHandler,
      isAccessAllowed,
      authLoading,
      accessBlockedReason,
      isOwner,
      addAllowedEmail: addAllowedEmailHandler,
      removeAllowedEmail: removeAllowedEmailHandler,
      acceptInvitation: acceptInvitationHandler,
      declineInvitation: declineInvitationHandler,
      revokeInvitation: revokeInvitationHandler,
      leaveCurrentHousehold: leaveCurrentHouseholdHandler,
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
      updatePushSettingsHandler,
      resetLedgerToZeroHandler,
      isFirstTimeIntroCompleted,
      householdId,
      syncStatus,
      cloudSetupStatus,
      lastCloudSync,
      pendingInvitations,
      sentInvitations,
      refreshHouseholdInvitationsHandler,
      syncNowHandler,
      isAccessAllowed,
      authLoading,
      accessBlockedReason,
      isOwner,
      addAllowedEmailHandler,
      removeAllowedEmailHandler,
      acceptInvitationHandler,
      declineInvitationHandler,
      revokeInvitationHandler,
      leaveCurrentHouseholdHandler,
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
