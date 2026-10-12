import React, { createContext, useContext, useEffect, useMemo, ReactNode, useCallback, useState, useRef } from 'react';
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
import { useSyncRecovery } from '../sync/useSyncRecovery';
import {
  createAllocationTransferToggledEvent,
  createAllAllocationsMarkedTransferredEvent,
  createCategoryEvent,
  createCategoryFundsAddedEvent,
  createCategoryFundsDeletedEvent,
  createEnvelopeTransferCreatedEvent,
  createEnvelopeTransferDeletedEvent,
  createHouseholdUpdatedEvent,
  createLedgerResetToZeroEvent,
  createMemberDeletedEvent,
  createMemberProfileUpdatedEvent,
  createPushSettingsUpdatedEvent,
  createReconciliationCreatedEvent,
  createReconciliationDeletedEvent,
  createSalaryReceivedEvent,
  createTransactionAddedEvent,
  createTransactionCorrectionEvent,
  createTransactionDeletedEvent,
  createTransactionUpdateEvents,
} from '../sync/events/commands';
import { projectEvents } from '../sync/events/runtime';
import { commitCloudEventsAndProject, syncCloudEventRuntime } from '../sync/events/cloudRuntime';
import { pullLedgerEvents, pushLedgerEvents, subscribeToLedgerEvents } from '../sync/events/eventSyncEngine';
import { EventScope, LedgerEvent, ProjectionSeed } from '../sync/events/types';
import { mergeProjectedLedgerWithTrustedRootAccess, trustedRootAccessFromHousehold, TrustedRootAccessMetadata } from '../sync/rootAccess';
import { describeErrorCode, logSyncDebug, maskIdentifier, summarizeSyncResult } from '../utils/syncDebug';

const CLOUD_EVENT_BOOTSTRAP_TIMEOUT_MS = 8000;

export type MutationResult<T extends object = object> =
  | ({ success: true } & T)
  | { success: false; error: string };

function mutationResultFromSync<T extends object>(result: SyncResult, payload: T): MutationResult<T> {
  if (!result.ok) return { success: false, error: result.message };
  return { success: true, ...payload };
}

function syncFailureResult(result: SyncResult): MutationResult {
  return result.ok ? { success: true } : { success: false, error: result.message };
}

