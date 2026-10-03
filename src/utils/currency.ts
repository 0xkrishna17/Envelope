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

const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen'
];

const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
];

function numberToIndianWords(num: number): string {
  if (num === 0) return 'zero';

  const parts: string[] = [];

  const crores = Math.floor(num / 10000000);
  num %= 10000000;
  if (crores > 0) {
    parts.push(`${numberToIndianWords(crores)} crore`);
  }

  const lakhs = Math.floor(num / 100000);
  num %= 100000;
  if (lakhs > 0) {
    parts.push(`${numberToIndianWords(lakhs)} lakh`);
  }

  const thousands = Math.floor(num / 1000);
  num %= 1000;
  if (thousands > 0) {
    parts.push(`${numberToIndianWords(thousands)} thousand`);
  }

  const hundreds = Math.floor(num / 100);
  num %= 100;
  if (hundreds > 0) {
    parts.push(`${ONES[hundreds]} hundred`);
  }

  if (num > 0) {
    if (num < 20) {
      parts.push(ONES[num]);
    } else {
      const ten = Math.floor(num / 10);
      const one = num % 10;
      parts.push(one > 0 ? `${TENS[ten]}-${ONES[one]}` : TENS[ten]);
    }
  }

  return parts.join(' ').trim();
}

/**
 * Converts integer paise into words in the Indian numbering system.
 * e.g. 15000000 -> "One lakh fifty thousand rupees only"
 * e.g. 245050 -> "Two thousand four hundred fifty rupees and fifty paise"
 */
export function paiseToWords(paise: number): string {
  if (paise === 0) return 'Zero rupees';

  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainder = absPaise % 100;

  const wordsParts: string[] = [];

  if (rupees > 0) {
    const rupeesWords = numberToIndianWords(rupees);
    wordsParts.push(`${rupeesWords} ${rupees === 1 ? 'rupee' : 'rupees'}`);
  }

  if (remainder > 0) {
    const paiseWords = numberToIndianWords(remainder);
    wordsParts.push(`${paiseWords} paise`);
  }

  let finalStr = wordsParts.join(' and ');
  if (!finalStr) finalStr = 'zero rupees';

  // Capitalize first letter and append 'only'
  finalStr = finalStr.charAt(0).toUpperCase() + finalStr.slice(1);
  if (remainder === 0 && rupees > 0) {
    finalStr += ' only';
  }

  return isNegative ? `Minus ${finalStr}` : finalStr;
}

