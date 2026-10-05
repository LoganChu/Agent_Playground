// The staircases this package ships, found by shape, and one probe inside every
// step of every one of them.
//
// Shared by `step-probes.test.js` and `tools/mutation/regenerate-step-probes.mjs`
// so the fixture and the test cannot disagree about what a chart is.
//
// ## Why a staircase needs its own instrument
//
// Day 34 closed the largest gap in this package's suite — `byStatus` cells nothing
// reached — with a battery of 22 households run under all five filing statuses.
// The argument for its size is arithmetic: a mutation sets `P` to `2P + 1`, so a
// household catches `P` only when its income lands in `(P, 2P + 1]`, and a ladder
// of ratio 2 always has a rung in that window. Ten rungs cover the whole range of
// incomes the law reaches.
//
// **That argument covers a table with ONE number in it. It does not cover a
// staircase.** Ohio's retirement income credit pays a different amount in each of
// six bands of retirement income — `$500`, `$1,500`, `$3,000`, `$5,000`, `$8,000`
// — and a ladder that reaches the first of them is nowhere near the fifth. Catching
// all six needs probes at roughly `$800`, `$1,600`, `$3,200`, `$6,400` and
// `$12,800`: five more households in the shared battery, **for one credit in one
// state**. Multiply that by New York's household credit, New Jersey's stepped child
// credit and four states' age bands and the battery stops being logarithmic in
// anything.
//
// **THE RULE: a chart of steps needs a probe inside each step, not a household for
// each step.** A household is a point in every dimension at once and is therefore
// expensive to add; a probe varies the one dimension its chart is read against and
// leaves the rest of the return fixed. `bracket-pins.test.js` is the same
// instrument for rate schedules — one frozen probe `$1,000` into every band — and
// this is it for the charts that pay an amount rather than charge a rate.
//
// ## Where the probes sit, and why it is the previous ceiling plus one
//
// A probe for step `i` sits at `upTo[i-1] + 1`: **just inside the step, against its
// floor**, rather than in the middle of it.
//
// That placement is what makes the ceilings testable. A mutation doubles `upTo[i-1]`
// to `2·upTo[i-1] + 1`, and a probe at `upTo[i-1] + 1` is below that for every
// non-negative ceiling — so the probe falls back into step `i-1`, is paid step
// `i-1`'s amount, and the pinned answer moves. A probe in the MIDDLE of a wide step
// would survive the same mutation: Ohio's `$1,500` doubled is `$3,001`, and a probe
// at `$2,250` is still inside the step it started in.
//
// The first step has no ceiling below it, so its probe is half of its own — chosen
// once by the regenerator and **frozen in the fixture**, never recomputed from the
// table at test time. Day 33's rule: a probe derived from the parameter moves when
// the parameter moves, and a test whose household is read out of the parameter is
// blind to it.
//
// ## Age bands are the same idea in the other unit
//
// `amountByAge` is a staircase in years rather than in dollars, and Massachusetts's
// is banded at both ends of life — under 13, or 65 and over. So its probes are the
// boundary ages and the years either side of them, which is the same "just inside,
// against the floor" rule written for a chart that can have a floor as well as a
// ceiling. The age one past the top band is a probe too, and it is the only one
// that can catch the top band's ceiling: with a single band of `maxAge: 5`, a
// dependent aged 5 is paid under any wider band as well.

/**
 * Every staircase in a definition, found by SHAPE rather than by a list of field
 * names.
 *
 * A staircase is an array whose every entry is an object carrying at least one of
 * `upTo`, `maxAge` or `minAge` — the three ways this package writes "this row
 * applies up to here". Found by walking the tree because a list of field names is a
 * second copy of the type and drifts towards being short; that is Day 34's rule and
 * it cost four separate bugs to learn.
 *
 * The walk deliberately finds MORE than this file probes. Rate schedules
 * (`rate.byStatus`), Ohio's base-amount schedule and New Jersey's exclusion tiers
 * are all staircases by this definition and are covered by other files. Finding
 * them here and requiring each to be accounted for is the point: a chart added
 * tomorrow cannot be neither probed nor claimed.
 */
