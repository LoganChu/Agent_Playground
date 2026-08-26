import { applyBrackets, getYearParameters, nonNegative, roundCents } from './core.js';
import type {
  CapitalGainsResult,
  FicaResult,
  FilingStatus,
  IncomeTaxResult,
  SelfEmploymentTaxResult,
} from './types.js';

/**
 * Ordinary federal income tax on an already-computed taxable income.
 *
 * `taxableIncome` is income *after* the standard or itemized deduction. Pass a
 * negative or zero value and you get zero tax.
 */
export function federalIncomeTax(options: {
  taxableIncome: number;
  filingStatus: FilingStatus;
  year?: number;
}): IncomeTaxResult {
  const params = getYearParameters(options.year);
  const brackets = params.ordinaryBrackets[options.filingStatus];
  if (!brackets) {
    throw new TypeError(`Unknown filing status: ${String(options.filingStatus)}`);
  }

  const taxableIncome = nonNegative(options.taxableIncome, 'taxableIncome');
  const { tax, marginalRate, details } = applyBrackets(taxableIncome, brackets);

  return {
    taxableIncome,
    tax,
    marginalRate,
    effectiveRate: taxableIncome > 0 ? tax / taxableIncome : 0,
    brackets: details,
  };
}

/**
 * Self-employment tax (Schedule SE).
 *
 * Two details that naive implementations routinely get wrong, both handled here:
 *
 * 1. The OASDI portion is capped by the Social Security wage base *shared with*
 *    any W-2 wages already earned. Someone with $150,000 of W-2 wages and a side
 *    business only has $34,500 of the 2026 base left. Pass `w2SocialSecurityWages`
 *    to model that; omit it and the full base is assumed available.
 * 2. `deductibleHalf` is half of the Schedule SE total only. Additional Medicare
 *    Tax is reported separately on Form 8959 and is *not* deductible, so it is
 *    excluded here — see {@link additionalMedicareTax}.
 */
export function selfEmploymentTax(options: {
  netProfit: number;
  year?: number;
  /** W-2 wages already subject to Social Security tax, which consume the wage base first. */
  w2SocialSecurityWages?: number;
}): SelfEmploymentTaxResult {
  const params = getYearParameters(options.year);
  const netProfit = nonNegative(options.netProfit, 'netProfit');
  const w2Wages = nonNegative(options.w2SocialSecurityWages, 'w2SocialSecurityWages');

  const netEarnings = netProfit * params.seNetEarningsFactor;

  if (netEarnings < params.seMinimumNetEarnings) {
    return {
      netEarnings: roundCents(netEarnings),
      socialSecurity: 0,
      medicare: 0,
      total: 0,
      deductibleHalf: 0,
      belowThreshold: true,
    };
  }

  const remainingBase = Math.max(0, params.socialSecurityWageBase - w2Wages);
  const socialSecurity = Math.min(netEarnings, remainingBase) * params.rates.seSocialSecurity;
  const medicare = netEarnings * params.rates.seMedicare;
  const total = socialSecurity + medicare;

  return {
    netEarnings: roundCents(netEarnings),
    socialSecurity: roundCents(socialSecurity),
    medicare: roundCents(medicare),
    total: roundCents(total),
    deductibleHalf: roundCents(total / 2),
    belowThreshold: false,
  };
}

/**
 * Additional Medicare Tax (Form 8959): 0.9% on combined wages and self-employment
 * earnings above a filing-status threshold.
 *
 * Wages are counted against the threshold first, which matters when someone has
 * both — the ordering changes nothing about the total, but it is how the form
 * works and keeps the result explainable.
 *
 * `selfEmploymentEarnings` should be *net earnings* (i.e. after the 92.35%
 * reduction), which is what {@link selfEmploymentTax} returns as `netEarnings`.
 */
