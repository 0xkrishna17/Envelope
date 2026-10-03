import { describe, it, expect } from 'vitest';
import {
  validateAmount,
  validateEnvelopeTransfer,
  validateCategoryName,
  validateSalarySplit,
} from './validation';

describe('Validation Utilities Unit Tests', () => {
  describe('validateAmount', () => {
    it('accepts valid positive numbers and strings', () => {
      const res1 = validateAmount(500);
      expect(res1.valid).toBe(true);
      expect(res1.paise).toBe(50000);

      const res2 = validateAmount('1250.50');
      expect(res2.valid).toBe(true);
      expect(res2.paise).toBe(125050);
    });

    it('rejects negative values with a descriptive error', () => {
      const res1 = validateAmount(-100);
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('cannot be negative');

      const res2 = validateAmount('-500');
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('cannot be negative');
    });

    it('rejects zero when allowZero is false', () => {
      const res = validateAmount(0);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('must be greater than zero');
    });

    it('allows zero when allowZero is true', () => {
      const res = validateAmount(0, { allowZero: true });
      expect(res.valid).toBe(true);
      expect(res.paise).toBe(0);
    });

    it('rejects non-numeric strings and empty inputs', () => {
      expect(validateAmount('').valid).toBe(false);
      expect(validateAmount('abc').valid).toBe(false);
    });

    it('enforces maxPaise bounds when provided', () => {
      const resExceeded = validateAmount(1000, { maxPaise: 50000 }); // ₹1000 > ₹500 available
      expect(resExceeded.valid).toBe(false);
      expect(resExceeded.error).toContain('cannot exceed the available balance');

      const resWithin = validateAmount(500, { maxPaise: 50000 });
      expect(resWithin.valid).toBe(true);
    });
  });

  describe('validateEnvelopeTransfer', () => {
    it('validates a successful transfer between two distinct envelopes', () => {
      const res = validateEnvelopeTransfer('cat_groceries', 'cat_dining', 50000, 100000);
      expect(res.valid).toBe(true);
    });

    it('rejects transfer when source and destination are the same', () => {
      const res = validateEnvelopeTransfer('cat_groceries', 'cat_groceries', 50000, 100000);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('must be different');
    });

    it('rejects transfer when amount is zero or negative', () => {
      const resZero = validateEnvelopeTransfer('cat_groceries', 'cat_dining', 0, 100000);
      expect(resZero.valid).toBe(false);

      const resNeg = validateEnvelopeTransfer('cat_groceries', 'cat_dining', -100, 100000);
      expect(resNeg.valid).toBe(false);
    });

    it('rejects transfer when amount exceeds available balance', () => {
      const res = validateEnvelopeTransfer('cat_groceries', 'cat_dining', 150000, 100000);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Insufficient funds');
    });
  });

  describe('validateCategoryName', () => {
    const existing = ['Groceries', 'Dining Out', 'Utilities'];

    it('accepts valid new category name', () => {
      const res = validateCategoryName('Rent & Maintenance', existing);
      expect(res.valid).toBe(true);
    });

    it('rejects empty or whitespace-only name', () => {
      const res = validateCategoryName('   ', existing);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cannot be empty');
    });

    it('rejects duplicate names case-insensitively', () => {
      const res = validateCategoryName('groceries', existing);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('already exists');
    });

    it('allows keeping current name when editing', () => {
      const res = validateCategoryName('Groceries', existing, 'Groceries');
      expect(res.valid).toBe(true);
    });
  });

  describe('validateSalarySplit', () => {
    it('validates correct split where total equals salary', () => {
      const res = validateSalarySplit(1000000, [
        { categoryId: 'c1', amountPaise: 600000 },
        { categoryId: 'c2', amountPaise: 400000 },
      ]);
      expect(res.valid).toBe(true);
      expect(res.unallocatedPaise).toBe(0);
    });

    it('calculates unallocated surplus when total allocations are less than salary', () => {
      const res = validateSalarySplit(1000000, [
        { categoryId: 'c1', amountPaise: 400000 },
        { categoryId: 'c2', amountPaise: 300000 },
      ]);
      expect(res.valid).toBe(true);
      expect(res.unallocatedPaise).toBe(300000);
    });

    it('rejects when allocations exceed total salary', () => {
      const res = validateSalarySplit(1000000, [
        { categoryId: 'c1', amountPaise: 700000 },
        { categoryId: 'c2', amountPaise: 400000 },
      ]);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('exceeds salary');
    });

    it('rejects negative envelope amounts', () => {
      const res = validateSalarySplit(1000000, [
        { categoryId: 'c1', amountPaise: -50000 },
        { categoryId: 'c2', amountPaise: 500000 },
      ]);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cannot be negative');
    });
  });
});
