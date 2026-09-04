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
