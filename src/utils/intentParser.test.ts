import { describe, it, expect } from 'vitest';
import { parseIntentWithLocalRules } from '../../server/intentParser';

describe('Voice & Natural Language Intent Parser Unit Tests', () => {
  const availableCategories = ['Groceries', 'Dining Out', 'Utilities', 'Transportation', 'Rent'];

  it('correctly parses spend transactions with credit card payment method', () => {
    const res = parseIntentWithLocalRules('Spent 450 on Groceries with credit card', availableCategories);
    expect(res.intent).toBe('add_transaction');
    expect(res.amountInPaise).toBe(45000); // ₹450 = 45000 paise
    expect(res.categoryName).toBe('Groceries');
    expect(res.paymentMethod).toBe('credit_card');
  });

  it('correctly parses spend account debit / UPI transactions', () => {
    const res = parseIntentWithLocalRules('Paid 1200 for Dining Out via UPI debit', availableCategories);
    expect(res.intent).toBe('add_transaction');
    expect(res.amountInPaise).toBe(120000);
    expect(res.categoryName).toBe('Dining Out');
    expect(res.paymentMethod).toBe('secondary_account_debit');
  });

  it('correctly parses envelope-to-envelope money moves (reallocation)', () => {
    const res = parseIntentWithLocalRules('Move 1000 from Groceries to Dining Out', availableCategories);
    expect(res.intent).toBe('move_funds');
    expect(res.amountInPaise).toBe(100000);
    expect(res.fromCategoryName).toBe('Groceries');
    expect(res.toCategoryName).toBe('Dining Out');
  });

  it('correctly parses salary arrival events', () => {
    const res = parseIntentWithLocalRules('Salary of 75000 credited today', availableCategories);
    expect(res.intent).toBe('mark_salary_arrived');
    expect(res.amountInPaise).toBe(7500000);
    expect(res.earnerName).toBe('Primary');
  });

  it('handles Indian shorthand amounts such as "1.5 lakh" or "5k"', () => {
    const resK = parseIntentWithLocalRules('Spent 5k on Utilities', availableCategories);
    expect(resK.amountInPaise).toBe(500000); // 5000 * 100 = 500000 paise

    const resLakh = parseIntentWithLocalRules('Salary 1.5 lakh received', availableCategories);
    expect(resLakh.amountInPaise).toBe(15000000); // 150000 * 100 = 15000000 paise
  });

  it('correctly parses credit card settlement / reconciliation requests', () => {
    const res = parseIntentWithLocalRules('Reconcile 3000 for Groceries', availableCategories);
    expect(res.intent).toBe('mark_reconciled');
    expect(res.amountInPaise).toBe(300000);
    expect(res.categoryName).toBe('Groceries');
  });
});
