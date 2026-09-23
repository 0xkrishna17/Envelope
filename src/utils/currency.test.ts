import { describe, it, expect } from 'vitest';
import {
  rupeesToPaise,
  paiseToRupees,
  formatPaise,
  paiseToInputString,
} from './currency';

describe('Integer Paise Currency Unit Tests', () => {
  describe('rupeesToPaise', () => {
    it('accurately converts numeric INR to integer paise avoiding float drift', () => {
      expect(rupeesToPaise(100)).toBe(10000);
      expect(rupeesToPaise(100.5)).toBe(10050);
      expect(rupeesToPaise(0.35)).toBe(35);
      expect(rupeesToPaise(0)).toBe(0);
      expect(rupeesToPaise(-50)).toBe(-5000);
    });

    it('parses formatted string currency and input strings into paise', () => {
      expect(rupeesToPaise('₹1,50,000')).toBe(15000000);
      expect(rupeesToPaise('350.75')).toBe(35075);
      expect(rupeesToPaise('50.5')).toBe(5050);
      expect(rupeesToPaise('-250.00')).toBe(-25000);
      expect(rupeesToPaise('')).toBe(0);
      expect(rupeesToPaise('-')).toBe(0);
    });
  });

  describe('paiseToRupees', () => {
    it('converts integer paise back to fractional rupees', () => {
      expect(paiseToRupees(10000)).toBe(100);
      expect(paiseToRupees(35075)).toBe(350.75);
      expect(paiseToRupees(-5000)).toBe(-50);
    });
  });

  describe('formatPaise', () => {
    it('formats into standard Indian Lakhs/Crores grouping', () => {
      expect(formatPaise(15000000)).toBe('₹1,50,000');
      expect(formatPaise(1000000000)).toBe('₹1,00,00,000'); // 1 crore
      expect(formatPaise(35000)).toBe('₹350');
      expect(formatPaise(45050, { showDecimals: true })).toBe('₹450.50');
    });

    it('formats negative amounts and explicit positive signs', () => {
      expect(formatPaise(-25000)).toBe('-₹250');
      expect(formatPaise(50000, { showSign: true })).toBe('+₹500');
    });
  });

  describe('paiseToInputString', () => {
    it('returns empty string for zero and formatted string for inputs', () => {
      expect(paiseToInputString(0)).toBe('');
      expect(paiseToInputString(150000)).toBe('1500');
      expect(paiseToInputString(125050)).toBe('1250.50');
    });
  });
});
