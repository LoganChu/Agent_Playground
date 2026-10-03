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
//   blind34k      a blind filer and a dependent at college. Two DIMENSIONS the
//                 first draft had none of, worth eight states' blind exemptions
//                 between them.
//   veteran58     military retired pay, a government pension, and service on both
//                 sides of 1 January 1998. 58 because that is over 55 for
//                 Maryland's larger military cap and UNDER 62 for Georgia's
//                 military exclusion, which is a cliff on a birthday.
//   centenarian   100, a parameter in exactly one state and unreachable by every
//                 household under it.
//   family18k     three young children on a low earned income, and rent small
//                 enough that a percentage of it binds before a cap does. The
//                 refundable credits live here and have all run out by $38,000.
//
// Adding those four took the parameters no household reaches from 258 to 204 of
// 1,281 — and the largest single jump came from none of them. It came from finding
// that `blindOrDisabled` was being DROPPED on the way in, by the list of field
// names this file used to copy; see `household()`.
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
  // The rung the ladder was missing between $151,750 and $420,000 of state AGI,
  // and Connecticut is what found it. Connecticut's tax recapture has three
  // tiers whose starts are $105,000/$200,000/$500,000 for a single filer and
  // four fifths of the joint figures for a head of household — so the head of
  // household's first tier ($168,000) and the single filer's second ($200,000)
  // both need a household in a band the battery did not have. $250,000 covers
  // both: it is inside ($168,000, $337,001] and inside ($200,000, $400,001].
  //
  // Nothing about it is Connecticut-specific. The gap was a doubling ladder with
  // a missing rung, and it had been there since the battery was written.
  wage250k: {
    income: 250_000,
    earnedIncome: 250_000,
    filerAge: 49,
    spouseAge: 47,
    socialSecurityAndMedicarePaid: 13_200,
    lesserSpouseIncome: 95_000,
    bothSpousesHaveQualifyingIncome: true,
  },
  // The two rungs above $540,000, which exist for one Connecticut parameter each
  // and are the clearest case in the battery of Day 29's point that the top of a
  // table is the part nobody writes a household for.
  //
  // Connecticut's third recapture tier climbs $50 per $5,000 from $500,000 for a
  // single filer, $80 per $8,000 from $800,000 for a head of household and $100
  // per $10,000 from $1,000,000 on a joint return, and each stops after nine
  // steps. So the tier's increment and step amount are only visible inside a
  // $45,000, $72,000 or $90,000 band — above it the tier is at its maximum and
  // the two parameters cancel out of the answer entirely. `wage540k` happens to
  // sit in the single filer's band; nothing sat in the other two.
  wage850k: {
    income: 850_000,
    earnedIncome: 850_000,
    filerAge: 52,
    spouseAge: 50,
    socialSecurityAndMedicarePaid: 22_000,
    lesserSpouseIncome: 300_000,
    bothSpousesHaveQualifyingIncome: true,
  },
  wage1m05: {
    income: 1_050_000,
    earnedIncome: 1_050_000,
    filerAge: 57,
    spouseAge: 56,
    socialSecurityAndMedicarePaid: 26_000,
    lesserSpouseIncome: 420_000,
    bothSpousesHaveQualifyingIncome: true,
  },
  // A retired couple for whom Social Security is the MAJORITY of the income, at
  // an income above the threshold at which a state stops exempting it. Every
  // other retiree in this battery has benefits that are a minority of a larger
  // income, and that one-sided shape hides a whole branch: Connecticut charges
  // 25% of the LESSER of gross benefits and the § 86 combined income excess, and
  // for a retiree whose other income is large the excess is always the larger of
  // the two — so the base amount that defines the excess never enters the
  // answer. Here it does. $60,000 of combined benefits is two people drawing
  // about $2,500 a month, which is an ordinary couple rather than an extreme
  // one.
  retiredBenefitHeavy: {
    income: 100_000,
    earnedIncome: 0,
    filerAge: 69,
    spouseAge: 68,
    retirement: {
      filer: { socialSecurityBenefits: 30_000 },
      spouse: { socialSecurityBenefits: 30_000 },
    },
    taxableSocialSecurity: 51_000,
    propertyTaxPaid: 5_200,
    spouseAdjustedFederalAdjustedGrossIncome: 0,
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
  // A blind filer, and a dependent at college. Two whole dimensions the first
  // draft of this battery had none of: `blindOrDisabled` and
  // `dependentsAttendingCollege` are read by five states between them and by no
  // household that does not set them. Two claimed on a one-person return, so the
  // `livingFilerCount` cap is exercised rather than assumed.
  blind34k: {
    income: 34_000,
    earnedIncome: 34_000,
    filerAge: 47,
    spouseAge: 46,
    blindOrDisabled: 2,
    dependentAges: [19],
    dependentsAttendingCollege: 1,
    rentPaid: 6_000,
    socialSecurityAndMedicarePaid: 2_601,
  },
  // 58, with military retired pay, a government pension and service on both sides
  // of 1 January 1998. The age is the one that makes the most rules bind at once:
  // over 55 for Maryland's larger military cap, UNDER 62 for Georgia's military
  // exclusion — which is a cliff on the birthday every guide calls the one where
  // Georgia's exclusion begins — and Kentucky asks no age question at all.
  veteran58: {
    income: 95_000,
    earnedIncome: 25_000,
    filerAge: 58,
    spouseAge: 57,
    retirement: {
      filer: {
        militaryRetirement: 40_000,
        governmentPension: 30_000,
        serviceMonthsBefore1998: 240,
        serviceMonthsAfter1997: 120,
        earnedIncome: 25_000,
      },
      spouse: {},
    },
    retirementIncome: 70_000,
    socialSecurityAndMedicarePaid: 1_913,
  },
  // 100, which is a parameter in exactly one state and unreachable by every
  // household under it. Maryland's centenarian subtraction takes $100,000 off
  // whatever the income is, so the household has to have more than that for the
  // figure to bind rather than be clamped at zero.
  centenarian: {
    income: 150_000,
    earnedIncome: 0,
    filerAge: 100,
    spouseAge: 100,
    retirement: {
      filer: { employerPlanPension: 120_000, socialSecurityBenefits: 34_000 },
      spouse: {},
    },
    retirementIncome: 120_000,
    taxableSocialSecurity: 30_000,
    propertyTaxPaid: 4_200,
  },
  // Three young children on a low earned income, and rent small enough that a
  // percentage of it binds before a cap does. This is where the refundable credits
  // live — CalEITC's phase-in rates by child count, the Young Child Tax Credit,
  // Maryland's poverty-level credit — and none of them is reachable by a family at
  // $38,000, because every one of them has run out by then.
  family18k: {
    income: 18_000,
    earnedIncome: 18_000,
    filerAge: 30,
    spouseAge: 29,
    dependentAges: [2, 4, 7],
    federalEarnedIncomeCredit: 6_000,
    investmentIncome: 400,
    rentPaid: 6_000,
    socialSecurityAndMedicarePaid: 1_377,
    lesserSpouseIncome: 5_000,
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

/** Build one battery input. */
export function household(name, state, year, filingStatus) {
  const shape = SHAPES[name];
  if (shape === undefined) throw new RangeError(`Unknown household ${name}`);
  // Everything the shape declares goes through, EXCEPT the four keys that are
  // about building the federal basis rather than about the state return.
  //
  // Written as a rest spread on purpose. The first version listed the fields to
  // copy, and the list was short: `blindOrDisabled` and
  // `dependentsAttendingCollege` were set on a household built to reach them and
  // silently dropped on the way in, so eight states' blind exemptions read as
  // unreachable and the household that was supposed to reach them proved it.
  //
  // **THE RULE: a hand-maintained list of field names is a second copy of the
  // type, and a second copy drifts towards being short.** That is the same bug as
  // `retirement.filer.pension` one layer down and `wages` for `w2Wages` one layer
  // up — three times in one day, in three different files, and the two that were
  // lists were both wrong.
  const { income, deduction, deductionKind, federalEarnedIncomeCredit, ...rest } = shape;
  const federalDeduction = deduction ?? FEDERAL_STANDARD_DEDUCTION[year][filingStatus];
  return {
    state,
    year,
    filingStatus,
    federal: {
      adjustedGrossIncome: income,
      taxableIncome: Math.max(0, income - federalDeduction),
      deduction: federalDeduction,
      deductionKind: deductionKind ?? 'standard',
      ...(federalEarnedIncomeCredit === undefined
        ? {}
        : { earnedIncomeCredit: federalEarnedIncomeCredit }),
    },
    // The three state-specific income measures, mirrored from `income` because a
    // state that defines its own base has nowhere else to read one from. A sweep
    // that left them undefined would answer zero for Pennsylvania, New Jersey and
    // Massachusetts on every row — the shape of a test that passes by not reaching
    // anything.
    pennsylvaniaTaxableIncome: income,
    pennsylvaniaEligibilityIncome: income,
    newJerseyGrossIncome: income,
    massachusettsFivePercentIncome:
      income - (shape.shortTermCapitalGains ?? 0) - (shape.collectiblesGains ?? 0),
    qualifyingWages: shape.earnedIncome,
    ...rest,
  };
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
