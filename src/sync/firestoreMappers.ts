import {
  Allocation,
  Category,
  EnvelopeTransfer,
  Household,
  Membership,
  Reconciliation,
  ReconciliationLine,
  SalaryEvent,
  Transaction,
} from '../types';
import { LedgerState } from '../store/types';
import { INITIAL_CATEGORIES, INITIAL_MEMBERS } from '../data/initialData';
import {
  isValidCloudHouseholdId,
  normalizeHouseholdDocId,
} from './householdIdentity';
import { HouseholdSubcollectionKey } from './firestorePaths';

export const SYNC_SCHEMA_VERSION = 2;

export interface HouseholdRootDocument {
  id: string;
  name: string;
  owner_uid: string;
  owner_email: string;
  allowed_emails: string[];
  member_uids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by_uid: string;
  schema_version: number;
  sync_version: number;
  first_time_intro_completed?: boolean;
  first_time_intro_completed_at?: string | null;
}

export interface FirestoreLedgerDocuments {
  root: HouseholdRootDocument;
  members: Membership[];
  categories: Category[];
  salaryEvents: SalaryEvent[];
  allocations: Allocation[];
  transactions: Transaction[];
  reconciliations: Reconciliation[];
  reconciliationLines: ReconciliationLine[];
  envelopeTransfers: EnvelopeTransfer[];
}

export const SUBCOLLECTION_KEYS: HouseholdSubcollectionKey[] = [
  'members',
  'categories',
  'salaryEvents',
  'allocations',
  'transactions',
  'reconciliations',
  'reconciliationLines',
  'envelopeTransfers',
];

function normalizeScoped<T extends { household_id: string }>(
  items: T[],
  householdDocId: string
): T[] {
  return items.map(item => ({ ...item, household_id: householdDocId }));
}

function normalizeAllowedEmails(emails: string[]): string[] {
  return Array.from(new Set(emails.map(email => email.trim().toLowerCase()).filter(Boolean)));
}

function requireCloudHouseholdDocId(householdDocId: string): string {
  const normalized = normalizeHouseholdDocId(householdDocId);
  if (!isValidCloudHouseholdId(normalized)) {
    throw new Error('Cloud sync requires a generated cloud household id.');
  }
  return normalized;
}

function toFirestoreMember(item: Membership, householdDocId: string): Membership {
  return {
    id: item.id,
    household_id: householdDocId,
    user_id: item.user_id,
    name: item.name,
    role: item.role,
    avatar_color: item.avatar_color,
    joined_at: item.joined_at,
    ...(item.avatar_url !== undefined ? { avatar_url: item.avatar_url } : {}),
    ...(item.email !== undefined ? { email: item.email } : {}),
    ...(item.deleted_at !== undefined ? { deleted_at: item.deleted_at } : {}),
  };
}

function toFirestoreCategory(item: Category, householdDocId: string): Category {
  return {
    id: item.id,
    household_id: householdDocId,
    name: item.name,
    icon: item.icon,
    color: item.color,
    is_archived: item.is_archived,
    created_at: item.created_at,
    updated_at: item.updated_at,
    ...(item.target_amount !== undefined ? { target_amount: item.target_amount } : {}),
    ...(item.is_unallocated !== undefined ? { is_unallocated: item.is_unallocated } : {}),
    ...(item.deleted_at !== undefined ? { deleted_at: item.deleted_at } : {}),
  };
}

function toFirestoreSalaryEvent(item: SalaryEvent, householdDocId: string): SalaryEvent {
  return {
    id: item.id,
    household_id: householdDocId,
    earner_user_id: item.earner_user_id,
    amount: item.amount,
    date: item.date,
    created_at: item.created_at,
  };
}

function toFirestoreAllocation(item: Allocation): Allocation {
  return {
    id: item.id,
    salary_event_id: item.salary_event_id,
    category_id: item.category_id,
    planned_amount: item.planned_amount,
    transferred: item.transferred,
    created_at: item.created_at,
    updated_at: item.updated_at,
    ...(item.transferred_at !== undefined ? { transferred_at: item.transferred_at } : {}),
    ...(item.deleted_at !== undefined ? { deleted_at: item.deleted_at } : {}),
    ...(item.source !== undefined ? { source: item.source } : {}),
    ...(item.note !== undefined ? { note: item.note } : {}),
    ...(item.logged_by_user_id !== undefined ? { logged_by_user_id: item.logged_by_user_id } : {}),
    ...(item.deposit_holding !== undefined ? { deposit_holding: item.deposit_holding } : {}),
  };
}

