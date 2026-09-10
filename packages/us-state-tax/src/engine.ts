/**
 * The generic state income tax computation.
 *
 * One function serves every supported state. The differences between states live
 * in {@link StateIncomeTaxDefinition} data, not in branches here, which is what
 * makes the conformity choice visible rather than buried.
 */
import { filerCount } from './definition.js';
import type {
  ByChildCount,
  IncomeMeasure,
  OwnEarnedIncomeCreditRule,
  StateIncomeTaxDefinition,
} from './definition.js';
import {
  applyBaseAmountSchedule,
  applyBrackets,
  dependentCount,
  nonNegative,
  roundCents,
} from './engine-core.js';
import {
  computeLocalResidentTax,
  localNonresidentEarningsResult,
  localResidentResult,
  nonresidentTaxableEarnings,
} from './localities/engine.js';
import type { StateFigures } from './localities/engine.js';
import { getLocalityDefinition, localityState } from './localities/index.js';
import {
  citiesFor,
  cityDefinition,
  countiesFor,
  countyDefinition,
  normaliseCounty,
} from './localities/counties.js';
import { getStateDefinition, isSupported, stateName, supportedYears } from './states/index.js';
import type {
  Bracket,
  BracketDetail,
  CreditDetail,
  FilingStatus,
  IncomeClassDetail,
  LocalIncomeTaxResult,
  StateCode,
  StateIncomeTaxInput,
  StateIncomeTaxResult,
  SurtaxDetail,
} from './types.js';

export { applyBrackets, roundCents };

/**
 * The base amount a state's computation starts from, before its own additions and
 * subtractions.
 *
 * Pennsylvania is the one state here with no federal starting line at all, so it
 * demands its own figure rather than silently accepting federal AGI — which would
 * be wrong by the amount of every pre-tax deduction the filer has, since
 * Pennsylvania allows almost none of them.
 */
function conformityAmount(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): number {
  switch (def.base) {
    case 'federalAdjustedGrossIncome':
      return input.federal.adjustedGrossIncome;
    case 'federalTaxableIncome':
      return input.federal.taxableIncome;
    case 'stateDefined': {
      const field = def.stateDefinedBase?.field;
      /* c8 ignore next 5 -- unreachable: every stateDefined state carries the field. */
      if (field === undefined) {
        throw new Error(
          `${def.code} has base 'stateDefined' but no stateDefinedBase. This is a bug in ` +
            `this package's state definition, not in the caller's input.`,
        );
      }
      const value = input[field];
      if (value === undefined) {
        throw new RangeError(
          `${def.code} defines its own tax base and does not start from any federal figure. ` +
            `Supply ${field} — ${def.stateDefinedBase?.why ?? ''}`,
        );
      }
      return nonNegative(value, field);
    }
  }
}

function standardDeduction(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): number {
  switch (def.deduction.kind) {
    case 'none':
      return 0;
    case 'federal':
      return input.federal.deduction;
    case 'table':
      return def.deduction.amounts[input.filingStatus];
  }
}

/**
 * The state's itemized deduction, after any limit on it, or zero.
 *
 * Maryland's, and two things about it are the point. It is available **only** to
 * a filer who itemized federally, so the OBBBA's larger federal standard
 * deduction took it away from Maryland filers whose Maryland deductions had not
 * changed. And from 2025 it is reduced by 7.5% of federal AGI over `$200,000`,
 * a state revival of the federal § 68 limitation that Congress suspended in
 * 2018 — the reduction is not capped at a share of the deduction the way § 68's
 * 80% floor was, so it runs all the way to zero.
 */
function itemizedDeduction(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): number {
  const rule = def.itemizedDeduction;
  if (!rule) return 0;
  if (rule.requiresFederalItemizing && input.federal.deductionKind !== 'itemized') return 0;
  const claimed = nonNegative(input.stateItemizedDeductions, 'stateItemizedDeductions');
  if (claimed <= 0) return 0;
  const excess = input.federal.adjustedGrossIncome - rule.phaseOutThreshold[input.filingStatus];
  const reduction = excess > 0 ? rule.phaseOutRate * excess : 0;
  return Math.max(0, claimed - reduction);
}

/**
 * The state's own deductions from income, before exemptions.
 *
 * Massachusetts has no standard deduction and two specific ones instead, both of
 * which need a fact no federal figure carries: what the filer paid in FICA, and
 * whether they rent. Neither is large, and together they are `$400` of tax for a
 * two-earner renting couple — but a model with no way to represent them is
 * silently wrong for every Massachusetts tenant, which is a third of the state.
 */
function stateDeduction(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): number {
  // A filer takes the larger of the two, which is also what a state that forces
  // the standard deduction when the itemized figure falls below it produces —
  // the Maryland instructions say so in as many words, and it is the same
  // arithmetic.
  let total = Math.max(standardDeduction(def, input), itemizedDeduction(def, input));

  if (def.payrollTaxDeduction) {
    const paid = nonNegative(input.socialSecurityAndMedicarePaid, 'socialSecurityAndMedicarePaid');
    // Per filer, so a joint return with two working spouses deducts twice as
    // much — but only up to what was actually paid between them, which is the
    // one figure this package cannot split.
    total += Math.min(paid, def.payrollTaxDeduction.perFilerCap * filerCount(input.filingStatus));
  }

  if (def.rentDeduction) {
    const rent = nonNegative(input.rentPaid, 'rentPaid');
    total += Math.min(rent * def.rentDeduction.share, def.rentDeduction.cap[input.filingStatus]);
  }

  return total;
}

/**
 * The income figure an income test reads.
 *
 * Federal AGI unless the rule says otherwise, which is every state but Ohio. The
 * two Ohio measures are supplied by the caller because they are figures the
 * computation produces rather than figures it was given — modified AGI is known
 * before the exemptions and modified AGI less exemptions only after them, which
 * is why they arrive as a pair.
 */
interface IncomeMeasures {
  readonly federalAdjustedGrossIncome: number;
  readonly stateModifiedAdjustedGrossIncome: number;
  readonly stateModifiedAdjustedGrossIncomeLessExemptions: number;
}

function measured(measures: IncomeMeasures, which: IncomeMeasure | undefined): number {
  return measures[which ?? 'federalAdjustedGrossIncome'];
}

function stateExemptions(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  /** Ohio's modified AGI; ignored by every other state. */
  modifiedAgi: number,
): number {
  const rule = def.exemption;
  if (!rule) return 0;
  const cliff = rule.cliff?.[input.filingStatus];
  if (cliff !== undefined && input.federal.adjustedGrossIncome > cliff) return 0;
  const dependents = dependentCount(input);
  // Maryland: every exemption on the return is worth the same stepped amount,
  // and the step is chosen by federal AGI. So the filer's exemption and the
  // dependents' are one figure times a count, not two figures — and the staircase
  // costs a family with six exemptions six times what it costs a single filer.
  const filers = rule.filersClaimed?.[input.filingStatus] ?? filerCount(input.filingStatus);
  // Maryland reads the staircase against federal AGI; Ohio against its own
  // modified AGI, which is Ohio AGI with the business income deduction added
  // back. The two are the same figure only for a filer with no business income.
  const stepIncome =
    rule.stepsMeasuredOn === 'federalAdjustedGrossIncome' || rule.stepsMeasuredOn === undefined
      ? input.federal.adjustedGrossIncome
      : modifiedAgi;
  let total = rule.perExemptionSteps
    ? stepAmount(rule.perExemptionSteps[input.filingStatus], stepIncome) * (filers + dependents)
    : rule.perFiler[input.filingStatus] + rule.perDependent * dependents;

  // New Jersey's per-person additions. Each is claimed by a *filer*, never by a
  // dependent: New Jersey gives nothing extra for a blind or elderly dependent.
  const seniorAge = rule.seniorAge;
  if (rule.perSeniorFiler !== undefined && seniorAge !== undefined) {
    total += rule.perSeniorFiler * seniorFilers(input, seniorAge);
  }
  if (rule.perBlindOrDisabledFiler !== undefined) {
    const claimed = nonNegative(input.blindOrDisabled, 'blindOrDisabled');
    total += rule.perBlindOrDisabledFiler * Math.min(claimed, filerCount(input.filingStatus));
  }
  if (rule.perCollegeDependent !== undefined) {
    const college = nonNegative(input.dependentsAttendingCollege, 'dependentsAttendingCollege');
    total += rule.perCollegeDependent * Math.min(college, dependents);
  }
  // Maryland's second exemption for a dependent aged 65 or over — the dependent
  // parent case. It needs ages rather than a count, and it is not stepped by
  // income the way the base exemption is.
  if (rule.perSeniorDependent !== undefined && seniorAge !== undefined) {
    const aged = (input.dependentAges ?? []).filter((age) => age >= seniorAge).length;
    total += rule.perSeniorDependent * aged;
  }
  return total;
}

/**
 * A flat credit for an older filer under an income cliff — Maryland's senior tax
 * credit, Md. Code, Tax-Gen. § 10-754.
 *
 * The income test is on federal AGI and it is a cliff, not a phase-out: a
 * 66-year-old single filer at `$100,000` keeps `$1,000` and the same filer at
 * `$100,001` keeps nothing.
 */
function seniorCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  measures: IncomeMeasures,
): number {
  const rule = def.seniorCredit;
  if (!rule) return 0;
  const qualifying = seniorFilers(input, rule.minimumAge);
  if (qualifying === 0) return 0;
  // Maryland tests federal AGI; Ohio tests its own modified AGI less exemptions.
  if (measured(measures, rule.incomeMeasure) > rule.incomeLimit[input.filingStatus]) return 0;
  const status = input.filingStatus;
  return qualifying >= 2 ? rule.amountBothSpouses[status] : rule.amount[status];
}

