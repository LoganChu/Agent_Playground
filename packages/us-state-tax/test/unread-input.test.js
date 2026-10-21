// A field this return accepted, spelt correctly, and spent on nothing.
//
// `unknown-input.test.js` covers the key this package does not have. This covers
// the commoner one: a key it DOES have, which the state the caller named has no
// use for. See `src/unread-input.ts` for why the claim is measured rather than
// looked up, and for the ladder-based version of it that was built, measured over
// 3,500 (state, year, field) triples and thrown away.
//
// Four of the tests below are DISCRIMINATING rather than demonstrative: they pass
// only if the probe is built the way it is, and each one was run against a
// deliberately weakened engine first and seen to fail.
//
//   - `separatedFromSpouse` fails if the comparison leaves the NOTES out.
//   - the Ohio pair fails if a probe that THROWS is read as unread.
//   - the Oregon case fails if a bespoke note is not deduplicated against.
//   - the trivial-values case fails if a caller's `0` is read as a lost figure.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  KNOWN_STATE_INPUT_FIELDS,
  NO_INCOME_TAX_STATES,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  stateIncomeTax,
} from '../dist/esm/index.js';

const FEDERAL = {
  adjustedGrossIncome: 62_000,
  taxableIncome: 46_400,
  deduction: 15_600,
  deductionKind: 'standard',
  earnedIncomeCredit: 1_200,
  incomeTaxBeforeRefundableCredits: 4_100,
};

// Three states define their own base and REFUSE a return without it, which is the
// loudest form of being read there is. They belong in the floor of every
// household here rather than in any list of candidates.
const FLOOR = {
  MA: { massachusettsFivePercentIncome: 58_000 },
  NJ: { newJerseyGrossIncome: 62_000 },
  PA: { pennsylvaniaTaxableIncome: 60_000 },
};

const base = (state, year, extra = {}) => ({
  state,
  year,
  filingStatus: 'single',
  federal: FEDERAL,
  ...(FLOOR[state] ?? {}),
  ...extra,
});

const SPENT = 'spent on nothing';
const unreadNote = (result) => result.notes.filter((n) => n.includes(SPENT));
const namesField = (result, field) =>
  unreadNote(result).some((n) => n.includes(`\`${field}\``));

test('a field the state cannot use is reported, with the figure named', () => {
  const result = stateIncomeTax(base('TX', 2025, { pennsylvaniaTaxableIncome: 60_000 }));
  assert.equal(unreadNote(result).length, 1);
  assert.ok(namesField(result, 'pennsylvaniaTaxableIncome'));
  // The narrow claim, verbatim, because the whole finding of the day is that the
  // WIDE claim cannot be established by a probe. A note that said Texas has no
  // rule reading the field would be asserting a negative over every household,
  // every status and every combination of fields.
  assert.match(unreadNote(result)[0], /It does NOT mean Texas has no rule that reads the field/);
  assert.match(unreadNote(result)[0], /MEASURED rather than looked up/);
});

test('ONE note however many fields, because a warning label is spent once', () => {
  const result = stateIncomeTax(
    base('TX', 2025, {
      pennsylvaniaTaxableIncome: 60_000,
      propertyTaxPaid: 6_400,
      rentPaid: 14_000,
      collectiblesGains: 1_100,
    }),
  );
  assert.equal(unreadNote(result).length, 1);
  for (const field of ['pennsylvaniaTaxableIncome', 'propertyTaxPaid', 'rentPaid', 'collectiblesGains'])
    assert.ok(namesField(result, field), field);
  assert.match(unreadNote(result)[0], /^4 figures were supplied/);
});

test('the singular reads as a sentence', () => {
  const result = stateIncomeTax(base('TX', 2025, { propertyTaxPaid: 6_400 }));
  assert.match(unreadNote(result)[0], /^A figure was supplied and spent on nothing/);
  assert.match(unreadNote(result)[0], /without it\./);
});

