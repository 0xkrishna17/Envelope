const WHOLE_RUPEE_PATTERN = /^\d*$/;

export function isWholeRupeeInput(input: string): boolean {
  return WHOLE_RUPEE_PATTERN.test(input);
}

export function parseWholeRupeeInput(input: string): number {
  if (!isWholeRupeeInput(input) || input === '') return 0;
  return Number(input);
}
