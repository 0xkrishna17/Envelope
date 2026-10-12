import { describe, expect, it } from 'vitest';
import { createAddFundsInitializationKey } from './AddCategoryFundsModal';

describe('createAddFundsInitializationKey', () => {
  it('is stable for the same open add-money session', () => {
    expect(createAddFundsInitializationKey(true, 'cat_groceries', undefined)).toBe('cat_groceries:');
    expect(createAddFundsInitializationKey(true, 'cat_groceries', undefined)).toBe('cat_groceries:');
  });

  it('changes only when initial add-money inputs change', () => {
    expect(createAddFundsInitializationKey(true, 'cat_groceries', 500)).toBe('cat_groceries:500');
    expect(createAddFundsInitializationKey(true, 'cat_dining', 500)).toBe('cat_dining:500');
    expect(createAddFundsInitializationKey(true, 'cat_groceries', 1000)).toBe('cat_groceries:1000');
  });

  it('clears when the add-money screen closes', () => {
    expect(createAddFundsInitializationKey(false, 'cat_groceries', 500)).toBeNull();
  });
});