/**
 * Ohio's retirement income credit — § 5747.055(B), a step function of the
 * retirement income on the return under a cliff on modified AGI less exemptions.
 */
function retirementIncomeCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  measures: IncomeMeasures,
): number {
  const rule = def.retirementIncomeCredit;
  if (!rule) return 0;
  if (measures.stateModifiedAdjustedGrossIncomeLessExemptions >= rule.incomeLimit) return 0;
  const retirement = nonNegative(input.retirementIncome, 'retirementIncome');
  return stepAmount(rule.steps, retirement);
}

/**
 * Whether this return takes a state earned income credit's *childless* schedule.
 *
 * Maryland's § 10-704(c)(3) asks whether the filer is unmarried and has no
 * qualifying child, and the answer decides between a 100% match and a 50% one.
 * This package sees dependents rather than qualifying children, so a filer whose
 * only dependent is a dependent parent — childless for the federal credit — is
 * treated here as having a child and matched at 50%. The state's notes say so.
 */
function unmarriedChildless(input: StateIncomeTaxInput): boolean {
  const status = input.filingStatus;
  const unmarried =
    status === 'single' || status === 'headOfHousehold' || status === 'qualifyingSurvivingSpouse';
  return unmarried && dependentCount(input) === 0;
}

/** How many of the filer and spouse are at or above an age. */
function seniorFilers(input: StateIncomeTaxInput, age: number): number {
  const filers = filerCount(input.filingStatus);
  let count = 0;
  if (input.filerAge !== undefined && input.filerAge >= age) count += 1;
  if (filers === 2 && input.spouseAge !== undefined && input.spouseAge >= age) count += 1;
  return count;
}

/**
 * New Jersey's pension and retirement income exclusion, N.J.S.A. 54A:6-10.
 *
 * `totalIncome` is line 27 — before this exclusion — because that is the figure
 * the statute's tiers are measured on. The result is subtracted to reach line 29,
 * which is the figure the filing threshold is measured on. Two income measures,
 * two different tests, one line apart.
 */
function retirementExclusion(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  totalIncome: number,
): number {
  const rule = def.retirementExclusion;
  if (!rule) return 0;
  const retirement = nonNegative(input.retirementIncome, 'retirementIncome');
  const eligibleByAge = seniorFilers(input, rule.minimumAge) > 0;
  if (!eligibleByAge) return 0;

  const status = input.filingStatus;
  const maximum = rule.maximum[status];
  const tier = rule.tiers.find((t) => totalIncome <= t.upTo);
  /* c8 ignore next -- the last tier is unbounded, so find() always succeeds. */
  if (!tier) return 0;
  const fraction = exclusionFraction(rule, status, tier.jointPercentage);

  // Part I of Worksheet D. The percentage applies to the pension, and the
  // maximum caps the result — two limits, not one, and which of them binds
  // depends on the filer.
  const pensionPart = Math.min(retirement * fraction, maximum);

  // Part II: what Part I did not use may be applied to *other* income, but only
  // for a filer with almost no earnings. $3,001 of wages costs the whole unused
  // allowance, which makes it another cliff and a much less visible one.
  const earned = nonNegative(input.earnedIncome, 'earnedIncome');
  if (input.earnedIncome === undefined || earned > rule.otherIncomeEarnedIncomeLimit) {
    return pensionPart;
  }
  const allowance = Math.min(totalIncome * fraction, maximum);
  const otherIncome = Math.max(0, totalIncome - retirement - earned);
  return pensionPart + Math.min(Math.max(0, allowance - pensionPart), otherIncome);
}

/**
 * The share of pension income a filing status may exclude in one income tier.
 *
 * The statute publishes ten percentages across five statuses and three tiers.
 * Six of them are generated: **in each partial tier the percentage is the joint
 * percentage scaled by that status's share of the joint maximum**, which is what
 * keeps the 100/75/50 ratio between the statuses intact all the way down —
 * `0.5 x (75/100) = 0.375` and `0.25 x (50/100) = 0.125`, four for four against
 * the published figures. In the *full* tier every status excludes 100% and the
 * ratio is enforced by the maximum instead, which is why the scaling is applied
 * only where the percentage is less than one.
 */
function exclusionFraction(
  rule: NonNullable<StateIncomeTaxDefinition['retirementExclusion']>,
  status: FilingStatus,
  jointPercentage: number,
): number {
  if (jointPercentage >= 1) return jointPercentage;
  return jointPercentage * (rule.maximum[status] / rule.maximum.marriedFilingJointly);
}

/** A per-child credit whose amount is a step function of state taxable income. */
function steppedChildCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  taxableIncome: number,
): number {
  const rule = def.steppedChildCredit;
  if (!rule) return 0;
  if (rule.ineligibleFilingStatuses.includes(input.filingStatus)) return 0;
  const ages = input.dependentAges;
  if (ages === undefined) return 0;
  const children = ages.filter((a) => a <= rule.maxAge).length;
  if (children === 0) return 0;
  const step = rule.steps.find((s) => taxableIncome <= s.upTo);
  /* c8 ignore next -- the last step is unbounded. */
  if (!step) return 0;
  return step.amount * children;
}

/** Property tax paid, counting a tenant's rent at the statutory fraction. */
function qualifyingPropertyTax(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): number {
  const rule = def.propertyTaxRelief;
  if (!rule) return 0;
  if (input.propertyTaxPaid !== undefined) {
    return Math.min(nonNegative(input.propertyTaxPaid, 'propertyTaxPaid'), rule.limit);
  }
  if (input.rentPaid !== undefined) {
    const treated = nonNegative(input.rentPaid, 'rentPaid') * rule.rentFraction;
    return Math.min(treated, rule.limit);
  }
  return 0;
}

function exemptionCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  measures: IncomeMeasures,
): number {
  const rule = def.exemptionCredit;
  if (!rule) return 0;
  const status = input.filingStatus;
  const dependents = dependentCount(input);
  const exemptions = filerCount(status) + dependents;
  const full = rule.perFiler[status] + rule.perDependent * dependents;
  // Ohio's is switched off rather than tapered: § 5747.022 allows the $20 only
  // below $30,000 of modified AGI, so a family of four loses $80 on one dollar.
  if (rule.incomeLimit !== undefined && measured(measures, rule.incomeMeasure) >= rule.incomeLimit) {
    return 0;
  }
  if (!rule.phaseOut) return full;
  const excess = input.federal.adjustedGrossIncome - rule.phaseOut.start[status];
  if (excess <= 0) return full;
  // "$6 for each $2,500, or fraction thereof" — a partial increment counts in
  // full, so the phase-out is a staircase and one dollar over a step costs $6
  // per exemption claimed.
  const increments = Math.ceil(excess / rule.phaseOut.increment[status]);
  const reduction = increments * rule.phaseOut.amountPerIncrement * exemptions;
  return Math.max(0, full - reduction);
}

function taxpayerCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  stateTaxableIncome: number,
): number {
  const rule = def.taxpayerCredit;
  if (!rule) return 0;
  const exemptionBase = rule.personalExemption * dependentCount(input);
  const full = rule.rate * (input.federal.deduction + exemptionBase);
  const excess = stateTaxableIncome - rule.phaseOutThreshold[input.filingStatus];
  if (excess <= 0) return full;
  return Math.max(0, full - rule.phaseOutRate * excess);
}

const ADD_BACK_LABELS: Readonly<Record<string, string>> = {
  qualifiedBusinessIncome: 'Section 199A qualified business income deduction add-back',
  tips: 'Qualified tips deduction add-back',
  overtime: 'Qualified overtime deduction add-back',
  senior: 'Additional senior deduction add-back',
  carLoanInterest: 'Vehicle loan interest deduction add-back',
};

function addBacks(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): { name: string; amount: number }[] {
  if (!def.addBacks || def.addBacks.length === 0) return [];
  const taken = input.federalDeductions ?? {};
  const out: { name: string; amount: number }[] = [];
  for (const key of def.addBacks) {
    const amount = nonNegative(taken[key], `federalDeductions.${key}`);
    if (amount > 0) out.push({ name: ADD_BACK_LABELS[key] ?? key, amount });
  }
  return out;
}

/**
 * Pennsylvania Special Tax Forgiveness, as a percentage of the tax.
 *
 * The staircase is what matters: eligibility income at or below the allowance
 * forgives the whole tax, and each $250 above it — or any part of $250 — forgives
 * ten percentage points less, so forgiveness runs out $2,500 later.
 */
function forgivenessCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  tax: number,
): number {
  const rule = def.forgiveness;
  if (!rule) return 0;
  const eligibility = nonNegative(
    input.pennsylvaniaEligibilityIncome ?? input.pennsylvaniaTaxableIncome,
    'pennsylvaniaEligibilityIncome',
  );
  const allowance = rule.base * filerCount(input.filingStatus) + rule.perDependent * dependentCount(input);
  const excess = eligibility - allowance;
  const steps = excess <= 0 ? 0 : Math.ceil(excess / rule.increment);
  const share = Math.max(0, 1 - steps * rule.reductionPerIncrement);
  return tax * share;
}

/** The amount of a step-function credit at a given income. */
function stepAmount(steps: readonly { upTo: number; amount: number }[], income: number): number {
  for (const step of steps) {
    if (income <= step.upTo) return step.amount;
  }
  return 0;
}

