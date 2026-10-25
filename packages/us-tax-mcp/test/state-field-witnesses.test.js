// THE GATES, MEASURED IN BOTH DIRECTIONS.
//
// `STATE_FIELDS` pairs every argument of `state_income_tax` with the states that
// read it, and the loop at the end of that tool REFUSES the argument for any
// other state. The refusal is deliberate and the module's header argues for it:
// a silently ignored field is a wrong answer with no symptom.
//
// A refusal is only as good as the list behind it, and the lists have now been
// wrong twice, both times in the direction that costs money.
//
// ## Day 51: eleven lists too NARROW
//
//   taxableSocialSecurity   15 states, up to $1,206.16 of Minnesota tax
//   dependentAges           10 states, including South Carolina's under-6 deduction
//   retirementIncome         8 states
//   spouseAge                6 states
//   filerAge                 5 states
//   stateItemizedDeductions  3; netCapitalGain, lesserSpouseIncome 2 each;
//   socialSecurityAndMedicarePaid, propertyTaxPaid, rentPaid 1 each
//
// ## Day 53: eight more, found by a LADDER rather than by a single value
//
//   stateItemizedDeductions  AZ   $1,856.25   A.R.S. § 43-1042 — an Arizona
//                                             filer may itemize whether or not
//                                             they itemized federally
//   filerAge                 MO   $1,598.00   § 143.125 — the whole taxable
//                                             Social Security benefit from 62
//   earnedIncome             NJ     $420.00   § 54A:6-15 Part II, whose $3,000
//                                             limit an omitted field FAILS
//   filerAge                 AL     $300.00   a defined contribution draw is
//                                             taxed above $6,000 and from 65
//   spouseHasNoGross…        OR     $263.00   the § 151(b) spouse as an
//                                             exemption CREDIT, not an exemption
//   dependentAges            CT     $250.00   § 12-704e's child bonus, which
//                                             reads `ages.some(a => a <= 18)`
//   federalItemized          SC      $90.00   a 2025 itemizer owes no
//                                             standard-deduction add-back
//   pennsylvaniaSpouse…      PA     $982.40   accepted, documented, and never
//   separatedFromSpouse      PA                read by the handler at all
//
// The last two are a different defect from the other six and the one this file
// exists to make impossible: those two fields were in `STATE_FIELDS`, so they
// were in the input schema, in `describe_state`'s Pennsylvania section and in
// the accepted-argument list — and `tools.ts` never mentioned either of them.
// **The gate decided whether a field was ACCEPTED for a state and nothing
// decided whether an accepted field was ever USED.**
//
// ## The three parts, and why the shape is what it is
//
// 1. **The gate is not too NARROW.** For every (field, state) pair the table does
//    NOT declare, no household may move that state's tax. This goes round the
//    gate on purpose — the gate is the thing under test — by calling the engine
//    with each argument mapped to its engine input.
// 2. **The gate is not too WIDE.** Every pair the table DOES declare must have a
//    witness: a household in which supplying the field changes the answer. A
//    declared pair with no witness is `describe_state` telling a caller to supply
//    a figure nothing reads, and the only pairs allowed to have none are the ones
//    in {@link UNWITNESSED}, each with its reason.
// 3. **Every derivation path is live.** `state-fields.ts` derives seven lists
//    from dotted paths into the definitions. The compiler proves the first
//    segment is a real key; nothing can prove the rest, so a path that matches
//    no state-year in either year is a place the derivation does not look.
//
// ## The asymmetry, stated once
//
// The two errors are not the same size. Too wide is accept-and-ignore, which is
// silent and mild and which the engine itself often narrates in a note. Too
// narrow is a refusal whose message NAMES the states that do read the field, so
// the caller is argued out of looking — and on Day 53 that was worth up to
// $1,856.25 on one return. So where a derivation has to guess, it guesses wide,
// and this file reports both directions rather than only the cheap one.
//
// ## And the three ways a probe fails to see a rule
//
// Every one of the eight above was invisible to the Day 51 probe for a reason
// worth keeping, because each is a way a measurement can be confidently wrong:
//
// - **A single probe value above a rule's own limit.** `earnedIncome: 12_000`
//   cannot see New Jersey's $3,000 ceiling. Hence a LADDER per field.
// - **A baseline that is not the caller's baseline.** Comparing two supplied
//   values cannot see what OMITTING the field costs, and omission is exactly
//   what a refusal forces. Hence `undefined` as every ladder's first rung.
// - **A household the battery cannot express.** Connecticut's tax-exempt
//   interest only moves inside a window about $5,000 of AGI wide, Oregon's
//   retirement credit needs household income under $15,000, and a per-person
//   rule read through `spouseAge` needs the retirement income on the SPOUSE.
//   Hence the shapes below, each named for the rule that demanded it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STATE_FIELDS, DERIVATION_PATHS } from '../dist/state-fields.js';
import { findTool } from '../dist/tools.js';
import { estimateFederalTax } from '../dist/engine/index.js';
import {
  stateIncomeTax,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
  marylandCounties,
  indianaCounties,
  michiganCities,
  ohioMunicipalities,
  ohioSchoolDistricts,
  SUPPORTED_LOCALITIES,
  localityState,
} from '../dist/state-engine/index.js';

