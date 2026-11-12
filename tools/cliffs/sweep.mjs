/**
 * The discontinuity sweep: find every jump in a state's tax function, locate it
 * to the cent, and say which figure in the result moved.
 *
 * ## What this instrument is for, and why neither existing harness could do it
 *
 * `tools/differential` compares this engine to `policyengine-us` over 2,904
 * households, and `tools/audit` compares it to a buyer's own figures. Both
 * compare *answers at points*. Day 75 found a defect in `policyengine-us` that
 * neither could have found — their Indiana earned income credit is zeroed by a
 * gate evaluated at a frozen year, so one cent of extra wages costs a filer
 * `$111.09` — and wrote down why:
 *
 * > Finding that needs two households a cent apart, and this grid samples
 * > incomes in round thousands — so does their own test suite.
 *
 * A discontinuity is a property of the tax *function*, not of any household in
 * it. This file walks the function.
 *
 * ## The detector, and the exact arithmetic that makes it sound
 *
 * A state income tax is piecewise linear in income: brackets, deductions and
 * phase-outs are all linear within a band, and the band boundaries are kinks.
 * A kink is not a defect. A *jump* is — or it is the law, which is the other
 * half of the report.
 *
 * Over a uniform grid of step `h`, the second difference
 *
 * ```text
 *   D2(x) = f(x+h) - 2f(x) + f(x-h)
 * ```
 *
 * is zero where `f` is linear, bounded by `|dr| x h` at a kink of rate change
 * `dr`, and approximately `+/-J` at a jump of size `J`. At `h = $100` a one-point
 * bracket change contributes about `$1`; a notch contributes its whole size. So
 * `|D2| > $3` flags a neighbourhood, and the flag is then *refined* rather than
 * reported: two rounds of tenfold subdivision followed by a binary search on
 * the secant slope, which either lands on a pair of incomes one cent apart with
 * a jump between them or concludes there is no jump there.
 *
 * **A false positive costs about thirty evaluations and produces no line in the
 * report.** That asymmetry is the whole design: the detector is tuned to be
 * noisy and the refinement is tuned to be exact, because the expensive mistake
 * is a report that claims a notch that is not there.
 *
 * ## What the sweep measures, and the one thing that hides a notch from it
 *
 * It measures `totalTax`, which is the figure a payroll or planning product
 * prints, and which is **floored at zero**. A notch inside a region where a
 * refundable or large credit covers the whole bill does not move it. That is not
 * a flaw to be worked around: a notch that moves nobody's tax is not a notch in
 * anybody's money. But it does mean a notch can exist for one household shape
 * and be invisible for another, which is why `shapes.mjs` carries a childless
 * shape whose only job is to have no credit to hide behind.
 *
 * ## The axis, which is the second thing that hides a notch
 *
 * This file is parameterised by an `axis` — the one variable that moves while
 * the rest of the household stands still. A means test keyed on a component of
 * income is invisible to every axis that does not move that component, and
 * before Day 78 there was one axis. `shapes.mjs` holds the list and the
 * argument for each entry; the detector and the refinement below are identical
 * on all of them, because a discontinuity in a function of one variable is the
 * same object whichever variable it is.
 */

import { stateIncomeTax } from '../../packages/us-state-tax/dist/esm/index.js';
import { householdInput } from '../differential/ours.mjs';
import { FLAG_THRESHOLD, MIN_JUMP, WAGE_AXIS, caseFor } from './shapes.mjs';

/** Cents, so a wage is never 59478.000000001. */
const cents = (x) => Math.round(x * 100) / 100;

/**
 * The full result for one household, cached by wage.
 *
 * The cache matters: the refinement re-evaluates points the grid already has,
 * and the binary search re-evaluates its own bounds. Without it the sweep costs
 * about 40% more for the same answer.
 */
