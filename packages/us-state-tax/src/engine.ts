/**
 * The generic state income tax computation.
 *
 * One function serves every supported state. The differences between states live
 * in {@link StateIncomeTaxDefinition} data, not in branches here, which is what
 * makes the conformity choice visible rather than buried.
 */
import { filerCount } from './definition.js';
import type { StateIncomeTaxDefinition } from './definition.js';
import { getStateDefinition, isSupported, stateName, supportedYears } from './states/index.js';
import type {
  Bracket,
  BracketDetail,
  CreditDetail,
  FilingStatus,
  StateCode,
  StateIncomeTaxInput,
  StateIncomeTaxResult,
  SurtaxDetail,
} from './types.js';

export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function nonNegative(value: number | undefined, label: string): number {
  const v = value ?? 0;
  if (!Number.isFinite(v)) throw new TypeError(`${label} must be a finite number`);
  if (v < 0) throw new RangeError(`${label} must not be negative`);
  return v;
}

/** Walk a bracket table, returning the tax and the per-band detail. */
export function applyBrackets(
  taxableIncome: number,
  brackets: readonly Bracket[],
): { tax: number; detail: BracketDetail[] } {
  let remaining = Math.max(0, taxableIncome);
  let floor = 0;
  let tax = 0;
  const detail: BracketDetail[] = [];
  for (const band of brackets) {
    if (remaining <= 0) break;
    const width = band.upTo - floor;
    const inBand = Math.min(remaining, width);
    const bandTax = inBand * band.rate;
    if (inBand > 0) detail.push({ rate: band.rate, incomeInBracket: inBand, tax: bandTax });
    tax += bandTax;
    remaining -= inBand;
    floor = band.upTo;
  }
  return { tax, detail };
}

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
      if (input.pennsylvaniaTaxableIncome === undefined) {
        throw new RangeError(
          `${def.code} defines its own tax base and does not start from any federal figure. ` +
            `Supply pennsylvaniaTaxableIncome — Pennsylvania taxes eight classes of income ` +
            `with no standard deduction, no personal exemption, and no deduction for 401(k) ` +
            `elective deferrals, so federal AGI is not a usable substitute.`,
        );
      }
      return nonNegative(input.pennsylvaniaTaxableIncome, 'pennsylvaniaTaxableIncome');
    }
  }
}

function stateDeduction(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): number {
  switch (def.deduction.kind) {
    case 'none':
      return 0;
    case 'federal':
      return input.federal.deduction;
    case 'table':
      return def.deduction.amounts[input.filingStatus];
  }
}

function stateExemptions(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): number {
  const rule = def.exemption;
  if (!rule) return 0;
  const cliff = rule.cliff?.[input.filingStatus];
  if (cliff !== undefined && input.federal.adjustedGrossIncome > cliff) return 0;
  return rule.perFiler[input.filingStatus] + rule.perDependent * (input.dependents ?? 0);
}

function exemptionCredit(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): number {
  const rule = def.exemptionCredit;
  if (!rule) return 0;
  const status = input.filingStatus;
  const exemptions = filerCount(status) + (input.dependents ?? 0);
  const full = rule.perFiler[status] + rule.perDependent * (input.dependents ?? 0);
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
  const exemptionBase = rule.personalExemption * (input.dependents ?? 0);
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
  const allowance = rule.base * filerCount(input.filingStatus) + rule.perDependent * (input.dependents ?? 0);
  const excess = eligibility - allowance;
  const steps = excess <= 0 ? 0 : Math.ceil(excess / rule.increment);
  const share = Math.max(0, 1 - steps * rule.reductionPerIncrement);
  return tax * share;
}

interface Computed {
  conformityAmount: number;
  addBacks: { name: string; amount: number }[];
  additions: number;
  subtractions: number;
  deduction: number;
  exemptions: number;
  taxableIncome: number;
  taxBeforeCredits: number;
  brackets: BracketDetail[];
  surtaxes: SurtaxDetail[];
  credits: CreditDetail[];
  tax: number;
}

