// "A percentage of the federal earned income credit" is the single most
// misleading sentence in state tax. Six of the fourteen taxing states here have
// such a credit and three of them are not that: Utah's cannot be paid out, New
// York's is netted against another credit, and Indiana's is a percentage of a
// federal credit computed under a frozen Internal Revenue Code that the filer
// never claimed.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
  stateIncomeTax,
} from './strict.mjs';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const run = (state, opts = {}) =>
  stateIncomeTax({
    state,
    year: opts.year ?? 2025,
    filingStatus: opts.filingStatus ?? 'single',
    dependents: opts.dependents ?? 1,
    federal: {
      adjustedGrossIncome: opts.agi ?? 30_000,
      taxableIncome: Math.max(0, (opts.agi ?? 30_000) - (opts.deduction ?? 15_750)),
      deduction: opts.deduction ?? 15_750,
      deductionKind: 'standard',
      earnedIncomeCredit: opts.earnedIncomeCredit,
    },
    ...(opts.federalOneDollarHigher ? { federalOneDollarHigher: opts.federalOneDollarHigher } : {}),
    // The two states with no federal starting line need their own base. Both are
    // supplied unconditionally; a state that does not read the field ignores it.
    pennsylvaniaTaxableIncome: opts.agi ?? 30_000,
    newJerseyGrossIncome: opts.agi ?? 30_000,
    massachusettsFivePercentIncome: opts.agi ?? 30_000,
  });

/**
 * The credit the state's own rule named, found BY that name.
 *
 * It used to search for "earned income" in the credit's title, which is a
 * second copy of the name the rule already declares — and Missouri broke it on
 * the day Missouri arrived, because § 143.177 calls its 20% match the WORKING
 * FAMILY TAX CREDIT and the words "earned income" appear nowhere in it. The
 * test reported a match rate of zero for a credit the engine had paid in full.
 *
 * THE RULE, which this file is now the fourth place to meet: a test that
 * identifies a thing by re-describing it is testing its own description.
 */
const creditNamed = (result, name) =>
  result.credits.find((c) => c.name === name)?.amount ?? 0;

/** The remaining call sites, all of them in states whose credit IS so named. */
const eitcOf = (result) =>
  result.credits.find((c) => c.name.toLowerCase().includes('earned income'))?.amount ?? 0;

// Membership is a positive test for the field the rule owns, not a list of the
// states that do not have one. Every exception added to an exclusion list is a
// prediction that there will be no more of them, and that prediction keeps
// turning out to be wrong.
test('every state whose definition carries an earned income credit pays its match rate', () => {
  const withCredit = [];
  for (const state of SUPPORTED_STATES) {
    for (const year of SUPPORTED_YEARS) {
      const rule = getStateDefinition(state, year).earnedIncomeCredit;
      if (!rule) continue;
      if (!withCredit.includes(state)) withCredit.push(state);
      const r = run(state, { year, earnedIncomeCredit: 4_000 });
      // This filer has a dependent, so Maryland's 100% childless match does not
      // apply and its ordinary 50% does. The credit reported here is the match
      // itself; whether the filer keeps all of it is the netting question, and
      // Maryland's refundable half — which is what makes that netting visible —
      // is asserted in test/maryland.test.js.
      // `run` supplies a dependent COUNT and no ages, so Oregon's higher
      // young-child match — 17% against 14% where a dependent is under three —
      // is unreachable here by construction and the base rate is the right
      // expectation. That is asserted rather than assumed two lines down.
      // Wisconsin's match is a table by child count rather than one rate, so
      // the expectation is resolved from the rule the way the engine resolves
      // it — written out here rather than imported, because a test that calls
      // the code it is checking checks nothing. `run` supplies ONE dependent.
      const expectedRate =
        rule.matchRateByChildCount === undefined
          ? rule.matchRate
          : (rule.matchRateByChildCount
              .filter((entry) => entry.children <= 1)
              .map((entry) => entry.rate)
              .pop() ?? rule.matchRate);
      money(creditNamed(r, rule.name), expectedRate * 4_000, `${state} ${year}`);
      if (rule.matchRateByChildCount !== undefined) {
        // A table of one row is a rate with extra steps, and a table whose
        // rows do not rise is not a table about family size.
        assert.ok(rule.matchRateByChildCount.length > 1, `${state} ${year}: one row`);
        for (let i = 1; i < rule.matchRateByChildCount.length; i += 1) {
          assert.ok(
            rule.matchRateByChildCount[i].children > rule.matchRateByChildCount[i - 1].children &&
              rule.matchRateByChildCount[i].rate > rule.matchRateByChildCount[i - 1].rate,
            `${state} ${year}: row ${i} does not rise in both columns`,
          );
        }
      }
      if (rule.youngChildMatchRate !== undefined) {
        assert.ok(
          rule.youngChildMatchRate > rule.matchRate,
          `${state} ${year}: a young-child rate that is not higher is not a young-child rate`,
        );
      }
    }
  }
  assert.deepEqual(withCredit.sort(), [
    'CO', 'CT', 'IL', 'IN', 'MA', 'MD', 'MI', 'MO', 'NJ', 'NY', 'OH', 'OR', 'UT', 'VA', 'WI',
  ]);
});