/**
 * New York's household credit — a staircase on state AGI, N.Y. Tax Law § 606(b).
 *
 * Household size counts the filer, the spouse on a joint return, and the
 * dependents claimed. Single filers get a flat table with no per-person addition,
 * which is why `perAdditionalPerson` is only ever reached by the other statuses.
 */
function householdCredit(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput, agi: number): number {
  const rule = def.householdCredit;
  if (!rule) return 0;
  const status = input.filingStatus;
  const people = filerCount(status) + dependentCount(input);
  const base = stepAmount(rule.base[status], agi);
  const additional =
    status === 'single' ? 0 : stepAmount(rule.perAdditionalPerson, agi) * (people - 1);
  const credit = base + additional;
  return rule.halvedForSeparate && status === 'marriedFilingSeparately' ? credit / 2 : credit;
}

/**
 * A credit worth a fixed amount per dependent by age, phased out against income
 * on the whole return — New York's Empire State child credit.
 *
 * The phase-out is the part that is got wrong. It reduces the *total* credit by
 * a fixed amount per increment of income, so a bigger family does not phase out
 * faster, it phases out later: a joint return with one child under 4 keeps some
 * credit through $170,000 of AGI and one with three keeps some through $291,000,
 * from a credit both of them are told phases out above $110,000.
 *
 * And the increment counts "or fraction thereof", which makes it a staircase:
 * the dollar that crosses each boundary costs the whole increment at once.
 */
function childCredit(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): number {
  const rule = def.childCredit;
  if (!rule) return 0;
  const ages = input.dependentAges;
  if (ages === undefined || ages.length === 0) return 0;

  let credit = 0;
  for (const age of ages) {
    if (!Number.isFinite(age) || age < 0) {
      throw new RangeError(`dependentAges must be non-negative finite numbers, received ${age}`);
    }
    for (const band of rule.amountByAge) {
      // Bounds are inclusive and either may be absent, which is what lets one
      // list express New York's "under 4, then 4 to 16" and Massachusetts's
      // "under 13, or 65 and over" — a credit banded at both ends of life.
      if ((band.maxAge === undefined || age <= band.maxAge) &&
          (band.minAge === undefined || age >= band.minAge)) {
        credit += band.amount;
        break;
      }
    }
  }
  if (credit <= 0) return 0;
  // Massachusetts's has no phase-out at all, which is the whole of what makes it
  // unusual: it is worth the same $440 per dependent at $400,000 of income as at
  // $40,000.
  if (!rule.phaseOut) return credit;

  const excess = input.federal.adjustedGrossIncome - rule.phaseOut.threshold[input.filingStatus];
  if (excess <= 0) return credit;
  const increments = Math.ceil(excess / rule.phaseOut.increment);
  return Math.max(0, credit - increments * rule.phaseOut.amountPerIncrement);
}

/**
 * The CalEITC schedule at one income, for one qualifying-child count.
 *
 * Exported because it is the whole of R&TC § 17052 as arithmetic, and the
 * twelve values the Franchise Tax Board published in the 2021 Form 3514 lookup
 * table are the only external check on it that this package can reach. The test
 * drives this function with the 2021 parameters and asserts against all twelve —
 * a year the package does not otherwise ship, which is the point: it validates
 * the *mechanism* rather than the transcription.
 *
 * Three segments, in order:
 *
 * 1. Up to `earnedIncomeAmount`, the credit is `rate x income`.
 * 2. From there it falls at the same rate, which is why the peak is a point and
 *    not a plateau, until it reaches `finalPhaseOutStartCredit`.
 * 3. From that kink it runs in a straight line to zero at `finalPhaseOutEnd`.
 */
export function ownEarnedIncomeCreditAt(
  rule: OwnEarnedIncomeCreditRule,
  band: ByChildCount,
  income: number,
): number {
  const rate = band.phaseInRate * rule.adjustmentFactor;
  const maximum = band.earnedIncomeAmount * rate;
  const phasedIn = Math.min(Math.max(0, income), band.earnedIncomeAmount) * rate;
  // How far the steep phase-out runs before the credit reaches the kink. It is a
  // width in dollars of income, implied by the rate rather than stored — the
  // same relationship the New York City earned income credit's windows have.
  const steepWidth = (maximum - band.finalPhaseOutStartCredit) / rate;
  const kinkIncome = band.earnedIncomeAmount + steepWidth;
  const descended =
    phasedIn - Math.min(Math.max(0, income - band.earnedIncomeAmount), steepWidth) * rate;
  if (income <= kinkIncome) return Math.max(0, descended);
  const along = Math.min(1, (income - kinkIncome) / (rule.finalPhaseOutEnd - kinkIncome));
  return Math.max(0, descended * (1 - along));
}

/** The rule's band for a given number of qualifying children. */
export function childCountBand(
  rule: OwnEarnedIncomeCreditRule,
  children: number,
): ByChildCount {
  let band = rule.byChildCount[0]!;
  for (const candidate of rule.byChildCount) {
    if (children >= candidate.children) band = candidate;
  }
  return band;
}

/**
 * CalEITC — a state earned income credit on its own schedule rather than a share
 * of the federal one.
 *
 * Returns `undefined` rather than zero when the credit could not be computed
 * because the caller did not supply an input it needs, so the result can say so
 * instead of reporting a confident zero.
 */
function ownEarnedIncomeCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): number | undefined {
  const rule = def.ownEarnedIncomeCredit;
  if (!rule) return 0;
  if (input.earnedIncome === undefined) return undefined;
  // A count cannot say whether a dependent is a qualifying child, and the
  // childless schedule is worth $303 where the two-child one is worth $3,340.
  // Computing the childless credit for a family would be quietly wrong, which is
  // worse than the zero this reports alongside the note that says why.
  if (dependentCount(input) > 0 && input.dependentAges === undefined) return undefined;

  const earned = nonNegative(input.earnedIncome, 'earnedIncome');
  const investment = nonNegative(input.investmentIncome, 'investmentIncome');
  if (investment > rule.investmentIncomeLimit) return 0;
  // Form 3514 steps 7-8: federal AGI must be under the same cap the credit
  // phases out at, so investment income disqualifies twice over.
  if (input.federal.adjustedGrossIncome >= rule.finalPhaseOutEnd) return 0;

  const children = (input.dependentAges ?? []).filter(
    (age) => age <= rule.qualifyingChildMaxAge,
  ).length;
  const band = childCountBand(rule, children);
  // Worksheet line 6 takes the smaller of the credit on earned income and the
  // credit on AGI, and IRC 32(a)(2)(B) as adopted by section 17052(a) runs the
  // AGI branch on "adjusted gross income (or, if greater, the earned income)" —
  // so a filer whose AGI is below their earnings is not pushed down the
  // schedule by it.
  const higher = Math.max(earned, input.federal.adjustedGrossIncome);
  return Math.min(
    ownEarnedIncomeCreditAt(rule, band, earned),
    ownEarnedIncomeCreditAt(rule, band, higher),
  );
}

/**
 * California's Young Child Tax Credit — one credit per return, not one per
 * child, and gated on actually receiving CalEITC.
 *
 * The phase-out is per `$100` "or fraction thereof", so it is a staircase: the
 * dollar that crosses each boundary costs `$21.71` and the ninety-nine after it
 * cost nothing.
 */
function youngChildCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  calEitc: number | undefined,
): number | undefined {
  const rule = def.youngChildCredit;
  if (!rule) return 0;
  if (calEitc === undefined) return undefined;
  if (calEitc <= 0) return 0;
  const ages = input.dependentAges;
  if (ages === undefined || !ages.some((age) => age < rule.ineligibleAge)) return 0;

  const earned = nonNegative(input.earnedIncome, 'earnedIncome');
  const excess = earned - rule.phaseOut.start;
  if (excess <= 0) return rule.amount;
  const increments = Math.ceil(excess / rule.phaseOut.increment);
  return Math.max(0, rule.amount - increments * rule.phaseOut.amountPerIncrement);
}

/**
 * New York's tax table benefit recapture, derived from the state's own rate
 * schedule rather than transcribed from the statutory table — see
 * {@link RecaptureRule}.
 *
 * The ladder has one rung per rate bracket at or above the one containing
 * `minAgi`. Each rung phases in linearly over `phaseInLength` of AGI starting at
 * that bracket's threshold — except the first, which starts at `minAgi`.
 */
export function recaptureLadder(
  brackets: readonly Bracket[],
  minAgi: number,
): { start: number; level: number }[] {
  const rungs: { start: number; level: number }[] = [];
  for (let i = 0; i < brackets.length - 1; i += 1) {
    const band = brackets[i];
    const next = brackets[i + 1];
    if (band === undefined || next === undefined) break;
    const threshold = band.upTo;
    if (!Number.isFinite(threshold)) break;
    // Brackets that end below the one containing minAgi have their benefit
    // recaptured by the first rung, not by a rung of their own.
    if (threshold < minAgi && Number.isFinite(next.upTo) && next.upTo <= minAgi) continue;
    rungs.push({
      start: Math.max(threshold, minAgi),
      level: next.rate * threshold - applyBrackets(threshold, brackets).tax,
    });
  }
  return rungs;
}

function recapture(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput, agi: number): number {
  const rule = def.recapture;
  if (!rule || def.rate.kind !== 'brackets') return 0;
  if (agi <= rule.minAgi) return 0;
  const rungs = recaptureLadder(def.rate.byStatus[input.filingStatus], rule.minAgi);

  let recaptured = 0;
  let climbed = 0;
  for (const rung of rungs) {
    if (agi <= rung.start) break;
    const fraction = Math.min(1, (agi - rung.start) / rule.phaseInLength);
    recaptured = climbed + (rung.level - climbed) * fraction;
    if (fraction < 1) break;
    climbed = rung.level;
  }
  return Math.max(0, recaptured);
}

