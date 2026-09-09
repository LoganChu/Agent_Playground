/**
 * The generic local income tax computation.
 *
 * Like the state engine, one function serves every locality; the differences live
 * in {@link LocalIncomeTaxDefinition} data. The one thing this cannot share with
 * the state engine is its input: a local tax is computed from figures the state
 * return produced, so it takes the state's intermediate results rather than the
 * caller's.
 */
import { applyBrackets, dependentCount, rateForIncome, roundCents } from '../engine-core.js';
import { filerCount } from '../definition.js';
import type { LocalBase, LocalIncomeTaxDefinition } from './definition.js';
import type {
  BracketDetail,
  CreditDetail,
  LocalIncomeTaxResult,
  StateIncomeTaxInput,
} from '../types.js';

/** Round half away from zero, which is what a tax form means by "round". */
export function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value) + Number.EPSILON);
}

/**
 * The figures a local tax can start from. Supplied by the state engine after it
 * has finished, because every one of them is a line on the state return.
 */
export interface StateFigures {
  readonly stateTaxableIncome: number;
  readonly stateAdjustedGrossIncome: number;
  /**
   * State tax after non-refundable credits and before refundable ones — the
   * figure a "percentage of the state tax" locality actually charges against.
   * Floored at zero, which is why a Yonkers surcharge can never be negative.
   */
  readonly stateNetTax: number;
  /**
   * Income as a *city* measures it, before the city's own exemptions — the base
   * of every Michigan city income tax, and the only figure here that is not a
   * line on the state return. Supplied by the caller through
   * {@link StateIncomeTaxInput.cityIncome}, or derived from federal AGI less
   * retirement income when they did not supply it.
   */
  readonly cityIncome: number;
}

function baseAmount(base: LocalBase, figures: StateFigures): number {
  switch (base) {
    case 'stateTaxableIncome':
      return figures.stateTaxableIncome;
    case 'stateAdjustedGrossIncome':
      return figures.stateAdjustedGrossIncome;
    case 'stateNetTax':
      return figures.stateNetTax;
    case 'cityIncome':
      return figures.cityIncome;
  }
}

/**
 * The locality's own exemptions — Michigan's, and nothing else's.
 *
 * One per filer, one for a spouse on a joint return, one per dependent, at the
 * flat amount the city's ordinance sets. Floored against the base by the caller,
 * because a city taxable income cannot be negative and a negative one would hand
 * a low-income filer a refund the city does not pay.
 */
export function localExemption(
  def: LocalIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): number {
  if (def.exemptionAmount === undefined) return 0;
  return def.exemptionAmount * (filerCount(input.filingStatus) + dependentCount(input));
}

/** The amount of a step-function credit at a given income. */
function stepAmount(steps: readonly { upTo: number; amount: number }[], income: number): number {
  for (const step of steps) {
    if (income <= step.upTo) return step.amount;
  }
  return 0;
}

/**
 * New York City's household credit.
 *
 * A single filer gets a flat amount. Everyone else gets a per-person amount times
 * the people counted on the return — the filer, the spouse on a joint return, and
 * each dependent — so a childless couple gets twice what the table's headline
 * figure suggests. Married filing separately takes half the per-person amount
 * **rounded to the nearest dollar**, which is how the instructions' separate
 * table of $15 / $13 / $8 / $5 is generated from the joint table's
 * $30 / $25 / $15 / $10.
 */
export function localHouseholdCredit(
  def: LocalIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  federalAgi: number,
): number {
  const rule = def.householdCredit;
  if (!rule) return 0;
  const status = input.filingStatus;
  if (status === 'single') return stepAmount(rule.single, federalAgi);
  const people = filerCount(status) + dependentCount(input);
  const perPerson = stepAmount(rule.perPerson, federalAgi);
  const amount =
    rule.halvedForSeparate && status === 'marriedFilingSeparately'
      ? roundHalfUp(perPerson / 2)
      : perPerson;
  return amount * people;
}

