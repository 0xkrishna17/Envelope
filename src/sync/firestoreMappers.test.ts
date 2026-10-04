import { describe, expect, it } from 'vitest';
import { INITIAL_CATEGORIES, INITIAL_HOUSEHOLD, INITIAL_MEMBERS } from '../data/initialData';
import { LedgerState } from '../store/types';
import {
  createHouseholdRootDocument,
  firestoreDocumentsToLedgerPartial,
  ledgerStateToFirestoreDocuments,
} from './firestoreMappers';
import { LOCAL_HOUSEHOLD_ID } from './householdIdentity';

const baseLedger: LedgerState = {
  household: {
    ...INITIAL_HOUSEHOLD,
    id: 'hh_active',
    owner_uid: 'owner_uid_1',
    owner_email: 'owner@example.com',
    allowed_emails: ['owner@example.com', 'partner@example.com'],
    member_uids: ['owner_uid_1', 'partner_uid_1'],
    created_by: 'owner_uid_1',
  },
  members: INITIAL_MEMBERS,
  categories: INITIAL_CATEGORIES,
  salaryEvents: [],
  allocations: [],
  transactions: [
    {
      id: 'tx_1',
      household_id: 'legacy',
      category_id: 'cat_groceries',
      amount: 10000,
      date: '2026-09-01',
      logged_by_user_id: 'usr_me',
      payment_method: 'cash',
      reconciliation_status: 'n/a',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
  ],
  reconciliations: [],
  reconciliationLines: [],
  envelopeTransfers: [],
  selectedMonth: '2026-09',
  activeMemberId: 'usr_me',
  pushSettings: {
    id: 'push_1',
    user_id: 'usr_me',
    reminder_time: '21:00',
    timezone: 'Asia/Kolkata',
    enabled: false,
    created_at: '2026-09-01T00:00:00Z',
  },
  firstTimeIntroCompleted: false,
  householdId: 'hh_active',
  syncStatus: 'idle',
  lastCloudSync: null,
  permissionDenied: false,
  isRemoteSync: false,
  lastResetAt: null,
};

describe('firestoreMappers', () => {
  it('maps ledger state to Firestore subcollection documents with normalized household ids', () => {
    const docs = ledgerStateToFirestoreDocuments({
      ledger: baseLedger,
      householdDocId: 'hh_active',
      userUid: 'partner_uid_1',
      userEmail: 'partner@example.com',
      syncVersion: 3,
      nowIso: '2026-09-20T00:00:00Z',
    });

    expect(docs.root).toMatchObject({
      id: 'hh_active',
      owner_uid: 'owner_uid_1',
      owner_email: 'owner@example.com',
      created_by: 'owner_uid_1',
      allowed_emails: ['owner@example.com', 'partner@example.com'],
      member_uids: ['owner_uid_1', 'partner_uid_1'],
      updated_by_uid: 'partner_uid_1',
      sync_version: 3,
      schema_version: 2,
    });
    expect(docs.members[0].household_id).toBe('hh_active');
    expect(docs.categories[0].household_id).toBe('hh_active');
    expect(docs.transactions[0].household_id).toBe('hh_active');
  });

  it('creates a new root with the signed-in user as owner only in create mode', () => {
    const root = createHouseholdRootDocument({
      household: {
        ...INITIAL_HOUSEHOLD,
        allowed_emails: [' Partner@Example.com '],
      },
      householdDocId: 'hh_new_cloud',
      userUid: 'new_owner_uid',
      userEmail: 'Owner@Example.com',
      syncVersion: 1,
      nowIso: '2026-09-20T00:00:00Z',
    });

    expect(root.owner_uid).toBe('new_owner_uid');
    expect(root.owner_email).toBe('owner@example.com');
    expect(root.created_by).toBe('new_owner_uid');
    expect(root.allowed_emails).toEqual(['owner@example.com', 'partner@example.com']);
    expect(root.member_uids).toEqual(['new_owner_uid']);
  });

  it('rejects local or reserved household ids for Firestore writes', () => {
    expect(() =>
      ledgerStateToFirestoreDocuments({
        ledger: baseLedger,
        householdDocId: LOCAL_HOUSEHOLD_ID,
        userUid: 'uid_1',
        userEmail: 'owner@example.com',
        syncVersion: 3,
        nowIso: '2026-09-20T00:00:00Z',
      })
    ).toThrow('Cloud sync requires a generated cloud household id.');
  });

  it('maps Firestore docs back to a normalized ledger partial', () => {
    const docs = ledgerStateToFirestoreDocuments({
      ledger: baseLedger,
      householdDocId: 'hh_active',
      userUid: 'uid_1',
      userEmail: 'owner@example.com',
      syncVersion: 3,
      nowIso: '2026-09-20T00:00:00Z',
    });

    const partial = firestoreDocumentsToLedgerPartial({
      root: docs.root,
      docs: {
        members: docs.members,
        categories: docs.categories,
        salaryEvents: docs.salaryEvents,
        allocations: docs.allocations,
        transactions: docs.transactions,
        reconciliations: docs.reconciliations,
        reconciliationLines: docs.reconciliationLines,
        envelopeTransfers: docs.envelopeTransfers,
      },
    });

    expect(partial.householdId).toBe('hh_active');
    expect(partial.household?.id).toBe('hh_active');
    expect(partial.household?.owner_email).toBe('owner@example.com');
    expect(partial.household?.member_uids).toEqual(['owner_uid_1', 'partner_uid_1']);
    expect(partial.transactions?.[0].household_id).toBe('hh_active');
  });

  it('preserves baseline members and envelopes when remote subcollections are empty', () => {
    const docs = ledgerStateToFirestoreDocuments({
      ledger: baseLedger,
      householdDocId: 'hh_active',
      userUid: 'uid_1',
      userEmail: 'owner@example.com',
      syncVersion: 3,
      nowIso: '2026-09-20T00:00:00Z',
    });

    const partial = firestoreDocumentsToLedgerPartial({
      root: docs.root,
      docs: {
        members: [],
        categories: [],
        salaryEvents: [],
        allocations: [],
        transactions: [],
        reconciliations: [],
        reconciliationLines: [],
        envelopeTransfers: [],
      },
    });

    expect(partial.members?.length).toBeGreaterThan(0);
    expect(partial.categories?.length).toBeGreaterThan(0);
    expect(partial.categories?.some(category => category.id === 'cat_groceries')).toBe(true);
    expect(partial.categories?.every(category => category.household_id === 'hh_active')).toBe(true);
  });

  it('maps null first-time intro timestamps to undefined for app state', () => {
    const docs = ledgerStateToFirestoreDocuments({
      ledger: baseLedger,
      householdDocId: 'hh_active',
      userUid: 'uid_1',
      userEmail: 'owner@example.com',
      syncVersion: 3,
      nowIso: '2026-09-20T00:00:00Z',
    });

    const partial = firestoreDocumentsToLedgerPartial({
      root: {
        ...docs.root,
        first_time_intro_completed_at: null,
      },
      docs: {
        members: docs.members,
        categories: docs.categories,
        salaryEvents: docs.salaryEvents,
        allocations: docs.allocations,
        transactions: docs.transactions,
        reconciliations: docs.reconciliations,
        reconciliationLines: docs.reconciliationLines,
        envelopeTransfers: docs.envelopeTransfers,
      },
    });

    expect(partial.household?.first_time_intro_completed_at).toBeUndefined();
  });

  it('persists append-only transaction audit metadata', () => {
    const docs = ledgerStateToFirestoreDocuments({
      ledger: {
        ...baseLedger,
        transactions: [
          {
            ...baseLedger.transactions[0],
            id: 'tx_adj_1',
            ledger_entry_type: 'adjustment',
            related_transaction_id: 'tx_original_1',
          },
        ],
      },
      householdDocId: 'hh_active',
      userUid: 'uid_1',
      userEmail: 'owner@example.com',
      syncVersion: 4,
      nowIso: '2026-09-20T10:00:00Z',
    });

    expect(docs.transactions[0].ledger_entry_type).toBe('adjustment');
    expect(docs.transactions[0].related_transaction_id).toBe('tx_original_1');
  });

  it('omits undefined optional fields from direct category top-up allocations before Firestore writes', () => {
    const docs = ledgerStateToFirestoreDocuments({
      ledger: {
        ...baseLedger,
        allocations: [
          {
            id: 'alloc_env_topup_test',
            salary_event_id: 'env_topup_test',
            category_id: 'cat_groceries',
            planned_amount: 50000,
            transferred: true,
            transferred_at: null,
            created_at: '2026-09-20T12:00:00.000Z',
            updated_at: '2026-09-20T10:00:00.000Z',
            source: 'Manual Top-Up',
            note: undefined,
            logged_by_user_id: 'usr_me',
            deposit_holding: 'secondary_account',
          },
        ],
      },
      householdDocId: 'hh_active',
      userUid: 'uid_1',
      userEmail: 'owner@example.com',
      syncVersion: 4,
      nowIso: '2026-09-20T10:00:00Z',
    });

    expect(Object.prototype.hasOwnProperty.call(docs.allocations[0], 'note')).toBe(false);
    expect(docs.allocations[0].transferred_at).toBeNull();
    expect(docs.allocations[0].logged_by_user_id).toBe('usr_me');
  });

  it('omits undefined optional fields across Firestore subcollection documents', () => {
    const docs = ledgerStateToFirestoreDocuments({
      ledger: {
        ...baseLedger,
        members: [
          {
            id: 'member_1',
            household_id: 'legacy',
            user_id: 'usr_me',
            name: 'Owner',
            role: 'owner',
            avatar_color: '#486B88',
            avatar_url: undefined,
            email: undefined,
            joined_at: '2026-09-01T00:00:00Z',
          },
        ],
        categories: [
          {
            id: 'cat_custom',
            household_id: 'legacy',
            name: 'Custom',
            icon: 'Circle',
            color: 'sage',
            target_amount: undefined,
            is_archived: false,
            is_unallocated: undefined,
            created_at: '2026-09-01T00:00:00Z',
            updated_at: '2026-09-01T00:00:00Z',
          },
        ],
        transactions: [
          {
            id: 'tx_without_note',
            household_id: 'legacy',
            category_id: 'cat_custom',
            amount: 10000,
            date: '2026-09-20',
            logged_by_user_id: 'usr_me',
            payment_method: 'cash',
            note: undefined,
            reconciliation_status: 'n/a',
            created_at: '2026-09-20T00:00:00Z',
            updated_at: '2026-09-20T00:00:00Z',
          },
        ],
        envelopeTransfers: [
          {
            id: 'transfer_without_note',
            household_id: 'legacy',
            from_category_id: 'cat_unallocated',
            to_category_id: 'cat_custom',
            amount: 10000,
            date: '2026-09-20',
            logged_by_user_id: 'usr_me',
            note: undefined,
            created_at: '2026-09-20T00:00:00Z',
          },
        ],
      },
      householdDocId: 'hh_active',
      userUid: 'uid_1',
      userEmail: 'owner@example.com',
      syncVersion: 5,
      nowIso: '2026-09-20T10:00:00Z',
    });

    expect(Object.prototype.hasOwnProperty.call(docs.members[0], 'avatar_url')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(docs.members[0], 'email')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(docs.categories[0], 'target_amount')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(docs.categories[0], 'is_unallocated')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(docs.transactions[0], 'note')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(docs.envelopeTransfers[0], 'note')).toBe(false);
  });
});