/**
 * The income a state taxes at a rate of its own, with any exemption the main
 * schedule could not use cascaded through it.
 *
 * Massachusetts is the only state here with such classes, and the cascade is the
 * part that is easy to leave out: a retiree whose only income is a short-term
 * capital gain has a `$4,400` personal exemption and no 5.0% income to set it
 * against, so an engine that applies exemptions only to the main schedule taxes
 * their first `$4,400` at 8.5%.
 *
 * `deductionShare` is applied first and the exemption second, which is the order
 * Massachusetts uses: the 50% collectibles deduction is subtracted in reaching
 * Part A adjusted gross income (M.G.L. c. 62 § 2(c)(3)) and exemptions come out
 * of adjusted gross income afterwards.
 */
function incomeClassDetails(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  unusedExemption: number,
): { details: IncomeClassDetail[]; taxableTotal: number; adjustedTotal: number; tax: number } {
  const details: IncomeClassDetail[] = [];
  let remainingExemption = unusedExemption;
  let taxableTotal = 0;
  let adjustedTotal = 0;
  let tax = 0;

  for (const rule of def.separatelyRatedIncome ?? []) {
    const income = nonNegative(input[rule.field], rule.field);
    const adjusted = income * (1 - (rule.deductionShare ?? 0));
    const applied = Math.min(remainingExemption, adjusted);
    remainingExemption -= applied;
    const taxableAmount = adjusted - applied;
    adjustedTotal += adjusted;
    taxableTotal += taxableAmount;
    tax += taxableAmount * rule.rate;
    details.push({ name: rule.name, rate: rule.rate, income, taxableAmount, tax: taxableAmount * rule.rate });
  }

  return { details, taxableTotal, adjustedTotal, tax };
}

/**
 * The income at or below which the state charges no tax at all, or `undefined`
 * when this filer cannot claim it.
 *
 * New Jersey stores the whole figure. Massachusetts stores `$7,600` and derives
 * the rest from the exemption schedule sitting beside it — see
 * {@link ZeroTaxThresholdRule} — which is why the published `$16,400` and
 * `$14,400` are not in this package at all.
 */
function zeroTaxThreshold(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): number | undefined {
  const rule = def.zeroTaxThreshold;
  if (!rule) return undefined;
  if (rule.ineligibleFilingStatuses?.includes(input.filingStatus)) return undefined;
  let threshold = rule.threshold[input.filingStatus];
  if (rule.addsPersonalExemption?.[input.filingStatus] && def.exemption) {
    threshold += def.exemption.perFiler[input.filingStatus];
  }
  if (rule.perDependent !== undefined) {
    threshold += rule.perDependent * dependentCount(input);
  }
  return threshold;
}

interface Computed {
  conformityAmount: number;
  /**
   * Every dollar of income the state saw, across all rate classes.
   *
   * Equal to {@link conformityAmount} everywhere but Massachusetts, and the
   * denominator {@link StateIncomeTaxResult.effectiveRate} needs: a filer whose
   * income is a $1,000,000 short-term gain and a $200,000 salary has an
   * effective rate of 41%, not the 50% that dividing by the salary alone gives.
   */
  incomeBase: number;
  addBacks: { name: string; amount: number }[];
  additions: number;
  subtractions: number;
  computedSubtractions: { name: string; amount: number }[];
  /** State AGI — the base after additions and subtractions, before deductions. */
  stateAgi: number;
  deduction: number;
  exemptions: number;
  taxableIncome: number;
  taxBeforeCredits: number;
  brackets: BracketDetail[];
  incomeClasses: IncomeClassDetail[];
  surtaxes: SurtaxDetail[];
  credits: CreditDetail[];
  /**
   * Tax after the state's non-refundable credits and before its refundable ones.
   *
   * This is the figure a locality that charges "a percentage of the state tax"
   * uses, and it is not {@link tax}: refundable state credits are claimed in the
   * payments section of the return, below the Yonkers surcharge line.
   */
  taxBeforeRefundableCredits: number;
  tax: number;
}

/**
 * The whole state computation, on one of the two routes a property tax relief
 * state offers. `compute` runs both and keeps the cheaper.
 */
