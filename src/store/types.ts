import {
  Household,
  Membership,
  Category,
  SalaryEvent,
  Allocation,
  Transaction,
  Reconciliation,
  ReconciliationLine,
  EnvelopeTransfer,
  Invite,
  PushSubscriptionSetting,
} from '../types';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface LedgerState {
  household: Household;
  members: Membership[];
  categories: Category[];
  salaryEvents: SalaryEvent[];
  allocations: Allocation[];
  transactions: Transaction[];
  reconciliations: Reconciliation[];
  reconciliationLines: ReconciliationLine[];
  envelopeTransfers: EnvelopeTransfer[];
  invites: Invite[];
  selectedMonth: string; // YYYY-MM
  activeMemberId: string;
  pushSettings: PushSubscriptionSetting;
  firstTimeIntroCompleted: boolean;

  // Metadata & Sync Control
  householdId: string;
  syncStatus: SyncState;
  lastCloudSync: string | null;
  permissionDenied: boolean;
  isRemoteSync: boolean;
  lastResetAt?: string | null;
}
