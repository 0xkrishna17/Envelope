export type SyncFailureReason =
  | 'signed_out'
  | 'needs_import'
  | 'permission_denied'
  | 'conflict'
  | 'network'
  | 'unknown';

export type SyncResult =
  | { ok: true; syncedAt: string; version: number | null; householdId?: string }
  | { ok: false; reason: SyncFailureReason; message: string };

export type SyncMode =
  | 'local_only'
  | 'auth_loading'
  | 'signed_out'
  | 'needs_import'
  | 'connecting'
  | 'subscribed'
  | 'pending_changes'
  | 'syncing'
  | 'synced'
  | 'stale'
  | 'offline'
  | 'permission_denied'
  | 'conflict'
  | 'error';

export interface SyncSessionState {
  mode: SyncMode;
  activeHouseholdDocId: string;
  lastSyncedAt: string | null;
  lastRemoteVersion: number | null;
  pendingLocalChanges: boolean;
  lastError: string | null;
}

export function syncSuccess(syncedAt: string, version: number | null = null): SyncResult {
  return { ok: true, syncedAt, version };
}

export function syncFailure(reason: SyncFailureReason, message: string): SyncResult {
  return { ok: false, reason, message };
}
