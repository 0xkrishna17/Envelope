import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const sourceRoot = 'src';
const sourceFilePattern = /\.(ts|tsx)$/;
const testFilePattern = /\.test\.(ts|tsx)$/;
const ignoredFiles = new Set<string>([
  'src/noLocalStorageSource.test.ts',
]);

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return listSourceFiles(path);
    return sourceFilePattern.test(path) && !testFilePattern.test(path) ? [path] : [];
  });
}

describe('no app-owned browser storage', () => {
  it('does not reference localStorage, sessionStorage, or app-owned env_budget keys in source', () => {
    const offenders = listSourceFiles(sourceRoot)
      .filter(path => !ignoredFiles.has(relative('.', path)))
      .flatMap(path => {
        const content = readFileSync(path, 'utf8');
        const matches = ['localStorage', 'sessionStorage', 'env_budget_'].filter(token => content.includes(token));
        return matches.length > 0 ? [`${relative('.', path)}: ${matches.join(', ')}`] : [];
      });

    expect(offenders).toEqual([]);
  });
});
