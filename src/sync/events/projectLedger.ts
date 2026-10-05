import { LedgerState } from '../../store/types';
import { normalizeHouseholdDocId } from '../householdIdentity';
import { sanitizeHousehold } from '../../store/ledgerSlice';
import { LedgerEvent, ProjectionSeed } from './types';

function eventOrder(a: LedgerEvent, b: LedgerEvent): number {
  const revisionA = a.serverRevision ?? Number.MAX_SAFE_INTEGER;
  const revisionB = b.serverRevision ?? Number.MAX_SAFE_INTEGER;
  if (revisionA !== revisionB) return revisionA - revisionB;
  const occurredAt = a.occurredAt.localeCompare(b.occurredAt);
  if (occurredAt !== 0) return occurredAt;
  const device = a.deviceId.localeCompare(b.deviceId);
  if (device !== 0) return device;
  if (a.sequence !== b.sequence) return a.sequence - b.sequence;
  return a.id.localeCompare(b.id);
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const exists = items.some(existing => existing.id === item.id);
  if (exists) {
    return items.map(existing => (existing.id === item.id ? item : existing));
  }
  return [...items, item];
}

function dedupeMembersByUserId(members: LedgerState['members']): LedgerState['members'] {
  const byUserId = new Map<string, LedgerState['members'][number]>();
  for (const member of members) {
    byUserId.set(member.user_id, member);
  }
  return Array.from(byUserId.values());
}

function upsertMemberByUserId(members: LedgerState['members'], member: LedgerState['members'][number]): LedgerState['members'] {
  return dedupeMembersByUserId([
    ...members.filter(existing => existing.user_id !== member.user_id && (member.user_id === 'usr_me' || existing.user_id !== 'usr_me')),
    member,
  ]);
}

