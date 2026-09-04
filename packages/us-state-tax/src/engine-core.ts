/**
 * The arithmetic both the state engine and the local engine need.
 *
 * Split out of `engine.ts` so that the local engine can use it without the two
 * importing each other: the state engine calls into the local one to finish a
 * return, and the local one walks bracket tables to do it.
 */
import type { Bracket, BracketDetail } from './types.js';

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
