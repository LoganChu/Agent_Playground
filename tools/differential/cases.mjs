/**
 * The households both models are asked about.
 *
 * A differential test is only as good as the guarantee that both sides were
 * asked the *same* question, so a case here may contain only facts that map
 * onto a PolicyEngine-US variable without interpretation: a wage, a pension
 * distribution, a Social Security benefit, a long-term gain, tax-exempt
 * interest, and the ages of the people. Anything that needs a judgement call to
 * translate — an itemised deduction, a business, a locality — is left out, not
 * because it does not matter but because a disagreement about it would be a
 * disagreement about the harness.
 *
 * The grid is deliberately coarse in income and wide in *shape*. A thousand
 * incomes on one household shape find one bug a thousand times; seven shapes
 * across nineteen states find seven different ones.
 */

/**
 * Every tax year both models are asked about.
 *
 * For fifty-three days this grid was one year deep, and `cases()` took the year
 * as a DEFAULT ARGUMENT nobody ever passed. So every household in it was a 2026
 * household, and every claim the report made about what the two models do in
 * 2025 was a claim about nothing — including the one in
 * `known-divergences.json` that names 2025 explicitly: Oregon's entry argues
 * that *"every one of these is tax year 2026 and none is 2025, which is the
 * signature of the disagreement rather than a symptom of it"*, in a grid that
 * had never contained a 2025 return.
 *
 * `us-state-tax` supports exactly these two years. 2024 is deliberately absent:
 * the federal engine has it and the state engine does not, so a 2024 case would
 * compare a state figure this package declines to produce.
 *
 * **2025 is not 2026 with different numbers.** It is the year OBBBA changed
 * retroactively in July 2025, after the IRS had published it; it is the only
 * year in which South Carolina's § 12-6-40(A)(1)(a) conformity date leaves the
 * state on a federal standard deduction the federal return no longer uses; and
 * it is the year the four Schedule 1-A deductions first exist. Three state
 * definition rules in this package exist in 2025 and not in 2026 and all three
 * are South Carolina's — and until today no case could reach any of them.
 */
export const YEARS = [2025, 2026];

/** Every state in `us-state-tax` that charges an income tax. */
export const STATES = [
  'AL', 'AZ', 'CA', 'CO', 'CT', 'GA', 'ID', 'IL', 'IN', 'KY', 'MA', 'MD',
  'MI', 'MN', 'MO', 'MS', 'NC', 'NJ', 'NY', 'OH', 'OR', 'PA', 'SC', 'UT', 'VA', 'WI',
];