function computeOnce(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  propertyTaxRoute: 'deduction' | 'credit',
): Computed {
  const base = conformityAmount(def, input);
  const back = addBacks(def, input);
  const additions =
    nonNegative(input.additions, 'additions') + back.reduce((s, a) => s + a.amount, 0);
  const given = nonNegative(input.subtractions, 'subtractions');

  // New Jersey's retirement exclusion is measured on total income — the base
  // before the exclusion itself — and produces the gross income figure the
  // filing threshold is then measured on. Line 27, then line 28, then line 29.
  const totalIncome = Math.max(0, base + additions - given);
  const computedSubtractions: { name: string; amount: number }[] = [];
  const exclusion = retirementExclusion(def, input, totalIncome);
  if (def.retirementExclusion) {
    computedSubtractions.push({ name: def.retirementExclusion.name, amount: exclusion });
  }
  // Ohio's business income deduction — Schedule of Adjustments, and a
  // SUBTRACTION rather than a rate rule, which is the part that is easy to miss:
  // it moves Ohio AGI, so it moves the exemption staircase and every credit
  // limit downstream of it. What it does not move is the modified AGI those
  // limits are actually read against, because § 5747.01(JJ) adds it straight
  // back.
  const businessIncome = nonNegative(input.businessIncome, 'businessIncome');
  let businessDeduction = 0;
  if (def.businessIncome) {
    businessDeduction = Math.min(
      businessIncome,
      def.businessIncome.deductionCap[input.filingStatus],
    );
    if (businessDeduction > 0) {
      computedSubtractions.push({ name: 'Business income deduction', amount: businessDeduction });
    }
  }
  const subtractions = given + exclusion + businessDeduction;
  const stateAgi = Math.max(0, base + additions - subtractions);
  const modifiedAgi = stateAgi + businessDeduction;

  const propertyTax = qualifyingPropertyTax(def, input);
  const propertyTaxDeduction = propertyTaxRoute === 'deduction' ? propertyTax : 0;
  const deduction = stateDeduction(def, input) + propertyTaxDeduction;
  const exemptions = stateExemptions(def, input, modifiedAgi);
  const measures: IncomeMeasures = {
    federalAdjustedGrossIncome: input.federal.adjustedGrossIncome,
    stateModifiedAdjustedGrossIncome: modifiedAgi,
    stateModifiedAdjustedGrossIncomeLessExemptions: Math.max(0, modifiedAgi - exemptions),
  };
  const afterDeduction = Math.max(0, stateAgi - deduction);
  const taxableIncome = Math.max(0, afterDeduction - exemptions);
  // What the main schedule could not absorb cascades into the separately rated
  // classes, in the order they are declared.
  const classes = incomeClassDetails(def, input, Math.max(0, exemptions - afterDeduction));

  // The figure a "no tax at all" threshold is measured against. Massachusetts
  // measures No Tax Status on Massachusetts AGI, which includes the Part A and
  // Part C income taxed at the other rates — so a filer with $5,000 of wages and
  // a $60,000 short-term gain is not in No Tax Status, and an engine that looked
  // only at the main schedule would say they were.
  const totalStateAgi = stateAgi + classes.adjustedTotal;

  // Below the filing threshold the state charges nothing at all — not a zero
  // bracket, a statement about the whole return. Refundable credits survive it:
  // New Jersey tells filers under the threshold to file anyway and claim the
  // earned income and child credits, which is the whole reason the threshold is
  // applied here rather than by returning early.
  const threshold = zeroTaxThreshold(def, input);
  const belowThreshold = threshold !== undefined && totalStateAgi <= threshold;

  // Ohio splits the base it just computed. IT 1040 line 6 is the taxable
  // business income and line 7 is what is left, so the exemptions subtracted
  // above come out of the NONBUSINESS half — and where they exceed it, the
  // excess is simply lost rather than reducing the 3% half. Line 6 is capped at
  // line 5 for the same reason: the two halves cannot together exceed the base.
  const taxableBusinessIncome = def.businessIncome
    ? Math.min(Math.max(0, businessIncome - businessDeduction), taxableIncome)
    : 0;
  const scheduleIncome = Math.max(0, taxableIncome - taxableBusinessIncome);

  let taxBeforeCredits = 0;
  let brackets: BracketDetail[] = [];
  if (belowThreshold) {
    // no tax
  } else if (def.rate.kind === 'flat') {
    taxBeforeCredits = scheduleIncome * def.rate.rate;
    if (scheduleIncome > 0) {
      brackets = [{ rate: def.rate.rate, incomeInBracket: scheduleIncome, tax: taxBeforeCredits }];
    }
  } else if (def.rate.kind === 'brackets') {
    const walked = applyBrackets(scheduleIncome, def.rate.byStatus[input.filingStatus]);
    taxBeforeCredits = walked.tax;
    brackets = walked.detail;
  } else if (def.rate.kind === 'baseAmountSchedule') {
    const walked = applyBaseAmountSchedule(scheduleIncome, def.rate.bands);
    taxBeforeCredits = walked.tax;
    brackets = walked.detail;
  }
  const incomeClasses = belowThreshold
    ? classes.details.map((c) => ({ ...c, taxableAmount: 0, tax: 0 }))
    : classes.details;
  if (!belowThreshold) taxBeforeCredits += classes.tax;
  // Ohio's 3% on the business half, reported as an income class because that is
  // exactly what it is: income pulled out of the main schedule and charged at a
  // rate of its own. Unlike Massachusetts's classes it is not a separate input —
  // it was already inside federal AGI — so it is not added to `incomeBase`.
  if (def.businessIncome && businessIncome > 0 && !belowThreshold) {
    const businessTax = taxableBusinessIncome * def.businessIncome.rate;
    incomeClasses.push({
      name: def.businessIncome.name,
      rate: def.businessIncome.rate,
      income: businessIncome,
      taxableAmount: taxableBusinessIncome,
      tax: businessTax,
    });
    taxBeforeCredits += businessTax;
  }

  const surtaxes: SurtaxDetail[] = [];
  if (def.surtax && !belowThreshold) {
    // On *total* taxable income, across every class. Massachusetts's 4% surtax
    // is the reason this matters: a filer whose salary is $200,000 and whose
    // one-time capital gain is $1,000,000 owes it, and a surtax measured on the
    // main schedule alone would say they do not.
    const amount = applyBrackets(taxableIncome + classes.taxableTotal, def.surtax.brackets).tax;
    if (amount > 0) surtaxes.push({ name: def.surtax.name, amount });
  }
  if (def.recapture && !belowThreshold) {
    // Measured on state AGI, not on taxable income: New York's recapture asks how
    // rich you are, then claws back the graduated rates you were charged.
    const amount = recapture(def, input, stateAgi);
    if (amount > 0) surtaxes.push({ name: def.recapture.name, amount });
  }
  if (def.capitalGainsSurtax && !belowThreshold) {
    // Maryland's, and it asks two questions of two different figures: is FEDERAL
    // AGI over the threshold, and how much of the state's taxable income was
    // capital gain. The threshold is a test rather than a floor, so the whole
    // gain is taxed the moment one dollar of AGI crosses it — $20,000 of tax on
    // one dollar of income for a filer with a $1,000,000 gain.
    const rule = def.capitalGainsSurtax;
    const gain = nonNegative(input.netCapitalGain, 'netCapitalGain');
    if (gain > 0 && input.federal.adjustedGrossIncome > rule.agiThreshold) {
      // Only the gain that reached the state's taxable income is surtaxed: the
      // statute reaches "net capital gain included in Maryland taxable income",
      // so a filer whose deductions consumed part of the gain is not surtaxed on
      // the part that never got there.
      const reached = Math.min(gain, taxableIncome);
      if (reached > 0) surtaxes.push({ name: rule.name, amount: reached * rule.rate });
    }
  }

  // The tax every credit is measured against, and the figure Maryland's
  // refundable earned income credit is netted from — so it is computed here,
  // before the credits, rather than after them.
  const grossTax = taxBeforeCredits + surtaxes.reduce((s, x) => s + x.amount, 0);

  const credits: CreditDetail[] = [];
  // Ohio's Schedule of Credits runs retirement, then senior, then the $20
  // exemption credit, then a SUBTOTAL, and only then the joint filing credit —
  // which is a percentage of what is left. So the order here is the form's, and
  // for Ohio it is load-bearing rather than cosmetic.
  if (def.retirementIncomeCredit) {
    credits.push({
      name: def.retirementIncomeCredit.name,
      amount: retirementIncomeCredit(def, input, measures),
      refundable: false,
    });
  }
  if (def.seniorCredit) {
    credits.push({
      name: def.seniorCredit.name,
      amount: seniorCredit(def, input, measures),
      refundable: false,
    });
  }
  if (def.exemptionCredit) {
    credits.push({
      name: def.exemptionCredit.name,
      amount: exemptionCredit(def, input, measures),
      refundable: false,
    });
  }
  if (def.jointFilingCredit) {
    const rule = def.jointFilingCredit;
    // The subtotal line: everything above, capped at the tax, is what the
    // percentage is taken of. Applying it to the gross tax instead overstates
    // the credit for every filer who also claimed one of the three above.
    const already = credits.reduce((sum, c) => sum + c.amount, 0);
    const remaining = Math.max(0, grossTax - Math.min(grossTax, already));
    const joint =
      input.filingStatus === 'marriedFilingJointly' &&
      input.bothSpousesHaveQualifyingIncome === true &&
      (rule.incomeLimit === undefined ||
        measures.stateModifiedAdjustedGrossIncome < rule.incomeLimit);
    const share = stepAmount(
      rule.steps,
      measures.stateModifiedAdjustedGrossIncomeLessExemptions,
    );
    credits.push({
      name: rule.name,
      amount: joint ? Math.min(remaining * share, rule.cap) : 0,
      refundable: false,
    });
  }
  if (def.taxpayerCredit) {
    credits.push({
      name: def.taxpayerCredit.name,
      amount: taxpayerCredit(def, input, taxableIncome),
      refundable: false,
    });
  }
  const household = householdCredit(def, input, stateAgi);
  if (def.householdCredit) {
    credits.push({ name: def.householdCredit.name, amount: household, refundable: false });
  }
  if (def.earnedIncomeCredit) {
    const rule = def.earnedIncomeCredit;
    const federalCredit = nonNegative(
      input.federal.earnedIncomeCredit,
      'federal.earnedIncomeCredit',
    );
    // Maryland matches the federal childless credit at 100% and the with-child
    // credit at 50%, which is the opposite way round from every intuition about
    // state earned income credits.
    const childless = rule.childlessMatchRate !== undefined && unmarriedChildless(input);
    const matched = (childless ? rule.childlessMatchRate! : rule.matchRate) * federalCredit;
    credits.push({
      name: rule.name,
      // New York pays the match less the household credit, so the two are not
      // additive — Tax Law § 606(d)(1).
      amount: rule.reducedByHouseholdCredit ? Math.max(0, matched - household) : matched,
      refundable: rule.refundable,
    });
    if (rule.refundableMatchRate !== undefined) {
      // The floor under the non-refundable match above. Maryland's two published
      // earned income credits are one credit: the 50% (or 100%) half is capped at
      // the tax, and this pays the shortfall down to 45% of the federal credit —
      // 100% for a childless filer, whose whole match is paid whatever their tax.
      const floor = (childless ? rule.childlessMatchRate! : rule.refundableMatchRate) * federalCredit;
      credits.push({
        name: `${rule.name} (refundable half)`,
        amount: Math.max(0, floor - grossTax),
        refundable: true,
      });
    }
  }

  if (def.childCredit) {
    // Appended after the state's structural credits rather than inserted in form
    // order, because credit position is part of this package's contract and a
    // caller indexing credits[0] should not break when a credit is added.
    credits.push({
      name: def.childCredit.name,
      amount: childCredit(def, input),
      refundable: def.childCredit.refundable,
    });
  }

  // CalEITC and the Young Child Tax Credit, in that order: the second is gated
  // on the first, so it cannot be computed without it.
  const own = ownEarnedIncomeCredit(def, input);
  if (def.ownEarnedIncomeCredit) {
    credits.push({ name: def.ownEarnedIncomeCredit.name, amount: own ?? 0, refundable: true });
  }
  const young = youngChildCredit(def, input, own);
  if (def.youngChildCredit) {
    credits.push({ name: def.youngChildCredit.name, amount: young ?? 0, refundable: true });
  }
  if (def.steppedChildCredit) {
    credits.push({
      name: def.steppedChildCredit.name,
      amount: steppedChildCredit(def, input, taxableIncome),
      refundable: def.steppedChildCredit.refundable,
    });
  }
  if (def.propertyTaxRelief && propertyTaxRoute === 'credit' && propertyTax > 0) {
    credits.push({
      name: def.propertyTaxRelief.creditName,
      amount: def.propertyTaxRelief.credit[input.filingStatus],
      // Refundable: New Jersey pays it out to a filer with no tax liability.
      refundable: true,
    });
  }

  // The credit that stops the threshold above from being a cliff. It limits the
  // tax to a share of the income above the threshold — 10% in Massachusetts,
  // which is twice the statutory rate, so the band immediately above No Tax
  // Status is the most expensive marginal income an ordinary Massachusetts wage
  // earner ever earns.
  const limited = def.zeroTaxThreshold?.limitedIncomeCredit;
  if (limited && threshold !== undefined) {
    const withinCeiling = totalStateAgi <= threshold * limited.ceilingMultiple;
    const capped = limited.rate * Math.max(0, totalStateAgi - threshold);
    credits.push({
      name: limited.name,
      amount: withinCeiling && !belowThreshold ? Math.max(0, grossTax - capped) : 0,
      refundable: false,
    });
  }

  if (def.forgiveness) {
    credits.push({
      name: def.forgiveness.name,
      amount: forgivenessCredit(def, input, grossTax),
      refundable: false,
    });
  }
  const nonRefundable = credits.filter((c) => !c.refundable).reduce((s, c) => s + c.amount, 0);
  const refundable = credits.filter((c) => c.refundable).reduce((s, c) => s + c.amount, 0);
  const taxBeforeRefundableCredits = Math.max(0, grossTax - Math.min(grossTax, nonRefundable));
  const tax = taxBeforeRefundableCredits - refundable;

  return {
    conformityAmount: base,
    incomeBase: base + classes.details.reduce((sum, c) => sum + c.income, 0),
    addBacks: back,
    additions,
    subtractions,
    computedSubtractions,
    stateAgi,
    deduction,
    exemptions,
    taxableIncome,
    taxBeforeCredits,
    brackets,
    incomeClasses,
    surtaxes,
    credits,
    taxBeforeRefundableCredits,
    tax,
  };
}

