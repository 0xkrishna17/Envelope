import type { LedgerState } from '../store/types';
import type { SyncResult } from '../sync/types';

const SYNC_DEBUG_STORAGE_KEY = 'env_budget_sync_debug';

export type SyncDebugDetails = Record<string, string | number | boolean | null | undefined>;

function isBrowserDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('syncDebug') === '1' || window.localStorage.getItem(SYNC_DEBUG_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function isSyncDebugEnabled(): boolean {
  return isBrowserDebugEnabled();
}

export function maskIdentifier(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return `${value.slice(0, 2)}…${value.slice(-2)}`;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function hasStringCode(value: unknown): value is { code: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string'
  );
}

export function describeErrorCode(err: unknown): string {
  if (hasStringCode(err)) return err.code || 'unknown';
  return err instanceof Error ? err.name || 'Error' : 'unknown';
}

export function summarizeLedgerForSyncDebug(ledger: LedgerState): SyncDebugDetails {
  return {
    householdId: maskIdentifier(ledger.householdId),
    syncStatus: ledger.syncStatus,
    isRemoteSync: ledger.isRemoteSync,
    hasOwnerUid: Boolean(ledger.household.owner_uid),
    hasOwnerEmail: Boolean(ledger.household.owner_email),
    allowedEmailCount: ledger.household.allowed_emails?.length || 0,
    memberCount: ledger.members.length,
    categoryCount: ledger.categories.length,
    salaryEventCount: ledger.salaryEvents.length,
    allocationCount: ledger.allocations.length,
    transactionCount: ledger.transactions.length,
    reconciliationCount: ledger.reconciliations.length,
    reconciliationLineCount: ledger.reconciliationLines.length,
    envelopeTransferCount: ledger.envelopeTransfers.length,
  };
}

export function summarizeSyncResult(result: SyncResult): SyncDebugDetails {
  if (result.ok) {
    return {
      ok: true,
      syncedAt: result.syncedAt,
      version: result.version,
    };
  }

  return {
    ok: false,
    reason: result.reason,
    message: result.message,
  };
}

export function logSyncDebug(event: string, details: SyncDebugDetails = {}): void {
  if (!isSyncDebugEnabled()) return;
  console.info('[Envelope sync debug]', event, details);
}