export function stepCharts(definition) {
  const out = [];
  const walk = (node, path, seen) => {
    if (node === null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (isStaircase(node)) {
      out.push({ path, steps: node, payload: payloadOf(node) });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((value, i) => walk(value, `${path}[${i}]`, seen));
      return;
    }
    for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key, seen);
  };
  walk(definition, '', new WeakSet());
  return out;
}

// `from` is the fourth, and it is a FLOOR rather than a ceiling: Connecticut's
// personal tax credit and its pension phase-out are both written as "the row
// that begins here", which is how both § 12-703 and Public Act 23-204 print
// them. Adding it to this list is what made those two tables visible to this
// instrument at all — until Day 39 the vocabulary was ceilings only, and 254
// numbers across eight charts were neither probed nor claimed while the file
// reported a clean sweep.
//
// **THE RULE: a shape-based finder is only as broad as its vocabulary of
// shapes, and a vocabulary is a list of names, which is the thing Day 34 says
// drifts towards being short.** The tell was not in this file: it was a
// `checked` count that went up by 104 when a state arrived carrying 254 more.
const BOUNDS = ['upTo', 'maxAge', 'minAge', 'from'];

/** Whether a chart is indexed by the floor of each row rather than its ceiling. */
export const isFloorChart = (steps) =>
  steps.length > 0 && steps.every((s) => typeof s.from === 'number');

function isStaircase(node) {
  if (!Array.isArray(node) || node.length === 0) return false;
  return node.every(
    (entry) =>
      entry !== null &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      BOUNDS.some((k) => typeof entry[k] === 'number' || (k === 'upTo' && entry[k] === null)),
  );
}

/**
 * What a row of the chart pays or charges: `amount` for the credit staircases this
 * file probes, otherwise the first other numeric key, which names the family.
 */
function payloadOf(steps) {
  const keys = new Set();
  for (const entry of steps) for (const [k, v] of Object.entries(entry)) if (!BOUNDS.includes(k) && typeof v === 'number') keys.add(k);
  if (keys.has('amount')) return 'amount';
  return [...keys].sort().join('+') || 'none';
}

/** Whether a chart is banded on an age rather than on an income. */
export const isAgeChart = (steps) => steps.some((s) => s.maxAge !== undefined || s.minAge !== undefined);

/**
 * The probe values for one chart — one per step, plus, for an age chart, the ages
 * either side of every boundary.
 *
 * Called ONLY by the regenerator. The test reads the values back out of the
 * fixture, because a probe recomputed from the table at test time moves with the
 * mutation it is supposed to catch.
 */
export function probeValues(steps) {
  if (isAgeChart(steps)) {
    const ages = new Set();
    for (const band of steps) {
      if (typeof band.maxAge === 'number') {
        ages.add(band.maxAge);
        ages.add(band.maxAge + 1);
      }
      if (typeof band.minAge === 'number') {
        ages.add(band.minAge);
        if (band.minAge > 0) ages.add(band.minAge - 1);
      }
    }
    ages.add(0);
    return [...ages].sort((a, b) => a - b);
  }
  // A floor chart is probed against each row's CEILING, which is one less than
  // the next row's floor — the mirror of the ceiling chart's "just inside,
  // against the floor".
  //
  // The placement has to do two jobs and only this end of the row does both. A
  // mutation doubles `from[i]`, and a probe anywhere inside row `i` is below
  // `2·from[i] + 1` and so falls into row `i-1`, which moves the answer. But
  // the PAYLOAD of a Connecticut row is a fraction of the tax, and at the floor
  // of the first credit row the filer's exemption has taken their tax to about
  // a penny — so a probe there catches the boundary and cannot catch the
  // fraction. At the ceiling of the row both move.
  //
  // The last row has no next floor, so it is probed one dollar above its own.
  if (isFloorChart(steps)) {
    return steps.map((step, i) =>
      i + 1 < steps.length ? Math.floor(steps[i + 1].from) - 1 : Math.floor(step.from) + 1,
    );
  }
  const values = [];
  for (let i = 0; i < steps.length; i++) {
    if (i === 0) {
      const top = steps[0].upTo;
      values.push(top === null || top === undefined ? 1 : Math.max(1, Math.floor(top / 2)));
      continue;
    }
    const floor = steps[i - 1].upTo;
    if (floor === null || floor === undefined) continue;
    values.push(Math.floor(floor) + 1);
  }
  return values;
}

// ---------------------------------------------------------------------------
// The drivers
// ---------------------------------------------------------------------------

