// v0.27.0: the other fourteen places a dead spouse was still a person.
//
// v0.23.0 gave a qualifying surviving spouse ONE per-person exemption. v0.24.0
// gave her one blind allowance and one senior allowance. Both fixes were
// written as "the exemption was wrong", and both left the same mistake standing
// everywhere else, because the mistake was never in an exemption. It was in a
// helper called `filerCount` that answered "how many people are on this return"
// with a fact about which COLUMN OF A FORM the status sits in.
//
// Those are different questions and they have different answers, and the helper
// is now named for the one it can answer: `claimedFilerCount`. Everything that
// counts people goes through `livingFilerCount`, and this file is the proof,
// state document by state document.
//
// THE RULE, and it is the reason 501 tests passed over all fourteen: **a test
// written by the same belief as the code cannot catch the belief.** Every one
// of these bugs needs a caller who supplies `spouseAge`, or
// `retirement.spouse`, or simply files this status in a state that does not
// have it — which is exactly what a caller who thinks the status means two
// filers would do. The suite had no such caller anywhere, for twenty-six days,
// across two previous fixes to this very status.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stateIncomeTax } from '../dist/esm/index.js';

const money = (actual, expected, msg) =>
  assert.ok(
    Math.abs(actual - expected) < 0.005,
    `${msg ?? 'amount'}: expected ${expected}, got ${actual}`,
  );

const credit = (result, prefix) =>
  result.credits.filter((c) => c.name.startsWith(prefix)).reduce((sum, c) => sum + c.amount, 0);

// ---------------------------------------------------------------------------
// 1. Massachusetts — the FICA deduction is capped per LIVING filer
//
// Form 1 does not offer this status at all: its four are single, married filing
// jointly, married filing separately, and head of household. And the deduction
// is for what a person PAID — lines 11a and 11b are "you" and "your spouse" —
// so a spouse who died before the tax year began contributes nothing to claim.
// The cap is $2,000 and it was $4,000.
// ---------------------------------------------------------------------------

const massachusetts = (filingStatus, paid = 4_590) =>
  stateIncomeTax({
    state: 'MA',
    year: 2026,
    filingStatus,
    federal: { adjustedGrossIncome: 60_000 },
    massachusettsFivePercentIncome: 60_000,
    wages: 60_000,
    socialSecurityAndMedicarePaid: paid,
    dependents: 1,
    dependentAges: [10],
  });

test('Massachusetts caps a widow’s FICA deduction at $2,000, not $4,000', () => {
  money(massachusetts('qualifyingSurvivingSpouse').totalTax, 2_190, 'the widow');
  // She pays what a single filer on the same figures pays, because
  // Massachusetts has no status for her and no figure that depends on one.
  money(
    massachusetts('qualifyingSurvivingSpouse').totalTax,
    massachusetts('single').totalTax,
    'a widow and a single filer',
  );

  // The cap, isolated from everything else the statuses differ about: a $4,590
  // FICA bill against a $2,000 one. The widow cannot tell them apart, because
  // her cap binds at $2,000 either way. A joint return can, by exactly
  // $2,000 x 5% = $100 — which is the second $2,000 of cap, and is what she had
  // been given.
  money(
    massachusetts('qualifyingSurvivingSpouse', 2_000).totalTax -
      massachusetts('qualifyingSurvivingSpouse').totalTax,
    0,
    'the widow’s cap bound at $2,000',
  );
  money(
    massachusetts('marriedFilingJointly', 2_000).totalTax -
      massachusetts('marriedFilingJointly').totalTax,
    100,
    'a joint return keeps the second $2,000',
  );
});

// ---------------------------------------------------------------------------
// 2. Pennsylvania — the most expensive of the fourteen, because of a staircase
//
// PA-40 Schedule SP has three claimant boxes: unmarried, separated, married.
// The Personal Income Tax Guide's own test is "divorced or widowed and
// unmarried at the end of the taxable year" — an UNMARRIED claimant, allowance
// $6,500, not the married $13,000.
//
// And the allowance is not a deduction. It is where 100% forgiveness of the
// WHOLE tax begins stepping down, ten points per $250 of eligibility income.
// Moving it $6,500 to the right forgave a widow's entire Pennsylvania bill.
// ---------------------------------------------------------------------------

