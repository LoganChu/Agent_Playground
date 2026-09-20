// The two conditions a rate table cannot hold: being 65, and being blind.
//
// Six states in this package already added an exemption for blindness. Three
// more had a provision and no rule — California's senior AND blind exemption
// CREDITS, and Mississippi's aged AND blind exemptions — and all four were
// missing until v0.23.0. They are small per person and they are not small for
// the households that have them: a retired California couple was charged $306
// too much, every year, on an exemption the Franchise Tax Board prints on the
// face of Form 540.
//
// The reason they went unnoticed for twenty-five days is the same in both
// states: the differential grid had no blind filer in it at all, and its only
// 65-year-olds were retirees in states that exempt retirement income, where the
// tax is zero either way and an exemption cannot show. The grid gained a
// `blind-worker` and a `blind-senior` on the same day these were fixed.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getStateDefinition, stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const run = (state, agi, opts = {}) =>
  stateIncomeTax({
    state,
    year: opts.year ?? 2026,
    filingStatus: opts.filingStatus ?? 'single',
    federal: { adjustedGrossIncome: agi },
    earnedIncome: opts.earnedIncome ?? agi,
    ...opts,
  });

// ---------------------------------------------------------------------------
// California: they are credits, so their value does not depend on the rate
// ---------------------------------------------------------------------------

test('California claims one more exemption credit at 65 and one more for blindness', () => {
  const rule = getStateDefinition('CA', 2026).exemptionCredit;
  assert.equal(rule.perSeniorFiler, 153);
  assert.equal(rule.seniorAge, 65);
  assert.equal(rule.perBlindOrDisabledFiler, 153);

  const credit = (opts) => {
    const r = run('CA', 60_000, opts);
    return r.credits
      .filter((c) => c.name.includes('exemption'))
      .reduce((sum, c) => sum + c.amount, 0);
  };
  money(credit({ filerAge: 40 }), 153, 'a working single filer');
  money(credit({ filerAge: 70 }), 306, 'at 65');
  money(credit({ filerAge: 40, blindOrDisabled: 1 }), 306, 'blind');
  // § 17054(c) and (d) are separate subdivisions with separate boxes on Form
  // 540, so one person claims both.
  money(credit({ filerAge: 70, blindOrDisabled: 1 }), 459, 'blind AND 65 — three exemptions');
});

test('a retired California couple was charged $306 too much, and the rate never enters it', () => {
  const couple = {
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 70,
    taxableSocialSecurity: 0,
  };
  const young = { filingStatus: 'marriedFilingJointly', filerAge: 60, spouseAge: 60 };
  for (const agi of [60_000, 120_000, 250_000]) {
    const saved = run('CA', agi, young).tax - run('CA', agi, couple).tax;
    // A credit, not a deduction: the same $306 at every income and every rate,
    // which is the whole reason California states its exemptions this way.
    money(saved, 306, `at $${agi}`);
  }
});

test('the exemption credits are claimed PER PERSON, not per return', () => {
  const one = run('CA', 90_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 60,
  }).tax;
  const two = run('CA', 90_000, {
    filingStatus: 'marriedFilingJointly',
    filerAge: 70,
    spouseAge: 70,
  }).tax;
  money(one - two, 153, 'the second spouse at 65 is worth another $153');
});

test('blindness is capped at the filer and spouse, not at the household', () => {
  money(
    run('CA', 60_000, { filerAge: 40, blindOrDisabled: 2 }).tax,
    run('CA', 60_000, { filerAge: 40, blindOrDisabled: 1 }).tax,
    'a single return cannot claim a second blind exemption',
  );
});

// The AGI limitation, which is applied per LINE of Form 540 and floored there.
//
// It matters only where the reduction has already taken one line to zero and
// not another, which needs a high income and a dependent — $6 per $2,500 has to
// exceed $153 before the personal credit dies, and that is $62,500 of income
// above the threshold.
test('the AGI limitation is floored per line, so a dead credit cannot eat a live one', () => {
  const opts = { filerAge: 40, dependents: 1, dependentAges: [8] };
  const credit = (agi) =>
    run('CA', agi, opts)
      .credits.filter((c) => c.name.includes('exemption'))
      .reduce((sum, c) => sum + c.amount, 0);

  // $252,203 is the 2025 threshold. $60 of reduction an exemption at $277,203:
  // both lines survive.
  money(credit(277_203), 153 - 60 + (475 - 60), 'both lines still positive');

  // At $400,000 the reduction is $360 an exemption. The $153 personal credit is
  // gone; the $475 dependent credit is not, and keeps $115. Netting the whole
  // return in one subtraction would have given $0 instead — the personal
  // credit's $207 of dead reduction would have eaten into the dependent one.
  money(credit(400_000), 475 - 360, 'the dependent credit survives alone');
  assert.ok(credit(400_000) > 0, 'and it is not zero');
});