/**
 * The rate reduction amount of New York City's school tax credit.
 *
 * The instructions print a base column — $21 single, $37 joint, $25 head of
 * household — and all three are `round(lowerRate x threshold)`: 0.171% of
 * $12,000 is $20.52, of $21,600 is $36.94, of $14,400 is $24.62. This package
 * derives the base rather than transcribing it, and rounds it the way the form
 * does, so the answer matches the worksheet a filer fills in.
 *
 * The rounding is not cosmetic. It makes the credit jump 48 cents at the
 * threshold — $20.52 at exactly $12,000 of city taxable income and $21.00 one
 * dollar later — and a model that uses the unrounded base is 48 cents low for
 * every single filer above it.
 */
export function schoolTaxCreditRateReduction(
  def: LocalIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  localTaxableIncome: number,
): number {
  const rule = def.schoolTaxCredit;
  if (!rule) return 0;
  const { lowerRate, upperRate, threshold, incomeLimit } = rule.rateReduction;
  if (localTaxableIncome <= 0 || localTaxableIncome > incomeLimit) return 0;
  const top = threshold[input.filingStatus];
  if (localTaxableIncome <= top) return lowerRate * localTaxableIncome;
  return roundHalfUp(lowerRate * top) + upperRate * (localTaxableIncome - top);
}

/** The fixed amount of the school tax credit — a flat figure under a cliff. */
export function schoolTaxCreditFixed(
  def: LocalIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  federalAgi: number,
): number {
  const rule = def.schoolTaxCredit;
  if (!rule) return 0;
  if (federalAgi > rule.fixed.incomeLimit) return 0;
  return rule.fixed.amounts[input.filingStatus];
}

/**
 * The sliding match of New York City's earned income credit.
 *
 * The published rate table is generated by this: start at `topMatch`, and shed
 * `stepDown` percentage points at `reductionRate` per dollar across each window,
 * so each window is `stepDown / reductionRate` wide and the schedule is
 * continuous at every join. The worksheet's own instruction to round the
 * reduction to four decimal places is applied here, because without it the match
 * at $21,000 of New York AGI is 0.17998 rather than the 0.18 the form gives.
 */
export function slidingEarnedIncomeMatch(def: LocalIncomeTaxDefinition, stateAgi: number): number {
  const rule = def.earnedIncomeCredit;
  if (!rule) return 0;
  const width = rule.stepDown / rule.reductionRate;
  const scale = 10 ** rule.matchDecimals;
  let match = rule.topMatch;
  for (const start of rule.windowStarts) {
    if (stateAgi >= start + width) {
      match -= rule.stepDown;
      continue;
    }
    if (stateAgi >= start) {
      // The worksheet subtracts the dollar below the window's start, then
      // rounds; both details are load-bearing against the published table.
      const reduction = rule.reductionRate * (stateAgi - (start - 1));
      match -= Math.round(reduction * scale) / scale;
    }
    break;
  }
  // The worksheet carries four decimal places throughout, so the match it
  // produces is a four-place decimal and not the binary residue of subtracting
  // several of them.
  return Math.max(0, Math.round(match * scale) / scale);
}

/**
 * The single rate a locality's earned income credit is computed from.
 *
 * Trivial for the twenty-two Maryland jurisdictions with one rate and a judgment
 * call for the two without. A marginal-rate county (Anne Arundel) uses its
 * lowest rate; a rate-by-bracket county (Frederick) uses the rate its bracket
 * selects, because that rate *is* the county's rate for this filer. Both
 * readings follow PolicyEngine-US, and the locality's notes say so — see
 * `localities/maryland.ts`.
 */
export function localApplicableRate(
  def: LocalIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  base: number,
): number {
  switch (def.rate.kind) {
    case 'flat':
      return def.rate.rate;
    case 'brackets':
      return def.rate.byStatus[input.filingStatus][0]?.rate ?? 0;
    case 'rateByBracket':
      return rateForIncome(def.rate.byStatus[input.filingStatus], base);
    /* c8 ignore next 2 -- no locality has a 'none' rate. */
    default:
      return 0;
  }
}