/** § 63(c) as amended by OBBBA § 70102. A probe input, not a shipped figure. */
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
 * One probe return.
 *
 * Everything the shape declares goes through by rest spread, for the reason
 * `status-households.mjs` gives: the version of this that listed the fields to copy
 * dropped two of them silently, and a household built to reach a rule then proved
 * the rule unreachable.
 */
function probeReturn(state, year, filingStatus, shape) {
  const { income, deduction, deductionKind, federalEarnedIncomeCredit, federalIncomeTax, ...rest } =
    shape;
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
      ...(federalEarnedIncomeCredit === undefined ? {} : { earnedIncomeCredit: federalEarnedIncomeCredit }),
      ...(federalIncomeTax === undefined
        ? {}
        : { incomeTaxBeforeRefundableCredits: federalIncomeTax }),
    },
    pennsylvaniaTaxableIncome: income,
    pennsylvaniaEligibilityIncome: income,
    newJerseyGrossIncome: income,
    massachusettsFivePercentIncome: income,
    qualifyingWages: shape.earnedIncome,
    ...rest,
  };
}

/** A wage earner of 45 whose federal AGI is the probe value. */
const wages = (value, state, year, filingStatus, extra = {}) =>
  probeReturn(state, year, filingStatus, {
    income: value,
    earnedIncome: value,
    filerAge: 45,
    spouseAge: 44,
    socialSecurityAndMedicarePaid: Math.round(value * 0.0765 * 100) / 100,
    ...extra,
  });

/**
 * A retiree at 67 whose RETIREMENT income is the probe value and whose total income
 * is held at `$40,000` — under every income limit the retirement charts sit behind,
 * so that the chart itself is what the probe varies.
 *
 * `$40,000` rather than the probe value, because a credit banded on retirement
 * income and gated on total income needs the two to move independently: a probe
 * that raised both would stop distinguishing the band from the gate.
 */
const retiree = (value, state, year, filingStatus) =>
  probeReturn(state, year, filingStatus, {
    income: 40_000,
    earnedIncome: Math.max(0, 40_000 - value),
    filerAge: 67,
    spouseAge: 67,
    retirement: { filer: { employerPlanPension: value }, spouse: {} },
    retirementIncome: value,
    socialSecurityAndMedicarePaid: Math.round(Math.max(0, 40_000 - value) * 0.0765 * 100) / 100,
  });

/**
 * Which probe input each family of staircase is read against, and which filing
 * statuses the probe is run under.
 *
 * Keyed by the chart's path with a `ByStatus` key replaced by `<status>`, so one
 * entry serves all five columns of a per-status chart and the probe is run under
 * the status whose column it is — which is the whole point of a per-status chart
 * and the thing Day 34 found nine states missing.
 */
const STATUS_KEYS = [
  'single',
  'marriedFilingJointly',
  'marriedFilingSeparately',
  'headOfHousehold',
  'qualifyingSurvivingSpouse',
];

/**
 * A retiree of 67 whose FEDERAL AGI is the probe value and whose pension is held
 * at `$30,000`.
 *
 * The mirror of {@link retiree}, and Connecticut is why both exist. Ohio's
 * retirement credit bands on the retirement income and gates on the total, so
 * its probe varies the pension and holds the income. Connecticut's pension
 * phase-out bands on FEDERAL AGI and applies a fraction to the pension, so its
 * probe has to do the opposite — vary the income and hold the pension — or the
 * fraction being probed would have nothing to be a fraction of.
 */
const pensionerAtAgi = (value, state, year, filingStatus) =>
  probeReturn(state, year, filingStatus, {
    income: value,
    earnedIncome: Math.max(0, value - 30_000),
    filerAge: 67,
    spouseAge: 67,
    retirement: { filer: { employerPlanPension: 30_000 }, spouse: {} },
    retirementIncome: 30_000,
    socialSecurityAndMedicarePaid: Math.round(Math.max(0, value - 30_000) * 0.0765 * 100) / 100,
  });