test('every one of the nine states with no income tax reports a supplied figure', () => {
  for (const state of NO_INCOME_TAX_STATES) {
    const result = stateIncomeTax(base(state, 2025, { propertyTaxPaid: 6_400 }));
    assert.equal(result.hasIncomeTax, false);
    assert.ok(namesField(result, 'propertyTaxPaid'), state);
  }
  // Nine, asserted as a list, so a tenth cannot join in silence. Day 56's rule:
  // a test that pins one member of a class cannot see a hole that swallows it.
  //
  // Sorted, because membership is the claim and the constant's own order is not:
  // it reads AK, FL, NV, NH, …, which is the order they were added rather than
  // any order worth pinning.
  assert.deepEqual([...NO_INCOME_TAX_STATES].sort(), [
    'AK', 'FL', 'NH', 'NV', 'SD', 'TN', 'TX', 'WA', 'WY',
  ]);
});

test('a field that IS read is not reported', () => {
  // Virginia's age deduction, § 58.1-322.03(5), reads `filerAge`.
  const result = stateIncomeTax(base('VA', 2025, { filerAge: 70 }));
  assert.equal(namesField(result, 'filerAge'), false);
});

test('DISCRIMINATING: a field whose only effect is to switch a NOTE off is read', () => {
  // On a Pennsylvania separate return with no `pennsylvaniaSpouseEligibilityIncome`,
  // `separatedFromSpouse` moves no FIGURE: `forgivenessClaimants` gives one
  // claimant on their own income either way, because the engine's default is
  // already the Unmarried oval on line 19a and already the safe direction. Its
  // whole observable effect THERE is to stop the note saying the default was an
  // assumption.
  //
  // So a probe comparing FIGURES alone calls it unread, which is false: it did
  // the only thing it does on that return. This test fails against exactly that
  // engine.
  //
  // The boundary is asserted below rather than described, because the first
  // version of this comment said "on ANY Pennsylvania return" and that is wrong
  // by $1,842.00 — see `src/unread-input.ts`. A sentence about a field's reach,
  // written from a probe that varied one field, is the same defect as the ladder
  // the whole module exists to have rejected.
  const input = base('PA', 2025, {
    filingStatus: 'marriedFilingSeparately',
    pennsylvaniaEligibilityIncome: 12_000,
  });
  const without = stateIncomeTax(input);
  const withIt = stateIncomeTax({ ...input, separatedFromSpouse: true });
  assert.equal(withIt.totalTax, without.totalTax, 'the premise: no figure moves');
  assert.ok(
    without.notes.some((n) => n.includes('Schedule SP')),
    'the premise: the default warns',
  );
  assert.equal(
    withIt.notes.some((n) => n.includes('Schedule SP')),
    false,
    'the premise: saying so withdraws the warning',
  );
  assert.equal(namesField(withIt, 'separatedFromSpouse'), false, 'so it is READ, not unread');

  // And the boundary: supply the spouse's eligibility income — `0` is a real
  // answer, and the answer for a spouse with no income — and the same field
  // moves the tax. Two claimants with a $13,000 allowance forgive a $12,000
  // eligibility income whole; one claimant with $6,500 steps the forgiveness
  // down to nothing. 72 Pa. Stat. § 7304.
  const withSpouse = { ...input, pennsylvaniaSpouseEligibilityIncome: 0 };
  assert.equal(stateIncomeTax(withSpouse).totalTax, 0);
  assert.equal(stateIncomeTax({ ...withSpouse, separatedFromSpouse: true }).totalTax, 1_842);
});

test('DISCRIMINATING: a field a return will not RUN without is read, not unread', () => {
  // Ohio reads `earnedIncome` only once `city` is supplied as well, and `city`
  // REFUSES to run without it. A probe that discards the throw reports
  // `earnedIncome` as unread — which is how the first pairwise measurement of
  // this reproduced the very blindness it was written to measure.
  assert.throws(
    () => stateIncomeTax(base('OH', 2025, { city: 'COLUMBUS' })),
    /neither qualifyingWages nor earnedIncome was supplied/,
  );
  const result = stateIncomeTax(base('OH', 2025, { city: 'COLUMBUS', earnedIncome: 60_000 }));
  assert.equal(namesField(result, 'earnedIncome'), false);
  assert.equal(namesField(result, 'city'), false);
  // And the figure it is worth, so the test knows the field is load-bearing
  // rather than merely unreported.
  const lean = stateIncomeTax(base('OH', 2025, { city: 'COLUMBUS', earnedIncome: 1 }));
  assert.ok(result.totalTax - lean.totalTax > 1_000);
});

