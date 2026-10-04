import { describe, expect, it } from 'vitest';
import { getErrorBoundaryDisplayMessage } from './ErrorBoundary';

describe('getErrorBoundaryDisplayMessage', () => {
  it('returns a trimmed Error message', () => {
    expect(getErrorBoundaryDisplayMessage(new Error('  Render failed  '))).toBe('Render failed');
  });

  it('returns a trimmed string error', () => {
    expect(getErrorBoundaryDisplayMessage('  plain failure  ')).toBe('plain failure');
  });

  it('falls back for empty or unknown errors', () => {
    expect(getErrorBoundaryDisplayMessage('   ')).toBe('The app hit an unexpected problem.');
    expect(getErrorBoundaryDisplayMessage(null)).toBe('The app hit an unexpected problem.');
  });
});
