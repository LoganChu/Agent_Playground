import assert from 'node:assert/strict';
import test from 'node:test';

import { FILING_STATUSES, YEARS, estimateFederalTax } from '../dist/esm/index.js';

// ---------------------------------------------------------------------------
// Where a qualifying surviving spouse sits, parameter by parameter.
//
// The Internal Revenue Code has a drafting convention and it is completely
// consistent: when Congress wants a surviving spouse to get the joint figure it
// SAYS SO BY NAME, and when it writes "in the case of a joint return" it means
// the return described by § 6013 and nothing else. § 2(a) hands a surviving
// spouse the joint RATE SCHEDULE under § 1(a) and says nothing about any other
// provision, so it cannot be used to carry them into a threshold that does not
// name them.
//
// The two clearest examples of the convention sit next to each other in this
// package, at the same dollar figures, and disagree:
//
//   § 1411(b)    "a joint return under section 6013 OR A SURVIVING SPOUSE
//                 (as defined in section 2(a)), $250,000"      -> joint
//   § 3101(b)(2) "$250,000 in the case of a joint return, ...
//                 and $200,000 in any other case"              -> single
//
// Nothing about a surviving spouse changes between those two sentences. The
// only thing that changes is whether the drafter typed the words.
//
// This table states the grouping for EVERY filing-status-keyed parameter in the
// package, with the phrase it turns on, and the test below enforces three
// things:
//
//   1. each parameter's surviving-spouse figure equals the one its grouping
//      names, in every tax year;
//   2. no parameter is missing from the table — a new status-keyed table cannot
//      be added without someone deciding this question and writing down why;
//   3. no entry is VACUOUS. If the joint and single figures were equal there
//      would be nothing to get wrong and nothing to test, so `joint` and
//      `single` entries must actually discriminate, and `uniform` entries must
//      actually be uniform. This is what stops the table decaying into
//      decoration the first time a figure moves.
//
// Three defects lived behind the absence of this table, all in the same
// direction — the widow was treated as though her spouse were alive, and every
// one of them made her bill too low:
//
//   § 32   earned income credit phase-out start   (found Day 26)
//   § 24   child tax credit phase-out threshold   (found Day 27)
//   § 199A threshold amount and phase-in range    (found Day 27)
//
// Each was ONE FIGURE rather than a branch, which is why twenty-six days of
// tests aimed at features never touched any of them.
// ---------------------------------------------------------------------------

/**
 * `joint`   — the provision names a surviving spouse, or applies § 1(a) to
 *             them, so they take the married-filing-jointly figure.
 * `single`  — the provision splits on "a joint return" alone, so a surviving
 *             spouse falls in "any other case" and takes the single figure.
 * `uniform` — the provision does not distinguish joint from single at all (only
 *             a separate return differs), so the question does not arise.
 */
