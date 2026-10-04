import { Dispatch, Middleware, UnknownAction } from '@reduxjs/toolkit';
import { Unsubscribe } from 'firebase/firestore';
import { ledgerActions } from './ledgerSlice';
import { LedgerState } from './types';
import { SyncResult, syncFailure } from '../sync/types';
import { flushLocalChanges, subscribeToHousehold } from '../sync/syncEngine';
import {
  clearMutationQueue,
  clearUserHouseholdMutationQueue,
  enqueueMutations,
  enqueueUserHouseholdMutations,
} from '../sync/mutationQueue';
import { mapLedgerActionToPendingMutations } from '../sync/mutationMapper';
import { isValidCloudHouseholdId } from '../sync/householdIdentity';
import { persistLocalLedgerCache, persistUserHouseholdLedgerCache } from '../sync/localCache';
import {
  logSyncDebug,
  maskIdentifier,
  summarizeLedgerForSyncDebug,
  summarizeSyncResult,
} from '../utils/syncDebug';

export const STORAGE_KEYS = {
  HOUSEHOLD: 'env_budget_household_v3',
  CATEGORIES: 'env_budget_categories_v3',
  SALARY_EVENTS: 'env_budget_salary_events_v3',
  ALLOCATIONS: 'env_budget_allocations_v3',
  TRANSACTIONS: 'env_budget_transactions_v3',
  RECONCILIATIONS: 'env_budget_reconciliations_v3',
  RECONCILIATION_LINES: 'env_budget_reconciliation_lines_v3',
  ENVELOPE_TRANSFERS: 'env_budget_envelope_transfers_v3',
  MEMBERS: 'env_budget_members_v3',
  PUSH_SETTINGS: 'env_budget_push_settings_v3',
  SELECTED_MONTH: 'env_budget_selected_month_v3',
  HOUSEHOLD_ID: 'env_budget_current_household_id',
};

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let activeFirestoreUnsub: Unsubscribe | null = null;

type LedgerStoreFacade = {
  getState: () => { ledger: LedgerState };
  dispatch: Dispatch<UnknownAction>;
};

let currentStoreRef: LedgerStoreFacade | null = null;

interface SyncAuthState {
  uid: string | null;
  email: string | null;
  isAccessAllowed: boolean;
}

let syncAuthState: SyncAuthState = {
  uid: null,
  email: null,
  isAccessAllowed: false,
};

function isUnknownAction(action: unknown): action is UnknownAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'type' in action &&
    typeof action.type === 'string'
  );
}

export function configureSyncAuth(nextAuthState: SyncAuthState): void {
  syncAuthState = {
    uid: nextAuthState.uid,
    email: nextAuthState.email ? nextAuthState.email.trim().toLowerCase() : null,
    isAccessAllowed: nextAuthState.isAccessAllowed,
  };
  logSyncDebug('auth configured', {
    hasUid: Boolean(syncAuthState.uid),
    hasEmail: Boolean(syncAuthState.email),
    isAccessAllowed: syncAuthState.isAccessAllowed,
    canReadFirestore: canReadFirestore(),
    canUseFirestoreSync: canUseFirestoreSync(),
  });
}

function canReadFirestore(): boolean {
  return Boolean(syncAuthState.uid && syncAuthState.email);
}

function canUseFirestoreSync(householdId?: string | null): boolean {
  return Boolean(
    canReadFirestore() &&
    syncAuthState.isAccessAllowed &&
    (!householdId || isValidCloudHouseholdId(householdId))
  );
}

