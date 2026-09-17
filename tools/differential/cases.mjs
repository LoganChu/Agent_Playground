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
        county: COUNTY[state] ?? null,
        kind: shape.kind,
      });
    }
  }
  return out;
}