/**
 * Compute one locality's resident income tax from the finished state figures.
 *
 * Credit order is part of the contract, and it follows the return: the
 * non-refundable household credit first, then the refundable school tax credit in
 * its two published parts, then the refundable earned income credit.
 */
export function computeLocalResidentTax(
  def: LocalIncomeTaxDefinition,
  input: StateIncomeTaxInput,
  figures: StateFigures,
  /**
   * Tax already paid to a peer locality for the same year, for a locality that
   * credits it — Michigan's cities. The cap is applied here rather than by the
   * caller, because the cap is this locality's own nonresident rate and only
   * this locality knows it.
   */
  peerLocality?: { readonly name: string; readonly tax: number; readonly taxedIncome: number },
): { baseAmount: number; taxBeforeCredits: number; brackets: BracketDetail[]; credits: CreditDetail[]; tax: number } {
  const base = Math.max(0, baseAmount(def.base, figures) - localExemption(def, input));

  let taxBeforeCredits = 0;
  let brackets: BracketDetail[] = [];
  if (def.rate.kind === 'flat') {
    taxBeforeCredits = base * def.rate.rate;
    if (base > 0) brackets = [{ rate: def.rate.rate, incomeInBracket: base, tax: taxBeforeCredits }];
  } else if (def.rate.kind === 'brackets') {
    const walked = applyBrackets(base, def.rate.byStatus[input.filingStatus]);
    taxBeforeCredits = walked.tax;
    brackets = walked.detail;
  } else if (def.rate.kind === 'rateByBracket') {
    // Frederick County: the bracket picks the rate and the rate applies to
    // everything. One band in the detail, not one per threshold crossed, because
    // that is what actually happened.
    const rate = rateForIncome(def.rate.byStatus[input.filingStatus], base);
    taxBeforeCredits = base * rate;
    if (base > 0) brackets = [{ rate, incomeInBracket: base, tax: taxBeforeCredits }];
  }

  const federalAgi = input.federal.adjustedGrossIncome;
  const credits: CreditDetail[] = [];
  if (def.householdCredit) {
    credits.push({
      name: def.householdCredit.name,
      amount: localHouseholdCredit(def, input, federalAgi),
      refundable: false,
    });
  }
  if (def.schoolTaxCredit) {
    credits.push({
      name: `${def.schoolTaxCredit.name} (fixed amount)`,
      amount: schoolTaxCreditFixed(def, input, federalAgi),
      refundable: true,
    });
    credits.push({
      name: `${def.schoolTaxCredit.name} (rate reduction amount)`,
      amount: schoolTaxCreditRateReduction(def, input, figures.stateTaxableIncome),
      refundable: true,
    });
  }
  if (def.earnedIncomeCredit) {
    const federalCredit = input.federal.earnedIncomeCredit ?? 0;
    credits.push({
      name: def.earnedIncomeCredit.name,
      amount: slidingEarnedIncomeMatch(def, figures.stateAdjustedGrossIncome) * federalCredit,
      refundable: true,
    });
  }
  if (def.earnedIncomeCreditRateMultiple !== undefined) {
    // § 10-704(d): the lesser of the county tax and ten times the county rate
    // times the federal credit. Non-refundable, and the cap is what makes it so:
    // a Maryland county never pays out more earned income credit than it charged
    // in tax, which is why the state's refundable half exists.
    const federalCredit = input.federal.earnedIncomeCredit ?? 0;
    const match = def.earnedIncomeCreditRateMultiple * localApplicableRate(def, input, base);
    credits.push({
      name: 'Local earned income credit',
      amount: Math.min(match * federalCredit, taxBeforeCredits),
      refundable: false,
    });
  }
  if (def.creditsTaxPaidToPeerLocality && peerLocality && peerLocality.tax > 0) {
    // MCL 141.601 et seq., as every city's own instructions state it: the credit
    // is the tax paid to the other city, but never more than this city's own
    // nonresident rate applied to the income that other city taxed. The cap is
    // what makes the credit incomplete in exactly one direction — a resident of
    // a 1% city commuting into a 2.4% one — and the arithmetic has to see both
    // rates to show it.
    const cap = (def.nonresidentEarningsRate ?? 0) * peerLocality.taxedIncome;
    credits.push({
      name: `Credit for income tax paid to ${peerLocality.name}`,
      amount: Math.min(peerLocality.tax, cap),
      refundable: false,
    });
  }

  const nonRefundable = credits.filter((c) => !c.refundable).reduce((s, c) => s + c.amount, 0);
  const refundable = credits.filter((c) => c.refundable).reduce((s, c) => s + c.amount, 0);
  const tax = Math.max(0, taxBeforeCredits - nonRefundable) - refundable;

  return { baseAmount: base, taxBeforeCredits, brackets, credits, tax };
}