const GROUPINGS = [
  {
    path: 'ordinaryBrackets',
    grouping: 'joint',
    cite: '§ 1(a)',
    phrase:
      '"every married individual who makes a single return jointly ... and every surviving spouse (as defined in section 2(a))" — the one place the Code puts them in the same sentence as an equal.',
  },
  {
    path: 'standardDeduction',
    grouping: 'joint',
    cite: '§ 63(c)(2)(A)',
    phrase: '"in the case of — (i) a joint return, or (ii) a surviving spouse".',
  },
  {
    path: 'additionalStandardDeduction',
    grouping: 'joint',
    cite: '§ 63(f)(3)',
    phrase:
      '"in the case of an individual who is not married and is not a surviving spouse" the $600 becomes $750 — so a surviving spouse takes the MARRIED amount, which is the SMALLER one. The only parameter here where following the joint column costs the filer money.',
  },
  {
    path: 'additionalMedicareThreshold',
    grouping: 'single',
    cite: '§ 3101(b)(2), § 1401(b)(2)(A)',
    phrase:
      '"$250,000 in the case of a joint return, $125,000 in the case of a married taxpayer filing a separate return, and $200,000 in any other case."',
  },
  {
    path: 'longTermCapitalGains',
    grouping: 'joint',
    cite: '§ 1(j)(5)(B)',
    phrase:
      '"in the case of a joint return or surviving spouse" — named, and Rev. Proc. 2025-32 prints the pair in one row heading.',
  },
  {
    path: 'niit.thresholds',
    grouping: 'joint',
    cite: '§ 1411(b)(1)',
    phrase:
      '"in the case of a taxpayer making a joint return under section 6013 or a surviving spouse (as defined in section 2(a)), $250,000".',
  },
  {
    path: 'scheduleOneA.tips.phaseOut.thresholds',
    grouping: 'single',
    cite: '§ 224(b)(2) (OBBBA § 70201)',
    phrase: '"$150,000 ($300,000 in the case of a joint return)".',
  },
  {
    path: 'scheduleOneA.overtime.cap',
    grouping: 'single',
    cite: '§ 225(b)(1) (OBBBA § 70202)',
    phrase:
      '"$12,500 ($25,000 in the case of a joint return)" — unlike the tips cap, which is not doubled at all.',
  },
  {
    path: 'scheduleOneA.overtime.phaseOut.thresholds',
    grouping: 'single',
    cite: '§ 225(b)(2)',
    phrase: '"$150,000 ($300,000 in the case of a joint return)".',
  },
  {
    path: 'scheduleOneA.senior.phaseOutThreshold',
    grouping: 'single',
    cite: '§ 151(d)(5)(B) (OBBBA § 70103)',
    phrase: '"$75,000 ($150,000 in the case of a joint return)".',
  },
  {
    path: 'scheduleOneA.vehicleLoanInterest.phaseOut.thresholds',
    grouping: 'single',
    cite: '§ 163(h)(4)(D) (OBBBA § 70203)',
    phrase: '"$100,000 ($200,000 in the case of a joint return)".',
  },
  {
    path: 'section199A.thresholdAmount',
    grouping: 'single',
    cite: '§ 199A(e)(2)',
    phrase:
      '"$157,500 (200 percent of such amount in the case of a joint return)". Form 8995 line 12 prints the same split — "Threshold. Enter $201,750 ($403,500 if married filing jointly)" — and Rev. Proc. 2025-32 gives this provision three rows: joint, separate, and all other returns. A surviving spouse is an other return.',
  },
  {
    path: 'section199A.phaseInRange',
    grouping: 'single',
    cite: '§ 199A(b)(3)(B)(i)(I), (d)(3)(A) (as amended by OBBBA § 70105(b))',
    phrase:
      '"$75,000 ($150,000 in the case of a joint return)" from 2026; "$50,000 ($100,000 ...)" before it. The amendment restated the parenthetical rather than removing it, so the grouping is unchanged across all three years here.',
  },
  {
    path: 'saltCap.cap',
    grouping: 'uniform',
    cite: '§ 164(b)(6)(B) (as amended by OBBBA § 70120)',
    phrase:
      'the only split is "in the case of a married individual filing a separate return", which halves it. Joint and single are the same figure, so a surviving spouse cannot be placed wrongly.',
  },
  {
    path: 'saltCap.phaseDownThreshold',
    grouping: 'uniform',
    cite: '§ 164(b)(6)(B)(ii)',
    phrase: 'halved for a separate return only.',
  },
  {
    path: 'saltCap.floor',
    grouping: 'uniform',
    cite: '§ 164(b)(6)(B)',
    phrase: 'halved for a separate return only.',
  },
  {
    path: 'childTaxCredit.phaseOut.thresholds',
    grouping: 'single',
    cite: '§ 24(b)(2)',
    phrase:
      '"$400,000 in the case of a joint return, and $200,000 in any other case." Schedule 8812 line 9 puts it in two lines — "Married filing jointly—$400,000" and "All other filing statuses—$200,000" — and the instructions enumerate qualifying surviving spouse among the latter. Note the separate return is NOT halved here, which is unusual and is why this table cannot be derived from any other.',
  },
  {
    path: 'earnedIncomeCredit.table[].phaseOutStart',
    grouping: 'single',
    cite: '§ 32(b)(2)(B)',
    phrase:
      'the phaseout amount is increased "in the case of a joint return". Rev. Proc. 2025-32 prints the grouping in its own row heading: "Threshold Phaseout Amount (Single, Surviving Spouse, or Head of Household)", against a separate row for married filing jointly.',
  },
  {
    path: 'socialSecurity.baseAmount',
    grouping: 'single',
    cite: '§ 86(c)(1)',
    phrase:
      '"$32,000, in the case of a joint return" against a $25,000 base amount otherwise. § 86 knows only a joint return, a separate return, and everyone else.',
  },
  {
    path: 'socialSecurity.adjustedBaseAmount',
    grouping: 'single',
    cite: '§ 86(c)(2)',
    phrase: '"$44,000, in the case of a joint return" against $34,000 otherwise.',
  },
];

