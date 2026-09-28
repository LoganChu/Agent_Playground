// The frozen household battery the status sweep runs, shared by the test and its
// regenerator so the two cannot drift.
//
// ## Why these households and not others
//
// Day 33's rule: **a test whose household is read out of the parameter is blind to
// the parameter.** So every figure below is a constant. Nothing here is derived
// from a state's table, which means doubling any state parameter moves an answer
// instead of moving the probe with it.
//
// The second rule they are built for is the one Day 33 found in the state package:
// **a `byStatus` table is tested by the statuses somebody filed, and nobody files
// separately.** Married-filing-separately and head-of-household carry their own
// numbers in nearly every state here and are the two statuses a test author reaches
// for last. The sweep removes the choice: every household runs under all five.
//
// ## Why there are this many, which is the one piece of arithmetic in the file
//
// A mutation sets a parameter `P` to `2P + 1`. A threshold only changes an answer
// when the household sits **between** the two values, so a household catches `P`
// only if its income is in `(P, 2P + 1]`. One household therefore catches almost
// nothing: the battery has to be a LADDER.
//
// A geometric ladder of ratio `r` catches every threshold it spans, and `r = 2` is
// exactly enough. Take probes `p₀ < p₁ < …` with `pᵢ₊₁ = 2pᵢ`. For any `P` inside
// the ladder's span there is an `i` with `pᵢ ≤ P < pᵢ₊₁`. Then `pᵢ₊₁ > P`, and
// `pᵢ₊₁ = 2pᵢ ≤ 2P`, so `pᵢ₊₁` lands in `(P, 2P + 1]` and catches it. Any ratio
// above 2 leaves gaps; any ratio below 2 buys nothing.
//
// **THE RULE: a doubling mutation is caught by a doubling ladder, and the number of
// households a suite needs is therefore logarithmic in the range of incomes the
// law covers — not linear in the number of parameters.** Ten rungs from $3,000 to
// $1,600,000 is the whole of it, which is why this battery is sixteen households
// and not five hundred.
//
// The rungs have to exist separately in each KIND of income, because a threshold
// on pension income is not reached by a wage. So the ladder is run three times —
// wages, a family with dependents, a retirement — plus the shapes below that exist
// for one cell each.
//
//   wage8k        the bottom of New York's household-credit staircase.
//   wage20k       above Massachusetts's No Tax Status and inside its Limited
//                 Income Credit — the band between a floor and 1.75 times it.
//   low14k5       under every floor. Tax forgiveness and the zero-tax thresholds.
//   wage62k       an ordinary return. The baseline every state answers.
//   wage540k      inside California's exemption-credit phase-out on a JOINT
//                 return ($504,411) and above Illinois's joint exemption cliff
//                 ($500,000) — a band no single filer's household can reach,
//                 because a single filer is already past the top of both.
//   family38k     dependents, rent, a federal earned income credit — the state
//                 EITC matches, the child credits, the renter's and household
//                 credits, the poverty-level credits.
//   family62k     Utah's child credit phase-out.
//   family90k     New York's child credit on a SEPARATE return ($55,000), which
//                 is the lowest of its three thresholds and the one no joint
//                 household reaches.
//   family130k    New York's joint child-credit threshold and the first step of
//                 Maryland's exemption staircase.
//   retired70     two people over 65 with a pension and a benefit. The senior
//                 credits, the pension and retirement exclusions, and the
//                 § 151(b) spouse exemption on a separate return.
//   retired80k    Virginia's age-deduction thresholds, Michigan's single
//                 retirement cap, New Jersey's separate exclusion, and Utah's
//                 Social Security Benefits Credit threshold.
//   retired180k   the income LIMITS on the senior credits — Maryland's and
//                 Ohio's — which a poor retiree cannot reach, because a credit
//                 you already qualify for does not notice its own ceiling
//                 moving up.
//   retiredCode18 born before 1953, a pension, and NO Social Security. The only
//                 household in the package that can elect Utah's code 18, which
//                 § 59-10-1019(5) makes unavailable to everyone else.
//   high420k      an itemizer with capital gains. The itemized-deduction limits,
//                 the exemption phase-outs, the AGI limits, the top bands.
//   veryHigh1m4   Massachusetts's surtax, Maryland's capital-gains surtax, and the
//                 rates above $1,000,000 that nobody writes a household for.
//   business420k  above Ohio's business-income deduction cap. It has to be ABOVE
//                 it: at exactly the cap the deduction is the whole of the income
//                 either way, so a household AT a cap cannot see the cap.
//
// ## The federal figures are inputs, not claims
//
// Every household supplies a `federal` basis because that is what a state engine
// consumes. The standard deduction table below is § 63(c) as amended by OBBBA, the
// same figures `us-federal-tax` ships and the same ones `year-over-year.test.js`
// already writes inline. It is duplicated here rather than imported because a test
// that reaches into a sibling package cannot run inside the mutation harness's
// worker copy — that is the bug that made the harness's first federal run report a
// perfect score, and `readme.test.js` is still the only file with the problem.

