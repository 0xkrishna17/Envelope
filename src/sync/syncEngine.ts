import {
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import { Dispatch, UnknownAction } from '@reduxjs/toolkit';
import { LedgerState } from '../store/types';
import { ledgerActions } from '../store/ledgerSlice';
import { db as appDb } from '../lib/firebase';
import { SyncResult, syncFailure, syncSuccess } from './types';
import { isValidCloudHouseholdId, normalizeHouseholdDocId } from './householdIdentity';
import {
  FirestoreLedgerDocuments,
  firestoreDocumentsToLedgerPartial,
  ledgerStateToFirestoreDocuments,
  SUBCOLLECTION_KEYS,
  HouseholdRootDocument,
} from './firestoreMappers';
import { householdSubcollectionPath, householdPath, HouseholdSubcollectionKey } from './firestorePaths';
import { persistUserHouseholdLedgerCache } from './localCache';
import {
  describeErrorCode,
  logSyncDebug,
  maskIdentifier,
  summarizeLedgerForSyncDebug,
} from '../utils/syncDebug';

type SubcollectionDocs = Omit<FirestoreLedgerDocuments, 'root'>;

const lastKnownRemoteVersionByHousehold = new Map<string, number>();

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

function emptySubcollectionDocs(): SubcollectionDocs {
  return {
    members: [],
    categories: [],
    salaryEvents: [],
    allocations: [],
    transactions: [],
    reconciliations: [],
    reconciliationLines: [],
    envelopeTransfers: [],
  };
}

function summarizeSubcollectionDocs(docs: SubcollectionDocs): Record<string, number> {
  return {
    members: docs.members.length,
    categories: docs.categories.length,
    salaryEvents: docs.salaryEvents.length,
    allocations: docs.allocations.length,
    transactions: docs.transactions.length,
    reconciliations: docs.reconciliations.length,
    reconciliationLines: docs.reconciliationLines.length,
    envelopeTransfers: docs.envelopeTransfers.length,
  };
}

function applyLegacyRootArrays(docs: SubcollectionDocs, rootData: Record<string, unknown>): void {
  for (const key of SUBCOLLECTION_KEYS) {
    const values = rootData[key];
    if (Array.isArray(values) && values.length > 0) {
      setSubcollectionDocs(docs, key, values);
    }
  }
}

function setSubcollectionDocs(
  docs: SubcollectionDocs,
  key: HouseholdSubcollectionKey,
  values: unknown[]
): void {
  switch (key) {
    case 'members':
      docs.members = values as SubcollectionDocs['members'];
      return;
    case 'categories':
      docs.categories = values as SubcollectionDocs['categories'];
      return;
    case 'salaryEvents':
      docs.salaryEvents = values as SubcollectionDocs['salaryEvents'];
      return;
    case 'allocations':
      docs.allocations = values as SubcollectionDocs['allocations'];
      return;
    case 'transactions':
      docs.transactions = values as SubcollectionDocs['transactions'];
      return;
    case 'reconciliations':
      docs.reconciliations = values as SubcollectionDocs['reconciliations'];
      return;
    case 'reconciliationLines':
      docs.reconciliationLines = values as SubcollectionDocs['reconciliationLines'];
      return;
    case 'envelopeTransfers':
      docs.envelopeTransfers = values as SubcollectionDocs['envelopeTransfers'];
      return;
  }
}

async function readSubcollection<T>(firestore: Firestore, householdDocId: string, key: HouseholdSubcollectionKey): Promise<T[]> {
  const snapshot = await getDocs(query(collection(firestore, householdSubcollectionPath(householdDocId, key))));
  return snapshot.docs.map(item => item.data() as T);
}

async function readSubcollections(firestore: Firestore, householdDocId: string): Promise<SubcollectionDocs> {
  const [
    members,
    categories,
    salaryEvents,
    allocations,
    transactions,
    reconciliations,
    reconciliationLines,
    envelopeTransfers,
  ] = await Promise.all([
    readSubcollection<SubcollectionDocs['members'][number]>(firestore, householdDocId, 'members'),
    readSubcollection<SubcollectionDocs['categories'][number]>(firestore, householdDocId, 'categories'),
    readSubcollection<SubcollectionDocs['salaryEvents'][number]>(firestore, householdDocId, 'salaryEvents'),
    readSubcollection<SubcollectionDocs['allocations'][number]>(firestore, householdDocId, 'allocations'),
    readSubcollection<SubcollectionDocs['transactions'][number]>(firestore, householdDocId, 'transactions'),
    readSubcollection<SubcollectionDocs['reconciliations'][number]>(firestore, householdDocId, 'reconciliations'),
    readSubcollection<SubcollectionDocs['reconciliationLines'][number]>(firestore, householdDocId, 'reconciliationLines'),
    readSubcollection<SubcollectionDocs['envelopeTransfers'][number]>(firestore, householdDocId, 'envelopeTransfers'),
  ]);

  return {
    members,
    categories,
    salaryEvents,
    allocations,
    transactions,
    reconciliations,
    reconciliationLines,
    envelopeTransfers,
  };
}

function dispatchRemoteLedger(params: {
  dispatch: Dispatch<UnknownAction>;
  householdDocId: string;
  root: HouseholdRootDocument;
  docs: SubcollectionDocs;
}): void {
  const partial = firestoreDocumentsToLedgerPartial({ root: params.root, docs: params.docs });
  logSyncDebug('remote snapshot applying', {
    householdId: maskIdentifier(params.householdDocId),
    remoteVersion: params.root.sync_version || 0,
    updatedByCurrentClient: false,
    ...summarizeSubcollectionDocs(params.docs),
  });
  params.dispatch(ledgerActions.setIsRemoteSync(true));
  params.dispatch(ledgerActions.remoteSnapshotReceived({ ...partial, __householdDocId: params.householdDocId }));
  setTimeout(() => {
    params.dispatch(ledgerActions.setIsRemoteSync(false));
  }, 300);
}

async function commitChunkedWrites(params: {
  firestore: Firestore;
  householdDocId: string;
  documents: FirestoreLedgerDocuments;
}): Promise<void> {
  let batch = writeBatch(params.firestore);
  let operationCount = 0;

  const commitIfNeeded = async (force = false) => {
    if (operationCount > 0 && (force || operationCount >= 450)) {
      await batch.commit();
      batch = writeBatch(params.firestore);
      operationCount = 0;
    }
  };

  batch.set(doc(params.firestore, householdPath(params.householdDocId)), params.documents.root, { merge: true });
  operationCount += 1;
  await commitIfNeeded();

  for (const key of SUBCOLLECTION_KEYS) {
    const docsForKey = params.documents[key];
    const nextIds = new Set(docsForKey.map(item => item.id));
    const existingSnapshot = await getDocs(collection(params.firestore, householdSubcollectionPath(params.householdDocId, key)));
    for (const existingDoc of existingSnapshot.docs) {
      if (!nextIds.has(existingDoc.id)) {
        batch.delete(existingDoc.ref);
        operationCount += 1;
        await commitIfNeeded();
      }
    }

    for (const item of docsForKey) {
      batch.set(
        doc(params.firestore, householdSubcollectionPath(params.householdDocId, key), item.id),
        item,
        { merge: true }
      );
      operationCount += 1;
      await commitIfNeeded();
    }
  }

  await commitIfNeeded(true);
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
    logSyncDebug('load once started', { householdId: maskIdentifier(householdDocId) });
    const rootSnapshot = await getDoc(doc(firestore, householdPath(householdDocId)));
    if (!rootSnapshot.exists()) {
      logSyncDebug('load once missing cloud household', { householdId: maskIdentifier(householdDocId) });
      return syncFailure('needs_import', 'No cloud household exists yet. Import this local ledger to start cloud sync.');
    }

    const rootData = rootSnapshot.data();
    const root = { id: householdDocId, ...rootData } as HouseholdRootDocument;
    const docs = await readSubcollections(firestore, householdDocId);
    applyLegacyRootArrays(docs, rootData);
    logSyncDebug('load once received cloud household', {
      householdId: maskIdentifier(householdDocId),
      remoteVersion: root.sync_version || 0,
      ...summarizeSubcollectionDocs(docs),
    });
    dispatchRemoteLedger({ dispatch: params.dispatch, householdDocId, root, docs });
    lastKnownRemoteVersionByHousehold.set(householdDocId, root.sync_version || 0);

    if (params.storage && params.userUid) {
      const partial = firestoreDocumentsToLedgerPartial({ root, docs });
      persistUserHouseholdLedgerCache(params.storage, params.userUid, householdDocId, partial);
    }

    return syncSuccess(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), root.sync_version || 0);
  } catch (err) {
    logSyncDebug('load once failed', {
      householdId: maskIdentifier(householdDocId),
      errorCode: describeErrorCode(err),
    });
    return mapFirestoreError(err);
  }
}

