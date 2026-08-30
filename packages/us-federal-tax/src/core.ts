import type { Bracket, BracketDetail, FilingStatus, YearParameters } from './types.js';
import { YEAR_2024 } from './data/2024.js';
import { YEAR_2025 } from './data/2025.js';
import { YEAR_2026 } from './data/2026.js';

/** Every tax year this package knows about, newest last. */
export const YEARS: Readonly<Record<number, YearParameters>> = {
  2024: YEAR_2024,
  2025: YEAR_2025,
  2026: YEAR_2026,
};

/** Every supported tax year, ascending. */
export const SUPPORTED_YEARS: readonly number[] = Object.keys(YEARS)
  .map(Number)
  .sort((a, b) => a - b);

/** The most recent tax year with published parameters. */
export const LATEST_YEAR = 2026;

export class UnsupportedYearError extends Error {
  constructor(year: number) {
    super(
      `Tax year ${year} is not supported. Available years: ${Object.keys(YEARS).join(', ')}. ` +
        `This package only ships parameters that have been published by the IRS and cross-checked.`,
    );
    this.name = 'UnsupportedYearError';
  }
}

/**
 * Look up the parameter set for a tax year.
 *
 * Throws rather than silently falling back to another year: quietly computing
 * 2026 tax with 2025 brackets is the kind of bug that is invisible until it is
 * expensive.
 */
export function getYearParameters(year: number = LATEST_YEAR): YearParameters {
  const params = YEARS[year];
  if (!params) throw new UnsupportedYearError(year);
  return params;
}

/** Round to cents, avoiding the usual binary-floating-point surprises. */
export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertFinite(value: number, name: string): void {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError(`${name} must be a number, received ${String(value)}`);
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite, received ${value}`);
  }
}

/** Coerce an input amount to a non-negative finite number. */
export function nonNegative(value: number | undefined, name: string): number {
  if (value === undefined) return 0;
  assertFinite(value, name);
  return Math.max(0, value);
}

/**
 * Walk a progressive bracket table.
 *
 * `offset` lets a second income type be stacked on top of ordinary income, which
 * is exactly how long-term capital gains are taxed: the gain occupies the bands
 * *above* whatever ordinary income already filled.
 */
export function applyBrackets(
  amount: number,
  brackets: readonly Bracket[],
  offset = 0,
): { tax: number; marginalRate: number; details: BracketDetail[] } {
  const details: BracketDetail[] = [];
  const marginalRate = marginalRateAt(amount + offset, brackets);
  if (amount <= 0) {
    return { tax: 0, marginalRate, details };
  }

  let tax = 0;
  // `lower` walks the top of the previous band; `placed` tracks how much of the
  // stacked amount we have already assigned to a band.
  let lower = 0;
  let placed = 0;

  for (const bracket of brackets) {
    const bandStart = Math.max(lower, offset);
    const bandEnd = bracket.upTo;
    if (bandEnd > bandStart) {
      const remaining = amount - placed;
      if (remaining <= 0) break;
      const incomeInBracket = Math.min(remaining, bandEnd - bandStart);
      if (incomeInBracket > 0) {
        const bandTax = incomeInBracket * bracket.rate;
        tax += bandTax;
        placed += incomeInBracket;
        details.push({ rate: bracket.rate, incomeInBracket, tax: roundCents(bandTax) });
      }
    }
    lower = bracket.upTo;
  }

  return { tax: roundCents(tax), marginalRate, details };
}

/**
 * The rate that would apply to the *next* dollar of income at `income`.
 *
 * Defined as the first band whose upper bound is strictly above `income`, so a
 * filer sitting exactly on a bracket boundary is reported at the higher rate —
 * which is what "what does one more dollar cost me?" actually means.
 */
export function marginalRateAt(income: number, brackets: readonly Bracket[]): number {
  const at = Math.max(0, income);
  for (const bracket of brackets) {
    if (bracket.upTo > at) return bracket.rate;
  }
  return brackets[brackets.length - 1]?.rate ?? 0;
}

/**
 * The standard deduction, including the extra amounts for filers (and spouses)
 * who are 65 or older or blind. Each condition counts separately, so a single
 * filer who is both 65+ and blind receives two additional amounts.
 */
export function standardDeduction(options: {
  filingStatus: FilingStatus;
  year?: number;
  age65OrOlder?: boolean;
  blind?: boolean;
  spouseAge65OrOlder?: boolean;
  spouseBlind?: boolean;
}): number {
  const params = getYearParameters(options.year);
  const base = params.standardDeduction[options.filingStatus];
  if (base === undefined) {
    throw new TypeError(`Unknown filing status: ${String(options.filingStatus)}`);
  }
  const extra = params.additionalStandardDeduction[options.filingStatus];

  let conditions = 0;
  if (options.age65OrOlder) conditions += 1;
  if (options.blind) conditions += 1;
  // Spouse amounts only apply on a joint return (or for a surviving spouse).
  if (options.filingStatus === 'marriedFilingJointly') {
    if (options.spouseAge65OrOlder) conditions += 1;
    if (options.spouseBlind) conditions += 1;
  }

  return roundCents(base + conditions * extra);
}