/** The household shapes, before a state is attached to one. */
const SHAPES = [
  // A single worker, across the whole rate schedule.
  ...[15_000, 30_000, 50_000, 80_000, 150_000, 400_000].map((wages) => ({
    kind: 'single-worker',
    filingStatus: 'single',
    primaryAge: 40,
    wages,
  })),
  // A married couple with two children — one under 6, one school age. The
  // second earner is zero, so the split between the two never enters.
  ...[30_000, 60_000, 100_000, 200_000].map((wages) => ({
    kind: 'couple-two-children',
    filingStatus: 'marriedFilingJointly',
    primaryAge: 38,
    spouseAge: 36,
    childAges: [3, 8],
    wages,
  })),
  // A single parent, in and around every state's earned income credit.
  ...[12_000, 25_000, 45_000].map((wages) => ({
    kind: 'single-parent',
    filingStatus: 'headOfHousehold',
    primaryAge: 34,
    childAges: [5],
    wages,
  })),
  // The retired couple the site ranks states on: a benefit and a pension.
  ...[0, 20_000, 50_000, 90_000].map((pension) => ({
    kind: 'retired-couple',
    filingStatus: 'marriedFilingJointly',
    primaryAge: 70,
    spouseAge: 70,
    socialSecurity: 40_000,
    pension,
  })),
  // A single retiree, below and above the § 86 second threshold.
  ...[10_000, 40_000].map((pension) => ({
    kind: 'single-retiree',
    filingStatus: 'single',
    primaryAge: 67,
    socialSecurity: 24_000,
    pension,
  })),
  // Preferential-rate income, which several states tax as ordinary and two do
  // not tax as either.
  ...[20_000, 100_000].map((longTermCapitalGains) => ({
    kind: 'investor',
    filingStatus: 'single',
    primaryAge: 45,
    wages: 50_000,
    longTermCapitalGains,
  })),
  // Married filing separately — the status every state's table prints and few
  // of them halve consistently.
  {
    kind: 'separate',
    filingStatus: 'marriedFilingSeparately',
    primaryAge: 42,
    wages: 60_000,
  },
  // A retiree holding municipal bonds. Federally invisible; Utah charges 2.5%
  // for it and no other state here looks at it.
  {
    kind: 'muni-retiree',
    filingStatus: 'marriedFilingJointly',
    primaryAge: 70,
    spouseAge: 70,
    socialSecurity: 40_000,
    pension: 60_000,
    taxExemptInterest: 10_000,
  },

  // ---------------------------------------------------------------------
  // Day 26: the shapes the first grid did not have.
  //
  // Zero unexplained differences means the grid has stopped finding things,
  // not that the two engines agree. Every shape below is one an existing
  // shape is a special case of — an age the grid never asked about, a
  // dependent the grid never aged, a status the grid never filed, a
  // condition the grid never had.
  // ---------------------------------------------------------------------

  // A married couple with no children. The grid had a couple only WITH
  // children and a single worker only without, so no case separated the
  // effect of the joint schedule from the effect of the dependents.
  ...[25_000, 75_000].map((wages) => ({
    kind: 'couple-no-children',
    filingStatus: 'marriedFilingJointly',
    primaryAge: 45,
    spouseAge: 43,
    wages,
  })),

  // Dependents at three different ages inside one household. Every
  // per-child credit in this package bands on age — Georgia at 6, Utah at
  // 6, Illinois at 12, New York at 4 and 17, Indiana at 19 — and a grid
  // whose only children are 3 and 8 cannot tell a band edge from a rate.
  ...[40_000, 90_000].map((wages) => ({
    kind: 'mixed-dependents',
    filingStatus: 'marriedFilingJointly',
    primaryAge: 42,
    spouseAge: 40,
    childAges: [2, 7, 14],
    wages,
  })),

  // Day 43: a head of household ABOVE the income where a two-tier schedule
  // changes tier.
  //
  // The grid's three heads of household earned $12,000, $25,000, $35,000 and
  // $45,000, which is a deliberate spread across every state's earned income
  // credit — and every one of them is below $58,836.61, the income at which
  // Wisconsin's head-of-household standard deduction stops being withdrawn at
  // 22.515% and starts being withdrawn at 12% alongside the single one. So the
  // whole second tier of that schedule was invisible from this grid: the
  // crossover could have been any number above $45,000 and no case would have
  // moved.
  //
  // THE RULE, which is Day 27's upward widening applied to a SCHEDULE rather
  // than to a credit: a status is tested only at the incomes the grid gave it,
  // and a grid that chose a status's incomes to straddle one provision's
  // thresholds has said nothing about any other provision that bands the same
  // status somewhere else. The heads of household here were placed for earned
  // income credits, which live below $50,000; a deduction schedule that changes
  // shape at $58,837 needed a rung of its own.
  {
    kind: 'single-parent-high',
    filingStatus: 'headOfHousehold',
    primaryAge: 44,
    childAges: [12],
    wages: 90_000,
  },

  // A single parent whose child is too old for every young-child credit and
  // still inside § 24. The grid's only single parent has a five-year-old.
  {
    kind: 'single-parent-teen',
    filingStatus: 'headOfHousehold',
    primaryAge: 44,
    childAges: [16],
    wages: 35_000,
  },

  // A separate return WITH a child. The grid's separate return has none, and
  // married-filing-separately is the status states disqualify from credits
  // rather than halve — which only shows on a return that would have had one.
  {
    kind: 'separate-with-child',
    filingStatus: 'marriedFilingSeparately',
    primaryAge: 38,
    childAges: [6],
    wages: 45_000,
  },

  // A qualifying surviving spouse: the fifth filing status, and the one no
  // case in the grid had ever used. Most states give it the joint figures;
  // Georgia gives it the single ones and this package's new itemizer credit
  // counts it as ONE taxpayer where `filerCount()` says two.
  {
    kind: 'surviving-spouse',
    filingStatus: 'qualifyingSurvivingSpouse',
    primaryAge: 41,
    childAges: [10],
    wages: 45_000,
  },

  // ---------------------------------------------------------------------
  // Day 27: the same status, ABOVE the line.
  //
  // Day 26 put a surviving spouse in the grid for the first time and she
  // found four defects at $45,000. She could not have found a fifth,
  // because § 24(b)(2) does not begin to bite until $200,000 and § 199A
  // not until $201,750 — and the status-sensitive parameters that live up
  // there had never been asked a question by anybody.
  //
  // THE RULE THIS ENCODES: adding a filing status to a grid tests the
  // status only at the incomes the grid already had. A case reaches a
  // threshold or it does not; what the case is CALLED decides nothing.
  // Every status in this file should be filed at least once on each side
  // of every threshold that names it.
  //
  // $250,000 is inside the § 24 phase-out band, $300,000 past its end for
  // one child, and $450,000 past the JOINT threshold as well — which is
  // the case that distinguishes "this package now uses $200,000" from
  // "this package lost the credit for some other reason".
  ...[250_000, 300_000, 450_000].map((wages) => ({
    kind: 'surviving-spouse-high',
    filingStatus: 'qualifyingSurvivingSpouse',
    primaryAge: 47,
    childAges: [10],
    wages,
  })),

  // ---------------------------------------------------------------------
  // Day 29: the same status, BELOW the line, and the other edge of Day 27.
  //
  // Day 27's rule — "adding a filing status tests it only at the incomes
  // the grid already had" — was acted on by widening UPWARD, because the
  // two provisions then in hand began at $200,000. The rule is symmetric
  // and the correction was not.
  //
  // v0.27.0 found fourteen more defects in this status and FOUR of them
  // live in credits that switch off before $30,000: Pennsylvania's tax
  // forgiveness (whole bill below a $6,500 allowance plus $9,500 a child),
  // Virginia's Credit for Low Income Individuals and Maryland's poverty
  // level credit (both cliffs at the federal poverty guideline, $15,960
  // plus $5,680 a head), and New York's household credit (nothing above
  // $32,000). The grid's cheapest widow earned $45,000 and every one of
  // them was dark to her.
  //
  // THE RULE: a grid widened in ONE direction is still a grid with an
  // edge, and a credit that switches OFF as income rises is invisible from
  // above in exactly the way a threshold is invisible from below. $18,000
  // is inside all four; $26,000 is above the two-person poverty guideline
  // and below the three-person one, which is the case that distinguishes
  // "the household is counted correctly" from "the credit is gone".
  ...[18_000, 26_000].map((wages) => ({
    kind: 'surviving-spouse-low',
    filingStatus: 'qualifyingSurvivingSpouse',
    primaryAge: 38,
    childAges: [10],
    wages,
  })),

  // ---------------------------------------------------------------------
  // Day 30: a separate return with a SPOUSE in it.
  //
  // The grid has filed married-filing-separately since the first day and has
  // never once given that return a spouse. Both of its cases are a lone
  // person who ticks the separate box, which is the shape a grid author
  // writes when the status is understood as "half of joint" — the half has
  // no other half in it.
  //
  // THE RULE, and it is Day 27's read the other way round: widening a grid
  // by INCOME finds what income reaches. A status also has to be widened by
  // the FACTS it is the only status to read. Married filing separately is
  // the one status in the Code whose answer depends on a person who is not
  // on the return: § 63(c)(6)(A) on whether the other spouse itemizes,
  // § 63(f)(1)(B) via § 151(b) on whether they had gross income, § 86(c)(1)(C)
  // on whether they shared a house. A separate return with nobody else in it
  // cannot ask any of the three.
  //
  // Both cases here put a 68-year-old spouse with NO income beside the filer,
  // which is exactly the § 151(b) test, and `ours.mjs` says so — see the note
  // on `spouseHasNoGrossIncomeAndIsNotADependent` there. $55,000 of pension
  // keeps § 86 out of it, because the cohabitation default would otherwise
  // decide the answer instead of § 63(f).
  {
    kind: 'separate-with-spouse',
    filingStatus: 'marriedFilingSeparately',
    primaryAge: 68,
    spouseAge: 68,
    pension: 55_000,
  },
  // The same household under 65, so the pair isolates § 63(f) exactly: the
  // only difference between them is four years of age, and the only thing
  // that turns on it federally is the additional standard deduction.
  {
    kind: 'separate-with-spouse-young',
    filingStatus: 'marriedFilingSeparately',
    primaryAge: 61,
    spouseAge: 61,
    pension: 55_000,
  },

  // An early retiree, below every age test in the package. Day 24 built four
  // states' retirement subtractions and every retiree in the grid was 67 or
  // older, so no case could tell Illinois's absence of an age test from
  // Georgia's 62, New York's 59 1/2 or Maryland's 65.
  {
    kind: 'early-retiree',
    filingStatus: 'single',
    primaryAge: 56,
    pension: 50_000,
  },
  {
    kind: 'early-retired-couple',
    filingStatus: 'marriedFilingJointly',
    primaryAge: 57,
    spouseAge: 55,
    pension: 70_000,
  },

  // Blindness. Three states here add an exemption for it, the federal
  // standard deduction adds to itself for it, and no case had ever set it.
  {
    kind: 'blind-worker',
    filingStatus: 'single',
    primaryAge: 40,
    wages: 40_000,
    blind: 1,
  },
  // And a blind filer who is also 65, because Indiana and Illinois stack the
  // two exemptions on one person and a grid with neither condition in it
  // cannot show that they stack.
  {
    kind: 'blind-senior',
    filingStatus: 'single',
    primaryAge: 70,
    socialSecurity: 20_000,
    pension: 25_000,
    blind: 1,
  },

  // ---------------------------------------------------------------------
  // Day 40: a case standing EXACTLY on a boundary.
  //
  // Day 39 predicted that this grid would disagree with PolicyEngine-US
  // about which step of Connecticut's Table E owns its boundary, and the
  // grid said nothing at all — because no household in it lands exactly on
  // one. A boundary convention is a question only a case standing on the
  // boundary can ask, and in 779 households nobody was standing on one.
  //
  // THE RULE: every household in a grid chosen for a BAND is inside the
  // band, and the figures that decide which band own the edges.
  //
  // $50,000 and $100,000 are round numbers on purpose: they are where
  // Alabama's dependent exemption chart steps (§ 40-18-19(a)(9), whose
  // words are "equal to or less than", so the lower step owns both edges
  // and PolicyEngine-US reads them the other way), where Maryland's
  // exemption staircase steps at $100,000, and where Virginia's age
  // deduction begins at $50,000. One dependent, because the Alabama chart
  // is per dependent and a count of one makes the step the whole of the
  // difference.
  ...[50_000, 100_000].map((wages) => ({
    kind: 'on-the-boundary',
    filingStatus: 'single',
    primaryAge: 40,
    childAges: [10],
    wages,
  })),
];

