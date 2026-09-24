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
 *
 * Two rules here exist only on a **separate return**, and both were missing
 * until v0.12.0. They run in opposite directions, which is why neither showed up
 * as an obviously wrong total:
 *
 * - **§ 63(c)(6)(A)** zeroes the standard deduction outright when the other
 *   spouse itemizes. Not a choice — a separate filer whose spouse itemizes has
 *   no standard deduction to compare against, so they itemize or deduct nothing.
 * - **§ 63(f)(1)(B) and (f)(2)(B)** allow the *spouse's* age and blindness
 *   amounts on a separate return, if "an additional exemption is allowable to
 *   the taxpayer for such spouse under section 151(b)" — which § 151(b) grants
 *   precisely when a joint return is NOT made and the spouse has no gross income
 *   and is not the dependent of another taxpayer. (§ 151(d)(5)(B) keeps that
 *   cross-reference alive even though the exemption amount itself is zero: the
 *   reduction to zero "shall not be taken into account in determining whether a
 *   deduction is allowed or allowable".)
 *
 * So § 151(b) is the one place in the Code where a separate return is treated
 * *more* generously than a joint one is by the same words — because on a joint
 * return both spouses are the taxpayer and the clause never fires.
 */
export function standardDeduction(options: {
  filingStatus: FilingStatus;
  year?: number;
  age65OrOlder?: boolean;
  blind?: boolean;
  spouseAge65OrOlder?: boolean;
  spouseBlind?: boolean;
  /**
   * § 63(c)(6)(A), separate returns only: the standard deduction is **zero**
   * where either spouse itemizes.
   *
   * Defaults to `false`, which is the common case. It is the one default in this
   * package that errs in the filer's favour, because the alternative — zeroing
   * the deduction for every separate filer whose caller stayed silent — is wrong
   * far more often. {@link estimateFederalTax} puts the assumption in
   * `notes` rather than leaving it silent.
   *
   * Note a spouse who qualifies as a head of household under § 7703(b) is not a
   * married individual for this purpose and does not trigger the rule.
   */
  spouseItemizes?: boolean;
  /**
   * § 151(b), separate returns only: whether the spouse had **no gross income
   * for the calendar year AND is not the dependent of another taxpayer**.
   *
   * Both halves, because § 151(b) requires both — and a flag named after one
   * half is how a caller ends up asserting the other by accident. When true, the
   * spouse's § 63(f) age and blindness amounts are allowed on this return.
   *
   * Defaults to `false`, which withholds them. Nothing else on the return
   * implies this fact, so it has to be asked.
   */
  spouseHasNoGrossIncomeAndIsNotADependent?: boolean;
}): number {
  const params = getYearParameters(options.year);
  const base = params.standardDeduction[options.filingStatus];
  if (base === undefined) {
    throw new TypeError(`Unknown filing status: ${String(options.filingStatus)}`);
  }
  const extra = params.additionalStandardDeduction[options.filingStatus];
  const separate = options.filingStatus === 'marriedFilingSeparately';

  // § 63(c)(6)(A). Zero, and the § 63(f) amounts go with it — they are additions
  // to a standard deduction, and there is no standard deduction to add to.
  if (separate && options.spouseItemizes) return 0;

  let conditions = 0;
  if (options.age65OrOlder) conditions += 1;
  if (options.blind) conditions += 1;
  // A joint return counts the spouse because the spouse is a taxpayer on it. A
  // separate return counts the spouse only when § 151(b) makes an exemption for
  // them allowable. A qualifying surviving spouse counts nobody: the spouse is
  // dead, so neither route is open, which is why this is not `!== 'single'`.
  const countsSpouse =
    options.filingStatus === 'marriedFilingJointly' ||
    (separate && options.spouseHasNoGrossIncomeAndIsNotADependent === true);
  if (countsSpouse) {
    if (options.spouseAge65OrOlder) conditions += 1;
    if (options.spouseBlind) conditions += 1;
  }

  return roundCents(base + conditions * extra);
}