const pennsylvania = (filingStatus, eligibilityIncome) =>
  stateIncomeTax({
    state: 'PA',
    year: 2026,
    filingStatus,
    federal: { adjustedGrossIncome: eligibilityIncome },
    wages: eligibilityIncome,
    pennsylvaniaTaxableIncome: eligibilityIncome,
    dependents: 1,
    dependentAges: [10],
  });

test('Pennsylvania forgives a widow on the UNMARRIED allowance', () => {
  // $6,500 + $9,500 for the child = $16,000, and at exactly the allowance the
  // forgiveness is still the whole tax. This is the control: the fix did not
  // move it, so it is the staircase that moved and not the tax.
  const at = pennsylvania('qualifyingSurvivingSpouse', 16_000);
  money(at.totalTax, 0, 'at the allowance she still owes nothing');
  money(credit(at, 'Special Tax Forgiveness'), 491.2);

  // $4,000 past it is sixteen steps of ten points, so nothing is forgiven.
  // Before v0.27.0 she was $2,500 short of the married staircase's end and was
  // forgiven the lot: $614.00, her whole Pennsylvania tax.
  const past = pennsylvania('qualifyingSurvivingSpouse', 20_000);
  money(past.totalTax, 614, 'four thousand past the allowance');
  money(credit(past, 'Special Tax Forgiveness'), 0);

  // A married claimant's allowance really is doubled, so the rule moved and the
  // figure did not.
  money(pennsylvania('marriedFilingJointly', 20_000).totalTax, 0, 'a married claimant');
});

// ---------------------------------------------------------------------------
// 3 and 4. Virginia — one exemption, counted twice, by two rules that disagreed
//
// Form 760 instructions: "Filing Status 1 (Single) should be used if you
// claimed one of the following federal filing statuses ... Single, Head of
// Household, or Qualifying Widow(er)/Qualifying Surviving Spouse."
//
// `virginia.ts` has said so since v0.24.0 about the standard deduction, the
// personal exemption and the filing threshold. The Credit for Low Income
// Individuals is "$300 for each personal exemption" — defined against the very
// exemption three hundred lines above it — and gave her two. So did the federal
// poverty guideline the credit is gated on, which runs the wrong way twice:
// a household one person too large both admits filers above the real cliff and
// raises the earned-income ceiling they are tested against.
// ---------------------------------------------------------------------------

const virginia = (filingStatus, agi, extra = {}) =>
  stateIncomeTax({
    state: 'VA',
    year: 2026,
    filingStatus,
    federal: { adjustedGrossIncome: agi },
    wages: agi,
    dependents: 1,
    dependentAges: [10],
    ...extra,
  });

test('Virginia gives a widow ONE $300 exemption and a two-person poverty line', () => {
  // The 2026 guideline is $15,960 for the first person and $5,680 for each
  // after. Two people is $21,640; three was $27,320. At $22,000 she is over the
  // real line and was under the imagined one.
  const over = virginia('qualifyingSurvivingSpouse', 22_000);
  money(over.totalTax, 439.5, 'above the two-person guideline');
  money(credit(over, 'Credit for Low Income'), 0);

  // $26,000 is under the three-person guideline and over the two-person one, so
  // it is the clearest specimen: $639.50 of Virginia tax that had been zero.
  const well = virginia('qualifyingSurvivingSpouse', 26_000);
  money(well.totalTax, 639.5, 'well above it');
  money(credit(well, 'Credit for Low Income'), 0);

  // Under the real line the credit is $300 a head for TWO heads, not three.
  const under = virginia('qualifyingSurvivingSpouse', 21_000);
  money(credit(under, 'Credit for Low Income'), 600, 'the widow and her child');
  // And a couple with the same child really are three people and really are
  // measured against the three-person guideline: at the same $26,000 that
  // leaves the widow with nothing, they take the whole $900.
  money(
    credit(virginia('marriedFilingJointly', 26_000), 'Credit for Low Income'),
    900,
    'a couple and their child',
  );
});

test('Virginia does not give a dead spouse an age deduction', () => {
  // $12,000 a person at 65, withdrawn dollar for dollar only above $50,000 of
  // adjusted federal AGI — so at $40,000 it is the whole $12,000, once.
  const widow = virginia('qualifyingSurvivingSpouse', 40_000, { filerAge: 70, spouseAge: 70 });
  money(widow.totalTax, 699.5, 'one age deduction');
  // She pays exactly what she pays with no spouseAge supplied at all, which is
  // the claim: the field describes nobody.
  money(
    widow.totalTax,
    virginia('qualifyingSurvivingSpouse', 40_000, { filerAge: 70 }).totalTax,
    'supplying spouseAge changed the answer',
  );
  // A joint return still reads `spouseAge`, and the second deduction is worth
  // its whole remaining Virginia tax.
  money(virginia('marriedFilingJointly', 40_000, { filerAge: 70 }).totalTax, 215.5, 'one of two');
  money(
    virginia('marriedFilingJointly', 40_000, { filerAge: 70, spouseAge: 70 }).totalTax,
    0,
    'a joint return keeps two',
  );
});