/**
 * Where a local income tax is universal, both models have to be told the same
 * jurisdiction or they are not answering the same question.
 *
 * Every Maryland and Indiana resident owes a county income tax, so neither
 * model's "state income tax" is a state-only figure there. PolicyEngine falls
 * back to Allegany County when a Maryland household names none; Indiana's
 * county is named here rather than defaulted because its unknown-county path
 * is a zero rate, which is not a county anybody lives in.
 */
const COUNTY = {
  MD: { ours: 'Allegany County', theirs: 'ALLEGANY_COUNTY_MD' },
  IN: { ours: 'Marion County', theirs: 'MARION_COUNTY_IN' },
};

/**
 * Every case, with a stable id. The order is deterministic.
 *
 * The year leads the id rather than trailing it, and that is not cosmetic.
 * `known-divergences.json` selects households with `idIncludes`, and four of its
 * entries name an AMOUNT — `"-400000-"`, `"-450000-"`, `"surviving-spouse-high-
 * MN-300000"` — relying on the dashes either side of it. A trailing `-2026`
 * leaves the last amount with a dash on one side only, so a later entry written
 * as `idIncludes: "-2025-"` would match nothing and say so by matching nothing,
 * which is the quietest failure this file has. Leading, every amount keeps both
 * delimiters and every existing selector keeps matching exactly what it matched
 * when it was written.
 */