/** § 63(c) as amended by OBBBA § 70102. A household input, not a shipped figure. */
const FEDERAL_STANDARD_DEDUCTION = {
  2025: {
    single: 15_750,
    marriedFilingJointly: 31_500,
    marriedFilingSeparately: 15_750,
    headOfHousehold: 23_625,
    qualifyingSurvivingSpouse: 31_500,
  },
  2026: {
    single: 16_100,
    marriedFilingJointly: 32_200,
    marriedFilingSeparately: 16_100,
    headOfHousehold: 24_150,
    qualifyingSurvivingSpouse: 32_200,
  },
};

/**
 * The seven shapes, as functions of nothing but the filing status and the year.
 *
 * `income` is the household's federal AGI. `deduction`, when given, makes the
 * return a federal itemizer — which several states read directly, and one
 * (Georgia) pays a credit for.
 */
const SHAPES = {
  wage8k: {
    income: 8_000,
    earnedIncome: 8_000,
    filerAge: 24,
    spouseAge: 23,
    socialSecurityAndMedicarePaid: 612,
    rentPaid: 7_200,
  },
  wage20k: {
    income: 20_000,
    earnedIncome: 20_000,
    filerAge: 31,
    spouseAge: 30,
    socialSecurityAndMedicarePaid: 1_530,
    rentPaid: 10_800,
  },
  wage62k: {
    income: 62_000,
    earnedIncome: 62_000,
    filerAge: 41,
    spouseAge: 39,
    socialSecurityAndMedicarePaid: 4_743,
    lesserSpouseIncome: 24_000,
    bothSpousesHaveQualifyingIncome: true,
  },
  family38k: {
    income: 38_000,
    earnedIncome: 38_000,
    filerAge: 34,
    spouseAge: 33,
    dependentAges: [4, 9],
    federalEarnedIncomeCredit: 2_400,
    rentPaid: 14_400,
    socialSecurityAndMedicarePaid: 2_907,
    lesserSpouseIncome: 9_000,
    bothSpousesHaveQualifyingIncome: true,
  },
  wage540k: {
    income: 540_000,
    earnedIncome: 540_000,
    filerAge: 55,
    spouseAge: 54,
    socialSecurityAndMedicarePaid: 15_000,
    lesserSpouseIncome: 200_000,
    bothSpousesHaveQualifyingIncome: true,
  },
  family62k: {
    income: 62_000,
    earnedIncome: 62_000,
    filerAge: 38,
    spouseAge: 37,
    dependentAges: [3, 8],
    rentPaid: 16_800,
    socialSecurityAndMedicarePaid: 4_743,
    lesserSpouseIncome: 20_000,
    bothSpousesHaveQualifyingIncome: true,
  },
  family90k: {
    income: 90_000,
    earnedIncome: 90_000,
    filerAge: 42,
    spouseAge: 41,
    dependentAges: [2, 11],
    rentPaid: 19_200,
    socialSecurityAndMedicarePaid: 6_885,
    lesserSpouseIncome: 30_000,
    bothSpousesHaveQualifyingIncome: true,
  },
  family130k: {
    income: 130_000,
    earnedIncome: 130_000,
    filerAge: 45,
    spouseAge: 44,
    dependentAges: [6, 13],
    propertyTaxPaid: 5_400,
    socialSecurityAndMedicarePaid: 9_945,
    lesserSpouseIncome: 45_000,
    bothSpousesHaveQualifyingIncome: true,
  },
  retired70: {
    income: 40_000,
    earnedIncome: 0,
    filerAge: 70,
    spouseAge: 70,
    retirement: {
      filer: { employerPlanPension: 28_000, socialSecurityBenefits: 14_000 },
      spouse: {},
    },
    retirementIncome: 28_000,
    taxableSocialSecurity: 12_000,
    taxExemptInterest: 6_000,
    propertyTaxPaid: 3_800,
    rentPaid: 0,
    spouseHasNoGrossIncomeAndIsNotADependent: true,
    spouseAdjustedFederalAdjustedGrossIncome: 0,
  },
  // 71 and 61 — a joint return with EXACTLY ONE person over 65, which is the
  // only household shape that can reach Maryland's `$1,000` one-aged senior
  // credit and Indiana's `oneAged` band. A battery whose every retiree is a
  // couple of the same age tests half of every aged rule in the package.
  retired80k: {
    income: 80_000,
    earnedIncome: 0,
    filerAge: 71,
    spouseAge: 61,
    retirement: {
      filer: { employerPlanPension: 62_000, socialSecurityBenefits: 21_000 },
      spouse: {},
    },
    retirementIncome: 62_000,
    taxableSocialSecurity: 18_000,
    taxExemptInterest: 4_000,
    propertyTaxPaid: 4_600,
    spouseHasNoGrossIncomeAndIsNotADependent: true,
    spouseAdjustedFederalAdjustedGrossIncome: 0,
  },
  // Gross income inside New Jersey's 25% tier and a pension above the exclusion
  // CAP. Both at once, because the cap is applied before the tier percentage and
  // a return above the $150,000 wall excludes nothing at all — so the only
  // household that can see the cap is one whose pension exceeds it and whose
  // income does not exceed the wall.
  retired148k: {
    income: 148_000,
    earnedIncome: 0,
    filerAge: 73,
    spouseAge: 73,
    retirement: {
      filer: { employerPlanPension: 104_000, socialSecurityBenefits: 9_400 },
      spouse: { employerPlanPension: 36_000 },
    },
    retirementIncome: 140_000,
    taxableSocialSecurity: 8_000,
    propertyTaxPaid: 6_100,
    spouseAdjustedFederalAdjustedGrossIncome: 0,
  },
  // Born before 1946, which in this package is `minimumAge: 80` in 2025 and 81
  // in 2026 — the year-conditional Day 33 listed as Group 2. Michigan's largest
  // retirement deduction is available to this cohort and to nobody else, so its
  // cap is unreachable by every household under 80.
  retiredBorn1944: {
    income: 160_000,
    earnedIncome: 0,
    filerAge: 82,
    spouseAge: 82,
    retirement: {
      filer: { employerPlanPension: 140_000, socialSecurityBenefits: 23_500 },
      spouse: {},
    },
    retirementIncome: 140_000,
    taxableSocialSecurity: 20_000,
    propertyTaxPaid: 5_900,
  },
  retired180k: {
    income: 180_000,
    earnedIncome: 0,
    filerAge: 72,
    spouseAge: 72,
    retirement: {
      filer: { employerPlanPension: 96_000, socialSecurityBenefits: 24_000 },
      spouse: { employerPlanPension: 44_000, socialSecurityBenefits: 23_000 },
    },
    retirementIncome: 140_000,
    taxableSocialSecurity: 40_000,
    taxExemptInterest: 12_000,
    propertyTaxPaid: 7_200,
  },
  // Born 1952 or earlier and no Social Security at all — the only two conditions
  // under which Utah's code 18 retirement credit can be elected. Day 33 recorded
  // it as "all but dead law"; a household nothing else in the battery can be.
  retiredCode18: {
    income: 46_000,
    earnedIncome: 0,
    filerAge: 74,
    spouseAge: 74,
    retirement: {
      filer: { employerPlanPension: 46_000 },
      spouse: {},
    },
    retirementIncome: 46_000,
    taxableSocialSecurity: 0,
    propertyTaxPaid: 3_100,
  },
  low14k5: {
    income: 14_500,
    earnedIncome: 14_500,
    filerAge: 29,
    spouseAge: 28,
    federalEarnedIncomeCredit: 600,
    socialSecurityAndMedicarePaid: 1_109,
    rentPaid: 9_600,
  },
  high420k: {
    income: 420_000,
    earnedIncome: 340_000,
    filerAge: 52,
    spouseAge: 50,
    deduction: 48_000,
    deductionKind: 'itemized',
    stateItemizedDeductions: 48_000,
    netCapitalGain: 80_000,
    investmentIncome: 80_000,
    shortTermCapitalGains: 30_000,
    collectiblesGains: 10_000,
    outOfStateMunicipalInterest: 9_000,
    socialSecurityAndMedicarePaid: 13_243,
    dependentAges: [16],
    lesserSpouseIncome: 120_000,
    bothSpousesHaveQualifyingIncome: true,
  },
  veryHigh1m4: {
    income: 1_400_000,
    earnedIncome: 1_050_000,
    filerAge: 58,
    spouseAge: 57,
    deduction: 140_000,
    deductionKind: 'itemized',
    stateItemizedDeductions: 140_000,
    netCapitalGain: 350_000,
    investmentIncome: 350_000,
    shortTermCapitalGains: 120_000,
    socialSecurityAndMedicarePaid: 22_000,
    lesserSpouseIncome: 400_000,
    bothSpousesHaveQualifyingIncome: true,
  },
  business420k: {
    income: 460_000,
    earnedIncome: 60_000,
    filerAge: 47,
    spouseAge: 46,
    businessIncome: 400_000,
    socialSecurityAndMedicarePaid: 4_590,
    lesserSpouseIncome: 30_000,
    bothSpousesHaveQualifyingIncome: true,
  },
};

