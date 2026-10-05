import { createLocalStorageEventStore, LocalEventStore } from './eventStore';
import { projectLedger } from './projectLedger';
import { EventScope, LedgerEvent, ProjectionSeed } from './types';

export interface CloudEventRemote {
  pullEvents(afterRevision: number): Promise<LedgerEvent[]>;
  pushEvents(events: LedgerEvent[]): Promise<void>;
}

export interface CloudEventRuntimeParams {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  scope: Extract<EventScope, { kind: 'cloud' }>;
  seed: ProjectionSeed;
  nowIso: string;
  remote: CloudEventRemote;
}

export interface CloudEventRuntimeResult {
  projected: ReturnType<typeof projectLedger>;
  pulledCount: number;
  pushedCount: number;
}

function maxServerRevision(events: LedgerEvent[], fallback: number): number {
  return events.reduce((max, event) => {
    if (typeof event.serverRevision !== 'number') return max;
    return Math.max(max, event.serverRevision);
  }, fallback);
}

function pendingEvents(store: LocalEventStore, scope: EventScope): LedgerEvent[] {
  return store
    .readEnvelopes(scope)
    .filter(envelope => envelope.syncState !== 'acked')
    .map(envelope => envelope.event);
}

export async function syncCloudEventRuntime(params: CloudEventRuntimeParams): Promise<CloudEventRuntimeResult> {
  const store = createLocalStorageEventStore(params.storage);
  const metadata = store.readMetadata(params.scope);

  const pulledEvents = await params.remote.pullEvents(metadata.lastPulledRemoteRevision);
  if (pulledEvents.length > 0) {
    store.appendEvents(params.scope, pulledEvents, 'acked');
  }

  const eventsToPush = pendingEvents(store, params.scope);
  if (eventsToPush.length > 0) {
    await params.remote.pushEvents(eventsToPush);
    store.markAcked(params.scope, eventsToPush.map(event => event.id), params.nowIso);
  }

  const envelopes = store.readEnvelopes(params.scope);
  const events = envelopes.map(envelope => envelope.event);
  const lastPulledRemoteRevision = maxServerRevision(pulledEvents, metadata.lastPulledRemoteRevision);
  store.writeMetadata(params.scope, {
    ...metadata,
    lastPulledRemoteRevision,
  });

  return {
    projected: projectLedger(events, params.seed),
    pulledCount: pulledEvents.length,
    pushedCount: eventsToPush.length,
  };
}
