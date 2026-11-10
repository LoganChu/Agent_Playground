/**
 * The household shapes the cliff sweep walks, and the income ranges it walks
 * them over.
 *
 * ## Why this file is separate from the sweep
 *
 * A discontinuity finder is only as complete as the households it is pointed
 * at, and that incompleteness is the whole honest content of its report. So the
 * set of shapes is a committed, named, countable thing rather than a literal
 * inside a loop: the report prints this list, and "what the sweep cannot see"
 * is a statement about this file.
 *
 * ## What each shape is FOR, which is not the same as what it is
 *
 * Every shape below was added because a class of means test cannot bind without
 * it. A sweep over one shape finds one state's notch many times; a sweep over
 * six finds six kinds.
 *
 *   childless-single     The shape with NO refundable credit to absorb a notch.
 *                        Ohio's $342 constant at $26,050 of taxable income is
 *                        invisible to every other shape here, because Ohio's
 *                        earned income credit covers the whole bill where a
 *                        family has children — the sweep measures `totalTax`,
 *                        which is floored at zero, so a notch inside a
 *                        credit-absorbed region does not move it.
 *   single-two-children  Earned income credits, child credits, and the
 *                        child-count bands that most state credits step on.
 *   joint-two-children   The same means tests at doubled thresholds, which is
 *                        where a halving error shows as a notch in one status
 *                        and not the other.
 *   joint-no-children    Separates an income threshold from a dependent one.
 *   hoh-one-child        The status whose thresholds are neither single's nor
 *                        joint's, and the one state tables most often get wrong.
 *   single-retiree       Age- and pension-tested provisions: Social Security
 *                        taxability, pension exclusions, elderly credits. These
 *                        are the most cliff-prone provisions in state law and
 *                        no working-age shape can reach one.
 *
 * ## What is deliberately NOT here
 *
 * **Investment income, municipal interest and itemised deductions.** Each would
 * multiply the sweep's cost by the number of values it can take, and a notch in
 * a provision tested on investment income is a notch in *that* variable rather
 * than in wages — the sweep walks wages. Finding those needs a sweep over the
 * other variable, which is the same instrument pointed at a different axis and
 * is on the worklist rather than claimed here.
 *
 * **Localities.** No `locality`, `county` or `city` is supplied, so this is the
 * state tax alone for the states whose local tax is universal — Maryland's
 * county tax and Indiana's county tax are NOT in these figures. A county rate is
 * a multiplier on a base this sweep already walks, so it scales a notch rather
 * than creating one; what it would change is the SIZE of every Maryland and
 * Indiana figure in the report, by up to 3.3 points of rate.
 */

/**
 * Every state the package covers, including the nine that tax no wage income.
 *
 * The nine are swept rather than skipped, and they are the only part of this
 * sweep whose expected answer is known in advance: a state that taxes nothing
 * has a tax function that is identically zero, which is continuous, so **a
 * single cliff reported for Alaska is a defect by inspection.** It costs about
 * two seconds a year to keep that check in the instrument instead of in a
 * sentence.
 */
export const STATES = [
  'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'FL', 'GA', 'IA',
  'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'MI', 'MN',
  'MO', 'MS', 'NC', 'ND', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH',
  'OK', 'OR', 'PA', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'WA',
  'WI', 'WY',
];

/** The two years `us-state-tax` covers. */
export const YEARS = [2025, 2026];

/**
 * The shapes, each a partial case in the schema `householdInput` reads.
 *
 * `wages` is supplied by the sweep and is the only field that moves.
 */
export const SHAPES = [
  {
    id: 'childless-single',
    filingStatus: 'single',
    primaryAge: 35,
    spouseAge: null,
    childAges: [],
  },
  {
    id: 'single-two-children',
    filingStatus: 'single',
    primaryAge: 38,
    spouseAge: null,
    childAges: [6, 11],
  },
  {
    id: 'joint-two-children',
    filingStatus: 'marriedFilingJointly',
    primaryAge: 40,
    spouseAge: 40,
    childAges: [8, 10],
  },
  {
    id: 'joint-no-children',
    filingStatus: 'marriedFilingJointly',
    primaryAge: 45,
    spouseAge: 44,
    childAges: [],
  },
  {
    id: 'hoh-one-child',
    filingStatus: 'headOfHousehold',
    primaryAge: 36,
    spouseAge: null,
    childAges: [7],
  },
  {
    id: 'single-retiree',
    filingStatus: 'single',
    primaryAge: 67,
    spouseAge: null,
    childAges: [],
    socialSecurity: 24_000,
    pension: 18_000,
  },
];

/**
 * The income bands, and the step the sweep takes through each.
 *
 * ## The step decides what the sweep can find, and the arithmetic is exact
 *
 * The detector is a second difference over three consecutive grid points (see
 * `find-cliffs.mjs`). On a continuous piecewise-linear tax function the second
 * difference is bounded by the change in marginal rate across the interval
 * times the step:
 *
 * ```text
 *   |f(x+h) - 2f(x) + f(x-h)|  <=  |r_right - r_left| x h
 * ```
 *
 * A state bracket boundary moves the rate by one or two points, so at `h = 100`
 * a legitimate kink contributes about `$2`. A jump of `J` contributes `J`. So a
 * threshold of `$3` separates the two for every notch above about `$3`, and the
 * refinement step then either finds a genuine jump or reports the flag as a
 * kink — which is why a false positive costs thirty evaluations rather than a
 * wrong line in the report.
 *
 * **The band above $150,000 steps by $2,500 and therefore sees only notches
 * above roughly $50.** That is stated rather than hidden: high-income notches
 * in state law are surtax and recapture thresholds and are large, and the cost
 * of walking a million dollars at `$100` is forty times the cost of the whole
 * rest of the sweep.
 */
export const BANDS = [
  { from: 0, to: 150_000, step: 100 },
  { from: 150_000, to: 1_050_000, step: 2_500 },
];

/** The second-difference threshold, in dollars, above which a flag is raised. */
export const FLAG_THRESHOLD = 3;

/**
 * The smallest jump the refinement will call a cliff, in dollars.
 *
 * Below this a step is rounding rather than a notch: both engines in this
 * repository round to the cent at several points, and a half-dollar floor keeps
 * a report about statutes from filling with arithmetic.
 */
export const MIN_JUMP = 0.5;

/** A full case for `householdInput`, from a shape and a wage. */
export function caseFor(shape, state, year, wages) {
  return {
    state,
    year,
    filingStatus: shape.filingStatus,
    primaryAge: shape.primaryAge,
    spouseAge: shape.spouseAge ?? null,
    childAges: shape.childAges,
    wages,
    pension: shape.pension ?? 0,
    socialSecurity: shape.socialSecurity ?? 0,
    longTermCapitalGains: 0,
    taxExemptInterest: 0,
    blind: 0,
    oregonPriorYearTaxBeforeCredits: null,
  };
}
