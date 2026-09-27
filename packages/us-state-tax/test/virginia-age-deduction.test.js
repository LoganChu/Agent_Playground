// Virginia's age deduction on a SEPARATE return, and the rule behind it.
//
// § 58.1-322.03(5) is two deductions with one name: subdivision (a) gives filers
// born before 1 January 1939 `$12,000` with no income test, and (b) gives
// everyone else `$12,000` withdrawn at a dollar a dollar above a threshold. The
// threshold table in `virginia.ts` has read `separate: 75_000` since the day it
// was written, with a comment calling that the one place Virginia treats filing
// separately more generously than filing single.
//
// **The comment was wrong, and it was wrong in the shape this file exists to
// prevent: a threshold is half a test.** The same sentence that hands a separate
// filer the joint `$75,000` measures the excess on "the total combined adjusted
// federal adjusted gross income of BOTH SPOUSES". A separate filer is not
// treated generously; they are given the joint test whole, and a table that
// stored the figure without its measure said the opposite of the statute.
//
// THE RULE: a threshold is not a test. Store what the excess is measured on, or
// the generous half of a rule will read as the whole of it.
//
// Three claims are declared on `ageDeduction.separateReturn`, each with its own
// citation, because they come from three places and Day 30's rule is that a field
// shared by N provisions has one citation checked against the provisions somebody
// read:
//
//  1. `incomeMeasure` — the statute, quoted above.
//  2. `spouseAmount` — the deduction attaches to a birth date, so § 151(b) does
//     not reach it and the exemption's answer cannot be borrowed. This is the one
//     PolicyEngine-US has no equivalent of.
//  3. `bothClaiming` — the Form 760 worksheet's half-of-joint allocation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stateIncomeTax, getStateDefinition } from '../dist/esm/index.js';

const YEAR = 2026;
const RULE = getStateDefinition('VA', YEAR).ageDeduction;

/** A separate filer of 68 with $55,000 of pension and a 68-year-old spouse. */
function household(extra = {}) {
  return {
    state: 'VA',
    year: YEAR,
    filingStatus: 'marriedFilingSeparately',
    federal: {
      adjustedGrossIncome: 55_000,
      taxableIncome: 38_900,
      deduction: 16_100,
      deductionKind: 'standard',
      earnedIncomeCredit: 0,
    },
    retirementIncome: 55_000,
    filerAge: 68,
    spouseAge: 68,
    ...extra,
  };
}

const run = (extra) => stateIncomeTax(household(extra));
const deduction = (result) =>
  (result.computedSubtractions ?? []).find((s) => s.name === 'Age deduction')?.amount ?? 0;
const taken = (extra) => deduction(run(extra));

test('the separate-return rule is declared, with one citation per claim', () => {
  const rule = RULE.separateReturn;
  assert.equal(rule.incomeMeasure, 'combinedWithSpouse');
  assert.equal(rule.spouseAmount, 'ownReturnOnly');
  assert.equal(rule.bothClaiming, 'halfOfJointDeduction');
  const cites = [rule.incomeMeasureCite, rule.spouseAmountCite, rule.bothClaimingCite];
  // Three distinct provisions. A shared string here would launder the worksheet
  // claim through the statutory one, which is the 2026-09-24 defect exactly.
  assert.equal(new Set(cites).size, 3);
  for (const cite of cites) assert.ok(cite.length > 60, 'a label is not a citation');
  // The one that has to be a quotation rather than a paraphrase, because it is
  // the one that reverses what the table beside it appeared to say.
  assert.match(rule.incomeMeasureCite, /total combined adjusted federal adjusted gross income/);
  assert.match(rule.incomeMeasureCite, /58\.1-322\.03\(5\)\(b\)/);
});

