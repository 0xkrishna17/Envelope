import { doc, Firestore, getDoc } from 'firebase/firestore';
import { Dispatch, UnknownAction } from '@reduxjs/toolkit';
import { ledgerActions } from '../store/ledgerSlice';
import { db as appDb } from '../lib/firebase';
import { SyncResult, syncFailure, syncSuccess } from './types';
import { isValidCloudHouseholdId, normalizeHouseholdDocId } from './householdIdentity';
import { householdPath } from './firestorePaths';
import { describeErrorCode, logSyncDebug, maskIdentifier } from '../utils/syncDebug';

interface HouseholdRootDocument {
  id: string;
  name: string;
  created_by: string;
  owner_uid?: string;
  owner_email?: string;
  allowed_emails?: string[];
  member_uids?: string[];
  created_at: string;
  updated_at: string;
  first_time_intro_completed?: boolean;
  first_time_intro_completed_at?: string | null;
  sync_version?: number;
}

function getFirestore(): Firestore | null {
  return appDb || null;
}

function requireCloudHouseholdDocId(value: string): string {
  const householdDocId = normalizeHouseholdDocId(value);
  if (!isValidCloudHouseholdId(householdDocId)) {
    throw new Error('Cloud sync requires a generated cloud household id.');
  }
  return householdDocId;
}

function mapFirestoreError(err: unknown): SyncResult {
  const code = describeErrorCode(err);
  const message = err instanceof Error ? err.message : 'Cloud sync failed.';

  if (code === 'permission-denied') {
    return syncFailure('permission_denied', 'This Google account is not allowed to access this household.');
  }

  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return syncFailure('network', 'Cloud sync is temporarily unavailable. Please try again.');
  }

  return syncFailure('unknown', message);
}

export async function loadHouseholdOnce(params: {
  householdDocId: string;
  dispatch: Dispatch<UnknownAction>;
  userUid?: string;
  storage?: Pick<Storage, 'setItem'>;
}): Promise<SyncResult> {
  const firestore = getFirestore();
  if (!firestore) return syncFailure('network', 'Firestore is not available in this environment.');

  const householdDocId = requireCloudHouseholdDocId(params.householdDocId);

  try {
    logSyncDebug('event root load started', { householdId: maskIdentifier(householdDocId) });
    const rootSnapshot = await getDoc(doc(firestore, householdPath(householdDocId)));
    if (!rootSnapshot.exists()) {
      logSyncDebug('event root load missing cloud household', { householdId: maskIdentifier(householdDocId) });
      return syncFailure('needs_import', 'No cloud household exists yet. Create a clean event household before syncing.');
    }

    const root = { id: householdDocId, ...rootSnapshot.data() } as HouseholdRootDocument;
    params.dispatch(ledgerActions.setPermissionDenied(false));
    params.dispatch(ledgerActions.setHousehold({
      id: householdDocId,
      name: root.name,
      created_by: root.created_by,
      owner_uid: root.owner_uid,
      owner_email: root.owner_email,
      allowed_emails: root.allowed_emails || [],
      member_uids: root.member_uids || [],
      created_at: root.created_at,
      updated_at: root.updated_at,
      first_time_intro_completed: Boolean(root.first_time_intro_completed),
      first_time_intro_completed_at: root.first_time_intro_completed_at || undefined,
    }));

    logSyncDebug('event root load received cloud household metadata', {
      householdId: maskIdentifier(householdDocId),
      hasOwnerUid: Boolean(root.owner_uid),
      hasOwnerEmail: Boolean(root.owner_email),
      allowedEmailCount: root.allowed_emails?.length || 0,
    });

    return syncSuccess(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), root.sync_version || 0);
  } catch (err) {
    logSyncDebug('event root load failed', {
      householdId: maskIdentifier(householdDocId),
      errorCode: describeErrorCode(err),
    });
    return mapFirestoreError(err);
  }
}