/** Present one locality's resident tax, with the marginal rate already measured. */
export function localResidentResult(
  def: LocalIncomeTaxDefinition,
  computed: ReturnType<typeof computeLocalResidentTax>,
  marginalRate: number,
): LocalIncomeTaxResult {
  return {
    locality: def.code,
    localityName: def.name,
    basis: 'resident',
    base: def.base,
    baseAmount: roundCents(computed.baseAmount),
    taxBeforeCredits: roundCents(computed.taxBeforeCredits),
    credits: computed.credits.map((c) => ({ ...c, amount: roundCents(c.amount) })),
    tax: roundCents(computed.tax),
    brackets: computed.brackets.map((b) => ({
      rate: b.rate,
      incomeInBracket: roundCents(b.incomeInBracket),
      tax: roundCents(b.tax),
    })),
    marginalRate: roundCents(marginalRate * 100) / 100,
    provisional: def.status === 'provisional',
    notes: def.notes,
    citations: def.citations,
  };
}

/**
 * The tax a locality charges someone who works there but lives somewhere else.
 *
 * Its marginal rate is zero by construction: the base is a wage figure supplied
 * by the caller, and the engine's one-dollar experiment adds its dollar to the
 * state's income measure, not to this. A dollar more of Yonkers-source wages does
 * cost 0.5 cents — that is the rate, and it is in the result.
 */
/**
 * The city-source earnings a nonresident is actually taxed on, after the
 * locality's own exemptions.
 *
 * Separate from {@link localNonresidentEarningsResult} because the home city's
 * credit is capped against *this* figure, and the two computations have to agree
 * about it to the cent.
 */
export function nonresidentTaxableEarnings(
  def: LocalIncomeTaxDefinition,
  earnings: number,
  input?: StateIncomeTaxInput,
): number {
  return Math.max(0, earnings - (input ? localExemption(def, input) : 0));
}

export function localNonresidentEarningsResult(
  def: LocalIncomeTaxDefinition,
  earnings: number,
  /**
   * Supplied for a locality whose exemptions a nonresident may also claim.
   * Michigan's cities allow them against city-source income; Yonkers has none,
   * which is why this is optional rather than always computed.
   */
  input?: StateIncomeTaxInput,
): LocalIncomeTaxResult {
  const rate = def.nonresidentEarningsRate ?? 0;
  const taxable = nonresidentTaxableEarnings(def, earnings, input);
  const tax = taxable * rate;
  return {
    locality: def.code,
    localityName: def.name,
    basis: 'nonresidentEarnings',
    base: 'wages',
    baseAmount: roundCents(taxable),
    taxBeforeCredits: roundCents(tax),
    credits: [],
    tax: roundCents(tax),
    brackets: taxable > 0 ? [{ rate, incomeInBracket: roundCents(taxable), tax: roundCents(tax) }] : [],
    marginalRate: 0,
    provisional: def.status === 'provisional',
    notes: def.notes,
    citations: def.citations,
  };
}