// ---------------------------------------------------------------------------
// 5. Maryland — the poverty level credit, which can be the whole bill
//
// Md. Code, Tax-Gen. § 10-709(a)(3) defines the unit in words: "an individual,
// OR an individual and the individual's spouse IF THEY FILE A JOINT INCOME TAX
// RETURN". A qualifying surviving spouse does not file one.
// ---------------------------------------------------------------------------

const maryland = (filingStatus, earned) =>
  stateIncomeTax({
    state: 'MD',
    year: 2026,
    filingStatus,
    federal: { adjustedGrossIncome: earned },
    wages: earned,
    earnedIncome: earned,
    dependents: 1,
    dependentAges: [10],
  });

test('Maryland measures a widow against a TWO-person poverty guideline', () => {
  // $24,000 is above $21,640 and below $27,320, so the credit — 5% of earned
  // income, capped at the tax, which here is all of it — turned $465.25 into
  // nothing.
  const widow = maryland('qualifyingSurvivingSpouse', 24_000);
  money(widow.totalTax, 465.25, 'the whole Maryland bill was being forgiven');
  money(credit(widow, 'Maryland poverty level'), 0);

  // Below the real line the credit is still there and still the whole bill.
  money(maryland('qualifyingSurvivingSpouse', 21_000).totalTax, 0, 'under the real guideline');
  // And a joint return with one child really is measured on three people.
  money(maryland('marriedFilingJointly', 24_000).totalTax, 0, 'a couple and their child');
});

// ---------------------------------------------------------------------------
// 6 and 7. New York and New York City — the docstring was right, the line was not
//
// Both household credits counted "the filer, the spouse on a joint return, and
// the dependents claimed", in those words, in a comment directly above a line
// that counted a spouse who is not on a joint return. N.Y. Tax Law § 606(b)
// steps the credit by household size; the city's § 11-1706 does the same.
// ---------------------------------------------------------------------------

test('New York and New York City count a widow’s household as one adult', () => {
  const ny = (filingStatus, locality) =>
    stateIncomeTax({
      state: 'NY',
      year: 2026,
      filingStatus,
      locality,
      federal: { adjustedGrossIncome: 22_000, taxableIncome: 12_000 },
      wages: 22_000,
      dependents: 1,
      dependentAges: [20],
    });

  const widow = ny('qualifyingSurvivingSpouse', 'NYC');
  // Two people at $10 after the first: $60 base plus $10, not plus $20.
  money(credit(widow, 'New York household'), 70, 'the state credit');
  money(widow.localTaxes[0].credits.find((c) => c.name.startsWith('New York City household')).amount, 20);
  // $10 of state credit and $10 of city credit on one low-income return.
  money(widow.totalTax, 121.95, 'state and city together');

  // A couple with the same dependent are three people in both engines.
  const couple = ny('marriedFilingJointly', 'NYC');
  money(credit(couple, 'New York household'), 80, 'the joint state credit');
  money(couple.localTaxes[0].credits.find((c) => c.name.startsWith('New York City household')).amount, 30);
});

// ---------------------------------------------------------------------------
// 8. Michigan's cities — the second engine, caught by asking it the same question
//
// The city ordinances allow one exemption per filer, one for a spouse on a
// joint return, one per dependent. Michigan's own MI-1040 has no surviving
// spouse status — single, married filing jointly, married filing separately —
// so the city return underneath it cannot have one either.
// ---------------------------------------------------------------------------

test('Detroit does not give a widow a second $600 exemption', () => {
  const detroit = (filingStatus) =>
    stateIncomeTax({
      state: 'MI',
      year: 2026,
      filingStatus,
      city: 'DETROIT',
      federal: { adjustedGrossIncome: 60_000 },
      wages: 60_000,
      dependents: 1,
      dependentAges: [10],
    }).localTaxes[0].tax;
  // $600 of city exemption at Detroit's 2.4% resident rate is $14.40. The CITY
  // tax alone, because the state tax above it differs between these statuses
  // for reasons that are Michigan's and not Detroit's.
  money(detroit('qualifyingSurvivingSpouse'), 1_411.2, 'the widow’s Detroit tax');
  money(detroit('qualifyingSurvivingSpouse') - detroit('marriedFilingJointly'), 14.4, 'one exemption');
  money(detroit('qualifyingSurvivingSpouse'), detroit('single'), 'a widow and a single filer');
});