export function cases(years = YEARS) {
  const out = [];
  for (const year of years) {
    for (const shape of SHAPES) {
      for (const state of STATES) {
        const id = [
          year,
          shape.kind,
          state,
          shape.wages ?? 0,
          shape.pension ?? 0,
          shape.socialSecurity ?? 0,
          shape.longTermCapitalGains ?? 0,
          shape.taxExemptInterest ?? 0,
        ].join('-');
        out.push({
          id,
          year,
          state,
          filingStatus: shape.filingStatus,
          primaryAge: shape.primaryAge,
          spouseAge: shape.spouseAge ?? null,
          childAges: shape.childAges ?? [],
          wages: shape.wages ?? 0,
          pension: shape.pension ?? 0,
          socialSecurity: shape.socialSecurity ?? 0,
          longTermCapitalGains: shape.longTermCapitalGains ?? 0,
          taxExemptInterest: shape.taxExemptInterest ?? 0,
          // How many of the filer and spouse are blind. Deliberately a count
          // rather than two flags, because that is the shape both models take it
          // in: this package's `blindOrDisabled` and PolicyEngine's per-person
          // `is_blind` on the head and then the spouse.
          blind: shape.blind ?? 0,
          county: COUNTY[state] ?? null,
          kind: shape.kind,
        });
      }
    }
  }
  return out;
}
