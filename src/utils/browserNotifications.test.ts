import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showReminderNotification,
} from './browserNotifications';

const originalWindow = globalThis.window;

function setWindowNotification(notificationCtor: unknown) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      Notification: notificationCtor,
    },
  });
}

function restoreWindow(value: typeof originalWindow) {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, 'window');
    return;
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value,
  });
}

describe('browser notification helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    restoreWindow(originalWindow);
  });

  it('reports unsupported when the Notification API is unavailable', () => {
    setWindowNotification(undefined);

    expect(getBrowserNotificationPermission()).toBe('unsupported');
  });

  it('requests notification permission when the browser supports it', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    setWindowNotification({ permission: 'default', requestPermission });

    await expect(requestBrowserNotificationPermission()).resolves.toBe('granted');
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it('shows test reminders through the window Notification constructor when permission is granted', async () => {
    const WindowNotification = vi.fn();
    Object.assign(WindowNotification, { permission: 'granted' });
    setWindowNotification(WindowNotification);

    await expect(showReminderNotification('Payback reminder')).resolves.toEqual({
      ok: true,
      method: 'window',
    });
    expect(WindowNotification).toHaveBeenCalledWith(
      'Envelope Budgeting — Daily Reminder',
      expect.objectContaining({
        body: 'Payback reminder',
        icon: '/icon.svg',
      })
    );
  });

  it('does not attempt native delivery without granted permission', async () => {
    const WindowNotification = vi.fn();
    Object.assign(WindowNotification, { permission: 'default' });
    setWindowNotification(WindowNotification);

    await expect(showReminderNotification('Payback reminder')).resolves.toMatchObject({
      ok: false,
      reason: 'permission_denied',
    });
    expect(WindowNotification).not.toHaveBeenCalled();
  });
});