const BY_PATH = new Map(GROUPINGS.map((entry) => [entry.path, entry]));

const STATUS_KEYS = new Set(FILING_STATUSES);

/** True when `node` is one of the five-key `Record<FilingStatus, ...>` tables. */
function isStatusTable(node) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return false;
  const keys = Object.keys(node);
  return keys.length === STATUS_KEYS.size && keys.every((key) => STATUS_KEYS.has(key));
}

/**
 * Every status-keyed table in a year's parameters, as `[path, table]`.
 *
 * Array indices collapse to `[]`, so the four rows of the earned income credit
 * table are one entry rather than four. A fifth child band would otherwise need
 * a fifth line in `GROUPINGS` to say the same thing a fifth time.
 */
function statusTables(node, path = '', found = []) {
  if (node === null || typeof node !== 'object') return found;
  if (isStatusTable(node)) {
    found.push([path, node]);
    return found;
  }
  for (const [key, value] of Object.entries(node)) {
    const step = Array.isArray(node) ? '[]' : path ? `.${key}` : key;
    statusTables(value, Array.isArray(node) ? `${path}${step}` : `${path}${step}`, found);
  }
  return found;
}

test('every status-keyed parameter in every year appears in GROUPINGS', () => {
  for (const [year, parameters] of Object.entries(YEARS)) {
    for (const [path] of statusTables(parameters)) {
      assert.ok(
        BY_PATH.has(path),
        `${year}: ${path} is keyed by filing status and is not in GROUPINGS. ` +
          'Read the operative sentence of the statute, decide where a qualifying ' +
          'surviving spouse falls, and add a line saying which phrase settled it.',
      );
    }
  }
});

test('no GROUPINGS entry describes a parameter that no longer exists', () => {
  const live = new Set();
  for (const parameters of Object.values(YEARS)) {
    for (const [path] of statusTables(parameters)) live.add(path);
  }
  for (const { path } of GROUPINGS) {
    assert.ok(live.has(path), `GROUPINGS names ${path}, which is in no year's parameters.`);
  }
});

test('a qualifying surviving spouse takes the figure its statute groups them with', () => {
  for (const [year, parameters] of Object.entries(YEARS)) {
    for (const [path, table] of statusTables(parameters)) {
      const entry = BY_PATH.get(path);
      const expected =
        entry.grouping === 'joint' ? table.marriedFilingJointly : table.single;
      assert.deepEqual(
        table.qualifyingSurvivingSpouse,
        expected,
        `${year} ${path}: a qualifying surviving spouse should take the ` +
          `${entry.grouping === 'joint' ? 'married-filing-jointly' : 'single'} ` +
          `figure. ${entry.cite}: ${entry.phrase}`,
      );
    }
  }
});

