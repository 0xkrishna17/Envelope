import {
  AllocationPayload,
  AllocationsPayload,
  CategoryDeletedPayload,
  CategoryPayload,
  EnvelopeTransferCreatedPayload,
  EnvelopeTransferDeletedPayload,
  HouseholdCreatedPayload,
  HouseholdUpdatedPayload,
  IntroCompletedPayload,
  LedgerEvent,
  LedgerEventPayloadByType,
  LedgerEventType,
  LedgerResetToZeroPayload,
  MemberDeletedPayload,
  MemberProfileUpdatedPayload,
  PushSettingsUpdatedPayload,
  ReconciliationCreatedPayload,
  ReconciliationDeletedPayload,
  SalaryReceivedPayload,
  TransactionDeletedPayload,
  TransactionPayload,
} from './types';

export interface FirestoreLedgerEventDocument {
  id: string;
  household_id: string;
  actor_uid: string | null;
  actor_member_id: string;
  type: LedgerEventType;
  payload: LedgerEventPayloadByType[LedgerEventType];
  occurred_at: string;
  schema_version: number;
  device_id: string;
  sequence: number;
  base_remote_revision: number | null;
  server_revision?: number;
  server_created_at?: string;
}

interface FirestoreEventBase {
  id: string;
  householdId: string;
  actorUid: string | null;
  actorMemberId: string;
  occurredAt: string;
  schemaVersion: number;
  deviceId: string;
  sequence: number;
  baseRemoteRevision: number | null;
  serverRevision?: number;
  serverCreatedAt?: string;
}

