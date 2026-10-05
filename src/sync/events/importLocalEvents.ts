import { Membership } from '../../types';
import { eventSequenceKey } from './eventIds';
import { createLocalStorageEventStore } from './eventStore';
import { EventScope, LedgerEvent } from './types';

const LOCAL_DEFAULT_USER_ID = 'usr_me';

interface ImportActorProfile {
  userUid: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

function mapUserId(value: string, actor: ImportActorProfile): string {
  return value === LOCAL_DEFAULT_USER_ID ? actor.userUid : value;
}

function retargetMember(member: Membership, actor: ImportActorProfile, householdId: string): Membership {
  if (member.user_id !== LOCAL_DEFAULT_USER_ID) {
    return { ...member, household_id: householdId };
  }

  return {
    ...member,
    id: `mem_${actor.userUid}`,
    household_id: householdId,
    user_id: actor.userUid,
    name: actor.name || member.name,
    email: actor.email || member.email,
    avatar_url: actor.avatarUrl || member.avatar_url,
  };
}

function baseEventFields(event: LedgerEvent, cloudScope: Extract<EventScope, { kind: 'cloud' }>, actor: ImportActorProfile) {
  return {
    ...event,
    householdId: cloudScope.householdId,
    actorUid: event.actorUid || cloudScope.userUid,
    actorMemberId: mapUserId(event.actorMemberId, actor),
    baseRemoteRevision: null,
    serverRevision: undefined,
    serverCreatedAt: undefined,
  };
}

export function retargetEventToCloud(params: {
  event: LedgerEvent;
  cloudScope: Extract<EventScope, { kind: 'cloud' }>;
  actorName: string;
  actorEmail?: string;
  actorAvatarUrl?: string;
}): LedgerEvent {
  const actor: ImportActorProfile = {
    userUid: params.cloudScope.userUid,
    name: params.actorName,
    email: params.actorEmail,
    avatarUrl: params.actorAvatarUrl,
  };
  const event = params.event;
  const householdId = params.cloudScope.householdId;

  switch (event.type) {
    case 'ledger.reset_to_zero':
      return {
        ...baseEventFields(event, params.cloudScope, actor),
        type: 'ledger.reset_to_zero',
        payload: {
          ...event.payload,
          household: { ...event.payload.household, id: householdId },
          members: event.payload.members.map(member => retargetMember(member, actor, householdId)),
          categories: event.payload.categories.map(category => ({ ...category, household_id: householdId })),
          pushSettings: { ...event.payload.pushSettings, user_id: mapUserId(event.payload.pushSettings.user_id, actor) },
          activeMemberId: mapUserId(event.payload.activeMemberId, actor),
        },
      };
    case 'household.created':
      return {
        ...baseEventFields(event, params.cloudScope, actor),
        type: 'household.created',
        payload: {
          ...event.payload,
          household: { ...event.payload.household, id: householdId },
          members: event.payload.members.map(member => retargetMember(member, actor, householdId)),
          categories: event.payload.categories.map(category => ({ ...category, household_id: householdId })),
        },
      };
    case 'household.updated':
      return {
        ...baseEventFields(event, params.cloudScope, actor),
        type: 'household.updated',
        payload: { household: { ...event.payload.household, id: householdId } },
      };
    case 'member.profile_updated':
      return {
        ...baseEventFields(event, params.cloudScope, actor),
        type: 'member.profile_updated',
        payload: { member: retargetMember(event.payload.member, actor, householdId) },
      };
    case 'member.deleted':
      return {
        ...baseEventFields(event, params.cloudScope, actor),
        type: 'member.deleted',
        payload: { userId: mapUserId(event.payload.userId, actor) },
      };
    case 'category.created':
    case 'category.updated':
    case 'category.archived':
    case 'category.unarchived':
      return {
        ...baseEventFields(event, params.cloudScope, actor),
        type: event.type,
        payload: { category: { ...event.payload.category, household_id: householdId } },
      };
    case 'category.deleted':
      return { ...baseEventFields(event, params.cloudScope, actor), type: 'category.deleted', payload: event.payload };
    case 'transaction.added':
    case 'transaction.updated':
    case 'transaction.correction_logged':
      return {
        ...baseEventFields(event, params.cloudScope, actor),
        type: event.type,
        payload: {
          transaction: {
            ...event.payload.transaction,
            household_id: householdId,
            logged_by_user_id: mapUserId(event.payload.transaction.logged_by_user_id, actor),
          },
        },
      };
    case 'transaction.deleted':
      return { ...baseEventFields(event, params.cloudScope, actor), type: 'transaction.deleted', payload: event.payload };
    case 'salary.received':
      return {
        ...baseEventFields(event, params.cloudScope, actor),
        type: 'salary.received',
        payload: {
          salaryEvent: {
            ...event.payload.salaryEvent,
            household_id: householdId,
            earner_user_id: mapUserId(event.payload.salaryEvent.earner_user_id, actor),
          },
          allocations: event.payload.allocations,
        },
      };
    case 'allocation.transfer_toggled':
    case 'category_funds.added':
    case 'category_funds.deleted':
      return {
        ...baseEventFields(event, params.cloudScope, actor),
        type: event.type,
        payload: {
          allocation: {
            ...event.payload.allocation,
            logged_by_user_id: event.payload.allocation.logged_by_user_id
              ? mapUserId(event.payload.allocation.logged_by_user_id, actor)
              : event.payload.allocation.logged_by_user_id,
          },
        },
      };
    case 'allocation.all_marked_transferred':
      return { ...baseEventFields(event, params.cloudScope, actor), type: 'allocation.all_marked_transferred', payload: event.payload };
    case 'envelope_transfer.created':
      return {
        ...baseEventFields(event, params.cloudScope, actor),
        type: 'envelope_transfer.created',
        payload: {
          transfer: {
            ...event.payload.transfer,
            household_id: householdId,
            logged_by_user_id: mapUserId(event.payload.transfer.logged_by_user_id, actor),
          },
          allocations: event.payload.allocations,
        },
      };
    case 'envelope_transfer.deleted':
      return { ...baseEventFields(event, params.cloudScope, actor), type: 'envelope_transfer.deleted', payload: event.payload };
    case 'reconciliation.created':
      return {
        ...baseEventFields(event, params.cloudScope, actor),
        type: 'reconciliation.created',
        payload: {
          reconciliation: {
            ...event.payload.reconciliation,
            household_id: householdId,
            logged_by_user_id: mapUserId(event.payload.reconciliation.logged_by_user_id, actor),
          },
          lines: event.payload.lines,
          transactions: event.payload.transactions.map(transaction => ({
            ...transaction,
            household_id: householdId,
            logged_by_user_id: mapUserId(transaction.logged_by_user_id, actor),
          })),
        },
      };
    case 'reconciliation.deleted':
      return {
        ...baseEventFields(event, params.cloudScope, actor),
        type: 'reconciliation.deleted',
        payload: {
          ...event.payload,
          transactions: event.payload.transactions.map(transaction => ({
            ...transaction,
            household_id: householdId,
            logged_by_user_id: mapUserId(transaction.logged_by_user_id, actor),
          })),
        },
      };
    case 'push_settings.updated':
      return {
        ...baseEventFields(event, params.cloudScope, actor),
        type: 'push_settings.updated',
        payload: {
          pushSettings: {
            ...event.payload.pushSettings,
            user_id: mapUserId(event.payload.pushSettings.user_id, actor),
          },
        },
      };
    case 'intro.completed':
      return { ...baseEventFields(event, params.cloudScope, actor), type: 'intro.completed', payload: event.payload };
  }
}

export function importLocalEventsToCloudScope(params: {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  localScope: Extract<EventScope, { kind: 'local' }>;
  cloudScope: Extract<EventScope, { kind: 'cloud' }>;
  actorName: string;
  actorEmail?: string;
  actorAvatarUrl?: string;
}): LedgerEvent[] {
  const store = createLocalStorageEventStore(params.storage);
  const importedEvents = store
    .readEvents(params.localScope)
    .map(event => retargetEventToCloud({
      event,
      cloudScope: params.cloudScope,
      actorName: params.actorName,
      actorEmail: params.actorEmail,
      actorAvatarUrl: params.actorAvatarUrl,
    }));

  if (importedEvents.length === 0) return [];

  store.appendEvents(params.cloudScope, importedEvents, 'pending');
  const maxSequence = importedEvents.reduce((max, event) => Math.max(max, event.sequence), 0);
  const sequenceKey = eventSequenceKey(params.cloudScope);
  const currentCloudSequence = Number(params.storage.getItem(sequenceKey) || '0');
  if (!Number.isFinite(currentCloudSequence) || currentCloudSequence < maxSequence) {
    params.storage.setItem(sequenceKey, String(maxSequence));
  }

  return importedEvents;
}