test('the separate threshold is the JOINT figure, which is the whole point', () => {
  // Kept as an assertion about the relation rather than as two numbers: the
  // separate column being equal to the joint one is what makes the combined
  // measure the only reading under which the rule is not a giveaway.
  assert.equal(RULE.threshold.marriedFilingSeparately, RULE.threshold.marriedFilingJointly);
  assert.equal(RULE.threshold.marriedFilingSeparately, 75_000);
  assert.equal(RULE.threshold.single, 50_000);
});

test('the income-tested deduction is REFUSED when the other return’s income is missing', () => {
  // The answer that does not flatter the filer, and the one this package got
  // wrong for a month. $55,000 is below $75,000, so the old reading gave this
  // filer the whole $12,000 — a larger deduction than the same person would get
  // filing single ($50,000 threshold) and a larger one than the couple would get
  // filing jointly on the same money.
  assert.equal(taken({}), 0);
  const note = run({}).notes.find((n) => n.includes('was NOT allowed on this separate return'));
  assert.ok(note, 'refused a deduction in silence');
  assert.match(note, /spouseAdjustedFederalAdjustedGrossIncome/);
  // Priced, and priced by running this return again rather than by quoting
  // $12,000 at a rate: it is worth the tax, not the deduction.
  assert.match(note, /worth up to \$690\.00/);
});

test('supplying the spouse’s income is what makes the deduction computable', () => {
  // A spouse with nothing: the combined figure is the filer's own, so the answer
  // is what the whole table would have given — reached by answering the question
  // rather than by not asking it.
  assert.equal(taken({ spouseAdjustedFederalAdjustedGrossIncome: 0 }), 12_000);
  // A dollar a dollar above $75,000 of COMBINED income.
  assert.equal(taken({ spouseAdjustedFederalAdjustedGrossIncome: 30_000 }), 2_000);
  // And gone by $40,000 of spouse income, where the old reading still gave
  // $12,000 because the filer's own $55,000 was under the threshold. $690 of
  // Virginia tax on a fact that was never on this return.
  assert.equal(taken({ spouseAdjustedFederalAdjustedGrossIncome: 40_000 }), 0);
  assert.equal(taken({ spouseAdjustedFederalAdjustedGrossIncome: 43_000 }), 0);
});

test('both spouses claiming: the JOINT deduction, halved — and it needs saying so', () => {
  // The worksheet computes two maxima against one combined excess and allocates
  // half to each return, so the excess costs this filer half of what their own
  // amount tested alone would cost: (2a - e) / 2 = a - e / 2.
  const alone = taken({ spouseAdjustedFederalAdjustedGrossIncome: 30_000 });
  const shared = taken({
    spouseAdjustedFederalAdjustedGrossIncome: 30_000,
    spouseClaimsAgeDeduction: true,
  });
  assert.equal(alone, 2_000); // 12,000 - 10,000
  assert.equal(shared, 7_000); // (24,000 - 10,000) / 2
  assert.equal(shared, alone + 10_000 / 2);
  // It is worth MORE to the filer, which is why it is an input and not a default.
  assert.ok(shared > alone);
  // The spouse has to be in the income-tested group for there to be a joint
  // deduction to halve. At 61 the spouse claims nothing, and the flag is ignored
  // and said to be ignored.
  const young = {
    spouseAdjustedFederalAdjustedGrossIncome: 30_000,
    spouseClaimsAgeDeduction: true,
    spouseAge: 61,
  };
  assert.equal(taken(young), 2_000);
  assert.match(
    run(young).notes.find((n) => n.includes('spouseClaimsAgeDeduction')),
    /INCOME-TESTED age group/,
  );
});

test('the untested cohort keeps its $12,000 with no spouse figure at all', () => {
  // Subdivision (a) has no income test to fail, so refusing it for want of an
  // income would be refusing a deduction for want of a fact it does not read.
  // Refusing exactly the half that needs the number is the difference between a
  // gap and a guess.
  assert.equal(taken({ filerAge: 88 }), 12_000);
  assert.equal(
    run({ filerAge: 88 }).notes.filter((n) => n.includes('was NOT allowed')).length,
    0,
  );
  // 88 in 2026 is a birth year of 1938; 87 is 1939 and is tested.
  assert.equal(taken({ filerAge: 87 }), 0);
});