interface BudgetContextType {
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
  }) => Promise<MutationResult<{ transaction: Transaction }>>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<MutationResult>;
  deleteTransaction: (id: string) => Promise<MutationResult>;
  logCorrection: (originalTx: Transaction, differencePaise: number, note?: string) => Promise<MutationResult<{ transaction: Transaction }>>;

  addSalaryAndAllocations: (
    earnerUserId: string,
    amountPaise: number,
    date: string,
    allocationsList: { categoryId: string; amountPaise: number }[]
  ) => Promise<MutationResult<{ salaryEvent: SalaryEvent; allocations: Allocation[] }>>;

  toggleAllocationTransferred: (allocationId: string) => Promise<SyncResult>;
  markAllAllocationsTransferred: (salaryEventId?: string) => Promise<SyncResult>;

  reconcileCategoryCardSpend: (
    categoryId: string,
    amountToPayPaise: number,
    date: string
  ) => Promise<MutationResult<{ reconciliation: Reconciliation; lines: ReconciliationLine[] }>>;
  deleteReconciliation: (reconciliationId: string) => Promise<SyncResult>;

  envelopeTransfers: EnvelopeTransfer[];
  moveEnvelopeFunds: (params: {
    fromCategoryId: string;
    toCategoryId: string;
    amountPaise: number;
    date?: string;
    note?: string;
  }) => Promise<MutationResult<{ transfer: EnvelopeTransfer }>>;
  deleteEnvelopeTransfer: (transferId: string) => Promise<SyncResult>;

  addCategoryFunds: (params: {
    categoryId: string;
    amountPaise: number;
    source?: string;
    note?: string;
    date?: string;
    depositHolding?: 'secondary_account' | 'cash' | 'primary_account';
    transferred?: boolean;
    loggedByUserId?: string;
  }) => Promise<MutationResult<{ allocation: Allocation }>>;
  deleteCategoryFunds: (allocationId: string) => Promise<SyncResult>;

  createCategory: (name: string, icon: string, color: string, target_amount?: number) => Promise<MutationResult>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<MutationResult>;
  archiveCategory: (id: string) => Promise<SyncResult>;
  unarchiveCategory: (id: string) => Promise<SyncResult>;

  updateMemberName: (userId: string, newName: string) => Promise<SyncResult>;
  updateMemberProfile: (
    userId: string,
    updates: { name?: string; avatar_url?: string }
  ) => Promise<SyncResult>;
  deleteMember: (userId: string) => Promise<MutationResult>;
  updatePushSettings: (time: string, enabled: boolean) => Promise<SyncResult>;
  resetLedgerToZero: (isFirstTimeIntro?: boolean) => Promise<SyncResult>;
  isFirstTimeIntroCompleted: boolean;

  // Cloud & Cross-Device Synchronization
  householdId: string;
  sharedLedgerId: string | null;
  cloudSyncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  cloudSetupStatus: 'local_only' | 'verifying' | 'verified' | 'access_denied';
  isCloudBootstrapPending: boolean;
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
    sharedLedgerId,
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
  const [isCloudBootstrapPending, setIsCloudBootstrapPending] = useState(false);
  const trustedRootAccessRef = useRef<TrustedRootAccessMetadata | null>(null);

  const projectionSeed: ProjectionSeed = useMemo(() => ({
    household,
    members,
    categories,
    pushSettings,
    selectedMonth,
    activeMemberId: activeMember.user_id,
    firstTimeIntroCompleted: isFirstTimeIntroCompleted,
    householdId,
  }), [activeMember.user_id, categories, household, householdId, isFirstTimeIntroCompleted, members, pushSettings, selectedMonth]);
  const projectionSeedRef = useRef(projectionSeed);

  useEffect(() => {
    projectionSeedRef.current = projectionSeed;
  }, [projectionSeed]);

  const setTrustedRootAccessSnapshot = useCallback((metadata: TrustedRootAccessMetadata | null) => {
    trustedRootAccessRef.current = metadata;
  }, []);

  // Sync auth household ID with Redux store after it has been verified or explicitly created.
  useEffect(() => {
    if (authLoading || profileLoading) return;

    dispatch(ledgerActions.resetLedgerState());
    setTrustedRootAccessSnapshot(null);

    if (user && isValidCloudHouseholdId(authHouseholdId)) {
      dispatch(ledgerActions.setHouseholdId(authHouseholdId));
      return;
    }

  }, [authHouseholdId, authLoading, dispatch, profileLoading, setTrustedRootAccessSnapshot, user]);

  // Verify profile-controlled active cloud ledger on sign-in/profile changes.
  useEffect(() => {
    if (!user || profileLoading || !isValidCloudHouseholdId(authHouseholdId)) return;
    if (permissionDenied) return;
    if ((household.owner_uid || household.owner_email) && trustedRootAccessRef.current) return;

    let cancelled = false;
    setIsCloudBootstrapPending(true);
    dispatch(ledgerActions.setSyncStatus('syncing'));
    logSyncDebug('cloud bootstrap root load started', {
      householdId: maskIdentifier(authHouseholdId),
      userUid: maskIdentifier(user.uid),
    });

    loadHouseholdOnce({
      householdDocId: authHouseholdId,
      dispatch,
      userUid: user.uid,
          }).then(result => {
      if (cancelled) return;
      logSyncDebug('cloud bootstrap root load completed', {
        householdId: maskIdentifier(authHouseholdId),
        ...summarizeSyncResult(result),
      });
      if (result.ok) {
        setTrustedRootAccessSnapshot(result.household ? trustedRootAccessFromHousehold(result.household) : null);
        setIsCloudBootstrapPending(false);
        dispatch(ledgerActions.setLastCloudSync(result.syncedAt));
        dispatch(ledgerActions.setSyncStatus('synced'));
      } else {
        setIsCloudBootstrapPending(false);
        dispatch(ledgerActions.setPermissionDenied(result.reason === 'permission_denied'));
        dispatch(ledgerActions.setSyncStatus(result.reason === 'permission_denied' ? 'offline' : 'error'));
      }
    }).catch(err => {
      if (cancelled) return;
      logSyncDebug('cloud bootstrap root load crashed', {
        householdId: maskIdentifier(authHouseholdId),
        errorCode: describeErrorCode(err),
      });
      setIsCloudBootstrapPending(false);
      dispatch(ledgerActions.setSyncStatus('error'));
    });

    return () => {
      cancelled = true;
    };
  }, [authHouseholdId, dispatch, household.owner_email, household.owner_uid, permissionDenied, profileLoading, setTrustedRootAccessSnapshot, user]);

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
  const activeEventScope: EventScope = useMemo(() => {
    if (user?.uid && hasVerifiedCloudHousehold && isValidCloudHouseholdId(householdId)) {
      return { kind: 'cloud', userUid: user.uid, householdId };
    }
    return { kind: 'signed_out' };
  }, [hasVerifiedCloudHousehold, householdId, user?.uid]);

  useEffect(() => {
    if (!user || !isValidCloudHouseholdId(authHouseholdId) || permissionDenied) {
      setIsCloudBootstrapPending(false);
    }
  }, [authHouseholdId, permissionDenied, user]);

  const cloudEventSyncHandler = useCallback(async (): Promise<SyncResult> => {
    if (!user?.uid || activeEventScope.kind !== 'cloud') {
      return { ok: false, reason: 'signed_out', message: 'Sign in before syncing cloud events.' };
    }

    dispatch(ledgerActions.setSyncStatus('syncing'));
    try {
      const result = await syncCloudEventRuntime({
        seed: projectionSeed,
        remote: {
          pullEvents: async () => {
            const pullResult = await pullLedgerEvents({ householdId: activeEventScope.householdId });
            if (!pullResult.ok) {
              const failedPull = pullResult.result;
              if (!failedPull.ok) throw new Error(failedPull.message);
              throw new Error('Cloud event pull failed.');
            }
            return pullResult.events;
          },
          pushEvents: (events: LedgerEvent[]) => pushLedgerEvents({ householdId: activeEventScope.householdId, events }),
        },
      });

      const mergedProjection = mergeProjectedLedgerWithTrustedRootAccess(result.projected, trustedRootAccessRef.current);
      dispatch(ledgerActions.applyProjectedLedger(mergedProjection));
      const syncedAt = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      dispatch(ledgerActions.setLastCloudSync(syncedAt));
      dispatch(ledgerActions.setSyncStatus('synced'));
      return { ok: true, syncedAt, version: 0 };
    } catch (err) {
      dispatch(ledgerActions.setSyncStatus('offline'));
      return {
        ok: false,
        reason: 'unknown',
        message: err instanceof Error ? err.message : 'Cloud event sync failed.',
      };
    }
  }, [activeEventScope, dispatch, projectionSeed, user?.uid]);
  const cloudEventSyncHandlerRef = useRef(cloudEventSyncHandler);

  useEffect(() => {
    cloudEventSyncHandlerRef.current = cloudEventSyncHandler;
  }, [cloudEventSyncHandler]);

  const applyProjectedLedger = useCallback((projected: ReturnType<typeof projectEvents>) => {
    const nextProjection = activeEventScope.kind === 'cloud'
      ? mergeProjectedLedgerWithTrustedRootAccess(projected, trustedRootAccessRef.current)
      : projected;
    dispatch(ledgerActions.applyProjectedLedger(nextProjection));
  }, [activeEventScope.kind, dispatch]);

  const mutationBlockedResult = useCallback((): SyncResult | null => {
    if (!user?.uid || activeEventScope.kind !== 'cloud') {
      return { ok: false, reason: 'signed_out', message: 'Sign in before changing your ledger.' };
    }
    if (!isAccessAllowed || permissionDenied) {
      return { ok: false, reason: 'permission_denied', message: 'This Google account cannot edit this household.' };
    }
    if (isCloudBootstrapPending) {
      return { ok: false, reason: 'unknown', message: 'Wait for cloud ledger setup to finish before making changes.' };
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { ok: false, reason: 'network', message: 'You are offline. Reconnect before changing your ledger.' };
    }
    return null;
  }, [activeEventScope, isAccessAllowed, isCloudBootstrapPending, permissionDenied, user?.uid]);

  const appendLedgerEvents = useCallback(async (events: LedgerEvent[]): Promise<SyncResult> => {
    if (events.length === 0) {
      return { ok: true, syncedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), version: 0 };
    }
    const blocked = mutationBlockedResult();
    if (blocked) {
      dispatch(ledgerActions.setSyncStatus(!blocked.ok && blocked.reason === 'network' ? 'offline' : 'error'));
      return blocked;
    }
    if (activeEventScope.kind !== 'cloud') {
      return { ok: false, reason: 'signed_out', message: 'Sign in before changing your ledger.' };
    }

    dispatch(ledgerActions.setSyncStatus('syncing'));
    try {
      const result = await commitCloudEventsAndProject({
        seed: projectionSeed,
        events,
        remote: {
          pullEvents: async () => {
            const pullResult = await pullLedgerEvents({ householdId: activeEventScope.householdId });
            if (!pullResult.ok) {
              const failedPull = pullResult.result;
              if (!failedPull.ok) throw new Error(failedPull.message);
              throw new Error('Cloud event pull failed.');
            }
            return pullResult.events;
          },
          pushEvents: (items: LedgerEvent[]) => pushLedgerEvents({ householdId: activeEventScope.householdId, events: items }),
        },
      });
      if (!result.ok) {
        const failedResult = result.result;
        dispatch(ledgerActions.setSyncStatus(!failedResult.ok && failedResult.reason === 'network' ? 'offline' : 'error'));
        return failedResult;
      }
      applyProjectedLedger(result.projected);
      const syncedAt = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      dispatch(ledgerActions.setLastCloudSync(syncedAt));
      dispatch(ledgerActions.setSyncStatus('synced'));
      return { ok: true, syncedAt, version: 0 };
    } catch (err) {
      dispatch(ledgerActions.setSyncStatus('error'));
      return { ok: false, reason: 'unknown', message: err instanceof Error ? err.message : 'Cloud event write failed.' };
    }
  }, [activeEventScope, applyProjectedLedger, dispatch, mutationBlockedResult, projectionSeed]);

  const createCommandContext = useCallback((nowIso: string) => ({
    householdId,
    actorUid: user?.uid || null,
    actorMemberId: activeMember.user_id,
    baseRemoteRevision: null,
    nowIso,
  }), [activeMember.user_id, householdId, user?.uid]);

  // 3. Cloud event synchronization. Event projection is the canonical cloud read model.
  useEffect(() => {
    const bootstrapBlockers = [
      !householdId ? 'missing_household_id' : null,
      !user?.email ? 'missing_user_email' : null,
      !isAccessAllowed ? 'access_not_allowed' : null,
      !hasVerifiedCloudHousehold ? 'cloud_household_not_verified' : null,
      activeEventScope.kind !== 'cloud' ? 'event_scope_not_cloud' : null,
    ].filter((blocker): blocker is string => Boolean(blocker));

    if (bootstrapBlockers.length > 0) {
      if (isCloudBootstrapPending) {
        logSyncDebug('cloud event bootstrap skipped', {
          householdId: maskIdentifier(householdId),
          activeEventScope: activeEventScope.kind,
          blockers: bootstrapBlockers.join(','),
          hasVerifiedCloudHousehold,
          isAccessAllowed,
        });
      }
      return;
    }

    if (activeEventScope.kind !== 'cloud') return;
    const cloudScope = activeEventScope;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      logSyncDebug('cloud event bootstrap sync started', {
        householdId: maskIdentifier(cloudScope.householdId),
      });
      const initialSyncResult = await Promise.race<SyncResult>([
        cloudEventSyncHandlerRef.current(),
        new Promise<SyncResult>(resolve => {
          window.setTimeout(() => {
            resolve({
              ok: false,
              reason: 'network',
              message: 'Cloud event bootstrap timed out. The app will continue with the last loaded household metadata.',
            });
          }, CLOUD_EVENT_BOOTSTRAP_TIMEOUT_MS);
        }),
      ]);
      if (cancelled) return;
      setIsCloudBootstrapPending(false);
      logSyncDebug(initialSyncResult.ok ? 'cloud event bootstrap sync completed' : 'cloud event bootstrap sync ended without completion', {
        householdId: maskIdentifier(cloudScope.householdId),
        ...summarizeSyncResult(initialSyncResult),
      });
      if (!initialSyncResult.ok) {
        dispatch(ledgerActions.setSyncStatus(initialSyncResult.reason === 'permission_denied' ? 'offline' : 'error'));
        return;
      }

      unsubscribe = subscribeToLedgerEvents({
        householdId: cloudScope.householdId,
        onEvents: events => {
          if (cancelled || events.length === 0) return;
          const projected = projectEvents({
            seed: projectionSeedRef.current,
            events,
          });
          const mergedProjection = mergeProjectedLedgerWithTrustedRootAccess(projected, trustedRootAccessRef.current);
          dispatch(ledgerActions.applyProjectedLedger(mergedProjection));
          const syncedAt = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          dispatch(ledgerActions.setLastCloudSync(syncedAt));
          dispatch(ledgerActions.setSyncStatus('synced'));
        },
        onError: result => {
          if (cancelled || result.ok) return;
          logSyncDebug('cloud event subscription failed', {
            householdId: maskIdentifier(cloudScope.householdId),
            ...summarizeSyncResult(result),
          });
          dispatch(ledgerActions.setPermissionDenied(result.reason === 'permission_denied'));
          dispatch(ledgerActions.setSyncStatus(result.reason === 'permission_denied' ? 'offline' : 'error'));
        },
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [activeEventScope, dispatch, hasVerifiedCloudHousehold, householdId, isAccessAllowed, isCloudBootstrapPending, user?.email]);

  // 4. Auto-sync Google user profile into household members roster
  useEffect(() => {
    if (!user || !isAccessAllowed || !hasVerifiedCloudHousehold || isCloudBootstrapPending) return;
    const uid = user.uid;


    const name = user.displayName || user.email?.split('@')[0] || 'User';
    const avatar_url = user.photoURL || undefined;

    const existing = members.find(m => m.user_id === uid);
    const nowIso = new Date().toISOString();
    const member = existing || {
      id: `mem_${uid}`,
      household_id: householdId,
      user_id: uid,
      name,
      role: 'member' as const,
      email: user.email || undefined,
      avatar_url,
      joined_at: nowIso,
    };
    if (existing && existing.name === name && existing.avatar_url === avatar_url) return;

    appendLedgerEvents([
      createMemberProfileUpdatedEvent(createCommandContext(nowIso), {
        ...member,
        name,
        avatar_url,
      }),
    ]);
  }, [user, isAccessAllowed, hasVerifiedCloudHousehold, isCloudBootstrapPending, householdId, members, appendLedgerEvents, createCommandContext]);

  // Actions Facade
  const setSelectedMonthHandler = useCallback((month: string) => {
    dispatch(ledgerActions.setSelectedMonth(month));
  }, [dispatch]);

  const setActiveMemberIdHandler = useCallback((id: string) => {
    dispatch(ledgerActions.setActiveMemberId(id));
  }, [dispatch]);

  const addTransactionHandler = useCallback(async (data: {
    category_id: string;
    amount: number;
    date: string;
    payment_method: Transaction['payment_method'];
    note?: string;
  }): Promise<MutationResult<{ transaction: Transaction }>> => {
    const newId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const event = createTransactionAddedEvent(
      {
        householdId,
        actorUid: user?.uid || null,
        actorMemberId: activeMember.user_id,
        baseRemoteRevision: null,
        nowIso,
      },
      {
        transactionId: newId,
        categoryId: data.category_id,
        amount: data.amount,
        paymentMethod: data.payment_method,
        note: data.note,
        date: data.date,
      }
    );
    const result = await appendLedgerEvents([event]);
    return mutationResultFromSync(result, { transaction: event.payload.transaction });
  }, [activeMember.user_id, appendLedgerEvents, householdId, user?.uid]);

  const updateTransactionHandler = useCallback(async (id: string, updates: Partial<Transaction>): Promise<MutationResult> => {
    const existing = transactions.find(t => t.id === id);
    if (!existing) return { success: false, error: 'Transaction not found.' };
    const nowIso = new Date().toISOString();
    const events = createTransactionUpdateEvents(
      {
        householdId,
        actorUid: user?.uid || null,
        actorMemberId: activeMember.user_id,
        baseRemoteRevision: null,
        nowIso,
      },
      {
        existing,
        categoryId: updates.category_id || existing.category_id,
        amount: updates.amount !== undefined ? updates.amount : existing.amount,
        paymentMethod: updates.payment_method || existing.payment_method,
        note: updates.note !== undefined ? updates.note : existing.note,
        date: updates.date || existing.date,
        generatedSuffix: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      }
    );
    const result = await appendLedgerEvents(events);
    return syncFailureResult(result);
  }, [activeMember.user_id, appendLedgerEvents, householdId, transactions, user?.uid]);

  const deleteTransactionHandler = useCallback(async (id: string): Promise<MutationResult> => {
    const existing = transactions.find(t => t.id === id);
    if (!existing) return { success: false, error: 'Transaction not found.' };
    const event = createTransactionDeletedEvent(
      {
        householdId,
        actorUid: user?.uid || null,
        actorMemberId: activeMember.user_id,
        baseRemoteRevision: null,
        nowIso: new Date().toISOString(),
      },
      existing,
      `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    );
    if (!event) return { success: false, error: 'Transaction could not be reversed.' };
    const result = await appendLedgerEvents([event]);
    return syncFailureResult(result);
  }, [activeMember.user_id, appendLedgerEvents, householdId, transactions, user?.uid]);

  const logCorrectionHandler = useCallback(async (originalTx: Transaction, differencePaise: number, note?: string): Promise<MutationResult<{ transaction: Transaction }>> => {
    const corrNote = note || `Adjustment for "${originalTx.note || 'Transaction'}"`;
    const nowIso = new Date().toISOString();
    const event = createTransactionCorrectionEvent(
      {
        householdId,
        actorUid: user?.uid || null,
        actorMemberId: activeMember.user_id,
        baseRemoteRevision: null,
        nowIso,
      },
      {
        categoryId: originalTx.category_id,
        amount: differencePaise,
        note: corrNote,
        transactionId: `tx_corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      }
    );
    const result = await appendLedgerEvents([event]);
    return mutationResultFromSync(result, { transaction: event.payload.transaction });
  }, [activeMember.user_id, appendLedgerEvents, householdId, user?.uid]);

  const addSalaryAndAllocationsHandler = useCallback(async (
    earnerUserId: string,
    amountPaise: number,
    date: string,
    allocationsList: { categoryId: string; amountPaise: number }[]
  ): Promise<MutationResult<{ salaryEvent: SalaryEvent; allocations: Allocation[] }>> => {
    const nowIso = new Date().toISOString();
    const salaryId = `sal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const unallocatedCat = categories.find(c => c.is_unallocated);
    const event = createSalaryReceivedEvent(
      {
        householdId,
        actorUid: user?.uid || null,
        actorMemberId: activeMember.user_id,
        baseRemoteRevision: null,
        nowIso,
      },
      {
        salaryEventId: salaryId,
        salaryAmount: amountPaise,
        date,
        earnerUserId,
        allocations: allocationsList.map(item => ({ categoryId: item.categoryId, amount: item.amountPaise })),
        unallocatedCategoryId: unallocatedCat?.id || 'cat_unallocated',
      }
    );
    const result = await appendLedgerEvents([event]);
    return mutationResultFromSync(result, { salaryEvent: event.payload.salaryEvent, allocations: event.payload.allocations });
  }, [activeMember.user_id, appendLedgerEvents, categories, householdId, user?.uid]);

  const toggleAllocationTransferredHandler = useCallback(async (allocationId: string): Promise<SyncResult> => {
    const allocation = allocations.find(item => item.id === allocationId);
    if (!allocation) return { ok: false, reason: 'unknown', message: 'Allocation not found.' };
    const event = createAllocationTransferToggledEvent(createCommandContext(new Date().toISOString()), allocation);
    return await appendLedgerEvents([event]);
  }, [allocations, appendLedgerEvents, createCommandContext]);

  const markAllAllocationsTransferredHandler = useCallback(async (salaryEventId?: string): Promise<SyncResult> => {
    const event = createAllAllocationsMarkedTransferredEvent(
      createCommandContext(new Date().toISOString()),
      allocations,
      salaryEventId
    );
    if (!event) return { ok: true, syncedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), version: 0 };
    return await appendLedgerEvents([event]);
  }, [allocations, appendLedgerEvents, createCommandContext]);

  const reconcileCategoryCardSpendHandler = useCallback(async (
    categoryId: string,
    amountToPayPaise: number,
    date: string
  ): Promise<MutationResult<{ reconciliation: Reconciliation; lines: ReconciliationLine[] }>> => {
    const recId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const event = createReconciliationCreatedEvent(
      createCommandContext(new Date().toISOString()),
      {
        reconciliationId: recId,
        categoryId,
        amountToPay: amountToPayPaise,
        date,
        transactions,
        reconciliationLines,
      }
    );
    const result = await appendLedgerEvents([event]);
    return mutationResultFromSync(result, {
      reconciliation: event.payload.reconciliation,
      lines: event.payload.lines,
    });
  }, [appendLedgerEvents, createCommandContext, reconciliationLines, transactions]);

  const deleteReconciliationHandler = useCallback(async (reconciliationId: string): Promise<SyncResult> => {
    const reconciliation = reconciliations.find(item => item.id === reconciliationId);
    if (!reconciliation) return { ok: false, reason: 'unknown', message: 'Reconciliation not found.' };
    const event = createReconciliationDeletedEvent(
      createCommandContext(new Date().toISOString()),
      {
        reconciliation,
        reconciliationLines,
        transactions,
        reversalId: `rec_rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      }
    );
    if (!event) return { ok: false, reason: 'unknown', message: 'Reconciliation could not be reversed.' };
    return await appendLedgerEvents([event]);
  }, [appendLedgerEvents, createCommandContext, reconciliationLines, reconciliations, transactions]);

  const moveEnvelopeFundsHandler = useCallback(async (params: {
    fromCategoryId: string;
    toCategoryId: string;
    amountPaise: number;
    date?: string;
    note?: string;
  }): Promise<MutationResult<{ transfer: EnvelopeTransfer }>> => {
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

    const nowIso = new Date().toISOString();
    const transferId = `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const event = createEnvelopeTransferCreatedEvent(
      {
        householdId,
        actorUid: user?.uid || null,
        actorMemberId: activeMember.user_id,
        baseRemoteRevision: null,
        nowIso,
      },
      {
        transferId,
        debitAllocationId: `alloc_${transferId}_from`,
        creditAllocationId: `alloc_${transferId}_to`,
        fromCategoryId,
        toCategoryId,
        amount: amountPaise,
        date: date || nowIso.split('T')[0],
        note,
      }
    );
    const result = await appendLedgerEvents([event]);
    return mutationResultFromSync(result, { transfer: event.payload.transfer });
  }, [activeMember.user_id, appendLedgerEvents, householdId, user?.uid]);

  const deleteEnvelopeTransferHandler = useCallback(async (transferId: string): Promise<SyncResult> => {
    const transfer = envelopeTransfers.find(item => item.id === transferId);
    if (!transfer) return { ok: false, reason: 'unknown', message: 'Transfer not found.' };
    const event = createEnvelopeTransferDeletedEvent(
      createCommandContext(new Date().toISOString()),
      transfer,
      `tr_rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    );
    if (!event) return { ok: false, reason: 'unknown', message: 'Transfer could not be reversed.' };
    return await appendLedgerEvents([event]);
  }, [appendLedgerEvents, createCommandContext, envelopeTransfers]);

  const addCategoryFundsHandler = useCallback(async (params: {
    categoryId: string;
    amountPaise: number;
    source?: string;
    note?: string;
    date?: string;
    depositHolding?: 'secondary_account' | 'cash' | 'primary_account';
    transferred?: boolean;
    loggedByUserId?: string;
  }): Promise<MutationResult<{ allocation: Allocation }>> => {
    const { categoryId, amountPaise, source, note, date, depositHolding, transferred, loggedByUserId } = params;
    const cat = categories.find(c => c.id === categoryId && !c.deleted_at);
    if (!cat) {
      return { success: false, error: 'Envelope not found or has been deleted.' };
    }
    if (!amountPaise || amountPaise <= 0) {
      return { success: false, error: 'Amount must be greater than zero.' };
    }

    const nowIso = new Date().toISOString();
    const topupId = `env_topup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const event = createCategoryFundsAddedEvent(
      {
        householdId,
        actorUid: user?.uid || null,
        actorMemberId: activeMember.user_id,
        baseRemoteRevision: null,
        nowIso,
      },
      {
        allocationId: `alloc_${topupId}`,
        categoryId,
        amount: amountPaise,
        source,
        note,
        date,
        depositHolding,
        transferred,
        loggedByUserId: loggedByUserId || activeMember.user_id,
      }
    );
    const result = await appendLedgerEvents([event]);
    return mutationResultFromSync(result, { allocation: event.payload.allocation });
  }, [activeMember.user_id, appendLedgerEvents, categories, householdId, user?.uid]);

  const deleteCategoryFundsHandler = useCallback(async (allocationId: string): Promise<SyncResult> => {
    const allocation = allocations.find(item => item.id === allocationId);
    if (!allocation) return { ok: false, reason: 'unknown', message: 'Allocation not found.' };
    const event = createCategoryFundsDeletedEvent(
      createCommandContext(new Date().toISOString()),
      allocation,
      `alloc_rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    );
    if (!event) return { ok: false, reason: 'unknown', message: 'Top-up could not be reversed.' };
    return await appendLedgerEvents([event]);
  }, [allocations, appendLedgerEvents, createCommandContext]);

  const createCategoryHandler = useCallback(async (name: string, icon: string, color: string, target_amount?: number): Promise<MutationResult> => {
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

    const nowIso = new Date().toISOString();
    const category: Category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      household_id: householdId,
      name: trimmed,
      icon,
      color,
      target_amount: target_amount && target_amount > 0 ? target_amount : undefined,
      is_archived: false,
      created_at: nowIso,
      updated_at: nowIso,
    };
    const result = await appendLedgerEvents([createCategoryEvent(createCommandContext(nowIso), 'category.created', category)]);
    return syncFailureResult(result);
  }, [appendLedgerEvents, categories, createCommandContext, householdId]);

  const updateCategoryHandler = useCallback(async (id: string, updates: Partial<Category>): Promise<MutationResult> => {
    const existing = categories.find(c => c.id === id);
    if (!existing) return { success: false, error: 'Category not found.' };
    if (updates.name) {
      const trimmed = updates.name.trim();
      const collision = categories.some(
        c => c.id !== id && !c.deleted_at && c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (collision) {
        return { success: false, error: `A category named "${trimmed}" already exists.` };
      }
    }

    const nowIso = new Date().toISOString();
    const result = await appendLedgerEvents([
      createCategoryEvent(createCommandContext(nowIso), 'category.updated', {
        ...existing,
        ...updates,
        name: updates.name !== undefined ? updates.name.trim() : existing.name,
        updated_at: nowIso,
      }),
    ]);
    return syncFailureResult(result);
  }, [appendLedgerEvents, categories, createCommandContext]);

  const archiveCategoryHandler = useCallback(async (id: string): Promise<SyncResult> => {
    const existing = categories.find(c => c.id === id);
    if (!existing) return { ok: false, reason: 'unknown', message: 'Category not found.' };
    const nowIso = new Date().toISOString();
    return await appendLedgerEvents([
      createCategoryEvent(createCommandContext(nowIso), 'category.archived', {
        ...existing,
        is_archived: true,
        updated_at: nowIso,
      }),
    ]);
  }, [appendLedgerEvents, categories, createCommandContext]);

  const unarchiveCategoryHandler = useCallback(async (id: string): Promise<SyncResult> => {
    const existing = categories.find(c => c.id === id);
    if (!existing) return { ok: false, reason: 'unknown', message: 'Category not found.' };
    const nowIso = new Date().toISOString();
    return await appendLedgerEvents([
      createCategoryEvent(createCommandContext(nowIso), 'category.unarchived', {
        ...existing,
        is_archived: false,
        updated_at: nowIso,
      }),
    ]);
  }, [appendLedgerEvents, categories, createCommandContext]);

  const updateMemberNameHandler = useCallback(async (userId: string, newName: string): Promise<SyncResult> => {
    const member = members.find(item => item.user_id === userId);
    if (!member) return { ok: false, reason: 'unknown', message: 'Member not found.' };
    return await appendLedgerEvents([
      createMemberProfileUpdatedEvent(createCommandContext(new Date().toISOString()), {
        ...member,
        name: newName.trim(),
      }),
    ]);
  }, [appendLedgerEvents, createCommandContext, members]);

  const updateMemberProfileHandler = useCallback(async (
    userId: string,
    updates: { name?: string; avatar_url?: string }
  ): Promise<SyncResult> => {
    const member = members.find(item => item.user_id === userId);
    if (!member) return { ok: false, reason: 'unknown', message: 'Member not found.' };
    return await appendLedgerEvents([
      createMemberProfileUpdatedEvent(createCommandContext(new Date().toISOString()), {
        ...member,
        ...updates,
        name: updates.name !== undefined ? updates.name.trim() : member.name,
      }),
    ]);
  }, [appendLedgerEvents, createCommandContext, members]);

  const deleteMemberHandler = useCallback(async (userId: string): Promise<MutationResult> => {
    if (userId === activeMember.user_id) {
      return { success: false, error: 'You cannot delete yourself from the household.' };
    }
    const result = await appendLedgerEvents([createMemberDeletedEvent(createCommandContext(new Date().toISOString()), userId)]);
    return syncFailureResult(result);
  }, [activeMember.user_id, appendLedgerEvents, createCommandContext]);

  const updatePushSettingsHandler = useCallback(async (reminder_time: string, enabled: boolean): Promise<SyncResult> => {
    return await appendLedgerEvents([
      createPushSettingsUpdatedEvent(createCommandContext(new Date().toISOString()), {
        ...pushSettings,
        reminder_time,
        enabled,
      }),
    ]);
  }, [appendLedgerEvents, createCommandContext, pushSettings]);

  // ATOMIC ZERO RESET
  const resetLedgerToZeroHandler = useCallback(async (_isFirstTimeIntro: boolean = false): Promise<SyncResult> => {
    if (user && hasVerifiedCloudHousehold && !isOwner) {
      return { ok: false, reason: 'permission_denied', message: 'Only the household owner can reset a shared cloud ledger.' };
    }

    const resetIso = new Date().toISOString();
    const event = createLedgerResetToZeroEvent(
      createCommandContext(resetIso),
      store.getState().ledger,
      resetIso,
      undefined
    );

    return await appendLedgerEvents([event]);
  }, [appendLedgerEvents, createCommandContext, hasVerifiedCloudHousehold, isOwner, user]);

  const syncNowHandler = useCallback(async (): Promise<SyncResult> => {
    dispatch(ledgerActions.setPermissionDenied(false));
    const stopLoader = startApiCall('Syncing ledger with Firestore...');
    try {
      if (activeEventScope.kind === 'cloud') {
        return await cloudEventSyncHandler();
      }
      return { ok: true, syncedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), version: 0 };
    } finally {
      stopLoader();
    }
  }, [activeEventScope, cloudEventSyncHandler, dispatch, startApiCall]);

  const recoverSyncHandler = useCallback(async (): Promise<SyncResult> => {
    if (activeEventScope.kind === 'cloud') {
      return await cloudEventSyncHandler();
    }
    return { ok: true, syncedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), version: 0 };
  }, [activeEventScope, cloudEventSyncHandler]);

  const refreshHouseholdInvitationsHandler = useCallback(async (): Promise<void> => {
    if (!user?.email) {
      setPendingInvitations([]);
      setSentInvitations([]);
      return;
    }

    try {
      const [pending, sent] = await Promise.all([
        listPendingHouseholdInvitations(user.email),
        isOwner && isValidCloudHouseholdId(householdId)
          ? listOwnedHouseholdInvitations({ householdId, inviterUid: user.uid })
          : Promise.resolve([]),
      ]);
      setPendingInvitations(pending);
      setSentInvitations(sent);
    } catch {
      setPendingInvitations([]);
      setSentInvitations([]);
    }
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
    const updatedHousehold = {
      ...household,
      owner_uid: ownerUid,
      owner_email: ownerEmail,
      allowed_emails: Array.from(new Set([...(ownerEmail ? [ownerEmail] : []), ...currentAllowed.filter(item => item !== email)])),
      member_uids: currentMemberUids.filter(uid => uid !== member.user_id),
      created_by: ownerUid,
      updated_at: new Date().toISOString(),
    };
    setTrustedRootAccessSnapshot(trustedRootAccessFromHousehold(updatedHousehold));
    const nowIso = updatedHousehold.updated_at;
    const eventResult = await appendLedgerEvents([
      createHouseholdUpdatedEvent(createCommandContext(nowIso), updatedHousehold),
      createMemberDeletedEvent(createCommandContext(nowIso), member.user_id),
    ]);
    if (!eventResult.ok) return eventResult;
    await refreshHouseholdInvitationsHandler();
    return result;
  }, [appendLedgerEvents, createCommandContext, household, householdId, isOwner, members, refreshHouseholdInvitationsHandler, setTrustedRootAccessSnapshot, user]);

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
      previousSharedHouseholdId: sharedLedgerId,
      privateLedgerId,
      displayName: user.displayName,
      photoURL: user.photoURL,
    });
    if (result.ok && result.householdId) {
      await setVerifiedHouseholdId(result.householdId, result.householdId);
      await refreshHouseholdInvitationsHandler();
      setTrustedRootAccessSnapshot(null);
      dispatch(ledgerActions.resetLedgerState());
    }
    return result;
  }, [dispatch, privateLedgerId, refreshHouseholdInvitationsHandler, setTrustedRootAccessSnapshot, setVerifiedHouseholdId, sharedLedgerId, user]);

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
      await setVerifiedHouseholdId(privateLedgerId, null);
      setTrustedRootAccessSnapshot(null);
      dispatch(ledgerActions.resetLedgerState());
    }
    return result;
  }, [dispatch, householdId, isOwner, privateLedgerId, setTrustedRootAccessSnapshot, setVerifiedHouseholdId, user]);

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
      sharedLedgerId,
      cloudSyncStatus: syncStatus === 'idle' ? 'synced' : syncStatus,
      cloudSetupStatus,
      isCloudBootstrapPending: isCloudBootstrapPending || Boolean(user && !profileLoading && isValidCloudHouseholdId(authHouseholdId) && !hasVerifiedCloudHousehold && !permissionDenied),
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
      sharedLedgerId,
      syncStatus,
      cloudSetupStatus,
      isCloudBootstrapPending,
      authHouseholdId,
      hasVerifiedCloudHousehold,
      permissionDenied,
      profileLoading,
      user,
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