test('Wisconsin is the only state here whose match depends on the family', () => {
  // Four rates where every other state has one or two, and the two-rate states
  // vary on something else: Maryland on being childless, Oregon on a child
  // being under three. Wisconsin varies on the COUNT, which means the same
  // federal credit produces four different Wisconsin credits.
  const byCount = SUPPORTED_STATES.filter(
    (state) => getStateDefinition(state, 2026).earnedIncomeCredit?.matchRateByChildCount,
  );
  assert.deepEqual(byCount, ['WI']);
  const at = (dependents) =>
    eitcOf(run('WI', { agi: 22_000, dependents, earnedIncomeCredit: 4_000 }));
  money(at(0), 0, 'no children');
  money(at(1), 160, 'one child');
  money(at(2), 440, 'two children');
  money(at(3), 1_360, 'three children');
  money(at(9), 1_360, 'nine children — the top row means three OR MORE');
});

test('a state with no earned income credit ignores a federal one entirely', () => {
  // Passing the federal figure is always safe: it changes nothing in the eight
  // taxing states that have no credit of their own.
  for (const state of ['AZ', 'CA', 'GA', 'ID', 'KY', 'MS', 'NC', 'PA']) {
    const without = run(state, {});
    const with_ = run(state, { earnedIncomeCredit: 4_000 });
    money(with_.tax, without.tax, `${state} should be unmoved`);
  }
});

test('Utah alone cannot pay its earned income credit out, and that is the whole credit', () => {
  // A Utah single parent of two at $20,000 already owes no Utah tax, because the
  // Taxpayer Tax Credit covers it. The 20% match is worth exactly nothing.
  const utah = run('UT', { agi: 20_000, dependents: 2, earnedIncomeCredit: 4_000 });
  money(eitcOf(utah), 800, 'the credit is computed');
  money(utah.tax, 0, 'and none of it is paid');
  assert.equal(
    utah.credits.find((c) => c.name.includes('earned income')).refundable,
    false,
  );

  // The same filer in Illinois, whose 20% match is refundable, gets a cheque.
  //   Illinois base income                              20,000.00
  //   exemption allowance, 3 x $2,850                   -8,550.00
  //   net income                                        11,450.00
  //   tax at 4.95%                                         566.78
  //   less 20% x $4,000, refundable                       -800.00
  const illinois = run('IL', { agi: 20_000, dependents: 2, earnedIncomeCredit: 4_000 });
  money(eitcOf(illinois), 800);
  money(illinois.taxBeforeCredits, 566.775);
  assert.ok(illinois.tax < 0, 'Illinois pays it out');
  money(illinois.tax, -233.225, 'Illinois refund');
});

