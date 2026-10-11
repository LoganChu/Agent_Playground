// ARIZONA'S STANDARD DEDUCTION STOPPED BEING THE FEDERAL ONE, AND NO FIGURE MOVED.
//
// Day 47. A.R.S. § 43-1041(A) defined the Arizona standard deduction as EQUAL TO
// the federal one from 2019 until Laws 2026, ch. 140 (HB 4168) §§ 16 and 35(A)
// replaced the cross-reference with Arizona's own amounts — $15,750 single and
// separate, $23,625 head of household, $31,500 joint — retroactively, for taxable
// years beginning from and after December 31, 2024. § 43-1041(H) then indexes them
// "in the same manner in which the federal basic standard deduction is adjusted for
// inflation pursuant to section 63", and because the 2025 bases were made equal the
// 2026 amounts come out equal to the federal ones too.
//
// ## Why this file exists, which is not the same as why the change was made
//
// The answers are identical either way. Arizona's figures equal the federal ones in
// both supported years, so `deduction: { kind: 'federal' }` kept producing the right
// number after the statute stopped saying so — and nothing in this repository would
// have noticed the day that ended.
//
// **THE RULE: A NUMBER THAT IS RIGHT FOR THE WRONG REASON HAS NO GUARD ON IT.** The
// only instrument that could see the difference is the one that moves the federal
// figure and watches the tax (`federal-conformity.test.js`), and it could only see it
// AFTER the declaration changed. Before that it reported Arizona as one of five
// states passing the federal deduction through, which was true of the code and had
// stopped being true of Arizona.
//
// ## And the cross-reference was wrong about something while it lasted
//
// `kind: 'federal'` returns `federal.deduction` — the deduction the filer ACTUALLY
// TOOK, which for anyone aged 65 or over or blind includes the § 63(f) addition.
// Arizona's table is flat per filing status. So this package was TOO LOW for every
// elderly or blind Arizona filer, and the 7,750-row pin sweep could not see it:
// `status-households.mjs` builds its federal basis from
// `FEDERAL_STANDARD_DEDUCTION[year][filingStatus]`, with no age term, so its
// households aged 71, 72, 73, 74, 82 and 100 all carry a 40-year-old's deduction.
//
// **THE RULE: a fixture that builds its own federal basis cannot test a claim about
// the federal basis.** Day 46's circular fixture supplied a wrong figure; this one
// supplies a shape too simple to contain the defect.
//
// The equality between Arizona's table and the federal BASIC amount is a
// cross-package claim and is checked in `tools/cross-package/arizona-deduction.mjs`,
// which runs both engines. What is checked here is everything one package can see.
import assert from 'node:assert/strict';
import test from 'node:test';

import { FILING_STATUSES, getStateDefinition, roundCents, stateIncomeTax } from './strict.mjs';

const RATE = 0.025;
const YEARS = [2025, 2026];

/** The amounts § 43-1041(A) carries, as amended. */
const STATUTORY = {
  2025: {
    single: 15_750,
    marriedFilingSeparately: 15_750,
    headOfHousehold: 23_625,
    marriedFilingJointly: 31_500,
  },
  2026: {
    single: 16_100,
    marriedFilingSeparately: 16_100,
    headOfHousehold: 24_150,
    marriedFilingJointly: 32_200,
  },
};

const basis = (deduction, agi = 100_000) => ({
  adjustedGrossIncome: agi,
  taxableIncome: Math.max(0, agi - deduction),
  deduction,
  deductionKind: 'standard',
});

const az = (year, filingStatus, input = {}) =>
  stateIncomeTax({
    state: 'AZ',
    year,
    filingStatus,
    federal: basis(STATUTORY[year].single),
    ...input,
  });

test('Arizona ships the amounts § 43-1041(A) carries, and declares them as its own', () => {
  for (const year of YEARS) {
    const def = getStateDefinition('AZ', year);
    assert.equal(def.deduction.kind, 'table', `${year}: a table and not a federal cross-reference`);
    for (const [filingStatus, amount] of Object.entries(STATUTORY[year])) {
      assert.equal(def.deduction.amounts[filingStatus], amount, `${year} ${filingStatus}`);
    }
    // No surviving-spouse row on Form 140, so the cell reuses the
    // head-of-household CONSTANT rather than carrying a literal nothing reads.
    assert.equal(
      def.deduction.amounts.qualifyingSurvivingSpouse,
      STATUTORY[year].headOfHousehold,
      `${year}: Arizona has no surviving-spouse box and sends her to head of household`,
    );
    // And a married person filing separately takes the SINGLE amount rather than
    // half the joint one. They are equal here by the statute saying so.
    assert.equal(def.deduction.amounts.marriedFilingSeparately, def.deduction.amounts.single, `${year}`);
  }
});

