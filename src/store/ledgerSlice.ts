import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Household, PushSubscriptionSetting } from '../types';
import { INITIAL_CATEGORIES, INITIAL_HOUSEHOLD, INITIAL_MEMBERS } from '../data/initialData';
import { LedgerState, SyncState } from './types';
import { DEFAULT_HOUSEHOLD_DOC_ID, normalizeHouseholdDocId } from '../sync/householdIdentity';

const currentYearMonth = new Date().toISOString().slice(0, 7);

const initialPushSettings: PushSubscriptionSetting = {
  id: 'push_default',
  user_id: 'usr_me',
  reminder_time: '21:00',
  timezone: 'Asia/Kolkata',
  enabled: false,
  created_at: new Date().toISOString(),
};

export function sanitizeHousehold(hh: Household): Household {
  const name = (hh.name || '').trim();
  if (!name || /preview/i.test(name) || name === 'Our Household Ledger' || name.toLowerCase() === 'preview ledger') {
    return { ...hh, name: 'Family Budget' };
  }
  return hh;
}

const initialState: LedgerState = {
  household: sanitizeHousehold(INITIAL_HOUSEHOLD),
  members: INITIAL_MEMBERS,
  categories: INITIAL_CATEGORIES,
  salaryEvents: [],
  allocations: [],
  transactions: [],
  reconciliations: [],
  reconciliationLines: [],
  envelopeTransfers: [],
  selectedMonth: currentYearMonth,
  activeMemberId: 'usr_me',
  pushSettings: initialPushSettings,
  firstTimeIntroCompleted: false,

  householdId: DEFAULT_HOUSEHOLD_DOC_ID,
  syncStatus: 'idle',
  lastCloudSync: null,
  permissionDenied: false,
  isRemoteSync: false,
  lastResetAt: null,
};

export const ledgerSlice = createSlice({
  name: 'ledger',
  initialState,
  reducers: {
    setHouseholdId: (state, action: PayloadAction<string>) => {
      const normalizedHouseholdId = normalizeHouseholdDocId(action.payload);
      state.householdId = normalizedHouseholdId;
      state.household.id = normalizedHouseholdId;
    },
    setHousehold: (state, action: PayloadAction<Household>) => {
      const normalizedHouseholdId = normalizeHouseholdDocId(action.payload.id || state.householdId);
      state.householdId = normalizedHouseholdId;
      state.household = sanitizeHousehold({ ...action.payload, id: normalizedHouseholdId });
      if (action.payload.first_time_intro_completed) {
        state.firstTimeIntroCompleted = true;
      }
    },
    setActiveMemberId: (state, action: PayloadAction<string>) => {
      state.activeMemberId = action.payload;
    },
    setSelectedMonth: (state, action: PayloadAction<string>) => {
      state.selectedMonth = action.payload;
    },
    setSyncStatus: (state, action: PayloadAction<SyncState>) => {
      state.syncStatus = action.payload;
    },
    setLastCloudSync: (state, action: PayloadAction<string | null>) => {
      state.lastCloudSync = action.payload;
    },
    setPermissionDenied: (state, action: PayloadAction<boolean>) => {
      state.permissionDenied = action.payload;
    },
    setIsRemoteSync: (state, action: PayloadAction<boolean>) => {
      state.isRemoteSync = action.payload;
    },
    resetLedgerState: () => initialState,
    applyProjectedLedger: (state, action: PayloadAction<LedgerState>) => {
      const projected = action.payload;
      state.household = projected.household;
      state.members = projected.members;
      state.categories = projected.categories;
      state.salaryEvents = projected.salaryEvents;
      state.allocations = projected.allocations;
      state.transactions = projected.transactions;
      state.reconciliations = projected.reconciliations;
      state.reconciliationLines = projected.reconciliationLines;
      state.envelopeTransfers = projected.envelopeTransfers;
      state.selectedMonth = projected.selectedMonth;
      state.activeMemberId = projected.activeMemberId;
      state.pushSettings = projected.pushSettings;
      state.firstTimeIntroCompleted = projected.firstTimeIntroCompleted;
      state.householdId = projected.householdId;
      state.lastResetAt = projected.lastResetAt;
    },
  },
});

export const ledgerActions = ledgerSlice.actions;
export const ledgerReducer = ledgerSlice.reducer;
