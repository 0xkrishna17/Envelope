import { EventScope, LedgerEvent, LocalEventEnvelope, SyncWatermark } from './types';

const EVENT_LOG_PREFIX = 'env_budget_event_log_v1_';
const EVENT_META_PREFIX = 'env_budget_event_meta_v1_';

function sanitizeKeyPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function eventScopeKey(scope: EventScope): string {
  if (scope.kind === 'local') return 'local';
  return `user_${sanitizeKeyPart(scope.userUid)}_household_${sanitizeKeyPart(scope.householdId)}`;
}

export function eventLogKey(scope: EventScope): string {
  return `${EVENT_LOG_PREFIX}${eventScopeKey(scope)}`;
}

export function eventMetadataKey(scope: EventScope): string {
  return `${EVENT_META_PREFIX}${eventScopeKey(scope)}`;
}

function compareEvents(a: LedgerEvent, b: LedgerEvent): number {
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

function sortEvents(events: LedgerEvent[]): LedgerEvent[] {
  return [...events].sort(compareEvents);
}

function readEnvelopes(storage: Pick<Storage, 'getItem'>, scope: EventScope): LocalEventEnvelope[] {
  const raw = storage.getItem(eventLogKey(scope));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEnvelopes(
  storage: Pick<Storage, 'setItem'>,
  scope: EventScope,
  envelopes: LocalEventEnvelope[]
): void {
  storage.setItem(eventLogKey(scope), JSON.stringify(envelopes));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function readStringNumberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
  );
}

export interface LocalEventStore {
  readEnvelopes(scope: EventScope): LocalEventEnvelope[];
  readEvents(scope: EventScope): LedgerEvent[];
  appendEvents(scope: EventScope, events: LedgerEvent[], syncState?: LocalEventEnvelope['syncState']): LocalEventEnvelope[];
  markAcked(scope: EventScope, eventIds: string[], ackedAt: string): LocalEventEnvelope[];
  readMetadata(scope: EventScope): SyncWatermark;
  writeMetadata(scope: EventScope, metadata: SyncWatermark): void;
}

export function createLocalStorageEventStore(
  storage: Pick<Storage, 'getItem' | 'setItem'>
): LocalEventStore {
  return {
    readEnvelopes(scope) {
      return readEnvelopes(storage, scope);
    },

    readEvents(scope) {
      return sortEvents(readEnvelopes(storage, scope).map(envelope => envelope.event));
    },

    appendEvents(scope, events, syncState = 'pending') {
      if (events.length === 0) return readEnvelopes(storage, scope);

      const byId = new Map<string, LocalEventEnvelope>();
      for (const envelope of readEnvelopes(storage, scope)) {
        byId.set(envelope.event.id, envelope);
      }

      for (const event of events) {
        const existing = byId.get(event.id);
        if (existing) {
          byId.set(event.id, {
            ...existing,
            event: {
              ...existing.event,
              serverRevision: event.serverRevision ?? existing.event.serverRevision,
              serverCreatedAt: event.serverCreatedAt ?? existing.event.serverCreatedAt,
            },
            syncState: existing.syncState === 'acked' ? 'acked' : syncState,
          });
        } else {
          byId.set(event.id, {
            event,
            syncState,
            createdAt: event.occurredAt,
            retryCount: 0,
          });
        }
      }

      const next = Array.from(byId.values()).sort((a, b) => compareEvents(a.event, b.event));
      writeEnvelopes(storage, scope, next);
      return next;
    },

    markAcked(scope, eventIds, ackedAt) {
      const ackedIds = new Set(eventIds);
      const next = readEnvelopes(storage, scope).map(envelope => {
        if (!ackedIds.has(envelope.event.id)) return envelope;
        const ackedEnvelope: LocalEventEnvelope = {
          ...envelope,
          syncState: 'acked',
          ackedAt,
          lastError: undefined,
        };
        return ackedEnvelope;
      });
      writeEnvelopes(storage, scope, next);
      return next;
    },

    readMetadata(scope) {
      const raw = storage.getItem(eventMetadataKey(scope));
      if (!raw) {
        return {
          householdId: scope.kind === 'cloud' ? scope.householdId : 'local',
          lastPulledRemoteRevision: 0,
          lastAckedLocalSequenceByDevice: {},
        };
      }

      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) {
          return {
            householdId: scope.kind === 'cloud' ? scope.householdId : 'local',
            lastPulledRemoteRevision: 0,
            lastAckedLocalSequenceByDevice: {},
          };
        }
        return {
          householdId: readString(parsed.householdId, scope.kind === 'cloud' ? scope.householdId : 'local'),
          lastPulledRemoteRevision: readNumber(parsed.lastPulledRemoteRevision, 0),
          lastAckedLocalSequenceByDevice: readStringNumberRecord(parsed.lastAckedLocalSequenceByDevice),
        };
      } catch {
        return {
          householdId: scope.kind === 'cloud' ? scope.householdId : 'local',
          lastPulledRemoteRevision: 0,
          lastAckedLocalSequenceByDevice: {},
        };
      }
    },

    writeMetadata(scope, metadata) {
      storage.setItem(eventMetadataKey(scope), JSON.stringify(metadata));
    },
  };
}