test('ARIZONA ALLOWS NO § 63(f) ADDITION FOR AGE OR BLINDNESS, which the cross-reference did', () => {
  for (const year of YEARS) {
    const def = getStateDefinition('AZ', year);
    assert.equal(
      def.standardDeductionAgedOrBlindAddition,
      undefined,
      `${year}: Form 140 prints one amount per box, with no age or blindness line`,
    );
  }

  // The defect, priced. These are the amounts the package was understating by
  // while it returned whatever deduction the caller had actually taken.
  const addition = { 2025: { single: 2_000, marriedFilingJointly: 1_600 }, 2026: { single: 2_050, marriedFilingJointly: 1_650 } };
  const worth = (year, filingStatus, elderly) => {
    const basic = STATUTORY[year][filingStatus];
    const extra = addition[year][filingStatus] * elderly;
    const right = stateIncomeTax({ state: 'AZ', year, filingStatus, federal: basis(basic) }).tax;
    const wrong = stateIncomeTax({ state: 'AZ', year, filingStatus, federal: basis(basic + extra) }).tax;
    return Number((right - wrong).toFixed(2));
  };
  assert.equal(worth(2025, 'single', 1), 0, 'fixed: the addition no longer moves Arizona');
  // What it WAS worth, derived rather than quoted: the rate times the addition.
  assert.equal(Number((2_000 * RATE).toFixed(2)), 50.0, 'a single Arizona filer 65 or over, 2025');
  assert.equal(Number((1_600 * 2 * RATE).toFixed(2)), 80.0, 'a couple both 65 or over, 2025');
  assert.equal(Number((2_000 * 2 * RATE).toFixed(2)), 100.0, 'a filer both 65 and blind, 2025');
  assert.equal(Number((2_050 * RATE).toFixed(2)), 51.25, 'a single Arizona filer 65 or over, 2026');
  assert.equal(Number((1_650 * 2 * RATE).toFixed(2)), 82.5, 'a couple both 65 or over, 2026');
});

test('no federal deduction a caller can pass moves an Arizona answer', () => {
  // The strongest form of the claim, and the one that would have failed yesterday:
  // sweep the federal deduction across a wide range and require the Arizona answer
  // to be constant. An itemiser's figure, a surviving spouse's joint figure, the
  // superseded Rev. Proc. 2024-40 figure and zero are all in here.
  for (const year of YEARS) {
    for (const filingStatus of FILING_STATUSES) {
      const answers = new Set(
        [0, 12_000, 15_000, 15_750, 17_750, 23_625, 31_500, 32_200, 48_000, 140_000].map((d) =>
          stateIncomeTax({ state: 'AZ', year, filingStatus, federal: basis(d) }).tax,
        ),
      );
      assert.equal(answers.size, 1, `${year} ${filingStatus}: Arizona reads its own figure, so one answer`);
    }
  }
});

test('the OBBBA increase is INSIDE § 43-1041(A), which is why the $18.75 survived the change', () => {
  // Rev. Proc. 2024-40 § 2.15 indexed 2025 to $15,000 / $30,000 / $22,500 before
  // the Act touched it; OBBBA § 70102 raised it by $750 / $1,500 / $1,125. Arizona
  // used to inherit that increase through the cross-reference. It now carries the
  // post-OBBBA figures in its own statute, so the increase is still worth the same
  // and arrives by a different route.
  const superseded = { single: 15_000, marriedFilingJointly: 30_000, headOfHousehold: 22_500 };
  const increase = { single: 750, marriedFilingJointly: 1_500, headOfHousehold: 1_125 };
  for (const [filingStatus, before] of Object.entries(superseded)) {
    assert.equal(
      STATUTORY[2025][filingStatus],
      before + increase[filingStatus],
      `${filingStatus}: Arizona's own 2025 amount is the POST-OBBBA federal figure`,
    );
  }
  // AND THE TAX IS THE DIFFERENCE OF TWO ANSWERS, NOT A ROUNDED PRODUCT. That
  // distinction cost a cent on Day 46, cost it again in the first draft of this
  // test, and is the reason this is computed rather than written down: at head of
  // household the exact product is $28.125, and rounding it gives $28.13 while
  // the engine reports $28.12.
  const def = getStateDefinition('AZ', 2025);
  const cut = (filingStatus) => {
    const agi = 70_000;
    const before = roundCents((agi - superseded[filingStatus]) * def.rate.rate);
    const after = roundCents((agi - def.deduction.amounts[filingStatus]) * def.rate.rate);
    return roundCents(before - after);
  };
  assert.equal(cut('single'), 18.75);
  assert.equal(cut('marriedFilingJointly'), 37.5);
  assert.equal(cut('headOfHousehold'), 28.12);
  // The two readings, side by side, so the difference cannot be argued away.
  assert.equal(roundCents(1_125 * def.rate.rate), 28.13, 'the rounded PRODUCT, which is not the answer');
  assert.equal(Number((1_125 * def.rate.rate).toFixed(3)), 28.125, 'the exact product');
  // ROUNDING THE SUBTRAHEND UP PUSHES THE DIFFERENCE DOWN, which is the whole of it.
  assert.equal(roundCents((70_000 - 23_625) * def.rate.rate), 1_159.38, 'up from 1,159.375');
  assert.equal(roundCents((70_000 - 22_500) * def.rate.rate), 1_187.5, 'exact, no rounding needed');
});

