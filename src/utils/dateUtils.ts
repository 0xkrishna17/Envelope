/**
 * Date and Month Formatting Utilities for Envelope Budgeting
 */

export function parseYearMonth(yearMonth: string): { year: number; month: number } {
  if (!yearMonth) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const [yStr, mStr] = yearMonth.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(y) || isNaN(m)) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year: y, month: m };
}

/**
 * Format YYYY-MM into friendly display text:
 * mode 'short': "Sep 2026"
 * mode 'long': "September 2026"
 */
export function formatSelectedMonth(yearMonth: string, mode: 'short' | 'long' = 'short'): string {
  const { year, month } = parseYearMonth(yearMonth);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-IN', {
    month: mode === 'long' ? 'long' : 'short',
    year: 'numeric',
  });
}

/**
 * Check if the given YYYY-MM string matches the current calendar month
 */
export function isCurrentCalendarMonth(yearMonth: string): boolean {
  if (!yearMonth) return false;
  const now = new Date();
  const currentStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return yearMonth === currentStr;
}

/**
 * Returns a descriptive month tag for labels:
 * e.g., if user prefers to know if it's the current month:
 * "Sep 2026" or "Sep 2026 (This Month)"
 */
export function getSelectedMonthLabel(yearMonth: string, options?: { includeThisMonthBadge?: boolean }): string {
  const monthName = formatSelectedMonth(yearMonth, 'short');
  if (options?.includeThisMonthBadge && isCurrentCalendarMonth(yearMonth)) {
    return `${monthName} (This Month)`;
  }
  return monthName;
}