/** The battery's keys, in the order the fixture stores them. */
export const HOUSEHOLDS = Object.keys(SHAPES);

/**
 * Build one battery input.
 *
 * The three state-specific income measures are mirrored from `income` because a
 * state that defines its own base has nowhere else to read one from, and a sweep
 * that left them undefined would answer zero for Pennsylvania, New Jersey and
 * Massachusetts on every row — which is the shape of a test that passes by not
 * reaching anything.
 */
export function household(household, state, year, filingStatus) {
  const shape = SHAPES[household];
  if (shape === undefined) throw new RangeError(`Unknown household ${household}`);
  const deduction = shape.deduction ?? FEDERAL_STANDARD_DEDUCTION[year][filingStatus];
  const input = {
    state,
    year,
    filingStatus,
    federal: {
      adjustedGrossIncome: shape.income,
      taxableIncome: Math.max(0, shape.income - deduction),
      deduction,
      deductionKind: shape.deductionKind ?? 'standard',
      ...(shape.federalEarnedIncomeCredit === undefined
        ? {}
        : { earnedIncomeCredit: shape.federalEarnedIncomeCredit }),
    },
    pennsylvaniaTaxableIncome: shape.income,
    pennsylvaniaEligibilityIncome: shape.income,
    newJerseyGrossIncome: shape.income,
    massachusettsFivePercentIncome:
      shape.income - (shape.shortTermCapitalGains ?? 0) - (shape.collectiblesGains ?? 0),
    qualifyingWages: shape.earnedIncome,
  };
  for (const key of [
    'earnedIncome',
    'filerAge',
    'spouseAge',
    'dependentAges',
    'investmentIncome',
    'netCapitalGain',
    'shortTermCapitalGains',
    'collectiblesGains',
    'outOfStateMunicipalInterest',
    'socialSecurityAndMedicarePaid',
    'propertyTaxPaid',
    'rentPaid',
    'retirement',
    'retirementIncome',
    'taxableSocialSecurity',
    'taxExemptInterest',
    'businessIncome',
    'bothSpousesHaveQualifyingIncome',
    'lesserSpouseIncome',
    'stateItemizedDeductions',
    'spouseHasNoGrossIncomeAndIsNotADependent',
    'spouseAdjustedFederalAdjustedGrossIncome',
  ]) {
    if (shape[key] !== undefined) input[key] = shape[key];
  }
  return input;
}