// ---------------------------------------------------------------------------
// 9, 10 and 11. Three rules that read a person who is not there
//
// Utah's retirement credit is "$450 for the claimant and $450 for the
// claimant's spouse" — § 59-10-1019(2). The retirement split and military
// retired pay read `retirement.spouse`. Each of the three needs a caller who
// supplies spouse-shaped input, and the whole suite had none.
// ---------------------------------------------------------------------------

test('Utah gives a widow one $450 retirement credit, not two', () => {
  const utah = (filingStatus) =>
    stateIncomeTax({
      state: 'UT',
      year: 2026,
      filingStatus,
      federal: {
        adjustedGrossIncome: 30_000,
        taxableIncome: 30_000,
        socialSecurityBenefits: 0,
        deduction: 23_625,
      },
      filerAge: 74,
      spouseAge: 74,
      dependents: 1,
      dependentAges: [10],
    });
  money(credit(utah('qualifyingSurvivingSpouse'), 'Utah retirement credit'), 450);
  money(credit(utah('marriedFilingJointly'), 'Utah retirement credit'), 900);
});

test('Georgia excludes ONE person’s military retired pay on a widow’s return', () => {
  const georgia = (filingStatus, retirement) =>
    stateIncomeTax({
      state: 'GA',
      year: 2026,
      filingStatus,
      federal: { adjustedGrossIncome: 70_000 },
      filerAge: 55,
      spouseAge: 55,
      dependents: 1,
      dependentAges: [10],
      retirement,
    });
  const both = {
    filer: { militaryRetirement: 35_000 },
    spouse: { militaryRetirement: 35_000 },
  };
  const widow = georgia('qualifyingSurvivingSpouse', both);
  money(widow.totalTax, 1_621.75, 'one $17,500 military exclusion, not two');
  // The claim, stated as an invariant rather than as a number: the spouse half
  // of the split describes nobody, so removing it changes nothing.
  money(
    widow.totalTax,
    georgia('qualifyingSurvivingSpouse', { filer: { militaryRetirement: 35_000 } }).totalTax,
    'retirement.spouse still moved a widow’s answer',
  );
  // And a couple who both served keep both exclusions, worth $873.25 of Georgia
  // tax — the size of what she had been given.
  money(georgia('marriedFilingJointly', both).totalTax, 0, 'a couple who both served');
  money(
    georgia('marriedFilingJointly', { filer: { militaryRetirement: 35_000 } }).totalTax,
    873.25,
    'a joint return still reads retirement.spouse',
  );
});

test('a widow’s pension exclusion is claimed once, per LIVING person', () => {
  const md = (retirement) =>
    stateIncomeTax({
      state: 'MD',
      year: 2026,
      filingStatus: 'qualifyingSurvivingSpouse',
      federal: { adjustedGrossIncome: 80_000 },
      filerAge: 68,
      spouseAge: 68,
      retirement,
    });
  // Maryland's exclusion is per person and this return has one person on it, so
  // a spouse's $40,000 of pension can neither be excluded nor claim a second
  // allowance. The invariant is that supplying it does nothing at all.
  money(
    md({ filer: { employerPlanPension: 40_000 }, spouse: { employerPlanPension: 40_000 } }).totalTax,
    md({ filer: { employerPlanPension: 40_000 } }).totalTax,
    'a dead spouse claimed a Maryland pension exclusion',
  );
});

// ---------------------------------------------------------------------------
// The result says what it dropped
//
// Every one of the fourteen took a caller who supplied a spouse-shaped field,
// so the caller about to be surprised by the new answer is precisely the caller
// who was getting the wrong one. Dropping the field errs towards MORE tax in
// every case, which is why it is safe to do silently and still worth not doing
// silently.
// ---------------------------------------------------------------------------

