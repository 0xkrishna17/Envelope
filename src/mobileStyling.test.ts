import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const globalStyles = readFileSync('src/index.css', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
const headerSource = readFileSync('src/components/Header.tsx', 'utf8');
const categoryCardSource = readFileSync('src/components/CategoryCard.tsx', 'utf8');
const logExpenseSource = readFileSync('src/components/LogTransactionModal.tsx', 'utf8');
const addFundsSource = readFileSync('src/components/AddCategoryFundsModal.tsx', 'utf8');
const floatingNavSource = readFileSync('src/components/FloatingNavMenu.tsx', 'utf8');
const ledgerSource = readFileSync('src/components/TransactionLedger.tsx', 'utf8');
const categoryManagementSource = readFileSync('src/components/CategoryManagementModal.tsx', 'utf8');
const settingsSource = readFileSync('src/components/SettingsTab.tsx', 'utf8');
const cloudSyncSource = readFileSync('src/components/CloudSyncScreen.tsx', 'utf8');
const inviteSource = readFileSync('src/components/HouseholdInviteScreen.tsx', 'utf8');
const categoryDetailSource = readFileSync('src/components/CategoryDetailModal.tsx', 'utf8');

const allScreenSources = [
  floatingNavSource,
  ledgerSource,
  categoryManagementSource,
  settingsSource,
  cloudSyncSource,
  inviteSource,
];

describe('mobile styling safeguards', () => {
  it('applies a global mobile touch target floor across screens', () => {
    expect(globalStyles).toContain('@media (max-width: 640px)');
    expect(globalStyles).toContain('min-height: 2.75rem;');
    expect(globalStyles).toContain('min-width: 2.75rem;');
    expect(globalStyles).toContain('padding-bottom: max(7rem, calc(5rem + env(safe-area-inset-bottom)))');
  });

  it('keeps envelope cards single-column on phones for readability', () => {
    expect(appSource).toContain('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-2.5');
  });

  it('keeps envelope cards compact and stateful on mobile', () => {
    expect(categoryCardSource).toContain('min-h-[72px] sm:min-h-[76px]');
    expect(categoryCardSource).toContain('Not funded yet');
    expect(categoryCardSource).toContain('Running low');
    expect(categoryCardSource).toContain('Overdrawn');
    expect(categoryCardSource).toContain('absolute inset-x-0 bottom-0 h-1');
    expect(categoryCardSource).toContain('max-w-[42%]');
    expect(categoryCardSource).not.toContain('ChevronRight');
    expect(categoryCardSource).not.toContain('Available\n');
  });

  it('keeps expense category choices less cramped on phones', () => {
    expect(logExpenseSource).toContain('grid grid-cols-2 sm:grid-cols-4 gap-2.5');
    expect(logExpenseSource).toContain('min-h-20 sm:min-h-0');
  });

  it('keeps specific-category Add Money compact while preserving the generic picker', () => {
    expect(addFundsSource).toContain('id="locked-selected-envelope-card"');
    expect(addFundsSource).toContain('initialCategoryId && selectedCategory && selectedCategory.id === initialCategoryId');
    expect(addFundsSource).toContain('Current available: {formatPaise(currentAvailablePaise)}');
    expect(addFundsSource).toContain('id={`select-envelope-btn-${cat.id}`}');
    expect(addFundsSource).toContain('grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 sm:max-h-32');
    expect(addFundsSource).toContain('flex items-center gap-1.5 p-2 rounded-lg');
    expect(addFundsSource).toContain("renderCategoryIcon(cat.icon, 'w-3 h-3')");
  });

  it('keeps Add Money funding fields compact and automatic', () => {
    expect(addFundsSource).toContain('id="topup-funding-source"');
    expect(addFundsSource).toContain('id="topup-funding-source-menu"');
    expect(addFundsSource).toContain('id="topup-logged-by-menu"');
    expect(addFundsSource).toContain('aria-haspopup="listbox"');
    expect(addFundsSource).toContain('absolute z-30 mt-1 w-full');
    expect(addFundsSource).toContain("const resolvedDepositHolding = selectedSource === 'Cash Deposit' ? 'cash' : 'secondary_account';");
    expect(addFundsSource).toContain('depositHolding: resolvedDepositHolding');
    expect(addFundsSource).toContain('transferred: true');
    expect(addFundsSource).toContain('grid grid-cols-1 sm:grid-cols-2 gap-3');
    expect(addFundsSource).not.toContain('Where is the money held?');
    expect(addFundsSource).not.toContain("setDepositHolding");
  });

  it('keeps floating quick actions and tab screens clear of the fixed mobile FAB', () => {
    expect(floatingNavSource).toContain('w-[calc(100vw-2rem)] sm:w-[320px]');
    expect(floatingNavSource).toContain('py-2.5 min-h-11');
    expect(ledgerSource).toContain('pb-28 sm:pb-20');
    expect(settingsSource).toContain('pb-28 sm:pb-20');
    expect(cloudSyncSource).toContain('pb-28 sm:pb-20');
    expect(inviteSource).toContain('pb-28 sm:pb-20');
    expect(settingsSource).toContain('const shouldShowNotificationSettings = false;');
    expect(settingsSource).toContain('{shouldShowNotificationSettings && (');
    expect(headerSource).toContain('const shouldShowNotificationSettings = false;');
    expect(headerSource).toContain('{shouldShowNotificationSettings && (');
    expect(headerSource).toContain('id="reminder-settings-btn"');
  });

  it('keeps dense management and ledger controls mobile-first', () => {
    expect(ledgerSource).toContain('hidden sm:grid sm:grid-cols-2 gap-2 flex-1');
    expect(ledgerSource).toContain('id="ledger-filter-type-mobile"');
    expect(ledgerSource).toContain('id="ledger-filter-category-mobile"');
    expect(ledgerSource).toContain('More filters (Type, Envelope, Logged By, Payment Method)');
    expect(ledgerSource).toContain('min-h-11 sm:min-h-10');
    expect(categoryManagementSource).toContain('grid grid-cols-5 sm:grid-cols-10');
    expect(categoryManagementSource).toContain('min-h-11 min-w-11');
    expect(categoryManagementSource).toContain('flex items-start justify-between gap-3 p-3.5');
    expect(categoryManagementSource).toContain('flex-1 flex-wrap sm:flex-nowrap');
    expect(categoryManagementSource).toContain('justify-end gap-1.5 shrink-0 self-start');
    expect(categoryManagementSource).toContain('inline-grid grid-flow-col place-items-center');
    expect(categoryManagementSource).toContain('h-10 min-h-10 w-10 min-w-10 p-0');
  });

  it('keeps the requested compact envelope home refinements', () => {
    expect(appSource).not.toContain('const shouldShowTransferChecklist = false;');
    expect(appSource).toContain('id="transfer-checklist-container"');
    expect(appSource).toContain('onSuccessOpenChecklist={() => {');
    expect(appSource).toContain('Total Available ({activeEnvelopeCount} envelopes)');
    expect(appSource).toContain('Available now');
    expect(appSource).toContain('grid grid-cols-5 sm:grid-cols-2 gap-2 sm:gap-3');
    expect(appSource).toContain('col-span-4 sm:col-span-1');
    expect(appSource).toContain('col-span-1 p-2 sm:p-4');
    expect(appSource).toContain('sr-only sm:not-sr-only sm:truncate');
    expect(appSource).toContain('hidden sm:block text-[11px] text-[#87341D]/80');
    expect(appSource).toContain('w-full sm:w-auto sm:self-end min-h-11');
    expect(appSource).toContain('flex items-center overflow-hidden bg-[#EFEAE1]/80');
    expect(appSource).toContain('h-9 min-h-9 w-10 min-w-10 sm:h-7 sm:min-h-7 sm:w-8 sm:min-w-8');
    expect(appSource).toContain('grid place-items-center');
    expect(appSource).toContain('block w-5 h-5 sm:w-4 sm:h-4 shrink-0');
    expect(appSource).toContain('min-w-[78px] sm:min-w-[84px]');
  });

  it('keeps the envelope detail header and actions compact on mobile', () => {
    expect(categoryDetailSource).toContain('<span>Back</span>');
    expect(categoryDetailSource).not.toContain('Back to Envelopes');
    expect(categoryDetailSource).toContain('absolute top-3 right-3 text-[9px]');
    expect(categoryDetailSource).toContain("{category.is_unallocated ? 'Surplus' : 'Envelope'}");
    expect(categoryDetailSource).toContain('grid grid-cols-2 sm:flex sm:flex-wrap gap-2');
    expect(categoryDetailSource).toContain('w-full sm:w-auto min-h-11 sm:min-h-0 px-3 py-2.5 sm:py-2 rounded-xl bg-[#1F1B16]');
  });

  it('keeps representative all-screen sources on larger mobile controls', () => {
    expect(allScreenSources.every(source => source.includes('min-h-11') || source.includes('min-h-10'))).toBe(true);
  });
});