function toFirestoreTransaction(item: Transaction, householdDocId: string): Transaction {
  return {
    id: item.id,
    household_id: householdDocId,
    category_id: item.category_id,
    amount: item.amount,
    date: item.date,
    logged_by_user_id: item.logged_by_user_id,
    payment_method: item.payment_method,
    reconciliation_status: item.reconciliation_status,
    created_at: item.created_at,
    updated_at: item.updated_at,
    ...(item.note !== undefined ? { note: item.note } : {}),
    ...(item.deleted_at !== undefined ? { deleted_at: item.deleted_at } : {}),
    ...(item.ledger_entry_type !== undefined ? { ledger_entry_type: item.ledger_entry_type } : {}),
    ...(item.related_transaction_id !== undefined ? { related_transaction_id: item.related_transaction_id } : {}),
  };
}

function toFirestoreReconciliation(item: Reconciliation, householdDocId: string): Reconciliation {
  return {
    id: item.id,
    household_id: householdDocId,
    category_id: item.category_id,
    total_amount: item.total_amount,
    date: item.date,
    logged_by_user_id: item.logged_by_user_id,
    created_at: item.created_at,
    ...(item.deleted_at !== undefined ? { deleted_at: item.deleted_at } : {}),
  };
}

function toFirestoreReconciliationLine(item: ReconciliationLine): ReconciliationLine {
  return {
    id: item.id,
    reconciliation_id: item.reconciliation_id,
    transaction_id: item.transaction_id,
    amount_applied: item.amount_applied,
  };
}

function toFirestoreEnvelopeTransfer(item: EnvelopeTransfer, householdDocId: string): EnvelopeTransfer {
  return {
    id: item.id,
    household_id: householdDocId,
    from_category_id: item.from_category_id,
    to_category_id: item.to_category_id,
    amount: item.amount,
    date: item.date,
    logged_by_user_id: item.logged_by_user_id,
    created_at: item.created_at,
    ...(item.note !== undefined ? { note: item.note } : {}),
  };
}

function ensureMembers(items: Membership[], householdDocId: string): Membership[] {
  return normalizeScoped(items.length > 0 ? items : INITIAL_MEMBERS, householdDocId);
}

function ensureCategories(items: Category[], householdDocId: string): Category[] {
  return normalizeScoped(items.length > 0 ? items : INITIAL_CATEGORIES, householdDocId);
}

export function createHouseholdRootDocument(params: {
  household: Household;
  householdDocId: string;
  userUid: string;
  userEmail: string;
  syncVersion: number;
  nowIso: string;
}): HouseholdRootDocument {
  const householdDocId = requireCloudHouseholdDocId(params.householdDocId);
  const ownerEmail = params.userEmail.trim().toLowerCase();
  const allowedEmails = normalizeAllowedEmails([ownerEmail, ...(params.household.allowed_emails || [])]);

  return {
    id: householdDocId,
    name: params.household.name,
    owner_uid: params.userUid,
    owner_email: ownerEmail,
    allowed_emails: allowedEmails,
    member_uids: [params.userUid],
    created_by: params.userUid,
    created_at: params.household.created_at,
    updated_at: params.nowIso,
    updated_by_uid: params.userUid,
    schema_version: SYNC_SCHEMA_VERSION,
    sync_version: params.syncVersion,
    first_time_intro_completed: Boolean(params.household.first_time_intro_completed),
    first_time_intro_completed_at: params.household.first_time_intro_completed_at || null,
  };
}

