import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/context/ApiLoadingContext.tsx', 'utf8');

describe('ApiLoadingContext pending action API', () => {
  it('exposes keyed pending actions without breaking the existing global loading API', () => {
    expect(source).toContain('export type PendingActionKey = string;');
    expect(source).toContain('startApiCall: (message?: string | null) => () => void;');
    expect(source).toContain('startAction: (key: PendingActionKey, message?: string | null) => () => void;');
    expect(source).toContain('isActionPending: (key: PendingActionKey) => boolean;');
    expect(source).toContain('runAction: <T>(key: PendingActionKey, message: string | null, action: () => Promise<T>) => Promise<T>;');
  });

  it('tracks pending actions by count and clears them in finally', () => {
    expect(source).toContain('const [pendingActionCounts, setPendingActionCounts] = useState<Record<PendingActionKey, number>>({});');
    expect(source).toContain('[key]: (prev[key] || 0) + 1');
    expect(source).toContain('return { ...prev, [key]: current - 1 };');
    expect(source).toContain('finally {');
    expect(source).toContain('stopAction();');
  });

  it('provides a usePendingAction hook for component-level loaders', () => {
    expect(source).toContain('export function usePendingAction(key: PendingActionKey)');
    expect(source).toContain('isPending: isActionPending(key)');
    expect(source).toContain('run: <T,>(message: string | null, action: () => Promise<T>) => runAction(key, message, action)');
  });
});