test("a surviving spouse's Arizona question is CLOSED, and the statute closed it", () => {
  // While § 43-1041(A) pointed at § 63, her return was chosen by two governments:
  // the booklet prints an amount against her BOX (head of household) and
  // § 63(c)(2)(A) gives a surviving spouse the JOINT amount. This package recorded
  // that nobody had read which governs. There is no federal cross-reference left to
  // disagree with, and no surviving-spouse row in Arizona's table.
  const def = getStateDefinition('AZ', 2026);
  assert.equal(def.survivingSpouseFilesAs.filesAs, 'headOfHousehold');

  // She takes the head-of-household amount whatever the caller passes — including
  // the joint figure, which is what the second reading would have given her.
  for (const passed of [24_150, 32_200]) {
    const r = stateIncomeTax({
      state: 'AZ',
      year: 2026,
      filingStatus: 'qualifyingSurvivingSpouse',
      federal: basis(passed),
    });
    assert.equal(r.deduction, 24_150, 'Arizona head of household, 2026');
  }

  // The $201.25 the question was worth, derived from ARIZONA'S OWN table now.
  const gap = def.deduction.amounts.marriedFilingJointly - def.deduction.amounts.headOfHousehold;
  assert.equal(gap, 8_050);
  assert.equal(Number((gap * def.rate.rate).toFixed(2)), 201.25);

  // And the 2025 figure, which is the one the pin sweep moved: 48 rows, every one
  // of them an Arizona surviving spouse, and no other state.
  const def25 = getStateDefinition('AZ', 2025);
  const gap25 = def25.deduction.amounts.marriedFilingJointly - def25.deduction.amounts.headOfHousehold;
  assert.equal(Number((gap25 * def25.rate.rate).toFixed(2)), 196.88);
});

test('the four § 43-1022 subtractions are read off the federal return, and the vehicle one is 2025 only', () => {
  const sources = (year) =>
    getStateDefinition('AZ', year).federalDeductionSubtractions.map((r) => r.source);
  assert.deepEqual(sources(2025), ['tips', 'overtime', 'senior', 'carLoanInterest']);
  // § 43-1022(36) runs "from and after December 31, 2024 through December 31,
  // 2025" while the federal § 163(h)(4) deduction runs to 2028. A state
  // subtraction can expire before the federal deduction it is measured from.
  assert.deepEqual(sources(2026), ['tips', 'overtime', 'senior']);

  // Every one of them is uncapped here, because Arizona follows a federal figure
  // that is already capped and already phased out federally.
  for (const year of YEARS) {
    for (const rule of getStateDefinition('AZ', year).federalDeductionSubtractions) {
      assert.equal(rule.cap, Infinity, `${year} ${rule.source}`);
      assert.match(rule.name, /43-1022/, 'each names its own subsection');
    }
  }

  // And they reach the answer. $6,000 of senior deduction is $150.00 of Arizona tax.
  const without = az(2025, 'single').tax;
  const withSenior = az(2025, 'single', { federalDeductions: { senior: 6_000 } }).tax;
  assert.equal(Number((without - withSenior).toFixed(2)), 150.0);
  assert.equal(Number((12_000 * RATE).toFixed(2)), 300.0, 'a couple both 65 or over, in full');

  // The vehicle loan interest, present in 2025 and gone in 2026.
  const loan = (year) => {
    const plain = stateIncomeTax({ state: 'AZ', year, filingStatus: 'single', federal: basis(STATUTORY[year].single) }).tax;
    const sub = stateIncomeTax({
      state: 'AZ', year, filingStatus: 'single',
      federal: basis(STATUTORY[year].single),
      federalDeductions: { carLoanInterest: 1_000 },
    }).tax;
    return Number((plain - sub).toFixed(2));
  };
  assert.equal(loan(2025), 25.0, '2.5% of $1,000');
  assert.equal(loan(2026), 0, '§ 43-1022(36) sunsets after 2025');
});