/**
 * The state computation, having chosen between a property tax deduction and the
 * flat credit that replaces it.
 *
 * The NJ-1040 instructs the filer to compute the tax both ways and use the lower
 * result, which is not a shortcut for "deduct when the deduction is bigger": the
 * deduction is worth the filer's marginal rate times the property tax, and that
 * rate is itself a function of the deduction. Running the whole return twice is
 * both what the form says and the only way to get the boundary right.
 *
 * Ties go to the deduction, which is the order the form presents them in.
 */
function compute(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): Computed {
  const deducted = computeOnce(def, input, 'deduction');
  if (!def.propertyTaxRelief || qualifyingPropertyTax(def, input) === 0) return deducted;
  const credited = computeOnce(def, input, 'credit');
  return credited.tax < deducted.tax ? credited : deducted;
}

/**
 * Income as a Michigan city measures it.
 *
 * Supplied, or derived from federal AGI less retirement income. The derivation
 * is deliberately incomplete and the result says which way it errs: it removes
 * the pensions, annuities and IRA distributions the caller named, and cannot
 * remove the Social Security, unemployment compensation or military pay inside
 * federal AGI, all three of which a Michigan city also excludes entirely.
 */
function cityIncomeFor(input: StateIncomeTaxInput): number {
  if (input.cityIncome !== undefined) return nonNegative(input.cityIncome, 'cityIncome');
  return Math.max(0, input.federal.adjustedGrossIncome - (input.retirementIncome ?? 0));
}

/** The state figures a locality computes from. */
function stateFigures(computed: Computed, input: StateIncomeTaxInput): StateFigures {
  return {
    stateTaxableIncome: computed.taxableIncome,
    stateAdjustedGrossIncome: computed.stateAgi,
    stateNetTax: computed.taxBeforeRefundableCredits,
    cityIncome: cityIncomeFor(input),
    qualifyingWages: qualifyingWagesFor(input),
  };
}

/** Add one dollar of income to whichever federal figure this state starts from. */
function oneDollarMore(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): StateIncomeTaxInput {
  if (def.base === 'stateDefined' && def.stateDefinedBase?.field === 'massachusettsFivePercentIncome') {
    // The extra dollar is a dollar of 5.0% income, not of a capital gain: the
    // marginal rate a caller wants is the one on the next dollar they earn. It
    // still has to reach the No Tax Status threshold and the Limited Income
    // Credit, which are measured on Massachusetts AGI — and inside that band the
    // answer is 10%, twice the rate the schedule reports.
    return {
      ...input,
      massachusettsFivePercentIncome: (input.massachusettsFivePercentIncome ?? 0) + 1,
    };
  }
  if (def.base === 'stateDefined' && def.stateDefinedBase?.field === 'newJerseyGrossIncome') {
    // The extra dollar has to reach the retirement exclusion's income test as
    // well as the rate schedule: at $150,000 of total income it is worth
    // thousands, and holding the test figure constant would report the 5.525%
    // bracket rate for a filer who is actually standing on a cliff.
    return { ...input, newJerseyGrossIncome: (input.newJerseyGrossIncome ?? 0) + 1 };
  }
  if (def.base === 'stateDefined') {
    return {
      ...input,
      pennsylvaniaTaxableIncome: (input.pennsylvaniaTaxableIncome ?? 0) + 1,
      // Eligibility income moves with taxable income, and it has to: the whole
      // reason Pennsylvania's marginal rate spikes to roughly 30% is that the
      // extra dollar is measured against the forgiveness staircase, not against
      // the 3.07% rate.
      pennsylvaniaEligibilityIncome:
        (input.pennsylvaniaEligibilityIncome ?? input.pennsylvaniaTaxableIncome ?? 0) + 1,
    };
  }
  // A caller who can run the federal engine twice knows exactly what every
  // federal figure does on the next dollar, including the earned income credit.
  if (input.federalOneDollarHigher) {
    return { ...input, federal: input.federalOneDollarHigher };
  }
  // A real extra dollar of wages raises AGI and taxable income together. Raising
  // only the one this state happens to read would miss every rule keyed to the
  // other — the Illinois exemption cliff and the California exemption credit
  // phase-out are both measured against AGI while the tax is computed elsewhere.
  return {
    ...input,
    federal: {
      ...input.federal,
      adjustedGrossIncome: input.federal.adjustedGrossIncome + 1,
      taxableIncome: input.federal.taxableIncome + 1,
    },
  };
}

/**
 * The extra dollar again, for the credits computed on earnings rather than on a
 * federal figure.
 *
 * A dollar of wages is a dollar of earned income, and holding earned income
 * constant would report a marginal rate of zero across the whole of CalEITC —
 * where the true figure runs from **minus 34%** on the phase-in to **plus 34%**
 * one dollar later. This is applied on top of {@link oneDollarMore} rather than
 * inside it because the two are different claims: `federalOneDollarHigher` is
 * the caller telling this package what the federal engine did, and earned income
 * is a state input this package owns.
 *
 * The same dollar has to reach {@link StateIncomeTaxInput.qualifyingWages}, for
 * a stronger reason: an Ohio municipality's whole base is that field, so holding
 * it constant would report a municipal marginal rate of **zero** for a Columbus
 * resident whose next dollar of wages costs 2.5 cents — and the municipal tax is
 * the larger half of most Ohio returns.
 */
function withOneMoreEarnedDollar(input: StateIncomeTaxInput): StateIncomeTaxInput {
  const next = { ...input };
  if (input.earnedIncome !== undefined) next.earnedIncome = input.earnedIncome + 1;
  if (input.qualifyingWages !== undefined) next.qualifyingWages = input.qualifyingWages + 1;
  return next;
}

/**
 * Qualifying wages as an Ohio municipality measures them — O.R.C. § 718.01(R).
 *
 * Supplied, or taken from {@link StateIncomeTaxInput.earnedIncome}, which is the
 * same gross-wage figure for the great majority of filers. There is deliberately
 * no fall back to federal AGI: AGI holds the interest, dividends and capital
 * gains § 718.01(S) puts outside the base, and is net of above-the-line
 * deductions box 5 of the W-2 never saw, so it is a different figure rather than
 * a rough one. A caller who names an Ohio municipality and neither figure is
 * told so.
 */
function qualifyingWagesFor(input: StateIncomeTaxInput): number {
  if (input.qualifyingWages !== undefined) {
    return nonNegative(input.qualifyingWages, 'qualifyingWages');
  }
  if (input.earnedIncome !== undefined) return nonNegative(input.earnedIncome, 'earnedIncome');
  return 0;
}

/**
 * `city` and `workCity` belong to Michigan and Ohio, and naming the state is the
 * point of the error: a caller who passes `city: 'Louisville'` on a Kentucky
 * return has to learn that Kentucky's occupational taxes are not modelled here,
 * rather than receive a zero that looks like an answer.
 */
function requireCityState(input: StateIncomeTaxInput, field: 'city' | 'workCity'): void {
  if (input.state === 'MI' || input.state === 'OH') return;
  throw new RangeError(
    `${field} applies to a Michigan or Ohio return; state is ${input.state}. Michigan's 24 ` +
      `cities and Ohio's 679 municipalities are the city income taxes this package models. ` +
      `Kentucky's occupational taxes and Philadelphia's wage tax are not modelled, and ` +
      `returning zero for them would be a wrong answer rather than a missing one.`,
  );
}

/**
 * An Ohio municipality needs a wage figure and there is nothing to derive it
 * from, so this refuses rather than charging 2.5% of zero.
 *
 * The same reasoning that makes `workCity` without `workCityEarnings` an error:
 * a caller who named a municipality meant to be charged by it, and a silent zero
 * hides the largest tax on most Ohio returns.
 */
function requireQualifyingWages(input: StateIncomeTaxInput, field: 'city' | 'workCity'): void {
  if (input.state !== 'OH') return;
  if (input.qualifyingWages !== undefined || input.earnedIncome !== undefined) return;
  throw new RangeError(
    `${field} names an Ohio municipality but neither qualifyingWages nor earnedIncome was ` +
      `supplied, and an Ohio municipal income tax has no line on the IT 1040 behind it. The ` +
      `base is O.R.C. § 718.01(R) qualifying wages — box 5 of the W-2, which a 401(k) ` +
      `deferral does NOT reduce — plus a resident's net profit from business or rental. ` +
      `Federal AGI is not a substitute: § 718.01(S) puts interest, dividends and capital ` +
      `gains outside the base entirely, along with pensions, IRA distributions, Social ` +
      `Security and unemployment compensation.`,
  );
}

/** Two spellings of the same city, by the same normalisation the lookup uses. */
function sameCity(a: string, b: string): boolean {
  return normaliseCounty(a) === normaliseCounty(b);
}

/**
 * Every local income tax this filer owes, resident tax first.
 *
 * The locality is computed twice, on the state figures from each of the two runs
 * the marginal rate needs, so a local credit's cliff or phase-out shows up in the
 * local marginal rate the same way a state one does.
 */