function applyEvent(state: LedgerState, event: LedgerEvent): LedgerState {
  switch (event.type) {
    case 'ledger.reset_to_zero': {
      const householdId = normalizeHouseholdDocId(event.payload.household.id || event.householdId);
      return {
        ...state,
        householdId,
        household: sanitizeHousehold({ ...event.payload.household, id: householdId }),
        members: dedupeMembersByUserId(event.payload.members),
        categories: event.payload.categories,
        salaryEvents: [],
        allocations: [],
        transactions: [],
        reconciliations: [],
        reconciliationLines: [],
        envelopeTransfers: [],
        pushSettings: event.payload.pushSettings,
        selectedMonth: event.payload.selectedMonth,
        activeMemberId: event.payload.activeMemberId,
        firstTimeIntroCompleted: event.payload.firstTimeIntroCompleted,
        lastResetAt: event.payload.resetIso,
      };
    }

    case 'household.created': {
      const householdId = normalizeHouseholdDocId(event.payload.household.id || event.householdId);
      return {
        ...state,
        householdId,
        household: sanitizeHousehold({ ...event.payload.household, id: householdId }),
        members: dedupeMembersByUserId(event.payload.members),
        categories: event.payload.categories,
      };
    }

    case 'household.updated': {
      const householdId = normalizeHouseholdDocId(event.payload.household.id || state.householdId);
      return {
        ...state,
        householdId,
        household: sanitizeHousehold({ ...event.payload.household, id: householdId }),
      };
    }

    case 'member.profile_updated':
      return {
        ...state,
        members: upsertMemberByUserId(state.members, event.payload.member),
      };

    case 'member.deleted':
      return {
        ...state,
        members: state.members.filter(member => member.user_id !== event.payload.userId),
      };

    case 'category.created':
    case 'category.updated':
    case 'category.archived':
    case 'category.unarchived':
      return {
        ...state,
        categories: upsertById(state.categories, event.payload.category),
      };

    case 'category.deleted':
      return {
        ...state,
        categories: state.categories.map(category =>
          category.id === event.payload.categoryId
            ? { ...category, is_archived: true, deleted_at: event.payload.deletedAt, updated_at: event.payload.deletedAt }
            : category
        ),
      };

    case 'transaction.added':
    case 'transaction.updated':
    case 'transaction.correction_logged':
      return {
        ...state,
        transactions: upsertById(state.transactions, event.payload.transaction),
      };

    case 'transaction.deleted':
      return {
        ...state,
        transactions: state.transactions.map(transaction =>
          transaction.id === event.payload.transactionId
            ? { ...transaction, deleted_at: event.payload.deletedAt, updated_at: event.payload.deletedAt }
            : transaction
        ),
      };

    case 'salary.received':
      return {
        ...state,
        salaryEvents: upsertById(state.salaryEvents, event.payload.salaryEvent),
        allocations: event.payload.allocations.reduce(
          (allocations, allocation) => upsertById(allocations, allocation),
          state.allocations
        ),
      };

    case 'allocation.transfer_toggled':
    case 'category_funds.added':
    case 'category_funds.deleted':
      return {
        ...state,
        allocations: upsertById(state.allocations, event.payload.allocation),
      };

    case 'allocation.all_marked_transferred':
      return {
        ...state,
        allocations: event.payload.allocations.reduce(
          (allocations, allocation) => upsertById(allocations, allocation),
          state.allocations
        ),
      };

    case 'envelope_transfer.created':
      return {
        ...state,
        envelopeTransfers: upsertById(state.envelopeTransfers, event.payload.transfer),
        allocations: event.payload.allocations.reduce(
          (allocations, allocation) => upsertById(allocations, allocation),
          state.allocations
        ),
      };

    case 'envelope_transfer.deleted':
      return {
        ...state,
        envelopeTransfers: state.envelopeTransfers.map(transfer =>
          transfer.id === event.payload.transferId
            ? { ...transfer, deleted_at: event.payload.deletedAt }
            : transfer
        ),
        allocations: event.payload.allocations.reduce(
          (allocations, allocation) => upsertById(allocations, allocation),
          state.allocations
        ),
      };

    case 'reconciliation.created':
      return {
        ...state,
        reconciliations: upsertById(state.reconciliations, event.payload.reconciliation),
        reconciliationLines: event.payload.lines.reduce(
          (lines, line) => upsertById(lines, line),
          state.reconciliationLines
        ),
        transactions: event.payload.transactions.reduce(
          (transactions, transaction) => upsertById(transactions, transaction),
          state.transactions
        ),
      };

    case 'reconciliation.deleted':
      return {
        ...state,
        reconciliations: state.reconciliations.map(reconciliation =>
          reconciliation.id === event.payload.reconciliationId
            ? { ...reconciliation, deleted_at: event.payload.deletedAt }
            : reconciliation
        ),
        transactions: event.payload.transactions.reduce(
          (transactions, transaction) => upsertById(transactions, transaction),
          state.transactions
        ),
      };

    case 'push_settings.updated':
      return {
        ...state,
        pushSettings: event.payload.pushSettings,
      };

    case 'intro.completed':
      return {
        ...state,
        firstTimeIntroCompleted: event.payload.completed,
      };
  }
}

export function createSeedLedgerState(seed: ProjectionSeed): LedgerState {
  const householdId = normalizeHouseholdDocId(seed.householdId || seed.household.id);
  return {
    household: sanitizeHousehold({ ...seed.household, id: householdId }),
    members: seed.members,
    categories: seed.categories,
    salaryEvents: [],
    allocations: [],
    transactions: [],
    reconciliations: [],
    reconciliationLines: [],
    envelopeTransfers: [],
    selectedMonth: seed.selectedMonth,
    activeMemberId: seed.activeMemberId,
    pushSettings: seed.pushSettings,
    firstTimeIntroCompleted: seed.firstTimeIntroCompleted,
    householdId,
    syncStatus: 'idle',
    lastCloudSync: null,
    permissionDenied: false,
    isRemoteSync: false,
    lastResetAt: null,
  };
}

export function projectLedger(events: LedgerEvent[], seed: ProjectionSeed): LedgerState {
  const seen = new Set<string>();
  const uniqueEvents = events.filter(event => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });

  return [...uniqueEvents]
    .sort(eventOrder)
    .reduce<LedgerState>((state, event) => applyEvent(state, event), createSeedLedgerState(seed));
}
