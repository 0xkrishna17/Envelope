let sessionDeviceId: string | null = null;
let sessionSequence = 0;

function sanitizeKeyPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function randomDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

export function readOrCreateDeviceId(): string {
  if (!sessionDeviceId) {
    sessionDeviceId = randomDeviceId();
  }
  return sessionDeviceId;
}

export function nextEventSequence(): number {
  sessionSequence += 1;
  return sessionSequence;
}

export function createLedgerEventId(deviceId: string, sequence: number): string {
  return `evt_${sanitizeKeyPart(deviceId)}_${sequence.toString().padStart(12, '0')}`;
}