// ---------------------------------------------------------------------------
// Mississippi: the same two conditions, as exemptions rather than credits
// ---------------------------------------------------------------------------
//
// Form 80-105 counts them on the SAME line as the dependents and multiplies the
// lot by $1,500, which is why a summary that reports "$1,500 per dependent" has
// described three of the four boxes on that line.

test('Mississippi adds $1,500 at 65 and $1,500 for blindness, and they stack', () => {
  const rule = getStateDefinition('MS', 2026).exemption;
  assert.equal(rule.perSeniorFiler, 1_500);
  assert.equal(rule.seniorAge, 65);
  assert.equal(rule.perBlindOrDisabledFiler, 1_500);

  // 2026: 4.0% above a $10,000 zero band, $2,300 standard deduction, $6,000
  // exemption. $40,000 of wages.
  const at = (opts) => run('MS', 40_000, opts).tax;
  money(at({ filerAge: 40 }), (40_000 - 2_300 - 6_000 - 10_000) * 0.04, 'a working filer');
  money(at({ filerAge: 70 }), (40_000 - 2_300 - 7_500 - 10_000) * 0.04, 'at 65');
  money(at({ filerAge: 40, blindOrDisabled: 1 }), (40_000 - 2_300 - 7_500 - 10_000) * 0.04, 'blind');
  money(
    at({ filerAge: 70, blindOrDisabled: 1 }),
    (40_000 - 2_300 - 9_000 - 10_000) * 0.04,
    'blind AND 65',
  );
  money(at({ filerAge: 40 }) - at({ filerAge: 70 }), 60, 'each box is worth $60 in 2026');
});

test('a Mississippi box is worth more in 2025 than in 2026, because the rate fell', () => {
  const saved = (year) =>
    run('MS', 40_000, { year, filerAge: 40 }).tax - run('MS', 40_000, { year, filerAge: 70 }).tax;
  money(saved(2025), 1_500 * 0.044, '2025 at 4.4%');
  money(saved(2026), 1_500 * 0.04, '2026 at 4.0%');
});

test('Mississippi counts the aged exemption per person on a joint return', () => {
  const at = (filerAge, spouseAge) =>
    run('MS', 80_000, {
      filingStatus: 'marriedFilingJointly',
      filerAge,
      spouseAge,
    }).tax;
  money(at(60, 60) - at(70, 60), 60, 'one spouse at 65');
  money(at(60, 60) - at(70, 70), 120, 'both');
});

// ---------------------------------------------------------------------------
// And the states that already had it, so a regression here is loud
// ---------------------------------------------------------------------------

test('Michigan\'s special exemption is the largest in the package', () => {
  const rule = getStateDefinition('MI', 2026).exemption;
  assert.equal(rule.perBlindOrDisabledFiler, 3_400);
  const saved =
    run('MI', 60_000, { filerAge: 40 }).tax -
    run('MI', 60_000, { filerAge: 40, blindOrDisabled: 1 }).tax;
  money(saved, 3_400 * 0.0425, 'worth $144.50 at 4.25%');
  // Against the two flat states beside it, on the same condition.
  money(
    run('IL', 60_000, { filerAge: 40 }).tax -
      run('IL', 60_000, { filerAge: 40, blindOrDisabled: 1 }).tax,
    1_000 * 0.0495,
  );
  money(
    run('IN', 60_000, { filerAge: 40 }).tax -
      run('IN', 60_000, { filerAge: 40, blindOrDisabled: 1 }).tax,
    1_000 * 0.0295,
  );
});

test('the six states that already added a blind exemption still do', () => {
  const expected = { IL: 1_000, IN: 1_000, MD: 1_000, MA: 2_200, NJ: 1_000, VA: 800 };
  for (const [state, amount] of Object.entries(expected)) {
    assert.equal(
      getStateDefinition(state, 2026).exemption.perBlindOrDisabledFiler,
      amount,
      `${state} blind exemption`,
    );
  }
});