test('no entry is vacuous: joint and single differ wherever the grouping is a choice', () => {
  for (const [year, parameters] of Object.entries(YEARS)) {
    for (const [path, table] of statusTables(parameters)) {
      const { grouping, cite } = BY_PATH.get(path);
      const same =
        JSON.stringify(table.marriedFilingJointly) === JSON.stringify(table.single);
      if (grouping === 'uniform') {
        assert.ok(
          same,
          `${year} ${path} is marked uniform but its joint and single figures ` +
            `differ. ${cite} now makes this a real choice: decide which side a ` +
            'surviving spouse is on and change the grouping.',
        );
      } else {
        assert.ok(
          !same,
          `${year} ${path} is marked "${grouping}" but its joint and single ` +
            'figures are equal, so the assertion above proves nothing. Either ' +
            `${cite} stopped distinguishing them — in which case this is ` +
            'uniform — or a figure was typed wrong.',
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// The head of household is the other status that gets sorted by these same
// sentences, and it is sorted the same way for a different reason: a head of
// household is unmarried, so "any other case" plainly reaches them. Asserting
// it here is nearly free and it catches a figure typed into the wrong column,
// which is the failure mode that produced all three defects above.
//
// The exceptions are the four provisions that give a head of household a band
// of their own, which no amount of reasoning about joint returns can predict.
// ---------------------------------------------------------------------------

const HEAD_OF_HOUSEHOLD_HAS_ITS_OWN_FIGURE = new Set([
  'ordinaryBrackets', // § 1(b) — its own rate schedule.
  'standardDeduction', // § 63(c)(2)(B) — 150% of the single amount.
  'longTermCapitalGains', // § 1(j)(5)(B) — its own breakpoints.
  'additionalStandardDeduction', // § 63(f)(3) — unmarried, so the LARGER $750.
]);

test('a head of household takes the single figure wherever the split is "a joint return"', () => {
  for (const [year, parameters] of Object.entries(YEARS)) {
    for (const [path, table] of statusTables(parameters)) {
      if (HEAD_OF_HOUSEHOLD_HAS_ITS_OWN_FIGURE.has(path)) continue;
      const { cite } = BY_PATH.get(path);
      assert.deepEqual(
        table.headOfHousehold,
        table.single,
        `${year} ${path}: ${cite} splits on a joint return, and a head of ` +
          'household does not file one.',
      );
    }
  }
});

// ---------------------------------------------------------------------------
// What the three defects were worth, on whole returns.
//
// The assertions above are about parameters, and a parameter test can only ever
// say that one number equals another. These say what the numbers DO.
//
// Each one carries the answer v0.10.0 gave for the same household as a
// commented literal. That figure is NOT recomputed — it cannot be, because the
// code that produced it is gone — and that is the point: a historical claim
// recomputed with today's engine is not history, it is today's answer wearing a
// date. (Day 26 learned that from a Mississippi figure in the README.)
// ---------------------------------------------------------------------------

const widow = (input) =>
  estimateFederalTax({ ...input, filingStatus: 'qualifyingSurvivingSpouse' });
const couple = (input) =>
  estimateFederalTax({ ...input, filingStatus: 'marriedFilingJointly' });

test('§ 24: a widow with two children and $300,000 of wages loses the whole credit', () => {
  const r = widow({ year: 2026, w2Wages: 300_000, qualifyingChildren: 2 });

  // $300,000 is $100,000 over her threshold: 100 increments of $50 is $5,000,
  // which is more than the $4,400 two children are worth.
  assert.equal(r.credits.childTaxCredit.phaseOutThreshold, 200_000);
  assert.equal(r.credits.childTaxCredit.excessIncome, 100_000);
  // 100 increments of $50 is $5,000 of reduction, reported capped at the
  // $4,400 there was to reduce.
  assert.equal(r.credits.childTaxCredit.phaseOutReduction, 4_400);
  assert.equal(r.credits.childTaxCredit.creditAfterPhaseOut, 0);
  assert.equal(r.totalTax, 50_368); // v0.10.0: $45,968.00 — $4,400.00 too low

  // The couple is $100,000 UNDER theirs and keeps all of it. Same income, same
  // children, same brackets, same standard deduction.
  assert.equal(couple({ year: 2026, w2Wages: 300_000, qualifyingChildren: 2 })
    .credits.childTaxCredit.creditAfterPhaseOut, 4_400);
});

test('§ 24: the error was the full credit in every year, and grew with the family', () => {
  const credit = (input) => widow(input).credits.childTaxCredit.creditAfterPhaseOut;

  // The old threshold put every one of these households in the clear.
  assert.equal(credit({ year: 2024, w2Wages: 300_000, qualifyingChildren: 2 }), 0); // was $4,000
  assert.equal(credit({ year: 2025, w2Wages: 300_000, qualifyingChildren: 2 }), 0); // was $4,400
  assert.equal(credit({ year: 2026, w2Wages: 410_000, qualifyingChildren: 3 }), 0); // was $6,100

  // Inside the phase-out band it is a partial loss rather than a total one.
  assert.equal(credit({ year: 2026, w2Wages: 250_000, qualifyingChildren: 2 }), 1_900); // was $4,400
});

test('§ 24: a widow under $200,000 was never affected, which is why nobody saw it', () => {
  const at = (w2Wages) =>
    widow({ year: 2026, w2Wages, qualifyingChildren: 2 }).credits.childTaxCredit
      .creditAfterPhaseOut;

  // The differential grid has filed a surviving spouse since Day 26. She earns
  // $45,000, and at $45,000 the old threshold and the right one give the same
  // answer — so the grid could not have found this however long it ran.
  // WIDENING A GRID FINDS WHAT THE NEW CASE REACHES, NOT WHAT IT IS CALLED.
  assert.equal(at(45_000), 4_400);
  assert.equal(at(199_000), 4_400);
  assert.equal(at(201_000), 4_350);
});

test('§ 199A: a widowed consultant was undercharged $12,650.98 in one year', () => {
  // A specified service trade or business — consulting, law, medicine — loses
  // the deduction almost entirely once taxable income clears the threshold plus
  // the phase-in range. On the joint threshold this filer was nowhere near it.
  const household = {
    year: 2026,
    selfEmploymentNetProfit: 300_000,
    qualifyingChildren: 1,
    qualifiedBusinesses: [
      {
        name: 'consulting',
        // Net of the deductible half of SE tax, as § 199A requires.
        qualifiedBusinessIncome: 289_400,
        w2Wages: 0,
        isSpecifiedServiceTradeOrBusiness: true,
      },
    ],
  };

  const r = widow(household);
  assert.equal(r.section199A.thresholdAmount, 201_750);
  assert.equal(r.section199A.phaseInRange, 75_000);
  // $6,129.25 rather than nothing because § 199A(i) floors an active business
  // at $400 and the SSTB percentage has not quite run out.
  assert.equal(r.qualifiedBusinessIncomeDeduction, 6_129.25); // v0.10.0: $50,468.75
  assert.equal(r.totalTax, 75_893.38); // v0.10.0: $63,242.40

  // $12,650.98 on one return — the § 199A threshold, the § 199A range and the
  // § 24 threshold, all wrong, all on the same household. Nearly eleven times
  // the $1,161.75 the § 32 defect was worth on Day 26, and in the same
  // direction: the widow's bill was too low.
  assert.equal(+(75_893.38 - 63_242.40).toFixed(2), 12_650.98);
});

test('§ 199A: the phase-in range was wrong too, and it bites where the threshold does not', () => {
  // A NON-service business with no employees, in 2024. Two separate errors on
  // one return: the old code had this filer below the threshold entirely, and
  // even at the right threshold a $100,000 range would take back half as much
  // as the statutory $50,000 one does.
  const r = widow({
    year: 2024,
    selfEmploymentNetProfit: 260_000,
    qualifiedBusinesses: [
      { name: 'contracting', qualifiedBusinessIncome: 250_600, w2Wages: 0 },
    ],
  });
  assert.equal(r.section199A.thresholdAmount, 191_950);
  assert.equal(r.section199A.phaseInRange, 50_000);
  assert.equal(r.qualifiedBusinessIncomeDeduction, 25_145); // v0.10.0: $43,373.04
  assert.equal(r.totalTax, 60_515.02); // v0.10.0: $54,504.86
});

// ---------------------------------------------------------------------------
// The negative half of the claim, and the harder one: nothing ELSE differs.
//
// It would be easy to write this as "a widow and a couple at the same income
// pay the same tax" and it would be false — five provisions separate them on
// purpose, and the whole subject of this file is which. So the test states the
// gap and DECOMPOSES it, which is the only form of the claim that can fail for
// the right reason.
// ---------------------------------------------------------------------------

test('a widow and a couple pay the same tax where no provision splits them', () => {
  for (const year of [2024, 2025, 2026]) {
    const household = { year, w2Wages: 120_000 };
    // Brackets (§ 1(a)) and the standard deduction (§ 63(c)(2)(A)) both name a
    // surviving spouse, and at $120,000 nothing else is in range.
    assert.equal(widow(household).totalTax, couple(household).totalTax);
  }
});

test('and where provisions do split them, the gap is exactly those provisions', () => {
  // Wages only, two children, $300,000. Two named provisions are in range and
  // nothing else is.
  const wages = { year: 2026, w2Wages: 300_000, qualifyingChildren: 2 };
  const childTaxCredit = 4_400; // § 24(b)(2): $200,000 against $400,000
  const additionalMedicare = 0.009 * (250_000 - 200_000); // § 3101(b)(2)
  assert.equal(
    +(widow(wages).totalTax - couple(wages).totalTax).toFixed(2),
    childTaxCredit + additionalMedicare,
  );

  // A retiree with a $40,000 benefit and $30,000 of other income. Here the only
  // provision in range is § 86, whose base amount groups a surviving spouse
  // with single — so $7,000 more of her benefit is taxable, in the 10% bracket.
  const retiree = { year: 2026, socialSecurityBenefits: 40_000, otherOrdinaryIncome: 30_000, age: 67 };
  const extraTaxableBenefit =
    widow(retiree).socialSecurity.taxableBenefits - couple(retiree).socialSecurity.taxableBenefits;
  assert.equal(extraTaxableBenefit, 7_000);
  assert.equal(
    +(widow(retiree).totalTax - couple(retiree).totalTax).toFixed(2),
    +(extraTaxableBenefit * 0.1).toFixed(2),
  );
});