export async function importLocalLedger(params: {
  ledger: LedgerState;
  householdDocId: string;
  userUid: string;
  userEmail: string;
  storage?: Pick<Storage, 'setItem'>;
}): Promise<SyncResult> {
  const firestore = getFirestore();
  if (!firestore) return syncFailure('network', 'Firestore is not available in this environment.');

  const householdDocId = requireCloudHouseholdDocId(params.householdDocId);

  try {
    const rootRef = doc(firestore, householdPath(householdDocId));
    const rootSnapshot = await getDoc(rootRef);
    if (rootSnapshot.exists()) {
      return syncFailure('conflict', 'This cloud household already exists. Create a new household id or load the existing household first.');
    }

    const nowIso = new Date().toISOString();
    const documents = ledgerStateToFirestoreDocuments({
      ledger: params.ledger,
      householdDocId,
      userUid: params.userUid,
      userEmail: params.userEmail,
      syncVersion: 1,
      nowIso,
      createRoot: true,
    });

    await commitChunkedWrites({ firestore, householdDocId, documents });
    lastKnownRemoteVersionByHousehold.set(householdDocId, 1);

    if (params.storage) {
      persistUserHouseholdLedgerCache(params.storage, params.userUid, householdDocId, {
        ...params.ledger,
        householdId: householdDocId,
        household: {
          ...params.ledger.household,
          id: householdDocId,
          name: documents.root.name,
          created_by: documents.root.created_by,
          owner_uid: documents.root.owner_uid,
          owner_email: documents.root.owner_email,
          allowed_emails: documents.root.allowed_emails,
          member_uids: documents.root.member_uids,
          created_at: documents.root.created_at,
          updated_at: documents.root.updated_at,
          first_time_intro_completed: documents.root.first_time_intro_completed,
          first_time_intro_completed_at: documents.root.first_time_intro_completed_at || undefined,
        },
      });
    }

    return syncSuccess(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), 1);
  } catch (err) {
    logSyncDebug('import failed', {
      householdId: maskIdentifier(householdDocId),
      errorCode: describeErrorCode(err),
    });
    return mapFirestoreError(err);
  }
}