test('Colorado halves its match in 2026, and no rate table shows it', () => {
  const rate2025 = getStateDefinition('CO', 2025).earnedIncomeCredit.matchRate;
  const rate2026 = getStateDefinition('CO', 2026).earnedIncomeCredit.matchRate;
  assert.equal(rate2025, 0.5);
  assert.equal(rate2026, 0.25);

  // A Colorado family with two children and the 2025 maximum federal credit of
  // $7,152 sees its state credit fall by $1,788 with no change of rate, no change
  // of bracket, and nothing at all on the Colorado rate schedule.
  const before = run('CO', { year: 2025, dependents: 2, earnedIncomeCredit: 7_152 });
  const after = run('CO', { year: 2026, dependents: 2, earnedIncomeCredit: 7_152 });
  money(eitcOf(before), 3_576);
  money(eitcOf(after), 1_788);
  money(after.tax - before.tax, 1_788, 'the whole difference is the match rate');
  assert.equal(getStateDefinition('CO', 2025).rate.rate, getStateDefinition('CO', 2026).rate.rate);
});

test('Michigan matches 30% and Indiana 10%, both refundable', () => {
  money(eitcOf(run('MI', { earnedIncomeCredit: 5_000 })), 1_500);
  money(eitcOf(run('IN', { earnedIncomeCredit: 5_000 })), 500);
  for (const state of ['MI', 'IN', 'CO', 'IL']) {
    assert.equal(
      run(state, { earnedIncomeCredit: 5_000 }).credits.find((c) =>
        c.name.toLowerCase().includes('earned income'),
      ).refundable,
      true,
      `${state} pays its credit out`,
    );
  }
});

test('Indiana says that its match is applied to a credit the filer never claimed', () => {
  const notes = run('IN', { earnedIncomeCredit: 5_000 }).notes.join(' ');
  assert.match(notes, /\$3,800/, 'the frozen Indiana investment income limit');
  assert.match(notes, /FROZEN date/);
});

// ---------------------------------------------------------------------------
// The marginal rate
// ---------------------------------------------------------------------------

test('federalOneDollarHigher makes the state marginal rate include the federal phase-out', () => {
  // A Colorado single parent of one at $30,000 of AGI, inside the federal credit's
  // 15.98% phase-out. Colorado matches 50% of the credit and taxes at 4.40%, so
  // the true Colorado marginal rate is 4.40% + 7.99% = 12.39% — nearly three times
  // the statutory rate, and entirely invisible in it.
  const base = {
    adjustedGrossIncome: 30_000,
    taxableIncome: 14_250,
    deduction: 15_750,
    deductionKind: 'standard',
    earnedIncomeCredit: 2_000,
  };
  const exact = stateIncomeTax({
    state: 'CO',
    year: 2025,
    filingStatus: 'single',
    dependents: 1,
    federal: base,
    federalOneDollarHigher: {
      ...base,
      adjustedGrossIncome: 30_001,
      taxableIncome: 14_251,
      earnedIncomeCredit: 2_000 - 0.1598,
    },
  });
  money(exact.marginalRate, 0.1239, 'true Colorado marginal rate');

  // Without it the engine holds the federal credit constant and reports the
  // statutory rate — so it says so in the result rather than quietly being 8
  // points low.
  const approximate = run('CO', { earnedIncomeCredit: 2_000 });
  money(approximate.marginalRate, 0.044, 'statutory rate only');
  const note = approximate.notes.find((n) => n.includes('federalOneDollarHigher'));
  assert.ok(note, 'the result names the field that would make the marginal rate exact');
  // The quoted bound is 50% of the federal 21.06% phase-out rate for a filer with
  // two or more children — the worst case, and a number in a note is a claim.
  assert.match(note, /up to 10\.53 points/);
  money(0.5 * 21.06, 10.53, 'half the federal two-child phase-out rate');
});

test('a refundable state credit can take the state tax below zero, and does', () => {
  const r = run('MI', { agi: 20_000, dependents: 2, earnedIncomeCredit: 6_000 });
  //   Michigan AGI                                     20,000.00
  //   personal exemptions, 3 x $5,800                 -17,400.00
  //   Michigan taxable income                           2,600.00
  //   tax at 4.25%                                        110.50
  //   less 30% x $6,000, refundable                    -1,800.00
  money(r.taxBeforeCredits, 110.5);
  money(r.tax, -1_689.5);
  assert.ok(r.effectiveRate < 0, 'a negative effective rate is the right answer here');
});