test('DISCRIMINATING: a field with its own bespoke note is not reported twice', () => {
  // Including the notes in the comparison deduplicates this for free: a bespoke
  // note ABOUT a field is an observable effect OF the field, so removing it
  // changes the result and the field reads as read. Nothing enumerates which
  // fields have bespoke notes, which is the point — a list of them would be the
  // hand-written table this whole design exists to avoid.
  const result = stateIncomeTax(base('TX', 2025, { oregonPriorYearTaxBeforeCredits: 4_000 }));
  assert.ok(
    result.notes.some((n) => n.includes('`oregonPriorYearTaxBeforeCredits` was ignored')),
    'the premise: Texas has a bespoke sentence for this field',
  );
  assert.equal(unreadNote(result).length, 0);
});

test('DISCRIMINATING: a trivial value is the caller answering no, not a lost figure', () => {
  // Mirrors `us-tax-mcp`'s own rule that a declared `0` or `false` is the STATE
  // answering no rather than asking the question. Reporting these would fire on
  // every well-formed call that answers something in the negative, and Day 37's
  // rule is that a warning label spent on something that is fine is how the
  // label stops being read.
  const result = stateIncomeTax(
    base('TX', 2025, {
      propertyTaxPaid: 0,
      separatedFromSpouse: false,
      dependents: 0,
      dependentAges: [],
      federalDeductions: {},
      retirementIncome: null,
    }),
  );
  assert.equal(unreadNote(result).length, 0);
  // But a populated object IS a question, even when every figure in it is zero:
  // the caller built that shape deliberately.
  const shaped = stateIncomeTax(
    base('TX', 2025, { retirement: { filer: { employerPlanPension: 0 } } }),
  );
  assert.ok(namesField(shaped, 'retirement'));
});

test('no structural field is ever reported, in any state-year', () => {
  // `state` and `year` select the law, `filingStatus` selects the column of every
  // table in it, and `federal` is the basis. Removing one asks a question with no
  // answer, and a probe that tried would throw for a reason that has nothing to
  // do with whether the caller's figure was spent.
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      const result = stateIncomeTax(base(state, year, { propertyTaxPaid: 6_400 }));
      for (const field of ['state', 'year', 'filingStatus', 'federal'])
        assert.equal(namesField(result, field), false, `${state} ${year} ${field}`);
    }
  }
});

test('reportUnreadFields: false moves NO figure and no other note, in every state-year', () => {
  // This is the assertion that makes `FIGURE_SWEEP_OPTIONS` in
  // `status-households.mjs` safe. The status sweep's 8,320 rows and the step
  // probes' 579 are all FIGURES, measured with the option off because on it took
  // the suite from 18 seconds to 6m09s — and without this test that would be a
  // place a figure could change unobserved.
  let withNote = 0;
  for (const year of SUPPORTED_YEARS) {
    for (const state of SUPPORTED_STATES) {
      const input = base(state, year, {
        propertyTaxPaid: 6_400,
        rentPaid: 14_000,
        collectiblesGains: 1_100,
        filerAge: 70,
        earnedIncome: 62_000,
      });
      const on = stateIncomeTax(input);
      const off = stateIncomeTax(input, { reportUnreadFields: false });
      const strip = (r) => ({ ...r, notes: r.notes.filter((n) => !n.includes(SPENT)) });
      assert.deepEqual(strip(on), off, `${state} ${year}`);
      if (unreadNote(on).length > 0) withNote += 1;
    }
  }
  // And the option is worth having at all, which an assertion of equality alone
  // would not show: a test that proves two things are the same proves nothing if
  // they are the same because neither does anything.
  assert.ok(withNote > 0, 'the premise: the note fires somewhere in the sweep');
});