const tool = findTool('state_income_tax');

const byRate = (list) => [...list].sort((a, b) => (b.rate?.rate ?? 0) - (a.rate?.rate ?? 0)).map((d) => d.code);
const CITY = { MI: byRate(michiganCities(2026)), OH: byRate(ohioMunicipalities(2026)) };
const COUNTY = { MD: byRate(marylandCounties(2026)), IN: byRate(indianaCounties(2026)) };
const SCHOOL = { OH: byRate(ohioSchoolDistricts(2026)) };

/**
 * The same registries ordered by NONRESIDENT rate, which is a different order
 * and the one a commuting pair has to be chosen from.
 *
 * A resident credit for tax paid to another municipality is capped at the HOME
 * city's own nonresident rate applied to the income the other city taxed — so
 * wherever the work city's rate is at or below that, the credit cancels the work
 * city's tax exactly and `workCityEarnings` is worth nothing. Detroit resident
 * to Albion gives `$5,719.85` whether the work earnings are `$0` or `$40,000`;
 * Albion resident to Detroit gives `$4,468.25` and `$4,744.05`. **The credit is
 * incomplete in exactly one direction, and a probe that picks its pair by the
 * resident rate picks the direction where there is nothing to see.**
 */
const byNonresidentRate = (list) =>
  [...list]
    .sort((a, b) => (b.nonresidentEarningsRate ?? 0) - (a.nonresidentEarningsRate ?? 0))
    .map((d) => d.code);
const COMMUTE = {
  MI: byNonresidentRate(michiganCities(2026)),
  OH: byNonresidentRate(ohioMunicipalities(2026)),
};
/** [home, work] — the home city with the lowest cap, the work city with the highest rate. */
const commutePair = (state) => {
  const order = COMMUTE[state];
  return order === undefined ? undefined : [order[order.length - 1], order[0]];
};
const localityOf = (state) => SUPPORTED_LOCALITIES.filter((l) => localityState(l) === state);

/**
 * The household shapes. Each line after the first five is here because a rule
 * could not be witnessed without it, and says which.
 */
const SHAPES = [
  { label: 'worker-verylow', wages: 9_000, age: 35 },
  { label: 'worker-low', wages: 14_000, age: 40, dependentAges: [4, 8] },
  { label: 'worker-mid', wages: 62_000, age: 40 },
  { label: 'worker-kids', wages: 85_000, age: 44, dependentAges: [2, 7, 19] },
  { label: 'worker-high', wages: 400_000, age: 45, ltcg: 60_000 },
  // New Jersey's retirement exclusion begins at 62 and Oregon's credit at 62.
  { label: 'near62', wages: 20_000, pension: 18_000, ss: 10_000, age: 63, spouseAge: 62 },
  { label: 'retiree', wages: 0, pension: 40_000, ss: 24_000, age: 70, spouseAge: 70 },
  { label: 'retiree-rich', wages: 0, pension: 90_000, ss: 40_000, ira: 30_000, age: 72, spouseAge: 68, ltcg: 40_000 },
  { label: 'mixed-aged', wages: 30_000, pension: 20_000, ss: 12_000, age: 66, spouseAge: 64, dependentAges: [10] },
  // ORS 316.157's retirement income credit is reduced dollar for dollar by
  // household income over $15,000 ($30,000 joint), so it reaches nobody in any
  // shape above.
  { label: 'retiree-tiny', wages: 0, pension: 7_500, ss: 0, age: 70, spouseAge: 70 },
  // Connecticut charges 25% of the LESSER of the gross benefit and the § 86
  // combined income excess, and tax-exempt interest moves only the excess — so
  // it matters only where the excess is the smaller of the two, which needs a
  // benefit near the statutory maximum AND federal AGI within about $5,000 of
  // the $100,000 threshold. The window is real and nothing else here is in it.
  { label: 'ct-window', wages: 0, pension: 32_000, ss: 80_000, age: 70, spouseAge: 70 },
  // A per-person rule read through `spouseAge` has nothing to attach to when
  // every shape puts the retirement income on the filer.
  { label: 'spouse-retiree', wages: 0, age: 50, spouseAge: 70, onSpouse: true, pension: 60_000, ss: 30_000, ira: 20_000 },
  { label: 'spouse-aged', wages: 40_000, age: 45, spouseAge: 80, onSpouse: true, pension: 30_000, ss: 18_000 },
];

