import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INSTALL_PROMPT_SEEN_KEY = 'env_budget_install_prompt_seen_session';

function hasStandaloneFlag(value: Navigator): value is Navigator & { standalone: boolean } {
  return 'standalone' in value && typeof value.standalone === 'boolean';
}

export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  return window.matchMedia('(display-mode: standalone)').matches || (hasStandaloneFlag(navigator) && navigator.standalone);
}

export function shouldAutoShowInstallPrompt(params: {
  hasSeenPromptThisSession: boolean;
  isInstalled: boolean;
}): boolean {
  return !params.hasSeenPromptThisSession && !params.isInstalled;
}

function hasSeenInstallPromptThisSession(): boolean {
  try {
    return sessionStorage.getItem(INSTALL_PROMPT_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function markInstallPromptSeenThisSession(): void {
  try {
    sessionStorage.setItem(INSTALL_PROMPT_SEEN_KEY, 'true');
  } catch {
    // Non-critical: storage can be unavailable in private/restricted contexts.
  }
}

function isPromptUserChoice(value: unknown): value is BeforeInstallPromptEvent['userChoice'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return (
    'prompt' in event &&
    typeof event.prompt === 'function' &&
    'userChoice' in event &&
    isPromptUserChoice(event.userChoice)
  );
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    const standalone = isRunningStandalone();

    if (standalone) {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallGuide(false);
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!isBeforeInstallPromptEvent(event)) return;

      setDeferredPrompt(event);

      if (shouldAutoShowInstallPrompt({ hasSeenPromptThisSession: hasSeenInstallPromptThisSession(), isInstalled: false })) {
        markInstallPromptSeenThisSession();
        setShowInstallGuide(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallGuide(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (isInstalled) return;

    if (!deferredPrompt) {
      setShowInstallGuide(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);

      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowInstallGuide(false);
        return;
      }

      setShowInstallGuide(true);
    } catch {
      setDeferredPrompt(null);
      setShowInstallGuide(true);
    }
  }, [deferredPrompt, isInstalled]);

  const closeInstallGuide = useCallback(() => setShowInstallGuide(false), []);
  const openInstallGuide = useCallback(() => setShowInstallGuide(true), []);

  return {
    isInstallable: !isInstalled,
    isInstalled,
    showInstallGuide,
    triggerInstall,
    closeInstallGuide,
    openInstallGuide,
    hasNativePrompt: Boolean(deferredPrompt),
  };
}
