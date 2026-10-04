export type ReminderNotificationResult =
  | { ok: true; method: 'service_worker' | 'window' }
  | { ok: false; reason: 'unsupported' | 'permission_denied' | 'failed'; message: string };

const REMINDER_TITLE = 'Envelope Budgeting — Daily Reminder';
const REMINDER_ICON = '/icon.svg';
const SERVICE_WORKER_READY_TIMEOUT_MS = 1500;

type NotificationConstructorLike = {
  permission: NotificationPermission;
  requestPermission?: () => Promise<NotificationPermission>;
  new(title: string, options?: NotificationOptions): Notification;
};

function getNotificationConstructor(): NotificationConstructorLike | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  return window.Notification as NotificationConstructorLike;
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  const NotificationCtor = getNotificationConstructor();
  return NotificationCtor?.permission ?? 'unsupported';
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  const NotificationCtor = getNotificationConstructor();
  if (!NotificationCtor?.requestPermission) {
    return NotificationCtor?.permission ?? 'unsupported';
  }

  return NotificationCtor.requestPermission();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error('Service worker notification timeout')), timeoutMs);
    promise.then(
      value => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      reason => {
        window.clearTimeout(timeoutId);
        reject(reason);
      }
    );
  });
}

export async function showReminderNotification(body: string): Promise<ReminderNotificationResult> {
  const NotificationCtor = getNotificationConstructor();
  if (!NotificationCtor) {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'This browser does not support notifications.',
    };
  }

  if (NotificationCtor.permission !== 'granted') {
    return {
      ok: false,
      reason: 'permission_denied',
      message: 'Notification permission is not granted for this site.',
    };
  }

  const options: NotificationOptions = {
    body,
    icon: REMINDER_ICON,
    badge: REMINDER_ICON,
    tag: 'envelope-reminder-test',
  };

  try {
    if ('serviceWorker' in navigator) {
      const existingRegistration = await navigator.serviceWorker.getRegistration?.();
      const registration = existingRegistration || (await withTimeout(
        navigator.serviceWorker.ready,
        SERVICE_WORKER_READY_TIMEOUT_MS
      ));
      if ('showNotification' in registration) {
        await registration.showNotification(REMINDER_TITLE, options);
        return { ok: true, method: 'service_worker' };
      }
    }
  } catch {
    // Fall back to the window Notification constructor where supported.
  }

  try {
    new NotificationCtor(REMINDER_TITLE, options);
    return { ok: true, method: 'window' };
  } catch (err) {
    return {
      ok: false,
      reason: 'failed',
      message: err instanceof Error ? err.message : 'The browser could not display the notification.',
    };
  }
}