const STATUSES = ['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold'];

/**
 * The households, with the federal block from the REAL federal engine.
 *
 * Day 52's rule: a test that supplies its own premise can only check the
 * arithmetic after the premise. Every aged household in that day's batteries had
 * been handed a forty-year-old's standard deduction, so they were households
 * nobody could file and the answers about them were answers about nobody.
 */
const HOUSEHOLDS = [];
for (const year of SUPPORTED_YEARS) {
  for (const filingStatus of STATUSES) {
    const joint = filingStatus === 'marriedFilingJointly';
    for (const shape of SHAPES) {
      for (const itemizing of [false, true]) {
        const income = (shape.wages ?? 0) + (shape.pension ?? 0) + (shape.ira ?? 0);
        const itemAmount = Math.round(income * 0.35) + 26_000;
        const fed = estimateFederalTax({
          filingStatus,
          year,
          w2Wages: shape.wages ?? 0,
          otherOrdinaryIncome: (shape.pension ?? 0) + (shape.ira ?? 0),
          longTermCapitalGains: shape.ltcg ?? 0,
          socialSecurityBenefits: shape.ss ?? 0,
          age65OrOlder: (shape.age ?? 40) >= 65,
          spouseAge65OrOlder: joint && (shape.spouseAge ?? 0) >= 65,
          age: shape.age,
          ...(itemizing ? { itemizedDeductions: itemAmount } : {}),
        });
        const retirement = shape.onSpouse
          ? {
              filer: { earnedIncome: shape.wages ?? 0 },
              spouse: {
                employerPlanPension: shape.pension ?? 0,
                definedContributionPlan: shape.ira ?? 0,
                iraDistributions: shape.ira ?? 0,
                socialSecurityBenefits: shape.ss ?? 0,
              },
            }
          : {
              filer: {
                employerPlanPension: shape.pension ?? 0,
                definedContributionPlan: shape.ira ?? 0,
                iraDistributions: shape.ira ?? 0,
                socialSecurityBenefits: shape.ss ?? 0,
                earnedIncome: shape.wages ?? 0,
              },
            };
        HOUSEHOLDS.push({
          label: `${shape.label}/${filingStatus}/${year}/${itemizing ? 'item' : 'std'}`,
          income,
          itemAmount,
          fed,
          args: {
            year,
            filingStatus,
            federalAdjustedGrossIncome: fed.adjustedGrossIncome,
            federalTaxableIncome: fed.taxableIncome,
            federalDeduction: fed.deduction,
            ...(fed.deductionKind === 'itemized'
              ? { federalItemized: true, stateItemizedDeductions: itemAmount - 6_000 }
              : {}),
            federalEarnedIncomeCredit: fed.credits.earnedIncomeCredit?.credit ?? 0,
            federalIncomeTax:
              Math.max(0, fed.incomeTaxBeforeCredits - fed.credits.totalNonRefundable) +
              fed.netInvestmentIncomeTax,
            federalAdditionalChildTaxCredit: fed.credits.childTaxCredit?.refundableCredit ?? 0,
            taxableSocialSecurity: fed.socialSecurity?.taxableBenefits ?? 0,
            ...(shape.dependentAges ? { dependentAges: shape.dependentAges } : {}),
            filerAge: shape.age,
            ...(joint && shape.spouseAge ? { spouseAge: shape.spouseAge } : {}),
            earnedIncome: shape.wages ?? 0,
            ...(shape.pension || shape.ira || shape.ss
              ? { retirementIncome: (shape.pension ?? 0) + (shape.ira ?? 0), retirement }
              : {}),
          },
        });
      }
    }
  }
}

/** The four argument names that are not engine input names: they live in `federal`. */
const IN_FEDERAL = {
  federalItemized: 'deductionKind',
  federalIncomeTax: 'incomeTaxBeforeRefundableCredits',
  federalAdditionalChildTaxCredit: 'additionalChildTaxCredit',
  federalRefundableAmericanOpportunityCredit: 'refundableAmericanOpportunityCredit',
};

const FULL_RETIREMENT = {
  filer: {
    employerPlanPension: 24_000,
    socialSecurityBenefits: 18_000,
    militaryRetirement: 12_000,
    governmentPension: 9_000,
    iraDistributions: 6_000,
    earnedIncome: 5_000,
    investmentIncome: 3_000,
    definedContributionPlan: 4_000,
    totallyDisabled: true,
    serviceMonthsBefore1998: 120,
    serviceMonthsAfter1997: 120,
    survivorPension: 7_000,
    survivorMilitaryRetirement: 8_000,
    deceasedSpouseAge: 72,
  },
};

