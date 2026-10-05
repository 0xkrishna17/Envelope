import { LedgerState } from '../../store/types';
import { EventScope, LedgerEvent, ProjectionSeed } from './types';
import { createLocalStorageEventStore } from './eventStore';
import { projectLedger } from './projectLedger';

export interface AppendEventAndProjectParams {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  scope: EventScope;
  seed: ProjectionSeed;
  event: LedgerEvent;
}

export function appendEventAndProject(params: AppendEventAndProjectParams): LedgerState {
  return appendEventsAndProject({
    storage: params.storage,
    scope: params.scope,
    seed: params.seed,
    events: [params.event],
  });
}

export function appendEventsAndProject(params: Omit<AppendEventAndProjectParams, 'event'> & { events: LedgerEvent[] }): LedgerState {
  const eventStore = createLocalStorageEventStore(params.storage);
  eventStore.appendEvents(params.scope, params.events);
  return projectLedger(eventStore.readEvents(params.scope), params.seed);
}

export function hasStoredEvents(params: {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  scope: EventScope;
}): boolean {
  const eventStore = createLocalStorageEventStore(params.storage);
  return eventStore.readEvents(params.scope).length > 0;
}

export function projectStoredEvents(params: {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  scope: EventScope;
  seed: ProjectionSeed;
}): LedgerState {
  const eventStore = createLocalStorageEventStore(params.storage);
  return projectLedger(eventStore.readEvents(params.scope), params.seed);
}
