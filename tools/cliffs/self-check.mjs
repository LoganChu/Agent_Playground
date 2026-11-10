/**
 * The cliff finder, checked against things whose answers are known in advance.
 *
 * ```sh
 * node tools/cliffs/self-check.mjs
 * ```
 *
 * ## Why a sweep needs a self-check more than most instruments
 *
 * The output of `find-cliffs.mjs` is a list of notches, and the two ways it can
 * be wrong are invisible from the output alone. It can **miss** a notch, and a
 * report that says "we found everything" is then worse than no report. And it
 * can **invent** one by reporting a kink as a jump, which costs a reader an
 * afternoon on a statute that says nothing.
 *
 * Neither failure shows up in a diff of the inventory, so both are checked here
 * against answers that do not come from the instrument:
 *
 * 1. **Synthetic functions**, where the jump is put at a chosen cent by hand.
 *    These prove `locate` without any tax data at all — a defect in the binary
 *    search is then a failure here rather than a wrong line about Ohio.
 * 2. **Two notches this package already documents in prose, with figures.**
 *    Ohio's `$18.69` step at `$100,000` of taxable income and Missouri's
 *    `§ 143.171` cliff chart were written down from the statutes long before
 *    this tool existed, so finding them to the cent is a measurement of the
 *    tool against an independent reading.
 * 3. **A state that taxes no wage income**, whose tax function is identically
 *    zero and therefore has no notches. Any finding is a defect by inspection.
 */