export async function flushLocalChanges(params: {
  ledger: LedgerState;
  householdDocId: string;
  userUid: string;
  userEmail: string;
  storage?: Pick<Storage, 'setItem'>;
  requireVersionMatch?: boolean;
}): Promise<SyncResult> {
  const firestore = getFirestore();
  if (!firestore) return syncFailure('network', 'Firestore is not available in this environment.');

  const householdDocId = requireCloudHouseholdDocId(params.householdDocId);

  try {
    logSyncDebug('flush engine started', summarizeLedgerForSyncDebug({
      ...params.ledger,
      householdId: householdDocId,
    }));
    const rootRef = doc(firestore, householdPath(householdDocId));
    const rootSnapshot = await getDoc(rootRef);
    const remoteVersion = rootSnapshot.exists()
      ? Number((rootSnapshot.data() as Partial<HouseholdRootDocument>).sync_version || 0)
      : 0;
    const expectedVersion = lastKnownRemoteVersionByHousehold.get(householdDocId);
    logSyncDebug('flush version check', {
      householdId: maskIdentifier(householdDocId),
      remoteVersion,
      expectedVersion: expectedVersion ?? null,
      requireVersionMatch: params.requireVersionMatch !== false,
      cloudDocumentExists: rootSnapshot.exists(),
    });

    if (params.requireVersionMatch !== false && expectedVersion !== undefined && remoteVersion !== expectedVersion) {
      logSyncDebug('flush conflict detected', {
        householdId: maskIdentifier(householdDocId),
        remoteVersion,
        expectedVersion,
      });
      return syncFailure(
        'conflict',
        'This ledger changed on another device. Reload the latest cloud copy, then retry your change.'
      );
    }

    const nextVersion = remoteVersion + 1;
    const nowIso = new Date().toISOString();
    const documents = ledgerStateToFirestoreDocuments({
      ledger: params.ledger,
      householdDocId,
      userUid: params.userUid,
      userEmail: params.userEmail,
      syncVersion: nextVersion,
      nowIso,
    });
    logSyncDebug('flush committing batch', {
      householdId: maskIdentifier(householdDocId),
      nextVersion,
      ...summarizeSubcollectionDocs(documents),
    });

    await commitChunkedWrites({ firestore, householdDocId, documents });
    lastKnownRemoteVersionByHousehold.set(householdDocId, nextVersion);
    logSyncDebug('flush commit succeeded', {
      householdId: maskIdentifier(householdDocId),
      nextVersion,
    });

    if (params.storage) {
      persistUserHouseholdLedgerCache(params.storage, params.userUid, householdDocId, {
        ...params.ledger,
        householdId: householdDocId,
        household: { ...params.ledger.household, id: householdDocId },
      });
    }

    return syncSuccess(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), nextVersion);
  } catch (err) {
    logSyncDebug('flush failed', {
      householdId: maskIdentifier(householdDocId),
      errorCode: describeErrorCode(err),
    });
    return mapFirestoreError(err);
  }
}

