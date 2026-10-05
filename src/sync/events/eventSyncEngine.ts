import {
  collection,
  doc,
  Firestore,
  getDocs,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db as appDb } from '../../lib/firebase';
import { SyncResult, syncFailure, syncSuccess } from '../types';
import { isValidCloudHouseholdId, normalizeHouseholdDocId } from '../householdIdentity';
import { householdEventPath, householdEventsPath } from '../firestorePaths';
import { describeErrorCode } from '../../utils/syncDebug';
import { LedgerEvent } from './types';
import { firestoreDocumentToLedgerEvent, ledgerEventToFirestoreDocument } from './firestoreEvents';

function getFirestore(): Firestore | null {
  return appDb || null;
}

function requireCloudHouseholdDocId(value: string): string {
  const householdDocId = normalizeHouseholdDocId(value);
  if (!isValidCloudHouseholdId(householdDocId)) {
    throw new Error('Event sync requires a generated cloud household id.');
  }
  return householdDocId;
}

function mapFirestoreError(err: unknown): SyncResult {
  const code = describeErrorCode(err);
  const message = err instanceof Error ? err.message : 'Event sync failed.';

  if (code === 'permission-denied') {
    return syncFailure('permission_denied', 'This Google account is not allowed to access this household.');
  }

  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return syncFailure('network', 'Cloud event sync is temporarily unavailable. Please try again.');
  }

  return syncFailure('unknown', message);
}

export async function pushLedgerEvents(params: {
  householdId: string;
  events: LedgerEvent[];
}): Promise<SyncResult> {
  if (params.events.length === 0) {
    return syncSuccess(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), 0);
  }

  const firestore = getFirestore();
  if (!firestore) return syncFailure('unknown', 'Firestore is not configured.');

  try {
    const householdDocId = requireCloudHouseholdDocId(params.householdId);
    const batch = writeBatch(firestore);
    for (const event of params.events) {
      batch.set(
        doc(firestore, householdEventPath(householdDocId, event.id)),
        ledgerEventToFirestoreDocument({ ...event, householdId: householdDocId })
      );
    }
    await batch.commit();
    return syncSuccess(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), 0);
  } catch (err) {
    return mapFirestoreError(err);
  }
}

export async function pullLedgerEvents(params: {
  householdId: string;
  afterRevision?: number;
}): Promise<{ ok: true; events: LedgerEvent[] } | { ok: false; result: SyncResult }> {
  const firestore = getFirestore();
  if (!firestore) return { ok: false, result: syncFailure('unknown', 'Firestore is not configured.') };

  try {
    const householdDocId = requireCloudHouseholdDocId(params.householdId);
    const eventsRef = collection(firestore, householdEventsPath(householdDocId));
    const snapshot = typeof params.afterRevision === 'number' && params.afterRevision > 0
      ? await getDocs(query(eventsRef, where('server_revision', '>', params.afterRevision)))
      : await getDocs(eventsRef);
    const events = snapshot.docs
      .map(item => firestoreDocumentToLedgerEvent(item.data()))
      .filter((event): event is LedgerEvent => event !== null);
    return { ok: true, events };
  } catch (err) {
    return { ok: false, result: mapFirestoreError(err) };
  }
}

export function subscribeToLedgerEvents(params: {
  householdId: string;
  afterRevision?: number;
  onEvents: (events: LedgerEvent[]) => void;
  onError?: (result: SyncResult) => void;
}): Unsubscribe {
  const firestore = getFirestore();
  if (!firestore) return () => {};

  try {
    const householdDocId = requireCloudHouseholdDocId(params.householdId);
    const eventsRef = collection(firestore, householdEventsPath(householdDocId));
    const eventsQuery = typeof params.afterRevision === 'number' && params.afterRevision > 0
      ? query(eventsRef, where('server_revision', '>', params.afterRevision))
      : eventsRef;

    return onSnapshot(
      eventsQuery,
      snapshot => {
        const events = snapshot.docs
          .map(item => firestoreDocumentToLedgerEvent(item.data()))
          .filter((event): event is LedgerEvent => event !== null);
        params.onEvents(events);
      },
      err => {
        params.onError?.(mapFirestoreError(err));
      }
    );
  } catch (err) {
    params.onError?.(mapFirestoreError(err));
    return () => {};
  }
}
