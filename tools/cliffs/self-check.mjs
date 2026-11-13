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
import { SHAPES, AXES, DISCRETE_AXES, ALL_AXES, MIN_JUMP, formatAt, isDiscrete, shapesFor } from './shapes.mjs';
import { classify, provisionLabels, nameMatch } from './classify.mjs';

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
/* 2b. The axes, and the notch each one exists to reach                */
/* ------------------------------------------------------------------ */

const axisById = (id) => AXES.find((a) => a.id === id);

check('the wage axis is the sweep that existed before the axes did', () => {
  // The refactor that added axes had to leave the old one alone, and this is
  // the assertion of that rather than a claim about it: the wage axis is AXES[0]
  // and `sweepOne` with no axis argument must be the same sweep.
  const shape = shapeById('joint-two-children');
  const implicit = sweepOne(shape, 'OH', 2025);
  const explicit = sweepOne(shape, 'OH', 2025, axisById('wages'));
  assert.deepEqual(
    implicit.cliffs.map((c) => [c.at, c.jump]),
    explicit.cliffs.map((c) => [c.at, c.jump]),
  );
  assert.ok(implicit.cliffs.length > 0, 'Ohio reported no notches at all');
});

check('§ 32(i) is found on the investment-income axis and nowhere else', () => {
  // THE NOTCH THE OTHER AXES EXIST FOR. One cent of investment income over the
  // federal ceiling takes the whole state earned income credit, and no wage in
  // any band reaches it — which is the entire argument for this file having
  // more than one axis. Colorado, because its credit is a plain percentage of
  // the federal one with no cap, no bonus and no liability limit, so the notch
  // is the credit.
  const shape = shapeById('single-two-children');
  const gains = sweepOne(shape, 'CO', 2025, axisById('investment-income'));
  const hit = gains.cliffs.find((c) => c.at === 11_950);
  assert.ok(
    hit,
    `no notch at $11,950 of gains; found ${JSON.stringify(gains.cliffs.map((c) => c.at))}`,
  );
  assert.ok(
    hit.jump > 2_000,
    `the whole Colorado credit should go, and only $${hit.jump} did`,
  );
  assert.ok(
    hit.moved.some((m) => /earned income/i.test(m.field) && m.to === 0),
    `the credit did not go to zero: ${JSON.stringify(hit.moved)}`,
  );

  // And the wage axis cannot see it, which is the half that makes the first
  // half worth asserting. Investment income is zero on that axis, so there is
  // no amount of wages at which § 32(i) binds.
  const wages = sweepOne(shape, 'CO', 2025, axisById('wages'));
  assert.ok(
    !wages.cliffs.some((c) => c.jump > 2_000),
    `the wage axis found a notch of this size, so this is not an axis-only finding: ` +
      JSON.stringify(wages.cliffs.filter((c) => c.jump > 2_000)),
  );
});

