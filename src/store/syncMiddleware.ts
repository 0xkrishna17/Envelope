import { Middleware } from '@reduxjs/toolkit';
import { doc, setDoc, onSnapshot, serverTimestamp, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ledgerActions } from './ledgerSlice';
import { RootState, AppDispatch } from './index';

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
  INVITES: 'env_budget_invites_v3',
  PUSH_SETTINGS: 'env_budget_push_settings_v3',
  SELECTED_MONTH: 'env_budget_selected_month_v3',
  HOUSEHOLD_ID: 'env_budget_current_household_id',
};

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let activeFirestoreUnsub: Unsubscribe | null = null;
let currentStoreRef: { getState: () => RootState; dispatch: AppDispatch } | null = null;

// Synchronously push latest store state to Firestore
export async function flushSyncNow(): Promise<void> {
  if (!currentStoreRef) return;
  const state = currentStoreRef.getState().ledger;
  const { householdId, household, categories, salaryEvents, allocations, transactions, reconciliations, reconciliationLines, envelopeTransfers, members, invites, isRemoteSync } = state;

  if (!householdId || isRemoteSync || !db) return;

  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  currentStoreRef.dispatch(ledgerActions.setSyncStatus('syncing'));
  const timeString = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  try {
    const docRef = doc(db, 'households', householdId);
    await setDoc(
      docRef,
      {
        household: {
          ...household,
          id: householdId,
        },
        owner_email: (household.owner_email || '').trim().toLowerCase(),
        allowed_emails: (household.allowed_emails || []).map(e => e.trim().toLowerCase()),
        created_by: household.created_by || '',
        members: members || [],
        categories: categories || [],
        salaryEvents: salaryEvents || [],
        allocations: allocations || [],
        transactions: transactions || [],
        reconciliations: reconciliations || [],
        reconciliationLines: reconciliationLines || [],
        envelopeTransfers: envelopeTransfers || [],
        invites: invites || [],
        first_time_intro_completed: Boolean(household.first_time_intro_completed),
        first_time_intro_completed_at: household.first_time_intro_completed_at || null,
        lastResetAt: state.lastResetAt || null,
        lastSyncedAt: timeString,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    currentStoreRef.dispatch(ledgerActions.setLastCloudSync(timeString));
    currentStoreRef.dispatch(ledgerActions.setSyncStatus('synced'));
  } catch (err: any) {
    console.warn('Firestore cloud sync notice:', err);
    if (err?.code === 'permission-denied') {
      currentStoreRef.dispatch(ledgerActions.setPermissionDenied(true));
    }
    currentStoreRef.dispatch(ledgerActions.setSyncStatus('offline'));
  }
}

// Subscribe to real-time updates from Firestore for a given household ID
export function subscribeToFirestoreHousehold(
  householdId: string,
  userEmail: string | null | undefined,
  dispatch: AppDispatch
): () => void {
  if (activeFirestoreUnsub) {
    activeFirestoreUnsub();
    activeFirestoreUnsub = null;
  }

  if (!householdId || !db) {
    return () => {};
  }

  const docRef = doc(db, 'households', householdId);

  activeFirestoreUnsub = onSnapshot(
    docRef,
    docSnap => {
      dispatch(ledgerActions.setPermissionDenied(false));

      if (docSnap.exists()) {
        const data = docSnap.data();
        dispatch(ledgerActions.setIsRemoteSync(true));
        dispatch(ledgerActions.remoteSnapshotReceived(data));
        setTimeout(() => {
          dispatch(ledgerActions.setIsRemoteSync(false));
        }, 300);
      } else {
        // Document does not exist yet; flush current state to create it
        flushSyncNow();
      }
    },
    error => {
      console.warn('Firestore subscription status notice:', error?.message);
      if (error?.code === 'permission-denied') {
        dispatch(ledgerActions.setPermissionDenied(true));
      }
      dispatch(ledgerActions.setSyncStatus('offline'));
    }
  );

  return () => {
    if (activeFirestoreUnsub) {
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
export const syncMiddleware: Middleware = store => next => action => {
  currentStoreRef = store as any;
  const result = next(action);
  const actionType = (action as any)?.type || '';

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

  const state = (store.getState() as RootState).ledger;

  // 1. Immediately cache to LocalStorage
  try {
    localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, JSON.stringify(state.household));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(state.categories));
    localStorage.setItem(STORAGE_KEYS.SALARY_EVENTS, JSON.stringify(state.salaryEvents));
    localStorage.setItem(STORAGE_KEYS.ALLOCATIONS, JSON.stringify(state.allocations));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
    localStorage.setItem(STORAGE_KEYS.RECONCILIATIONS, JSON.stringify(state.reconciliations));
    localStorage.setItem(STORAGE_KEYS.RECONCILIATION_LINES, JSON.stringify(state.reconciliationLines));
    localStorage.setItem(STORAGE_KEYS.ENVELOPE_TRANSFERS, JSON.stringify(state.envelopeTransfers));
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(state.members));
    localStorage.setItem(STORAGE_KEYS.INVITES, JSON.stringify(state.invites));
    localStorage.setItem(STORAGE_KEYS.PUSH_SETTINGS, JSON.stringify(state.pushSettings));
    localStorage.setItem(STORAGE_KEYS.HOUSEHOLD_ID, state.householdId);

    if (actionType.includes('resetLedgerToZero')) {
      localStorage.setItem('env_budget_tour_completed', 'true');
      localStorage.setItem('env_budget_first_time_intro_done', 'true');
      if (state.lastResetAt) {
        localStorage.setItem('env_budget_last_reset_timestamp', state.lastResetAt);
      }
    }
  } catch (err) {
    console.warn('LocalStorage sync note:', err);
  }

  // 2. Debounced or Immediate Cloud Sync
  if (!state.isRemoteSync && state.householdId) {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }

    if (actionType.includes('resetLedgerToZero')) {
      // Zero reset syncs immediately with zero delay
      flushSyncNow();
    } else {
      // Regular mutations debounce 1200ms
      syncTimer = setTimeout(() => {
        flushSyncNow();
      }, 1200);
    }
  }

  return result;
};