export function toHouseholdRootDocument(params: {
  household: Household;
  householdDocId: string;
  userUid: string;
  userEmail: string;
  syncVersion: number;
  nowIso: string;
}): HouseholdRootDocument {
  const householdDocId = requireCloudHouseholdDocId(params.householdDocId);
  const ownerUid = params.household.owner_uid || params.household.created_by;
  const ownerEmail = (params.household.owner_email || '').trim().toLowerCase();
  const createdBy = params.household.created_by || ownerUid;

  if (!ownerUid || !ownerEmail || !createdBy) {
    throw new Error('Verified cloud household metadata is required before normal sync.');
  }

  return {
    id: householdDocId,
    name: params.household.name,
    owner_uid: ownerUid,
    owner_email: ownerEmail,
    allowed_emails: normalizeAllowedEmails(params.household.allowed_emails || [ownerEmail]),
    member_uids: Array.from(new Set([ownerUid, ...(params.household.member_uids || [])].filter(Boolean))),
    created_by: createdBy,
    created_at: params.household.created_at,
    updated_at: params.nowIso,
    updated_by_uid: params.userUid,
    schema_version: SYNC_SCHEMA_VERSION,
    sync_version: params.syncVersion,
    first_time_intro_completed: Boolean(params.household.first_time_intro_completed),
    first_time_intro_completed_at: params.household.first_time_intro_completed_at || null,
  };
}

export function ledgerStateToFirestoreDocuments(params: {
  ledger: LedgerState;
  householdDocId: string;
  userUid: string;
  userEmail: string;
  syncVersion: number;
  nowIso: string;
  createRoot?: boolean;
}): FirestoreLedgerDocuments {
  const householdDocId = requireCloudHouseholdDocId(params.householdDocId);
  const root = params.createRoot
    ? createHouseholdRootDocument({
        household: params.ledger.household,
        householdDocId,
        userUid: params.userUid,
        userEmail: params.userEmail,
        syncVersion: params.syncVersion,
        nowIso: params.nowIso,
      })
    : toHouseholdRootDocument({
        household: params.ledger.household,
        householdDocId,
        userUid: params.userUid,
        userEmail: params.userEmail,
        syncVersion: params.syncVersion,
        nowIso: params.nowIso,
      });

  return {
    root,
    members: params.ledger.members.map(item => toFirestoreMember(item, householdDocId)),
    categories: params.ledger.categories.map(item => toFirestoreCategory(item, householdDocId)),
    salaryEvents: params.ledger.salaryEvents.map(item => toFirestoreSalaryEvent(item, householdDocId)),
    allocations: params.ledger.allocations.map(toFirestoreAllocation),
    transactions: params.ledger.transactions.map(item => toFirestoreTransaction(item, householdDocId)),
    reconciliations: params.ledger.reconciliations.map(item => toFirestoreReconciliation(item, householdDocId)),
    reconciliationLines: params.ledger.reconciliationLines.map(toFirestoreReconciliationLine),
    envelopeTransfers: params.ledger.envelopeTransfers.map(item => toFirestoreEnvelopeTransfer(item, householdDocId)),
  };
}

export function firestoreDocumentsToLedgerPartial(params: {
  root: HouseholdRootDocument;
  docs: Omit<FirestoreLedgerDocuments, 'root'>;
}): Partial<LedgerState> {
  const householdDocId = normalizeHouseholdDocId(params.root.id);
  const household: Household = {
    id: householdDocId,
    name: params.root.name,
    created_by: params.root.created_by || params.root.owner_uid,
    owner_uid: params.root.owner_uid,
    owner_email: params.root.owner_email,
    allowed_emails: params.root.allowed_emails || [],
    member_uids: params.root.member_uids || [],
    created_at: params.root.created_at,
    updated_at: params.root.updated_at,
    first_time_intro_completed: params.root.first_time_intro_completed,
    first_time_intro_completed_at: params.root.first_time_intro_completed_at || undefined,
  };

  return {
    householdId: householdDocId,
    household,
    members: ensureMembers(params.docs.members, householdDocId),
    categories: ensureCategories(params.docs.categories, householdDocId),
    salaryEvents: normalizeScoped(params.docs.salaryEvents, householdDocId),
    allocations: params.docs.allocations,
    transactions: normalizeScoped(params.docs.transactions, householdDocId),
    reconciliations: normalizeScoped(params.docs.reconciliations, householdDocId),
    reconciliationLines: params.docs.reconciliationLines,
    envelopeTransfers: normalizeScoped(params.docs.envelopeTransfers, householdDocId),
    firstTimeIntroCompleted: Boolean(params.root.first_time_intro_completed),
  };
}