// Synchronously push latest store state to Firestore
export async function flushSyncNow(): Promise<SyncResult> {
  if (!currentStoreRef) {
    const result = syncFailure('unknown', 'Sync store is not ready yet.');
    logSyncDebug('flush skipped: store not ready', summarizeSyncResult(result));
    return result;
  }
  const state = currentStoreRef.getState().ledger;
  const { householdId, isRemoteSync } = state;

  if (!householdId) {
    const result = syncFailure('unknown', 'No active household is selected for sync.');
    logSyncDebug('flush skipped: missing household', summarizeSyncResult(result));
    return result;
  }
  if (!canUseFirestoreSync(householdId)) {
    const result = syncFailure(syncAuthState.uid ? 'needs_import' : 'signed_out', 'Create or join a cloud household before syncing to cloud.');
    logSyncDebug('flush skipped: firestore gate closed', {
      ...summarizeSyncResult(result),
      householdId: maskIdentifier(householdId),
      hasUid: Boolean(syncAuthState.uid),
      hasEmail: Boolean(syncAuthState.email),
      isAccessAllowed: syncAuthState.isAccessAllowed,
      isValidCloudHouseholdId: isValidCloudHouseholdId(householdId),
    });
    return result;
  }
  if (isRemoteSync) {
    const result = syncFailure('unknown', 'Remote snapshot replay does not need a cloud write.');
    logSyncDebug('flush skipped: remote snapshot replay', {
      ...summarizeSyncResult(result),
      householdId: maskIdentifier(householdId),
    });
    return result;
  }
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  logSyncDebug('flush started', summarizeLedgerForSyncDebug(state));
  currentStoreRef.dispatch(ledgerActions.setSyncStatus('syncing'));
  const result = await flushLocalChanges({
    ledger: state,
    householdDocId: householdId,
    userUid: syncAuthState.uid || '',
    userEmail: syncAuthState.email || '',
    storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
  });
  logSyncDebug('flush finished', {
    ...summarizeSyncResult(result),
    householdId: maskIdentifier(householdId),
  });

  if (result.ok) {
    if (typeof localStorage !== 'undefined') {
      if (syncAuthState.uid) {
        clearUserHouseholdMutationQueue(localStorage, syncAuthState.uid, householdId);
      } else {
        clearMutationQueue(localStorage, householdId);
      }
    }
    currentStoreRef.dispatch(ledgerActions.setLastCloudSync(result.syncedAt));
    currentStoreRef.dispatch(ledgerActions.setSyncStatus('synced'));
  } else {
    if (result.reason === 'permission_denied') {
      currentStoreRef.dispatch(ledgerActions.setPermissionDenied(true));
    }
    currentStoreRef.dispatch(ledgerActions.setSyncStatus(result.reason === 'conflict' ? 'error' : 'offline'));
  }

  return result;
}

// Subscribe to real-time updates from Firestore for a given household ID
export function subscribeToFirestoreHousehold(
  householdId: string,
  userEmail: string | null | undefined,
  dispatch: Dispatch<UnknownAction>
): () => void {
  if (activeFirestoreUnsub) {
    logSyncDebug('subscription replaced', { householdId: maskIdentifier(householdId) });
    activeFirestoreUnsub();
    activeFirestoreUnsub = null;
  }

  if (!householdId || !userEmail || !canReadFirestore()) {
    logSyncDebug('subscription skipped: firestore read gate closed', {
      householdId: maskIdentifier(householdId),
      hasUserEmail: Boolean(userEmail),
      canReadFirestore: canReadFirestore(),
    });
    return () => {};
  }

  logSyncDebug('subscription started', {
    householdId: maskIdentifier(householdId),
    hasUserEmail: Boolean(userEmail),
    isAccessAllowed: syncAuthState.isAccessAllowed,
  });
  activeFirestoreUnsub = subscribeToHousehold({
    householdDocId: householdId,
    dispatch,
    userUid: syncAuthState.uid || undefined,
    storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
    onPermissionDenied: () => {
      logSyncDebug('subscription permission denied', { householdId: maskIdentifier(householdId) });
      dispatch(ledgerActions.setSyncStatus('offline'));
    },
    onError: () => {
      logSyncDebug('subscription error', { householdId: maskIdentifier(householdId) });
      dispatch(ledgerActions.setSyncStatus('offline'));
    },
  });

  return () => {
    if (activeFirestoreUnsub) {
      logSyncDebug('subscription stopped', { householdId: maskIdentifier(householdId) });
      activeFirestoreUnsub();
      activeFirestoreUnsub = null;
    }
  };
}

// Window BeforeUnload handler to guarantee store sync on tab close or refresh
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    flushSyncNow();
  });
}

