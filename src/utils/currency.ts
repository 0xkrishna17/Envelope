/**
 * Integer Paise Currency Utilities
 * Single currency: ₹ (INR) only.
 * Hard rule from Plan v3: Stored as integer paise everywhere (1 INR = 100 paise).
 * No floating point money arithmetic.
 */

export function rupeesToPaise(rupeesInput: number | string): number {
  if (typeof rupeesInput === 'number') {
    return Math.round(rupeesInput * 100);
  }
  const clean = rupeesInput.replace(/[^0-9.-]/g, '').trim();
  if (!clean || clean === '-') return 0;
  
  const isNegative = clean.startsWith('-');
  const unsigned = isNegative ? clean.slice(1) : clean;
  const parts = unsigned.split('.');
  const whole = parseInt(parts[0] || '0', 10);
  const fraction = (parts[1] || '').padEnd(2, '0').slice(0, 2);
  const paise = whole * 100 + parseInt(fraction, 10);
  
  return isNegative ? -paise : paise;
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/**
 * Format integer paise into standard Indian Currency representation:
 * e.g. 15000000 paise -> ₹1,50,000
 * e.g. 245050 paise -> ₹2,450.50
 */
export function formatPaise(
  paise: number,
  options: {
    showDecimals?: boolean;
    showSign?: boolean;
    compact?: boolean;
  } = {}
): string {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainder = absPaise % 100;

  // Format integer according to Indian numbering system (Lakhs, Crores)
  const rupeesStr = rupees.toString();
  let formattedRupees = '';

  if (rupeesStr.length <= 3) {
    formattedRupees = rupeesStr;
  } else {
    const lastThree = rupeesStr.substring(rupeesStr.length - 3);
    const otherNumbers = rupeesStr.substring(0, rupeesStr.length - 3);
    const withCommas = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedRupees = `${withCommas},${lastThree}`;
  }

  let result = `₹${formattedRupees}`;
  if (options.showDecimals || remainder > 0) {
    result += `.${remainder.toString().padStart(2, '0')}`;
  }

  if (isNegative) {
    return `-${result}`;
  }
  if (options.showSign && paise > 0) {
    return `+${result}`;
  }
  return result;
}

/**
 * Format plain number for input fields
 */
export function paiseToInputString(paise: number): string {
  if (paise === 0) return '';
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? rupees.toString() : rupees.toFixed(2);
}
