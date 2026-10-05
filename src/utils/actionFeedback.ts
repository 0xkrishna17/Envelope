import { formatPaise } from './currency';

export function expenseLoggedMessage(categoryName: string): string {
  return `Expense logged to ${categoryName}`;
}

export function fundsAddedMessage(amountPaise: number, categoryName: string): string {
  return `Added ${formatPaise(amountPaise)} to ${categoryName}`;
}

export function fundsMovedMessage(amountPaise: number, fromCategoryName: string, toCategoryName: string): string {
  return `Moved ${formatPaise(amountPaise)} from ${fromCategoryName} to ${toCategoryName}`;
}

export function salaryAddedMessage(): string {
  return 'Salary added and envelopes updated';
}

export function transactionUpdatedMessage(): string {
  return 'Transaction updated';
}

export function entryReversedMessage(): string {
  return 'Entry reversed';
}

export function correctionLoggedMessage(): string {
  return 'Correction logged';
}

export function cardPaybackReconciledMessage(): string {
  return 'Card payback reconciled';
}

export function cardPaybackReversedMessage(): string {
  return 'Card payback reversed';
}

export function topUpReversedMessage(): string {
  return 'Top-up reversed';
}

export function transferReversedMessage(): string {
  return 'Transfer reversed';
}

export function profileSavedMessage(): string {
  return 'Profile saved';
}

export function notificationSettingsSavedMessage(): string {
  return 'Notification settings saved';
}
