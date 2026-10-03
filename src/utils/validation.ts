import { rupeesToPaise } from './currency';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface AmountValidationResult extends ValidationResult {
  paise: number;
}

/**
 * Validates monetary input: must be a positive number (or zero if allowed).
 * Rejects negative numbers, NaN, non-numeric strings.
 */
export function validateAmount(
  input: number | string,
  options: { allowZero?: boolean; maxPaise?: number; label?: string } = {}
): AmountValidationResult {
  const label = options.label || 'Amount';

  if (input === '' || input === null || input === undefined) {
    return { valid: false, paise: 0, error: `${label} is required` };
  }

  const rawStr = typeof input === 'string' ? input.trim() : String(input);
  if (rawStr.startsWith('-')) {
    return { valid: false, paise: 0, error: `${label} cannot be negative` };
  }

  const num = typeof input === 'number' ? input : Number(rawStr);
  if (isNaN(num)) {
    return { valid: false, paise: 0, error: `Please enter a valid numeric ${label.toLowerCase()}` };
  }

  const paise = rupeesToPaise(input);

  if (paise < 0) {
    return { valid: false, paise: 0, error: `${label} cannot be negative` };
  }

  if (paise === 0 && !options.allowZero) {
    return { valid: false, paise: 0, error: `${label} must be greater than zero` };
  }

  if (options.maxPaise !== undefined && paise > options.maxPaise) {
    return {
      valid: false,
      paise,
      error: `${label} cannot exceed the available balance of ₹${(options.maxPaise / 100).toLocaleString('en-IN')}`,
    };
  }

  return { valid: true, paise };
}

/**
 * Validates an envelope-to-envelope transfer:
 * - Source and target must be distinct
 * - Amount must be positive
 * - Source must have sufficient funds
 */
export function validateEnvelopeTransfer(
  fromCategoryId: string,
  toCategoryId: string,
  amountPaise: number,
  fromAvailablePaise: number
): ValidationResult {
  if (!fromCategoryId) {
    return { valid: false, error: 'Please select a source envelope' };
  }
  if (!toCategoryId) {
    return { valid: false, error: 'Please select a destination envelope' };
  }
  if (fromCategoryId === toCategoryId) {
    return { valid: false, error: 'Source and destination envelopes must be different' };
  }
  if (amountPaise <= 0) {
    return { valid: false, error: 'Transfer amount must be greater than zero' };
  }
  if (amountPaise > fromAvailablePaise) {
    return {
      valid: false,
      error: `Insufficient funds. Available: ₹${(fromAvailablePaise / 100).toLocaleString('en-IN')}`,
    };
  }
  return { valid: true };
}

/**
 * Validates category creation/renaming:
 * - Not empty
 * - At least 2 characters
 * - Unique across active envelopes
 */
export function validateCategoryName(
  name: string,
  existingNames: string[],
  currentName?: string
): ValidationResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Envelope name cannot be empty' };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: 'Envelope name must be at least 2 characters long' };
  }
  if (trimmed.length > 50) {
    return { valid: false, error: 'Envelope name must be 50 characters or fewer' };
  }

  const normalized = trimmed.toLowerCase();
  const normalizedCurrent = currentName?.trim().toLowerCase();

  const isDuplicate = existingNames.some(existing => {
    const norm = existing.trim().toLowerCase();
    return norm === normalized && norm !== normalizedCurrent;
  });

  if (isDuplicate) {
    return { valid: false, error: `An envelope named "${trimmed}" already exists` };
  }

  return { valid: true };
}

/**
 * Validates salary allocation:
 * - Checks that all splits are non-negative
 * - Compares total allocated with total salary
 */
export function validateSalarySplit(
  totalSalaryPaise: number,
  allocations: { categoryId: string; amountPaise: number }[]
): { valid: boolean; unallocatedPaise: number; error?: string } {
  if (totalSalaryPaise <= 0) {
    return { valid: false, unallocatedPaise: 0, error: 'Total salary must be greater than zero' };
  }

  let allocatedSum = 0;
  for (const item of allocations) {
    if (item.amountPaise < 0) {
      return { valid: false, unallocatedPaise: 0, error: 'Category allocations cannot be negative' };
    }
    allocatedSum += item.amountPaise;
  }

  const unallocatedPaise = totalSalaryPaise - allocatedSum;
  if (unallocatedPaise < 0) {
    return {
      valid: false,
      unallocatedPaise,
      error: `Total allocated exceeds salary by ₹${(Math.abs(unallocatedPaise) / 100).toLocaleString('en-IN')}`,
    };
  }

  return { valid: true, unallocatedPaise };
}