/**
 * The value ladder per field, ALWAYS starting from the field omitted.
 *
 * One value cannot straddle a limit and two supplied values cannot show what
 * saying nothing costs. Both mistakes were made and both cost money.
 */
function ladder(field, state) {
  const rest = (() => {
    switch (field.name) {
      case 'dependentAges':
        return [[4, 8], [2, 17], [19, 22], [1, 30]];
      case 'county':
        return COUNTY[state] ?? null;
      case 'city':
        return CITY[state] ?? null;
      case 'workCity':
        return workCityLadder(state);
      case 'schoolDistrict':
        return SCHOOL[state] ?? null;
      case 'locality': {
        const l = localityOf(state);
        return l.length ? l : null;
      }
      case 'retirement':
        // The pension-only rung is here because of Oregon. ORS 316.157 reduces
        // the credit's base by the GROSS Social Security benefit, and
        // FULL_RETIREMENT carries `$18,000` of it — enough to wipe out a base of
        // `$7,500` — so a ladder of "nothing" and "everything" reported Oregon
        // as reading no retirement income at all. **A maximal probe value is not
        // a safe probe value where a rule SUBTRACTS one of the things it
        // contains.**
        return [{ filer: {} }, { filer: { employerPlanPension: 24_000 } }, FULL_RETIREMENT];
      case 'federalPovertyGuideline':
        return [0, 20_000, 40_000, 80_000];
      case 'stateItemizedDeductions':
        return [0, 12_000, 40_000, 90_000];
      case 'residentCreditRate':
      case 'residentCreditLimitRate':
        return [0, 0.5, 1];
      case 'filerAge':
      case 'spouseAge':
        return [25, 50, 60, 62, 65, 70, 74, 80, 100];
      default:
        break;
    }
    switch (field.schema?.type) {
      case 'number':
        return [0, 2_500, 30_000, 120_000];
      case 'boolean':
        return [false, true];
      case 'integer':
        return [0, 1, 3];
      default:
        return null;
    }
  })();
  if (rest === null) return null;
  const trimmed = rest.filter((v) => v !== undefined);
  return trimmed.length === 0 ? null : [undefined, ...trimmed];
}

/**
 * The co-inputs a field needs before it can reach anything, per state.
 *
 * Every entry is a rule that gates one field behind another: Arizona's quarter
 * of a long-term gain is allowed only where there is a net capital gain overall,
 * Virginia's spouse tax adjustment only where both spouses had income, Ohio's
 * resident credit only where the filer lives in one taxing municipality and
 * works in another.
 */
