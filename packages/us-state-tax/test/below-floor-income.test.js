// A SUPPLIED modified gross income BELOW the floor the form itself sets, in the
// two states that take one.
//
// ## Why this file exists
//
// Day 81 built `tools/note-conditions.mjs` for the class Day 80 named — **the
// shipped note was right and the code did something else** — and the half of it
// with no English in it found two more instances in one run. Kentucky's and New
// Mexico's notes each state the floor as a fact about the figure:
//
//   KY  "MODIFIED GROSS INCOME ... is the LARGER of federal AGI and Kentucky
//        AGI and not either one of them"
//   NM  "the form states the relationship itself — the total must equal or
//        exceed Federal Adjusted Gross Income from Form PIT-1, line 9"
//
// Both worksheets ADD to that floor and neither subtracts from it, so a supplied
// figure below it is one no completed worksheet can hold. The engine took it
// anyway and paid a larger credit for it:
//
//   KY 2025 single $200,000   omitted $7,869.20 of tax   supplied 0  ->  $0.00
//   NM 2026 joint  $45,000    omitted $315.20 of rebate  supplied 0  ->  $763.20
//
// Kentucky's is the whole bill. **Zero is the value this matters for and it is
// not hypothetical**: `readMoney` in `tools/audit/household.mjs` turns a blank
// spreadsheet cell into `0`, so "the column was empty" and "the figure is
// nothing" are one `if` apart in this repository's own buyer-facing tool.
//
// ## What is asserted, and what deliberately is NOT
//
// The engine still computes on the figure it was given. **It discloses rather
// than overrides**, because the caller may know a worksheet line this package
// cannot reach — which is the entire reason the field exists — and quietly
// replacing their number with this engine's floor would answer a question they
// did not ask. So the assertions below are: the annotation appears below the
// floor, it carries BOTH amounts, it does not appear at or above the floor, and
// the amount itself is unchanged by any of it.
//
// The fourth test is the control. A gate that only ever checks the red case
// cannot tell a correct predicate from one that is always true, and this one is
// a comparison with two sides.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stateIncomeTax } from '../dist/esm/index.js';

function federal(agi, kind, year) {
  const deduction = kind === 'itemized' ? 14600 : year === 2026 ? 16100 : 15750;
  return {
    adjustedGrossIncome: agi,
    taxableIncome: Math.max(0, agi - deduction),
    deduction,
    deductionKind: kind,
    incomeTaxBeforeRefundableCredits: Math.round(agi * 0.08),
    earnedIncomeCredit: 0,
  };
}

const KENTUCKY = {
  state: 'KY',
  year: 2025,
  filingStatus: 'single',
  federal: federal(200000, 'itemized', 2025),
  earnedIncome: 200000,
};

const NEW_MEXICO = {
  state: 'NM',
  year: 2026,
  filingStatus: 'marriedFilingJointly',
  federal: federal(45000, 'standard', 2026),
  earnedIncome: 45000,
  dependents: 2,
  dependentAges: [5, 9],
};

/** The credit lines that carry the below-floor annotation. */
function belowFloorLines(result) {
  return (result.credits ?? []).filter((c) => c.name.includes('is BELOW'));
}

test('Kentucky: a modified gross income below max(federal AGI, Kentucky AGI) is used and named', () => {
  const omitted = stateIncomeTax(KENTUCKY);
  const zero = stateIncomeTax({ ...KENTUCKY, kentuckyModifiedGrossIncome: 0 });

  // The step this is about: the whole $7,869.20 bill, across the difference
  // between leaving a column empty and filling it with a nought.
  assert.equal(omitted.totalTax, 7869.2);
  assert.equal(zero.totalTax, 0);

  assert.equal(belowFloorLines(omitted).length, 0, 'an omitted figure is not a supplied one');
  const [line] = belowFloorLines(zero);
  assert.ok(line, 'the credit line names the supplied figure as below the floor');
  // BOTH amounts, because a warning that does not say what the floor was leaves
  // the reader with nothing to check it against.
  assert.match(line.name, /\$0\.00/);
  assert.match(line.name, /\$200,000\.00/);
  assert.match(line.name, /max\(federal AGI, Kentucky AGI\)/);
  assert.match(line.name, /NOT overridden/);
});

