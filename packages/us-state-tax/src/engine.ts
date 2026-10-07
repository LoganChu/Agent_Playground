/**
 * The generic state income tax computation.
 *
 * One function serves every supported state. The differences between states live
 * in {@link StateIncomeTaxDefinition} data, not in branches here, which is what
 * makes the conformity choice visible rather than buried.
 */
import { claimedFilerCount, livingFilerCount } from './definition.js';
import type {
  AgeDeductionRule,
  ByChildCount,
  ExemptionRule,
  FractionThereofStaircase,
  IncomeMeasure,
  OwnEarnedIncomeCreditRule,
  RetirementIncomeSubtractionRule,
  StateIncomeTaxDefinition,
  TaxFractionStep,
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
import { ohioSchoolDistrict } from './localities/ohio-school-districts.js';
import { getStateDefinition, isSupported, stateName, supportedYears } from './states/index.js';
import { KNOWN_STATE_INPUT_FIELDS, PERSON_RETIREMENT_FIELDS } from './types.js';
import { nearestFields, unknownInputNotes } from './unknown-input.js';
import type { UnknownKeyOptions } from './unknown-input.js';
import type {
  Bracket,
  BracketDetail,
  CreditDetail,
  FilingStatus,
  IncomeClassDetail,
  LocalIncomeTaxResult,
  StateCode,
  StateIncomeTaxInput,
  StateIncomeTaxOptions,
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

/**
 * Oregon's ORS 316.695(8) addition — `$1,200` a person on a single or head of
 * household return and `$1,000` a person on a joint, separate or surviving
 * spouse one, for each filer who has reached 65 and again for each who is
 * blind.
 *
 * It is inside the STANDARD deduction rather than beside it, which is the half
 * that costs money: the figure it is part of is the one compared with the
 * itemized total, so an Oregon filer who itemizes loses their age addition too.
 * Every aged *exemption* in this package survives itemizing; this does not.
 */
function agedOrBlindDeductionAddition(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): number {
  const rule = def.standardDeductionAgedOrBlindAddition;
  if (!rule) return 0;
  const per = rule.amount[input.filingStatus];
  // The two conditions stack on one person — a blind filer of 65 claims both —
  // so these are added rather than max()ed. Blindness is capped at the number of
  // living filers because `blindOrDisabled` counts filers and not dependents.
  const aged = seniorFilers(input, rule.age);
  const blind = Math.min(
    nonNegative(input.blindOrDisabled, 'blindOrDisabled'),
    livingFilerCount(input.filingStatus),
  );
  return per * (aged + blind);
}

function standardDeduction(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  stateAgi: number,
): number {
  const agedOrBlind = agedOrBlindDeductionAddition(def, input);
  if (agedOrBlind > 0 && def.deduction.kind === 'table') {
    return def.deduction.amounts[input.filingStatus] + agedOrBlind;
  }
  switch (def.deduction.kind) {
    case 'none':
      return 0;
    case 'federal':
      return input.federal.deduction;
    case 'table':
      return def.deduction.amounts[input.filingStatus];
    case 'slidingScale': {
      // A RATE and not a staircase: Wisconsin withdraws a percentage of every
      // dollar above the threshold, continuously, so the withdrawal is part of
      // the filer's marginal rate rather than a step in it. Read against the
      // state's own AGI (Form 1 line 7), which is why `stateAgi` has to be a
      // figure by the time this runs.
      const rule = def.deduction;
      const tiers = rule.tiers[input.filingStatus];
      const income = requireStateAgi(stateAgi);
      let withdrawn = 0;
      tiers.forEach((tier, i) => {
        // The next tier's threshold, or no ceiling for the last one. Head of
        // household is the only status with two, and its second threshold is
        // the income at which its deduction has fallen to the single one.
        const to = tiers[i + 1]?.above ?? Infinity;
        withdrawn += tier.rate * Math.max(0, Math.min(income, to) - tier.above);
      });
      return Math.max(0, rule.maximum[input.filingStatus] - withdrawn);
    }
    case 'phaseOutStaircase': {
      const rule = def.deduction;
      const status = input.filingStatus;
      // floor(), not ceil(). § 40-18-15(b) reduces the deduction "for each $500"
      // of AGI above the threshold and says nothing about a fraction of one, so
      // the first $499 above the threshold cost nothing — the exact opposite of
      // Connecticut's "or fraction thereof", where the first dollar costs a whole
      // step. The two conventions are a step of deduction apart at every
      // boundary of both charts and nothing but the words distinguishes them.
      const steps = Math.floor(
        Math.max(0, stateAgi - rule.threshold[status]) / rule.increment[status],
      );
      return Math.max(
        rule.min[status],
        rule.maximum[status] - steps * rule.reduction[status],
      );
    }
  }
}

/**
 * The invariant that keeps the two placements of the federal income tax
 * deduction from being circular.
 *
 * A state whose deduction comes off its own AGI — Oregon — is computed BEFORE
 * state AGI exists, so it is called with no state AGI to read. That is safe
 * only because Oregon's chart reads FEDERAL AGI. A state that both reduced its
 * own AGI by this deduction and read its own AGI to size it would be asking for
 * a figure that does not exist yet, and this says so loudly rather than
 * answering with a zero that would look like a small deduction.
 *
 * `registry.test.js` rules the combination out at the definition level, so this
 * is the second line of defence and not the first.
 */
function requireStateAgi(stateAgi: number | undefined): number {
  if (stateAgi === undefined) {
    throw new Error(
      'internal: a federal income tax deduction that reduces state AGI cannot also be ' +
        'sized from state AGI — set capStepsBasis to federalAdjustedGrossIncome',
    );
  }
  return stateAgi;
}

/**
 * The deduction for the federal income tax itself — Alabama's Form 40 line 12.
 *
 * It is the federal bill after non-refundable credits, less the refundable
 * credits that are money received rather than tax paid, floored at zero. The
 * floor is load-bearing rather than defensive: a family whose earned income
 * credit exceeds their federal tax has a NEGATIVE federal bill, and without the
 * floor Alabama would add it to their taxable income.
 */
function federalIncomeTaxDeduction(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  stateAgi: number | undefined,
): number {
  const rule = def.federalIncomeTaxDeduction;
  if (!rule) return 0;
  const federal = input.federal;
  const tax = nonNegative(
    federal.incomeTaxBeforeRefundableCredits,
    'federal.incomeTaxBeforeRefundableCredits',
  );
  // The LIST, not a constant: Alabama's worksheet subtracts the refundable
  // child tax credit and Missouri's does not, because Missouri starts from
  // Form 1040 line 22 and line 28 never reduced it. The same $1,600 of
  // refundable credit therefore raises an Alabama family's tax and leaves a
  // Missouri family's alone.
  const refundable = rule.refundableCredits.reduce(
    (sum, credit) => sum + nonNegative(federal[credit], `federal.${credit}`),
    0,
  );
  const net = Math.max(0, tax - refundable);
  // Oregon. A chart that picks the CEILING rather than the share, read against
  // FEDERAL AGI rather than the state's own — so nothing Oregon does to its
  // base can move the step, which is the opposite of Missouri, where the
  // capital-gains subtraction walks a filer down the chart. `from` is the
  // step's inclusive lower bound: the Department of Revenue's 2026 withholding
  // formula writes the row as "greater than or equal to $125,000 and less than
  // $130,000", so the filer standing exactly on a boundary takes the SMALLER
  // ceiling — the opposite convention from Missouri's statute, on the same
  // question, in the same rule.
  if (rule.capSteps) {
    const basis =
      rule.capStepsBasis === 'stateAdjustedGrossIncome'
        ? requireStateAgi(stateAgi)
        : nonNegative(federal.adjustedGrossIncome, 'federal.adjustedGrossIncome');
    let cap = 0;
    for (const step of rule.capSteps[input.filingStatus]) {
      if (basis >= step.from) cap = step.amount;
    }
    return Math.min(net, cap);
  }
  // Alabama has neither of the two below: 100% of the bill, uncapped.
  if (!rule.rateSteps) return net;
  // A CLIFF, not a phase-out. § 143.171.2 picks ONE percentage for the whole
  // bill out of a chart of five, and `upTo` is inclusive because the statute
  // says "twenty-five thousand dollars or less" and then "in excess of
  // twenty-five thousand dollars". So the filer standing exactly on a boundary
  // keeps the higher share — and the filer one dollar above them loses the
  // whole step at once. At $100,000 that one dollar is worth $61.57.
  const step = rule.rateSteps.find((s) => requireStateAgi(stateAgi) <= s.upTo);
  const shared = net * (step?.rate ?? 0);
  return rule.cap ? Math.min(shared, rule.cap[input.filingStatus]) : shared;
}

/**
 * Missouri's Form MO-A Part 3 — Social Security, public pensions and private
 * pensions, read in the order C, A, B because each section needs the last one's
 * answer.
 *
 * The whole of the interest is in what Section A does with what Section C just
 * produced: the public pension exemption is the lesser of the pension and the
 * maximum Social Security benefit, **less the Social Security deduction already
 * taken.** A retiree's benefit eats their pension exemption dollar for dollar,
 * in the state that says it exempts both.
 */
function stateRetirementDeduction(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  stateAgi: number,
): number {
  const rule = def.stateRetirementDeduction;
  if (!rule) return 0;
  const { people } = retirementPeople(input);
  const taxableSocialSecurity = nonNegative(
    input.taxableSocialSecurity,
    'taxableSocialSecurity',
  );

  // Section C. The age test is on the PERSON, and the household's taxable
  // benefit is one figure — so where the two people differ in age the taxable
  // part is split in proportion to the gross benefits each of them received,
  // which is the only split a return carries. A household that supplies no
  // split is treated as one person's benefit and a note says so.
  const grossBenefits = people.reduce((sum, p) => sum + p.benefits, 0);
  let socialSecurity = 0;
  if (taxableSocialSecurity > 0) {
    if (grossBenefits > 0) {
      for (const person of people) {
        if ((person.age ?? 0) >= rule.socialSecurityMinimumAge || person.disabled) {
          socialSecurity += taxableSocialSecurity * (person.benefits / grossBenefits);
        }
      }
    } else if (people.some((p) => (p.age ?? 0) >= rule.socialSecurityMinimumAge || p.disabled)) {
      socialSecurity = taxableSocialSecurity;
    }
  }

  // Section A, per person, and the subtraction of the Section C figure is the
  // provision rather than a rounding of it.
  let publicPension = 0;
  for (const person of people) {
    const pension = Math.min(person.governmentPension, rule.publicPensionCap);
    const ownSocialSecurity =
      grossBenefits > 0 ? socialSecurity * (person.benefits / grossBenefits) : socialSecurity;
    publicPension += Math.max(0, pension - ownSocialSecurity);
  }

  // Military retired pay, exempt in full and outside both caps.
  const military = people.reduce((sum, p) => sum + p.military, 0);

  // Section B. The cap is per person and the withdrawal is on the RETURN, so
  // two people with $6,000 each lose $12,000 over the same $12,000 of income —
  // and the income it is measured on takes the taxable Social Security back
  // out, which is the opposite of what Section A did with the same dollars.
  const perPerson = people.reduce(
    (sum, p) => sum + Math.min(p.pension + p.ira, rule.privatePensionPerPersonCap),
    0,
  );
  const excess = Math.max(
    0,
    stateAgi - taxableSocialSecurity - rule.privatePensionAllowance[input.filingStatus],
  );
  const privatePension = Math.max(0, perPerson - excess);

  return socialSecurity + publicPension + military + privatePension;
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
  // Alabama allows the FICA and self-employment taxes paid as a tax paid on its
  // own Schedule A — § 40-18-15(a)(3) — which is why nearly every Alabama wage
  // earner should itemize. The caller's own Schedule A total wins when they
  // supply one; it is not added to the payroll figure, because a filer who had
  // already put their FICA on their Schedule A would otherwise deduct it twice.
  const claimed =
    input.stateItemizedDeductions === undefined && rule.payrollTaxIsItemized === true
      ? nonNegative(input.socialSecurityAndMedicarePaid, 'socialSecurityAndMedicarePaid')
      : nonNegative(input.stateItemizedDeductions, 'stateItemizedDeductions');
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
function stateDeduction(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  stateAgi: number,
): number {
  // A filer takes the larger of the two, which is also what a state that forces
  // the standard deduction when the itemized figure falls below it produces —
  // the Maryland instructions say so in as many words, and it is the same
  // arithmetic.
  const itemized = itemizedDeduction(def, input);
  // Virginia does not offer the larger of the two. Itemizing federally compels
  // itemizing here, so the max() that is right everywhere else would hand a
  // Virginia filer a deduction the statute forbids them.
  const forced =
    def.itemizedDeduction?.forcedWhenFederalItemizing === true &&
    input.federal.deductionKind === 'itemized' &&
    (input.stateItemizedDeductions ?? 0) > 0;
  let total = forced ? itemized : Math.max(standardDeduction(def, input, stateAgi), itemized);

  // Alabama's federal income tax deduction is NOT part of that max(). Form 40
  // line 11 is the standard-or-itemized choice and line 12 is the federal tax,
  // below it and additional to it, so every Alabama filer deducts the federal
  // bill whether they itemize or not. Missouri's MO-1040 line 13 sits in the
  // same place below the same choice, for a share of the same bill.
  // Oregon's is an INCOME subtraction instead — Schedule OR-ASC, inside Oregon
  // adjusted gross income — so it has already come off the base by the time
  // this runs and adding it here would take it twice.
  if (def.federalIncomeTaxDeduction?.reducesStateAdjustedGrossIncome !== true) {
    total += federalIncomeTaxDeduction(def, input, stateAgi);
  }

  // Missouri's MO-A Part 3. A deduction and not an AGI subtraction, which in
  // Missouri is worth money rather than being a matter of form order: the line
  // above reads state AGI, so a retirement exemption that sat inside AGI would
  // move the federal income tax deduction's rate chart and one that sits below
  // it does not.
  total += stateRetirementDeduction(def, input, stateAgi);

  // Missouri's § 143.022 — a fifth of business income, at every income, with no
  // cap and no change of rate above one. Ohio's rule of the same name is the
  // other shape entirely and lives in the AGI block, because Ohio's deduction
  // moves Ohio AGI and this one does not move Missouri's.
  if (def.businessIncomeDeduction) {
    total +=
      def.businessIncomeDeduction.rate * nonNegative(input.businessIncome, 'businessIncome');
  }

  if (def.payrollTaxDeduction) {
    const paid = nonNegative(input.socialSecurityAndMedicarePaid, 'socialSecurityAndMedicarePaid');
    // Per LIVING filer, so a joint return with two working spouses deducts
    // twice as much — but only up to what was actually paid between them, which
    // is the one figure this package cannot split.
    //
    // A qualifying surviving spouse is one person and the cap is $2,000, not
    // $4,000. Massachusetts Form 1 does not offer the status at all — its four
    // are single, married filing jointly, married filing separately and head of
    // household — and the deduction is for what a person PAID: lines 11a and
    // 11b of Form 1 are "you" and "your spouse", and a spouse who died before
    // the tax year began paid nothing. The cap binds at $26,144 of wages, so
    // this was $2,000 of deduction and $100 of tax on every widowed
    // Massachusetts earner above that.
    total += Math.min(paid, def.payrollTaxDeduction.perFilerCap * livingFilerCount(input.filingStatus));
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

/**
 * Dependents young enough for {@link ExemptionRule.perQualifyingChild}.
 *
 * Zero without {@link StateIncomeTaxInput.dependentAges}, deliberately and
 * loudly: the engine cannot tell a child from a dependent parent out of a
 * count, and guessing the generous way would understate an Indiana return with
 * a dependent grandparent on it by `$74.55`. The dynamic note that goes with
 * this says what the omission cost.
 *
 * The student band is applied to the OLDEST dependents inside it first. A
 * caller says how many dependents are full-time students but not which, and
 * the two readings differ only when a dependent is between
 * {@link ExemptionRule.qualifyingChildMaxAge} and
 * {@link ExemptionRule.qualifyingChildStudentMaxAge} — which is exactly where
 * this assignment puts them.
 */
function qualifyingChildCount(rule: ExemptionRule, input: StateIncomeTaxInput): number {
  const ages = input.dependentAges;
  if (ages === undefined) return 0;
  const childMax = rule.qualifyingChildMaxAge ?? Number.POSITIVE_INFINITY;
  const byAge = ages.filter((age) => age <= childMax).length;
  const studentMax = rule.qualifyingChildStudentMaxAge;
  if (studentMax === undefined || studentMax <= childMax) return byAge;
  const students = nonNegative(input.dependentsAttendingCollege, 'dependentsAttendingCollege');
  const inBand = ages.filter((age) => age > childMax && age <= studentMax).length;
  return byAge + Math.min(students, inBand);
}

/**
 * The spouse IRC § 151(b) puts on a separate return — 1 or 0.
 *
 * Three conditions, and the third is a fact no return carries: the status is a
 * separate one, the state has said in its own words that it counts the spouse,
 * and the caller has answered the question. Any state that has not been read
 * counts nobody, which is both today's behaviour and the answer that does not
 * flatter the filer.
 */
function separateReturnSpouse(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): number {
  if (input.filingStatus !== 'marriedFilingSeparately') return 0;
  if (def.exemption?.separateReturnSpouse.spouse !== 'claimed') return 0;
  return input.spouseHasNoGrossIncomeAndIsNotADependent === true ? 1 : 0;
}

/**
 * The same spouse, for the state's aged and blind ADDITIONS — a second question.
 *
 * Only Virginia has been read on it, and Virginia answers it by cross-reference:
 * § 58.1-322.03(2)(b) gives the `$800` to "each blind or aged taxpayer as defined
 * under § 63(f)", and § 63(f)(1)(B) is the subparagraph that reaches this spouse.
 * Everywhere else this returns 0 even where {@link separateReturnSpouse} returns
 * 1, because a statute that made the spouse an exemption has not thereby made
 * them an AGED exemption, and Day 30 is about exactly that inference.
 */
function separateReturnSpouseAgedAndBlind(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): number {
  if (separateReturnSpouse(def, input) === 0) return 0;
  return def.exemption?.separateReturnSpouse.agedAndBlind === 'follows' ? 1 : 0;
}

/**
 * The same spouse again, for a MEANS-TESTED age addition — a third question, and
 * the one where the answers diverge inside a single state.
 *
 * Indiana's `$1,000`s at 65 and for blindness follow this spouse because they
 * are "each additional amount allowable under Section 63(f)". Its further `$500`
 * is a different sentence: § 63(f)(1) alone, its own AGI test, and Indiana's own
 * bulletin calls it the taxpayer's "or the taxpayer's spouse IF FILING A JOINT
 * RETURN". So a rule that read {@link separateReturnSpouseAgedAndBlind} for this
 * figure would be Day 30's defect exactly — the half that was waved at riding in
 * on the credibility of the half that was read.
 */
function separateReturnSpouseLowIncomeSenior(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): number {
  if (separateReturnSpouse(def, input) === 0) return 0;
  return def.exemption?.separateReturnSpouse.lowIncomeSenior === 'follows' ? 1 : 0;
}

function stateExemptions(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  /** Ohio's modified AGI; ignored by every other state. */
  modifiedAgi: number,
  /** The state's own AGI — Alabama's Form 40 line 10, which its dependent chart reads. */
  stateAgi: number,
): number {
  const rule = def.exemption;
  if (!rule) return 0;
  const cliff = rule.cliff?.[input.filingStatus];
  if (cliff !== undefined && input.federal.adjustedGrossIncome > cliff) return 0;
  const dependents = dependentCount(input);
  const spouse = separateReturnSpouse(def, input);
  const agedSpouse = separateReturnSpouseAgedAndBlind(def, input);
  // Maryland: every exemption on the return is worth the same stepped amount,
  // and the step is chosen by federal AGI. So the filer's exemption and the
  // dependents' are one figure times a count, not two figures — and the staircase
  // costs a family with six exemptions six times what it costs a single filer.
  //
  // Plus, in the four states that have said so in their own words, the § 151(b)
  // spouse: a person the FORM lets this return count who is not on it.
  const filers =
    (rule.filersClaimed?.[input.filingStatus] ?? claimedFilerCount(input.filingStatus)) + spouse;
  // Maryland reads the staircase against federal AGI; Ohio against its own
  // modified AGI, which is Ohio AGI with the business income deduction added
  // back. The two are the same figure only for a filer with no business income.
  const stepIncome =
    rule.stepsMeasuredOn === 'federalAdjustedGrossIncome' || rule.stepsMeasuredOn === undefined
      ? input.federal.adjustedGrossIncome
      : modifiedAgi;
  let total = rule.perExemptionSteps
    ? stepAmount(rule.perExemptionSteps[input.filingStatus], stepIncome) * (filers + dependents)
    : // The § 151(b) spouse is worth one separate filer's own exemption, which is
      // what the separate column of `perFiler` holds. `test/separate-return-
      // spouse.test.js` asserts for every `claimed` state that the JOINT figure
      // is exactly twice it, so this derivation is checked against the state's
      // own table rather than assumed from the shape of the word "spouse".
      rule.perFiler[input.filingStatus] +
      rule.perFiler.marriedFilingSeparately * spouse +
      // Alabama puts the filer on a flat amount and the dependents on a chart of
      // their own, read against ALABAMA AGI rather than federal AGI — which is
      // the difference between the two that a retiree feels: a defined benefit
      // pension is not in Alabama's AGI, so it does not move this chart.
      //
      // One chart serves all five filing statuses, so two single parents at
      // $50,000 each claim $1,000 a child and the same two people jointly on
      // $100,000 claim $500. The rate schedule doubles for a joint return; this
      // does not.
      (rule.perDependentSteps
        ? stepAmount(rule.perDependentSteps, stateAgi)
        : rule.perDependent) *
        dependents;

  // New Jersey's per-person additions. Each is claimed by a *filer*, never by a
  // dependent: New Jersey gives nothing extra for a blind or elderly dependent.
  const seniorAge = rule.seniorAge;
  if (rule.perSeniorFiler !== undefined && seniorAge !== undefined) {
    total += rule.perSeniorFiler * seniorFilers(input, seniorAge, agedSpouse);
  }
  if (rule.perBlindOrDisabledFiler !== undefined) {
    const claimed = nonNegative(input.blindOrDisabled, 'blindOrDisabled');
    // Capped by the number of LIVING people, not by the filer count. A
    // qualifying surviving spouse files alone, and a one-person return cannot
    // have two blind people on it — but a separate return in a state whose
    // aged and blind additions follow § 63(f) can have two, and that is the one
    // case where the cap is not the count of people the return covers.
    total +=
      rule.perBlindOrDisabledFiler *
      Math.min(claimed, livingFilerCount(input.filingStatus) + agedSpouse);
  }
  if (rule.perCollegeDependent !== undefined) {
    const college = nonNegative(input.dependentsAttendingCollege, 'dependentsAttendingCollege');
    total += rule.perCollegeDependent * Math.min(college, dependents);
  }
  // Indiana's second exemption for a dependent CHILD, on top of the $1,000 every
  // dependent gets. The age band is the whole of it: a nineteen-year-old who is
  // not a student and a grandparent are both dependents and neither is a child.
  if (rule.perQualifyingChild !== undefined) {
    total += rule.perQualifyingChild * qualifyingChildCount(rule, input);
  }
  // Indiana's means-tested age exemption, on top of the untested one. The test
  // is on FEDERAL AGI — the figure on the IT-40's first line, before Indiana's
  // own deductions and before these exemptions — so an Indiana subtraction that
  // takes a retiree under $40,000 does not buy this back.
  if (rule.perLowIncomeSeniorFiler !== undefined && seniorAge !== undefined) {
    const limit = rule.lowIncomeSeniorThreshold?.[input.filingStatus];
    if (limit !== undefined && input.federal.adjustedGrossIncome < limit) {
      // `lowIncomeSeniorSpouse`, NOT `agedSpouse`: the two questions have
      // different answers in the one state that has both.
      total +=
        rule.perLowIncomeSeniorFiler *
        seniorFilers(input, seniorAge, separateReturnSpouseLowIncomeSenior(def, input));
    }
  }
  // Maryland's second exemption for a dependent aged 65 or over — the dependent
  // parent case. It needs ages rather than a count, and it is not stepped by
  // income the way the base exemption is.
  if (rule.perSeniorDependent !== undefined && seniorAge !== undefined) {
    const aged = (input.dependentAges ?? []).filter((age) => age >= seniorAge).length;
    total += rule.perSeniorDependent * aged;
  }
  // Connecticut's Table A. Measured on CONNECTICUT adjusted gross income, which
  // is what `modifiedAgi` is here — Connecticut has no business income
  // deduction, so the two figures are the same number and the one that is
  // right is the state's. Reading the federal figure instead would hand a
  // retiree their Social Security subtraction and then withdraw their
  // exemption as though they had never had it.
  //
  // `ceil` rather than `floor` is the whole rule: § 12-702(a)(1) withdraws
  // $1,000 "for each one thousand dollars, OR FRACTION THEREOF", so the first
  // dollar over the threshold costs the whole first step.
  const step = rule.stepPhaseOut;
  if (step !== undefined) {
    const over = Math.max(0, modifiedAgi - step.start[input.filingStatus]);
    if (over > 0) {
      total = Math.max(0, total - step.reduction * Math.ceil(over / step.increment));
    }
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
  return qualifying >= 2 ? rule.amountBothSpouses : rule.amount[status];
}

/**
 * Ohio's retirement income credit — § 5747.055(B), a step function of the
 * retirement income on the return under a cliff on modified AGI less exemptions.
 */
/**
 * Retirement income on the return, from whichever field the caller used.
 *
 * `retirementIncome` is a single figure for the household; `retirement` is the
 * same income broken down per person, because three states subtract it per
 * person. A caller who supplies the *more* detailed of the two was, until
 * v0.18.0, treated as having supplied nothing at all by the rules that read the
 * scalar — so Ohio's retirement income credit came back zero for a retiree
 * whose pension the engine had been told about in full, and nothing in the
 * result said so. Found by the differential test in `tools/differential`.
 *
 * Social Security is excluded here on purpose: it has its own field and its own
 * treatment in every state, and Ohio deducts it before this credit is reached.
 */
function retirementIncomeOf(input: StateIncomeTaxInput): number {
  if (input.retirementIncome !== undefined) {
    return nonNegative(input.retirementIncome, 'retirementIncome');
  }
  const split = input.retirement;
  if (!split) return 0;
  // A spouse's half of the split is read only when there is a living spouse to
  // hold it. A qualifying surviving spouse files alone in the two years AFTER
  // the year of death — the year of death is a joint return — so a
  // `retirement.spouse` on such a return describes nobody, and reading it put
  // a dead person's pension on a living person's return.
  const people = livingFilerCount(input.filingStatus) === 2 ? [split.filer, split.spouse] : [split.filer];
  let total = 0;
  for (const person of people) {
    if (!person) continue;
    total +=
      nonNegative(person.employerPlanPension, 'retirement.employerPlanPension') +
      nonNegative(person.definedContributionPlan, 'retirement.definedContributionPlan') +
      nonNegative(person.iraDistributions, 'retirement.iraDistributions') +
      nonNegative(person.governmentPension, 'retirement.governmentPension') +
      nonNegative(person.militaryRetirement, 'retirement.militaryRetirement');
  }
  return total;
}

function retirementIncomeCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  measures: IncomeMeasures,
): number {
  const rule = def.retirementIncomeCredit;
  if (!rule) return 0;
  if (measures.stateModifiedAdjustedGrossIncomeLessExemptions >= rule.incomeLimit) return 0;
  return stepAmount(rule.steps, retirementIncomeOf(input));
}

/**
 * Oregon's ORS 316.157 retirement credit — the twelve-line worksheet on page
 * 108 of Publication OR-17, in the order the worksheet runs.
 *
 * The two reductions are the whole of it, and they read different definitions of
 * one benefit: line 6 takes the base down by the GROSS Social Security benefit,
 * and line 7's household income subtracts only the TAXABLE part from AGI. So a
 * dollar of benefit costs a dollar of base once, and is kept out of the income
 * that would cost it a second dollar.
 *
 * Because the base is `$7,500` on a single return and an ordinary benefit is
 * larger than that, the usual answer is zero — the credit survives only for a
 * retiree with little or no Social Security.
 */
function reducedBaseRetirementCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): number {
  const rule = def.reducedBaseRetirementCredit;
  if (!rule) return 0;
  const { people } = retirementPeople(input);
  // Line 1. The age test is on the PERSON and reaches only the filer and the
  // spouse — a dependent's pension on the same return does not qualify, which
  // `retirementPeople` already respects because it reads the filers.
  const pension = people.reduce(
    (sum, p) => sum + (p.age !== undefined && p.age >= rule.minimumAge ? p.pension : 0),
    0,
  );
  if (pension <= 0) return 0;
  // Line 6. The GROSS benefit, not the taxable part. On a return that supplies
  // only `taxableSocialSecurity` this figure is too SMALL, so the credit comes
  // out too LARGE — stated in the state's notes rather than silently netted,
  // because it is the one direction that flatters the filer.
  const reducedBase = Math.max(
    0,
    rule.base[input.filingStatus] - people.reduce((sum, p) => sum + p.benefits, 0),
  );
  // Lines 7 to 9. Household income is federal AGI plus tax-exempt interest less
  // the taxable benefit, so municipal interest reduces this credit in a state
  // that does not tax it.
  const householdIncome =
    nonNegative(input.federal.adjustedGrossIncome, 'federal.adjustedGrossIncome') +
    nonNegative(input.taxExemptInterest, 'taxExemptInterest') -
    nonNegative(input.taxableSocialSecurity, 'taxableSocialSecurity');
  const excess = Math.max(
    0,
    householdIncome - rule.householdIncomeThreshold[input.filingStatus],
  );
  // Lines 10 and 11.
  return rule.rate * Math.min(pension, Math.max(0, reducedBase - excess));
}

/** Military retired pay on the return, for each living person on it. */
function militaryRetirementPay(input: StateIncomeTaxInput): number {
  const split = input.retirement;
  if (!split) return 0;
  const filers = livingFilerCount(input.filingStatus);
  const filer = nonNegative(split.filer?.militaryRetirement, 'retirement.filer.militaryRetirement');
  const spouse =
    filers === 2
      ? nonNegative(split.spouse?.militaryRetirement, 'retirement.spouse.militaryRetirement')
      : 0;
  return filer + spouse;
}

/**
 * Utah's election between the Retirement Credit and the pair {Social Security
 * Benefits Credit, Military Retirement Credit} — Utah Code §§ 59-10-1019, 1042
 * and 1043.
 *
 * Returns the whole of the chosen side, named, so a result says which election
 * was made and not merely what it was worth. A filer who qualifies for nothing
 * gets the Social Security credit's name with a zero, because that is the side
 * the form defaults to.
 *
 * `modifiedAgi` is Utah's, not this package's `stateModifiedAdjustedGrossIncome`
 * — TC-40 line 6 (federal AGI plus Utah additions) **plus tax-exempt interest**,
 * and notably *before* Utah's own subtractions. Passing the state AGI instead
 * would let a caller's `subtractions` buy back a credit the statute withdraws.
 */
function exclusiveRetirementCredits(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  modifiedAgi: number,
): { name: string; amount: number } | undefined {
  const rule = def.exclusiveRetirementCredits;
  if (!rule) return undefined;
  // Both credits withdrawn here are defined as the state's own rate applied to a
  // class of income, by cross-reference rather than by a number of their own —
  // § 59-10-1043(2)(a) says "the percentage listed in Subsection 59-10-104(2)".
  // So the rate is read off the state's rate rule: a year that moves the rate
  // moves these credits, and there is no second copy to fall out of step.
  const rate = def.rate.kind === 'flat' ? def.rate.rate : 0;
  const status = input.filingStatus;
  // § 59-10-1019(2) gives `$450` to "the claimant" and `$450` to "the claimant's
  // spouse", and a qualifying surviving spouse has no spouse for the statute to
  // be talking about. Living people only.
  const filers = livingFilerCount(status);

  // Code 18. The birth-year test is on the calendar year of birth, so it turns
  // over on 1 January rather than on a birthday.
  const qualifyingAge = def.year - rule.retirement.bornOnOrBefore;
  let heads = 0;
  if (input.filerAge !== undefined && input.filerAge >= qualifyingAge) heads += 1;
  if (filers === 2 && input.spouseAge !== undefined && input.spouseAge >= qualifyingAge) heads += 1;
  const retirementExcess = Math.max(0, modifiedAgi - rule.retirement.phaseOutThreshold[status]);
  const retirementCredit = Math.max(
    0,
    rule.retirement.perPerson * heads - rule.retirement.phaseOutRate * retirementExcess,
  );

  // Code AH. The base is the part of the benefit § 86 put into federal AGI, not
  // the benefit received — so a retiree whose benefit is wholly untaxed federally
  // has no credit to claim and needs none.
  const taxedBenefit = nonNegative(input.taxableSocialSecurity, 'taxableSocialSecurity') * rate;
  const ssExcess = Math.max(0, modifiedAgi - rule.socialSecurity.phaseOutThreshold[status]);
  const socialSecurityCredit = Math.max(
    0,
    taxedBenefit - rule.socialSecurity.phaseOutRate * ssExcess,
  );

  // Code AJ. No phase-out at all: the only one of the three a high-income Utah
  // retiree can still claim.
  const militaryCredit = militaryRetirementPay(input) * rate;

  const pair = socialSecurityCredit + militaryCredit;
  if (retirementCredit > pair) {
    return { name: rule.retirement.name, amount: retirementCredit };
  }
  if (militaryCredit > 0 && socialSecurityCredit > 0) {
    return { name: `${rule.socialSecurity.name} and ${rule.militaryRetirement.name}`, amount: pair };
  }
  if (militaryCredit > 0) return { name: rule.militaryRetirement.name, amount: militaryCredit };
  return { name: rule.socialSecurity.name, amount: socialSecurityCredit };
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
/**
 * The number of qualifying children a state credit counts.
 *
 * `dependents`, which is the only count this package is ever given. It is not
 * the same question as § 32's — a dependent parent is a dependent and not a
 * qualifying child — and the difference is a whole band of Wisconsin's match,
 * so the state's notes say what the count is and what it is not.
 */
function qualifyingChildrenOf(input: StateIncomeTaxInput): number {
  return Math.max(0, Math.trunc(input.dependents ?? 0));
}

function unmarriedChildless(input: StateIncomeTaxInput): boolean {
  const status = input.filingStatus;
  const unmarried =
    status === 'single' || status === 'headOfHousehold' || status === 'qualifyingSurvivingSpouse';
  return unmarried && dependentCount(input) === 0;
}

/** How many of the filer and spouse are at or above an age. */
function seniorFilers(
  input: StateIncomeTaxInput,
  age: number,
  /**
   * The § 151(b) spouse, where the caller is an exemption rule whose state has
   * said its aged addition follows them. Defaults to 0, so every OTHER senior
   * rule in this package — Maryland's § 10-754 credit, Indiana's unified credit
   * for the elderly, Ohio's — is untouched by this question and has to be asked
   * it separately, which is the whole of Day 30's lesson.
   */
  separateSpouse = 0,
): number {
  // `livingFilerCount`, so a `spouseAge` supplied on a surviving spouse's
  // return is ignored rather than counted. The spouse is dead; an age for them
  // is a caller error, and reading it bought a second senior exemption.
  const filers = livingFilerCount(input.filingStatus) + separateSpouse;
  let count = 0;
  if (input.filerAge !== undefined && input.filerAge >= age) count += 1;
  if (filers === 2 && input.spouseAge !== undefined && input.spouseAge >= age) count += 1;
  return count;
}

/**
 * Virginia's age deduction, Va. Code § 58.1-322.03(5).
 *
 * Two deductions with one name. Subdivision (a) gives filers born before the
 * statute's frozen date the whole amount with **no income test at all**;
 * subdivision (b) gives everyone else the same amount and takes it back at a
 * dollar a dollar. Only the second is reduced, which is why the two counts are
 * kept apart here rather than multiplied together and tested once.
 *
 * The income the test reads is *adjusted* federal AGI — federal AGI less the
 * taxable Social Security and Tier 1 railroad benefits inside it — and not the
 * Virginia AGI the deduction comes off. Two different figures, one line apart.
 *
 * And on a SEPARATE return it reads a THIRD figure: the combined adjusted federal
 * AGI of both spouses, per § 58.1-322.03(5)(b). See
 * {@link AgeDeductionSeparateReturnRule} — the `separate` column of
 * {@link AgeDeductionRule.threshold} is the joint `$75,000` because the test is
 * the joint test, not because a separate filer is treated generously, and this
 * package read it the generous way until v0.29.0.
 */
function ageDeduction(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  taxableSocialSecurity: number,
): { readonly amount: number; readonly refusedForMissingSpouseIncome: boolean } {
  const rule = def.ageDeduction;
  if (!rule) return { amount: 0, refusedForMissingSpouseIncome: false };
  // Living people, because this is an age. Virginia sends a federal qualifying
  // surviving spouse to Filing Status 1, SINGLE — the same instruction that
  // already set this status's standard deduction, personal exemption and
  // threshold in `virginia.ts` — and a single return has one age on it.
  const filers = livingFilerCount(input.filingStatus);
  let untested = 0;
  let tested = 0;
  const consider = (age: number | undefined): void => {
    if (age === undefined || age < rule.minimumAge) return;
    // Birth year from the tax year, which is how Virginia's own worksheet asks
    // the question. It puts a filer born on 1 January 1939 — whom the statute
    // gives the untested amount — into the tested group, and understates that
    // one day of births by the whole deduction.
    if (def.year - age < rule.fullAmountIfBornBefore) untested += 1;
    else tested += 1;
  };
  consider(input.filerAge);
  if (filers === 2) consider(input.spouseAge);
  if (untested === 0 && tested === 0) return { amount: 0, refusedForMissingSpouseIncome: false };
  const adjustedFederalAgi = Math.max(0, input.federal.adjustedGrossIncome - taxableSocialSecurity);
  const separate = input.filingStatus === 'marriedFilingSeparately';
  const combined = separate && rule.separateReturn.incomeMeasure === 'combinedWithSpouse';
  const spouseIncome = input.spouseAdjustedFederalAdjustedGrossIncome;
  // The untested amount survives a missing spouse figure because it has no
  // income test to fail. Only the tested half is refused, and refusing exactly
  // the half that needs the number is the difference between a gap and a guess.
  const untestedAmount = rule.amount * untested;
  if (combined && tested > 0 && spouseIncome === undefined) {
    return { amount: untestedAmount, refusedForMissingSpouseIncome: true };
  }
  const testedIncome =
    combined ? adjustedFederalAgi + nonNegative(spouseIncome, 'spouseAdjustedFederalAdjustedGrossIncome')
    : adjustedFederalAgi;
  const excess = Math.max(0, testedIncome - rule.threshold[input.filingStatus]);
  // Both spouses claiming an income-tested amount on their own separate returns:
  // the worksheet computes the JOINT deduction — two maxima against the one
  // combined excess — and allocates half to each return. `(2a − e) / 2` is
  // `a − e / 2`, so the shared excess costs this filer half of what their own
  // amount tested alone would cost, which is why it takes an explicit input.
  const sharing =
    combined &&
    tested > 0 &&
    rule.separateReturn.bothClaiming === 'halfOfJointDeduction' &&
    input.spouseClaimsAgeDeduction === true &&
    spouseIsIncomeTested(rule, def.year, input);
  const testedMaximum = rule.amount * (sharing ? tested + 1 : tested);
  const incomeTested =
    Math.max(0, testedMaximum - excess * rule.reductionRate) / (sharing ? 2 : 1);
  return { amount: untestedAmount + incomeTested, refusedForMissingSpouseIncome: false };
}

/**
 * Whether this return's age deduction is waiting on the other return's income —
 * the one condition that turns a computed subtraction into a refused one.
 *
 * Kept as its own predicate so the note and the computation cannot disagree
 * about when the figure is load-bearing. A note that fires where the engine
 * computed anyway is noise; a computation that refuses where no note fires is
 * the silent answer this package exists not to give.
 */
function ageDeductionNeedsSpouseIncome(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): boolean {
  const rule = def.ageDeduction;
  if (!rule) return false;
  if (input.filingStatus !== 'marriedFilingSeparately') return false;
  if (rule.separateReturn.incomeMeasure !== 'combinedWithSpouse') return false;
  if (input.spouseAdjustedFederalAdjustedGrossIncome !== undefined) return false;
  const age = input.filerAge;
  if (age === undefined || age < rule.minimumAge) return false;
  // Only the income-TESTED cohort. Virginia's pre-1939 filer takes the whole
  // amount with no test, so the spouse's income decides nothing for them.
  return def.year - age >= rule.fullAmountIfBornBefore;
}

/**
 * Whether the spouse of a separate filer is in the state's INCOME-TESTED age
 * group — old enough for the deduction and born too late for the untested
 * amount.
 *
 * The worksheet's half-allocation is conditioned on both spouses claiming an
 * *income-based* deduction, so a spouse in Virginia's pre-1939 cohort does not
 * trigger it: their `$12,000` is not tested and there is no shared excess for
 * the two to divide.
 */
function spouseIsIncomeTested(
  rule: AgeDeductionRule,
  year: number,
  input: StateIncomeTaxInput,
): boolean {
  const age = input.spouseAge;
  if (age === undefined || age < rule.minimumAge) return false;
  return year - age >= rule.fullAmountIfBornBefore;
}

/**
 * Virginia's spouse tax adjustment, Form 760 line 17.
 *
 * The worksheet is eight lines and one idea: charge the couple as though the
 * return had been split in two, and hand back the difference. Lines 8 and 9 pin
 * each half at no less than the midpoint, which is the same as saying the split
 * is taken at the midpoint when the smaller spouse is above it — so the value is
 * maximised by an even split and falls away as the second earner shrinks.
 *
 * Its maximum is a constant: the tax on the first `$17,000` at the flat top rate
 * less the tax on it at the graduated rates, which is `$257.50`. `cap` is the
 * `$259` the Commonwealth publishes and it is never reached.
 */
function spouseTaxAdjustment(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  taxableIncome: number,
  grossTax: number,
): { readonly amount: number; readonly assumedEvenSplit: boolean } {
  const rule = def.spouseTaxAdjustment;
  const none = { amount: 0, assumedEvenSplit: false };
  if (!rule || def.rate.kind !== 'brackets') return none;
  if (input.filingStatus !== 'marriedFilingJointly') return none;
  // Both spouses must have had income of their own. Same question Ohio's joint
  // filing credit asks, and the same answer when it is not asked: nothing.
  if (input.bothSpousesHaveQualifyingIncome !== true) return none;
  const brackets = def.rate.byStatus[input.filingStatus];
  const half = taxableIncome / rule.divisor;
  const supplied = input.lesserSpouseIncome;
  const assumedEvenSplit = supplied === undefined;
  const smaller = assumedEvenSplit
    ? half
    : Math.max(0, nonNegative(supplied, 'lesserSpouseIncome'));
  const tax = (amount: number): number => applyBrackets(Math.max(0, amount), brackets).tax;
  const lower = Math.min(tax(smaller), tax(half));
  const upper = Math.max(tax(taxableIncome - smaller), tax(half));
  return {
    amount: Math.min(Math.max(0, grossTax - (lower + upper)), rule.cap),
    assumedEvenSplit,
  };
}

/**
 * The federal poverty guideline Virginia's low income credit and Maryland's
 * poverty level credit are both a cliff at.
 *
 * The caller's own figure wins when they have one. The stored fallback is a
 * stated year's HHS guideline, and a guideline is republished every January for
 * a year that has already begun, so a package that only ever carries its own
 * copy is wrong about January by construction.
 */
function povertyGuideline(
  rule:
    | { readonly povertyGuideline: { readonly firstPerson: number; readonly additionalPerson: number } }
    | undefined,
  input: StateIncomeTaxInput,
): number {
  if (!rule) return 0;
  if (input.federalPovertyGuideline !== undefined) {
    return nonNegative(input.federalPovertyGuideline, 'federalPovertyGuideline');
  }
  // A household size is a number of PEOPLE and nothing else. Md. Code, Tax-Gen.
  // § 10-709(a)(3) makes the unit "an individual, OR an individual and the
  // individual's spouse IF THEY FILE A JOINT INCOME TAX RETURN" — a qualifying
  // surviving spouse does not, and the HHS guideline it is measured against is
  // published per person in the family.
  //
  // This one runs the wrong way twice over: a guideline one person too large
  // both admits filers whose income is above the real cliff and raises the
  // earned-income ceiling § 10-709(a)(3)(ii) tests them against.
  const size = livingFilerCount(input.filingStatus) + dependentCount(input);
  return (
    rule.povertyGuideline.firstPerson + rule.povertyGuideline.additionalPerson * (size - 1)
  );
}

/**
 * Whether a filer is an "eligible low income taxpayer" — Md. Code, Tax-Gen.
 * § 10-709(a)(3).
 *
 * Two income tests, on two different figures, against the same guideline. The
 * first is federal AGI **as modified by §§ 10-204 to 10-206**, which is the
 * additions and not the subtractions: a Maryland pension exclusion does not buy
 * a retiree into this credit. The second is earned income under § 32(c)(2),
 * which is the figure the credit is then a percentage of. A filer with a small
 * wage and a large pension fails the first test and passes the second.
 *
 * The third test, § 10-709(a)(3)(iv), is that the earned income credit is less
 * than the tax — a filer whose earned income credit already covers the bill has
 * nothing left for this to forgive.
 */
function povertyLevelCreditEligible(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  modifiedFederalAgi: number,
  earnedIncomeCreditTaken: number,
  taxBeforeCredits: number,
): boolean {
  const rule = def.povertyLevelCredit;
  if (!rule) return false;
  const limit = povertyGuideline(rule, input);
  const earned = nonNegative(input.earnedIncome, 'earnedIncome');
  if (modifiedFederalAgi > limit) return false;
  if (earned > limit) return false;
  return earnedIncomeCreditTaken < taxBeforeCredits;
}

/**
 * Virginia's Credit for Low Income Individuals, Va. Code § 58.1-339.8(B)(1).
 *
 * `$300` an exemption, and unavailable to a filer who claimed any of four other
 * Virginia benefits — § 58.1-339.8(D). Two of the four are visible from this
 * package's inputs and are enforced; the other two are subtractions a caller
 * nets themselves, and the state's notes say so.
 */
function lowIncomeCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  stateAgi: number,
  ageDeductionTaken: number,
): number {
  const rule = def.lowIncomeCredit;
  if (!rule) return 0;
  if (ageDeductionTaken > 0) return 0;
  if (def.exemption?.perSeniorFiler !== undefined || def.exemption?.perBlindOrDisabledFiler) {
    const seniors = def.exemption.seniorAge !== undefined
      ? seniorFilers(input, def.exemption.seniorAge)
      : 0;
    const blind = input.blindOrDisabled ?? 0;
    if (seniors > 0 || blind > 0) return 0;
  }
  if (stateAgi > povertyGuideline(def.lowIncomeCredit, input)) return 0;
  // "$300 for each personal exemption" — and Virginia's own personal exemption,
  // three hundred lines up in `virginia.ts`, gives this status ONE. The credit
  // and the exemption it is defined against are the same fact counted twice,
  // and they disagreed by $300 a return.
  return rule.perExemption * (livingFilerCount(input.filingStatus) + dependentCount(input));
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
 * One person's share of the retirement income on the return, and their age.
 *
 * `present` distinguishes "this person has no retirement income" from "this
 * person does not exist", because a single filer's spouse must not be given a
 * `$41,200` exclusion of their own.
 */
interface RetirementPerson {
  readonly age: number | undefined;
  /**
   * Employer plan pension, defined benefit and defined contribution POOLED —
   * which is what every state here but Alabama asks for.
   */
  readonly pension: number;
  /** The defined BENEFIT half of {@link pension}. Alabama exempts it in full. */
  readonly definedBenefit: number;
  /** The defined CONTRIBUTION half of {@link pension}. Alabama caps it. */
  readonly definedContribution: number;
  readonly benefits: number;
  readonly military: number;
  readonly ira: number;
  readonly investment: number;
  readonly earned: number;
  readonly disabled: boolean;
  /** Kentucky Schedule P Part I: federal, Commonwealth or local retired pay. */
  readonly governmentPension: number;
  readonly monthsBefore1998: number;
  readonly monthsAfter1997: number;
}

/**
 * The two people on the return, with the retirement income each of them
 * received.
 *
 * When the caller supplies {@link StateIncomeTaxInput.retirement} this is a
 * transcription. When they do not, everything is placed on the first filer,
 * which is deliberate: of the ways a household total can be split, that is the
 * one that produces the *smallest* Maryland pension exclusion, so the assumption
 * errs towards too much tax rather than too little. The subtraction's name says
 * which case was used.
 */
function retirementPeople(
  input: StateIncomeTaxInput,
): { readonly people: readonly RetirementPerson[]; readonly assumed: boolean } {
  // A per-person exclusion needs a person. Every state that caps one does it on
  // the pension holder's own age, and a qualifying surviving spouse's return
  // has one holder on it — so this is a count of the living, not of the column
  // the state put the status in.
  const filers = livingFilerCount(input.filingStatus);
  const split = input.retirement;
  const read = (
    part: { readonly age: number | undefined; readonly from: NonNullable<StateIncomeTaxInput['retirement']>['filer'] },
  ): RetirementPerson => ({
    age: part.age,
    pension:
      nonNegative(part.from?.employerPlanPension, 'retirement.employerPlanPension') +
      nonNegative(part.from?.definedContributionPlan, 'retirement.definedContributionPlan'),
    definedBenefit: nonNegative(part.from?.employerPlanPension, 'retirement.employerPlanPension'),
    definedContribution: nonNegative(
      part.from?.definedContributionPlan,
      'retirement.definedContributionPlan',
    ),
    benefits: nonNegative(part.from?.socialSecurityBenefits, 'retirement.socialSecurityBenefits'),
    military: nonNegative(part.from?.militaryRetirement, 'retirement.militaryRetirement'),
    ira: nonNegative(part.from?.iraDistributions, 'retirement.iraDistributions'),
    // Net of losses by the time it reaches here, and a loss is not a negative
    // exclusion: Georgia's worksheet floors the non-earned sources at zero as a
    // block before adding the earned part, so a rental loss cannot eat into the
    // $5,000 of wages that also qualify.
    investment: Math.max(0, part.from?.investmentIncome ?? 0),
    earned: nonNegative(part.from?.earnedIncome, 'retirement.earnedIncome'),
    disabled: part.from?.totallyDisabled === true,
    governmentPension: nonNegative(part.from?.governmentPension, 'retirement.governmentPension'),
    monthsBefore1998: nonNegative(
      part.from?.serviceMonthsBefore1998,
      'retirement.serviceMonthsBefore1998',
    ),
    monthsAfter1997: nonNegative(
      part.from?.serviceMonthsAfter1997,
      'retirement.serviceMonthsAfter1997',
    ),
  });
  if (split !== undefined) {
    const people = [read({ age: input.filerAge, from: split.filer })];
    if (filers === 2) people.push(read({ age: input.spouseAge, from: split.spouse }));
    return { people, assumed: false };
  }
  // The fallback. `retirementIncome` is the field New Jersey and Ohio already
  // ask for, and `taxableSocialSecurity` is the taxable part rather than the
  // total received — so the offset it produces is too small and the exclusion
  // too large, in the opposite direction from concentrating the income on one
  // spouse. Both are stated rather than silently netted.
  const sole: RetirementPerson = {
    age: input.filerAge,
    pension: nonNegative(input.retirementIncome, 'retirementIncome'),
    // `retirementIncome` is a household total that says nothing about the plan
    // it came from, so Alabama's rule reads NEITHER half of it and the return
    // says so in `notes`. Guessing would be guessing in units of $2,760 a year.
    definedBenefit: 0,
    definedContribution: 0,
    benefits: nonNegative(input.taxableSocialSecurity, 'taxableSocialSecurity'),
    military: 0,
    ira: 0,
    investment: 0,
    earned: 0,
    disabled: false,
    governmentPension: 0,
    monthsBefore1998: 0,
    monthsAfter1997: 0,
  };
  const people: RetirementPerson[] = [sole];
  if (filers === 2) {
    people.push({
      age: input.spouseAge,
      pension: 0,
      definedBenefit: 0,
      definedContribution: 0,
      benefits: 0,
      military: 0,
      ira: 0,
      investment: 0,
      earned: 0,
      disabled: false,
      governmentPension: 0,
      monthsBefore1998: 0,
      monthsAfter1997: 0,
    });
  }
  return { people, assumed: sole.pension > 0 };
}

/**
 * Every per-person retirement subtraction in the package — Maryland's three (the
 * pension exclusion of § 10-209(b), the military retirement subtraction of
 * § 10-207(q) and the centenarian subtraction of § 10-207(nn)), Georgia's two,
 * and Kentucky's Schedule P exclusion.
 *
 * They are computed together because they are all keyed to a person rather than
 * a return, and because they disagree about *which* person qualifies — which is
 * the most transferable thing here. Maryland asks 65, or totally disabled, or
 * married to someone who is; Georgia asks 62, then 65; Maryland's military
 * subtraction asks nothing at all; the centenarian subtraction asks 100; and
 * **Kentucky asks no question about the person and one about their employment
 * thirty years ago.** One Maryland couple can be inside three of these at once.
 */
function retirementSubtractions(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): { readonly total: number; readonly details: readonly { name: string; amount: number }[] } {
  const none = { total: 0, details: [] as { name: string; amount: number }[] };
  const pension = def.pensionExclusion;
  const military = def.militaryRetirementSubtraction;
  const aged = def.agedIncomeSubtraction;
  const characterExclusion = def.retirementIncomeExclusion;
  const militaryExclusion = def.militaryRetirementExclusion;
  const kentucky = def.pensionIncomeExclusion;
  const bySource = def.retirementIncomeSubtractions;
  if (
    !pension &&
    !military &&
    !aged &&
    !characterExclusion &&
    !militaryExclusion &&
    !kentucky &&
    !bySource
  ) {
    return none;
  }
  const { people, assumed } = retirementPeople(input);
  const anyDisabled = people.some((p) => p.disabled);
  const details: { name: string; amount: number }[] = [];

  if (pension) {
    let excluded = 0;
    for (const person of people) {
      // § 10-209(b): 65 or over, or totally disabled, or married to someone who
      // is. The spouse's disability qualifies a person of any age, which is why
      // `anyDisabled` is computed across the return rather than per person.
      const qualified =
        (person.age !== undefined && person.age >= pension.minimumAge) ||
        (pension.disabilityQualifies && anyDisabled);
      if (!qualified) continue;
      excluded += Math.min(person.pension, Math.max(0, pension.maximum - person.benefits));
    }
    if (excluded > 0) {
      details.push({
        name: assumed
          ? `${pension.name} (assumed: all of it received by one spouse, and the taxable part of the benefits taken as the total received — pass \`retirement\` for the exact figure)`
          : pension.name,
        amount: excluded,
      });
    }
  }

  if (military) {
    let subtracted = 0;
    for (const person of people) {
      if (person.military <= 0) continue;
      const cap =
        person.age !== undefined && person.age >= military.ageThreshold
          ? military.capAtOrAboveAge
          : military.capUnderAge;
      subtracted += Math.min(person.military, cap);
    }
    if (subtracted > 0) details.push({ name: military.name, amount: subtracted });
  }

  // Georgia's two exclusions, in the order the IT-511 Schedule 1 worksheets are
  // numbered: the military one first, because whatever it leaves behind is
  // ordinary taxable pension income for the other. Computing them the other way
  // round would let the same dollar out twice for the one filer who can claim
  // both — a disabled veteran under 62.
  const militaryExcludedBy = new Map<RetirementPerson, number>();
  if (militaryExclusion) {
    let subtracted = 0;
    for (const person of people) {
      if (person.military <= 0) continue;
      // Strictly below the age, and an unknown age does not qualify: a "below
      // N" test read as satisfied by a missing figure is the one direction in
      // which a guess costs the filer an audit rather than money.
      if (person.age === undefined || person.age >= militaryExclusion.maximumAge) continue;
      const cap =
        militaryExclusion.base +
        (person.earned > militaryExclusion.additionalEarnedIncomeThreshold
          ? militaryExclusion.additional
          : 0);
      const taken = Math.min(person.military, cap);
      militaryExcludedBy.set(person, taken);
      subtracted += taken;
    }
    if (subtracted > 0) details.push({ name: militaryExclusion.name, amount: subtracted });
  }

  if (characterExclusion) {
    let excluded = 0;
    for (const person of people) {
      const qualified =
        (person.age !== undefined && person.age >= characterExclusion.minimumAge) ||
        (characterExclusion.disabilityQualifies && person.disabled);
      if (!qualified) continue;
      const cap =
        person.age !== undefined && person.age >= characterExclusion.olderAge
          ? characterExclusion.capAtOlderAge
          : characterExclusion.capUnderOlderAge;
      // Military retired pay is taxable pension income like any other once the
      // exclusion written for it has been used — which matters most at the age
      // where that exclusion no longer exists. PolicyEngine-US keeps military
      // pay out of Georgia's pool entirely, which leaves a 65-year-old military
      // retiree with no exclusion on a pension the state plainly exempts.
      const remainingMilitary = person.military - (militaryExcludedBy.get(person) ?? 0);
      const qualifying =
        Math.min(person.earned, characterExclusion.earnedIncomeCap) +
        person.pension +
        person.ira +
        person.investment +
        remainingMilitary;
      excluded += Math.min(qualifying, cap);
    }
    if (excluded > 0) {
      details.push({
        name: assumed
          ? `${characterExclusion.name} (assumed: all of it received by one spouse — pass \`retirement\` for the exact figure)`
          : characterExclusion.name,
        amount: excluded,
      });
    }
  }

  if (kentucky) {
    let excluded = 0;
    for (const person of people) {
      // Schedule P Part I. The ratio is months of service credit, not a date,
      // so it is computed even for a person who retired long after the cutoff —
      // and a person with no post-1997 months at all is 100% exempt, which is
      // what line 1(a) does for anyone who retired before 1 January 1998.
      const months = person.monthsBefore1998 + person.monthsAfter1997;
      const exemptShare = months > 0 ? person.monthsBefore1998 / months : 0;
      const exempt = person.governmentPension * exemptShare;
      // Part II. Everything else — including the part of the government pension
      // the ratio did not reach — against the cap. The exempt amount is NOT
      // charged against it: Kentucky adds the two, which is what makes this
      // exclusion unbounded above for the pre-1998 cohort.
      const capped = Math.min(
        kentucky.cap,
        person.pension +
          person.ira +
          person.military +
          (person.governmentPension - exempt),
      );
      excluded += exempt + Math.max(0, capped);
    }
    if (excluded > 0) {
      details.push({
        name: assumed
          ? `${kentucky.name} (assumed: all of it received by one spouse, and none of it exempt government service — pass \`retirement\` for the exact figure)`
          : kentucky.name,
        amount: excluded,
      });
    }
  }

  if (bySource) {
    const subtracted = retirementIncomeBySource(bySource, input, people);
    if (subtracted) {
      details.push({
        name:
          assumed && subtracted.allocationMatters
            ? `${subtracted.name} (assumed: all of it received by one spouse, and none of it government service — pass \`retirement\` for the exact figure)`
            : subtracted.name,
        amount: subtracted.amount,
      });
    }
  }

  if (aged) {
    // Limited by the claimant's own income, which a return-level computation
    // cannot see. `stateAgi` is clamped at zero downstream, so the only case
    // this overstates is two centenarians on one return with less than
    // `$200,000` between them — and it is recorded in the state's notes.
    const claimants = people.filter((p) => p.age !== undefined && p.age >= aged.minimumAge).length;
    if (claimants > 0) details.push({ name: aged.name, amount: aged.maximum * claimants });
  }

  return { total: details.reduce((sum, d) => sum + d.amount, 0), details };
}

/**
 * Illinois, Mississippi, Michigan and New York — the states whose answer to "do
 * you tax my pension?" is no, or nearly.
 *
 * The four of them were the whole of the `CALLER-SUPPLIED` class in the
 * differential report: this package documented that each needed its exclusion
 * passed in through `subtractions`, accepted a `retirement` split it had
 * everything it needed in, and taxed the pension anyway. A caller who did
 * exactly what the notes said got the right answer; every caller who did not —
 * including this project's own calculator — got a retiree's tax that was too
 * high, in four states at once, silently.
 *
 * The rules are ordered most generous first and **at most one applies**, which
 * is Michigan's structure rather than a convenience: a taxpayer born before 1946
 * takes the tier one deduction of MCL 206.30(1)(f) *or* the phased-in one of
 * § 206.30(9), never both.
 */
function retirementIncomeBySource(
  rules: readonly RetirementIncomeSubtractionRule[],
  input: StateIncomeTaxInput,
  people: readonly RetirementPerson[],
):
  | { readonly name: string; readonly amount: number; readonly allocationMatters: boolean }
  | undefined {
  const qualifies = (rule: RetirementIncomeSubtractionRule, age: number | undefined): boolean => {
    if (rule.minimumAge !== undefined && !(age !== undefined && age >= rule.minimumAge)) {
      return false;
    }
    if (rule.maximumAge !== undefined && !(age !== undefined && age < rule.maximumAge)) {
      return false;
    }
    return true;
  };

  /**
   * One person's retirement income, split into the part that leaves the return
   * whatever the cap says and the part that has to queue for it.
   *
   * Two flags decide where military retired pay lands, and the difference is
   * where each state put its military retirees. New York exempts federal
   * service in full and leaves the `$20,000` intact for everything else;
   * Michigan exempts the same pay and charges it against the shared cap, so a
   * second pension behind a military one is worth less than the same pension on
   * its own.
   */
  const split = (
    rule: RetirementIncomeSubtractionRule,
    person: RetirementPerson,
  ): { readonly exempt: number; readonly chargedFirst: number; readonly pool: number } => {
    const governmentExempt = rule.governmentPensionExemptInFull === true;
    const militaryExempt = governmentExempt || rule.militaryReducesCap === true;
    // New York's $20,000 opens at 59½ and its exemption of a government pension
    // does not, so the age test belongs to the pool and not to the rule.
    const oldEnough =
      rule.cappedMinimumAge === undefined ||
      (person.age !== undefined && person.age >= rule.cappedMinimumAge);
    return {
      exempt:
        (governmentExempt ? person.governmentPension : 0) + (militaryExempt ? person.military : 0),
      // Exempt in full AND deducted from the cap — Michigan's Form 4884 line 3,
      // which New York's construction does not do.
      chargedFirst: rule.militaryReducesCap === true ? person.military : 0,
      pool: oldEnough
        ? person.pension +
          person.ira +
          (governmentExempt ? 0 : person.governmentPension) +
          (militaryExempt ? 0 : person.military)
        : 0,
    };
  };

  const capOf = (rule: RetirementIncomeSubtractionRule): number =>
    rule.cap === undefined
      ? Infinity
      : typeof rule.cap === 'number'
        ? rule.cap
        : rule.cap[input.filingStatus];

  /**
   * One cap, shared by everything that has a claim on it — and the order is
   * Michigan's Worksheet 3.3, where line 3 takes military pay off the cap and
   * line 4 applies the phase-in percentage to what is left. Scaling first and
   * subtracting after gives a military retiree a larger deduction than the form
   * does, and only for them, which is exactly the kind of error a grid of
   * households without a veteran in it never finds.
   */
  const against = (
    rule: RetirementIncomeSubtractionRule,
    parts: readonly { readonly exempt: number; readonly chargedFirst: number; readonly pool: number }[],
  ): number => {
    const exempt = parts.reduce((sum, p) => sum + p.exempt, 0);
    const charged = parts.reduce((sum, p) => sum + p.chargedFirst, 0);
    const pool = parts.reduce((sum, p) => sum + p.pool, 0);
    const room = Math.max(0, capOf(rule) - charged) * (rule.capMultiplier ?? 1);
    return exempt + Math.min(pool, room);
  };

  for (const rule of rules) {
    let amount = 0;
    if (rule.scope === 'return') {
      // Michigan keys the whole return to the older spouse — Form 4884 asks for
      // one birth year and one only — so a 66-year-old married to a 58-year-old
      // qualifies both of their pensions, and they share one cap.
      const ages = people.map((p) => p.age).filter((a): a is number => a !== undefined);
      if (!qualifies(rule, ages.length > 0 ? Math.max(...ages) : undefined)) continue;
      amount = against(
        rule,
        people.map((person) => split(rule, person)),
      );
    } else {
      // Per person, with a cap each and no transfer between them: unused room is
      // lost. That is why the same `$40,000` of New York pension is excluded in
      // full when a couple split it and half taxed when one of them holds it.
      for (const person of people) {
        if (!qualifies(rule, person.age)) continue;
        amount += against(rule, [split(rule, person)]);
      }
    }
    if (amount <= 0) continue;
    return {
      name: rule.name,
      amount,
      // A capped or source-sensitive rule gives two different answers for the
      // same household total depending on who received what, so a caller who
      // supplied a total rather than a split is told which assumption was used.
      allocationMatters: rule.cap !== undefined || rule.governmentPensionExemptInFull === true,
    };
  }
  return undefined;
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
  // California claims an additional personal exemption for each filer at 65 and
  // another for each who is blind, and the two stack on one person: § 17054(c)
  // and (d) are separate subdivisions with separate boxes on Form 540. A single
  // blind filer of 65 therefore claims THREE personal exemptions.
  const seniors = rule.perSeniorFiler !== undefined ? seniorFilers(input, rule.seniorAge ?? 65) : 0;
  const blind =
    rule.perBlindOrDisabledFiler !== undefined
      ? Math.min(nonNegative(input.blindOrDisabled, 'blindOrDisabled'), livingFilerCount(status))
      : 0;
  // Ohio's is switched off rather than tapered: § 5747.022 allows the $20 only
  // below $30,000 of modified AGI, so a family of four loses $80 on one dollar.
  //
  // Oregon's ORS 316.085(5) is the same cliff with the boundary the other way
  // round — the credit goes to a filer whose federal AGI "does not exceed"
  // $100,000 or $200,000 — so the filer standing exactly on the figure keeps it
  // there and loses it in Ohio. One word of statute, $1,024 to an Oregon family
  // of four at exactly $200,000.
  const limit = rule.incomeLimitByStatus?.[status] ?? rule.incomeLimit;
  if (limit !== undefined) {
    const income = measured(measures, rule.incomeMeasure);
    if (rule.incomeLimitIsInclusive === true ? income > limit : income >= limit) return 0;
  }
  // The § 151(b) spouse, for a CREDIT rather than an exemption. Oregon's
  // instructions let a separate filer whose spouse has no income and is nobody
  // else's dependent check the spouse's Regular exemption box, which is a second
  // $263 — and this package was missing it until the differential grid put a
  // separate Oregon return beside PolicyEngine's and found them $251.91 apart.
  //
  // Not defaulted on: Ohio and California have the same field absent, because
  // neither has been read on the question and a default would answer it for them.
  const separateSpouse =
    status === 'marriedFilingSeparately' &&
    rule.separateReturnSpouse?.spouse === 'claimed' &&
    input.spouseHasNoGrossIncomeAndIsNotADependent === true
      ? 1
      : 0;
  // One call, read once: `perFiler` is the TOTAL the form tells this status to
  // enter, so the per-person figure is that total divided by the same count the
  // form claims — and the separate-return spouse is added to the COUNT without
  // changing the divisor.
  const claimed = claimedFilerCount(status);
  const lines: readonly (readonly [number, number])[] = [
    [claimed + separateSpouse, rule.perFiler[status] / claimed],
    [seniors, rule.perSeniorFiler ?? 0],
    [blind, rule.perBlindOrDisabledFiler ?? 0],
    [dependents, rule.perDependent],
  ];
  const full = lines.reduce((sum, [count, each]) => sum + count * each, 0);
  if (!rule.phaseOut) return full;
  const excess = input.federal.adjustedGrossIncome - rule.phaseOut.start[status];
  if (excess <= 0) return full;
  // "$6 for each $2,500, or fraction thereof" — a partial increment counts in
  // full, so the phase-out is a staircase and one dollar over a step costs $6
  // per exemption claimed.
  //
  // And it is subtracted from each LINE of Form 540 separately, with that line
  // floored at zero: the AGI Limitation Worksheet says "if zero or less, enter
  // -0-" four times rather than once at the bottom. The difference is real
  // because the lines are different sizes — a `$475` dependent credit survives
  // a reduction that has already taken a `$153` personal credit to nothing, and
  // netting the whole return in one subtraction lets the dead personal credit
  // eat into the live dependent one.
  const perExemption = Math.ceil(excess / rule.phaseOut.increment[status]) *
    rule.phaseOut.amountPerIncrement;
  return lines.reduce((sum, [count, each]) => sum + count * Math.max(0, each - perExemption), 0);
}

/**
 * Wisconsin's married couple credit — 3% of the LESSER of the two spouses'
 * earned income, capped at `$480`, on a joint return only.
 *
 * Returns the credit and whether the figure it needs was supplied, because the
 * two answers are "zero because the couple has one earner" and "zero because
 * nobody told me", and a credit line that cannot tell them apart is the kind of
 * silence this package has been bitten by before.
 */
function marriedCoupleCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): { readonly amount: number; readonly supplied: boolean } {
  const rule = def.marriedCoupleCredit;
  if (!rule || input.filingStatus !== 'marriedFilingJointly') {
    return { amount: 0, supplied: true };
  }
  if (input.lesserSpouseIncome === undefined) return { amount: 0, supplied: false };
  const lesser = nonNegative(input.lesserSpouseIncome, 'lesserSpouseIncome');
  return { amount: Math.min(rule.max, lesser * rule.rate), supplied: true };
}

/**
 * Wisconsin's itemized deduction credit — 5% of the excess of ELIGIBLE itemized
 * deductions over the state standard deduction.
 *
 * Measured against the standard deduction the filer would otherwise have taken,
 * which in Wisconsin is a sliding scale: so the credit's base rises as income
 * rises and the deduction it is netted against falls away, and above the end of
 * the phase-out the whole of the itemized total is in the credit.
 */
function itemizedDeductionCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  standardDeductionTaken: number,
): number {
  const rule = def.itemizedDeductionCredit;
  if (!rule) return 0;
  const itemized = nonNegative(input.stateItemizedDeductions, 'stateItemizedDeductions');
  return rule.rate * Math.max(0, itemized - standardDeductionTaken);
}

/** Wisconsin's school property tax credit — 12% of property tax plus 20% of rent, capped at `$300`. */
function schoolPropertyTaxCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): number {
  const rule = def.schoolPropertyTaxCredit;
  if (!rule) return 0;
  const property =
    nonNegative(input.propertyTaxPaid, 'propertyTaxPaid') +
    nonNegative(input.rentPaid, 'rentPaid') * rule.rentShare;
  return Math.min(rule.max, property * rule.rate);
}

/**
 * Wisconsin's § 71.05(6)(b)54m subtraction, where the filer elects it.
 *
 * Per person who has reached the age, capped per person — except on a joint
 * return where BOTH have, which pools the two incomes against one larger cap.
 * The two are not the same arithmetic: a couple where one spouse has `$40,000`
 * of pension and the other `$2,000` subtracts `$42,000` of the `$48,000` pooled
 * cap, and `$26,000` under a per-person one.
 */
function retirementExclusionElection(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): number {
  const rule = def.retirementIncomeExclusionElection;
  if (!rule) return 0;
  const { people } = retirementPeople(input);
  const eligible = people.filter(
    (person) => person.age !== undefined && person.age >= rule.minimumAge,
  );
  if (eligible.length === 0) return 0;
  // § 71.05(6)(b)54m.a names payments from a plan qualified under IRC § 401(a),
  // § 403 or § 457(b) and from an IRA. So: the employer plan, the defined
  // contribution plan, the IRA — and `governmentPension`, which is a disjoint
  // field by its own documentation and is a § 401(a) governmental plan in
  // Wisconsin's hands. Social Security and military retired pay are absent
  // because Wisconsin exempts both outright, so there is nothing left of them
  // to subtract.
  const qualifying = (person: (typeof people)[number]): number =>
    person.pension + person.ira + person.governmentPension;
  if (input.filingStatus === 'marriedFilingJointly' && eligible.length >= 2) {
    return Math.min(rule.jointBothEligible, eligible.reduce((sum, p) => sum + qualifying(p), 0));
  }
  return eligible.reduce((sum, p) => sum + Math.min(rule.perPerson, qualifying(p)), 0);
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

/**
 * The state's notes, less the ones this return cannot be affected by.
 *
 * Every note a result carries is context the caller pays for. Maryland has
 * seventeen and Georgia thirteen, and most of a retiree's are about provisions
 * they did not claim — so a note whose whole subject is a field the caller left
 * empty is a cost with no benefit. `conditionalNotes` is the opt-in: a note
 * moved into it appears only on the returns it could change, and one left in
 * `notes` still appears on all of them.
 */
function relevantNotes(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): readonly string[] {
  if (!def.conditionalNotes || def.conditionalNotes.length === 0) return def.notes;
  const extra = def.conditionalNotes.filter((n) => n.relevantWhen(input)).map((n) => n.text);
  return extra.length > 0 ? [...def.notes, ...extra] : def.notes;
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
 * Interest on other states' municipal bonds, in a state that exempts its own.
 *
 * Separate from {@link addBacks} because it is a different kind of thing: those
 * are federal deductions a `federalTaxableIncome` state never wanted, and this
 * is income that reached **no** federal line at all. It is also the only
 * addition here that a `federalAdjustedGrossIncome` base needs, which is why
 * every other state in this package takes it through `additions`.
 */
function municipalInterestAddition(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): { name: string; amount: number }[] {
  if (!def.outOfStateMunicipalInterestAddition) return [];
  const amount = nonNegative(
    input.outOfStateMunicipalInterest,
    'outOfStateMunicipalInterest',
  );
  if (amount <= 0) return [];
  return [{ name: `${def.name} addition for other states' municipal interest`, amount }];
}

/**
 * Pennsylvania Special Tax Forgiveness, as a percentage of the tax.
 *
 * The staircase is what matters: eligibility income at or below the allowance
 * forgives the whole tax, and each $250 above it — or any part of $250 — forgives
 * ten percentage points less, so forgiveness runs out $2,500 later.
 */
/**
 * How many claimants PA-40 Schedule SP counts, and the joint eligibility income
 * that goes with them.
 *
 * **Schedule SP has three claimant boxes — unmarried, separated, married — and
 * they do not line up with filing statuses in either direction.** One helper was
 * being asked to map five statuses onto them and got two wrong, in OPPOSITE
 * directions, which is the clearest argument this package has for naming a
 * helper after the question rather than the shape of its answer:
 *
 * - A **qualifying surviving spouse** was given the MARRIED allowance. The
 *   Personal Income Tax Guide's own words put her in the first box: an
 *   UNMARRIED claimant is one who is "divorced or widowed and unmarried at the
 *   end of the taxable year". Worth `$614.00` — her whole Pennsylvania tax.
 * - A **married claimant filing separately** was given the UNMARRIED one. There
 *   is no separate-return table: "married claimants are not dependents of one
 *   another for Tax Forgiveness purposes, even when one spouse does not have any
 *   Eligibility Income. Each must use the Joint Eligibility Income and
 *   Eligibility Income Table 2." So the allowance is `$13,000` and the income is
 *   BOTH spouses'.
 *
 * The second is why this returns a pair. The allowance and the income move
 * together and taking one without the other is worse than taking neither: a
 * `$13,000` allowance against one spouse's income forgives a two-earner couple
 * twice over. The spouse's eligibility income is on no figure of a separate
 * return, so the engine will not assume it — supply
 * `pennsylvaniaSpouseEligibilityIncome` (`0` is a real answer) and the return is
 * computed on Table 2; leave it out and it keeps Table 1, which is too much tax
 * and is said out loud in the notes.
 *
 * A *separated* claimant — living apart at all times during the last six months,
 * or separated under a written agreement — ticks the Unmarried oval on line 19a
 * and is genuinely one claimant on their own income. `separatedFromSpouse` says
 * so and wins over everything above.
 */
function forgivenessClaimants(
  input: StateIncomeTaxInput,
): { readonly claimants: number; readonly spouseIncome: number; readonly assumedSingle: boolean } {
  const status = input.filingStatus;
  if (status === 'marriedFilingJointly') {
    return { claimants: 2, spouseIncome: 0, assumedSingle: false };
  }
  if (status !== 'marriedFilingSeparately' || input.separatedFromSpouse === true) {
    return { claimants: 1, spouseIncome: 0, assumedSingle: false };
  }
  const supplied = input.pennsylvaniaSpouseEligibilityIncome;
  if (supplied === undefined) {
    return { claimants: 1, spouseIncome: 0, assumedSingle: true };
  }
  return {
    claimants: 2,
    spouseIncome: nonNegative(supplied, 'pennsylvaniaSpouseEligibilityIncome'),
    assumedSingle: false,
  };
}

function forgivenessCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  tax: number,
): number {
  const rule = def.forgiveness;
  if (!rule) return 0;
  const { claimants, spouseIncome } = forgivenessClaimants(input);
  const eligibility =
    nonNegative(
      input.pennsylvaniaEligibilityIncome ?? input.pennsylvaniaTaxableIncome,
      'pennsylvaniaEligibilityIncome',
    ) + spouseIncome;
  // Pennsylvania's staircase is why the surviving-spouse half of this was the
  // most expensive of v0.27.0's fourteen. The allowance is not a deduction; it
  // is where a 100% forgiveness of the WHOLE tax begins to step down, ten points
  // per $250. Handing a widow the married base moved the whole staircase $6,500
  // to the right, so she was forgiven tax on $6,500 of income Pennsylvania taxes.
  const allowance = rule.base * claimants + rule.perDependent * dependentCount(input);
  const excess = eligibility - allowance;
  const steps = excess <= 0 ? 0 : Math.ceil(excess / rule.increment);
  const share = Math.max(0, 1 - steps * rule.reductionPerIncrement);
  return tax * share;
}

/**
 * Indiana's unified tax credit for the elderly, IC 6-3-3-9.
 *
 * Banded on **federal** adjusted gross income rather than on Indiana's, which
 * is the fact that decides who gets it: the state's own Social Security
 * exemption and its `$5,000` of exemptions for a retired couple move the
 * Indiana figure and not this one.
 *
 * The comparison is strict — `income < band.under` — because the statute says
 * "less than", and the boundary is worth `$50` at `$1,000`.
 */
function agedCredit(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): number {
  const rule = def.agedCredit;
  if (!rule) return 0;
  if (rule.requiresJointReturnWhenMarried && input.filingStatus === 'marriedFilingSeparately') {
    return 0;
  }
  const aged = seniorFilers(input, rule.minimumAge);
  if (aged === 0) return 0;
  const income = input.federal.adjustedGrossIncome;
  for (const band of aged >= 2 ? rule.bothAged : rule.oneAged) {
    if (income < band.under) return band.amount;
  }
  return 0;
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
 *
 * **That sentence was right and the code under it was not.** "The spouse on a
 * joint return" excludes a qualifying surviving spouse, who does not file one —
 * and the credit went on counting one anyway, for $5 to $15 a return. A
 * docstring that states the rule correctly is not a check on the line below it;
 * only a test is.
 */
function householdCredit(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput, agi: number): number {
  const rule = def.householdCredit;
  if (!rule) return 0;
  const status = input.filingStatus;
  const people = livingFilerCount(status) + dependentCount(input);
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
function childCredit(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  stateTaxableIncome: number,
  stateAgi: number,
): number {
  const rule = def.childCredit;
  if (!rule) return 0;
  const ages = input.dependentAges;
  if (ages === undefined || ages.length === 0) return 0;

  const perChild: number[] = [];
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
        if (band.amount > 0) perChild.push(band.amount);
        break;
      }
    }
  }
  // Oregon caps the credit at FIVE qualifying children — HB 3235 § 2(1) — and
  // the cap is a count rather than a ceiling in dollars, so the five kept are
  // the five worth most. Oregon pays one amount per child so the order cannot
  // matter there; it is sorted anyway, because a banded credit with a count
  // limit is the shape where a sixth child could otherwise displace a dearer
  // one.
  const counted =
    rule.maxChildren === undefined
      ? perChild
      : [...perChild].sort((a, b) => b - a).slice(0, rule.maxChildren);
  const credit = counted.reduce((sum, amount) => sum + amount, 0);
  if (credit <= 0) return 0;
  // Massachusetts's has no phase-out at all, which is the whole of what makes it
  // unusual: it is worth the same $440 per dependent at $400,000 of income as at
  // $40,000.
  if (!rule.phaseOut) return credit;

  // Utah withdraws its credit against a *post-subtraction* figure and its own
  // retirement credits against a pre-subtraction one, on the same return. See
  // {@link ChildCreditPhaseOutIncome}.
  const income =
    rule.phaseOut.income === 'stateTaxableIncomePlusTaxExemptInterest'
      ? stateTaxableIncome + nonNegative(input.taxExemptInterest, 'taxExemptInterest')
      : rule.phaseOut.income === 'stateAdjustedGrossIncome'
        ? stateAgi
        : input.federal.adjustedGrossIncome;
  const excess = income - rule.phaseOut.threshold[input.filingStatus];
  if (excess <= 0) return credit;
  if (rule.phaseOut.kind === 'rate') {
    return Math.max(0, credit - excess * rule.phaseOut.rate);
  }
  // Oregon's: the whole credit over a fixed WIDTH, so the implied marginal rate
  // is credit/width and therefore grows with the family. At five children under
  // six it is 105% — $5,250 of credit withdrawn across $5,000 of income — and
  // the family is strictly worse off at the top of the band than the bottom.
  if (rule.phaseOut.kind === 'overWidth') {
    const withdrawn = Math.min(excess / rule.phaseOut.width, 1);
    return credit * (1 - withdrawn);
  }
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
 * Connecticut's Social Security benefit adjustment — CT-1040 Schedule 1 line 41.
 *
 * Below the threshold the whole federally taxable benefit comes out, so the
 * benefit is untaxed. At the threshold that is replaced — not tapered — by a
 * computation that leaves at most `rate` of the *gross* benefit in the base.
 *
 * The § 86 combined income excess has to be reconstructed here, because this
 * package's input is federal AGI rather than the federal Social Security
 * Benefits Worksheet: provisional income is AGI with the taxable benefit taken
 * out, half the gross benefit put back, and tax-exempt interest added. The one
 * term it can be short of is tax-exempt interest the caller did not supply, and
 * being short understates the excess, the `min`, and therefore Connecticut tax.
 * The returned `reconstructed` flag is what puts that in the caller's notes,
 * and only for the filers it can reach: below the threshold the figure is not
 * used at all.
 */
function connecticutSocialSecurity(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  grossBenefits: number,
): { readonly amount: number; readonly reconstructed: boolean } {
  const rule = def.socialSecurityBenefitAdjustment;
  const taxable = nonNegative(input.taxableSocialSecurity, 'taxableSocialSecurity');
  if (!rule || taxable <= 0) return { amount: 0, reconstructed: false };
  const federalAgi = input.federal.adjustedGrossIncome;
  if (federalAgi < rule.fullSubtractionBelow[input.filingStatus]) {
    return { amount: taxable, reconstructed: false };
  }
  const provisional =
    Math.max(0, federalAgi - taxable) +
    grossBenefits / 2 +
    nonNegative(input.taxExemptInterest, 'taxExemptInterest');
  const excess = Math.max(0, provisional - rule.combinedIncomeBase[input.filingStatus]);
  const charged = rule.rate * Math.min(grossBenefits, excess);
  return { amount: Math.max(0, taxable - charged), reconstructed: true };
}

/**
 * Connecticut's pension, annuity and IRA subtraction — Schedule 1 lines 48a
 * and 48b.
 *
 * Two percentages, and only one of them is on the income staircase. The IRA
 * phase-in share is a function of the tax year alone and applies to IRA
 * distributions only; the staircase is a function of federal AGI and applies to
 * the pension and the phased-in IRA amount together.
 */
/**
 * Alabama's two retirement subtractions, which are one question asked about the
 * PLAN rather than about the person or the money.
 *
 * A defined benefit payment is exempt in full — no cap, no age test, and
 * Ala. Admin. Code r. 810-3-19-.04 reaches non-qualified plans, SERPs and
 * excess benefit plans as well as qualified ones. A defined contribution
 * distribution is taxable above `$6,000` per person, and only for a person who
 * has reached 65.
 *
 * So the ordering of a retirement, not its size, decides the Alabama bill: at
 * 62 a `$60,000` pension is free and a `$60,000` 401(k) draw costs `$2,760.00`;
 * at 65 the same draw costs `$2,460.00`. The `$6,000` is the only part of this
 * that any table prints.
 *
 * The cap is per PERSON, like Maryland's exclusion and unlike Alabama's own
 * standard deduction, so which spouse the draw comes from changes the answer on
 * a joint return by up to `$300`.
 */
function planTypeRetirement(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): { readonly total: number; readonly details: readonly { name: string; amount: number }[] } {
  const rule = def.planTypeRetirement;
  if (!rule) return { total: 0, details: [] };
  const { people } = retirementPeople(input);
  let definedBenefit = 0;
  let definedContribution = 0;
  for (const person of people) {
    // Government retired pay and military retired pay are defined benefit
    // payments, which is why they are in this half rather than beside it: the
    // regulation asks what kind of plan paid, and a state pension plan and a
    // corporate one answer the same way.
    definedBenefit += person.definedBenefit + person.governmentPension + person.military;
    if (person.age !== undefined && person.age >= rule.definedContributionAge) {
      definedContribution += Math.min(
        person.definedContribution + person.ira,
        rule.definedContributionCap,
      );
    }
  }
  const details: { name: string; amount: number }[] = [];
  if (definedBenefit > 0) details.push({ name: rule.name, amount: definedBenefit });
  if (definedContribution > 0) {
    details.push({ name: rule.definedContributionName, amount: definedContribution });
  }
  return { total: definedBenefit + definedContribution, details };
}

function connecticutRetirementSubtraction(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  people: readonly RetirementPerson[],
): number {
  const rule = def.retirementSubtractionSchedule;
  if (!rule) return 0;
  const fraction = fractionAtOrAbove(
    rule.schedule[input.filingStatus],
    input.federal.adjustedGrossIncome,
  );
  if (fraction <= 0) return 0;
  const qualifying = people.reduce(
    (sum, person) => sum + person.pension + person.ira * rule.iraPhaseInShare,
    0,
  );
  return qualifying * fraction;
}

/**
 * One Connecticut "or fraction thereof" staircase, in dollars.
 *
 * `min(maximum, amount x ceil(max(0, agi - start) / increment))`.
 *
 * The `ceil` is the mechanism and the `>` is its boundary: at exactly `start`
 * the excess is zero and no fraction of a step has been exceeded, so the result
 * is zero. One cent above it the whole first step applies. Connecticut writes
 * the same four words into § 12-700's recapture, § 12-700's rate phase-out and
 * § 12-702's exemption withdrawal, and this function is all three of them.
 */
export function fractionThereofAmount(
  staircase: FractionThereofStaircase,
  status: FilingStatus,
  agi: number,
): number {
  const over = agi - staircase.start[status];
  if (over <= 0) return 0;
  const steps = Math.ceil(over / staircase.increment[status]);
  return Math.min(staircase.maximum[status], staircase.amount[status] * steps);
}

/**
 * The fraction on a staircase whose boundary belongs to the step ABOVE —
 * Connecticut's pension, annuity and IRA phase-out, whose bands reach a filer
 * with federal AGI "at least $75,000 but less than $77,500".
 *
 * A retiree at exactly `$75,000` is on the 85% row, not the 100% one.
 */
export function fractionAtOrAbove(
  steps: readonly TaxFractionStep[],
  income: number,
): number {
  let fraction = 0;
  for (const step of steps) {
    if (income < step.from) break;
    fraction = step.fraction;
  }
  return fraction;
}

/**
 * The fraction on a staircase whose boundary belongs to the step BELOW —
 * Connecticut's personal tax credit, whose § 12-703 rows read "over $15,000 but
 * not over $18,800".
 *
 * A single filer at exactly `$18,800` keeps the 75% row and loses it at
 * `$18,800.01`. This is the opposite of {@link fractionAtOrAbove} and the two
 * are both right, for different tables on the same Connecticut return — see
 * {@link TaxFractionStep}. PolicyEngine-US models Table E with the other
 * convention, which is a whole step of credit at each of the 27 boundaries for
 * a filer whose Connecticut AGI lands exactly on one.
 *
 * Below the first step's `from` there is no credit at all, which costs nothing:
 * that filer's exemption has already taken their Connecticut tax to zero.
 */
export function fractionAbove(
  steps: readonly TaxFractionStep[],
  income: number,
): number {
  let fraction = 0;
  for (const step of steps) {
    if (income <= step.from) break;
    fraction = step.fraction;
  }
  return fraction;
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
  /**
   * Taxable income with any business income deduction added back — Ohio's
   * traditional school district base. Equal to {@link taxableIncome} in every
   * state that has no such deduction.
   */
  modifiedTaxableIncome: number;
  /**
   * Whether the filer is an "eligible low income taxpayer" under Md. Code,
   * Tax-Gen. § 10-709(a)(3). Carried out of the state computation because the
   * COUNTY credit of § 10-709(d) turns on the same one determination, and a
   * locality cannot make it: both income tests are read against figures on the
   * state return.
   */
  povertyLevelCreditEligible: boolean;
}

/**
 * The whole state computation, on one of the two routes a property tax relief
 * state offers. `compute` runs both and keeps the cheaper.
 */
function computeOnce(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  propertyTaxRoute: 'deduction' | 'credit',
  /**
   * Whether this pass takes Wisconsin's § 71.05(6)(b)54m retirement income
   * subtraction, which forfeits every credit on the return. `compute` runs both
   * passes and keeps the lower tax; nothing else may set it.
   */
  electRetirementExclusion = false,
): Computed {
  const base = conformityAmount(def, input);
  const back = [...addBacks(def, input), ...municipalInterestAddition(def, input)];
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
  // Missouri's § 143.121.3(14), HB 594 (2025) — the whole net capital gain,
  // short-term included, out of MISSOURI AGI rather than out of taxable income.
  // That placement is the provision's second half: Missouri AGI is the figure
  // the federal income tax deduction's rate chart is read against, so the
  // subtraction removes the gain from the base AND can move the filer down a
  // step of the chart, unlocking a deduction for the federal tax on the gain it
  // just exempted.
  let capitalGainsSubtraction = 0;
  if (def.capitalGainsSubtraction) {
    // ONE field, deliberately. `netCapitalGain` is Form 1040 line 7, which
    // already nets short-term against long-term, and
    // `includesShortTerm` records that Missouri wants the whole of that line
    // rather than its long-term half — adding `shortTermCapitalGains`, which
    // Massachusetts reads, would count the same dollars twice for a caller who
    // supplies both.
    const netGain = nonNegative(input.netCapitalGain, 'netCapitalGain');
    // Wisconsin's Schedule WD line 25 excludes the short-term half: the
    // subtraction is a share of the net LONG-TERM gain, bounded by the net gain
    // as a whole, so a short-term gain cannot create an exclusion and a
    // short-term LOSS eats one. `shortTermCapitalGains` is the figure that
    // splits the line; absent, the whole net gain is treated as long-term,
    // which is the only answer a single netted figure supports and which the
    // state's notes name.
    const longTerm = def.capitalGainsSubtraction.includesShortTerm
      ? netGain
      : Math.max(0, netGain - nonNegative(input.shortTermCapitalGains, 'shortTermCapitalGains'));
    capitalGainsSubtraction = Math.min(netGain, longTerm) * def.capitalGainsSubtraction.share;
    if (capitalGainsSubtraction > 0) {
      computedSubtractions.push({
        name: def.capitalGainsSubtraction.name,
        amount: capitalGainsSubtraction,
      });
    }
  }
  // Virginia takes the taxable Social Security inside federal AGI straight back
  // out, and needs the same figure again for the age deduction's income test —
  // which is why it is an input here rather than something the caller nets into
  // `subtractions` the way Illinois, Kentucky and North Carolina ask for it.
  const taxableSocialSecurity = nonNegative(
    input.taxableSocialSecurity,
    'taxableSocialSecurity',
  );
  let socialSecuritySubtraction = 0;
  if (def.subtractsTaxableSocialSecurity && taxableSocialSecurity > 0) {
    socialSecuritySubtraction = taxableSocialSecurity;
    computedSubtractions.push({
      name: 'Social Security and Tier 1 railroad retirement benefits',
      amount: socialSecuritySubtraction,
    });
  }
  // Connecticut's two retirement subtractions. They read FEDERAL AGI, not
  // Connecticut AGI, so neither depends on the other and neither depends on
  // itself: Schedule 1 is computed from the figure the federal return already
  // produced, and only then does Connecticut AGI exist.
  let connecticutSubtractions = 0;
  if (def.socialSecurityBenefitAdjustment || def.retirementSubtractionSchedule) {
    const { people } = retirementPeople(input);
    const grossBenefits = people.reduce((sum, person) => sum + person.benefits, 0);
    const adjustment = connecticutSocialSecurity(def, input, grossBenefits);
    if (adjustment.amount > 0) {
      computedSubtractions.push({
        name: def.socialSecurityBenefitAdjustment?.name ?? 'Social Security benefit adjustment',
        amount: adjustment.amount,
      });
      connecticutSubtractions += adjustment.amount;
    }
    const retirementSubtraction = connecticutRetirementSubtraction(def, input, people);
    if (retirementSubtraction > 0) {
      computedSubtractions.push({
        name: def.retirementSubtractionSchedule?.name ?? 'Pension, annuity and IRA subtraction',
        amount: retirementSubtraction,
      });
      connecticutSubtractions += retirementSubtraction;
    }
  }
  // Alabama's plan-type retirement subtractions. They come after the Social
  // Security subtraction because they are independent of it: Alabama does not
  // charge the benefit against either half, the way Maryland charges it against
  // its pension exclusion.
  const planType = planTypeRetirement(def, input);
  for (const detail of planType.details) computedSubtractions.push(detail);
  const age = ageDeduction(def, input, taxableSocialSecurity);
  const ageDeductionTaken = age.amount;
  if (def.ageDeduction && ageDeductionTaken > 0) {
    computedSubtractions.push({ name: def.ageDeduction.name, amount: ageDeductionTaken });
  }
  // Maryland's three per-person retirement subtractions. They come after the
  // Social Security subtraction above because they read the *total* benefits
  // received while that one reads the taxable part — the same dollars, counted
  // twice on one return, in opposite directions.
  const retirement = retirementSubtractions(def, input);
  for (const detail of retirement.details) computedSubtractions.push(detail);
  // Georgia's tips and overtime exclusions. They are read off the federal
  // deductions the same dollars produced, which is the only figure a package
  // whose base is federal AGI has: the § 224 and § 225 deductions are below the
  // line, so the compensation they exempt is still inside every conforming
  // state's base and a state that wants to follow has to legislate for itself.
  let compensationExcluded = 0;
  if (def.compensationExclusions) {
    const taken = input.federalDeductions ?? {};
    for (const rule of def.compensationExclusions) {
      const amount = Math.min(
        nonNegative(taken[rule.source], `federalDeductions.${rule.source}`),
        rule.cap,
      );
      if (amount > 0) {
        compensationExcluded += amount;
        computedSubtractions.push({ name: rule.name, amount });
      }
    }
  }
  // Oregon's federal tax subtraction is an INCOME subtraction and the others'
  // are deductions, which is a difference of form order that costs money in
  // exactly one place: Oregon AGI is what the Oregon Kids Credit is phased out
  // against, so up to $8,750 of subtraction can buy back as much as $1,050 a
  // child. Computed with no state AGI to read, which is sound only because
  // Oregon's cap chart reads FEDERAL AGI — `requireStateAgi` and
  // `registry.test.js` between them make that a rule rather than a hope.
  const federalTaxAgiSubtraction =
    def.federalIncomeTaxDeduction?.reducesStateAdjustedGrossIncome === true
      ? federalIncomeTaxDeduction(def, input, undefined)
      : 0;
  // Wisconsin's § 71.05(6)(b)54m. A Schedule SB subtraction like any other
  // where it is claimed, and the reason it needs a flag rather than a rule is
  // subd. 54m.b: claiming it forfeits every credit under s. 71.07. So it is
  // computed on this pass only if `compute` asked for the pass that claims it.
  let retirementExclusionElected = 0;
  if (electRetirementExclusion && def.retirementIncomeExclusionElection) {
    retirementExclusionElected = retirementExclusionElection(def, input);
    if (retirementExclusionElected > 0) {
      computedSubtractions.push({
        name: `${def.retirementIncomeExclusionElection.name} (claimed: ${def.retirementIncomeExclusionElection.forfeits})`,
        amount: retirementExclusionElected,
      });
    }
  }
  const subtractions =
    given +
    retirementExclusionElected +
    exclusion +
    businessDeduction +
    capitalGainsSubtraction +
    socialSecuritySubtraction +
    connecticutSubtractions +
    planType.total +
    ageDeductionTaken +
    retirement.total +
    compensationExcluded +
    federalTaxAgiSubtraction;
  const stateAgi = Math.max(0, base + additions - subtractions);
  const modifiedAgi = stateAgi + businessDeduction;

  const propertyTax = qualifyingPropertyTax(def, input);
  const propertyTaxDeduction = propertyTaxRoute === 'deduction' ? propertyTax : 0;
  const deduction = stateDeduction(def, input, stateAgi) + propertyTaxDeduction;
  // Wisconsin's itemized deduction credit is 5% of the excess of eligible
  // itemized deductions over THE STANDARD DEDUCTION, so the credit needs the
  // standard figure on its own and not the `max()` above. In Wisconsin the two
  // are the same number — the state has no itemized deduction at all, which is
  // why it has this credit — and taking the standard figure directly keeps that
  // a fact about Wisconsin rather than an assumption about `stateDeduction`.
  const standardDeductionTaken = standardDeduction(def, input, stateAgi);
  const exemptions = stateExemptions(def, input, modifiedAgi, stateAgi);
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
  // Connecticut's Table C and Table D, in the order the Tax Calculation Schedule
  // puts them: line 5 is the add-back and line 6 the recapture, and line 7 adds
  // both to the tax before the Table E credit is applied to the sum.
  //
  // Both are measured on CONNECTICUT adjusted gross income — `stateAgi` — and
  // not on taxable income and not on the federal figure. A retiree whose
  // Social Security and pension subtractions took them under $105,000 of
  // Connecticut AGI owes no recapture, however large their federal AGI.
  if (def.phaseOutAddBack && !belowThreshold) {
    const amount = fractionThereofAmount(
      def.phaseOutAddBack.staircase,
      input.filingStatus,
      stateAgi,
    );
    if (amount > 0) surtaxes.push({ name: def.phaseOutAddBack.name, amount });
  }
  if (def.steppedRecapture && !belowThreshold) {
    const amount = def.steppedRecapture.tiers.reduce(
      (sum, tier) => sum + fractionThereofAmount(tier, input.filingStatus, stateAgi),
      0,
    );
    if (amount > 0) surtaxes.push({ name: def.steppedRecapture.name, amount });
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
  // Connecticut's Table E, first because the form puts it first: line 8 is the
  // decimal, line 9 is line 7 times it, line 10 is line 7 less line 9. `grossTax`
  // is line 7 — the tax with the add-back and the recapture already in it —
  // which is the whole of why the add-back is discounted for the single filers
  // whose credit has not yet run out.
  if (def.personalTaxCredit && !belowThreshold) {
    const fraction = fractionAbove(def.personalTaxCredit.steps[input.filingStatus], stateAgi);
    credits.push({
      name: def.personalTaxCredit.name,
      amount: grossTax * fraction,
      refundable: false,
    });
  }
  // Virginia's Form 760 subtracts the spouse tax adjustment on line 17, before
  // every credit, and the Credit for Low Income Individuals is capped at what is
  // left — so this one is genuinely first rather than merely listed first.
  const spouse = belowThreshold
    ? { amount: 0, assumedEvenSplit: false }
    : spouseTaxAdjustment(def, input, taxableIncome, grossTax);
  if (def.spouseTaxAdjustment) {
    credits.push({
      name: spouse.assumedEvenSplit && spouse.amount > 0
        ? `${def.spouseTaxAdjustment.name} (assumed: an even split of taxable income between the spouses — pass lesserSpouseIncome for the exact figure)`
        : def.spouseTaxAdjustment.name,
      amount: spouse.amount,
      refundable: false,
    });
  }
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
  if (def.reducedBaseRetirementCredit) {
    credits.push({
      name: def.reducedBaseRetirementCredit.name,
      amount: reducedBaseRetirementCredit(def, input),
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
  if (def.exclusiveRetirementCredits) {
    // Utah's modified AGI: TC-40 line 6 — federal AGI plus Utah additions —
    // plus tax-exempt interest, and before every Utah subtraction. It is a
    // different figure from `stateAgi` on purpose; see the function.
    const utahModifiedAgi =
      base + additions + nonNegative(input.taxExemptInterest, 'taxExemptInterest');
    const chosen = exclusiveRetirementCredits(def, input, utahModifiedAgi);
    if (chosen) credits.push({ ...chosen, refundable: false });
  }
  // FEDERAL adjusted gross income, and not this state's. § 606(b) is measured on
  // "household gross income", which the statute defines as "the aggregate
  // adjusted gross income of all members of the household … as reported for
  // FEDERAL income tax purposes", and the IT-201 instructions turn that into a
  // line number: "For most taxpayers, federal adjusted gross income is the
  // amount from Form IT-201, line 19." Line 19 is the federal figure; New York's
  // own is line 33.
  //
  // This package passed line 33, so every New York SUBTRACTION bought a credit
  // the statute does not allow — and the largest of them is the § 612(c)(3-a)
  // pension exclusion, which is $20,000 a person. A single New York retiree with
  // a $40,000 pension and $24,000 of Social Security was given $45 of household
  // credit on a household gross income that is nowhere near the $28,000 ceiling.
  //
  // The tell was inside this repository. `localHouseholdCredit` takes a
  // parameter NAMED `federalAgi`, because the same note in the same instructions
  // covers the city tables 4 to 6 as well as the state tables 1 to 3 — so one
  // rule was implemented twice, correctly in the locality engine and wrongly
  // here, and nothing compared them. Found by asking why PolicyEngine-US, which
  // reads `adjusted_gross_income` for this credit, was $45 HIGHER on a retiree.
  const household = householdCredit(def, input, input.federal.adjustedGrossIncome);
  if (def.householdCredit) {
    credits.push({ name: def.householdCredit.name, amount: household, refundable: false });
  }
  let nonRefundableEarnedIncomeCredit = 0;
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
    // Two gates Missouri's § 143.177 has and nobody else here does, both of
    // them all-or-nothing. The investment income one is a CONFORMITY DATE
    // rather than a figure the state chose: § 143.177.3(1) reads § 32 as it
    // stood on 1 January 2021, so the limit is the pre-ARPA one and a filer
    // can keep the whole federal credit while losing the whole state one.
    const barred =
      (rule.ineligibleFilingStatuses?.includes(input.filingStatus) ?? false) ||
      (rule.investmentIncomeLimit !== undefined &&
        nonNegative(input.investmentIncome, 'investmentIncome') > rule.investmentIncomeLimit);
    // Oregon writes the credit as TWO percentages — 9% and 12% for 2025, 14%
    // and 17% from SB 1507 — rather than as a credit plus a bonus, so the
    // young-child case changes the rate and not the total. A switch and not a
    // multiplier: one toddler and three are worth the same. A return that
    // supplies only a COUNT of dependents cannot reach it, and takes the lower
    // rate rather than the flattering one.
    const youngChild =
      rule.youngChildMatchRate !== undefined &&
      rule.youngChildMaxAge !== undefined &&
      (input.dependentAges?.some((age) => age <= rule.youngChildMaxAge!) ?? false);
    // Wisconsin's § 71.07(9e)(aj) is the only match here that is not one
    // percentage: 0%, 4%, 11% and 34% by the number of qualifying children, so
    // the rate is looked up on the family rather than applied to the credit.
    // The largest entry means "this many or more"; a count below the smallest
    // takes `matchRate`, which for Wisconsin is the 0% a childless filer gets.
    const byCount = rule.matchRateByChildCount;
    const childCountRate =
      byCount === undefined
        ? undefined
        : byCount.reduce<number | undefined>(
            (chosen, entry) =>
              qualifyingChildrenOf(input) >= entry.children ? entry.rate : chosen,
            undefined,
          );
    const matched = barred
      ? 0
      : (childless
          ? rule.childlessMatchRate!
          : youngChild
            ? rule.youngChildMatchRate!
            : (childCountRate ?? rule.matchRate)) * federalCredit;
    // Virginia offers a flat per-exemption credit as an ALTERNATIVE to the
    // match, not in addition to it, and the filer takes whichever leaves them
    // better off. Which one that is turns on refundability rather than on size:
    // $300 a head is capped at the tax, the match is not, so a family under the
    // poverty guideline with no Virginia tax is better off with the smaller
    // number. The engine compares what each is actually worth.
    const alternative = def.lowIncomeCredit
      ? lowIncomeCredit(def, input, stateAgi, ageDeductionTaken)
      : 0;
    const alternativeWorth = Math.min(alternative, Math.max(0, grossTax - spouse.amount));
    // New York pays the match less the household credit, so the two are not
    // additive — Tax Law § 606(d)(1). **Less the household credit the filer
    // could actually USE**, which is not the same number and until v0.27.0 this
    // package used the other one.
    //
    // Form IT-215 spells the arithmetic out in three lines: line 13 is
    // Worksheet B line 5, line 14 is the household credit from Form IT-201 line
    // 40, line 15 is "the SMALLER of line 13 or line 14", and line 16 is line
    // 12 less line 15. Worksheet B line 5 is the New York tax the household
    // credit is set against, so a filer whose tax is smaller than the credit
    // surrenders only as much of the match as the credit actually absorbed.
    //
    // That filer is the whole point of both credits. A single parent of two at
    // $12,000 has about $80 of New York tax and a $90 household credit, and was
    // losing $90 of a REFUNDABLE match to a NON-REFUNDABLE credit that could
    // only ever have been worth $80 — paying $75 for the privilege of being
    // offered relief. Found by chasing a `known-divergences.json` entry that
    // claimed PolicyEngine-US "models neither the credit nor the offset"; it
    // models both, and this was one of the two things left over.
    const usableHousehold = Math.min(household, Math.max(0, grossTax));
    const paid = rule.reducedByHouseholdCredit
      ? Math.max(0, matched - usableHousehold)
      : matched;
    if (def.lowIncomeCredit && alternativeWorth > matched) {
      credits.push({ name: def.lowIncomeCredit.name, amount: alternative, refundable: false });
    } else {
      // Maryland's poverty level credit is measured against the tax left after
      // THIS credit and no other — § 10-709(c)(1) names § 10-704(b)(1) by
      // section number — so the figure is carried rather than re-derived from
      // the credits list, which by then holds the senior credit too.
      if (!rule.refundable) nonRefundableEarnedIncomeCredit = paid;
      credits.push({ name: rule.name, amount: paid, refundable: rule.refundable });
      if (def.earnedIncomeCreditChildBonus) {
        const bonus = def.earnedIncomeCreditChildBonus;
        const ages = input.dependentAges;
        // A child under the age limit is a switch, not a multiplier: one child
        // and four are worth the same, because what the credit is a percentage
        // of is the earned income credit and not the family.
        const eligible =
          ages !== undefined && ages.some((age) => age <= bonus.maxChildAge);
        // A flat bonus is gated on the state credit being PAID rather than
        // computed from it: Connecticut's $250 goes to a filer "eligible for
        // the Connecticut earned income tax credit" with at least one
        // qualifying child, so a household with no federal credit gets neither.
        // The rate form gates itself, because a percentage of zero is zero.
        const worth = bonus.amount !== undefined ? (paid > 0 ? bonus.amount : 0) : paid * (bonus.rate ?? 0);
        credits.push({
          name: bonus.name,
          amount: eligible ? worth : 0,
          refundable: bonus.refundable,
        });
      }
    }
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

  // Form 502 line 23, and the line that decides whether a low-wage Maryland
  // household owes anything at all. It comes after the earned income credit
  // because § 10-709(c)(1) measures it against the tax left over from that one.
  let povertyLevelEligible = false;
  if (def.povertyLevelCredit) {
    const rule = def.povertyLevelCredit;
    const eligible = povertyLevelCreditEligible(
      def,
      input,
      base + additions,
      nonRefundableEarnedIncomeCredit,
      grossTax,
    );
    const earned = nonNegative(input.earnedIncome, 'earnedIncome');
    povertyLevelEligible = eligible;
    credits.push({
      name: rule.name,
      // Capped at the tax it is claimed against, so it never pays out — and the
      // county half of § 10-709(d) is capped separately against the county tax,
      // which is why eligibility and not this amount is what leaves here.
      amount: eligible
        ? Math.min(
            Math.max(0, grossTax - nonRefundableEarnedIncomeCredit),
            rule.earnedIncomeShare * earned,
          )
        : 0,
      refundable: false,
    });
  }

  if (def.childCredit) {
    // Appended after the state's structural credits rather than inserted in form
    // order, because credit position is part of this package's contract and a
    // caller indexing credits[0] should not break when a credit is added.
    credits.push({
      name: def.childCredit.name,
      amount: childCredit(def, input, taxableIncome, stateAgi),
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
  if (def.agedCredit) {
    credits.push({
      name: def.agedCredit.name,
      amount: agedCredit(def, input),
      refundable: def.agedCredit.refundable,
    });
  }

  if (def.itemizerCredit) {
    // The whole rule. One `if` on the federal election, and a taxpayer count
    // that is two only on a joint return — a qualifying surviving spouse is one
    // taxpayer, which is why `claimedFilerCount` is not used here.
    const taxpayers = input.filingStatus === 'marriedFilingJointly' ? 2 : 1;
    credits.push({
      name: def.itemizerCredit.name,
      amount:
        input.federal.deductionKind === 'itemized' ? def.itemizerCredit.perTaxpayer * taxpayers : 0,
      refundable: false,
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
  // Wisconsin's Schedule 1 and Schedule 2 credits. Order is immaterial here —
  // all three are non-refundable and the engine caps their sum at the tax, which
  // is what Form 1 does by running them down a column — but the names are not,
  // because two of the three need a figure no federal return carries.
  if (def.itemizedDeductionCredit) {
    credits.push({
      name:
        input.stateItemizedDeductions === undefined
          ? `${def.itemizedDeductionCredit.name} (assumed: no eligible itemized deductions — pass stateItemizedDeductions, which EXCLUDES ${def.itemizedDeductionCredit.excludes})`
          : def.itemizedDeductionCredit.name,
      amount: itemizedDeductionCredit(def, input, standardDeductionTaken),
      refundable: false,
    });
  }
  if (def.schoolPropertyTaxCredit) {
    credits.push({
      name:
        input.propertyTaxPaid === undefined && input.rentPaid === undefined
          ? `${def.schoolPropertyTaxCredit.name} (assumed: no property tax and no rent — pass propertyTaxPaid or rentPaid)`
          : def.schoolPropertyTaxCredit.name,
      amount: schoolPropertyTaxCredit(def, input),
      refundable: false,
    });
  }
  if (def.marriedCoupleCredit && input.filingStatus === 'marriedFilingJointly') {
    const couple = marriedCoupleCredit(def, input);
    credits.push({
      name: couple.supplied
        ? def.marriedCoupleCredit.name
        : `${def.marriedCoupleCredit.name} (assumed: one earner — pass lesserSpouseIncome, worth up to $${def.marriedCoupleCredit.max})`,
      amount: couple.amount,
      refundable: false,
    });
  }
  // § 71.05(6)(b)54m.b. "May not claim ANY credit, including any eligible
  // carryover of such credit, listed under s. 71.07" — which is every credit
  // above, refundable ones included, because the Wisconsin earned income credit
  // is s. 71.07(9e) and the homestead credit is claimed by a filer who has not
  // taken this subtraction. The credits are kept in the result with their
  // amounts zeroed rather than dropped, so a caller comparing the two passes can
  // see WHAT was given up: a credit line that silently disappears is the same
  // defect as a figure that silently changes.
  const forfeited = electRetirementExclusion && retirementExclusionElected > 0;
  if (forfeited) {
    // In place, and NOT by rebuilding the array under the same name: the first
    // version of this cleared `credits` and then spread the cleared array back
    // into itself, because `effectiveCredits` was the same reference when
    // nothing was forfeited. It lost every credit on every Wisconsin return,
    // elected or not, and the only symptom was a tax too high by the credits —
    // no error, no empty-looking code. THE RULE: a conditional rebuild of an
    // array must not alias the array it rebuilds.
    const zeroed = credits.map((credit) => ({
      ...credit,
      name: `${credit.name} — forfeited by the retirement income subtraction`,
      amount: 0,
    }));
    credits.splice(0, credits.length, ...zeroed);
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
    modifiedTaxableIncome: measures.stateModifiedAdjustedGrossIncomeLessExemptions,
    povertyLevelCreditEligible: povertyLevelEligible,
  };
}

/**
 * The state computation, having chosen every route the return offers a choice of.
 *
 * Two states make the filer compute the whole return more than once, for
 * unrelated reasons, and they compose: New Jersey chooses between a property tax
 * deduction and the flat credit that replaces it, and Wisconsin chooses between
 * a retirement income subtraction and every credit on the form. Four passes are
 * possible in principle and no state needs more than two, because no state has
 * both rules — but the nesting is written out rather than assumed, so a state
 * that acquires both gets the right answer instead of the first one.
 */
function compute(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): Computed {
  const best = computeBestPropertyTaxRoute(def, input, false);
  // Wisconsin's § 71.05(6)(b)54m election. The subtraction is worth the filer's
  // marginal rate on the retirement income it removes PLUS the sliding-scale
  // standard deduction it buys back; the credits are worth whatever they are
  // worth. Neither dominates, so the only way to get the crossover right is to
  // compute both returns, which is what the Schedule SB line 16 instructions
  // tell the filer to do. Ties go to NOT electing, because that is the return
  // that keeps the credits visible and the one a filer files by default.
  if (!def.retirementIncomeExclusionElection) return best;
  if (retirementExclusionElection(def, input) === 0) return best;
  const elected = computeBestPropertyTaxRoute(def, input, true);
  return elected.tax < best.tax ? elected : best;
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
function computeBestPropertyTaxRoute(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  electRetirementExclusion: boolean,
): Computed {
  const deducted = computeOnce(def, input, 'deduction', electRetirementExclusion);
  if (!def.propertyTaxRelief || qualifyingPropertyTax(def, input) === 0) return deducted;
  const credited = computeOnce(def, input, 'credit', electRetirementExclusion);
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
    stateModifiedTaxableIncome: computed.modifiedTaxableIncome,
    // Box 1 of the W-2, where `qualifyingWages` above is box 5. An Ohio filer
    // in both a municipality and an earned income school district is taxed on
    // two different wage figures out of the same paycheck.
    stateEarnedIncome: nonNegative(input.earnedIncome, 'earnedIncome'),
    povertyLevelCreditEligible: computed.povertyLevelCreditEligible,
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

  if (input.schoolDistrict !== undefined) {
    if (input.state !== 'OH') {
      throw new RangeError(
        `schoolDistrict applies to an Ohio return; state is ${input.state}. Ohio is the only ` +
          `state whose school districts levy an income tax of their own on the state return's ` +
          `own figures — 214 of them do, at 0.25% to 2.00% — and Pennsylvania's school district ` +
          `earned income taxes, which are collected with the municipal ones, are not modelled ` +
          `here.`,
      );
    }
    const def = ohioSchoolDistrict(input.schoolDistrict, input.year);
    // An earned income district taxes nothing else, so a missing figure is a
    // zero tax rather than an approximate one — the same refusal `city` makes.
    if (def.base === 'stateEarnedIncome' && input.earnedIncome === undefined) {
      throw new RangeError(
        `${def.name} taxes EARNED INCOME ONLY — O.R.C. § 5748.01(E)(1)(b), wages and net ` +
          `self-employment earnings to the extent included in modified adjusted gross income, ` +
          `with no deductions and no exemptions — and earnedIncome was not supplied. That is ` +
          `box 1 of the W-2, so it is NET of a 401(k) deferral, unlike the qualifyingWages an ` +
          `Ohio municipality taxes. 68 of the 214 taxing districts use this base.`,
      );
    }
    const computed = computeLocalResidentTax(def, input, stateFigures(here, input));
    const computedHigher = computeLocalResidentTax(
      def,
      higherInput,
      stateFigures(higher, higherInput),
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
 * What `unknownInputNotes` needs to describe an unrecognised key at the top
 * level — the interface it was supposed to satisfy, the field names it has, and
 * the name they are exported under so a caller can read the list from the
 * package rather than from a string.
 *
 * `federal` is in that list, and the check does not descend into it: it is
 * documented as a structural subset of `estimateFederalTax()`'s whole result, so
 * every extra key on it is expected rather than dropped. See
 * {@link PERSON_RETIREMENT_FIELDS} for the three contracts and why they get
 * three different answers.
 */
const STATE_INCOME_TAX_INPUT: UnknownKeyOptions = {
  interfaceName: 'StateIncomeTaxInput',
  knownFields: KNOWN_STATE_INPUT_FIELDS,
  listExport: 'KNOWN_STATE_INPUT_FIELDS',
};

/**
 * Reject a `retirement` split carrying a field this package does not read.
 *
 * See {@link PERSON_RETIREMENT_FIELDS} for why this is worth a throw: an unknown
 * key is dropped, the person is left with no retirement income, and every
 * exclusion and credit that reads it comes back as if the retiree had none — with
 * a plausible number at the end of it. Three occurrences over two days: Day 33's
 * `wages` for `w2Wages`, and twice on Day 34 — the status sweep, which wrote
 * `pension` for `employerPlanPension` and built eighteen households with no
 * retirement in them, and its helper, which dropped `blindOrDisabled`.
 *
 * Checked before the `rate.kind === 'none'` early return on purpose. A typo that
 * passes in Texas and throws in Maryland is a typo the caller learns about from
 * the wrong state, and the caller who tests against a no-income-tax state first
 * is the one who most needs to be told.
 */
function assertKnownRetirementFields(split: StateIncomeTaxInput['retirement']): void {
  if (split === undefined) return;
  for (const key of Object.keys(split)) {
    if (key === 'filer' || key === 'spouse') continue;
    throw new RangeError(
      `retirement.${key} is not a field of RetirementIncomeSplit. It holds \`filer\` and ` +
        `\`spouse\`, each a PersonRetirementIncome. An unrecognised key would be ignored ` +
        `silently and the return would be computed as if nobody on it had any retirement ` +
        `income, so this is an error rather than a default.`,
    );
  }
  for (const who of ['filer', 'spouse'] as const) {
    const person = split[who];
    if (person === undefined) continue;
    for (const key of Object.keys(person)) {
      if ((PERSON_RETIREMENT_FIELDS as readonly string[]).includes(key)) continue;
      // Day 34 suggested by substring both ways here, and noted that a full edit
      // distance "would catch a transposition too and has never been the shape
      // of one of these". Day 38 found one — `subtractons` for `subtractions`,
      // which shares no substring with it in either direction — so the one
      // implementation of this now lives in `nearestFields` and both guards use
      // it. Two copies of a fact that must agree is a bug with a waiting period,
      // and a near-miss rule is such a fact.
      const near = nearestFields(key, PERSON_RETIREMENT_FIELDS);
      throw new RangeError(
        `retirement.${who}.${key} is not a field of PersonRetirementIncome. ` +
          (near.length > 0
            ? `Did you mean ${near.map((f) => `\`${f}\``).join(' or ')}? `
            : `The fields are ${PERSON_RETIREMENT_FIELDS.map((f) => `\`${f}\``).join(', ')}. `) +
          `An unrecognised key would be ignored silently and this person would be ` +
          `treated as having no retirement income of that kind, which changes the tax ` +
          `rather than the shape of the answer.`,
      );
    }
  }
}

/**
 * Compute a state's individual income tax.
 *
 * @throws {RangeError} when the state or the state-year is not supported. There is
 * no silent fallback to a neighbouring year: the states that changed their rate for
 * 2026 — Georgia, Indiana, Kentucky, Mississippi, North Carolina and Utah all did —
 * are exactly the ones where a fallback would look right and be wrong.
 */
export function stateIncomeTax(
  input: StateIncomeTaxInput,
  options: StateIncomeTaxOptions = {},
): StateIncomeTaxResult {
  // Before `getStateDefinition`, which throws on an unsupported state or year,
  // and before the retirement guard: a key the engine does not read is the one
  // finding that explains every figure below it, and a typo reported from the
  // wrong complaint — or from the wrong state, which is the reason the retirement
  // guard runs ahead of the `rate.kind === 'none'` return — is a typo the caller
  // has to work backwards from.
  const inputNotes = unknownInputNotes(input, STATE_INCOME_TAX_INPUT, options.strict === true);
  assertKnownRetirementFields(input.retirement);
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
      stateAdjustedGrossIncome: 0,
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
      notes: [...inputNotes, ...relevantNotes(def, input)],
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
  // IRC § 151(b)'s spouse, and the two ways a separate return can go wrong about
  // one. The discipline is the federal package's: **a note is owed when an input
  // was DISCARDED, or when an unanswerable question was answered by a default —
  // not merely when a rule exists.** So nothing is said on a joint return, on a
  // single return, or to a caller in a state where the answer does not turn on
  // it, and this block is silent on every return but a separate one.
  if (input.filingStatus === 'marriedFilingSeparately' && def.exemption) {
    const rule = def.exemption.separateReturnSpouse;
    const told = input.spouseHasNoGrossIncomeAndIsNotADependent;
    if (rule.spouse === 'claimed' && told === undefined) {
      // Priced by running this filer's own return again with the answer, which
      // is the MOST it could be worth, rather than by quoting a table figure
      // that Maryland's staircase would make wrong for most filers.
      const withSpouse = compute(def, {
        ...input,
        spouseHasNoGrossIncomeAndIsNotADependent: true,
      });
      const worth = roundCents(here.tax - withSpouse.tax);
      dynamic.push(
        `${def.name} lets a SEPARATE return claim an exemption for the spouse where the spouse ` +
          `had no gross income at all and is not another taxpayer's dependent — ${rule.cite}. ` +
          `Nothing else on a return implies that fact, so it was assumed FALSE here, which is the ` +
          `answer that does not flatter the filer. Pass ` +
          `\`spouseHasNoGrossIncomeAndIsNotADependent: true\` if it holds; it is worth ` +
          `$${worth.toFixed(2)} of ${def.name} tax on this return.`,
      );
    }
    if (rule.spouse !== 'claimed' && told === true) {
      dynamic.push(
        rule.spouse === 'noFilerExemption'
          ? `\`spouseHasNoGrossIncomeAndIsNotADependent\` was ignored: ${def.name} gives no personal ` +
            `exemption to the filer or the spouse in any status, so there is nothing for IRC ` +
            `§ 151(b)'s spouse to be added to — ${rule.cite}.`
          : rule.spouse === 'notClaimed'
            ? `\`spouseHasNoGrossIncomeAndIsNotADependent\` was ignored: ${def.name} does not allow ` +
              `it. ${rule.cite}`
            : `\`spouseHasNoGrossIncomeAndIsNotADependent\` was ignored, and the reason is that ` +
              `NOBODY HAS READ THE PROVISION, not that ${def.name} says no. This package counts ` +
              `nobody, which is the answer that does not flatter the filer and may be too much ` +
              `tax. ${rule.cite}`,
      );
    }
    // The second claim, kept separate from the first on purpose. A state that has
    // said the spouse is an exemption has not thereby said the spouse is an AGED
    // exemption, and three of the four have not been read on it.
    const agedSupplied =
      input.spouseAge !== undefined || nonNegative(input.blindOrDisabled, 'blindOrDisabled') > 1;
    // Indiana's means-tested $500, which is the THIRD claim and the one that
    // points the other way. Said only where the state's aged additions DO follow
    // the spouse, because that is the caller who has every reason to expect this
    // figure to follow them too.
    if (
      rule.agedAndBlind === 'follows' &&
      rule.lowIncomeSenior !== undefined &&
      rule.lowIncomeSenior !== 'follows' &&
      input.spouseAge !== undefined
    ) {
      dynamic.push(
        `${def.name}'s aged additions DO follow the § 151(b) spouse on this return, and its ` +
          `means-tested age exemption does NOT — a third claim with its own provision, not a ` +
          `corollary of the second. ${rule.lowIncomeSeniorCite ?? rule.agedAndBlindCite ?? rule.cite}`,
      );
    }
    if (rule.spouse === 'claimed' && rule.agedAndBlind !== 'follows' && agedSupplied) {
      dynamic.push(
        `${def.name} counts the spouse for the base exemption on this return, but whether its ` +
          `additional exemptions for age and blindness follow that spouse is a SEPARATE question, ` +
          `and here ${
            rule.agedAndBlind === 'doesNotFollow'
              ? 'THE STATE HAS BEEN READ AND THE ANSWER IS NO'
              : 'IT IS OPEN — nobody has read the provision'
          }: ${rule.agedAndBlindCite ?? rule.cite} So \`spouseAge\` and the second ` +
          `\`blindOrDisabled\` were not counted here${
            rule.agedAndBlind === 'doesNotFollow'
              ? ', and that is the state\'s answer rather than this package\'s silence.'
              : ', and this return may be too high.'
          }`,
      );
    }
  }
  // The out-of-state municipal addition, where the caller's one figure cannot
  // express what the state's own sentence asks for. Five states do "the same
  // thing" and each asks for something slightly different of the number, so the
  // note is per state and fires only where something was assumed.
  if (def.outOfStateMunicipalInterestAddition) {
    const rule = def.outOfStateMunicipalInterestAddition;
    const supplied = nonNegative(input.outOfStateMunicipalInterest, 'outOfStateMunicipalInterest');
    if (supplied > 0 && rule.acquiredAfterYear !== undefined) {
      dynamic.push(
        `${def.name} adds back this interest only on obligations the taxpayer ACQUIRED after ` +
          `31 December ${rule.acquiredAfterYear}, and a trade date is on no line of any return — so the ` +
          `$${supplied.toLocaleString('en-US')} supplied was added back in full. An obligation held ` +
          `since before then is outside ${def.name}'s tax permanently, so subtract it from the figure ` +
          `you pass. ${rule.cite}`,
      );
    }
    if (supplied > 0 && rule.netOfExpenses) {
      dynamic.push(
        `${def.name}'s addition is the interest LESS the related expenses that federal adjusted ` +
          `gross income did not deduct, and those expenses are on no line this package is given — so ` +
          `the $${supplied.toLocaleString('en-US')} supplied was taken as already net. ${rule.cite}`,
      );
    }
    if (supplied > 0 && rule.measure === 'interestAndDividends') {
      dynamic.push(
        `${def.name} reaches interest AND DIVIDENDS on other states' obligations, so a bond fund's ` +
          `exempt-interest dividends belong in this figure. Two of the five states in this package ` +
          `that make this addition reach only the coupon, so a figure built for one of those is too ` +
          `low here. ${rule.cite}`,
      );
    }
  }
  // The age deduction's own separate-return questions, which are NOT the § 151(b)
  // ones above: this is a deduction attached to a person's birth date, so it
  // cannot borrow the exemption's answer, and the figure it is missing is an
  // AMOUNT rather than a yes or no.
  if (def.ageDeduction) {
    const rule = def.ageDeduction.separateReturn;
    if (ageDeductionNeedsSpouseIncome(def, input)) {
      // Priced at a spouse with NO income, which is the most the deduction could
      // be worth on this return, rather than at a table figure.
      const withSpouse = compute(def, { ...input, spouseAdjustedFederalAdjustedGrossIncome: 0 });
      const worth = roundCents(here.tax - withSpouse.tax);
      dynamic.push(
        `${def.ageDeduction.name} was NOT allowed on this separate return, and the reason is a ` +
          `figure that lives on the other return: ${rule.incomeMeasureCite} Nothing here can stand ` +
          `in for it — testing the joint threshold against one spouse's income would give a ` +
          `separate filer a larger deduction than either a single or a joint return, which is what ` +
          `this package did until v0.29.0. Pass ` +
          `\`spouseAdjustedFederalAdjustedGrossIncome\` (the spouse's federal AGI less the Social ` +
          `Security taxed inside it); it is worth up to $${worth.toFixed(2)} of ${def.name} tax on ` +
          `this return.`,
      );
    }
    if (
      input.spouseClaimsAgeDeduction === true &&
      !(
        input.filingStatus === 'marriedFilingSeparately' &&
        rule.bothClaiming === 'halfOfJointDeduction' &&
        spouseIsIncomeTested(def.ageDeduction, def.year, input)
      )
    ) {
      dynamic.push(
        `\`spouseClaimsAgeDeduction\` was ignored: it divides a JOINT ${def.ageDeduction.name} in ` +
          `half between two separate returns, so it needs a separate return and a spouse in the ` +
          `INCOME-TESTED age group. ${rule.bothClaimingCite}`,
      );
    }
    if (
      input.spouseAdjustedFederalAdjustedGrossIncome !== undefined &&
      input.filingStatus !== 'marriedFilingSeparately'
    ) {
      dynamic.push(
        `\`spouseAdjustedFederalAdjustedGrossIncome\` was ignored: ${def.ageDeduction.name} reads ` +
          `the other return's income only on a SEPARATE return, where the two spouses' figures are ` +
          `on two returns. A joint return already contains both. ${rule.incomeMeasureCite}`,
      );
    }
  }
  // A qualifying surviving spouse has no living spouse, so every spouse-shaped
  // field on such a return describes nobody and is dropped. Saying so is the
  // point: v0.27.0 found fourteen places that had been READING these fields,
  // and each one took a caller who supplied them — so the caller who is about
  // to be surprised is exactly the caller who was wrong before.
  //
  // Dropping them errs towards more tax in every case, which is why it is safe
  // to do silently and still worth not doing silently.
  if (input.filingStatus === 'qualifyingSurvivingSpouse') {
    const supplied: string[] = [];
    if (input.spouseAge !== undefined) supplied.push('spouseAge');
    if (input.retirement?.spouse !== undefined) supplied.push('retirement.spouse');
    if ((input.blindOrDisabled ?? 0) > 1) supplied.push('blindOrDisabled above 1');
    if (supplied.length > 0) {
      dynamic.push(
        `Filing status is qualifyingSurvivingSpouse, which is a ONE-PERSON return: § 2(a) gives ` +
          `the status to an unmarried filer with a dependent child in the two years AFTER the ` +
          `year of death, and the year of death itself is a joint return. So ${supplied.join(' and ')} ` +
          `describe${supplied.length === 1 ? 's' : ''} nobody and ${supplied.length === 1 ? 'was' : 'were'} ` +
          `ignored here. Amounts a state PUBLISHES for the status are unaffected — ` +
          `${def.name} still uses whichever column its own form puts this status in — but nothing ` +
          `that counts PEOPLE can count two. If the figure belongs to the surviving filer (a ` +
          `survivor annuity, for instance, which is the survivor's own income), pass it under ` +
          `\`retirement.filer\`.`,
      );
    }
  }
  // Pennsylvania's separate return, which is the mirror image of the widow's
  // and the reason `forgivenessClaimants` returns a pair. The bigger allowance
  // is withheld until the caller supplies the income that goes with it, so the
  // note has to say what is being withheld and what it is worth — priced by
  // running this filer's own return again on Table 2 with a spouse of zero,
  // which is the MOST it could be worth.
  if (def.forgiveness && forgivenessClaimants(input).assumedSingle) {
    const rule = def.forgiveness;
    const best = compute(def, { ...input, pennsylvaniaSpouseEligibilityIncome: 0 });
    const most = roundCents(here.tax - best.tax);
    dynamic.push(
      `${def.name} has no separate-return ${rule.name.toLowerCase()} table. PA-40 Schedule SP's ` +
        `three claimant boxes are unmarried, separated and married, and a married claimant who ` +
        `files separately is a MARRIED claimant: allowance ` +
        `$${(rule.base * 2).toLocaleString('en-US')} rather than ` +
        `$${rule.base.toLocaleString('en-US')}, against the JOINT eligibility income of both ` +
        `spouses — "married claimants are not dependents of one another for Tax Forgiveness ` +
        `purposes, even when one spouse does not have any Eligibility Income." The spouse's ` +
        `figure is on no line of this return, so this result keeps the smaller allowance and ` +
        `this filer's own income, which is the SAFE direction and is too much tax for most ` +
        `separate filers: up to $${most.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ` +
        `here. Supply pennsylvaniaSpouseEligibilityIncome — 0 is a real answer, and it is the ` +
        `answer for a spouse with no income — or set separatedFromSpouse if this filer lived ` +
        `apart from their spouse for the whole of the last six months of the year, which ticks ` +
        `the Unmarried oval on line 19a and really is one claimant.`,
    );
  }
  // Indiana's child exemption is the first rule here that a caller can lose by
  // supplying the *weaker* of two fields that both describe dependents. A count
  // is accepted, so nothing fails; the exemption is simply not there.
  if (
    def.exemption?.perQualifyingChild !== undefined &&
    input.dependentAges === undefined &&
    (input.dependents ?? 0) > 0
  ) {
    const each = def.exemption.perQualifyingChild;
    // Priced at this filer's own marginal rate — state plus county — rather than
    // at the statutory rate, because in Indiana two fifths of it is the county's.
    const combined =
      higher.tax - here.tax + localTaxes.reduce((sum, local) => sum + local.marginalRate, 0);
    const worth = roundCents(each * (input.dependents ?? 0) * combined);
    dynamic.push(
      `${def.name} gives a dependent CHILD $${each.toLocaleString('en-US')} of exemption on top of ` +
        `the $${def.exemption.perDependent.toLocaleString('en-US')} every dependent gets, and ` +
        `dependentAges was not supplied, so none of it was claimed. A count cannot tell a child ` +
        `from a dependent parent and the two differ by that $${each.toLocaleString('en-US')}. For ` +
        `this return, claiming all ${input.dependents} as children would be worth about ` +
        `$${worth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ` +
        `of state and county tax — supply dependentAges.`,
    );
  }
  if (def.povertyLevelCredit && input.earnedIncome === undefined) {
    const rule = def.povertyLevelCredit;
    dynamic.push(
      `${def.name}'s ${rule.name} is ${(rule.earnedIncomeShare * 100).toFixed(0)}% of EARNED income ` +
        `against the state tax and the county's own rate against the county tax, and earnedIncome ` +
        `was not supplied, so both halves were computed as zero. Between them they can forgive the ` +
        `WHOLE bill for a filer under the federal poverty guideline — supply earnedIncome, or this ` +
        `return is too high for exactly the household the credit exists for.`,
    );
  }
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
    // Quoted against the same count the deduction itself now uses, so the note
    // and the line it is about cannot drift apart.
    const worth = rule.perFilerCap * livingFilerCount(input.filingStatus);
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
  if (
    def.retirementIncomeExclusion &&
    input.retirement === undefined &&
    input.retirementIncome === undefined
  ) {
    const rule = def.retirementIncomeExclusion;
    const ages = [input.filerAge, input.spouseAge].slice(0, livingFilerCount(input.filingStatus));
    if (ages.some((age) => age !== undefined && age >= rule.minimumAge)) {
      // Priced by running this filer's own return again with every dollar of it
      // treated as qualifying income — the most the exclusion could be worth
      // here. The state has no way to tell what a federal AGI is made of, so the
      // honest report is the size of the question, not a guess at its answer.
      const best = compute(def, {
        ...input,
        retirement: {
          filer: { investmentIncome: here.conformityAmount },
          spouse: { investmentIncome: here.conformityAmount },
        },
      });
      const most = roundCents(here.tax - best.tax);
      if (most > 0) {
        dynamic.push(
          `No \`retirement\` was supplied, so none of this income was treated as qualifying for ` +
            `the ${rule.name} and the return assumes the worst case. ${def.name} measures the ` +
            `exclusion on the CHARACTER of the income — interest, dividends, net capital gain, ` +
            `rents, royalties, alimony, pensions and taxable IRA distributions all qualify in ` +
            `full, and at most $${rule.earnedIncomeCap.toLocaleString('en-US')} of a person's ` +
            `wages — so a filer with $60,000 of dividends and one with $60,000 of wages owe ` +
            `different tax on the same income. For this return the exclusion is worth up to ` +
            `$${most.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        );
      }
    }
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
  if (input.state === 'OH' && input.schoolDistrict === undefined) {
    dynamic.push(
      'No schoolDistrict was supplied. 214 of Ohio\u2019s school districts levy an income tax of ' +
        'their own at 0.25% to 2.00%, on a separate SD 100 return and on top of the state and ' +
        'municipal taxes above — 146 on modified AGI less exemptions, which adds the business ' +
        'income deduction back, and 68 on earned income alone with no deductions or exemptions ' +
        'at all. Most Ohioans live in a district that levies nothing and owe none of it; pass ' +
        'the four-digit district number if this filer does. Ohio\u2019s own Finder resolves an ' +
        'address to a district and this package cannot.',
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
    stateAdjustedGrossIncome: roundCents(here.stateAgi),
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
    // The sum of the figures this result reports, not of the unrounded ones
    // behind them. They are separate lines on a real return — Maryland's county
    // tax is line 20 and the total line 21 — and each is charged by a different
    // government, so a caller who adds `tax` to `localTaxes[].tax` has to get
    // this number. Rounding the sum instead differs by a cent wherever a
    // component lands on a half cent, as Maryland's centenarian subtraction
    // does at $120,000, and "the parts do not add up" is the one arithmetic
    // complaint a tax library cannot survive.
    totalTax: roundCents(roundCents(here.tax) + localTax),
    totalMarginalRate: rate(stateMarginal + localMarginal),
    provisional: def.status === 'provisional',
    notes: [...inputNotes, ...dynamic, ...relevantNotes(def, input)],
    citations: def.citations,
  };
}

export { getStateDefinition, isSupported, stateName, supportedYears };
export type { FilingStatus, StateCode };