check('an axis probes inside its own bands', () => {
  // `sweepOne` probes one point before sweeping, to tell a refusal from an
  // empty result. The first version probed $50,000 whatever the axis, which is
  // outside the municipal-interest band's own range at the top end and would
  // decide a sweep's fate on a point the sweep never visits.
  for (const axis of AXES) {
    for (const shape of axis.shapes ? SHAPES.filter((x) => axis.shapes.includes(x.id)) : SHAPES) {
      const { error } = sweepOne(shape, 'CO', 2025, axis);
      assert.equal(error, null, `${axis.id} / ${shape.id} refused: ${error}`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* 2c. The classifier, which could not be tested until Day 78          */
/* ------------------------------------------------------------------ */

/*
 * Day 77's item 4: "the cliff finder's classifier was wrong in three of six
 * cases with no test able to notice." It lived inside `find-cliffs.mjs`, which
 * runs a sweep on import, so importing it to test it was not possible. It is
 * now `classify.mjs` and these are the cases — every one of them a real
 * misclassification this repository shipped, written out as the inputs that
 * produced it.
 */

const notch = (moved, jump = 100) => ({ at: 50_000, next: 50_000.01, jump, moved });

check('a note that names a provision in a different word order still names it', () => {
  // MARYLAND, and the worst answer this classifier can give. Its label is
  // `2% surtax on net capital gain`; the note is ninety words long, says "the
  // 2% capital gains surtax ... is a cliff", and prices the step at $6,933.08.
  // The phrase match called it `undisclosed` — "not named at all".
  const moved = [
    { field: 'tax', from: 16_097.88, to: 21_829.88 },
    { field: 'surtax:2% surtax on net capital gain (federal AGI over $350,000)', from: null, to: 5_732 },
  ];
  const note =
    'The 2% capital gains surtax (new for 2025) is a cliff and its threshold is a TEST, not ' +
    'a floor: a filer whose federal AGI exceeds $350,000 owes 2% of their whole net capital gain.';
  const got = classify([note], notch(moved, 5_732), 'Maryland');
  assert.equal(got.disclosure, 'declared', JSON.stringify(got));
  assert.match(got.how, /words/, 'the weaker join should be recorded, not hidden');

  // And the word-set path must NOT match a note about a different provision
  // that happens to share a word or two.
  const unrelated = 'Maryland subtracts military retirement pay, and the county tax is a surtax on the state figure.';
  assert.equal(classify([unrelated], notch(moved, 5_732), 'Maryland').disclosure, 'undisclosed');
});

check("a credit's abbreviation is the name its own notes use", () => {
  // CALIFORNIA. The label is `California Earned Income Tax Credit (CalEITC)`;
  // all five of California's notes about it say "CalEITC" and none spells it
  // out. Cutting the parenthetical cost 14 notches a green column against a
  // note that declares the $4,814 cliff and prices it at $4,528.82.
  const moved = [{ field: 'credit:California Earned Income Tax Credit (CalEITC)', from: 331.76, to: 0 }];
  const labels = provisionLabels(moved, 'California').map((l) => l.text);
  assert.ok(labels.includes('caleitc'), JSON.stringify(labels));
  const note =
    'The $4,814 investment-income limit is a cliff, not a phase-out. One dollar of interest ' +
    'over it costs the whole CalEITC and, because that credit gates it, the whole Young Child ' +
    'Tax Credit — $4,528.82 at the worst point.';
  assert.equal(classify([note], notch(moved, 1_520.76), 'California').disclosure, 'declared');

  // `(assumed: ...)` is a caveat about inputs, not a name, and must not become
  // a label — it has a colon in it, which is the test.
  const assumed = provisionLabels(
    [{ field: 'credit:Ohio joint filing credit (assumed: both spouses have qualifying income)', from: 0, to: 50 }],
    'Ohio',
  ).map((l) => l.text);
  assert.ok(!assumed.some((l) => l.includes('assumed')), JSON.stringify(assumed));
});

check('a field name is not a provision name, and cannot put a notch in `named`', () => {
  // ARKANSAS, and the finding that made this file necessary. The $10 bracket
  // adjustment step is in the RATE SCHEDULE. Found by walking wages, nothing in
  // the result names a provision and it is reported `unattributed`. Found by
  // walking capital gains, the capital-gain subtraction moves too, `subtraction`
  // enters the label set, and every Arkansas note containing that word becomes
  // evidence — 238 notches in the column this instrument is sold on, for one
  // disclosure, decided by which axis found it.
  const wages = [
    { field: 'taxBeforeCredits', from: 3_137.7, to: 3_147.7 },
    { field: 'tax', from: 3_108.7, to: 3_118.7 },
  ];
  const gains = [
    { field: 'subtractions', from: 72_270, to: 72_270.01 },
    { field: 'taxBeforeCredits', from: 3_297.9, to: 3_307.9 },
  ];
  const notes = ['Arkansas allows a subtraction for 50% of net long-term capital gain.'];
  const onWages = classify(notes, notch(wages, 10), 'Arkansas');
  const onGains = classify(notes, notch(gains, 10), 'Arkansas');
  assert.equal(onWages.disclosure, 'unattributed');
  assert.equal(
    onGains.disclosure,
    onWages.disclosure,
    'the same notch and the same notes gave two answers, decided by the axis',
  );
  // TWO GUARDS CATCH THIS CASE AND THE STRONGER ONE WINS. The exclusion moved
  // by half the swept cent, so `MOVEMENT_FLOOR` drops it before it can become a
  // label at all and the notch has no label of any kind — which is why `how`
  // is null rather than `generic-field-only`. That is the better answer: the
  // field did not move enough to have caused a $10 step, so the question of
  // whether its name is a provision name never arises.
  assert.equal(onGains.how, null);

  // The generic-field path is still reachable, by a field that DID move enough.
  const bigGeneric = classify(
    ['Arkansas allows a subtraction for 50% of net long-term capital gain.'],
    notch([{ field: 'subtractions', from: 20_000, to: 10_000 }, { field: 'tax', from: 100, to: 200 }], 100),
    'Arkansas',
  );
  assert.equal(bigGeneric.disclosure, 'unattributed');
  assert.equal(bigGeneric.how, 'generic-field-only', 'the weak match should still be recorded');

  // A generic field name that DOES carry a step word is still a disclosure:
  // Missouri's deduction chart is declared this way and must stay declared.
  const mo = classify(
    ['The $143.171 deduction is a cliff chart and not a phase-out.'],
    notch([{ field: 'deduction', from: 5_000, to: 4_000 }], 1_000),
    'Missouri',
  );
  assert.equal(mo.disclosure, 'declared');
});

check('a figure that moved by the swept cent is in the inventory, not in the attribution', () => {
  // The floor is a rule about ATTRIBUTION and not about the inventory, and the
  // first version of it was applied in `explain` instead — which took about
  // forty-five Arkansas notches from `declared` to `unattributed` by deleting
  // the very figures their notes quote. So: the cent-sized movement must still
  // be able to DECLARE a notch through the figure path, while never naming a
  // provision through the label path.
  const moved = [
    { field: 'subtractions', from: 72_270, to: 72_270.01 },
    { field: 'taxBeforeCredits', from: 3_297.9, to: 3_307.9 },
  ];
  assert.deepEqual(provisionLabels(moved, 'Arkansas'), [], 'a half-cent movement named a provision');
  const quoted = classify(
    ['The bracket adjustment is $290 at $89,100 of net income and falls by $10 for every $100 above it, ' +
      'so the tax before credits at that point is $3,297.90 and a step.'],
    notch(moved, 10),
    'Arkansas',
  );
  assert.equal(quoted.disclosure, 'declared');
  assert.equal(quoted.how, 'figure');
});

check("New Jersey's retirement exclusion is named by the result object, not only by the scalar", () => {
  // THE FINDING THAT MADE `explain` READ `computedSubtractions`. N.J.S.A.
  // 54A:6-15's exclusion is a wall — 100% of the maximum to $100,000 of total
  // income, then 50%, then 25%, then nothing — and the package's own note
  // calls it "the largest one-dollar cliff in this package". All that showed in
  // `moved` was the scalar `subtractions`, whose only label is the field name,
  // so a notch the package declares in one sentence and prices in the next had
  // nothing for the classifier to match. The name was in the result all along.
  const moved = [
    { field: 'subtractions', from: 46_875, to: 23_437.5 },
    { field: 'subtraction:Pension and retirement income exclusion', from: 46_875, to: 23_437.5 },
    { field: 'tax', from: 2_722.91, to: 4_215.88 },
  ];
  const labels = provisionLabels(moved, 'New Jersey');
  assert.ok(
    labels.some((l) => l.specific && l.text.includes('retirement income exclusion')),
    JSON.stringify(labels),
  );
  // The note VERBATIM, and the second sentence is load-bearing: the engine's
  // label is "Pension and retirement income exclusion" and the first sentence
  // never says "pension", so a word-set match needs "pension income" from the
  // sentence that prices it. Shortening the fixture by one sentence turns this
  // assertion red, which is the honest shape of a text match and the reason
  // every answer carries `how`.
  const note =
    'The retirement income exclusion is a wall, not a phase-out: 100% of the maximum up to ' +
    '$100,000 of total income, then 50% (joint) to $125,000, then 25% to $150,000, and nothing ' +
    'at $150,001. For a joint return with $100,000 of pension income that single dollar is ' +
    'worth more than $4,000 of New Jersey tax — the largest one-dollar cliff in this package.';
  const got = classify([note], notch(moved, 1_492.97), 'New Jersey');
  assert.equal(got.disclosure, 'declared', JSON.stringify(got));

  // And the first sentence alone is NOT enough, which is the measurement of
  // how much of this rests on one word.
  const firstSentenceOnly = note.split('. For a joint')[0];
  assert.equal(
    classify([firstSentenceOnly], notch(moved, 1_492.97), 'New Jersey').disclosure,
    'undisclosed',
  );
});

check('nameMatch needs two content words, so one short word is not a name', () => {
  // The guard on the word-set path. A label of one content word would match any
  // note containing that word, which is the substring match it replaces with
  // extra steps.
  assert.equal(nameMatch('the exemption is withdrawn in bands', 'exemption'), 'phrase');
  assert.equal(nameMatch('the senior exemption is a step', 'senior exemption'), 'phrase');
  // The reordering the path exists for — and the word-set match is a SUBSTRING
  // match per word, so "seniors" carries "senior" and plurals cost nothing.
  assert.equal(nameMatch('the exemption for seniors steps', 'senior exemption'), 'words');
  // One of the two content words present is not a name match.
  assert.equal(nameMatch('a note about exemptions generally', 'senior exemption'), null);
  assert.equal(nameMatch('seniors get a credit here', 'senior exemption'), null);
  // A label with only one content word must not reach the word-set path, or it
  // is the substring match it replaces with extra steps: `income` and `credit`
  // are in the stoplist, so this label has one content word and no phrase.
  assert.equal(nameMatch('a credit against income tax', 'earned income tax credit'), null);
});

/* ------------------------------------------------------------------ */
/* 3. A state whose tax function is identically zero                   */
/* ------------------------------------------------------------------ */

check('a state that taxes no income has no notches, on any axis', () => {
  // Widened with the axes: a state whose tax function is identically zero is
  // continuous in every variable, not only in wages, so this is now a check on
  // the whole instrument rather than on one sweep of it. New Hampshire and
  // Tennessee are deliberately in the list — both taxed investment income
  // within living memory, and the investment-income axis is the one that would
  // find a leftover interest-and-dividends rule.
  for (const state of ['AK', 'FL', 'NH', 'NV', 'SD', 'TN', 'TX', 'WA', 'WY']) {
    for (const axis of ALL_AXES) {
      const shapes = shapesFor(axis);
      for (const shape of shapes) {
        const { cliffs } = sweepOne(shape, state, 2025, axis);
        assert.equal(
          cliffs.length,
          0,
          `${state} reported ${cliffs.length} notches on the ${axis.id} axis (${shape.id}) ` +
            `and taxes no income: ${JSON.stringify(cliffs.map((c) => [c.at, c.jump]))}`,
        );
      }
    }
  }
});

/* ------------------------------------------------------------------ */
/* 5. The discrete axes, whose detector is a different detector         */
/* ------------------------------------------------------------------ */

check('a discrete axis reports the two integers either side of the step, and not a value between them', () => {
  // The whole reason `enumerateOne` exists rather than `sweepOne` with a step
  // of 1. `locate` would binary-search between 64 and 65 and return something
  // like 64.5, which is an age nobody has on the last day of a tax year.
  const axis = DISCRETE_AXES.find((a) => a.id === 'filer-age');
  const shape = SHAPES.find((x) => x.id === 'single-retiree');
  const { cliffs } = sweepOne(shape, 'MD', 2025, axis);
  assert.ok(cliffs.length > 0, 'Maryland has a pension exclusion at 65 and it was not found');
  for (const c of cliffs) {
    assert.ok(Number.isInteger(c.at) && Number.isInteger(c.next), `${c.at} -> ${c.next} is not a pair of integers`);
    assert.equal(c.next, c.at + 1, `${c.at} -> ${c.next} skips a value the axis walks`);
  }
});

check("Maryland's pension exclusion is a $1,061.38 notch on one birthday", () => {
  // Read off the engine before the axis was built, and the largest single-
  // birthday step the instrument found anywhere: a single filer with $30,000
  // of pension and $20,000 of Social Security, whose whole Maryland bill goes
  // to zero between 64 and 65.
  const axis = DISCRETE_AXES.find((a) => a.id === 'filer-age');
  const shape = SHAPES.find((x) => x.id === 'single-retiree');
  const { cliffs } = sweepOne(shape, 'MD', 2025, axis);
  const at64 = cliffs.find((c) => c.at === 64);
  assert.ok(at64, `no notch at 64: ${JSON.stringify(cliffs.map((c) => [c.at, c.jump]))}`);
  assert.equal(at64.jump.toFixed(2), '-1061.38');
  assert.ok(
    at64.moved.some((m) => m.field === 'subtractions'),
    `the subtraction did not move: ${JSON.stringify(at64.moved)}`,
  );
});

check("Wisconsin's Act 15 subtraction is at 67 and not at 65", () => {
  // The threshold a reader guesses wrong. Wis. Stat. s. 71.05(6)(b)54m, created
  // by 2025 Wisconsin Act 15, subtracts up to $24,000 of retirement income at
  // SIXTY-SEVEN. The $11 step at 65 is the separate s. 71.05(23) addition, and
  // finding both is how this axis shows that a state can have two.
  const axis = DISCRETE_AXES.find((a) => a.id === 'filer-age');
  const shape = SHAPES.find((x) => x.id === 'single-retiree');
  const { cliffs } = sweepOne(shape, 'WI', 2025, axis);
  const ages = cliffs.map((c) => c.at);
  assert.deepEqual(ages, [64, 66], `expected steps at 64->65 and 66->67, got ${JSON.stringify(ages)}`);
  assert.equal(cliffs.find((c) => c.at === 66).jump.toFixed(2), '-604.62');
});

check("California's Young Child Tax Credit is on the dependent-age axis and no shape could hold it before", () => {
  // The finding that added `single-young-child` to SHAPES. Every child in the
  // list before it was 6, 7, 8, 10 or 11, so a $1,189 credit for a child under
  // six was worth exactly zero in every case this instrument had evaluated.
  const axis = DISCRETE_AXES.find((a) => a.id === 'dependent-age');
  const shape = SHAPES.find((x) => x.id === 'hoh-one-child');
  const { cliffs } = sweepOne(shape, 'CA', 2025, axis);
  const under6 = cliffs.find((c) => c.at === 5);
  assert.ok(under6, `no step at 5 -> 6: ${JSON.stringify(cliffs.map((c) => [c.at, c.jump]))}`);
  assert.equal(under6.jump.toFixed(2), '1189.00');
  assert.ok(
    under6.moved.some((m) => /Young Child/i.test(m.field)),
    `the credit was not named in the result object: ${JSON.stringify(under6.moved)}`,
  );
  // And the shape that now exists to meet it on the income axes.
  const young = SHAPES.find((x) => x.id === 'single-young-child');
  assert.ok(young, 'single-young-child is gone from SHAPES');
  assert.ok(young.childAges.every((a) => a < 6), `${JSON.stringify(young.childAges)} is not under six`);
});

check("the filer's and the spouse's age amounts are the same size, which is a check on a transcription", () => {
  // A per-person amount transcribed once and applied twice is the commonest
  // shape of error in this class, and it is invisible to every income axis.
  // Where a state steps for the filer on a joint return it must step by the
  // same amount for the spouse, because the household is otherwise identical.
  const filer = DISCRETE_AXES.find((a) => a.id === 'filer-age');
  const spouse = DISCRETE_AXES.find((a) => a.id === 'spouse-age');
  const shape = SHAPES.find((x) => x.id === 'joint-no-children');
  for (const state of ['MD', 'WI']) {
    const f = sweepOne(shape, state, 2025, filer).cliffs.find((c) => c.at === 64);
    const sp = sweepOne(shape, state, 2025, spouse).cliffs.find((c) => c.at === 64);
    assert.ok(f && sp, `${state}: one side of the pair is missing`);
    assert.equal(
      f.jump.toFixed(2),
      sp.jump.toFixed(2),
      `${state} gives the filer ${f.jump} at 65 and the spouse ${sp.jump}`,
    );
  }
});

check('an age is never formatted as money', () => {
  // The single most misleading line this instrument could print. Every other
  // number in the report is dollars, so `$64.00` for a sixty-four-year-old
  // would read as an income and send a reader to the wrong statute.
  for (const axis of DISCRETE_AXES) {
    const written = formatAt(axis, axis.values[0]);
    assert.ok(!written.includes('$'), `${axis.id} wrote ${written}`);
  }
  assert.equal(formatAt(AXES[0], 100_000), '$100,000.00');
  assert.ok(DISCRETE_AXES.every(isDiscrete), 'a discrete axis did not declare itself discrete');
  assert.ok(!AXES.some(isDiscrete), 'an income axis declared itself discrete');
});

/* ------------------------------------------------------------------ */

if (process.exitCode) {
  console.error(`\n${passed} passed, and the failures above are the point of the file.`);
} else {
  console.log(`cliff finder self-check: ${passed} of ${passed} passed`);
}