test('the result tells a caller that spouse-shaped input was ignored', () => {
  const note = (input) =>
    stateIncomeTax({
      state: 'VA',
      year: 2026,
      filingStatus: 'qualifyingSurvivingSpouse',
      federal: { adjustedGrossIncome: 40_000 },
      ...input,
    }).notes.find((n) => n.includes('ONE-PERSON return'));

  assert.ok(note({ filerAge: 70, spouseAge: 70 })?.includes('spouseAge'), 'spouseAge');
  assert.ok(
    note({ retirement: { filer: {}, spouse: { employerPlanPension: 1 } } })?.includes(
      'retirement.spouse',
    ),
    'retirement.spouse',
  );
  assert.ok(note({ blindOrDisabled: 2 })?.includes('blindOrDisabled'), 'blindOrDisabled');
  // Not on a return that supplied none of them, and never on another status.
  assert.equal(note({ filerAge: 70 }), undefined, 'a clean widow return');
  assert.equal(
    stateIncomeTax({
      state: 'VA',
      year: 2026,
      filingStatus: 'marriedFilingJointly',
      federal: { adjustedGrossIncome: 40_000 },
      filerAge: 70,
      spouseAge: 70,
    }).notes.find((n) => n.includes('ONE-PERSON return')),
    undefined,
    'a joint return',
  );
});

// ---------------------------------------------------------------------------
// The structural guard: a name is only a defence while it stays rare
//
// `claimedFilerCount` answers "which column of a form is this status in", and
// that question has exactly two askers left — Maryland's and Ohio's stepped
// exemption (which then override it through `filersClaimed`) and California's
// personal exemption credit, where Form 540 line 7 says "If you checked box 2
// or 5, enter 2" in words.
//
// This test exists because the previous two fixes to this status were each
// written as a fix to one call site, and the thing that actually needed fixing
// was how easy the wrong helper was to reach. A count is a weak check and it is
// the right one: it cannot say a new call site is wrong, only that a human has
// to look at it.
// ---------------------------------------------------------------------------

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'esm');
const callSites = (file) =>
  readFileSync(resolve(dist, file), 'utf8')
    .split('\n')
    .filter((line) => line.includes('claimedFilerCount(')).length;

test('claimedFilerCount has exactly two call sites, both reading an exemption', () => {
  assert.equal(callSites('engine.js'), 2, 'a new caller of claimedFilerCount needs a form read');
  assert.equal(
    callSites('localities/engine.js'),
    0,
    'no local rule turns on which column a state put a status in',
  );
});

// ---------------------------------------------------------------------------
// The same helper, the OTHER status, the OPPOSITE direction
//
// PA-40 Schedule SP's three claimant boxes are unmarried, separated and
// married, and they do not line up with filing statuses in either direction.
// One helper mapped five statuses onto them and got TWO wrong, in opposite
// directions — which is the clearest argument in this package for naming a
// helper after the question rather than after the shape of its answer.
//
// A widow was given the MARRIED allowance. A married claimant filing
// SEPARATELY was given the unmarried one, and Pennsylvania has no
// separate-return table at all: "married claimants are not dependents of one
// another for Tax Forgiveness purposes, even when one spouse does not have any
// Eligibility Income. Each must use the Joint Eligibility Income and
// Eligibility Income Table 2."
//
// So the allowance and the income move together, and taking one without the
// other is worse than taking neither: a $13,000 allowance against one spouse's
// income forgives a two-earner couple twice over. The spouse's eligibility
// income is on no line of a separate return, so the engine asks for it rather
// than assuming it — and stays on the smaller allowance, which is too much tax,
// until it is answered.
// ---------------------------------------------------------------------------