test('the filer may not claim the SPOUSE’s $12,000, and that is a claim about a person', () => {
  // `spouseAmount: 'ownReturnOnly'`. The deduction is attached to a birth date
  // rather than to an exemption count, so a 68-year-old spouse on the other
  // return adds nothing here however much this package knows about them —
  // including the § 151(b) fact that DOES buy the spouse a $930 exemption and an
  // $800 aged exemption on the same return.
  const both = {
    spouseAdjustedFederalAdjustedGrossIncome: 0,
    spouseHasNoGrossIncomeAndIsNotADependent: true,
  };
  assert.equal(taken(both), 12_000);
  // Proof that the § 151(b) machinery IS running on this return, so the $12,000
  // is a refusal rather than an omission: the exemptions move and the deduction
  // does not.
  const withSpouse = run(both);
  const withoutSpouse = run({ spouseAdjustedFederalAdjustedGrossIncome: 0 });
  assert.equal(withSpouse.exemptions - withoutSpouse.exemptions, 930 + 800);
  assert.equal(deduction(withSpouse), deduction(withoutSpouse));
});

test('a joint return is untouched by all three claims', () => {
  // The halves sum back to the same figure on a joint return, and a joint return
  // already contains both incomes — so nothing here may move a joint answer.
  const joint = (extra = {}) =>
    stateIncomeTax({
      state: 'VA',
      year: YEAR,
      filingStatus: 'marriedFilingJointly',
      federal: {
        adjustedGrossIncome: 85_000,
        taxableIncome: 68_900,
        deduction: 16_100,
        deductionKind: 'standard',
        earnedIncomeCredit: 0,
      },
      retirementIncome: 85_000,
      filerAge: 68,
      spouseAge: 68,
      ...extra,
    });
  assert.equal(deduction(joint()), 14_000); // 24,000 - 10,000
  assert.equal(deduction(joint({ spouseClaimsAgeDeduction: true })), 14_000);
  assert.equal(deduction(joint({ spouseAdjustedFederalAdjustedGrossIncome: 30_000 })), 14_000);
  // And a caller who supplies the spouse's income on a joint return is told it
  // was ignored, because a joint return contains it already.
  assert.match(
    joint({ spouseAdjustedFederalAdjustedGrossIncome: 30_000 }).notes.find((n) =>
      n.includes('spouseAdjustedFederalAdjustedGrossIncome'),
    ),
    /only on a SEPARATE return/,
  );
});

test('the defect’s own case was already in the suite, asserted as a DIFFERENCE', () => {
  // The reason this went a month undetected, and it is not that the case was
  // missing. `separate-return-spouse.test.js` has run a Virginia separate filer
  // of 68 with $55,000 since the day it was written — through the defect — and
  // asserts that claiming the § 151(b) spouse is worth $99.47. It is $99.47 with
  // the age deduction at $12,000 and $99.47 with it at $0, because the deduction
  // is a term on both sides of the subtraction.
  //
  // THE RULE: an assertion on a DIFFERENCE is blind to every term the difference
  // cancels. Day 27's rule was that a test written from the data can only confirm
  // the data; this is sharper, because the test was written from the STATUTE and
  // still could not see a $690 error sitting in both of its operands.
  //
  // So this file pins LEVELS as well, on the same household that file uses.
  const off = run({});
  const on = run({ spouseHasNoGrossIncomeAndIsNotADependent: true });
  assert.equal(Number((off.tax - on.tax).toFixed(2)), 99.47); // what that file sees
  assert.equal(off.tax, 2_302.4); // and what it could not
  assert.equal(on.tax, 2_202.93);
  // The same two returns with the spouse's income supplied. The difference is
  // identical to the cent; the levels are $690 apart.
  const answered = { spouseAdjustedFederalAdjustedGrossIncome: 0 };
  const offA = run(answered);
  const onA = run({ ...answered, spouseHasNoGrossIncomeAndIsNotADependent: true });
  assert.equal(Number((offA.tax - onA.tax).toFixed(2)), 99.47);
  assert.equal(Number((off.tax - offA.tax).toFixed(2)), 690);
});

