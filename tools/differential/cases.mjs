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

/** Every state in `us-state-tax` that charges an income tax. */
export const STATES = [
  'AZ', 'CA', 'CO', 'GA', 'ID', 'IL', 'IN', 'KY', 'MA', 'MD',
  'MI', 'MS', 'NC', 'NJ', 'NY', 'OH', 'PA', 'UT', 'VA',
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

/** Every case, with a stable id. The order is deterministic. */
export function cases(year = 2026) {
  const out = [];
  for (const shape of SHAPES) {
    for (const state of STATES) {
      const id = [
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
  return out;
}