export function evaluator(shape, state, year, axis = WAGE_AXIS) {
  const seen = new Map();
  return (value) => {
    const key = cents(value);
    const hit = seen.get(key);
    if (hit !== undefined) return hit;
    let out;
    try {
      out = stateIncomeTax(householdInput(caseFor(shape, state, year, key, axis)).base);
    } catch (e) {
      out = { error: String(e?.message ?? e), totalTax: NaN };
    }
    if (seen.size < 100_000) seen.set(key, out);
    return out;
  };
}

/**
 * Narrow a flagged neighbourhood to a pair of incomes one cent apart, or decide
 * there is no jump in it.
 *
 * Returns `null` for a kink. Two tenfold subdivisions take a `$200`-wide window
 * to `$2` while following the largest second difference, after which a window
 * that still contains a jump has a secant slope above 1 — a dollar of income
 * costing more than a dollar — and a window that contains only kinks does not,
 * because no state and local marginal rate in this package reaches 100%.
 */
export function locate(f, a, b) {
  const tax = (x) => f(x).totalTax;
  // `h` is recomputed from the CURRENT window on every round. Deriving both
  // rounds' steps from the original width — `[(b-a)/10, (b-a)/100]` — looks
  // equivalent and is not: after the first round the window is a tenth of what
  // it was, so a step of a hundredth of the ORIGINAL spans only a tenth of it,
  // and the second round walks the left-hand tenth of the window while the jump
  // sits at its right-hand edge. That was the first version of this function and
  // three of `self-check.mjs`'s synthetic cases are what found it.
  for (let round = 0; round < 2; round++) {
    const h = (b - a) / 10;
    const xs = [];
    const ys = [];
    for (let i = 0; i <= 10; i++) {
      const x = cents(a + i * h);
      xs.push(x);
      ys.push(tax(x));
    }
    let best = -1;
    let bestD = -1;
    for (let i = 1; i < xs.length - 1; i++) {
      const d2 = Math.abs(ys[i + 1] - 2 * ys[i] + ys[i - 1]);
      if (d2 > bestD) {
        bestD = d2;
        best = i;
      }
    }
    if (best < 0) return null;
    a = xs[best - 1];
    b = xs[best + 1];
  }

  const slope = (x, y) => (y > x ? Math.abs(tax(y) - tax(x)) / (y - x) : 0);
  if (slope(a, b) < 1) return null;
  let lo = a;
  let hi = b;
  let guard = 0;
  while (hi - lo > 0.01 && guard++ < 60) {
    const mid = cents((lo + hi) / 2);
    if (mid <= lo || mid >= hi) break;
    if (slope(lo, mid) >= slope(mid, hi)) hi = mid;
    else lo = mid;
  }
  const jump = cents(tax(hi) - tax(lo));
  if (Math.abs(jump) < MIN_JUMP) return null;
  return { at: lo, next: hi, jump };
}

const SCALARS = [
  'stateAdjustedGrossIncome',
  'additions',
  'subtractions',
  'deduction',
  'exemptions',
  'taxableIncome',
  'taxBeforeCredits',
  'lowIncomeTableTax',
  'tax',
];

/**
 * Name the figure that moved across a located jump.
 *
 * This is the part that turns a finding into a finding worth having. A report
 * that says *"Ohio jumps $27.50 at $80,000"* needs a reader to go and work out
 * why; one that says *"`exemptions` went from $8,600 to $7,600"* has named the
 * provision, and the provision is then one grep from its statute in
 * `provenance.ts`.
 *
 * Both sides are the engine's own result object, so nothing here is inferred.
 */
