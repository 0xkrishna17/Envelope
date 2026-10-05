import {
  Allocation,
  Category,
  EnvelopeTransfer,
  Household,
  Membership,
  PaymentMethod,
  PushSubscriptionSetting,
  Reconciliation,
  ReconciliationLine,
  ReconciliationStatus,
  SalaryEvent,
  Transaction,
} from '../../types';
import { LedgerState } from '../../store/types';
import { executeFifoReconciliation, recomputeTransactionStatuses } from '../../utils/budgetLogic';
import { clampDateInputToToday } from '../../utils/dateUtils';
import { createLedgerEventId, nextEventSequence, readOrCreateDeviceId } from './eventIds';
import { EventScope, LedgerEvent } from './types';

type EventOf<TType extends LedgerEvent['type']> = Extract<LedgerEvent, { type: TType }>;

interface CommandContext {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  scope: EventScope;
  householdId: string;
  actorUid: string | null;
  actorMemberId: string;
  baseRemoteRevision: number | null;
  nowIso: string;
}

interface EventMetadata {
  id: string;
  householdId: string;
  actorUid: string | null;
  actorMemberId: string;
  occurredAt: string;
  schemaVersion: number;
  deviceId: string;
  sequence: number;
  baseRemoteRevision: number | null;
}

function createEventMetadata(context: CommandContext): EventMetadata {
  const deviceId = readOrCreateDeviceId(context.storage);
  const sequence = nextEventSequence(context.storage, context.scope);
  return {
    id: createLedgerEventId(deviceId, sequence),
    householdId: context.householdId,
    actorUid: context.actorUid,
    actorMemberId: context.actorMemberId,
    occurredAt: context.nowIso,
    schemaVersion: 1,
    deviceId,
    sequence,
    baseRemoteRevision: context.baseRemoteRevision,
  };
}

export interface AddTransactionCommand {
  categoryId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  note?: string;
  date: string;
  transactionId: string;
}

export function createTransactionAddedEvent(
  context: CommandContext,
  command: AddTransactionCommand
): EventOf<'transaction.added'> {
  const transaction: Transaction = {
    id: command.transactionId,
    household_id: context.householdId,
    category_id: command.categoryId,
    amount: command.amount,
    date: clampDateInputToToday(command.date),
    logged_by_user_id: context.actorMemberId,
    payment_method: command.paymentMethod,
    note: command.note ? command.note.trim() : undefined,
    reconciliation_status: command.paymentMethod === 'credit_card' ? 'pending' : 'n/a',
    created_at: context.nowIso,
    updated_at: context.nowIso,
  };

  return {
    ...createEventMetadata(context),
    type: 'transaction.added',
    payload: { transaction },
  };
}

export interface AddCategoryFundsCommand {
  categoryId: string;
  amount: number;
  allocationId: string;
  source?: string;
  note?: string;
  date?: string;
  depositHolding?: 'secondary_account' | 'cash' | 'primary_account';
  transferred?: boolean;
  loggedByUserId?: string;
}

export function createCategoryFundsAddedEvent(
  context: CommandContext,
  command: AddCategoryFundsCommand
): EventOf<'category_funds.added'> {
  const depositHolding = command.depositHolding || 'secondary_account';
  const isTransferred = command.transferred !== undefined ? command.transferred : depositHolding !== 'primary_account';
  const entryDate = clampDateInputToToday(command.date || context.nowIso.split('T')[0]);
  const topupId = command.allocationId.startsWith('alloc_')
    ? command.allocationId.slice('alloc_'.length)
    : `env_topup_${command.allocationId}`;
  const allocation: Allocation = {
    id: command.allocationId,
    salary_event_id: topupId,
    category_id: command.categoryId,
    planned_amount: command.amount,
    transferred: isTransferred,
    transferred_at: isTransferred ? context.nowIso : null,
    created_at: entryDate ? `${entryDate}T12:00:00.000Z` : context.nowIso,
    updated_at: context.nowIso,
    source: command.source || 'Manual Top-Up',
    note: command.note ? command.note.trim() : undefined,
    logged_by_user_id: command.loggedByUserId || context.actorMemberId,
    deposit_holding: depositHolding,
  };

  return {
    ...createEventMetadata(context),
    type: 'category_funds.added',
    payload: { allocation },
  };
}

export interface MoveEnvelopeFundsCommand {
  fromCategoryId: string;
  toCategoryId: string;
  amount: number;
  date: string;
  note?: string;
  transferId: string;
  debitAllocationId: string;
  creditAllocationId: string;
}