function localTaxesFor(
  input: StateIncomeTaxInput,
  higherInput: StateIncomeTaxInput,
  here: Computed,
  higher: Computed,
): LocalIncomeTaxResult[] {
  const out: LocalIncomeTaxResult[] = [];

  if (input.locality !== undefined) {
    const owner = localityState(input.locality);
    if (owner !== input.state) {
      throw new RangeError(
        `${input.locality} is in ${owner}, not ${input.state}. A locality is only ever ` +
          `computed as part of its own state's return, because every figure it starts ` +
          `from is a line on that return.`,
      );
    }
    const def = getLocalityDefinition(input.locality, input.year);
    const computed = computeLocalResidentTax(def, input, stateFigures(here, input));
    const computedHigher = computeLocalResidentTax(def, higherInput, stateFigures(higher, higherInput));
    out.push(localResidentResult(def, computed, computedHigher.tax - computed.tax));
  }

  if (input.county !== undefined) {
    // The state decides which table the name is looked up in, and a state with no
    // county income tax at all is an error naming the two that have one.
    const def = countyDefinition(input.state, input.county, input.year);
    const computed = computeLocalResidentTax(def, input, stateFigures(here, input));
    const computedHigher = computeLocalResidentTax(def, higherInput, stateFigures(higher, higherInput));
    out.push(localResidentResult(def, computed, computedHigher.tax - computed.tax));
  }

  // Michigan: the work city is computed first, because the home city's credit is
  // capped against the tax it produced and against the income it reached.
  let peerLocality: { name: string; tax: number; taxedIncome: number } | undefined;
  const workCityEarnings = nonNegative(input.workCityEarnings, 'workCityEarnings');
  if (input.workCity !== undefined) {
    requireCityState(input, 'workCity');
    if (input.city !== undefined && sameCity(input.city, input.workCity)) {
      throw new RangeError(
        `workCity and city are both "${input.workCity}". A resident pays the resident tax on ` +
          `everything they earn, wherever they earn it, and never the nonresident tax as well. ` +
          `Pass workCity only for a DIFFERENT taxing city the filer worked in.`,
      );
    }
    const def = cityDefinition(input.state, input.workCity, input.year);
    // Michigan's cities allow their exemptions against city-source income; Ohio
    // has none to allow, so the two agree by way of `exemptionAmount` being
    // absent rather than by a special case here.
    const taxedIncome = nonresidentTaxableEarnings(def, workCityEarnings, input);
    const result = localNonresidentEarningsResult(def, workCityEarnings, input);
    out.push(result);
    peerLocality = { name: def.name, tax: result.tax, taxedIncome };
  }

  if (input.city !== undefined) {
    requireCityState(input, 'city');
    requireQualifyingWages(input, 'city');
    const def = cityDefinition(input.state, input.city, input.year);
    const computed = computeLocalResidentTax(def, input, stateFigures(here, input), peerLocality);
    const computedHigher = computeLocalResidentTax(
      def,
      higherInput,
      stateFigures(higher, higherInput),
      peerLocality,
    );
    out.push(localResidentResult(def, computed, computedHigher.tax - computed.tax));
  }

  const earnings = nonNegative(input.yonkersNonresidentEarnings, 'yonkersNonresidentEarnings');
  // A Yonkers resident pays the surcharge instead, never both — so the earnings
  // figure is ignored rather than added, which is what Form Y-203 says and what a
  // caller who supplies both almost certainly means.
  if (earnings > 0 && input.locality !== 'YONKERS') {
    if (input.state !== 'NY') {
      throw new RangeError(
        `yonkersNonresidentEarnings applies to a New York return; state is ${input.state}. ` +
          `Yonkers taxes the Yonkers-source wages of non-residents, but the tax is reported ` +
          `on a New York return.`,
      );
    }
    out.push(localNonresidentEarningsResult(getLocalityDefinition('YONKERS', input.year), earnings));
  }

  return out;
}

/**
 * Compute a state's individual income tax.
 *
 * @throws {RangeError} when the state or the state-year is not supported. There is
 * no silent fallback to a neighbouring year: the states that changed their rate for
 * 2026 — Georgia, Indiana, Kentucky, Mississippi, North Carolina and Utah all did —
 * are exactly the ones where a fallback would look right and be wrong.
 */
