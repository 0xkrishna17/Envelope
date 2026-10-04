import { describe, expect, it } from 'vitest';
import { shouldAutoShowInstallPrompt } from './usePwaInstall';

describe('shouldAutoShowInstallPrompt', () => {
  it('shows the custom install CTA when a native prompt is first captured in a non-installed session', () => {
    expect(
      shouldAutoShowInstallPrompt({
        hasSeenPromptThisSession: false,
        isInstalled: false,
      })
    ).toBe(true);
  });

  it('does not auto-show repeatedly in the same session', () => {
    expect(
      shouldAutoShowInstallPrompt({
        hasSeenPromptThisSession: true,
        isInstalled: false,
      })
    ).toBe(false);
  });

  it('does not show when the app is already installed', () => {
    expect(
      shouldAutoShowInstallPrompt({
        hasSeenPromptThisSession: false,
        isInstalled: true,
      })
    ).toBe(false);
  });
});