export function createEnvelopeTransferCreatedEvent(
  context: CommandContext,
  command: MoveEnvelopeFundsCommand
): EventOf<'envelope_transfer.created'> {
  const transfer: EnvelopeTransfer = {
    id: command.transferId,
    household_id: context.householdId,
    from_category_id: command.fromCategoryId,
    to_category_id: command.toCategoryId,
    amount: command.amount,
    date: clampDateInputToToday(command.date),
    logged_by_user_id: context.actorMemberId,
    note: command.note ? command.note.trim() : undefined,
    created_at: context.nowIso,
  };

  const debitAllocation: Allocation = {
    id: command.debitAllocationId,
    salary_event_id: command.transferId,
    category_id: command.fromCategoryId,
    planned_amount: -command.amount,
    transferred: true,
    transferred_at: context.nowIso,
    created_at: context.nowIso,
    updated_at: context.nowIso,
    source: 'Envelope Transfer',
  };

  const creditAllocation: Allocation = {
    id: command.creditAllocationId,
    salary_event_id: command.transferId,
    category_id: command.toCategoryId,
    planned_amount: command.amount,
    transferred: true,
    transferred_at: context.nowIso,
    created_at: context.nowIso,
    updated_at: context.nowIso,
    source: 'Envelope Transfer',
  };

  return {
    ...createEventMetadata(context),
    type: 'envelope_transfer.created',
    payload: {
      transfer,
      allocations: [debitAllocation, creditAllocation],
    },
  };
}

export interface UpdateTransactionCommand {
  existing: Transaction;
  categoryId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  note?: string;
  date: string;
  generatedSuffix: string;
}

export function createTransactionUpdateEvents(
  context: CommandContext,
  command: UpdateTransactionCommand
): EventOf<'transaction.correction_logged'>[] {
  const entryDate = clampDateInputToToday(command.date);
  const trimmedNote = command.note ? command.note.trim() : undefined;
  const isSameFinancialBucket = command.existing.category_id === command.categoryId && command.existing.payment_method === command.paymentMethod;
  const amountDelta = command.amount - command.existing.amount;
  const metadataChanged = command.existing.date !== entryDate || (command.existing.note || undefined) !== trimmedNote;

  if (isSameFinancialBucket) {
    if (amountDelta === 0 && !metadataChanged) return [];
    const adjustmentNote = trimmedNote ||
      (amountDelta === 0
        ? `Audit note update for transaction ${command.existing.id}`
        : `Amount adjustment for transaction ${command.existing.id}`);
    return [{
      ...createEventMetadata(context),
      type: 'transaction.correction_logged',
      payload: {
        transaction: {
          id: `tx_adj_${command.generatedSuffix}`,
          household_id: context.householdId,
          category_id: command.categoryId,
          amount: amountDelta,
          payment_method: command.paymentMethod,
          note: adjustmentNote,
          date: entryDate,
          logged_by_user_id: command.existing.logged_by_user_id,
          reconciliation_status: 'n/a',
          created_at: context.nowIso,
          updated_at: context.nowIso,
          ledger_entry_type: 'adjustment',
          related_transaction_id: command.existing.id,
        },
      },
    }];
  }

  const nextStatus: ReconciliationStatus = command.paymentMethod === 'credit_card' ? 'pending' : 'n/a';
  const reversal: Transaction = {
    id: `tx_rev_${command.generatedSuffix}`,
    household_id: context.householdId,
    category_id: command.existing.category_id,
    amount: -command.existing.amount,
    payment_method: command.existing.payment_method,
    note: `Reversal for transaction ${command.existing.id}`,
    date: entryDate,
    logged_by_user_id: command.existing.logged_by_user_id,
    reconciliation_status: 'n/a',
    created_at: context.nowIso,
    updated_at: context.nowIso,
    ledger_entry_type: 'reversal',
    related_transaction_id: command.existing.id,
  };
  const replacement: Transaction = {
    id: `tx_repl_${command.generatedSuffix}`,
    household_id: context.householdId,
    category_id: command.categoryId,
    amount: command.amount,
    payment_method: command.paymentMethod,
    note: trimmedNote || `Replacement for transaction ${command.existing.id}`,
    date: entryDate,
    logged_by_user_id: command.existing.logged_by_user_id,
    reconciliation_status: nextStatus,
    created_at: context.nowIso,
    updated_at: context.nowIso,
    ledger_entry_type: 'replacement',
    related_transaction_id: command.existing.id,
  };

  return [reversal, replacement].map(transaction => ({
    ...createEventMetadata(context),
    type: 'transaction.correction_logged',
    payload: { transaction },
  }));
}