test('New Mexico: a modified gross income below the PIT-RC floor is used and named', () => {
  const omitted = stateIncomeTax(NEW_MEXICO);
  const zero = stateIncomeTax({ ...NEW_MEXICO, newMexicoModifiedGrossIncome: 0 });

  assert.equal(omitted.totalTax, -315.2);
  assert.equal(zero.totalTax, -763.2);

  assert.equal(belowFloorLines(omitted).length, 0);
  const [line] = belowFloorLines(zero);
  assert.ok(line);
  assert.match(line.name, /\$0\.00/);
  assert.match(line.name, /\$45,000\.00/);
  assert.match(line.name, /must equal or exceed Federal Adjusted Gross Income/);
});

test('the annotation is silent at and above the floor, which is the control', () => {
  for (const [input, field, floor] of [
    [KENTUCKY, 'kentuckyModifiedGrossIncome', 200000],
    [NEW_MEXICO, 'newMexicoModifiedGrossIncome', 45000],
  ]) {
    for (const value of [floor, floor + 0.01, floor * 3]) {
      const r = stateIncomeTax({ ...input, [field]: value });
      assert.equal(
        belowFloorLines(r).length,
        0,
        `${input.state} should say nothing at ${value}, which the worksheet can produce`
      );
    }
    // And one cent BELOW the floor does fire, so the comparison is not simply
    // never true.
    const r = stateIncomeTax({ ...input, [field]: floor - 0.01 });
    assert.equal(belowFloorLines(r).length, 1, `${input.state} should fire one cent under the floor`);
  }
});

test('the annotation changes no figure, only what the return says about it', () => {
  // Two returns with the same supplied figure, one of them below the floor:
  // the amounts are what the staircase and the table produce, and naming the
  // problem does not move them.
  const below = stateIncomeTax({ ...KENTUCKY, kentuckyModifiedGrossIncome: 1000 });
  assert.equal(below.totalTax, 0);
  assert.equal(belowFloorLines(below).length, 1);

  const nm = stateIncomeTax({ ...NEW_MEXICO, newMexicoModifiedGrossIncome: 1000 });
  assert.equal(nm.totalTax, -763.2);
  assert.equal(belowFloorLines(nm).length, 1);
});

test("Kentucky's poverty-guideline sentinel costs $454.44, which its note now states", () => {
  // `federalPovertyGuideline: 0` switches the family size credit off, because a
  // guideline of nothing puts every filer above 133% of it. It is the same
  // sentinel Virginia's § 58.1-339.8 note names, and until Day 81 Kentucky's
  // note did not mention it — the one undisclosed zero-versus-absent step the
  // new instrument found in the package.
  const base = {
    state: 'KY',
    year: 2026,
    filingStatus: 'headOfHousehold',
    federal: federal(25000, 'standard', 2026),
    earnedIncome: 25000,
    dependents: 1,
    dependentAges: [7],
  };
  const derived = stateIncomeTax(base);
  const switchedOff = stateIncomeTax({ ...base, federalPovertyGuideline: 0 });
  assert.equal(derived.totalTax, 302.96);
  assert.equal(switchedOff.totalTax, 757.4);
  assert.equal(Math.round((switchedOff.totalTax - derived.totalTax) * 100) / 100, 454.44);

  // The direction matters and the note says it: this one runs AGAINST the
  // filer, so a blank column costs them the credit rather than buying one.
  assert.ok(switchedOff.totalTax > derived.totalTax);
  assert.ok(
    derived.notes.some((n) => n.includes('454.44') && n.includes('federalPovertyGuideline')),
    "Kentucky's family size note states the sentinel and what it costs"
  );
});