test('every other filing status ignores both new facts entirely', () => {
  for (const status of ['single', 'headOfHousehold', 'qualifyingSurvivingSpouse']) {
    const plain = stateIncomeTax(household({ filingStatus: status }));
    const fed = stateIncomeTax(
      household({
        filingStatus: status,
        spouseAdjustedFederalAdjustedGrossIncome: 40_000,
        spouseClaimsAgeDeduction: true,
      }),
    );
    assert.equal(fed.totalTax, plain.totalTax, `${status} read a fact about a spouse`);
  }
});

// ---------------------------------------------------------------------------
// Day 33 — the untested siblings of Day 32's defect
// ---------------------------------------------------------------------------
//
// Day 32 fixed `threshold.separate` and wrote the test above for it. Day 33's
// mutation audit then doubled `headOfHousehold: 50_000` and
// `qualifyingSurvivingSpouse: 50_000` in the SAME TABLE, and the whole suite
// stayed green — as it did for `zeroTaxThreshold`'s `11_950`, which decides
// whether a Virginian owes anything at all.
//
// **THE RULE: fixing one cell of a ByStatus table tests one cell of it.** The bug
// was found in `separate`, the fix was written for `separate`, and the test was
// written from the fix — so the two statuses nobody had thought about were exactly
// as unpinned after the fix as before it. A defect narrows attention to the place
// it was found, which is the one place that no longer needs it.
//
// The general form is now `test/bracket-pins.test.js` for rate schedules. This is
// the same idea for one rule, and the mechanism is the cheapest possible: assert
// EVERY key of the table, not the one the bug was in.
test('every status has an age deduction threshold, and every one of them is pinned', () => {
  // § 58.1-322.03(5)(a): $50,000, or $75,000 "for married taxpayers filing
  // jointly or separately" — one sentence covering both married columns, which is
  // why they are equal and why the third and fourth columns are the statute's
  // "otherwise" case rather than a rule of their own.
  assert.deepEqual(
    { ...RULE.threshold },
    {
      single: 50_000,
      marriedFilingJointly: 75_000,
      marriedFilingSeparately: 75_000,
      headOfHousehold: 50_000,
      qualifyingSurvivingSpouse: 50_000,
    },
    'a whole-table assertion, so a new status cannot be added without a figure for it',
  );
  // And a LEVEL for each of the two statuses that had none, per Day 32's rule.
  // Both are $12,000 under the threshold and lose the deduction a dollar at a time
  // above it, so the same person $10,000 over pays $575 more Virginia tax.
  for (const filingStatus of ['headOfHousehold', 'qualifyingSurvivingSpouse']) {
    const at = (adjustedGrossIncome) =>
      stateIncomeTax({
        state: 'VA',
        year: YEAR,
        filingStatus,
        federal: {
          adjustedGrossIncome,
          taxableIncome: adjustedGrossIncome,
          deduction: 0,
          deductionKind: 'standard',
          earnedIncomeCredit: 0,
        },
        filerAge: 68,
      });
    const deductionOf = (r) =>
      r.computedSubtractions.find((x) => x.name === 'Age deduction')?.amount;
    const under = at(45_000);
    const over = at(55_000);
    assert.equal(deductionOf(under), 12_000, `${filingStatus}: the whole deduction below $50,000`);
    assert.equal(deductionOf(over), 7_000, `${filingStatus}: $5,000 over the threshold costs $5,000 of deduction`);
    // The 11.5% marginal rate this file is about, on a status that had no test for
    // it: 5.75% on the dollar plus 5.75% on the dollar of deduction it destroys.
    //
    // Measured over $1,000 rather than $1. At one dollar the answer is 11.5 cents,
    // `roundCents` returns 12, and the assertion measures the rounding instead of
    // the rule — the third time Day 33 walked into this, twice in tests and once in
    // the mutation operator itself. A one-dollar probe is the natural way to write
    // a marginal rate and the wrong one whenever the engine rounds.
    const step = at(56_000).tax - over.tax;
    assert.equal(step, 115, `${filingStatus}: $115 on $1,000 — 11.5%, twice Virginia's top rate`);
  }
});

