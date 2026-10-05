import { describe, expect, it } from 'vitest';
import { INITIAL_CATEGORIES, INITIAL_HOUSEHOLD, INITIAL_MEMBERS } from '../../data/initialData';
import { Allocation, PushSubscriptionSetting, Transaction } from '../../types';
import { ProjectionSeed, LedgerEvent } from './types';
import { createSeedLedgerState, projectLedger } from './projectLedger';

const pushSettings: PushSubscriptionSetting = {
  id: 'push_default',
  user_id: 'usr_me',
  reminder_time: '21:00',
  timezone: 'Asia/Kolkata',
  enabled: false,
  created_at: '2026-09-01T00:00:00Z',
};

const seed: ProjectionSeed = {
  household: INITIAL_HOUSEHOLD,
  members: INITIAL_MEMBERS,
  categories: INITIAL_CATEGORIES,
  pushSettings,
  selectedMonth: '2026-09',
  activeMemberId: 'usr_me',
  firstTimeIntroCompleted: false,
  householdId: 'local',
};

type TransactionAddedEvent = Extract<LedgerEvent, { type: 'transaction.added' }>;
type CategoryFundsAddedEvent = Extract<LedgerEvent, { type: 'category_funds.added' }>;
type ResetEvent = Extract<LedgerEvent, { type: 'ledger.reset_to_zero' }>;
type MemberProfileUpdatedEvent = Extract<LedgerEvent, { type: 'member.profile_updated' }>;

function googleMemberEvent(): MemberProfileUpdatedEvent {
  return {
    id: 'evt_device_000000000004',
    householdId: 'hh_cloud',
    actorUid: 'uid_1',
    actorMemberId: 'uid_1',
    type: 'member.profile_updated',
    payload: {
      member: {
        id: 'mem_uid_1',
        household_id: 'hh_cloud',
        user_id: 'uid_1',
        name: 'Priya',
        role: 'member',
        email: 'priya@example.com',
        joined_at: '2026-10-05T00:00:00.000Z',
      },
    },
    occurredAt: '2026-10-05T00:00:00.000Z',
    schemaVersion: 1,
    deviceId: 'device',
    sequence: 4,
    baseRemoteRevision: null,
  };
}

function transaction(id: string, amount: number, updatedAt = '2026-09-10T00:00:00Z'): Transaction {
  return {
    id,
    household_id: 'local',
    category_id: 'cat_groceries',
    amount,
    date: '2026-09-10',
    logged_by_user_id: 'usr_me',
    payment_method: 'cash',
    reconciliation_status: 'n/a',
    created_at: '2026-09-10T00:00:00Z',
    updated_at: updatedAt,
  };
}

function transactionEvent(params: {
  id?: string;
  sequence?: number;
  serverRevision?: number;
  amount?: number;
  updatedAt?: string;
} = {}): TransactionAddedEvent {
  const sequence = params.sequence || 1;
  return {
    id: params.id || `evt_device_${sequence.toString().padStart(12, '0')}`,
    householdId: 'local',
    actorUid: null,
    actorMemberId: 'usr_me',
    type: 'transaction.added',
    payload: {
      transaction: transaction('tx_1', params.amount || 10000, params.updatedAt),
    },
    occurredAt: '2026-09-10T00:00:00Z',
    schemaVersion: 1,
    deviceId: 'device',
    sequence,
    baseRemoteRevision: null,
    serverRevision: params.serverRevision,
  };
}

function topUpEvent(): CategoryFundsAddedEvent {
  const allocation: Allocation = {
    id: 'alloc_topup_1',
    salary_event_id: 'topup_alloc_topup_1',
    category_id: 'cat_groceries',
    planned_amount: 50000,
    transferred: true,
    transferred_at: '2026-09-10T00:00:00Z',
    created_at: '2026-09-10T00:00:00Z',
    updated_at: '2026-09-10T00:00:00Z',
    source: 'Manual Top-Up',
  };

  return {
    id: 'evt_device_000000000002',
    householdId: 'local',
    actorUid: null,
    actorMemberId: 'usr_me',
    type: 'category_funds.added',
    payload: { allocation },
    occurredAt: '2026-09-10T00:00:00Z',
    schemaVersion: 1,
    deviceId: 'device',
    sequence: 2,
    baseRemoteRevision: null,
  };
}

function resetEvent(): ResetEvent {
  return {
    id: 'evt_device_000000000003',
    householdId: 'local',
    actorUid: null,
    actorMemberId: 'usr_me',
    type: 'ledger.reset_to_zero',
    payload: {
      resetIso: '2026-09-12T00:00:00Z',
      household: INITIAL_HOUSEHOLD,
      members: INITIAL_MEMBERS,
      categories: INITIAL_CATEGORIES,
      pushSettings,
      selectedMonth: '2026-09',
      activeMemberId: 'usr_me',
      firstTimeIntroCompleted: true,
    },
    occurredAt: '2026-09-12T00:00:00Z',
    schemaVersion: 1,
    deviceId: 'device',
    sequence: 3,
    baseRemoteRevision: null,
  };
}

describe('projectLedger', () => {
  it('creates seed state without exposing stale remote data', () => {
    const projected = createSeedLedgerState(seed);

    expect(projected.householdId).toBe('local');
    expect(projected.transactions).toEqual([]);
    expect(projected.allocations).toEqual([]);
    expect(projected.categories).toEqual(INITIAL_CATEGORIES);
  });

  it('applies a transaction event exactly once even if duplicated', () => {
    const event = transactionEvent();
    const projected = projectLedger([event, event], seed);

    expect(projected.transactions).toHaveLength(1);
    expect(projected.transactions[0].id).toBe('tx_1');
    expect(projected.transactions[0].amount).toBe(10000);
  });

  it('applies a category top-up event exactly once even if duplicated', () => {
    const event = topUpEvent();
    const projected = projectLedger([event, event], seed);

    expect(projected.allocations).toHaveLength(1);
    expect(projected.allocations[0].planned_amount).toBe(50000);
  });

  it('keeps projection deterministic for out-of-order remote revisions', () => {
    const first = transactionEvent({
      id: 'evt_remote_000000000010',
      serverRevision: 10,
      amount: 10000,
    });
    const second = transactionEvent({
      id: 'evt_remote_000000000011',
      sequence: 2,
      serverRevision: 11,
      amount: 25000,
      updatedAt: '2026-09-11T00:00:00Z',
    });

    const projected = projectLedger([second, first], seed);

    expect(projected.transactions).toHaveLength(1);
    expect(projected.transactions[0].amount).toBe(25000);
  });

  it('replaces the local member placeholder when a Google profile member is projected', () => {
    const projected = projectLedger([googleMemberEvent()], seed);

    expect(projected.members.map(member => member.user_id)).toEqual(['uid_1']);
    expect(projected.members[0].name).toBe('Priya');
  });

  it('uses reset events as projection boundaries for ledger arrays', () => {
    const projected = projectLedger([transactionEvent(), resetEvent()], seed);

    expect(projected.transactions).toEqual([]);
    expect(projected.allocations).toEqual([]);
    expect(projected.firstTimeIntroCompleted).toBe(true);
    expect(projected.lastResetAt).toBe('2026-09-12T00:00:00Z');
  });
});
