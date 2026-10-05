export const HOUSEHOLDS_COLLECTION = 'households';
export const HOUSEHOLD_EVENTS_COLLECTION = 'events';

export function householdPath(householdDocId: string): string {
  return `${HOUSEHOLDS_COLLECTION}/${householdDocId}`;
}

export function householdEventsPath(householdDocId: string): string {
  return `${householdPath(householdDocId)}/${HOUSEHOLD_EVENTS_COLLECTION}`;
}

export function householdEventPath(householdDocId: string, eventId: string): string {
  return `${householdEventsPath(householdDocId)}/${eventId}`;
}