export const DRIVERS = {
  // Connecticut's personal tax credit, Conn. Gen. Stat. § 12-703 — 27 non-zero
  // rows per status, read against Connecticut AGI, which for a wage earner is
  // federal AGI.
  'personalTaxCredit.steps.<status>': {
    perStatus: true,
    input: (value, state, year, status) => wages(value, state, year, status),
  },
  // Connecticut's pension, annuity and IRA phase-out, Public Act 23-204 § 93 —
  // read against FEDERAL AGI, so the probe varies the income and holds the
  // pension. See `pensionerAtAgi`.
  'retirementSubtractionSchedule.schedule.<status>': {
    perStatus: true,
    input: (value, state, year, status) => pensionerAtAgi(value, state, year, status),
  },
  // Maryland's and Ohio's personal exemption staircases. Maryland reads federal
  // AGI, Ohio its own modified AGI; a wage return makes the two the same number,
  // so one driver serves both and the difference is `stepsMeasuredOn`'s business.
  // One dependent, so the per-exemption amount is multiplied by more than one and
  // the count is exercised rather than assumed.
  'exemption.perExemptionSteps.<status>': {
    perStatus: true,
    input: (value, state, year, status) => wages(value, state, year, status, { dependentAges: [10] }),
  },
  // Alabama's dependent exemption chart, Ala. Code § 40-18-19(a)(9), read against
  // ALABAMA AGI — which for a wage earner is federal AGI, so the same `wages`
  // driver serves it.
  //
  // It is the first chart in this package with **no status column at all**: one
  // table serves all five filing statuses, which is why two single parents at
  // $50,000 each claim $1,000 a child and the same two people jointly on
  // $100,000 claim $500. So the probes run under two statuses rather than one,
  // and the pinned pair is the evidence that the joint return reads the same
  // chart rather than a doubled one.
  //
  // One dependent, so the chart's amount is the whole of the difference and the
  // count is not multiplying it.
  'exemption.perDependentSteps': {
    statuses: ['single', 'marriedFilingJointly'],
    input: (value, state, year, status) => wages(value, state, year, status, { dependentAges: [10] }),
  },
  // Missouri's federal income tax deduction chart, § 143.171.2 — the only
  // staircase in this package whose STEP is a percentage of a figure from
  // another government's return, and the only one that is a cliff rather than
  // a phase-out: one percentage applies to the whole federal bill and the
  // boundary belongs to the step below it.
  //
  // The federal tax is HELD CONSTANT at $8,000 while the income varies, which
  // is the whole design of this probe. A realistic household would move both
  // at once — more income is more federal tax — and the probe would then be
  // measuring the product of two schedules instead of this chart. $8,000 is
  // large enough that 5% of it is visible and small enough that the $5,000 cap
  // never binds, so what the probe sees is the percentage and nothing else.
  // And the probe household ITEMIZES, with $2,000 of federal deductions. That
  // is not decoration either. The chart's first row is probed at half its
  // ceiling — $12,500 — and Missouri's standard deduction IS the federal one,
  // so a $16,100 standard deduction leaves a filer there with no Missouri
  // taxable income at all and the 35% row could not be probed. IRC
  // § 63(c)(6)(A) supplies the household: a married filer whose spouse
  // itemizes must itemize too, however little they have.
  'federalIncomeTaxDeduction.rateSteps': {
    statuses: ['single', 'marriedFilingSeparately'],
    input: (value, state, year, status) =>
      probeReturn(state, year, status, {
        income: value,
        earnedIncome: value,
        filerAge: 45,
        spouseAge: 44,
        deduction: 2_000,
        deductionKind: 'itemized',
        federalIncomeTax: 8_000,
      }),
  },
  // Ohio's retirement income credit, O.R.C. 5747.055 — the chart that is the
  // worked example for why this file exists.
  'retirementIncomeCredit.steps': {
    statuses: ['single'],
    input: (value, state, year, status) => retiree(value, state, year, status),
  },
  // Ohio's joint filing credit. Joint only, by statute: it is a credit for a
  // return with two earners on it, and the engine pays it to nobody else.
  'jointFilingCredit.steps': {
    statuses: ['marriedFilingJointly'],
    input: (value, state, year, status) =>
      wages(value, state, year, status, {
        lesserSpouseIncome: Math.round(value / 3),
        bothSpousesHaveQualifyingIncome: true,
      }),
  },
  // New York's household credit, N.Y. Tax Law § 606(b), read against state AGI.
  'householdCredit.base.<status>': {
    perStatus: true,
    input: (value, state, year, status) => wages(value, state, year, status),
  },
  // The same credit's per-person addition, which is paid only to a return with a
  // second person on it — so the probe carries two dependents and runs under a
  // status that is not `single`, for which the engine pays none of it.
  'householdCredit.perAdditionalPerson': {
    statuses: ['headOfHousehold'],
    input: (value, state, year, status) => wages(value, state, year, status, { dependentAges: [8, 12] }),
  },
  // New Jersey's stepped child credit, banded on New Jersey taxable income, paid
  // per child under six and unavailable on a separate return.
  'steppedChildCredit.steps': {
    statuses: ['marriedFilingJointly'],
    input: (value, state, year, status) => wages(value, state, year, status, { dependentAges: [2, 4] }),
  },
  // New Jersey's retirement exclusion tiers, N.J.S.A. 54A:6-15, banded on gross
  // income — the wall that costs a joint retiree $1,381 on one dollar. The probe
  // puts 30% of the income in a pension and the rest in wages, for two reasons:
  // the pension has to stay under the tier's own maximum so that the PERCENTAGE is
  // what the probe varies rather than the cap, and the wages have to exceed the
  // `$3,000` earned-income limit so that Part II of Worksheet D stays out of it.
  //
  // Run under all five statuses because only the joint percentage is stored: the
  // other four are derived from it through the ratio of their maximums, so a
  // probe that ran joint alone would leave the derivation untested.
  'retirementExclusion.tiers': {
    statuses: STATUS_KEYS,
    input: (value, state, year, status) =>
      probeReturn(state, year, status, {
        income: value,
        earnedIncome: Math.round(value * 0.7),
        filerAge: 67,
        spouseAge: 67,
        retirement: { filer: { employerPlanPension: Math.round(value * 0.3) }, spouse: {} },
        retirementIncome: Math.round(value * 0.3),
      }),
  },
  // The age bands: Maryland's, New York's, Utah's, Georgia's and Massachusetts's.
  // The probe value is the dependent's AGE, so the income is held at a constant
  // `$60,000` — above the point where the credits are clamped to zero and below
  // every phase-out they carry.
  'childCredit.amountByAge': {
    statuses: ['marriedFilingJointly'],
    input: (value, state, year, status) =>
      wages(60_000, state, year, status, { dependentAges: [value] }),
  },
};

