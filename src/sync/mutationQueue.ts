import { normalizeHouseholdDocId } from './householdIdentity';

export type MutationCollection =
  | 'members'
  | 'categories'
  | 'salaryEvents'
  | 'allocations'
  | 'transactions'
  | 'reconciliations'
  | 'reconciliationLines'
  | 'envelopeTransfers';

export interface PendingMutation<T = unknown> {
  id: string;
  householdId: string;
  collection: MutationCollection;
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: T;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

const QUEUE_PREFIX = 'env_budget_pending_mutations_v1_';

function sanitizeQueuePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function mutationQueueKey(householdId: string): string {
  return `${QUEUE_PREFIX}${normalizeHouseholdDocId(householdId)}`;
}

export function mutationQueueKeyForUserHousehold(userUid: string, householdId: string): string {
  return `${QUEUE_PREFIX}user_${sanitizeQueuePart(userUid)}_household_${sanitizeQueuePart(normalizeHouseholdDocId(householdId))}`;
}

export function createPendingMutation<T>(params: {
  householdId: string;
  collection: MutationCollection;
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: T;
  nowIso?: string;
}): PendingMutation<T> {
  const createdAt = params.nowIso || new Date().toISOString();
  return {
    id: `${params.collection}_${params.entityId}_${createdAt}`,
    householdId: normalizeHouseholdDocId(params.householdId),
    collection: params.collection,
    entityId: params.entityId,
    operation: params.operation,
    payload: params.payload,
    createdAt,
    retryCount: 0,
  };
}

function readQueueByKey(storage: Pick<Storage, 'getItem'>, key: string): PendingMutation[] {
  const raw = storage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueueByKey(storage: Pick<Storage, 'setItem'>, key: string, queue: PendingMutation[]): void {
  storage.setItem(key, JSON.stringify(queue));
}

function enqueueMutationsByKey(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key: string,
  mutations: PendingMutation[]
): PendingMutation[] {
  if (mutations.length === 0) return readQueueByKey(storage, key);

  const existing = readQueueByKey(storage, key);
  const byEntityOperation = new Map<string, PendingMutation>();

  for (const mutation of existing) {
    byEntityOperation.set(`${mutation.collection}:${mutation.entityId}:${mutation.operation}`, mutation);
  }

  for (const mutation of mutations) {
    byEntityOperation.set(`${mutation.collection}:${mutation.entityId}:${mutation.operation}`, mutation);
  }

  const nextQueue = Array.from(byEntityOperation.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  writeQueueByKey(storage, key, nextQueue);
  return nextQueue;
}

export function readMutationQueue(
  storage: Pick<Storage, 'getItem'>,
  householdId: string
): PendingMutation[] {
  return readQueueByKey(storage, mutationQueueKey(householdId));
}

export function readUserHouseholdMutationQueue(
  storage: Pick<Storage, 'getItem'>,
  userUid: string,
  householdId: string
): PendingMutation[] {
  return readQueueByKey(storage, mutationQueueKeyForUserHousehold(userUid, householdId));
}

export function writeMutationQueue(
  storage: Pick<Storage, 'setItem'>,
  householdId: string,
  queue: PendingMutation[]
): void {
  writeQueueByKey(storage, mutationQueueKey(householdId), queue);
}

export function writeUserHouseholdMutationQueue(
  storage: Pick<Storage, 'setItem'>,
  userUid: string,
  householdId: string,
  queue: PendingMutation[]
): void {
  writeQueueByKey(storage, mutationQueueKeyForUserHousehold(userUid, householdId), queue);
}

export function enqueueMutations(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  householdId: string,
  mutations: PendingMutation[]
): PendingMutation[] {
  return enqueueMutationsByKey(storage, mutationQueueKey(householdId), mutations);
}

export function enqueueUserHouseholdMutations(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  userUid: string,
  householdId: string,
  mutations: PendingMutation[]
): PendingMutation[] {
  return enqueueMutationsByKey(storage, mutationQueueKeyForUserHousehold(userUid, householdId), mutations);
}

export function clearMutationQueue(
  storage: Pick<Storage, 'setItem'>,
  householdId: string
): void {
  writeMutationQueue(storage, householdId, []);
}

export function clearUserHouseholdMutationQueue(
  storage: Pick<Storage, 'setItem'>,
  userUid: string,
  householdId: string
): void {
  writeUserHouseholdMutationQueue(storage, userUid, householdId, []);
}

export function summarizeMutationQueue(queue: PendingMutation[]): {
  pendingCount: number;
  failedCount: number;
  lastError: string | null;
} {
  const failed = queue.filter(item => item.lastError);
  return {
    pendingCount: queue.length,
    failedCount: failed.length,
    lastError: failed[failed.length - 1]?.lastError || null,
  };
}
