import { describe, expect, it } from 'vitest';
import { ledgerEventToFirestoreDocument, firestoreDocumentToLedgerEvent } from './firestoreEvents';
import { LedgerEvent } from './types';

const event: Extract<LedgerEvent, { type: 'transaction.added' }> = {
  id: 'evt_device_000000000001',
  householdId: 'hh_cloud',
  actorUid: 'uid_1',
  actorMemberId: 'usr_me',
  type: 'transaction.added',
  payload: {
    transaction: {
      id: 'tx_1',
      household_id: 'hh_cloud',
      category_id: 'cat_groceries',
      amount: 10000,
      date: '2026-09-10',
      logged_by_user_id: 'usr_me',
      payment_method: 'cash',
      reconciliation_status: 'n/a',
      created_at: '2026-09-10T00:00:00Z',
      updated_at: '2026-09-10T00:00:00Z',
    },
  },
  occurredAt: '2026-09-10T00:00:00Z',
  schemaVersion: 1,
  deviceId: 'device',
  sequence: 1,
  baseRemoteRevision: 4,
};

describe('firestoreEvents', () => {
  it('round-trips a ledger event document', () => {
    const doc = ledgerEventToFirestoreDocument(event);

    expect(doc).toMatchObject({
      id: event.id,
      household_id: 'hh_cloud',
      actor_uid: 'uid_1',
      actor_member_id: 'usr_me',
      type: 'transaction.added',
      occurred_at: '2026-09-10T00:00:00Z',
      schema_version: 1,
      device_id: 'device',
      sequence: 1,
      base_remote_revision: 4,
    });
    expect(firestoreDocumentToLedgerEvent(doc)).toEqual(event);
  });

  it('rejects malformed event documents', () => {
    expect(firestoreDocumentToLedgerEvent({ id: 'evt_1' })).toBeNull();
    expect(firestoreDocumentToLedgerEvent({
      ...ledgerEventToFirestoreDocument(event),
      type: 'unknown.event',
    })).toBeNull();
    expect(firestoreDocumentToLedgerEvent({
      ...ledgerEventToFirestoreDocument(event),
      payload: { wrong: true },
    })).toBeNull();
  });
});
