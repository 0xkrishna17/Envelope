import { UnknownAction } from '@reduxjs/toolkit';
import { LedgerState } from '../store/types';
import { createPendingMutation, PendingMutation } from './mutationQueue';

const MUTATION_ACTION_PATTERNS = [
  'addTransaction',
  'updateTransaction',
  'deleteTransaction',
  'logCorrection',
  'markReconciled',
  'addSalary',
  'addSalaryAndAllocations',
  'deleteSalaryEvent',
  'addCategoryFunds',
  'deleteCategoryFunds',
  'moveFunds',
  'deleteEnvelopeTransfer',
  'createCategory',
  'updateCategory',
  'archiveCategory',
  'unarchiveCategory',
  'deleteCategory',
  'updateMemberProfile',
  'deleteMember',
  'setHousehold',
  'updatePushSettings',
  'resetLedgerToZero',
];

export function isSyncableLedgerAction(actionType: string): boolean {
  return MUTATION_ACTION_PATTERNS.some(pattern => actionType.includes(pattern));
}

function newestByUpdatedAt<T extends { id: string; updated_at?: string }>(items: T[]): T | null {
  if (items.length === 0) return null;
  return [...items].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0];
}

export function mapLedgerActionToPendingMutations(
  action: UnknownAction,
  state: LedgerState
): PendingMutation[] {
  if (!isSyncableLedgerAction(action.type)) return [];

  const householdId = state.householdId;
  const mutations: PendingMutation[] = [];

  const pushLatest = <T extends { id: string; updated_at?: string }>(
    collection: PendingMutation['collection'],
    items: T[]
  ) => {
    const latest = newestByUpdatedAt(items);
    if (!latest) return;
    mutations.push(
      createPendingMutation({
        householdId,
        collection,
        entityId: latest.id,
        operation: 'upsert',
        payload: latest,
      })
    );
  };

  if (action.type.includes('Transaction') || action.type.includes('logCorrection')) {
    pushLatest('transactions', state.transactions);
  }
  if (action.type.includes('Salary')) {
    pushLatest('salaryEvents', state.salaryEvents);
  }
  if (action.type.includes('Allocation') || action.type.includes('CategoryFunds')) {
    pushLatest('allocations', state.allocations);
  }
  if (action.type.includes('Funds') || action.type.includes('EnvelopeTransfer')) {
    pushLatest('envelopeTransfers', state.envelopeTransfers);
  }
  if (action.type.includes('Category')) {
    pushLatest('categories', state.categories);
  }
  if (action.type.includes('Reconciled') || action.type.includes('Reconciliation')) {
    pushLatest('reconciliations', state.reconciliations);
    pushLatest('reconciliationLines', state.reconciliationLines);
  }
  if (action.type.includes('Member')) {
    pushLatest('members', state.members);
  }

  // Some compound operations are simpler and safer to represent as a broad ledger flush in this interim phase.
  // The queue still records that meaningful domain data changed; syncEngine currently flushes the normalized ledger.
  if (mutations.length === 0 && isSyncableLedgerAction(action.type)) {
    mutations.push(
      createPendingMutation({
        householdId,
        collection: 'members',
        entityId: 'ledger_broad_change',
        operation: 'upsert',
        payload: { actionType: action.type, changedAt: new Date().toISOString() },
      })
    );
  }

  return mutations;
}
