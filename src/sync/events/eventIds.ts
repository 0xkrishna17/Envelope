import { EventScope } from './types';

const DEVICE_ID_KEY = 'env_budget_event_device_id_v1';
const LOCAL_SEQUENCE_KEY = 'env_budget_event_sequence_v1_local';
const CLOUD_SEQUENCE_PREFIX = 'env_budget_event_sequence_v1_cloud_';

function sanitizeKeyPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function randomDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

export function readOrCreateDeviceId(storage: Pick<Storage, 'getItem' | 'setItem'>): string {
  const existing = storage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const deviceId = randomDeviceId();
  storage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export function eventSequenceKey(scope: EventScope): string {
  if (scope.kind === 'local') return LOCAL_SEQUENCE_KEY;
  return `${CLOUD_SEQUENCE_PREFIX}user_${sanitizeKeyPart(scope.userUid)}_household_${sanitizeKeyPart(scope.householdId)}`;
}

export function nextEventSequence(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  scope: EventScope
): number {
  const key = eventSequenceKey(scope);
  const current = Number(storage.getItem(key) || '0');
  const next = Number.isFinite(current) ? current + 1 : 1;
  storage.setItem(key, String(next));
  return next;
}

export function createLedgerEventId(deviceId: string, sequence: number): string {
  return `evt_${sanitizeKeyPart(deviceId)}_${sequence.toString().padStart(12, '0')}`;
}
