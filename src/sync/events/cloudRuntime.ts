import { SyncResult } from '../types';
import { projectLedger } from './projectLedger';
import { LedgerEvent, ProjectionSeed } from './types';

export interface CloudEventRemote {
  pullEvents(): Promise<LedgerEvent[]>;
  pushEvents(events: LedgerEvent[]): Promise<SyncResult>;
}

export interface CloudEventRuntimeParams {
  seed: ProjectionSeed;
  remote: CloudEventRemote;
}

export interface CloudEventRuntimeResult {
  projected: ReturnType<typeof projectLedger>;
  pulledCount: number;
}

export async function syncCloudEventRuntime(params: CloudEventRuntimeParams): Promise<CloudEventRuntimeResult> {
  const pulledEvents = await params.remote.pullEvents();
  return {
    projected: projectLedger(pulledEvents, params.seed),
    pulledCount: pulledEvents.length,
  };
}

export async function commitCloudEventsAndProject(params: CloudEventRuntimeParams & {
  events: LedgerEvent[];
}): Promise<{ ok: true; projected: ReturnType<typeof projectLedger>; pulledCount: number } | { ok: false; result: SyncResult }> {
  if (params.events.length > 0) {
    const pushResult = await params.remote.pushEvents(params.events);
    if (!pushResult.ok) {
      return { ok: false, result: pushResult };
    }
  }

  const synced = await syncCloudEventRuntime(params);
  return { ok: true, projected: synced.projected, pulledCount: synced.pulledCount };
}