/**
 * The figures the sweep pins, in fixture column order.
 *
 * Four rather than one, and the number was measured rather than chosen. Running
 * the sensitivity sweep with each candidate digest and counting the parameters no
 * household could move:
 *
 *   | digest                                  | parameters nothing reaches |
 *   | --------------------------------------- | -------------------------- |
 *   | `totalTax` alone                        | 33 of 498                  |
 *   | + `taxableIncome`, `credits`            | 21                         |
 *   | + `stateAdjustedGrossIncome`            | **20**                     |
 *   | all seven result subtotals              | 20                         |
 *
 * **A sweep that watched only the tax would have reported 13 parameters as
 * unreachable that are reached** — because a parameter can move a state's AGI,
 * its exemptions or its credits inside a return that is already at zero tax, and
 * a return at zero is where the low-income parameters all live. The three extra
 * columns cost a third of the fixture's size and buy that back; the other three
 * subtotals buy nothing on top and are left out.
 *
 * The 20 that remain are `exemption.perFiler` in Maryland and Ohio, which the
 * engine cannot reach at all: they are stored duplicates of the chart's top step
 * and `registry.test.js` checks them against it. See `status-sweep.test.js`.
 */
export const DIGEST_COLUMNS = [
  'stateAdjustedGrossIncome',
  'taxableIncome',
  'credits',
  'totalTax',
];

const cents = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export function digest(result) {
  return [
    cents(result.stateAdjustedGrossIncome),
    cents(result.taxableIncome),
    cents(result.credits.reduce((sum, c) => sum + c.amount, 0)),
    cents(result.totalTax),
  ];
}
