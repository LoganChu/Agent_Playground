/**
 * Everything the calculator computes, with no DOM in it.
 *
 * Kept separate from `app.js` for one reason: it is the only part of the site
 * that can be wrong in a way a reader cannot see. A layout bug is obvious and a
 * tax bug is not, so this file is plain ES modules that both the browser and
 * `node --test` can import, and `site/test/compute.test.js` runs it.
 *
 * The two engines do all the tax work. What lives here is the part that is
 * genuinely the site's own judgement and therefore has to be stated out loud:
 *
 * 1. **Turning a household's actual income into each engine's inputs.** The
 *    federal engine wants Form 1040 lines; three states want a figure that
 *    exists on no federal form at all.
 * 2. **Which local income tax to show.** Two states here levy one on every
 *    resident with no opt-out, and four more levy one in some places and not
 *    others. Reporting a single "state tax" for all six would be wrong in
 *    opposite directions.
 *
 * Neither is hidden. Every derived figure comes back in the result with the
 * reasoning attached, and the page prints it.
 */

import { estimateFederalTax } from '../vendor/us-federal-tax/index.js';
import {
  SUPPORTED_STATES,
  indianaCounties,
  marylandCounties,
  stateIncomeTax,
  stateName,
} from '../vendor/us-state-tax/index.js';

/** Two figures that decide the whole answer and that nothing else supplies. */
export const YEARS = [2026, 2025];

export const FILING_STATUSES = [
  ['single', 'Single'],
  ['marriedFilingJointly', 'Married filing jointly'],
  ['marriedFilingSeparately', 'Married filing separately'],
  ['headOfHousehold', 'Head of household'],
  ['qualifyingSurvivingSpouse', 'Qualifying surviving spouse'],
];

const isJoint = (status) =>
  status === 'marriedFilingJointly' || status === 'qualifyingSurvivingSpouse';