test('Pennsylvania has no separate-return forgiveness table', () => {
  const pa = (extra) =>
    stateIncomeTax({
      state: 'PA',
      year: 2026,
      filingStatus: 'marriedFilingSeparately',
      federal: { adjustedGrossIncome: 20_000 },
      wages: 20_000,
      pennsylvaniaTaxableIncome: 20_000,
      dependents: 1,
      dependentAges: [10],
      ...extra,
    });

  // Unanswered: Table 1, $6,500 + $9,500, and $20,000 is past the end of the
  // staircase. That is the whole Pennsylvania bill and it is the SAFE error.
  money(pa({}).totalTax, 614, 'the smaller allowance is kept until the spouse figure arrives');
  assert.ok(
    pa({}).notes.some((n) => n.includes('no separate-return') && n.includes('$614.00')),
    'the note has to price what is being withheld',
  );

  // Answered with the answer for a spouse with no income. $13,000 + $9,500 is
  // $22,500 and $20,000 is inside it, so the whole tax is forgiven.
  money(pa({ pennsylvaniaSpouseEligibilityIncome: 0 }).totalTax, 0, 'Table 2');
  assert.equal(
    pa({ pennsylvaniaSpouseEligibilityIncome: 0 }).notes.some((n) => n.includes('no separate-return')),
    false,
    'the note is gone once the question is answered',
  );

  // And answered with a real spouse income, the bigger allowance buys nothing:
  // $30,000 of joint eligibility income is thirty steps past $22,500. This is
  // the case that makes the pair a pair — the allowance alone would have
  // forgiven her.
  money(pa({ pennsylvaniaSpouseEligibilityIncome: 10_000 }).totalTax, 614, 'joint income too');

  // A SEPARATED claimant — living apart for the whole of the last six months,
  // or under a written agreement — ticks the Unmarried oval on line 19a of the
  // PA-40 and really is one claimant on their own income. The spouse figure is
  // ignored, because there is no married claimant to attach it to.
  money(pa({ separatedFromSpouse: true }).totalTax, 614, 'a separated claimant');
  money(
    pa({ separatedFromSpouse: true, pennsylvaniaSpouseEligibilityIncome: 0 }).totalTax,
    614,
    'and a separated claimant is not moved by the spouse figure',
  );
});

// ---------------------------------------------------------------------------
// One rule, two engines, and only one of them read the instruction
//
// § 606(b) measures the household credit on "household gross income" — "the
// aggregate adjusted gross income of all members of the household … as
// reported for FEDERAL income tax purposes" — and the IT-201 instructions turn
// that into a line number: "For most taxpayers, federal adjusted gross income
// is the amount from Form IT-201, line 19." Line 19 is the federal figure and
// line 33 is New York's own.
//
// The same note covers the CITY tables 4 to 6 as well as the state tables 1 to
// 3, and the locality engine had it right from the day it was written — its
// parameter is literally named `federalAgi`. The state engine passed line 33.
// So one rule was implemented twice in one package, correctly and incorrectly,
// and nothing in 513 tests compared the two.
// ---------------------------------------------------------------------------

test('the New York household credit is measured on FEDERAL adjusted gross income', () => {
  // The same household gross income, arranged so that New York's own AGI is far
  // below the credit's ceiling and the federal figure is far above it. New York
  // excludes $20,000 of pension a person and the whole Social Security benefit,
  // so a couple with $94,000 of federal AGI reach a New York AGI of $20,000.
  const retired = (state) =>
    stateIncomeTax({
      state,
      year: 2026,
      filingStatus: 'marriedFilingJointly',
      federal: { adjustedGrossIncome: 94_000, taxableIncome: 94_000, socialSecurityBenefits: 40_000 },
      filerAge: 70,
      spouseAge: 70,
      taxableSocialSecurity: 34_000,
      retirement: {
        filer: { employerPlanPension: 30_000, socialSecurityBenefits: 20_000 },
        spouse: { employerPlanPension: 30_000, socialSecurityBenefits: 20_000 },
      },
    });
  money(credit(retired('NY'), 'New York household'), 0, 'a $94,000 household is not low-income');

  // And the credit is still there for a household whose FEDERAL income is
  // genuinely inside the ceiling, so this is the measure changing rather than
  // the credit going away.
  const low = stateIncomeTax({
    state: 'NY',
    year: 2026,
    filingStatus: 'marriedFilingJointly',
    federal: { adjustedGrossIncome: 20_000, taxableIncome: 4_000 },
    wages: 20_000,
  });
  money(credit(low, 'New York household'), 75, 'two people at $60 base plus $15');

  // The two engines now agree about the same household, which is the property
  // that was missing rather than either number on its own.
  const both = (federalAgi) => {
    const r = stateIncomeTax({
      state: 'NY',
      year: 2026,
      locality: 'NYC',
      filingStatus: 'marriedFilingJointly',
      federal: { adjustedGrossIncome: federalAgi, taxableIncome: 4_000 },
      wages: federalAgi,
      stateSubtractions: Math.max(0, federalAgi - 20_000),
    });
    return [
      credit(r, 'New York household') > 0,
      r.localTaxes[0].credits.some((c) => c.name.startsWith('New York City household') && c.amount > 0),
    ];
  };
  assert.deepEqual(both(20_000), [true, true], 'inside both ceilings');
  assert.deepEqual(
    both(60_000),
    [false, false],
    'a $40,000 New York subtraction bought a state credit the city refused',
  );
});
