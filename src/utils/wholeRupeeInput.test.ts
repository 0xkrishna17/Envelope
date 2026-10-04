import { describe, expect, it } from 'vitest';
import { isWholeRupeeInput, parseWholeRupeeInput } from './wholeRupeeInput';

describe('wholeRupeeInput', () => {
  it('accepts any whole rupee amount, including non-rounded values', () => {
    expect(isWholeRupeeInput('1')).toBe(true);
    expect(isWholeRupeeInput('123')).toBe(true);
    expect(isWholeRupeeInput('150001')).toBe(true);
    expect(parseWholeRupeeInput('150001')).toBe(150001);
  });

  it('rejects floating or formatted values', () => {
    expect(isWholeRupeeInput('1.5')).toBe(false);
    expect(isWholeRupeeInput('100.00')).toBe(false);
    expect(isWholeRupeeInput('1,000')).toBe(false);
    expect(parseWholeRupeeInput('1.5')).toBe(0);
  });
});