function coInputs(name, state) {
  const out = [{}];
  const cities = CITY[state] ?? [];
  const sd = SCHOOL[state] ?? [];
  const counties = COUNTY[state] ?? [];
  const commute = commutePair(state);
  switch (name) {
    case 'cityIncome':
    case 'qualifyingWages':
    case 'businessIncome':
    case 'bothSpousesHaveQualifyingIncome':
      if (cities[0]) out.push({ city: cities[0] });
      if (sd[0]) out.push({ schoolDistrict: sd[0], qualifyingWages: 50_000 });
      if (state === 'VA') out.push({ lesserSpouseIncome: 5_000 });
      break;
    case 'city':
      out.push({ qualifyingWages: 50_000 });
      out.push({ cityIncome: 50_000 });
      break;
    case 'workCity':
      out.push({ workCityEarnings: 40_000, qualifyingWages: 90_000, cityIncome: 90_000 });
      if (commute) {
        out.push({ city: commute[0], workCityEarnings: 40_000, qualifyingWages: 90_000, cityIncome: 90_000 });
      }
      break;
    case 'workCityEarnings':
      if (commute) {
        out.push({
          city: commute[0],
          workCity: commute[1],
          qualifyingWages: 90_000,
          cityIncome: 90_000,
        });
      }
      break;
    case 'residentCreditRate':
    case 'residentCreditLimitRate':
      if (cities[1]) {
        out.push({ city: cities[0], workCity: cities[1], workCityEarnings: 50_000, qualifyingWages: 90_000 });
      }
      if (commute) {
        out.push({
          city: commute[0],
          workCity: commute[1],
          workCityEarnings: 50_000,
          qualifyingWages: 90_000,
          cityIncome: 90_000,
        });
      }
      break;
    case 'schoolDistrict':
      out.push({ qualifyingWages: 60_000 });
      break;
    case 'yonkersNonresidentEarnings':
      for (const l of localityOf(state)) out.push({ locality: l });
      break;
    case 'longTermCapitalGainAfter2011':
      out.push({ netCapitalGain: 60_000 });
      break;
    case 'netCapitalGain':
      out.push({ longTermCapitalGainAfter2011: 40_000 });
      break;
    // DAY 61, AND THIS CASE IS THE FINDING RATHER THAN THE FIX. The short-term
    // figure is an AMOUNT in Massachusetts, which taxes it at 8.5% on a line of
    // its own, and a REDUCTION in Wisconsin, South Carolina and North Dakota,
    // whose long-term exclusions net the short-term items out of their base
    // first. In those three it moves nothing at all unless `netCapitalGain` is
    // supplied beside it, because Form 1040 line 7 is where the long-term half
    // is read from — so the one-field ladder found the field dead in all three,
    // and the gate list that refused it to all three looked harmless for
    // eighteen days. `shortTermCapitalGains` was declared for Massachusetts
    // alone until Day 61.
    //
    //   A GATE LIST IS GUARDED BY A WITNESS, AND A WITNESS THAT VARIES ONE
    //   FIELD CANNOT SEE A RULE THAT READS TWO. The rule is Day 56's, written
    //   about the engine's unread-field probe; it applies unchanged to the
    //   probe that guards this server's refusals, and nothing had carried it
    //   across.
    case 'shortTermCapitalGains':
      out.push({ netCapitalGain: 60_000 });
      break;
    case 'stateItemizedDeductions':
      out.push({ federalItemized: true });
      break;
    case 'federalAdditionalChildTaxCredit':
    case 'federalRefundableAmericanOpportunityCredit':
      out.push({ federalIncomeTax: 6_000 });
      out.push({ federalIncomeTax: 40_000 });
      break;
    case 'federalPovertyGuideline':
      out.push({ earnedIncome: 9_000 });
      out.push({ earnedIncome: 2_000 });
      break;
    // Va. Code § 58.1-322.03(4): the spouse tax adjustment is claimed only where
    // BOTH spouses had income, so the lesser spouse's figure does nothing
    // without the flag that says there is a lesser spouse.
    case 'lesserSpouseIncome':
    case 'spouseAdjustedFederalAdjustedGrossIncome':
    case 'spouseClaimsAgeDeduction':
      out.push({ bothSpousesHaveQualifyingIncome: true });
      out.push({ bothSpousesHaveQualifyingIncome: true, spouseAdjustedFederalAdjustedGrossIncome: 30_000 });
      break;
    // 72 Pa. Stat. § 7304's forgiveness is a staircase off an allowance, and the
    // spouse's figure only moves it where the claimant is filing separately.
    case 'separatedFromSpouse':
      out.push({ pennsylvaniaSpouseEligibilityIncome: 0 });
      out.push({ pennsylvaniaSpouseEligibilityIncome: 4_000 });
      break;
    case 'pennsylvaniaSpouseEligibilityIncome':
      out.push({ separatedFromSpouse: false });
      break;
    case 'investmentIncome':
      out.push({ earnedIncome: 14_000 });
      break;
    case 'dependentAges':
      out.push({ dependents: 2 });
      out.push({ dependents: 0 });
      break;
    case 'filerAge':
    case 'spouseAge':
      out.push({ retirementIncome: 40_000 });
      break;
    default:
      break;
  }
  if (counties[0]) out.push({ county: counties[0] });
  for (const l of localityOf(state)) out.push({ locality: l });
  if (cities[0]) out.push({ city: cities[0], qualifyingWages: 60_000, cityIncome: 60_000 });
  if (sd[0]) out.push({ schoolDistrict: sd[0], qualifyingWages: 60_000 });
  return out;
}

/**
 * The arguments for one household in one state, with `fieldName` and `extra`
 * merged in and every field the state does not declare taken back out.
 *
 * The removal has to happen AFTER the co-inputs are merged. It did not, for one
 * run of this file, and the consequence is the shape worth remembering: a
 * co-input the state does not declare makes the GATE refuse the call, every call
 * is refused, and a probe whose every call is refused reports no drift at all.
 * `qualifyingWages` is an Ohio field and the Michigan commuting probe was
 * passing it, so four Michigan and Ohio pairs read as unwitnessed when the real
 * answer was that nothing had been asked.
 */