export function stateIncomeTax(input: StateIncomeTaxInput): StateIncomeTaxResult {
  const def = getStateDefinition(input.state, input.year);
  const name = stateName(input.state);

  if (def.rate.kind === 'none') {
    return {
      state: input.state,
      stateName: name,
      year: input.year,
      filingStatus: input.filingStatus,
      hasIncomeTax: false,
      conformity: { base: def.base, amount: 0 },
      additions: 0,
      addBacks: [],
      subtractions: 0,
      computedSubtractions: [],
      deduction: 0,
      exemptions: 0,
      taxableIncome: 0,
      taxBeforeCredits: 0,
      incomeClasses: [],
      surtaxes: [],
      credits: [],
      tax: 0,
      brackets: [],
      marginalRate: 0,
      effectiveRate: 0,
      localTaxes: [],
      totalTax: 0,
      totalMarginalRate: 0,
      provisional: def.status === 'provisional',
      notes: def.notes,
      citations: def.citations,
    };
  }

  const here = compute(def, input);
  const higherInput = withOneMoreEarnedDollar(oneDollarMore(def, input));
  const higher = compute(def, higherInput);
  const localTaxes = localTaxesFor(input, higherInput, here, higher);

  // Notes that depend on what the caller supplied rather than on the state, so a
  // model reading the result learns that a figure it left out was load-bearing.
  const dynamic: string[] = [];
  if (def.earnedIncomeCredit && input.federal.earnedIncomeCredit === undefined) {
    dynamic.push(
      `${def.name} has an earned income credit worth ${(def.earnedIncomeCredit.matchRate * 100).toFixed(0)}% ` +
        `of the federal one, and no federal earned income credit was supplied, so it was computed ` +
        `as zero. Supply the federal credit (Form 1040 line 27) if this filer claims it — otherwise ` +
        `this return is too high for exactly the low-income filers the credit exists for.`,
    );
  }
  if (def.earnedIncomeCredit && input.federal.earnedIncomeCredit && !input.federalOneDollarHigher) {
    dynamic.push(
      'marginalRate holds the federal earned income credit constant. Inside that credit’s ' +
        'phase-out the true state marginal rate is higher than the figure reported here by ' +
        `${(def.earnedIncomeCredit.matchRate * 100).toFixed(0)}% of the federal phase-out rate — up to ` +
        `${(def.earnedIncomeCredit.matchRate * 21.06).toFixed(2)} points for a filer with two or more ` +
        'children. Supply federalOneDollarHigher for the exact figure.',
    );
  }
  if (def.ownEarnedIncomeCredit) {
    const rule = def.ownEarnedIncomeCredit;
    const biggest = rule.byChildCount[rule.byChildCount.length - 1]!;
    const most = roundCents(
      biggest.earnedIncomeAmount * biggest.phaseInRate * rule.adjustmentFactor,
    );
    if (input.earnedIncome === undefined) {
      // Quantified rather than hedged, the same way the missing-locality note is:
      // the caller learns what the field they left out is worth, not that it
      // exists. This is the largest single omission a California return can have.
      dynamic.push(
        `${def.name}'s ${rule.name} is computed on earned income, and earnedIncome was not ` +
          `supplied, so it was computed as zero — along with the ${def.youngChildCredit?.name ?? 'young child credit'} ` +
          `that is gated on it. Both are refundable and together they are worth up to ` +
          `$${most.toLocaleString('en-US')} plus $${(def.youngChildCredit?.amount ?? 0).toLocaleString('en-US')}, ` +
          `which for a low-income family is more than the whole ${def.name} tax above. Supply ` +
          `earnedIncome (wages plus net self-employment earnings) and dependentAges.`,
      );
    } else if (dependentCount(input) > 0 && input.dependentAges === undefined) {
      dynamic.push(
        `${def.name}'s ${rule.name} depends on how many dependents are qualifying children, ` +
          `and dependentAges was not supplied, so it was computed as zero rather than on the ` +
          `childless schedule — which for this return would have been wrong by up to ` +
          `$${most.toLocaleString('en-US')}. Supply an age for every dependent.`,
      );
    } else {
      dynamic.push(
        `${rule.name} here counts dependents aged ${rule.qualifyingChildMaxAge} or under as ` +
          `qualifying children. A full-time student under 24, and a dependent permanently and ` +
          `totally disabled at any age, also qualify and this package cannot see either — such ` +
          `a return is too high. ${def.name} also requires a filer with no qualifying children ` +
          `to be at least ${rule.minimumAgeWithoutChildren}, which is not checked here.`,
      );
    }
  }
  if (def.childCredit && (input.dependents ?? 0) > 0 && input.dependentAges === undefined) {
    const young = def.childCredit.amountByAge[0];
    dynamic.push(
      `${def.name} has a ${def.childCredit.name.toLowerCase()} banded on each dependent's age, ` +
        `and dependentAges was not supplied, so it was computed as zero. It is worth up to ` +
        `$${young?.amount.toLocaleString('en-US') ?? '0'} per dependent and it is refundable — ` +
        `this family return is too high by that much per child until the ages are given.`,
    );
  }
  if (def.payrollTaxDeduction && input.socialSecurityAndMedicarePaid === undefined) {
    const rule = def.payrollTaxDeduction;
    const worth = rule.perFilerCap * filerCount(input.filingStatus);
    dynamic.push(
      `${def.name} deducts ${rule.name.toLowerCase()} up to $${rule.perFilerCap.toLocaleString('en-US')} ` +
        `per filer, and socialSecurityAndMedicarePaid was not supplied, so it was computed as ` +
        `zero — which is right for a filer with no earnings and too high by up to ` +
        `$${worth.toLocaleString('en-US')} of deduction for everyone else. There is no federal ` +
        `equivalent of this deduction, so it cannot be recovered from any figure on a federal ` +
        `return; the employee half of FICA is 7.65% of wages, so the cap binds at ` +
        `$${Math.round(rule.perFilerCap / 0.0765).toLocaleString('en-US')} of wages per filer.`,
    );
  }
  const counties = input.county === undefined ? countiesFor(input.state, input.year) : [];
  if (counties.length > 0) {
    // Stronger than the New York note below, because the omission is worse. Every
    // Maryland and every Indiana resident owes a county tax; only 43% of New
    // Yorkers owe a city one. So this quantifies both ends of the range, run
    // through the same engine on this filer's own figures rather than quoted from
    // a rate chart.
    const costs = counties
      .map((county) => ({
        name: county.name,
        tax: computeLocalResidentTax(county, input, stateFigures(here, input)).tax,
      }))
      .sort((a, b) => a.tax - b.tax);
    const cheapest = costs[0]!;
    const dearest = costs[costs.length - 1]!;
    const shown = (value: number) =>
      roundCents(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    dynamic.push(
      `No county was supplied, so this is the ${def.name} STATE tax alone, and no ` +
        `${def.name} resident pays only that: all ${counties.length} of its jurisdictions levy a ` +
        `county income tax on the same taxable income. For this filer it runs from ` +
        `$${shown(cheapest.tax)} (${cheapest.name}) to $${shown(dearest.tax)} ` +
        `(${dearest.name}) — pass the county the filer lived in on 1 January.`,
    );
  }
  if (input.state === 'OH' && input.city === undefined) {
    // Ohio's is the strongest of the three, because for most Ohio filers the
    // municipal tax is the LARGER of the two. Quantified on this filer's own
    // wages, and only when there are wages to quantify it on.
    const wages = qualifyingWagesFor(input);
    const cities = citiesFor('OH', input.year);
    const levying = cities.filter((c) => c.rate.kind === 'flat' && c.rate.rate > 0);
    const rates = levying
      .map((c) => (c.rate.kind === 'flat' ? c.rate.rate : 0))
      .sort((a, b) => a - b);
    const low = rates[0] ?? 0;
    const high = rates[rates.length - 1] ?? 0;
    const shown = (value: number) =>
      roundCents(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    dynamic.push(
      wages > 0
        ? `No city was supplied, so this is the Ohio STATE tax alone. ${cities.length} Ohio ` +
            `municipalities levy an income tax of their own on qualifying wages — box 5 of the ` +
            `W-2, not any line of the IT 1040 — at ${(low * 100).toFixed(2)}% to ` +
            `${(high * 100).toFixed(2)}%. On this filer's $${shown(wages)} of wages that is ` +
            `$${shown(wages * low)} to $${shown(wages * high)}, and $${shown(wages * 0.025)} in ` +
            `Columbus, Cleveland, Toledo, Akron or Dayton. For most Ohio filers the municipal ` +
            `tax is LARGER than the state one — pass city and qualifyingWages.`
        : `No city was supplied, so this is the Ohio STATE tax alone. ${cities.length} Ohio ` +
            `municipalities levy an income tax of their own at ${(low * 100).toFixed(2)}% to ` +
            `${(high * 100).toFixed(2)}% of qualifying wages — box 5 of the W-2, which a 401(k) ` +
            `deferral does not reduce, and not any line of the IT 1040. For most Ohio filers it ` +
            `is LARGER than the state tax: 2.5% in Columbus, Cleveland, Toledo, Akron and ` +
            `Dayton. Pass city and qualifyingWages.`,
    );
  }
  if (
    input.state === 'OH' &&
    input.city !== undefined &&
    input.qualifyingWages === undefined &&
    input.earnedIncome !== undefined
  ) {
    dynamic.push(
      `qualifyingWages was not supplied, so the municipal tax above was computed on ` +
        `earnedIncome. That is right for a wage earner — O.R.C. § 718.01(R) reaches box 5 of ` +
        `the W-2, which is gross of a 401(k) deferral, and earnedIncome is gross wages here ` +
        `too — and it is TOO LOW for a resident with net profit from a business or a rental, ` +
        `which their municipality also taxes.`,
    );
  }
  if (
    input.state === 'OH' &&
    input.city !== undefined &&
    input.workCity !== undefined &&
    input.residentCreditRate === undefined &&
    input.residentCreditLimitRate === undefined
  ) {
    const credited = localTaxes
      .flatMap((l) => l.credits)
      .filter((c) => c.name.startsWith('Credit for income tax paid to'))
      .reduce((sum, c) => sum + c.amount, 0);
    const shown = roundCents(credited).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    dynamic.push(
      `Ohio has NO statutory resident credit — O.R.C. Chapter 718 leaves it to each ` +
        `municipality's own ordinance — so the credit of $${shown} above is an ASSUMPTION: ` +
        `100% of the tax paid to the work municipality, capped at the home municipality's own ` +
        `rate, which is the common ordinance but not the universal one. A municipality that ` +
        `credits less would raise this return by up to $${shown}. Ohio's own municipal rate ` +
        `table publishes the two figures as the "Credit Rate" and "Credit Factor" columns; ` +
        `pass them as residentCreditRate and residentCreditLimitRate.`,
    );
  }
  if (input.state === 'MI' && input.city === undefined) {
    // Weaker than the county note above and deliberately so: most Michigan
    // residents live in none of the 24, so this says what the two extremes would
    // cost rather than claiming the filer owes something. Both figures are this
    // filer's own, run through the same engine.
    const cities = citiesFor('MI', input.year);
    const costs = cities
      .map((city) => ({
        name: city.name,
        tax: computeLocalResidentTax(city, input, stateFigures(here, input)).tax,
      }))
      .sort((a, b) => a.tax - b.tax);
    const cheapest = costs[0]!;
    const dearest = costs[costs.length - 1]!;
    const shown = (value: number) =>
      roundCents(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    dynamic.push(
      `No city was supplied, so this is the Michigan STATE tax alone. ${cities.length} Michigan ` +
        `cities levy an income tax of their own on a base the MI-1040 does not contain, and for ` +
        `this filer they run from $${shown(cheapest.tax)} (${cheapest.name}) to ` +
        `$${shown(dearest.tax)} (${dearest.name}) — pass city if the filer lives in one of them. ` +
        `Most Michigan residents live in none, and owe nothing.`,
    );
  }
  if (input.state === 'MI' && input.city !== undefined && input.cityIncome === undefined) {
    dynamic.push(
      `cityIncome was not supplied, so the city tax above was computed on federal AGI less any ` +
        `retirementIncome given. A Michigan city excludes pensions, annuities and IRA ` +
        `distributions, Social Security, unemployment compensation and military pay ENTIRELY, ` +
        `and federal AGI contains the last three — so this answer is TOO HIGH by the city rate ` +
        `times whatever the filer has of them. It is exact for a wage earner with none.`,
    );
  }
  if (input.state === 'NY' && input.locality === undefined) {
    // Quantified rather than hedged: the city tax this exact filer would owe, run
    // through the same engine, so a caller who left `locality` out learns what it
    // is worth for them rather than being told that it exists.
    const nyc = getLocalityDefinition('NYC', input.year);
    const cost = roundCents(computeLocalResidentTax(nyc, input, stateFigures(here, input)).tax);
    const shown = cost.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    dynamic.push(
      `No locality was supplied, so this is the New York State tax alone. A New York City ` +
        `resident with these figures owes a further $${shown} of city income tax — ` +
        `pass locality: 'NYC'. A Yonkers resident owes a surcharge of 16.75% of the state tax ` +
        `above; pass locality: 'YONKERS'. Roughly 43% of New York State filers live in one of ` +
        `the two.`,
    );
  }

  const localTax = localTaxes.reduce((s, l) => s + l.tax, 0);
  const localMarginal = localTaxes.reduce((s, l) => s + l.marginalRate, 0);
  // Rates are reported to four places, which is what rounding the cent of tax on
  // one dollar of income amounts to.
  const rate = (value: number) => roundCents(value * 100) / 100;
  const stateMarginal = rate(higher.tax - here.tax);

  return {
    state: input.state,
    stateName: name,
    year: input.year,
    filingStatus: input.filingStatus,
    hasIncomeTax: true,
    conformity: { base: def.base, amount: roundCents(here.conformityAmount) },
    additions: roundCents(here.additions),
    addBacks: here.addBacks.map((a) => ({ name: a.name, amount: roundCents(a.amount) })),
    subtractions: roundCents(here.subtractions),
    computedSubtractions: here.computedSubtractions.map((x) => ({
      name: x.name,
      amount: roundCents(x.amount),
    })),
    deduction: roundCents(here.deduction),
    exemptions: roundCents(here.exemptions),
    taxableIncome: roundCents(here.taxableIncome),
    taxBeforeCredits: roundCents(here.taxBeforeCredits),
    incomeClasses: here.incomeClasses.map((c) => ({
      name: c.name,
      rate: c.rate,
      income: roundCents(c.income),
      taxableAmount: roundCents(c.taxableAmount),
      tax: roundCents(c.tax),
    })),
    surtaxes: here.surtaxes.map((s) => ({ name: s.name, amount: roundCents(s.amount) })),
    credits: here.credits.map((c) => ({ ...c, amount: roundCents(c.amount) })),
    tax: roundCents(here.tax),
    brackets: here.brackets.map((b) => ({
      rate: b.rate,
      incomeInBracket: roundCents(b.incomeInBracket),
      tax: roundCents(b.tax),
    })),
    marginalRate: stateMarginal,
    effectiveRate: here.incomeBase > 0 ? here.tax / here.incomeBase : 0,
    localTaxes,
    totalTax: roundCents(here.tax + localTax),
    totalMarginalRate: rate(stateMarginal + localMarginal),
    provisional: def.status === 'provisional',
    notes: dynamic.length > 0 ? [...dynamic, ...def.notes] : def.notes,
    citations: def.citations,
  };
}

export { getStateDefinition, isSupported, stateName, supportedYears };
export type { FilingStatus, StateCode };