test('THE TWO AGE ERRORS POINTED OPPOSITE WAYS, and the net changed SIGN', () => {
  // This is the finding rather than either defect. Arizona had two errors about
  // age, in one state, in opposite directions:
  //
  //   D1  the § 63(f) addition wrongly allowed   — package too LOW,  flat
  //   D2  the § 43-1022(35) senior subtraction   — package too HIGH, a BAND
  //
  // D1 IS NOW A DERIVATION AND NOT A MEASUREMENT, and that is a consequence of
  // fixing it rather than a weakness: the lever is gone. Arizona ignores the
  // federal deduction, so no input to this engine can reproduce the old answer,
  // and the size of the error it used to make can only be computed. D2 is live
  // and is measured.
  const def = getStateDefinition('AZ', 2025);
  const d1 = roundCents(2_000 * def.rate.rate);
  assert.equal(d1, 50.0, 'what the § 63(f) addition used to take off a single 65+ return');

  // D2 at each income, measured by running the engine with the senior deduction
  // the federal rule produces there: $6,000 to $75,000 of MAGI, then 6% of the
  // excess withdrawn, nothing from $175,000.
  const seniorAt = (agi) => Math.max(0, Math.min(6_000, 6_000 - 0.06 * Math.max(0, agi - 75_000)));
  const d2 = (agi) => {
    const plain = stateIncomeTax({
      state: 'AZ', year: 2025, filingStatus: 'single', federal: basis(STATUTORY[2025].single, agi),
    }).tax;
    const withSub = stateIncomeTax({
      state: 'AZ', year: 2025, filingStatus: 'single', federal: basis(STATUTORY[2025].single, agi),
      federalDeductions: { senior: seniorAt(agi) },
    }).tax;
    return roundCents(plain - withSub);
  };
  const net = (agi) => roundCents(d2(agi) - d1);

  assert.equal(d2(40_000), 150.0, 'the full $6,000, at 2.5%');
  assert.equal(d2(100_000), 112.5, 'withdrawn to $4,500');
  assert.equal(d2(200_000), 0, 'gone');

  assert.equal(net(40_000), 100.0, 'too HIGH by $100.00 below the phase-out');
  assert.equal(net(100_000), 62.5, 'and by $62.50 part-way through it');
  assert.equal(net(200_000), -50.0, 'too LOW by $50.00 once the subtraction is gone');

  // The crossover, found by search rather than by arithmetic.
  let lo = 75_000;
  let hi = 175_000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (net(mid) > 0) lo = mid;
    else hi = mid;
  }
  // $141,664, AND THE ALGEBRA SAYS $141,667. Setting 2.5% of the senior
  // deduction equal to $50.00 gives a deduction of $2,000, which the 6%
  // withdrawal reaches at $75,000 + $2,000/0.06 = $141,666.67. The engine
  // crosses three dollars earlier because D2 is a difference of answers rounded
  // to the cent, so it reports exactly $50.00 for a short range of incomes
  // rather than at one point. THIRD TIME IN ONE RUN that a hand derivation and
  // the engine disagreed in the last cent, and the third time the engine was
  // right: see the half-cent above and Day 46's $28.13.
  assert.equal(hi, 141_664, 'the AGI at which the two errors cancelled, measured');
  assert.equal(net(141_663), 0.01, 'still positive the dollar before');
  assert.equal(net(141_664), 0, 'and zero here');

  // AND THE SUBTRACTION IS CAPPED BY THE TAXABLE INCOME LEFT, which is a third
  // shape neither error has: a joint return at $40,000 cannot absorb $12,000 of
  // subtraction, because Arizona taxable income runs out first.
  const joint = (agi, senior) => {
    const plain = stateIncomeTax({
      state: 'AZ', year: 2025, filingStatus: 'marriedFilingJointly', federal: basis(STATUTORY[2025].marriedFilingJointly, agi),
    }).tax;
    const withSub = stateIncomeTax({
      state: 'AZ', year: 2025, filingStatus: 'marriedFilingJointly', federal: basis(STATUTORY[2025].marriedFilingJointly, agi),
      federalDeductions: { senior },
    }).tax;
    return roundCents(plain - withSub);
  };
  assert.equal(joint(100_000, 12_000), 300.0, 'the full $12,000 at 2.5%');
  assert.ok(joint(40_000, 12_000) < 300.0, 'and less than that where the base runs out');
  assert.equal(joint(40_000, 12_000), 212.5, '$8,500 of taxable income is all there was to remove');
});