export function createTransactionDeletedEvent(
  context: CommandContext,
  transaction: Transaction,
  generatedSuffix: string
): EventOf<'transaction.correction_logged'> | null {
  if (transaction.amount === 0) return null;
  const relatedTransactionId =
    (transaction.ledger_entry_type === 'adjustment' || transaction.ledger_entry_type === 'reversal') && transaction.related_transaction_id
      ? transaction.related_transaction_id
      : transaction.id;
  return {
    ...createEventMetadata(context),
    type: 'transaction.correction_logged',
    payload: {
      transaction: {
        id: `tx_del_${generatedSuffix}`,
        household_id: context.householdId,
        category_id: transaction.category_id,
        amount: -transaction.amount,
        payment_method: transaction.payment_method,
        note: `Delete reversal for transaction ${transaction.id}`,
        date: context.nowIso.split('T')[0],
        logged_by_user_id: transaction.logged_by_user_id,
        reconciliation_status: 'n/a',
        created_at: context.nowIso,
        updated_at: context.nowIso,
        ledger_entry_type: 'reversal',
        related_transaction_id: relatedTransactionId,
      },
    },
  };
}

export function createTransactionCorrectionEvent(
  context: CommandContext,
  command: { categoryId: string; amount: number; note: string; date?: string; transactionId: string }
): EventOf<'transaction.correction_logged'> {
  const entryDate = clampDateInputToToday(command.date || context.nowIso.split('T')[0]);
  return {
    ...createEventMetadata(context),
    type: 'transaction.correction_logged',
    payload: {
      transaction: {
        id: command.transactionId,
        household_id: context.householdId,
        category_id: command.categoryId,
        amount: command.amount,
        payment_method: 'secondary_account_debit',
        note: `[Correction] ${command.note.trim()}`,
        date: entryDate,
        logged_by_user_id: context.actorMemberId,
        reconciliation_status: 'n/a',
        created_at: context.nowIso,
        updated_at: context.nowIso,
      },
    },
  };
}

export function createSalaryReceivedEvent(
  context: CommandContext,
  command: {
    salaryEventId: string;
    salaryAmount: number;
    date: string;
    earnerUserId: string;
    allocations: { categoryId: string; amount: number }[];
    unallocatedCategoryId: string;
  }
): EventOf<'salary.received'> {
  const entryDate = clampDateInputToToday(command.date);
  const salaryEvent: SalaryEvent = {
    id: command.salaryEventId,
    household_id: context.householdId,
    earner_user_id: command.earnerUserId,
    amount: command.salaryAmount,
    date: entryDate,
    created_at: context.nowIso,
  };
  const allocations: Allocation[] = [];
  let totalAllocated = 0;
  for (const item of command.allocations) {
    if (item.amount > 0) {
      totalAllocated += item.amount;
      allocations.push({
        id: `alloc_${command.salaryEventId}_${item.categoryId}`,
        salary_event_id: command.salaryEventId,
        category_id: item.categoryId,
        planned_amount: item.amount,
        transferred: false,
        created_at: context.nowIso,
        updated_at: context.nowIso,
      });
    }
  }
  const unallocatedAmount = Math.max(0, command.salaryAmount - totalAllocated);
  if (unallocatedAmount > 0) {
    allocations.push({
      id: `alloc_${command.salaryEventId}_unallocated`,
      salary_event_id: command.salaryEventId,
      category_id: command.unallocatedCategoryId,
      planned_amount: unallocatedAmount,
      transferred: false,
      created_at: context.nowIso,
      updated_at: context.nowIso,
    });
  }
  return {
    ...createEventMetadata(context),
    type: 'salary.received',
    payload: { salaryEvent, allocations },
  };
}

export function createAllocationTransferToggledEvent(context: CommandContext, allocation: Allocation): EventOf<'allocation.transfer_toggled'> {
  return {
    ...createEventMetadata(context),
    type: 'allocation.transfer_toggled',
    payload: {
      allocation: {
        ...allocation,
        transferred: !allocation.transferred,
        transferred_at: !allocation.transferred ? context.nowIso : null,
        updated_at: context.nowIso,
      },
    },
  };
}

