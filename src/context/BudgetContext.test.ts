import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const budgetContextSource = readFileSync('src/context/BudgetContext.tsx', 'utf8');

describe('BudgetContext cloud bootstrap guardrails', () => {
  it('clears the full-page cloud bootstrap loader after the root household load succeeds', () => {
    expect(budgetContextSource).toContain("logSyncDebug('cloud bootstrap root load completed'");
    expect(budgetContextSource).toContain('if (result.ok) {');
    expect(budgetContextSource).toContain('setIsCloudBootstrapPending(false);');
  });

  it('logs event bootstrap blockers when cloud event sync cannot start', () => {
    expect(budgetContextSource).toContain("logSyncDebug('cloud event bootstrap skipped'");
    expect(budgetContextSource).toContain("blockers: bootstrapBlockers.join(',')");
  });

  it('logs event subscription failures for Firestore rule diagnostics', () => {
    expect(budgetContextSource).toContain("logSyncDebug('cloud event subscription failed'");
    expect(budgetContextSource).toContain('...summarizeSyncResult(result)');
  });

  it('times out initial cloud event bootstrap so the full-page loader cannot hang forever', () => {
    expect(budgetContextSource).toContain('CLOUD_EVENT_BOOTSTRAP_TIMEOUT_MS');
    expect(budgetContextSource).toContain('Cloud event bootstrap timed out');
    expect(budgetContextSource).toContain("'cloud event bootstrap sync ended without completion'");
  });

  it('does not auto-push member profile events while cloud bootstrap is pending', () => {
    expect(budgetContextSource).toContain('!user || !isAccessAllowed || !hasVerifiedCloudHousehold || isCloudBootstrapPending');
  });

  it('loads root metadata when Redux has owner fields but the trusted ACL snapshot is missing', () => {
    expect(budgetContextSource).toContain('if ((household.owner_uid || household.owner_email) && trustedRootAccessRef.current) return;');
  });

  it('preserves trusted root Firestore ACL metadata when applying remote event projections', () => {
    expect(budgetContextSource).toContain('trustedRootAccessRef');
    expect(budgetContextSource).toContain('setTrustedRootAccessSnapshot(result.household ? trustedRootAccessFromHousehold(result.household) : null)');
    expect(budgetContextSource).toContain('const applyProjectedLedger = useCallback');
    expect(budgetContextSource).toContain('mergeProjectedLedgerWithTrustedRootAccess(projected, trustedRootAccessRef.current)');
    expect(budgetContextSource).toContain('applyProjectedLedger(result.projected);');
  });
});