function compute(def: StateIncomeTaxDefinition, input: StateIncomeTaxInput): Computed {
  const base = conformityAmount(def, input);
  const back = addBacks(def, input);
  const additions =
    nonNegative(input.additions, 'additions') + back.reduce((s, a) => s + a.amount, 0);
  const subtractions = nonNegative(input.subtractions, 'subtractions');
  const stateAgi = Math.max(0, base + additions - subtractions);

  const deduction = stateDeduction(def, input);
  const exemptions = stateExemptions(def, input);
  const taxableIncome = Math.max(0, stateAgi - deduction - exemptions);

  let taxBeforeCredits = 0;
  let brackets: BracketDetail[] = [];
  if (def.rate.kind === 'flat') {
    taxBeforeCredits = taxableIncome * def.rate.rate;
    if (taxableIncome > 0) {
      brackets = [{ rate: def.rate.rate, incomeInBracket: taxableIncome, tax: taxBeforeCredits }];
    }
  } else if (def.rate.kind === 'brackets') {
    const walked = applyBrackets(taxableIncome, def.rate.byStatus[input.filingStatus]);
    taxBeforeCredits = walked.tax;
    brackets = walked.detail;
  }

  const surtaxes: SurtaxDetail[] = [];
  if (def.surtax) {
    const amount = applyBrackets(taxableIncome, def.surtax.brackets).tax;
    if (amount > 0) surtaxes.push({ name: def.surtax.name, amount });
  }

  const credits: CreditDetail[] = [];
  if (def.exemptionCredit) {
    credits.push({
      name: def.exemptionCredit.name,
      amount: exemptionCredit(def, input),
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

  const grossTax = taxBeforeCredits + surtaxes.reduce((s, x) => s + x.amount, 0);
  if (def.forgiveness) {
    credits.push({
      name: def.forgiveness.name,
      amount: forgivenessCredit(def, input, grossTax),
      refundable: false,
    });
  }
  const nonRefundable = credits.filter((c) => !c.refundable).reduce((s, c) => s + c.amount, 0);
  const refundable = credits.filter((c) => c.refundable).reduce((s, c) => s + c.amount, 0);
  const tax = Math.max(0, grossTax - Math.min(grossTax, nonRefundable)) - refundable;

  return {
    conformityAmount: base,
    addBacks: back,
    additions,
    subtractions,
    deduction,
    exemptions,
    taxableIncome,
    taxBeforeCredits,
    brackets,
    surtaxes,
    credits,
    tax,
  };
}

/** Add one dollar of income to whichever federal figure this state starts from. */
function oneDollarMore(
  def: StateIncomeTaxDefinition,
  input: StateIncomeTaxInput,
): StateIncomeTaxInput {
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
      deduction: 0,
      exemptions: 0,
      taxableIncome: 0,
      taxBeforeCredits: 0,
      surtaxes: [],
      credits: [],
      tax: 0,
      brackets: [],
      marginalRate: 0,
      effectiveRate: 0,
      provisional: def.status === 'provisional',
      notes: def.notes,
      citations: def.citations,
    };
  }

  const here = compute(def, input);
  const higher = compute(def, oneDollarMore(def, input));

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
    deduction: roundCents(here.deduction),
    exemptions: roundCents(here.exemptions),
    taxableIncome: roundCents(here.taxableIncome),
    taxBeforeCredits: roundCents(here.taxBeforeCredits),
    surtaxes: here.surtaxes.map((s) => ({ name: s.name, amount: roundCents(s.amount) })),
    credits: here.credits.map((c) => ({ ...c, amount: roundCents(c.amount) })),
    tax: roundCents(here.tax),
    brackets: here.brackets.map((b) => ({
      rate: b.rate,
      incomeInBracket: roundCents(b.incomeInBracket),
      tax: roundCents(b.tax),
    })),
    marginalRate: roundCents((higher.tax - here.tax) * 100) / 100,
    effectiveRate: here.conformityAmount > 0 ? here.tax / here.conformityAmount : 0,
    provisional: def.status === 'provisional',
    notes: def.notes,
    citations: def.citations,
  };
}

export { getStateDefinition, isSupported, stateName, supportedYears };
export type { FilingStatus, StateCode };