export function subscribeToHousehold(params: {
  householdDocId: string;
  dispatch: Dispatch<UnknownAction>;
  userUid?: string;
  onPermissionDenied?: () => void;
  onError?: () => void;
  storage?: Pick<Storage, 'setItem'>;
}): Unsubscribe {
  const firestore = getFirestore();
  if (!firestore) return () => {};

  const householdDocId = requireCloudHouseholdDocId(params.householdDocId);
  let root: HouseholdRootDocument | null = null;
  const docs = emptySubcollectionDocs();
  let applying = false;
  const unsubs: Unsubscribe[] = [];

  const apply = () => {
    if (!root || applying) return;
    applying = true;
    setTimeout(() => {
      if (!root) {
        applying = false;
        return;
      }
      dispatchRemoteLedger({ dispatch: params.dispatch, householdDocId, root, docs });
      lastKnownRemoteVersionByHousehold.set(householdDocId, root.sync_version || 0);
      if (params.storage && params.userUid) {
        const partial = firestoreDocumentsToLedgerPartial({ root, docs });
        persistUserHouseholdLedgerCache(params.storage, params.userUid, householdDocId, partial);
      }
      applying = false;
    }, 100);
  };

  unsubs.push(
    onSnapshot(
      doc(firestore, householdPath(householdDocId)),
      snapshot => {
        params.dispatch(ledgerActions.setPermissionDenied(false));
        if (!snapshot.exists()) {
          logSyncDebug('root snapshot missing', { householdId: maskIdentifier(householdDocId) });
          root = null;
          return;
        }
        const rootData = snapshot.data();
        root = { id: householdDocId, ...rootData } as HouseholdRootDocument;
        logSyncDebug('root snapshot received', {
          householdId: maskIdentifier(householdDocId),
          remoteVersion: root.sync_version || 0,
          hasOwnerUid: Boolean(root.owner_uid),
          hasOwnerEmail: Boolean(root.owner_email),
          allowedEmailCount: root.allowed_emails?.length || 0,
        });
        applyLegacyRootArrays(docs, rootData);
        apply();
      },
      err => {
        logSyncDebug('root snapshot error', {
          householdId: maskIdentifier(householdDocId),
          errorCode: describeErrorCode(err),
        });
        if (err?.code === 'permission-denied') {
          params.dispatch(ledgerActions.setPermissionDenied(true));
          params.onPermissionDenied?.();
        }
        params.onError?.();
      }
    )
  );

  for (const key of SUBCOLLECTION_KEYS) {
    unsubs.push(
      onSnapshot(
        collection(firestore, householdSubcollectionPath(householdDocId, key)),
        snapshot => {
          logSyncDebug('subcollection snapshot received', {
            householdId: maskIdentifier(householdDocId),
            collection: key,
            documentCount: snapshot.docs.length,
          });
          setSubcollectionDocs(
            docs,
            key,
            snapshot.docs.map(item => item.data())
          );
          apply();
        },
        err => {
          logSyncDebug('subcollection snapshot error', {
            householdId: maskIdentifier(householdDocId),
            collection: key,
            errorCode: describeErrorCode(err),
          });
          if (err?.code === 'permission-denied') {
            params.dispatch(ledgerActions.setPermissionDenied(true));
            params.onPermissionDenied?.();
          }
          params.onError?.();
        }
      )
    );
  }

  return () => {
    logSyncDebug('engine subscription cleanup', { householdId: maskIdentifier(householdDocId) });
    for (const unsub of unsubs) unsub();
  };
}