export function ledgerEventToFirestoreDocument(event: LedgerEvent): FirestoreLedgerEventDocument {
  const document: FirestoreLedgerEventDocument = {
    id: event.id,
    household_id: event.householdId,
    actor_uid: event.actorUid,
    actor_member_id: event.actorMemberId,
    type: event.type,
    payload: event.payload,
    occurred_at: event.occurredAt,
    schema_version: event.schemaVersion,
    device_id: event.deviceId,
    sequence: event.sequence,
    base_remote_revision: event.baseRemoteRevision,
  };

  if (typeof event.serverRevision === 'number') {
    document.server_revision = event.serverRevision;
  }
  if (event.serverCreatedAt) {
    document.server_created_at = event.serverCreatedAt;
  }

  return document;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNullableString(value: unknown): string | null {
  return value === null || typeof value === 'undefined' ? null : readString(value);
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const LEDGER_EVENT_TYPES: Record<LedgerEventType, true> = {
  'ledger.reset_to_zero': true,
  'household.created': true,
  'household.updated': true,
  'member.profile_updated': true,
  'member.deleted': true,
  'category.created': true,
  'category.updated': true,
  'category.archived': true,
  'category.unarchived': true,
  'category.deleted': true,
  'transaction.added': true,
  'transaction.updated': true,
  'transaction.deleted': true,
  'transaction.correction_logged': true,
  'salary.received': true,
  'allocation.transfer_toggled': true,
  'allocation.all_marked_transferred': true,
  'category_funds.added': true,
  'category_funds.deleted': true,
  'envelope_transfer.created': true,
  'envelope_transfer.deleted': true,
  'reconciliation.created': true,
  'reconciliation.deleted': true,
  'push_settings.updated': true,
  'intro.completed': true,
};

function isLedgerEventType(value: string): value is LedgerEventType {
  return value in LEDGER_EVENT_TYPES;
}

function readEventType(value: unknown): LedgerEventType | null {
  if (typeof value !== 'string') return null;
  return isLedgerEventType(value) ? value : null;
}

function hasRecordKey<TKey extends string>(value: unknown, key: TKey): value is Record<TKey, Record<string, unknown>> {
  return isRecord(value) && isRecord(value[key]);
}

function hasStringKey<TKey extends string>(value: unknown, key: TKey): value is Record<TKey, string> {
  return isRecord(value) && typeof value[key] === 'string';
}

function hasBooleanKey<TKey extends string>(value: unknown, key: TKey): value is Record<TKey, boolean> {
  return isRecord(value) && typeof value[key] === 'boolean';
}

function hasArrayKey<TKey extends string>(value: unknown, key: TKey): value is Record<TKey, unknown[]> {
  return isRecord(value) && Array.isArray(value[key]);
}

function isResetPayload(value: unknown): value is LedgerResetToZeroPayload {
  return hasStringKey(value, 'resetIso')
    && hasRecordKey(value, 'household')
    && hasArrayKey(value, 'members')
    && hasArrayKey(value, 'categories')
    && hasRecordKey(value, 'pushSettings')
    && hasStringKey(value, 'selectedMonth')
    && hasStringKey(value, 'activeMemberId')
    && hasBooleanKey(value, 'firstTimeIntroCompleted');
}

function isHouseholdCreatedPayload(value: unknown): value is HouseholdCreatedPayload {
  return hasRecordKey(value, 'household') && hasArrayKey(value, 'members') && hasArrayKey(value, 'categories');
}

function isHouseholdUpdatedPayload(value: unknown): value is HouseholdUpdatedPayload {
  return hasRecordKey(value, 'household');
}

function isMemberProfileUpdatedPayload(value: unknown): value is MemberProfileUpdatedPayload {
  return hasRecordKey(value, 'member');
}

function isMemberDeletedPayload(value: unknown): value is MemberDeletedPayload {
  return hasStringKey(value, 'userId');
}

function isCategoryPayload(value: unknown): value is CategoryPayload {
  return hasRecordKey(value, 'category');
}

function isCategoryDeletedPayload(value: unknown): value is CategoryDeletedPayload {
  return hasStringKey(value, 'categoryId') && hasStringKey(value, 'deletedAt');
}

function isTransactionPayload(value: unknown): value is TransactionPayload {
  return hasRecordKey(value, 'transaction');
}

function isTransactionDeletedPayload(value: unknown): value is TransactionDeletedPayload {
  return hasStringKey(value, 'transactionId') && hasStringKey(value, 'deletedAt');
}

function isSalaryReceivedPayload(value: unknown): value is SalaryReceivedPayload {
  return hasRecordKey(value, 'salaryEvent') && hasArrayKey(value, 'allocations');
}

function isAllocationPayload(value: unknown): value is AllocationPayload {
  return hasRecordKey(value, 'allocation');
}

function isAllocationsPayload(value: unknown): value is AllocationsPayload {
  return hasArrayKey(value, 'allocations');
}

function isEnvelopeTransferCreatedPayload(value: unknown): value is EnvelopeTransferCreatedPayload {
  return hasRecordKey(value, 'transfer') && hasArrayKey(value, 'allocations');
}

function isEnvelopeTransferDeletedPayload(value: unknown): value is EnvelopeTransferDeletedPayload {
  return hasStringKey(value, 'transferId') && hasStringKey(value, 'deletedAt') && hasArrayKey(value, 'allocations');
}

function isReconciliationCreatedPayload(value: unknown): value is ReconciliationCreatedPayload {
  return hasRecordKey(value, 'reconciliation') && hasArrayKey(value, 'lines') && hasArrayKey(value, 'transactions');
}

function isReconciliationDeletedPayload(value: unknown): value is ReconciliationDeletedPayload {
  return hasStringKey(value, 'reconciliationId') && hasStringKey(value, 'deletedAt') && hasArrayKey(value, 'transactions');
}

function isPushSettingsUpdatedPayload(value: unknown): value is PushSettingsUpdatedPayload {
  return hasRecordKey(value, 'pushSettings');
}

function isIntroCompletedPayload(value: unknown): value is IntroCompletedPayload {
  return hasBooleanKey(value, 'completed');
}

function createLedgerEvent(base: FirestoreEventBase, type: LedgerEventType, payload: unknown): LedgerEvent | null {
  switch (type) {
    case 'ledger.reset_to_zero':
      return isResetPayload(payload) ? { ...base, type, payload } : null;
    case 'household.created':
      return isHouseholdCreatedPayload(payload) ? { ...base, type, payload } : null;
    case 'household.updated':
      return isHouseholdUpdatedPayload(payload) ? { ...base, type, payload } : null;
    case 'member.profile_updated':
      return isMemberProfileUpdatedPayload(payload) ? { ...base, type, payload } : null;
    case 'member.deleted':
      return isMemberDeletedPayload(payload) ? { ...base, type, payload } : null;
    case 'category.created':
    case 'category.updated':
    case 'category.archived':
    case 'category.unarchived':
      return isCategoryPayload(payload) ? { ...base, type, payload } : null;
    case 'category.deleted':
      return isCategoryDeletedPayload(payload) ? { ...base, type, payload } : null;
    case 'transaction.added':
    case 'transaction.updated':
    case 'transaction.correction_logged':
      return isTransactionPayload(payload) ? { ...base, type, payload } : null;
    case 'transaction.deleted':
      return isTransactionDeletedPayload(payload) ? { ...base, type, payload } : null;
    case 'salary.received':
      return isSalaryReceivedPayload(payload) ? { ...base, type, payload } : null;
    case 'allocation.transfer_toggled':
    case 'category_funds.added':
    case 'category_funds.deleted':
      return isAllocationPayload(payload) ? { ...base, type, payload } : null;
    case 'allocation.all_marked_transferred':
      return isAllocationsPayload(payload) ? { ...base, type, payload } : null;
    case 'envelope_transfer.created':
      return isEnvelopeTransferCreatedPayload(payload) ? { ...base, type, payload } : null;
    case 'envelope_transfer.deleted':
      return isEnvelopeTransferDeletedPayload(payload) ? { ...base, type, payload } : null;
    case 'reconciliation.created':
      return isReconciliationCreatedPayload(payload) ? { ...base, type, payload } : null;
    case 'reconciliation.deleted':
      return isReconciliationDeletedPayload(payload) ? { ...base, type, payload } : null;
    case 'push_settings.updated':
      return isPushSettingsUpdatedPayload(payload) ? { ...base, type, payload } : null;
    case 'intro.completed':
      return isIntroCompletedPayload(payload) ? { ...base, type, payload } : null;
  }
}

export function firestoreDocumentToLedgerEvent(data: unknown): LedgerEvent | null {
  if (!isRecord(data)) return null;

  const id = readString(data.id);
  const householdId = readString(data.household_id);
  const actorMemberId = readString(data.actor_member_id);
  const type = readEventType(data.type);
  const occurredAt = readString(data.occurred_at);
  const schemaVersion = readNumber(data.schema_version);
  const deviceId = readString(data.device_id);
  const sequence = readNumber(data.sequence);

  if (!id || !householdId || !actorMemberId || !type || !occurredAt || !schemaVersion || !deviceId || sequence === null) {
    return null;
  }

  return createLedgerEvent(
    {
      id,
      householdId,
      actorUid: readNullableString(data.actor_uid),
      actorMemberId,
      occurredAt,
      schemaVersion,
      deviceId,
      sequence,
      baseRemoteRevision: readNumber(data.base_remote_revision),
      serverRevision: readNumber(data.server_revision) ?? undefined,
      serverCreatedAt: readString(data.server_created_at) ?? undefined,
    },
    type,
    data.payload
  );
}