function argsFor(household, state, fieldName, extra = {}, gated = true) {
  const a = { ...household.args, state, ...extra };
  if (state === 'PA') a.pennsylvaniaTaxableIncome = household.income;
  if (state === 'NJ') a.newJerseyGrossIncome = household.income;
  if (state === 'MA') a.massachusettsFivePercentIncome = household.income;
  // `retirement` and `retirementIncome` mask each other, and so do
  // `federalItemized` and `stateItemizedDeductions`: a probe that leaves the
  // masker in place can never witness the masked.
  if (fieldName === 'retirementIncome') delete a.retirement;
  if (fieldName === 'retirement') delete a.retirementIncome;
  if (fieldName === 'federalItemized') delete a.stateItemizedDeductions;
  delete a[fieldName];
  // And every field this state does not declare has to come OUT, or the gate
  // refuses the call and the comparison never happens. A probe whose every call
  // is refused reports no drift at all, which is why the assertions below count
  // the comparisons rather than only reading the verdict.
  // Only for the direction that goes THROUGH the gate. The engine has no gate,
  // so filtering there would throw away the co-input that makes a rule reachable
  // — Arizona's net capital gain is not an Arizona-declared field in Georgia,
  // and the question being asked of Georgia needs it anyway.
  if (gated) {
    for (const other of STATE_FIELDS) {
      if (a[other.name] !== undefined && !other.states.includes(state)) delete a[other.name];
    }
  }
  return a;
}

/** The ladder for `workCity`, ordered so the highest nonresident rate comes first. */
const workCityLadder = (state) => COMMUTE[state] ?? null;

/** The same, as an ENGINE input, for the direction that has to go round the gate. */
function engineInput(household, state, fieldName, extra = {}) {
  const a = argsFor(household, state, fieldName, extra, false);
  const fed = household.fed;
  const input = {
    state,
    year: a.year,
    filingStatus: a.filingStatus,
    federal: {
      adjustedGrossIncome: a.federalAdjustedGrossIncome,
      taxableIncome: a.federalTaxableIncome,
      deduction: a.federalDeduction,
      deductionKind: a.federalItemized === true ? 'itemized' : 'standard',
      earnedIncomeCredit: a.federalEarnedIncomeCredit,
      incomeTaxBeforeRefundableCredits: a.federalIncomeTax,
      additionalChildTaxCredit: a.federalAdditionalChildTaxCredit,
    },
  };
  for (const [key, value] of Object.entries(a)) {
    if (key.startsWith('federal') || ['state', 'year', 'filingStatus'].includes(key)) continue;
    if (value !== undefined) input[key] = value;
  }
  if (fieldName === 'federalItemized') delete input.federal.deductionKind;
  void fed;
  return input;
}

const set = (object, fieldName, value) => {
  const next = { ...object, federal: object.federal ? { ...object.federal } : undefined };
  if (next.federal === undefined) delete next.federal;
  const slot = IN_FEDERAL[fieldName];
  if (slot !== undefined && next.federal !== undefined) {
    if (value === undefined) delete next.federal[slot];
    // `federalItemized` is a BOOLEAN argument and `federal.deductionKind` is the
    // string the engine reads, so the ladder's `true`/`false` have to be
    // translated on the way in. They were not, for one run: `deductionKind:
    // false` is not `'standard'` and neither is `true`, so every rung suppressed
    // South Carolina's standard-deduction add-back equally and the $90.00 pair
    // read as clean. **A probe value of the wrong TYPE is not a probe value; it
    // is one more way of writing "not the thing the rule tests for".**
    else if (slot === 'deductionKind') next.federal[slot] = value === true ? 'itemized' : 'standard';
    else next.federal[slot] = value;
    return next;
  }
  if (value === undefined) delete next[fieldName];
  else next[fieldName] = value;
  return next;
};

/**
 * How much of a note the unread-field note is, so it can be taken out again.
 *
 * It HAS to come out, and the reason is a circularity that would have neutered
 * the width test below in silence. That test witnesses a declared pair by
 * supplying two different values of the field and requiring the answer to
 * differ — and the ladder's values include `0` and `false`, which
 * `src/unread-input.ts` treats as the caller answering no and does not report.
 * So a field that NOTHING reads would differ between `false` (no note) and
 * `true` (a note saying it changed nothing), and would count as its own witness.
 *
 * **A field would be witnessed by the sentence saying it is unread.** That is
 * the gate's width check passing on the strength of its own failure.
 */
const UNREAD_NOTE_MARKER = 'spent on nothing';

/**
 * Every `notes` array anywhere in the payload, with the unread-field note taken
 * out of it.
 *
 * A recursive walk rather than a reach for `structured.notes`, because that is
 * what the first version did and the notes are NOT there: this tool answers
 * `{ state, sources }` and the notes hang off `state`. The strip quietly did
 * nothing, the circularity above stayed live, and the only thing that caught it
 * was the comparison-count floor at the bottom of the width test coming in under
 * 5,000 — the assertion whose own comment says a probe that compared nothing
 * looks exactly like a probe that passed.
 *
 * {@link stripped} is the receipt. It counts the notes actually removed, and the
 * width test requires it to be non-zero, so a payload reshaped under this
 * function cannot disable the strip in silence the way the first one did.
 */
