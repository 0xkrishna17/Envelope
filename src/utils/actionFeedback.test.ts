import { describe, expect, it } from 'vitest';
import {
  correctionLoggedMessage,
  expenseLoggedMessage,
  fundsAddedMessage,
  fundsMovedMessage,
  salaryAddedMessage,
} from './actionFeedback';

describe('action feedback messages', () => {
  it('builds concise contextual success messages', () => {
    expect(expenseLoggedMessage('Groceries')).toBe('Expense logged to Groceries');
    expect(fundsAddedMessage(50000, 'Travel')).toBe('Added ₹500 to Travel');
    expect(fundsMovedMessage(125000, 'Dining', 'Rent')).toBe('Moved ₹1,250 from Dining to Rent');
    expect(salaryAddedMessage()).toBe('Salary added and envelopes updated');
    expect(correctionLoggedMessage()).toBe('Correction logged');
  });
});
