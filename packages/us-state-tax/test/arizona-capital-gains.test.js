// ARIZONA SUBTRACTS A QUARTER OF A NET LONG-TERM CAPITAL GAIN, AND THE THREE WAYS
// TO GET IT WRONG ARE ALL IN THE SOURCES.
//
// Day 48. A.R.S. § 43-1022(22) subtracts 25% of the net long-term capital gain
// included in federal adjusted gross income that is derived from an asset acquired
// after December 31, 2011. It was the largest unmodelled Arizona provision — $625.00
// on a $100,000 gain — and it was found by the differential grid rather than by
// reading a form: a $616.25 disagreement with PolicyEngine-US on
// `investor-AZ-50000-0-0-100000-0` had been credited since the grid was built to an
// Arizona family income tax credit worth at most $100, on a household with no
// dependents at all.
//
// ## The three things this file is here to pin
//
// **1. SHORT-TERM ITEMS ARE EXCLUDED, NOT NETTED — and that is where Arizona parts
// company with Wisconsin.** Both states take a share of a long-term gain. Wis. Stat.
// § 71.05(6)(b)9 adds that "the capital gains and capital losses for all assets shall
// be netted before application of the percentage", so a short-term loss eats the
// Wisconsin exclusion. Arizona's Form 140 worksheet says the opposite in a sentence
// of its own — "Do not include any short-term capital gains or (losses) in this
// worksheet" — and "net long-term capital gain" is the IRC § 1222(7) term, which nets
// long against long and nothing else.
//
// **THE SAME TWO FIGURES, TWO STATES, DIFFERENT ANSWERS, AND BOTH RIGHT.** That is
// the claim `the two states disagree by statute` below exists to hold, and it is the
// reason `CapitalGainsSubtractionBasis` is a discriminator rather than the boolean it
// replaced: a share and a base are two parameters, and storing only the share makes
// the base a property of the engine rather than of the state.
//
// **2. IT IS GATED ON A NET CAPITAL GAIN OVERALL.** The subtraction reaches gain
// "included in federal adjusted gross income", and a year that nets to a capital loss
// includes none — so a $50,000 long-term gain behind a $100,000 short-term loss
// subtracts nothing. In this package `netCapitalGain` is `nonNegative`, so the loss
// year is a ZERO rather than a negative, and the gate reads that zero.
//
// **3. THE 2011 VINTAGE IS LIVE IN BOTH SUPPORTED YEARS, and a plausible secondary
// source says it is not.** Arizona SB 1331 (2025) would have extended the subtraction
// to every long-term gain "irrespective of when assets were acquired" from
// 1 January 2026. It passed the Senate, cleared House Ways & Means 5-4 on
// 12 March 2025, and died; at least one tax-calculator site reports the expansion as
// law. The refutation is a 2026-session document rather than an argument — the Senate
// fact sheet for SB 1633, in the 57th Legislature's SECOND regular session, still
// states current law with the date in it.
//
// **THE RULE: A BILL THAT DIED LEAVES SUMMARIES OF WHAT IT WOULD HAVE DONE LYING
// AROUND, AND THEY READ EXACTLY LIKE SUMMARIES OF LAW.** The test that catches a
// future repeal is `the vintage is a parameter and not a fact about a field name`:
// the date is data on the rule, so the day Arizona strikes it, one figure moves and
// one test fails.
//
// ## What is NOT checked here
//
// Whether the gain a caller passes really is post-2011. Nothing can check that: no
// figure on a federal return records when an asset was bought, which is why this is
// an input of its own rather than `netCapitalGain` less `shortTermCapitalGains`.
// PolicyEngine-US does not model the vintage at all, taking 25% of every long-term
// gain, so the two packages agree only for a filer whose assets are all post-2011 —
// recorded in `tools/differential/known-divergences.json` rather than hidden.
import assert from 'node:assert/strict';
import test from 'node:test';

import { getStateDefinition, roundCents, stateIncomeTax } from './strict.mjs';

const RATE = 0.025;
const SHARE = 0.25;
const YEARS = [2025, 2026];
/** § 43-1041(A) single, as amended by HB 4168. */
const DEDUCTION = { 2025: 15_750, 2026: 16_100 };

const run = (state, year, input) =>
  stateIncomeTax({
    state,
    year,
    filingStatus: 'single',
    federal: {
      adjustedGrossIncome: input.agi,
      taxableIncome: Math.max(0, input.agi - DEDUCTION[year]),
      deduction: DEDUCTION[year],
      deductionKind: 'standard',
    },
    ...input.fields,
  });

const az = (year, fields, agi = 200_000) => run('AZ', year, { agi, fields });

// `subtractions` is the TOTAL and `computedSubtractions` is the named list — the
// distinction that matters here, because a test reading the total could not tell this
// subtraction from any other the state computes.
const named = (result, needle) =>
  (result.computedSubtractions ?? []).find((s) => s.name.includes(needle))?.amount ?? 0;