let stripped = 0;
const withoutUnreadNote = (value) => {
  if (Array.isArray(value)) return value.map(withoutUnreadNote);
  if (value === null || typeof value !== 'object') return value;
  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    if (key === 'notes' && Array.isArray(inner)) {
      const kept = inner.filter((n) => !String(n).includes(UNREAD_NOTE_MARKER));
      stripped += inner.length - kept.length;
      out[key] = kept;
    } else {
      out[key] = withoutUnreadNote(inner);
    }
  }
  return out;
};

const runTool = (a) => {
  try {
    return JSON.stringify(withoutUnreadNote(tool.run(a).structured));
  } catch {
    return null;
  }
};
const runEngine = (input) => {
  try {
    // `reportUnreadFields: false` for the cost alone: this test makes over half a
    // million engine calls and the probe would run the whole return again once
    // per supplied field on every one of them — 400 seconds and climbing, against
    // the six this took. It cannot change what is measured here, because this
    // function reads a FIGURE and `us-state-tax`'s `unread-input.test.js`
    // asserts over every supported state-year that the option moves none.
    const r = stateIncomeTax(input, { reportUnreadFields: false });
    return r.totalTax ?? r.tax;
  } catch {
    return null;
  }
};

/**
 * The declared pairs with no witness, each with the reason there cannot be one.
 *
 * Three pairs, all one field, and the reason is the same for all three:
 *
 * The DENOMINATOR used to be here too — "three pairs out of two hundred and
 * ten" — and it was wrong: the code declares 209. A measured number written
 * down twice is two claims and not a cross-check, which is this file's own rule
 * from the day it was written, found a week later in its own header. The
 * surviving copy is the one in README.md, where `readme.test.js` checks it
 * against `STATE_FIELDS`. `federalItemized`'s whole effect in Maryland, Missouri and
 * Virginia is to unlock `stateItemizedDeductions` — `requiresFederalItemizing`
 * in all three, and Virginia and Georgia go further and COMPEL the state
 * itemized deduction — and `state_income_tax` already refuses
 * `stateItemizedDeductions` for those states unless the flag is `true`, with a
 * message of its own that says so. So the flag changes whether a call is LEGAL
 * and not what it answers, which is the one honest way for a declared pair to
 * have no witness.
 *
 * Georgia and South Carolina are not here: Georgia's eligible itemizer credit
 * (O.C.G.A. § 48-7-27.1) pays $300 a taxpayer for the election alone with no
 * state figure needed, and South Carolina's 2025 add-back is switched OFF by
 * itemizing. Both are witnessed on the flag by itself.
 */
const UNWITNESSED = new Set(['federalItemized/MD', 'federalItemized/MO', 'federalItemized/VA']);

test('no state field is refused for a state whose tax it moves', () => {
  const drift = [];
  let compared = 0;
  for (const field of STATE_FIELDS) {
    for (const state of SUPPORTED_STATES) {
      if (field.states.includes(state)) continue;
      const values = ladder(field, state);
      if (values === null) continue;
      let worst = null;
      for (const co of coInputs(field.name, state)) {
        for (const household of HOUSEHOLDS) {
          const base = engineInput(household, state, field.name, co);
          let first = null;
          for (const value of values) {
            const tax = runEngine(set(base, field.name, value));
            if (tax === null) continue;
            if (first === null) {
              first = tax;
              compared++;
              continue;
            }
            compared++;
            const delta = Math.abs(tax - first);
            if (delta > 0.005 && (worst === null || delta > worst.delta)) {
              worst = { delta, household: household.label, value };
            }
          }
        }
      }
      if (worst !== null) {
        drift.push(
          `${field.name} is refused for ${state} and moves its tax by $${worst.delta.toFixed(2)} ` +
            `(${worst.household}, ${field.name}=${JSON.stringify(worst.value)})`,
        );
      }
    }
  }
  // The count is asserted for the reason Day 50 learned the hard way: a sweep
  // that silently stopped comparing passes a one-directional assertion
  // perfectly, and a checker that verified nothing looks exactly like a pass.
  assert.ok(compared > 500_000, `comparisons made: ${compared}`);
  assert.deepEqual(drift, [], 'state fields refused for a state whose tax they move');
});