const num = (value) => {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * The income a household actually receives, normalised.
 *
 * Deliberately *not* Form 1040 lines. A person knows what their pension pays and
 * what the SSA deposits; they do not know their taxable Social Security, which
 * is a function of everything else on the return. Working from the receipts and
 * deriving the form is the whole reason this is usable by someone who is not
 * already holding a completed return.
 */
export function normalise(raw) {
  const filingStatus = FILING_STATUSES.some(([id]) => id === raw.filingStatus)
    ? raw.filingStatus
    : 'single';
  return {
    year: YEARS.includes(Number(raw.year)) ? Number(raw.year) : YEARS[0],
    filingStatus,
    joint: isJoint(filingStatus),
    filerAge: Math.max(0, Math.min(120, Math.round(num(raw.filerAge)))),
    spouseAge: Math.max(0, Math.min(120, Math.round(num(raw.spouseAge)))),
    wages: num(raw.wages),
    pension: num(raw.pension),
    ira: num(raw.ira),
    militaryRetirement: num(raw.militaryRetirement),
    socialSecurity: num(raw.socialSecurity),
    interestDividends: num(raw.interestDividends),
    longTermCapitalGains: num(raw.longTermCapitalGains),
    taxExemptInterest: num(raw.taxExemptInterest),
    // Maryland's pension exclusion is claimed per person, so a couple's *total*
    // does not determine their Maryland tax. Which spouse the income belongs to
    // is a real input, not a detail.
    allocation: raw.allocation === 'filer' ? 'filer' : 'even',
  };
}

/** The federal return, from the receipts. */
export function federal(input) {
  return estimateFederalTax({
    filingStatus: input.filingStatus,
    year: input.year,
    w2Wages: input.wages,
    // Pensions, IRA distributions, military retired pay, interest and ordinary
    // dividends are all ordinary income federally. Only the states pull them
    // apart, which is why they are separate fields above and one field here.
    otherOrdinaryIncome:
      input.pension + input.ira + input.militaryRetirement + input.interestDividends,
    longTermCapitalGains: input.longTermCapitalGains,
    socialSecurityBenefits: input.socialSecurity,
    taxExemptInterest: input.taxExemptInterest,
    age65OrOlder: input.filerAge >= 65,
    spouseAge65OrOlder: input.joint && input.spouseAge >= 65,
    age: input.filerAge > 0 ? input.filerAge : undefined,
  });
}

/**
 * The rate on the next $1,000, measured rather than read off a bracket table.
 *
 * Running the whole estimate twice and differencing it is the only way to catch
 * an interaction, and for a retiree the interactions are the answer: § 86 can
 * put $1.85 of taxable income behind each dollar earned, and the OBBBA senior
 * deduction withdraws 6% of the excess for each spouse who is 65. Both at once
 * is 45.58% on a couple whose bracket says 22%.
 */
export function trueMarginalRate(input, fed, stateRows) {
  const bumped = federal({ ...input, wages: input.wages + 1_000 });
  const federalCost = bumped.totalTax - fed.totalTax;
  return {
    increment: 1_000,
    bracket: fed.marginalRate,
    federalCost,
    federalRate: federalCost / 1_000,
    // Reported alongside, not added in: a caller in a no-income-tax state
    // should not see a state figure folded into a federal rate.
    stateRows,
    bumped,
  };
}

// ---------------------------------------------------------------------------
// Turning a household into each state's starting point
// ---------------------------------------------------------------------------

/**
 * Three states begin from a figure that appears on no federal form, so the
 * engine refuses to guess one and asks the caller. That is the right behaviour
 * for a library and useless for a calculator, so the derivations live here —
 * stated, cited and shown on the page rather than folded in silently.
 *
 * Each returns `{ field, amount, note }`.
 */
function stateDefinedBase(state, input) {
  const { wages, pension, ira, militaryRetirement, interestDividends, longTermCapitalGains } =
    input;
  switch (state) {
    case 'PA':
      // Pennsylvania's eight classes of income do not include Social Security,
      // and distributions from an eligible plan after retirement age are not
      // compensation. Military retired pay is exempt. So for a retiree the
      // Pennsylvania base is what they earn and what their investments earn.
      return {
        field: 'pennsylvaniaTaxableIncome',
        amount: wages + interestDividends + longTermCapitalGains,
        note:
          'Pennsylvania taxes eight classes of income and retirement is not among them: ' +
          'distributions from an eligible plan after retirement age, Social Security and ' +
          'military retired pay are all outside the base. Figured here as wages plus ' +
          'investment income, which assumes any pension or IRA money is being drawn after ' +
          'age 59½ — before that it is taxable and this figure is too low.',
      };
    case 'NJ':
      // New Jersey does tax pensions and IRA distributions, does not tax Social
      // Security, and has exempted military pensions entirely since 2017.
      return {
        field: 'newJerseyGrossIncome',
        amount: wages + pension + ira + interestDividends + longTermCapitalGains,
        note:
          'New Jersey enumerates its own categories of income: pensions and IRA ' +
          'distributions are in, Social Security is out, and military pensions have been ' +
          'excluded outright since 2017. This is NJ-1040 line 27, before the retirement ' +
          'exclusion, which the engine then applies.',
      };
    case 'MA':
      // Massachusetts excludes Social Security and contributory US or
      // Massachusetts public pensions — which is what military retired pay is.
      return {
        field: 'massachusettsFivePercentIncome',
        amount: wages + pension + ira + interestDividends + longTermCapitalGains,
        note:
          'Massachusetts starts from its own gross income. Social Security and ' +
          'contributory US or Massachusetts public pensions — military retired pay among ' +
          'them — are excluded; private pensions and IRA distributions are not. Form 1 ' +
          'line 21.',
      };
    default:
      return null;
  }
}

/** Split the retirement income between the two people on the return. */
function retirementSplit(input) {
  const share = input.joint && input.allocation === 'even' ? 0.5 : 1;
  const person = (fraction) => ({
    employerPlanPension: input.pension * fraction,
    iraDistributions: input.ira * fraction,
    militaryRetirement: input.militaryRetirement * fraction,
    socialSecurityBenefits: input.socialSecurity * fraction,
    investmentIncome: (input.interestDividends + input.longTermCapitalGains) * fraction,
    earnedIncome: input.wages * fraction,
  });
  if (!input.joint) return { filer: person(1) };
  return { filer: person(share), spouse: person(1 - share) };
}

/**
 * Local income tax, which is not a rounding error and is not optional.
 *
 * Every Maryland and Indiana resident owes a county income tax — there is no
 * county-free jurisdiction in either state — so a "state tax" for those two that
 * leaves it out is not a smaller number, it is a wrong one. Both are reported as
 * the range across the state's own jurisdictions, cheapest to dearest, because
 * the choice is a real one a person makes by moving twenty miles.
 *
 * New York, Ohio and Michigan levy local income taxes in *some* places, so
 * there the state figure is right for most residents and the local tax is
 * flagged rather than assumed.
 */
const LOCAL = {
  MD: {
    kind: 'universal',
    label: 'Maryland county income tax',
    jurisdictions: (year) => marylandCounties(year).map((c) => ({ county: c.code })),
  },
  IN: {
    kind: 'universal',
    label: 'Indiana county income tax',
    jurisdictions: (year) => indianaCounties(year).map((c) => ({ county: c.code })),
  },
  NY: {
    kind: 'some',
    note:
      'New York City residents owe a city income tax of up to 3.876% on top of this, and ' +
      'Yonkers residents a surcharge of 16.75% of their state tax. Everywhere else in the ' +
      'state owes neither.',
  },
  OH: {
    kind: 'some',
    note:
      '679 Ohio municipalities charge 0.45% to 3.00% on qualifying wages, and 214 school ' +
      'districts levy their own income tax. Neither is in this figure. For a retiree the ' +
      'municipal tax is usually nil — it falls on wages — but a school district tax on the ' +
      'traditional base reaches pension income.',
  },
  MI: {
    kind: 'some',
    note:
      '24 Michigan cities charge a resident income tax, Detroit at 2.4%. Not in this figure.',
  },
};

function withLocal(state, input, base) {
  const rule = LOCAL[state];
  if (!rule || rule.kind !== 'universal') {
    return { localNote: rule?.note ?? null, localRange: null };
  }
  let low = null;
  let high = null;
  for (const jurisdiction of rule.jurisdictions(input.year)) {
    let result;
    try {
      result = stateIncomeTax({ ...base, ...jurisdiction });
    } catch {
      continue;
    }
    const local = result.totalTax - result.tax;
    const row = { name: jurisdiction.county, local, total: result.totalTax };
    if (low === null || local < low.local) low = row;
    if (high === null || local > high.local) high = row;
  }
  return { localNote: rule.label, localRange: low && high ? { low, high } : null };
}

/** One state's answer, or an explanation of why there isn't one. */
export function forState(state, input, fed) {
  const base = {
    state,
    year: input.year,
    filingStatus: input.filingStatus,
    federal: {
      adjustedGrossIncome: fed.adjustedGrossIncome,
      taxableIncome: fed.taxableIncome,
      deduction: fed.deduction,
      deductionKind: fed.deductionKind,
      earnedIncomeCredit: fed.credits.earnedIncomeCredit?.credit ?? 0,
    },
    filerAge: input.filerAge || undefined,
    spouseAge: input.joint ? input.spouseAge || undefined : undefined,
    taxableSocialSecurity: fed.socialSecurity?.taxableBenefits ?? 0,
    // Utah adds the exempt coupon back into the income its retirement credits
    // are withdrawn against, so a municipal bond is taxed at 2.5% there while
    // appearing on no line of Utah income. Every other state ignores this.
    taxExemptInterest: input.taxExemptInterest,
    retirement: retirementSplit(input),
    earnedIncome: input.wages,
  };

  const derived = stateDefinedBase(state, input);
  if (derived) base[derived.field] = derived.amount;

  let result;
  try {
    result = stateIncomeTax(base);
  } catch (error) {
    return { state, stateName: stateName(state), error: String(error.message ?? error) };
  }

  const { localNote, localRange } = withLocal(state, input, base);
  return {
    state,
    stateName: result.stateName,
    hasIncomeTax: result.hasIncomeTax,
    tax: result.tax,
    total: result.totalTax,
    // A range where a local tax is universal, so the single figure above is
    // never mistaken for the whole bill.
    localRange,
    localNote,
    derived,
    result,
  };
}

/** Every state, cheapest first, with the ties broken by name so it is stable. */
export function allStates(input, fed) {
  const rows = SUPPORTED_STATES.map((state) => forState(state, input, fed));
  const rank = (row) =>
    row.error ? Number.POSITIVE_INFINITY : (row.localRange ? row.localRange.low.total : row.total);
  return rows.sort((a, b) => rank(a) - rank(b) || a.stateName.localeCompare(b.stateName));
}

/** The whole answer, in one call. */
export function compute(raw) {
  const input = normalise(raw);
  const fed = federal(input);
  const states = allStates(input, fed);
  return {
    input,
    federal: fed,
    states,
    marginal: trueMarginalRate(input, fed),
    // What the household actually received, which is not `grossIncome`: up to
    // 100% of a Social Security benefit never enters that figure at all.
    received:
      input.wages +
      input.pension +
      input.ira +
      input.militaryRetirement +
      input.socialSecurity +
      input.interestDividends +
      input.longTermCapitalGains +
      input.taxExemptInterest,
  };
}