// Redux Middleware: intercepts ledger actions, saves to LocalStorage, debounces Firestore sync
export const syncMiddleware: Middleware<unknown, { ledger: LedgerState }, Dispatch<UnknownAction>> = store => next => action => {
  currentStoreRef = store;
  const result = next(action);
  const ledgerAction = isUnknownAction(action) ? action : { type: '' };
  const actionType = typeof ledgerAction.type === 'string' ? ledgerAction.type : '';

  // Filter out internal sync actions to avoid recursive loops
  if (
    actionType.startsWith('ledger/setSyncStatus') ||
    actionType.startsWith('ledger/setLastCloudSync') ||
    actionType.startsWith('ledger/setPermissionDenied') ||
    actionType.startsWith('ledger/setIsRemoteSync') ||
    actionType.startsWith('ledger/hydrateFromStorage') ||
    actionType.startsWith('ledger/remoteSnapshotReceived')
  ) {
    return result;
  }

  const state = store.getState().ledger;

  // 1. Immediately cache to scoped LocalStorage
  try {
    if (syncAuthState.uid && canUseFirestoreSync(state.householdId)) {
      persistUserHouseholdLedgerCache(localStorage, syncAuthState.uid, state.householdId, state);
    } else {
      persistLocalLedgerCache(localStorage, state);
    }

    if (actionType.includes('resetLedgerToZero')) {
      localStorage.setItem('env_budget_tour_completed', 'true');
      localStorage.setItem('env_budget_first_time_intro_done', 'true');
      if (state.lastResetAt) {
        localStorage.setItem('env_budget_last_reset_timestamp', state.lastResetAt);
      }
    }
  } catch (err) {
    console.warn('LocalStorage sync note:', err);
    logSyncDebug('local cache write failed', { actionType });
  }

  let queuedMutationCount = 0;
  try {
    if (!state.isRemoteSync && typeof localStorage !== 'undefined') {
      const pendingMutations = mapLedgerActionToPendingMutations(ledgerAction, state);
      queuedMutationCount = pendingMutations.length;
      if (pendingMutations.length > 0) {
        const queue = syncAuthState.uid
          ? enqueueUserHouseholdMutations(localStorage, syncAuthState.uid, state.householdId, pendingMutations)
          : enqueueMutations(localStorage, state.householdId, pendingMutations);
        logSyncDebug('mutation queued', {
          actionType,
          queuedMutationCount,
          totalPendingMutations: queue.length,
          householdId: maskIdentifier(state.householdId),
        });
      }
    }
  } catch (err) {
    console.warn('Mutation queue note:', err);
    logSyncDebug('mutation queue failed', { actionType });
  }

  // 2. Debounced or Immediate Cloud Sync
  const canSyncActiveHousehold = canUseFirestoreSync(state.householdId);
  if (!state.isRemoteSync && state.householdId && canSyncActiveHousehold) {
    if (syncTimer) {
      logSyncDebug('debounced flush replaced', { actionType, householdId: maskIdentifier(state.householdId) });
      clearTimeout(syncTimer);
      syncTimer = null;
    }

    if (actionType.includes('resetLedgerToZero')) {
      // Zero reset syncs immediately with zero delay
      logSyncDebug('immediate flush scheduled', { actionType, householdId: maskIdentifier(state.householdId) });
      flushSyncNow();
    } else {
      // Regular mutations debounce 1200ms
      logSyncDebug('debounced flush scheduled', {
        actionType,
        queuedMutationCount,
        householdId: maskIdentifier(state.householdId),
        delayMs: 1200,
      });
      syncTimer = setTimeout(() => {
        flushSyncNow();
      }, 1200);
    }
  } else {
    logSyncDebug('cloud flush not scheduled', {
      actionType,
      isRemoteSync: state.isRemoteSync,
      hasHouseholdId: Boolean(state.householdId),
      canUseFirestoreSync: canSyncActiveHousehold,
      hasUid: Boolean(syncAuthState.uid),
      hasEmail: Boolean(syncAuthState.email),
      isAccessAllowed: syncAuthState.isAccessAllowed,
    });
  }

  return result;
};