test('the § 58.1-321 filing threshold is pinned, and is unreachable in four statuses out of five', () => {
  // `zeroTaxThreshold.threshold` survived Day 33's audit, and the reason is not a
  // missing test. It is Day 29's rule: a parameter the engine can never reach is
  // not tested by anything, and four of these five figures cannot be reached.
  //
  // § 58.1-321 exempts a return whose Virginia AGI is below the threshold. The
  // Credit for Low Income Individuals separately zeroes a return up to the FEDERAL
  // POVERTY GUIDELINE, and the guideline for one person ($15,650) is well above
  // Virginia's $11,950 — so a single filer who would be exempt under § 58.1-321 is
  // already at zero tax from the credit, and doubling the threshold changes
  // nothing about them. The same is true of a separate filer and a head of
  // household, who take the same $11,950.
  //
  // The JOINT figure is the exception, and only because Virginia failed to double
  // it: $23,900 against a two-person guideline of $21,150, so there is a $2,750
  // band where § 58.1-321 is the only thing exempting the return. That band is
  // where the $106.23 cliff this file's header mentions lives, and it is the whole
  // observable footprint of the provision.
  //
  // Two governments set two floors and the higher one wins. So the honest test is
  // the whole table plus a level on the one status where the figure does work —
  // and the note, which is the part a future reader needs.
  const RULE_321 = getStateDefinition('VA', YEAR).zeroTaxThreshold;
  assert.deepEqual(
    { ...RULE_321.threshold },
    {
      single: 11_950,
      marriedFilingJointly: 23_900,
      marriedFilingSeparately: 11_950,
      headOfHousehold: 11_950,
      qualifyingSurvivingSpouse: 11_950,
    },
    '§ 58.1-321 — $11,950, and $23,900 for a joint return',
  );

  const at = (filingStatus, adjustedGrossIncome) =>
    stateIncomeTax({
      state: 'VA',
      year: YEAR,
      filingStatus,
      federal: {
        adjustedGrossIncome,
        taxableIncome: adjustedGrossIncome,
        deduction: 0,
        deductionKind: 'standard',
        earnedIncomeCredit: 0,
      },
      filerAge: 40,
    });

  // The joint cliff, on both sides. Zero to the whole graduated tax on one dollar.
  assert.equal(at('marriedFilingJointly', 23_900).tax, 0, 'at the threshold the return owes nothing');
  assert.equal(at('marriedFilingJointly', 23_901).tax, 106.23, 'and one dollar over it owes $106.23');

  // And the documented unreachability, asserted rather than described — so that if
  // Virginia ever raises $11,950 past the poverty guideline, or Congress lowers the
  // guideline, this fails and the note above gets rewritten instead of rotting.
  for (const filingStatus of ['single', 'marriedFilingSeparately', 'headOfHousehold']) {
    const threshold = RULE_321.threshold[filingStatus];
    assert.equal(at(filingStatus, threshold).tax, 0);
    assert.equal(
      at(filingStatus, threshold + 1).tax,
      0,
      `${filingStatus}: § 58.1-321 has no footprint here — the low income credit already reaches further`,
    );
    // The credit is what is doing it, and it reaches further than the threshold.
    assert.ok(at(filingStatus, threshold + 2_000).tax === 0, `${filingStatus}: and it keeps reaching`);
  }
});
