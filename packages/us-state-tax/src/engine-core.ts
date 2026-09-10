/**
 * The arithmetic both the state engine and the local engine need.
 *
 * Split out of `engine.ts` so that the local engine can use it without the two
 * importing each other: the state engine calls into the local one to finish a
 * return, and the local one walks bracket tables to do it.
 */
import type { Bracket, BracketDetail, StateIncomeTaxInput } from './types.js';

/**
 * The number of dependents a return claims.
 *
 * Ages are authoritative when given, because a credit banded on age needs one
 * entry per dependent and a count that disagreed with the list would silently
 * halve a family's credit or double it. Shared with the local engine so that a
 * per-person city credit counts the same people the state does.
 */
export function dependentCount(input: StateIncomeTaxInput): number {
  const ages = input.dependentAges;
  if (ages === undefined) return input.dependents ?? 0;
  if (input.dependents !== undefined && input.dependents !== ages.length) {
    throw new RangeError(
      `dependents (${input.dependents}) and dependentAges (${ages.length} ages) disagree. ` +
        `Supply an age for every dependent claimed, including those too old for any ` +
        `age-banded credit — omitting them understates the dependent exemption, and ` +
        `guessing which figure was meant would silently change a family's credit.`,
    );
  }
  return ages.length;
}

export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function nonNegative(value: number | undefined, label: string): number {
  const v = value ?? 0;
  if (!Number.isFinite(v)) throw new TypeError(`${label} must be a finite number`);
  if (v < 0) throw new RangeError(`${label} must not be negative`);
  return v;
}

/**
 * The single rate a bracket table selects for an income — Frederick County's
 * schedule, and the reason {@link applyBrackets} is not the right function for
 * every table that looks like brackets.
 *
 * The bracket containing the income supplies the rate, and that rate applies to
 * the **whole** income rather than to the band. So this returns a rate and
 * `applyBrackets` returns a tax, and the two differ by every dollar below the
 * filer's own band.
 */
export function rateForIncome(brackets: readonly Bracket[], income: number): number {
  for (const band of brackets) {
    if (income <= band.upTo) return band.rate;
  }
  /* c8 ignore next -- the last band is unbounded, so the loop always returns. */
  return brackets[brackets.length - 1]?.rate ?? 0;
}

/**
 * Ohio's schedule: find the band, charge its constant in full, then its rate on
 * the excess over the band floor.
 *
 * The detail is reported as two rows, because two things happened. The first is
 * the constant, charged on everything up to the band floor at whatever average
 * rate that implies — `$342.00` over `$26,050` is **1.3129%**, and it is the
 * only "rate" in this package that is a consequence rather than a parameter. The
 * second is the marginal rate on the excess. Reporting them as one row would
 * hide that the first is a step and not a slope: it is the same `$342` at
 * `$26,050.01` as at `$99,999`.
 *
 * The last band's `upTo` is `Infinity`, so the loop always returns.
 */
export function applyBaseAmountSchedule(
  taxableIncome: number,
  bands: readonly { upTo: number; base: number; rate: number }[],
): { tax: number; detail: BracketDetail[] } {
  const income = Math.max(0, taxableIncome);
  let floor = 0;
  for (const band of bands) {
    if (income > band.upTo) {
      floor = band.upTo;
      continue;
    }
    const excess = Math.max(0, income - floor);
    const marginal = excess * band.rate;
    const detail: BracketDetail[] = [];
    if (band.base > 0 && floor > 0) {
      detail.push({ rate: band.base / floor, incomeInBracket: floor, tax: band.base });
    }
    if (excess > 0) detail.push({ rate: band.rate, incomeInBracket: excess, tax: marginal });
    return { tax: band.base + marginal, detail };
  }
  /* c8 ignore next 2 -- the last band is unbounded, so the loop always returns. */
  return { tax: 0, detail: [] };
}

/** Walk a bracket table, returning the tax and the per-band detail. */
export function applyBrackets(
  taxableIncome: number,
  brackets: readonly Bracket[],
): { tax: number; detail: BracketDetail[] } {
  let remaining = Math.max(0, taxableIncome);
  let floor = 0;
  let tax = 0;
  const detail: BracketDetail[] = [];
  for (const band of brackets) {
    if (remaining <= 0) break;
    const width = band.upTo - floor;
    const inBand = Math.min(remaining, width);
    const bandTax = inBand * band.rate;
    if (inBand > 0) detail.push({ rate: band.rate, incomeInBracket: inBand, tax: bandTax });
    tax += bandTax;
    remaining -= inBand;
    floor = band.upTo;
  }
  return { tax, detail };
}