export function explain(f, at, next) {
  const a = f(at);
  const b = f(next);
  const moved = [];
  for (const k of SCALARS) {
    if (a[k] !== b[k] && (a[k] !== undefined || b[k] !== undefined)) {
      moved.push({ field: k, from: a[k] ?? null, to: b[k] ?? null });
    }
  }
  const pair = (key, label, amountOf = (c) => c.amount) => {
    const m = (r) => new Map((r[key] ?? []).map((c) => [c.name, amountOf(c)]));
    const ma = m(a);
    const mb = m(b);
    for (const name of new Set([...ma.keys(), ...mb.keys()])) {
      if (ma.get(name) !== mb.get(name)) {
        moved.push({ field: `${label}:${name}`, from: ma.get(name) ?? null, to: mb.get(name) ?? null });
      }
    }
  };
  pair('credits', 'credit');
  pair('surtaxes', 'surtax');
  // THE THREE NAMED LISTS THIS FUNCTION DID NOT READ UNTIL DAY 78, and the
  // first of them is why `named` and `unattributed` both had the wrong rows in
  // them. New Jersey's retirement income exclusion is a wall — 100% of the
  // maximum to $100,000 of total income, then 50%, then 25%, then nothing —
  // and the package's own note calls it "the largest one-dollar cliff in this
  // package". All that showed in `moved` was the SCALAR `subtractions`, whose
  // only label is the field name, so the classifier had nothing to match and
  // reported a notch the package declares in one sentence and prices in the
  // next. The result object had the name all along, in
  // `computedSubtractions[].name`.
  pair('computedSubtractions', 'subtraction');
  pair('addBacks', 'addition');
  pair('incomeClasses', 'class');
  const loc = (r) => new Map((r.localTaxes ?? []).map((c) => [c.name, c.tax]));
  const la = loc(a);
  const lb = loc(b);
  for (const name of new Set([...la.keys(), ...lb.keys()])) {
    if (la.get(name) !== lb.get(name)) {
      moved.push({ field: `local:${name}`, from: la.get(name) ?? null, to: lb.get(name) ?? null });
    }
  }
  // EVERYTHING THAT MOVED IS RETURNED, including the figures that moved by the
  // swept cent and nothing more. They are not attribution and the classifier
  // ignores them for that purpose (see `MOVEMENT_FLOOR` in `classify.mjs`) —
  // but they ARE the needle set for the figure path, which is the strongest
  // disclosure this tool can find. A first version of the floor was applied
  // here instead, and it took about forty-five Arkansas notches from `declared`
  // to `unattributed` by deleting the very figures their notes quote. The
  // inventory keeps what moved; the classifier decides what caused it.
  return moved;
}

/**
 * One household shape, one state, one year, one axis: every jump in the tax
 * function of that axis's variable over the committed bands.
 */
export function sweepOne(shape, state, year, axis = WAGE_AXIS) {
  const f = evaluator(shape, state, year, axis);
  // The probe has to be a value the axis can take: $50,000 of Social Security
  // benefits is inside that axis's band, but $50,000 of anything is NOT inside
  // an axis whose band stops earlier, and a probe outside the band would decide
  // a sweep's fate on a point the sweep never visits.
  const probe = f(Math.min(50_000, axis.bands[0].to));
  if (probe.error) return { cliffs: [], flags: 0, evals: 1, error: probe.error };

  const cliffs = [];
  const found = new Set();
  let flags = 0;

  for (const band of axis.bands) {
    const xs = [];
    const ys = [];
    for (let w = band.from; w <= band.to; w += band.step) {
      const x = cents(w);
      xs.push(x);
      ys.push(f(x).totalTax);
    }
    for (let i = 1; i < xs.length - 1; i++) {
      const d2 = ys[i + 1] - 2 * ys[i] + ys[i - 1];
      if (Math.abs(d2) <= FLAG_THRESHOLD) continue;
      flags++;
      const hit = locate(f, xs[i - 1], xs[i + 1]);
      if (!hit) continue;
      // The grid flags a jump twice — once from the left and once from the
      // right — so the same cent is located from two neighbourhoods. Reporting
      // it once is not cosmetic: a count of notches is one of the two numbers
      // this report is read for.
      const key = hit.at.toFixed(2);
      if (found.has(key)) continue;
      found.add(key);
      cliffs.push({ ...hit, moved: explain(f, hit.at, hit.next) });
    }
  }

  cliffs.sort((p, q) => p.at - q.at);
  return { cliffs, flags, error: null };
}
