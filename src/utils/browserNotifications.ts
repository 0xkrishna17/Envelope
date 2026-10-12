export type ReminderNotificationResult =
  | { ok: true; method: 'window' }
  | { ok: false; reason: 'unsupported' | 'permission_denied' | 'failed'; message: string };

const REMINDER_TITLE = 'Envelope Budgeting — Daily Reminder';
const REMINDER_ICON = '/icon.svg';

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
