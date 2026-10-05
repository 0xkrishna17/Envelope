import { describe, expect, it } from 'vitest';
import { DEFAULT_HOUSEHOLD_DOC_ID } from '../sync/householdIdentity';
import { createSeedLedgerState } from '../sync/events/projectLedger';
import { ProjectionSeed } from '../sync/events/types';
import { ledgerActions, ledgerReducer } from './ledgerSlice';
import { LedgerState } from './types';

function baseState(): LedgerState {
  return ledgerReducer(undefined, { type: '@@INIT' });
}

function projectionSeed(): ProjectionSeed {
  const state = baseState();
  return {
    household: state.household,
    members: state.members,
    categories: state.categories,
    pushSettings: state.pushSettings,
    selectedMonth: state.selectedMonth,
    activeMemberId: state.activeMemberId,
    firstTimeIntroCompleted: state.firstTimeIntroCompleted,
    householdId: state.householdId,
  };
}

describe('ledgerSlice read model', () => {
  it('normalizes the active household id metadata', () => {
    const state = baseState();

    const nextState = ledgerReducer(state, ledgerActions.setHouseholdId(' hh_shared '));

    expect(nextState.householdId).toBe('hh_shared');
    expect(nextState.household.id).toBe('hh_shared');
  });

  it('keeps household metadata sanitized when set directly by auth/root metadata loading', () => {
    const state = baseState();

    const nextState = ledgerReducer(
      state,
      ledgerActions.setHousehold({
        ...state.household,
        id: ' hh_shared ',
        name: 'Preview Ledger',
        first_time_intro_completed: true,
      })
    );

    expect(nextState.householdId).toBe('hh_shared');
    expect(nextState.household.id).toBe('hh_shared');
    expect(nextState.household.name).toBe('Family Budget');
    expect(nextState.firstTimeIntroCompleted).toBe(true);
  });

  it('applies projected event-sourced ledger state as the Redux read model', () => {
    const state = baseState();
    const projected = createSeedLedgerState(projectionSeed());
    projected.transactions = [
      {
        id: 'tx_projected',
        household_id: DEFAULT_HOUSEHOLD_DOC_ID,
        category_id: 'cat_groceries',
        amount: 12500,
        date: '2026-09-20',
        logged_by_user_id: 'usr_me',
        payment_method: 'cash',
        reconciliation_status: 'n/a',
        created_at: '2026-09-20T00:00:00.000Z',
        updated_at: '2026-09-20T00:00:00.000Z',
      },
    ];
    projected.allocations = [
      {
        id: 'alloc_projected',
        salary_event_id: 'sal_projected',
        category_id: 'cat_groceries',
        planned_amount: 50000,
        transferred: true,
        transferred_at: '2026-09-20T00:00:00.000Z',
        created_at: '2026-09-20T00:00:00.000Z',
        updated_at: '2026-09-20T00:00:00.000Z',
      },
    ];
    projected.lastResetAt = '2026-09-21T00:00:00.000Z';

    const nextState = ledgerReducer(state, ledgerActions.applyProjectedLedger(projected));

    expect(nextState.transactions).toEqual(projected.transactions);
    expect(nextState.allocations).toEqual(projected.allocations);
    expect(nextState.lastResetAt).toBe('2026-09-21T00:00:00.000Z');
    expect(nextState.syncStatus).toBe(state.syncStatus);
  });

});