export function createAllAllocationsMarkedTransferredEvent(
  context: CommandContext,
  allocations: Allocation[],
  salaryEventId?: string
): EventOf<'allocation.all_marked_transferred'> | null {
  const updatedAllocations = allocations
    .filter(allocation => !salaryEventId || allocation.salary_event_id === salaryEventId)
    .filter(allocation => !allocation.transferred)
    .map(allocation => ({
      ...allocation,
      transferred: true,
      transferred_at: context.nowIso,
      updated_at: context.nowIso,
    }));

  if (updatedAllocations.length === 0) return null;

  return {
    ...createEventMetadata(context),
    type: 'allocation.all_marked_transferred',
    payload: { allocations: updatedAllocations },
  };
}

export function createLedgerResetToZeroEvent(
  context: CommandContext,
  ledger: LedgerState,
  resetIso: string,
  userName?: string
): EventOf<'ledger.reset_to_zero'> {
  const members = ledger.members.map(member =>
    userName && member.user_id === 'usr_me'
      ? { ...member, name: userName }
      : member
  );
  const household: Household = {
    ...ledger.household,
    name: 'Family Budget',
    first_time_intro_completed: true,
    first_time_intro_completed_at: resetIso,
    updated_at: resetIso,
  };

  return {
    ...createEventMetadata({ ...context, nowIso: resetIso }),
    type: 'ledger.reset_to_zero',
    payload: {
      resetIso,
      household,
      members,
      categories: ledger.categories,
      pushSettings: ledger.pushSettings,
      selectedMonth: ledger.selectedMonth,
      activeMemberId: ledger.activeMemberId,
      firstTimeIntroCompleted: true,
    },
  };
}

type CategoryEventType = 'category.created' | 'category.updated' | 'category.archived' | 'category.unarchived';
type CategoryEvent = EventOf<'category.created'> | EventOf<'category.updated'> | EventOf<'category.archived'> | EventOf<'category.unarchived'>;

export function createCategoryEvent(
  context: CommandContext,
  type: CategoryEventType,
  category: Category
): CategoryEvent {
  const metadata = createEventMetadata(context);
  switch (type) {
    case 'category.created':
      return { ...metadata, type: 'category.created', payload: { category } };
    case 'category.updated':
      return { ...metadata, type: 'category.updated', payload: { category } };
    case 'category.archived':
      return { ...metadata, type: 'category.archived', payload: { category } };
    case 'category.unarchived':
      return { ...metadata, type: 'category.unarchived', payload: { category } };
  }
}

export function createHouseholdUpdatedEvent(context: CommandContext, household: Household): EventOf<'household.updated'> {
  return {
    ...createEventMetadata(context),
    type: 'household.updated',
    payload: { household },
  };
}

export function createMemberProfileUpdatedEvent(context: CommandContext, member: Membership): EventOf<'member.profile_updated'> {
  return {
    ...createEventMetadata(context),
    type: 'member.profile_updated',
    payload: { member },
  };
}

export function createMemberDeletedEvent(context: CommandContext, userId: string): EventOf<'member.deleted'> {
  return {
    ...createEventMetadata(context),
    type: 'member.deleted',
    payload: { userId },
  };
}

export function createPushSettingsUpdatedEvent(context: CommandContext, pushSettings: PushSubscriptionSetting): EventOf<'push_settings.updated'> {
  return {
    ...createEventMetadata(context),
    type: 'push_settings.updated',
    payload: { pushSettings },
  };
}

export function createReconciliationCreatedEvent(
  context: CommandContext,
  command: {
    reconciliationId: string;
    categoryId: string;
    amountToPay: number;
    date: string;
    transactions: Transaction[];
    reconciliationLines: ReconciliationLine[];
  }
): EventOf<'reconciliation.created'> {
  const entryDate = clampDateInputToToday(command.date);
  const { createdLines, transactionStatusUpdates } = executeFifoReconciliation(
    command.reconciliationId,
    command.categoryId,
    command.amountToPay,
    command.transactions,
    command.reconciliationLines
  );
  const updatedTransactions = transactionStatusUpdates
    .map(update => {
      const tx = command.transactions.find(item => item.id === update.transactionId);
      return tx ? { ...tx, reconciliation_status: update.status, updated_at: context.nowIso } : null;
    })
    .filter((tx): tx is Transaction => tx !== null);
  const reconciliation: Reconciliation = {
    id: command.reconciliationId,
    household_id: context.householdId,
    category_id: command.categoryId,
    total_amount: command.amountToPay,
    date: entryDate,
    logged_by_user_id: context.actorMemberId,
    created_at: context.nowIso,
  };

  return {
    ...createEventMetadata(context),
    type: 'reconciliation.created',
    payload: { reconciliation, lines: createdLines, transactions: updatedTransactions },
  };
}