test('every state field DECLARED for a state has a household that witnesses it', () => {
  const unwitnessed = [];
  const spurious = [];
  let compared = 0;
  let witnessed = 0;
  let pairs = 0;
  for (const field of STATE_FIELDS) {
    for (const state of field.states) {
      const key = `${field.name}/${state}`;
      pairs++;
      const values = ladder(field, state);
      if (values === null) {
        unwitnessed.push(`${key}: no ladder — the probe cannot produce a value for it`);
        continue;
      }
      let witness = null;
      search: for (const co of coInputs(field.name, state)) {
        for (const household of HOUSEHOLDS) {
          const base = argsFor(household, state, field.name, co);
          let first = null;
          for (const value of values) {
            const result = runTool(set(base, field.name, value));
            if (result === null) continue;
            if (first === null) {
              first = result;
              compared++;
              continue;
            }
            compared++;
            if (result !== first) {
              witness = `${household.label} ${field.name}=${JSON.stringify(value)}`;
              break search;
            }
          }
        }
      }
      if (witness !== null) witnessed++;
      if (witness === null && !UNWITNESSED.has(key)) unwitnessed.push(key);
      if (witness !== null && UNWITNESSED.has(key)) spurious.push(`${key} is witnessed by ${witness}`);
    }
  }
  // The search short-circuits on the first witness, so a comparison count is a
  // weak floor and the WITNESS count is the real one: it says the instrument
  // found something rather than that it ran. Both are asserted, because a probe
  // whose every call is refused is indistinguishable from a probe that passed —
  // which is what the first run of this file actually did, 0 comparisons and no
  // drift reported.
  assert.ok(compared > 5_000, `comparisons made: ${compared}`);
  // The strip's receipt. Without this the width test can be neutered by a
  // reshaped payload and still pass, which is exactly what happened to the first
  // version of `withoutUnreadNote` — see its header.
  assert.ok(stripped > 0, 'the unread-field note was never found, so it was never stripped');
  assert.deepEqual(unwitnessed, [], 'declared state fields with no household that reads them');
  assert.equal(witnessed + UNWITNESSED.size, pairs, `declared pairs ${pairs}, witnessed ${witnessed}`);
  assert.ok(witnessed > 200, `pairs witnessed: ${witnessed}`);
  // An allowlist nobody prunes becomes a list of things that used to be true, so
  // a pair that gains a witness has to come OUT of it.
  assert.deepEqual(spurious, [], 'UNWITNESSED names a pair that now has a witness');
});

test('every derivation path reaches a real figure in at least one state-year', () => {
  const dead = [];
  const read = (value, segments) => {
    if (segments.length === 0) return value;
    const [head, ...rest] = segments;
    if (value === null || typeof value !== 'object') return undefined;
    if (head === '[]') {
      if (!Array.isArray(value)) return undefined;
      return value.map((element) => read(element, rest)).find((found) => found !== undefined);
    }
    return read(value[head], rest);
  };
  for (const path of DERIVATION_PATHS) {
    const segments = path
      .split('.')
      .flatMap((part) => (part.endsWith('[]') ? [part.slice(0, -2), '[]'] : [part]));
    const live = SUPPORTED_STATES.some((code) =>
      SUPPORTED_YEARS.some((year) => {
        const def = getStateDefinition(code, year);
        return def !== undefined && read(def, segments) !== undefined;
      }),
    );
    if (!live) dead.push(path);
  }
  assert.ok(DERIVATION_PATHS.length > 40, `paths declared: ${DERIVATION_PATHS.length}`);
  assert.deepEqual(dead, [], 'derivation paths that match nothing — a place the lists do not look');
});

test('the gate still refuses a field the state genuinely does not read', () => {
  // The fix is a wider list and not a removed check, so the check has to bite.
  const county = STATE_FIELDS.find((f) => f.name === 'county');
  assert.ok(!county.states.includes('PA'), 'county is not a Pennsylvania field');
  const yonkers = STATE_FIELDS.find((f) => f.name === 'yonkersNonresidentEarnings');
  assert.deepEqual([...yonkers.states], ['NY'], 'Yonkers is in New York and nowhere else');
  // Kentucky came OUT of the age lists on Day 53: KRS 141.019(1)'s pension
  // exclusion has no age test at all, which is the whole reason Kentucky is the
  // state an early retiree can use, and the field's own documentation had said
  // so for days while the list beside it disagreed.
  for (const name of ['filerAge', 'spouseAge']) {
    const field = STATE_FIELDS.find((f) => f.name === name);
    assert.ok(!field.states.includes('KY'), `${name} is not a Kentucky field`);
    assert.ok(field.states.includes('AL'), `${name} IS an Alabama field`);
    assert.ok(field.states.includes('MO'), `${name} IS a Missouri field`);
  }
});
