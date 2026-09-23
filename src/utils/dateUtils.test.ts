import { describe, it, expect } from 'vitest';
import {
  parseYearMonth,
  formatSelectedMonth,
  isCurrentCalendarMonth,
  getSelectedMonthLabel,
} from './dateUtils';

describe('Date & Month Formatting Utilities Unit Tests', () => {
  describe('parseYearMonth', () => {
    it('parses valid YYYY-MM strings correctly', () => {
      const res = parseYearMonth('2026-09');
      expect(res).toEqual({ year: 2026, month: 9 });
    });

    it('falls back to current date when input is empty or invalid', () => {
      const res = parseYearMonth('');
      expect(typeof res.year).toBe('number');
      expect(typeof res.month).toBe('number');
    });
  });

  describe('formatSelectedMonth', () => {
    it('formats year-month into short and long representations', () => {
      const shortStr = formatSelectedMonth('2026-09', 'short');
      expect(shortStr).toContain('Sep');
      expect(shortStr).toContain('2026');

      const longStr = formatSelectedMonth('2026-09', 'long');
      expect(longStr).toContain('September');
      expect(longStr).toContain('2026');
    });
  });

  describe('isCurrentCalendarMonth and getSelectedMonthLabel', () => {
    it('accurately identifies current calendar month', () => {
      const now = new Date();
      const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(isCurrentCalendarMonth(currentYM)).toBe(true);
      expect(isCurrentCalendarMonth('1999-01')).toBe(false);
    });

    it('attaches badge when includeThisMonthBadge is enabled for current month', () => {
      const now = new Date();
      const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const label = getSelectedMonthLabel(currentYM, { includeThisMonthBadge: true });
      expect(label).toContain('(This Month)');
    });
  });
});
