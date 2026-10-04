export const HOUSEHOLDS_COLLECTION = 'households';

export const HOUSEHOLD_SUBCOLLECTIONS = {
  members: 'members',
  categories: 'categories',
  salaryEvents: 'salaryEvents',
  allocations: 'allocations',
  transactions: 'transactions',
  reconciliations: 'reconciliations',
  reconciliationLines: 'reconciliationLines',
  envelopeTransfers: 'envelopeTransfers',
} as const;

export type HouseholdSubcollectionKey = keyof typeof HOUSEHOLD_SUBCOLLECTIONS;

export function householdPath(householdDocId: string): string {
  return `${HOUSEHOLDS_COLLECTION}/${householdDocId}`;
}

export function householdSubcollectionPath(
  householdDocId: string,
  key: HouseholdSubcollectionKey
): string {
  return `${householdPath(householdDocId)}/${HOUSEHOLD_SUBCOLLECTIONS[key]}`;
}