/** A chart's path with its `ByStatus` column replaced by `<status>`. */
export function driverKey(path) {
  const tail = path.slice(path.lastIndexOf('.') + 1);
  return STATUS_KEYS.includes(tail) ? `${path.slice(0, path.lastIndexOf('.'))}.<status>` : path;
}

/** The column of a per-status chart, or `*` for one that has no columns. */
export function chartStatus(path) {
  const tail = path.slice(path.lastIndexOf('.') + 1);
  return STATUS_KEYS.includes(tail) ? tail : '*';
}

/**
 * The statuses a chart's probes are run under: its own column if it has one,
 * otherwise whatever the driver declares.
 */
export function driverStatuses(path) {
  const driver = DRIVERS[driverKey(path)];
  if (driver === undefined) return [];
  return driver.perStatus ? [chartStatus(path)] : driver.statuses;
}

/** Build the probe return for one chart, one probe value and one filing status. */
export function probeInput(path, value, state, year, filingStatus) {
  const driver = DRIVERS[driverKey(path)];
  if (driver === undefined) throw new RangeError(`No probe driver for ${path}`);
  return driver.input(value, state, year, filingStatus);
}

/**
 * The figures a probe pins — the same four the status sweep watches, and measured
 * the same way.
 *
 * `credits` matters more here than anywhere else in the suite: a credit staircase
 * at the bottom of its range pays a household whose tax is already zero, so the tax
 * column cannot see it and the credit column can. New York's household credit pays
 * `$75`, `$60`, `$50` and `$45` across four bands that all sit under the first
 * dollar of New York tax.
 */
export const DIGEST_COLUMNS = ['stateAdjustedGrossIncome', 'taxableIncome', 'credits', 'totalTax'];

const cents = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export function digest(result) {
  return [
    cents(result.stateAdjustedGrossIncome),
    cents(result.taxableIncome),
    cents(result.credits.reduce((sum, c) => sum + c.amount, 0)),
    cents(result.totalTax),
  ];
}
