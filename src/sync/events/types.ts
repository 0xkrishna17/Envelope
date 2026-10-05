import {
  Allocation,
  Category,
  EnvelopeTransfer,
  Household,
  Membership,
  PushSubscriptionSetting,
  Reconciliation,
  ReconciliationLine,
  SalaryEvent,
  Transaction,
} from '../../types';
import { LedgerState } from '../../store/types';

export const LEDGER_EVENT_SCHEMA_VERSION = 1;

export type LedgerEventType = keyof LedgerEventPayloadByType;

export interface LedgerResetToZeroPayload {
  resetIso: string;
  household: Household;
  members: Membership[];
  categories: Category[];
  pushSettings: PushSubscriptionSetting;
  selectedMonth: string;
  activeMemberId: string;
  firstTimeIntroCompleted: boolean;
}

export interface HouseholdCreatedPayload {
  household: Household;
  members: Membership[];
  categories: Category[];
}

export interface HouseholdUpdatedPayload {
  household: Household;
}

export interface MemberProfileUpdatedPayload {
  member: Membership;
}

export interface MemberDeletedPayload {
  userId: string;
}

export interface CategoryPayload {
  category: Category;
}

export interface CategoryDeletedPayload {
  categoryId: string;
  deletedAt: string;
}

export interface TransactionPayload {
  transaction: Transaction;
}

export interface TransactionDeletedPayload {
  transactionId: string;
  deletedAt: string;
}

export interface SalaryReceivedPayload {
  salaryEvent: SalaryEvent;
  allocations: Allocation[];
}

export interface AllocationPayload {
  allocation: Allocation;
}

export interface AllocationsPayload {
  allocations: Allocation[];
}

export interface EnvelopeTransferCreatedPayload {
  transfer: EnvelopeTransfer;
  allocations: Allocation[];
}

export interface EnvelopeTransferDeletedPayload {
  transferId: string;
  deletedAt: string;
  allocations: Allocation[];
}

export interface ReconciliationCreatedPayload {
  reconciliation: Reconciliation;
  lines: ReconciliationLine[];
  transactions: Transaction[];
}

export interface ReconciliationDeletedPayload {
  reconciliationId: string;
  deletedAt: string;
  transactions: Transaction[];
}

export interface PushSettingsUpdatedPayload {
  pushSettings: PushSubscriptionSetting;
}

export interface IntroCompletedPayload {
  completed: boolean;
}

export interface LedgerEventPayloadByType {
  'ledger.reset_to_zero': LedgerResetToZeroPayload;
  'household.created': HouseholdCreatedPayload;
  'household.updated': HouseholdUpdatedPayload;
  'member.profile_updated': MemberProfileUpdatedPayload;
  'member.deleted': MemberDeletedPayload;
  'category.created': CategoryPayload;
  'category.updated': CategoryPayload;
  'category.archived': CategoryPayload;
  'category.unarchived': CategoryPayload;
  'category.deleted': CategoryDeletedPayload;
  'transaction.added': TransactionPayload;
  'transaction.updated': TransactionPayload;
  'transaction.deleted': TransactionDeletedPayload;
  'transaction.correction_logged': TransactionPayload;
  'salary.received': SalaryReceivedPayload;
  'allocation.transfer_toggled': AllocationPayload;
  'allocation.all_marked_transferred': AllocationsPayload;
  'category_funds.added': AllocationPayload;
  'category_funds.deleted': AllocationPayload;
  'envelope_transfer.created': EnvelopeTransferCreatedPayload;
  'envelope_transfer.deleted': EnvelopeTransferDeletedPayload;
  'reconciliation.created': ReconciliationCreatedPayload;
  'reconciliation.deleted': ReconciliationDeletedPayload;
  'push_settings.updated': PushSettingsUpdatedPayload;
  'intro.completed': IntroCompletedPayload;
}

interface LedgerEventBase<TType extends LedgerEventType> {
  id: string;
  householdId: string;
  actorUid: string | null;
  actorMemberId: string;
  type: TType;
  payload: LedgerEventPayloadByType[TType];
  occurredAt: string;
  schemaVersion: number;
  deviceId: string;
  sequence: number;
  baseRemoteRevision: number | null;
  serverRevision?: number;
  serverCreatedAt?: string;
}

export type LedgerEvent = {
  [TType in LedgerEventType]: LedgerEventBase<TType>;
}[LedgerEventType];

export type LocalEventSyncState = 'pending' | 'acked' | 'failed';

export interface LocalEventEnvelope {
  event: LedgerEvent;
  syncState: LocalEventSyncState;
  createdAt: string;
  ackedAt?: string;
  lastError?: string;
  retryCount: number;
}

export interface SyncWatermark {
  householdId: string;
  lastPulledRemoteRevision: number;
  lastAckedLocalSequenceByDevice: Record<string, number>;
}

export type EventScope =
  | { kind: 'local' }
  | { kind: 'cloud'; userUid: string; householdId: string };

export interface ProjectionSeed {
  household: Household;
  members: Membership[];
  categories: Category[];
  pushSettings: PushSubscriptionSetting;
  selectedMonth: string;
  activeMemberId: string;
  firstTimeIntroCompleted: boolean;
  householdId: string;
}
