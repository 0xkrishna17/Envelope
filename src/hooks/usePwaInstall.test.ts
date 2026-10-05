import { describe, expect, it } from 'vitest';
import { shouldAutoShowInstallPrompt } from './usePwaInstall';

describe('shouldAutoShowInstallPrompt', () => {
  it('shows the custom install CTA for a non-installed user who has not dismissed it', () => {
    expect(
      shouldAutoShowInstallPrompt({
        hasDismissedPrompt: false,
        isInstalled: false,
      })
    ).toBe(true);
  });

  it('does not auto-show after the user dismissed the prompt', () => {
    expect(
      shouldAutoShowInstallPrompt({
        hasDismissedPrompt: true,
        isInstalled: false,
      })
    ).toBe(false);
  });

  it('does not show when the app is already installed', () => {
    expect(
      shouldAutoShowInstallPrompt({
        hasDismissedPrompt: false,
        isInstalled: true,
      })
    ).toBe(false);
  });
});
