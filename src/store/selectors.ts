import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './index';
import {
  calculateCategoryBalance,
  calculateMonthSummary,
  calculateCategoryPendingDebt,
} from '../utils/budgetLogic';
import { CategoryBalanceInfo } from '../types';

export const selectLedger = (state: RootState) => state.ledger;

export const selectHousehold = createSelector(selectLedger, l => l.household);
export const selectMembers = createSelector(selectLedger, l => l.members);
export const selectCategories = createSelector(selectLedger, l => l.categories);
export const selectSalaryEvents = createSelector(selectLedger, l => l.salaryEvents);
export const selectAllocations = createSelector(selectLedger, l => l.allocations);
export const selectTransactions = createSelector(selectLedger, l => l.transactions);
export const selectReconciliations = createSelector(selectLedger, l => l.reconciliations);
export const selectReconciliationLines = createSelector(selectLedger, l => l.reconciliationLines);
export const selectEnvelopeTransfers = createSelector(selectLedger, l => l.envelopeTransfers);
export const selectInvites = createSelector(selectLedger, l => l.invites);
export const selectSelectedMonth = createSelector(selectLedger, l => l.selectedMonth);
export const selectActiveMemberId = createSelector(selectLedger, l => l.activeMemberId);
export const selectPushSettings = createSelector(selectLedger, l => l.pushSettings);
export const selectHouseholdId = createSelector(selectLedger, l => l.householdId);
export const selectSyncStatus = createSelector(selectLedger, l => l.syncStatus);
export const selectLastCloudSync = createSelector(selectLedger, l => l.lastCloudSync);
export const selectPermissionDenied = createSelector(selectLedger, l => l.permissionDenied);
export const selectFirstTimeIntroCompleted = createSelector(
  selectLedger,
  l => Boolean(l.firstTimeIntroCompleted || l.household.first_time_intro_completed)
);

export const selectActiveMember = createSelector(
  [selectMembers, selectActiveMemberId],
  (members, activeId) => {
    return members.find(m => m.user_id === activeId) || members[0];
  }
);

export const selectActiveCategories = createSelector(
  [selectCategories],
  categories => categories.filter(c => !c.deleted_at && !c.is_archived)
);

export const selectUnallocatedCategory = createSelector(
  [selectCategories],
  categories => categories.find(c => c.is_unallocated)
);

// Memoized Derived Category Balances & Summaries
export const selectCategoryBalances = createSelector(
  [
    selectCategories,
    selectAllocations,
    selectTransactions,
    selectReconciliationLines,
    selectSelectedMonth,
  ],
  (categories, allocations, transactions, reconciliationLines, selectedMonth): CategoryBalanceInfo[] => {
    const validCategories = categories.filter(c => !c.deleted_at);

    return validCategories
      .map(cat => {
        const availableNow = calculateCategoryBalance(cat.id, allocations, transactions);
        const { allocated, spent } = calculateMonthSummary(
          cat.id,
          allocations,
          transactions,
          selectedMonth
        );
        const { totalPendingDebt } = calculateCategoryPendingDebt(
          cat.id,
          transactions,
          reconciliationLines
        );

        return {
          category: cat,
          availableNow,
          thisMonthAllocated: allocated,
          thisMonthSpent: spent,
          pendingCardDebt: totalPendingDebt,
        };
      })
      .filter(item => {
        if (item.category.is_archived) {
          return item.availableNow !== 0 || item.pendingCardDebt > 0;
        }
        return true;
      })
      .sort((a, b) => {
        // Unallocated envelope always appears last
        if (a.category.is_unallocated && !b.category.is_unallocated) return 1;
        if (!a.category.is_unallocated && b.category.is_unallocated) return -1;
        return 0;
      });
  }
);

export const selectTotalAvailablePaise = createSelector(
  [selectCategoryBalances],
  categoryBalances => categoryBalances.reduce((sum, item) => sum + item.availableNow, 0)
);

export const selectTotalPendingPaybackPaise = createSelector(
  [selectCategoryBalances],
  categoryBalances => categoryBalances.reduce((sum, item) => sum + item.pendingCardDebt, 0)
);

export const selectUnallocatedBalance = createSelector(
  [selectCategoryBalances, selectUnallocatedCategory],
  (categoryBalances, unallocatedCat) => {
    if (!unallocatedCat) return 0;
    const info = categoryBalances.find(b => b.category.id === unallocatedCat.id);
    return info ? info.availableNow : 0;
  }
);

export const selectPendingTransfersList = createSelector(
  [selectAllocations, selectCategories],
  (allocations, categories) => {
    const pendingAllocs = allocations.filter(
      a => !a.transferred && !a.deleted_at && a.planned_amount > 0
    );
    return pendingAllocs.map(a => {
      const cat = categories.find(c => c.id === a.category_id);
      return {
        ...a,
        categoryName: cat?.name || 'Envelope',
        categoryIcon: cat?.icon || 'Folder',
        categoryColor: cat?.color || '#78716C',
      };
    });
  }
);