export function createReconciliationDeletedEvent(
  context: CommandContext,
  command: {
    reconciliation: Reconciliation;
    reconciliationLines: ReconciliationLine[];
    transactions: Transaction[];
    reversalId: string;
  }
): EventOf<'reconciliation.created'> | null {
  if (command.reconciliation.total_amount === 0) return null;
  const reversal: Reconciliation = {
    id: command.reversalId,
    household_id: context.householdId,
    category_id: command.reconciliation.category_id,
    total_amount: -command.reconciliation.total_amount,
    date: context.nowIso.split('T')[0],
    logged_by_user_id: command.reconciliation.logged_by_user_id,
    created_at: context.nowIso,
  };
  const reversalLines: ReconciliationLine[] = command.reconciliationLines
    .filter(line => line.reconciliation_id === command.reconciliation.id)
    .map((line, index) => ({
      id: `recline_rev_${command.reversalId}_${index}`,
      reconciliation_id: command.reversalId,
      transaction_id: line.transaction_id,
      amount_applied: -line.amount_applied,
    }));
  const statusMap = recomputeTransactionStatuses(command.transactions, [
    ...command.reconciliationLines,
    ...reversalLines,
  ]);
  const updatedTransactions = command.transactions
    .map(transaction => {
      const newStatus = statusMap.get(transaction.id);
      return newStatus ? { ...transaction, reconciliation_status: newStatus, updated_at: context.nowIso } : null;
    })
    .filter((transaction): transaction is Transaction => transaction !== null);

  return {
    ...createEventMetadata(context),
    type: 'reconciliation.created',
    payload: { reconciliation: reversal, lines: reversalLines, transactions: updatedTransactions },
  };
}

export function createEnvelopeTransferDeletedEvent(
  context: CommandContext,
  transfer: EnvelopeTransfer,
  reversalId: string
): EventOf<'envelope_transfer.created'> | null {
  if (transfer.amount === 0) return null;
  const reversalTransfer: EnvelopeTransfer = {
    id: reversalId,
    household_id: context.householdId,
    from_category_id: transfer.to_category_id,
    to_category_id: transfer.from_category_id,
    amount: transfer.amount,
    date: context.nowIso.split('T')[0],
    logged_by_user_id: transfer.logged_by_user_id,
    note: `Reversal for transfer ${transfer.id}`,
    created_at: context.nowIso,
  };
  const allocations: Allocation[] = [
    {
      id: `alloc_${reversalId}_to_original_from`,
      salary_event_id: reversalId,
      category_id: transfer.from_category_id,
      planned_amount: transfer.amount,
      transferred: true,
      transferred_at: context.nowIso,
      created_at: context.nowIso,
      updated_at: context.nowIso,
    },
    {
      id: `alloc_${reversalId}_from_original_to`,
      salary_event_id: reversalId,
      category_id: transfer.to_category_id,
      planned_amount: -transfer.amount,
      transferred: true,
      transferred_at: context.nowIso,
      created_at: context.nowIso,
      updated_at: context.nowIso,
    },
  ];

  return {
    ...createEventMetadata(context),
    type: 'envelope_transfer.created',
    payload: { transfer: reversalTransfer, allocations },
  };
}

export function createCategoryFundsDeletedEvent(
  context: CommandContext,
  allocation: Allocation,
  reversalId: string
): EventOf<'category_funds.added'> | null {
  if (allocation.planned_amount === 0) return null;
  return {
    ...createEventMetadata(context),
    type: 'category_funds.added',
    payload: {
      allocation: {
        id: reversalId,
        salary_event_id: `env_reversal_${context.nowIso}`,
        category_id: allocation.category_id,
        planned_amount: -allocation.planned_amount,
        transferred: allocation.transferred,
        transferred_at: allocation.transferred ? context.nowIso : null,
        created_at: context.nowIso,
        updated_at: context.nowIso,
        source: 'Reversal',
        note: `Reversal for top-up ${allocation.id}`,
        logged_by_user_id: allocation.logged_by_user_id || context.actorMemberId,
        deposit_holding: allocation.deposit_holding,
      },
    },
  };
}