test('a bare return pays nothing for the probe and carries no note', () => {
  // Every field a bare household supplies is structural, so there is nothing to
  // probe and the fast path returns the result untouched.
  const result = stateIncomeTax(base('VA', 2025));
  assert.equal(unreadNote(result).length, 0);
});

test('NO field is accepted in silence by a state with no income tax', () => {
  // The general form of Day 56's finding, which was one field in nine states.
  // The field list is proved exhaustive against the interface by the compiler;
  // what that proof cannot say is that each field is ever MENTIONED. So every
  // non-structural field is sent to a state where nothing can read it and is
  // required to be refused, or named by some note — this one, or a bespoke one.
  //
  // Which of the two is deliberately not asserted. `oregonPriorYearTaxBeforeCredits`
  // is named by its own priced sentence and so never reaches this note at all
  // (test 8), and an assertion that named the messenger would have to be edited
  // every time a field gains a sentence of its own. What a caller needs is that
  // the figure they supplied is accounted for somewhere.
  const structural = ['state', 'year', 'filingStatus', 'federal'];
  const value = {
    dependents: 2, dependentAges: [8, 14], earnedIncome: 52_000, investmentIncome: 3_000,
    additions: 1_200, outOfStateMunicipalInterest: 900, subtractions: 1_500,
    pennsylvaniaTaxableIncome: 60_000, pennsylvaniaEligibilityIncome: 61_000,
    pennsylvaniaSpouseEligibilityIncome: 4_000, oregonPriorYearTaxBeforeCredits: 4_000,
    separatedFromSpouse: true, newJerseyGrossIncome: 62_000,
    massachusettsFivePercentIncome: 58_000, shortTermCapitalGains: 2_500,
    collectiblesGains: 1_100, socialSecurityAndMedicarePaid: 3_978, filerAge: 67,
    spouseAge: 66, spouseHasNoGrossIncomeAndIsNotADependent: true,
    spouseAdjustedFederalAdjustedGrossIncome: 15_000, spouseClaimsAgeDeduction: true,
    blindOrDisabled: 1, dependentsAttendingCollege: 1, retirementIncome: 20_000,
    taxableSocialSecurity: 9_000, taxExemptInterest: 700,
    retirement: { filer: { employerPlanPension: 12_000 } }, federalPovertyGuideline: 21_150,
    lesserSpouseIncome: 18_000, propertyTaxPaid: 6_400, rentPaid: 14_000,
    federalDeductions: { qualifiedBusinessIncome: 4_000 },
    federalOneDollarHigher: { adjustedGrossIncome: 62_001, taxableIncome: 46_401 },
    stateItemizedDeductions: 17_000, netCapitalGain: 5_000,
    longTermCapitalGainAfter2011: 4_000, yonkersNonresidentEarnings: 30_000,
    locality: 'NYC', county: 'ALLEN', city: 'DETROIT', cityIncome: 55_000,
    workCity: 'DETROIT', workCityEarnings: 40_000, qualifyingWages: 52_000,
    businessIncome: 9_000, bothSpousesHaveQualifyingIncome: true,
    residentCreditRate: 0.5, residentCreditLimitRate: 0.02, schoolDistrict: '0203',
  };
  const missing = KNOWN_STATE_INPUT_FIELDS.filter(
    (f) => !structural.includes(f) && !Object.hasOwn(value, f),
  );
  assert.deepEqual(missing, [], 'add a fixture value for each field named here');

  const silent = [];
  for (const field of KNOWN_STATE_INPUT_FIELDS) {
    if (structural.includes(field)) continue;
    let result;
    try {
      result = stateIncomeTax(base('TX', 2025, { [field]: value[field] }));
    } catch {
      continue; // REFUSED, which is louder than a note.
    }
    if (!result.notes.some((n) => n.includes(field))) silent.push(field);
  }
  assert.deepEqual(silent, [], 'these were accepted by a state with no income tax in silence');
});