const subtraction = (result) => named(result, 'long-term capital gain');

test('the rule is declared with a share AND a base, and the base is the excluding one', () => {
  for (const year of YEARS) {
    const rule = getStateDefinition('AZ', year).capitalGainsSubtraction;
    assert.ok(rule, `${year}: Arizona carries a capital gains subtraction`);
    assert.equal(rule.share, SHARE, `${year}: 25% since 2015`);
    assert.equal(rule.basis.kind, 'longTermExcludingShortTerm', `${year}`);
    assert.equal(rule.basis.field, 'longTermCapitalGainAfter2011', `${year}`);
  }
});

test('the vintage is a parameter and not a fact about a field name', () => {
  // SB 1331 went after exactly this date and died. If a later session passes it,
  // THIS is the assertion that fails — which is the whole reason the date is stored
  // as data rather than left implicit in `longTermCapitalGainAfter2011`'s spelling.
  for (const year of YEARS) {
    const { basis } = getStateDefinition('AZ', year).capitalGainsSubtraction;
    assert.equal(basis.acquiredAfter, '2011-12-31', `${year}: § 43-1022(22)'s own date`);
    assert.match(basis.vintageCite, /SB 1331/, `${year}: the bill that would have struck it is named`);
  }
});

test('25% of the qualifying gain, at 2.5%, in both years', () => {
  for (const year of YEARS) {
    for (const [gain, expected] of [
      [100_000, 625],
      [10_000, 62.5],
      [40_000, 250],
      [1, 0.01], // 25 cents of subtraction, 0.625 cents of tax, rounded to the cent
    ]) {
      const withGain = az(year, {
        netCapitalGain: gain,
        longTermCapitalGainAfter2011: gain,
      });
      const without = az(year, { netCapitalGain: gain });
      assert.equal(
        subtraction(withGain),
        gain * SHARE,
        `${year}: a quarter of $${gain} comes out of Arizona gross income`,
      );
      // THE DIFFERENCE OF TWO ANSWERS AS REPORTED, not of the figures behind them —
      // the engine's own rule for pricing a counterfactual, and the one Day 47 broke
      // four times in prose while the code was held to it.
      assert.equal(
        roundCents(without.totalTax - withGain.totalTax),
        expected,
        `${year}: $${gain} of qualifying gain is worth $${expected} of Arizona tax`,
      );
    }
  }
});

test('the effective rate on a qualifying long-term gain is 1.875%, not 2.5%', () => {
  // The only place in Arizona where the rate depends on the KIND of income, which is
  // the claim the state's note makes and nothing else here would catch.
  for (const year of YEARS) {
    const gain = 400_000;
    const withGain = az(year, { netCapitalGain: gain, longTermCapitalGainAfter2011: gain }, 500_000);
    const asWages = az(year, {}, 500_000);
    const borne = roundCents(asWages.totalTax - withGain.totalTax);
    assert.equal(borne, roundCents(gain * RATE * SHARE), `${year}`);
    assert.equal(
      roundCents((RATE * (1 - SHARE)) * 1_000_000) / 1_000_000,
      0.01875,
      'the effective rate is the statutory one less a quarter of it',
    );
  }
});

test('SHORT-TERM ITEMS ARE EXCLUDED RATHER THAN NETTED, which is the worksheet sentence', () => {
  for (const year of YEARS) {
    // $50,000 long-term behind a $10,000 short-term loss: net gain $40,000, and the
    // subtraction is a quarter of the FIFTY, not of the forty.
    const r = az(year, {
      netCapitalGain: 40_000,
      shortTermCapitalGains: 0,
      longTermCapitalGainAfter2011: 50_000,
    });
    assert.equal(subtraction(r), 12_500, `${year}: a quarter of the long-term gain itself`);
    assert.notEqual(subtraction(r), 10_000, `${year}: NOT a quarter of the net gain`);
    // And a short-term GAIN cannot enlarge it either, because the field it would
    // arrive in is not one this basis reads as an amount.
    const withShortTermGain = az(year, {
      netCapitalGain: 90_000,
      shortTermCapitalGains: 40_000,
      longTermCapitalGainAfter2011: 50_000,
    });
    assert.equal(subtraction(withShortTermGain), 12_500, `${year}: still a quarter of the fifty`);
  }
});