export function additionalMedicareTax(options: {
  filingStatus: FilingStatus;
  wages?: number;
  selfEmploymentEarnings?: number;
  year?: number;
}): number {
  const params = getYearParameters(options.year);
  const threshold = params.additionalMedicareThreshold[options.filingStatus];
  if (threshold === undefined) {
    throw new TypeError(`Unknown filing status: ${String(options.filingStatus)}`);
  }

  const wages = nonNegative(options.wages, 'wages');
  const se = nonNegative(options.selfEmploymentEarnings, 'selfEmploymentEarnings');
  const excess = Math.max(0, wages + se - threshold);

  return roundCents(excess * params.rates.additionalMedicare);
}

/**
 * Employee and employer FICA on W-2 wages.
 *
 * The employer match never includes Additional Medicare Tax — that is an
 * employee-only liability.
 */
export function ficaTax(options: {
  wages: number;
  filingStatus: FilingStatus;
  year?: number;
}): FicaResult {
  const params = getYearParameters(options.year);
  const wages = nonNegative(options.wages, 'wages');
  const ssWages = Math.min(wages, params.socialSecurityWageBase);

  const employeeSs = ssWages * params.rates.socialSecurityEmployee;
  const employeeMedicare = wages * params.rates.medicareEmployee;
  const employerSs = ssWages * params.rates.socialSecurityEmployer;
  const employerMedicare = wages * params.rates.medicareEmployer;

  const extraMedicare = additionalMedicareTax({
    filingStatus: options.filingStatus,
    wages,
    year: options.year,
  });

  return {
    employee: {
      socialSecurity: roundCents(employeeSs),
      medicare: roundCents(employeeMedicare),
      additionalMedicare: extraMedicare,
      total: roundCents(employeeSs + employeeMedicare + extraMedicare),
    },
    employer: {
      socialSecurity: roundCents(employerSs),
      medicare: roundCents(employerMedicare),
      total: roundCents(employerSs + employerMedicare),
    },
  };
}

/**
 * Long-term capital gains tax, correctly *stacked* on top of ordinary income.
 *
 * The 0%/15%/20% thresholds apply to total taxable income, not to the gain in
 * isolation. A filer with $40,000 of ordinary taxable income and a $20,000 gain
 * does not get the whole gain at 0% — only the part that fits below the 0% ceiling.
 *
 * Both inputs are *taxable* amounts (after deductions).
 */
export function longTermCapitalGainsTax(options: {
  ordinaryTaxableIncome: number;
  longTermGains: number;
  filingStatus: FilingStatus;
  year?: number;
}): CapitalGainsResult {
  const params = getYearParameters(options.year);
  const brackets = params.longTermCapitalGains[options.filingStatus];
  if (!brackets) {
    throw new TypeError(`Unknown filing status: ${String(options.filingStatus)}`);
  }

  const ordinary = nonNegative(options.ordinaryTaxableIncome, 'ordinaryTaxableIncome');
  const gains = nonNegative(options.longTermGains, 'longTermGains');
  const { tax, details } = applyBrackets(gains, brackets, ordinary);

  return { tax, brackets: details };
}

/**
 * Net Investment Income Tax (Form 8960): 3.8% on the lesser of net investment
 * income and the amount by which modified AGI exceeds the threshold.
 */
export function netInvestmentIncomeTax(options: {
  modifiedAdjustedGrossIncome: number;
  netInvestmentIncome: number;
  filingStatus: FilingStatus;
  year?: number;
}): number {
  const params = getYearParameters(options.year);
  const threshold = params.niit.thresholds[options.filingStatus];
  if (threshold === undefined) {
    throw new TypeError(`Unknown filing status: ${String(options.filingStatus)}`);
  }

  const magi = nonNegative(options.modifiedAdjustedGrossIncome, 'modifiedAdjustedGrossIncome');
  const nii = nonNegative(options.netInvestmentIncome, 'netInvestmentIncome');
  const base = Math.min(nii, Math.max(0, magi - threshold));

  return roundCents(base * params.niit.rate);
}