import assert from 'node:assert/strict';
import { locate, sweepOne, evaluator } from './sweep.mjs';
import { SHAPES, MIN_JUMP } from './shapes.mjs';

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${e.message.split('\n')[0]}`);
    process.exitCode = 1;
  }
};

/* ------------------------------------------------------------------ */
/* 1. The locator, on functions with no tax in them                    */
/* ------------------------------------------------------------------ */

/** A piecewise-linear function with an optional jump, in the shape `locate` reads. */
const synthetic = ({ rate = 0.05, kinkAt = Infinity, kinkRate = 0.09, jumpAt = Infinity, jump = 0 }) => {
  const f = (x) => {
    let y = x <= kinkAt ? rate * x : rate * kinkAt + kinkRate * (x - kinkAt);
    if (x > jumpAt) y += jump;
    return Math.round(y * 100) / 100;
  };
  return (x) => ({ totalTax: f(x) });
};

check('a jump at a round dollar is located to the cent', () => {
  const f = synthetic({ jumpAt: 50_000, jump: 42 });
  const hit = locate(f, 49_900, 50_100);
  assert.ok(hit, 'no cliff found');
  assert.equal(hit.at, 50_000);
  assert.equal(hit.next, 50_000.01);
  assert.equal(hit.jump, 42);
});

check('a jump at an awkward cent is located to the cent', () => {
  // The shape of Day 75's PolicyEngine finding: a notch at a figure no grid
  // would ever sample, because it falls out of a phase-out rather than a
  // statute's round number.
  const f = synthetic({ jumpAt: 59_478.02, jump: 111.09 });
  const hit = locate(f, 59_400, 59_600);
  assert.ok(hit, 'no cliff found');
  assert.equal(hit.at, 59_478.02);
  assert.equal(hit.jump, 111.09);
});

check('a NEGATIVE jump is reported with its sign', () => {
  const f = synthetic({ jumpAt: 30_000, jump: -75.5 });
  const hit = locate(f, 29_900, 30_100);
  assert.ok(hit, 'no cliff found');
  assert.equal(hit.jump, -75.5);
});

check('a pure kink is NOT reported as a jump', () => {
  // The false-positive case, and the one that would quietly fill a report with
  // bracket boundaries. A rate change from 5% to 9% at $40,000 is a kink.
  const f = synthetic({ kinkAt: 40_000, kinkRate: 0.09 });
  assert.equal(locate(f, 39_900, 40_100), null);
});

check('a kink steeper than any real marginal rate is still not a jump', () => {
  // 45 cents on the dollar is above every state and local marginal rate in this
  // package and is still continuous, so it must not be reported.
  const f = synthetic({ kinkAt: 40_000, kinkRate: 0.45 });
  assert.equal(locate(f, 39_900, 40_100), null);
});

check('a jump below the reporting floor is dropped', () => {
  const f = synthetic({ jumpAt: 20_000, jump: MIN_JUMP / 2 });
  assert.equal(locate(f, 19_900, 20_100), null);
});

check('a jump sitting exactly on the window edge is not claimed from thin air', () => {
  // `locate` is handed [x-h, x+h] around a flagged point. If the jump is at the
  // very edge the window does not contain it, and the honest answer is null
  // rather than a cliff at the boundary — the neighbouring flag finds it.
  const f = synthetic({ jumpAt: 50_100, jump: 42 });
  const hit = locate(f, 49_900, 50_100);
  assert.equal(hit, null);
});

/* ------------------------------------------------------------------ */
/* 2. Notches this package documented before this tool existed         */
/* ------------------------------------------------------------------ */

const shapeById = (id) => SHAPES.find((s) => s.id === id);

check("Ohio's $18.69 second step is found at $100,000 of TAXABLE income", () => {
  // ohio.ts: "HB 96 lowered the $26,050 constant from $360.69 to $342.00 but
  // left the $100,000 constant at $2,394.32 [...] so crossing $100,000 costs a
  // further $18.69 on one cent of income."
  const { cliffs } = sweepOne(shapeById('joint-two-children'), 'OH', 2025);
  const hit = cliffs.find((c) => Math.abs(c.jump - 18.69) < 0.005);
  assert.ok(hit, `no $18.69 notch; found ${JSON.stringify(cliffs.map((c) => c.jump))}`);
  const f = evaluator(shapeById('joint-two-children'), 'OH', 2025);
  assert.equal(f(hit.at).taxableIncome, 100_000, 'the notch is not at $100,000 of taxable income');
  assert.equal(f(hit.next).taxBeforeCredits, 2_394.32, 'the figure above is not the printed constant');
});

check("Ohio's exemption chart notch at $80,000 of state AGI is found", () => {
  // R.C. 5747.025: the personal exemption falls from $2,150 to $1,900 when Ohio
  // adjusted gross income passes $80,000. Four exemptions, so $1,000 of income
  // becomes taxable at once.
  const { cliffs } = sweepOne(shapeById('joint-two-children'), 'OH', 2025);
  const hit = cliffs.find((c) => c.at === 80_000);
  assert.ok(hit, 'no notch at $80,000');
  const moved = hit.moved.find((m) => m.field === 'exemptions');
  assert.ok(moved, `exemptions did not move: ${JSON.stringify(hit.moved)}`);
  assert.equal(moved.from - moved.to, 1_000);
});

check("Missouri's § 143.171 cliff chart is found at both of its steps", () => {
  // missouri.ts: "A cliff chart and not a phase-out, and the boundary belongs
  // to the step BELOW it."
  const { cliffs } = sweepOne(shapeById('joint-two-children'), 'MO', 2025);
  for (const at of [100_000, 125_000]) {
    const hit = cliffs.find((c) => c.at === at);
    assert.ok(hit, `no notch at ${at}; found ${JSON.stringify(cliffs.map((c) => c.at))}`);
    assert.ok(hit.jump > 0, 'the chart should cost money as income rises');
    assert.ok(
      hit.moved.some((m) => m.field === 'deduction'),
      `the deduction did not move: ${JSON.stringify(hit.moved)}`,
    );
  }
});

check("New York's child credit staircase steps by $16.50 per $1,000", () => {
  // new-york.ts: "the dollar that crosses each $1,000 boundary of AGI costs
  // $16.50 at once, and every other dollar in the band costs nothing."
  const { cliffs } = sweepOne(shapeById('joint-two-children'), 'NY', 2025);
  const steps = cliffs.filter((c) => Math.abs(c.jump - 16.5) < 0.005);
  assert.ok(steps.length >= 10, `expected a staircase, found ${steps.length} steps of $16.50`);
  for (const s of steps) assert.equal(s.at % 1_000, 0, `a step at ${s.at} is not on a $1,000 boundary`);
});

/* ------------------------------------------------------------------ */
/* 3. A state whose tax function is identically zero                   */
/* ------------------------------------------------------------------ */

check('a state that taxes no wage income has no notches', () => {
  for (const state of ['FL', 'TX', 'WA']) {
    const { cliffs } = sweepOne(shapeById('childless-single'), state, 2025);
    assert.equal(cliffs.length, 0, `${state} reported ${cliffs.length} notches and taxes no wage income`);
  }
});

/* ------------------------------------------------------------------ */

if (process.exitCode) {
  console.error(`\n${passed} passed, and the failures above are the point of the file.`);
} else {
  console.log(`cliff finder self-check: ${passed} of ${passed} passed`);
}