test('the two states disagree by statute: Arizona excludes where Wisconsin nets', () => {
  // ONE HOUSEHOLD, TWO STATES, AND THE DIFFERENCE IS NOT THE SHARE. Arizona's 25%
  // against Wisconsin's 30% would make Wisconsin's subtraction the larger one on
  // equal bases; the netting rule reverses it.
  const fields = {
    netCapitalGain: 40_000,
    shortTermCapitalGains: 0,
    longTermCapitalGainAfter2011: 50_000,
  };
  const arizona = subtraction(run('AZ', 2025, { agi: 200_000, fields }));
  const wisconsin = named(run('WI', 2025, { agi: 200_000, fields }), 'capital gain');
  assert.equal(arizona, 12_500, 'Arizona: 25% of the $50,000 long-term gain');
  assert.equal(wisconsin, 12_000, 'Wisconsin: 30% of the $40,000 NET gain');
  assert.ok(arizona > wisconsin, 'the smaller share yields the larger subtraction here');
  // And the bases are declared differently, which is what makes that a fact about
  // the states rather than about this test.
  assert.equal(getStateDefinition('WI', 2025).capitalGainsSubtraction.basis.kind, 'longTermNetted');
  assert.equal(getStateDefinition('MO', 2025).capitalGainsSubtraction.basis.kind, 'wholeNetGain');
});

test('AN OVERALL CAPITAL LOSS SUBTRACTS NOTHING, however large the long-term gain', () => {
  for (const year of YEARS) {
    // `netCapitalGain` is `nonNegative`, so Form 1040 line 7's negative half is not
    // representable and a loss year arrives as a zero. The gate reads it.
    for (const netCapitalGain of [0, undefined]) {
      const r = az(year, { netCapitalGain, longTermCapitalGainAfter2011: 50_000 });
      assert.equal(
        subtraction(r),
        0,
        `${year}: no gain is included in federal AGI, so § 43-1022(22) reaches nothing`,
      );
      assert.equal(r.stateAdjustedGrossIncome, 200_000, `${year}: and the base is untouched`);
    }
    // One dollar of net gain opens the whole subtraction, which is the cliff the
    // statute's "included in federal adjusted gross income" creates.
    const r = az(year, { netCapitalGain: 1, longTermCapitalGainAfter2011: 50_000 });
    assert.equal(subtraction(r), 12_500, `${year}: one dollar of net gain is the whole gate`);
  }
});

test('a gain with no qualifying half is answered, and the answer is stated to be too high', () => {
  for (const year of YEARS) {
    const r = az(year, { netCapitalGain: 100_000 });
    assert.equal(subtraction(r), 0, `${year}: nothing is assumed about the acquisition date`);
    const note = r.notes.find((n) => n.startsWith('A NET CAPITAL GAIN WAS SUPPLIED'));
    assert.ok(note, `${year}: the caller is told, rather than silently charged`);
    assert.match(note, /0\.625%/, `${year}: and told the size`);
    assert.match(note, /longTermCapitalGainAfter2011/, `${year}: and the field to pass`);
    // The reverse case: a qualifying gain with no net gain is the STATUTE, not an
    // omission, and says so differently.
    const gated = az(year, { longTermCapitalGainAfter2011: 50_000 });
    assert.ok(
      gated.notes.some((n) => n.startsWith('A QUALIFYING LONG-TERM GAIN WAS SUPPLIED')),
      `${year}`,
    );
  }
});

test('neither note fires for a filer who has no capital gain at all', () => {
  // The cost of a conditional note is paid on every call, so a note that fires for a
  // wage earner is `notes` with extra steps.
  for (const year of YEARS) {
    const r = az(year, {});
    for (const prefix of ['A NET CAPITAL GAIN WAS SUPPLIED', 'A QUALIFYING LONG-TERM GAIN WAS SUPPLIED']) {
      assert.ok(!r.notes.some((n) => n.startsWith(prefix)), `${year}: ${prefix}`);
    }
  }
});

test('the subtraction is reported by name, and the name carries the share it holds', () => {
  for (const year of YEARS) {
    const rule = getStateDefinition('AZ', year).capitalGainsSubtraction;
    assert.match(rule.name, /25%/, `${year}`);
    assert.equal(Number(rule.name.match(/(\d+)%/)[1]) / 100, rule.share, `${year}: the printed figure is the held one`);
    assert.match(rule.cite, /43-1022\(22\)/, `${year}`);
  }
});

test('a negative qualifying gain is refused rather than treated as a loss', () => {
  // Long-term losses are netted against long-term gains BEFORE this field, so a
  // negative here is a caller error and not a shape the statute has a rule for.
  //
  // AND IT IS REFUSED ON BOTH SIDES OF THE GATE, which is the half that was wrong
  // for the first hour this rule existed. The engine read
  // `netGain > 0 ? nonNegative(...) : 0`, so the same bad input threw on a
  // household with a net gain and was accepted in silence on one without — a
  // claim about an input that depended on a different input's value. Validation
  // inside a conditional is validation the conditional can turn off.
  for (const netCapitalGain of [10_000, 0, undefined]) {
    assert.throws(
      () => az(2025, { netCapitalGain, longTermCapitalGainAfter2011: -1 }),
      /longTermCapitalGainAfter2011 must not be negative/,
      `netCapitalGain: ${netCapitalGain}`,
    );
  }
});
