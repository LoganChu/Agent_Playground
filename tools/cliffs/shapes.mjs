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
 * **Itemised deductions, property tax and rent.** A notch in a provision tested
 * on one of those is a notch in *that* variable, and no axis below walks it.
 *
 * Investment income, pension income, Social Security benefits and municipal
 * interest WERE in this paragraph until Day 78, when they became the four axes
 * in `AXES` below. The sentence they were retired from said that finding those
 * notches "needs a sweep over the other variable, which is the same instrument
 * pointed at a different axis". That was right, and it cost about four minutes.
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

/**
 * The axes the sweep walks, which is the variable it moves while everything
 * else stands still.
 *
 * ## Why more than one axis, and what the extra ones can see
 *
 * Until Day 78 this instrument walked `wages` and nothing else, and said so in
 * the report's own limitations section. That is a real blind spot rather than a
 * tidy one: **a means test keyed on a component of income cannot bind on an
 * axis that does not move that component.** The $11,950 investment-income bar
 * in § 32(i) is the example that forced this file — one cent over it and the
 * whole earned income credit is gone, in nineteen states as well as federally,
 * and no wage in any band reaches it.
 *
 * The cost is **linear** in the number of axes, not multiplicative, because an
 * axis moves one variable and holds the rest. Four axes is four sweeps, not
 * four dimensions.
 *
 * ## `holds`, and why a held value is a sample and is named as one
 *
 * An axis other than wages has to decide what wages are, and there is no
 * neutral answer: a means test on investment income binds only where there is
 * earned income to lose, so `wages: 0` would find nothing on the axis that was
 * worth adding. Each axis therefore names the deviations it makes from the
 * shape, the report prints them, and **a notch's position on a held axis is a
 * position in that sample rather than a statutory threshold.** What is NOT a
 * sample is the notch's existence and its size.
 *
 * Anything a `holds` map does not mention keeps the shape's own value, so the
 * retiree keeps its pension on the Social Security axis and the working-age
 * shapes keep their zero.
 *
 * ## Reading a notch that appears on more than one axis
 *
 * A provision means-tested on a TOTAL — state AGI, federal AGI, gross income —
 * is found on every axis that feeds that total, at a different coordinate each
 * time. A provision means-tested on a COMPONENT is found on one axis only. So
 * the number of axes a notch appears on is evidence about what the threshold is
 * written on, and the report tabulates it.
 */
export const AXES = [
  {
    id: 'wages',
    field: 'wages',
    noun: 'wages',
    bands: BANDS,
    shapes: null,
    holds: {},
  },
  {
    id: 'investment-income',
    field: 'longTermCapitalGains',
    noun: 'long-term capital gains',
    // Capital gain net income is § 32(i)(2)(D), and this field is also what the
    // state engine reads as `investmentIncome`, so one axis reaches both the
    // federal disqualified-income cliff and every state provision tested on
    // investment income. The band stops at $550,000 because above that the
    // thresholds in state law are AGI thresholds, which the wage axis walks.
    bands: [
      { from: 0, to: 150_000, step: 100 },
      { from: 150_000, to: 550_000, step: 2_500 },
    ],
    shapes: null,
    // In the earned income credit's plateau for a household with children, so
    // the § 32(i) bar has a credit to take away. $25,000 is also above every
    // state's standard deduction, so a subtraction that is capped rather than
    // means-tested still shows its cap.
    holds: { wages: 25_000 },
  },
  {
    id: 'pension',
    field: 'pension',
    noun: 'pension income',
    bands: [{ from: 0, to: 150_000, step: 100 }],
    // Two shapes, because the age test is the whole point: Pennsylvania taxes a
    // qualified-plan distribution at 35 and exempts it at 67, and a state
    // pension exclusion that is means-tested is means-tested at retirement age.
    shapes: ['single-retiree', 'childless-single'],
    holds: { wages: 0 },
  },
  {
    id: 'social-security',
    field: 'socialSecurity',
    noun: 'Social Security benefits',
    // The maximum benefit at full retirement age is about $48,000 a year and
    // about $62,000 at 70, so $80,000 covers a joint household's worth of it.
    bands: [{ from: 0, to: 80_000, step: 100 }],
    shapes: ['single-retiree'],
    holds: { wages: 0 },
  },
  {
    id: 'municipal-interest',
    field: 'taxExemptInterest',
    noun: 'tax-exempt interest',
    // § 32(i)(2)(B) and, in the states, the out-of-state municipal bond
    // addition. The band is short because this is the smallest of the four
    // variables in practice and the provisions keyed on it are keyed on modest
    // amounts.
    bands: [{ from: 0, to: 100_000, step: 100 }],
    shapes: ['childless-single', 'single-two-children', 'single-retiree'],
    holds: { wages: 25_000 },
  },
];

/** The axis the sweep walked before Day 78, and the default for `caseFor`. */
export const WAGE_AXIS = AXES[0];

/** The shapes an axis is swept over. */
export function shapesFor(axis) {
  return axis.shapes ? SHAPES.filter((s) => axis.shapes.includes(s.id)) : SHAPES;
}

/**
 * A full case for `householdInput`: a shape, an axis, and the axis's value.
 *
 * Order matters and is the one thing to get right here. The shape's own fields
 * go in first, then the axis's `holds` override them, then the axis's own
 * `field` takes the swept value. So an axis that holds `wages: 0` wins over the
 * shape, and an axis sweeping `socialSecurity` wins over its own hold if it
 * declared one.
 */
export function caseFor(shape, state, year, value, axis = WAGE_AXIS) {
  const c = {
    state,
    year,
    filingStatus: shape.filingStatus,
    primaryAge: shape.primaryAge,
    spouseAge: shape.spouseAge ?? null,
    childAges: shape.childAges,
    wages: 0,
    pension: shape.pension ?? 0,
    socialSecurity: shape.socialSecurity ?? 0,
    longTermCapitalGains: 0,
    taxExemptInterest: 0,
    blind: 0,
    oregonPriorYearTaxBeforeCredits: null,
  };
  for (const [k, v] of Object.entries(axis.holds)) c[k] = v;
  c[axis.field] = value;
  return c;
}

/**
 * A point in the middle of an axis's band, used to read the state's notes and
 * name. The notes are a property of the state-year rather than of the income,
 * but they have to be read at a point the axis can actually reach.
 */
export function midpointFor(axis) {
  const b = axis.bands[0];
  return Math.min(b.to, b.from + 60_000);
}
