import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/EditTransactionModal.tsx', 'utf8');

describe('EditTransactionModal reversal confirmation', () => {
  it('uses an in-app confirmation panel instead of a browser confirm dialog', () => {
    expect(source).not.toContain('window.confirm');
    expect(source).toContain('showReverseConfirm');
    expect(source).toContain('Reverse this transaction?');
    expect(source).toContain('id="confirm-reverse-tx-btn"');
  });
});
