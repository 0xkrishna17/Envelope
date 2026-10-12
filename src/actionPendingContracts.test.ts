import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const files = {
  logTransaction: readFileSync('src/components/LogTransactionModal.tsx', 'utf8'),
  editTransaction: readFileSync('src/components/EditTransactionModal.tsx', 'utf8'),
  salary: readFileSync('src/components/SalaryArrivalModal.tsx', 'utf8'),
  moveFunds: readFileSync('src/components/MoveFundsModal.tsx', 'utf8'),
  addFunds: readFileSync('src/components/AddCategoryFundsModal.tsx', 'utf8'),
  categoryManagement: readFileSync('src/components/CategoryManagementModal.tsx', 'utf8'),
  profile: readFileSync('src/components/ProfileModal.tsx', 'utf8'),
  reconciliation: readFileSync('src/components/ReconciliationModal.tsx', 'utf8'),
  notificationSettings: readFileSync('src/components/NotificationSettingsModal.tsx', 'utf8'),
  voice: readFileSync('src/components/VoiceInputModal.tsx', 'utf8'),
  transferChecklist: readFileSync('src/components/TransferChecklistCard.tsx', 'utf8'),
  transactionLedger: readFileSync('src/components/TransactionLedger.tsx', 'utf8'),
  householdInvite: readFileSync('src/components/HouseholdInviteModal.tsx', 'utf8'),
};

describe('cloud action pending UI contracts', () => {
  it('uses keyed pending actions for primary cloud mutation forms', () => {
    expect(files.logTransaction).toContain("usePendingAction('transaction:add')");
    expect(files.editTransaction).toContain("usePendingAction('transaction:update')");
    expect(files.editTransaction).toContain("usePendingAction('transaction:delete')");
    expect(files.editTransaction).toContain("usePendingAction('transaction:correction')");
    expect(files.salary).toContain("usePendingAction('salary:add')");
    expect(files.moveFunds).toContain("usePendingAction('funds:move')");
    expect(files.addFunds).toContain("usePendingAction('funds:add')");
    expect(files.addFunds).toContain("usePendingAction('funds:move')");
    expect(files.categoryManagement).toContain("usePendingAction('category:save')");
    expect(files.profile).toContain("usePendingAction('profile:save')");
    expect(files.reconciliation).toContain("usePendingAction('reconciliation:create')");
    expect(files.notificationSettings).toContain("usePendingAction('notification-settings:save')");
    expect(files.voice).toContain("usePendingAction('voice:save-intent')");
    expect(files.transferChecklist).toContain("transfer-checklist:mark-all");
    expect(files.transferChecklist).toContain('transfer-checklist:toggle:${allocationId}');
    expect(files.transactionLedger).toContain('ledger:revert:${inspectEntry.id}');
    expect(files.householdInvite).toContain('household-member:update:${userId}');
    expect(files.householdInvite).toContain('household-member:delete:${memberToDelete.user_id}');
  });

  it('disables primary submit buttons while pending and exposes busy state', () => {
    expect(files.logTransaction).toContain('disabled={isSavingTransaction || !amountStr || !selectedCategoryId}');
    expect(files.salary).toContain('disabled={isSavingSalary || totalSalaryPaise <= 0 || isOverAllocated}');
    expect(files.moveFunds).toContain('disabled={isMovingFunds || parsedAmountPaise <= 0');
    expect(files.addFunds).toContain('disabled={isAddingFunds || isMovingSurplus || parsedAmountPaise <= 0');
    expect(files.profile).toContain('aria-busy={isSavingProfile}');
    expect(files.reconciliation).toContain('aria-busy={isSavingReconciliation}');
    expect(files.notificationSettings).toContain('aria-busy={isSavingNotificationSettings}');
  });

  it('shows action-specific loading labels', () => {
    expect(files.logTransaction).toContain("isSavingTransaction ? 'Saving...' : isRefund");
    expect(files.editTransaction).toContain("isSavingCorrection ? 'Saving Correction...' : 'Log Correction'");
    expect(files.salary).toContain("isSavingSalary ? 'Saving Salary...' : 'Save & Confirm Salary Allocation'");
    expect(files.moveFunds).toContain("isMovingFunds\n                    ? 'Moving...'");
    expect(files.addFunds).toContain("isAddingFunds || isMovingSurplus ? 'Saving...' :");
    expect(files.categoryManagement).toContain("isSavingCategory ? 'Saving...' : editingCategory");
    expect(files.profile).toContain("isSavingProfile ? 'Saving Profile...' : isOnboarding");
    expect(files.notificationSettings).toContain("isSavingNotificationSettings ? 'Saving...' : 'Save Schedule'");
  });
});
