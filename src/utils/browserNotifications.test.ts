import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showReminderNotification,
} from './browserNotifications';

const originalWindow = globalThis.window;
const originalNavigator = globalThis.navigator;

function setWindowNotification(notificationCtor: unknown) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      Notification: notificationCtor,
      clearTimeout,
      setTimeout,
    },
  });
}

function setNavigatorServiceWorker(serviceWorker: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker,
    },
  });
}

function restoreGlobalProperty(name: 'window' | 'navigator', value: unknown) {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }

  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
  });
}

describe('browser notification helpers', () => {
  beforeEach(() => {
    setNavigatorServiceWorker(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreGlobalProperty('window', originalWindow);
    restoreGlobalProperty('navigator', originalNavigator);
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

  it('shows test reminders through the service worker when permission is granted', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const WindowNotification = vi.fn();
    Object.assign(WindowNotification, { permission: 'granted' });
    setWindowNotification(WindowNotification);
    setNavigatorServiceWorker({
      getRegistration: vi.fn().mockResolvedValue({ showNotification }),
      ready: Promise.resolve({ showNotification }),
    });

    await expect(showReminderNotification('Payback reminder')).resolves.toEqual({
      ok: true,
      method: 'service_worker',
    });
    expect(showNotification).toHaveBeenCalledWith(
      'Envelope Budgeting — Daily Reminder',
      expect.objectContaining({
        body: 'Payback reminder',
        icon: '/icon.svg',
      })
    );
    expect(WindowNotification).not.toHaveBeenCalled();
  });

  it('falls back to the window Notification constructor when service worker delivery fails', async () => {
    const WindowNotification = vi.fn();
    Object.assign(WindowNotification, { permission: 'granted' });
    setWindowNotification(WindowNotification);
    setNavigatorServiceWorker({
      getRegistration: vi.fn().mockRejectedValue(new Error('service worker unavailable')),
      ready: Promise.reject(new Error('service worker unavailable')),
    });

    await expect(showReminderNotification('Payback reminder')).resolves.toEqual({
      ok: true,
      method: 'window',
    });
    expect(WindowNotification).toHaveBeenCalledWith(
      'Envelope Budgeting — Daily Reminder',
      expect.objectContaining({ body: 'Payback reminder' })
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
