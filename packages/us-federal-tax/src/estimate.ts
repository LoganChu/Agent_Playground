import { getYearParameters, nonNegative, roundCents, standardDeduction } from './core.js';
import { additionalDeductions } from './obbba.js';
import { qbiDeduction } from './qbi.js';
import { stateAndLocalTaxDeduction } from './salt.js';
import {
  additionalMedicareTax,
  federalIncomeTax,
  longTermCapitalGainsTax,
  netInvestmentIncomeTax,
  selfEmploymentTax,
} from './taxes.js';
import type {
  AdditionalDeductionsResult,
  FilingStatus,
  QbiDeductionResult,
  QualifiedBusiness,
  SaltDeductionResult,
  SelfEmploymentTaxResult,
} from './types.js';

export interface EstimateInput {
  filingStatus: FilingStatus;
  year?: number;
  /** W-2 wages from employment. */
  w2Wages?: number;
  /** Net profit from self-employment (Schedule C line 31), before any SE tax deduction. */
  selfEmploymentNetProfit?: number;
  /** Interest, non-qualified dividends, retirement distributions, short-term gains, etc. */
  otherOrdinaryIncome?: number;
  /** Long-term capital gains and qualified dividends, which are taxed at preferential rates. */
  longTermCapitalGains?: number;
  /** Investment income subject to NIIT. Defaults to `longTermCapitalGains`. */
  netInvestmentIncome?: number;
  /**
   * Total itemized deductions, already capped, supplied directly.
   *
   * Prefer `stateAndLocalTaxesPaid` plus `otherItemizedDeductions`, which apply
   * the § 164(b)(6) cap and its phase-down for you. When those are given, this
   * input is ignored.
   */
  itemizedDeductions?: number;
  /**
   * State and local income (or sales) tax, real property tax and personal
   * property tax actually paid, **before** the § 164(b)(6) cap.
   */
  stateAndLocalTaxesPaid?: number;
  /**
   * Every other itemized deduction: mortgage interest, charitable contributions,
   * medical expenses over the 7.5%-of-AGI floor, investment interest. Not capped
   * by this library — see the README for what is and is not limited.
   */
  otherItemizedDeductions?: number;
  /**
   * Section 199A qualified business income deduction, supplied directly.
   *
   * Use this only if you have computed the number elsewhere. Prefer
   * `qualifiedBusinesses`, which computes it — including the SSTB phase-out, the
   * W-2 wage and property cap, and the taxable income limit. When both are
   * given, the computed figure wins and this input is ignored.
   */
  qualifiedBusinessIncomeDeduction?: number;
  /**
   * Each § 199A trade or business separately, so the deduction can be computed
   * rather than assumed. A single Schedule C is just one entry.
   *
   * These describe income that is *already* reported through
   * `selfEmploymentNetProfit` or `otherOrdinaryIncome` — they are not added to
   * gross income, so listing a business here does not increase the tax.
   */
  qualifiedBusinesses?: readonly QualifiedBusiness[];
  /** Qualified REIT dividends, deductible at 20% with no wage or property cap. */
  qualifiedReitDividends?: number;
  /** Qualified publicly traded partnership income, which may be negative. */
  qualifiedPtpIncome?: number;
  /** Prior-year § 199A qualified business net loss carryforward. */
  qualifiedBusinessNetLossCarryforward?: number;
  /** Prior-year § 199A REIT/PTP loss carryforward. */
  reitPtpLossCarryforward?: number;
  /**
   * Qualified tips under § 224, already filtered to tips that actually qualify
   * (cash tips, listed occupation, not a specified service trade or business).
   * These are also part of `w2Wages` or `selfEmploymentNetProfit` — the
   * deduction subtracts them back out, it does not exclude them from income.
   */
  qualifiedTips?: number;
  /** Net income from the trade or business in which self-employed tips were earned. */
  qualifiedTipsBusinessIncomeLimit?: number;
  /**
   * The FLSA **premium portion** of overtime pay under § 225 — the excess over
   * the regular rate, not total overtime wages. Like tips, this is money that is
   * also counted in `w2Wages`.
   */
  qualifiedOvertimeCompensation?: number;
  /** Interest on a qualifying post-2024 loan for a new US-assembled vehicle. */
  qualifiedVehicleLoanInterest?: number;
  /** Income excluded under § 911, § 931, or § 933, added back for MAGI. */
  foreignEarnedIncomeExclusion?: number;
  age65OrOlder?: boolean;
  blind?: boolean;
  spouseAge65OrOlder?: boolean;
  spouseBlind?: boolean;
  /** Federal income tax already withheld, used to compute the balance due. */
  federalWithholding?: number;
  /** Total tax from the prior year's return, used for safe-harbor estimates. */
  priorYearTotalTax?: number;
  /** Prior year AGI, which decides whether the safe harbor is 100% or 110%. */
  priorYearAdjustedGrossIncome?: number;
}

export interface EstimateResult {
  year: number;
  filingStatus: FilingStatus;
  grossIncome: number;
  adjustedGrossIncome: number;
  deduction: number;
  deductionKind: 'standard' | 'itemized';
  /**
   * The § 164(b)(6) computation, or `null` when itemized deductions were
   * supplied as a finished total rather than as components.
   *
   * Present even when the standard deduction wins, so a caller can see how close
   * the decision was and what the cap cost.
   */
  stateAndLocalTax: SaltDeductionResult | null;
  qualifiedBusinessIncomeDeduction: number;
  /**
   * Form 8995 / 8995-A in full, or `null` when no businesses were supplied and
   * the deduction was taken from `qualifiedBusinessIncomeDeduction` instead.
   */
  section199A: QbiDeductionResult | null;
  /** Schedule 1-A: the four OBBBA deductions, with a breakdown per part. */
  additionalDeductions: AdditionalDeductionsResult;
  taxableIncome: number;
  /** Taxable income taxed at ordinary rates (deductions reduce ordinary income first). */
  ordinaryTaxableIncome: number;
  /** Taxable income taxed at long-term capital gains rates. */
  capitalGainsTaxableIncome: number;
  ordinaryIncomeTax: number;
  capitalGainsTax: number;
  selfEmployment: SelfEmploymentTaxResult;
  additionalMedicareTax: number;
  netInvestmentIncomeTax: number;
  /** Total Form 1040 liability. Excludes employee FICA already withheld by an employer. */
  totalTax: number;
  /** Marginal rate on the next dollar of ordinary income. */
  marginalRate: number;
  /** `totalTax / grossIncome`. */
  effectiveRate: number;
  withholding: number;
  /** Positive means a payment is owed; negative means a refund. */
  balanceDue: number;
}

/**
 * Compute a full federal tax picture for a household.
 *
 * This is deliberately a pure function over explicit inputs. It models the common
 * case well; it does not attempt credits (child tax credit, EITC), AMT, or state
 * tax. Those are documented gaps, not silent ones.
 *
 * Pass `qualifiedBusinesses` and the Section 199A deduction is computed in full,
 * phase-outs included; pass `qualifiedBusinessIncomeDeduction` instead to supply
 * a figure you already have. Note that QBI should be net of the deductions
 * attributable to the business, including the deductible half of self-employment
 * tax — this function does not subtract that for you, because it cannot tell
 * which business `selfEmploymentNetProfit` belongs to.
 *
 * The four OBBBA deductions on Schedule 1-A *are* computed, from the inputs
 * `qualifiedTips`, `qualifiedOvertimeCompensation`, `qualifiedVehicleLoanInterest`
 * and the age flags. Note that the senior deduction applies automatically to a
 * filer who is 65 or older, since it depends on nothing beyond age and MAGI.
 */
export function estimateFederalTax(input: EstimateInput): EstimateResult {
  const params = getYearParameters(input.year);
  const year = params.year;
  const { filingStatus } = input;

  const wages = nonNegative(input.w2Wages, 'w2Wages');
  const netProfit = nonNegative(input.selfEmploymentNetProfit, 'selfEmploymentNetProfit');
  const otherIncome = nonNegative(input.otherOrdinaryIncome, 'otherOrdinaryIncome');
  const ltcg = nonNegative(input.longTermCapitalGains, 'longTermCapitalGains');

  const se = selfEmploymentTax({ netProfit, year, w2SocialSecurityWages: wages });

  const grossIncome = wages + netProfit + otherIncome + ltcg;
  const adjustedGrossIncome = Math.max(0, grossIncome - se.deductibleHalf);

  const standard = standardDeduction({
    filingStatus,
    year,
    age65OrOlder: input.age65OrOlder,
    blind: input.blind,
    spouseAge65OrOlder: input.spouseAge65OrOlder,
    spouseBlind: input.spouseBlind,
  });
  // Either the caller supplies a finished itemized total, or supplies the
  // components and lets the SALT cap be applied here.
  const hasItemizedComponents =
    input.stateAndLocalTaxesPaid !== undefined || input.otherItemizedDeductions !== undefined;

  const salt = hasItemizedComponents
    ? stateAndLocalTaxDeduction({
        filingStatus,
        year,
        stateAndLocalTaxesPaid: input.stateAndLocalTaxesPaid ?? 0,
        adjustedGrossIncome,
        foreignEarnedIncomeExclusion: input.foreignEarnedIncomeExclusion,
      })
    : null;

  const itemized =
    salt !== null
      ? salt.deduction + nonNegative(input.otherItemizedDeductions, 'otherItemizedDeductions')
      : nonNegative(input.itemizedDeductions, 'itemizedDeductions');
  const useItemized = itemized > standard;
  const deduction = roundCents(useItemized ? itemized : standard);

  // Schedule 1-A sits below AGI, so it is computed from the AGI above and does
  // not feed back into its own phase-outs or into the NIIT threshold.
  const schedule1A = additionalDeductions({
    filingStatus,
    year,
    adjustedGrossIncome,
    foreignEarnedIncomeExclusion: input.foreignEarnedIncomeExclusion,
    qualifiedTips: input.qualifiedTips,
    qualifiedTipsBusinessIncomeLimit: input.qualifiedTipsBusinessIncomeLimit,
    qualifiedOvertimeCompensation: input.qualifiedOvertimeCompensation,
    qualifiedVehicleLoanInterest: input.qualifiedVehicleLoanInterest,
    age65OrOlder: input.age65OrOlder,
    spouseAge65OrOlder: input.spouseAge65OrOlder,
  });

  // Form 8995 line 11. The Schedule 1-A total is subtracted here even though it
  // sits *below* the § 199A deduction on Form 1040, because the § 199A
  // limitations run on taxable income figured without § 199A only — every other
  // deduction, Schedule 1-A included, has already come out. The IRS reissued the
  // 2025 Form 8995-A instructions in January 2026 to say exactly this.
  const taxableIncomeBeforeQbiDeduction = adjustedGrossIncome - deduction - schedule1A.total;

  const hasBusinesses =
    (input.qualifiedBusinesses !== undefined && input.qualifiedBusinesses.length > 0) ||
    input.qualifiedReitDividends !== undefined ||
    input.qualifiedPtpIncome !== undefined;

  const section199A = hasBusinesses
    ? qbiDeduction({
        filingStatus,
        year,
        taxableIncomeBeforeQbiDeduction,
        businesses: input.qualifiedBusinesses,
        netCapitalGain: ltcg,
        qualifiedReitDividends: input.qualifiedReitDividends,
        qualifiedPtpIncome: input.qualifiedPtpIncome,
        qualifiedBusinessNetLossCarryforward: input.qualifiedBusinessNetLossCarryforward,
        reitPtpLossCarryforward: input.reitPtpLossCarryforward,
      })
    : null;

  const qbi =
    section199A !== null
      ? section199A.deduction
      : nonNegative(
          input.qualifiedBusinessIncomeDeduction,
          'qualifiedBusinessIncomeDeduction',
        );

  const taxableIncome = Math.max(0, taxableIncomeBeforeQbiDeduction - qbi);

  // Deductions are applied against ordinary income first, so any surviving taxable
  // income is capital gain only after ordinary income has been exhausted.
  const capitalGainsTaxableIncome = Math.min(ltcg, taxableIncome);
  const ordinaryTaxableIncome = taxableIncome - capitalGainsTaxableIncome;

  const ordinary = federalIncomeTax({ taxableIncome: ordinaryTaxableIncome, filingStatus, year });
  const gains = longTermCapitalGainsTax({
    ordinaryTaxableIncome,
    longTermGains: capitalGainsTaxableIncome,
    filingStatus,
    year,
  });

  const extraMedicare = additionalMedicareTax({
    filingStatus,
    wages,
    selfEmploymentEarnings: se.belowThreshold ? 0 : se.netEarnings,
    year,
  });

  const niiBase =
    input.netInvestmentIncome === undefined
      ? ltcg
      : nonNegative(input.netInvestmentIncome, 'netInvestmentIncome');
  const niit = netInvestmentIncomeTax({
    modifiedAdjustedGrossIncome: adjustedGrossIncome,
    netInvestmentIncome: niiBase,
    filingStatus,
    year,
  });

  const totalTax = roundCents(ordinary.tax + gains.tax + se.total + extraMedicare + niit);
  const withholding = nonNegative(input.federalWithholding, 'federalWithholding');

  return {
    year,
    filingStatus,
    grossIncome: roundCents(grossIncome),
    adjustedGrossIncome: roundCents(adjustedGrossIncome),
    deduction,
    deductionKind: useItemized ? 'itemized' : 'standard',
    stateAndLocalTax: salt,
    qualifiedBusinessIncomeDeduction: roundCents(qbi),
    section199A,
    additionalDeductions: schedule1A,
    taxableIncome: roundCents(taxableIncome),
    ordinaryTaxableIncome: roundCents(ordinaryTaxableIncome),
    capitalGainsTaxableIncome: roundCents(capitalGainsTaxableIncome),
    ordinaryIncomeTax: ordinary.tax,
    capitalGainsTax: gains.tax,
    selfEmployment: se,
    additionalMedicareTax: extraMedicare,
    netInvestmentIncomeTax: niit,
    totalTax,
    marginalRate: ordinary.marginalRate,
    effectiveRate: grossIncome > 0 ? totalTax / grossIncome : 0,
    withholding,
    balanceDue: roundCents(totalTax - withholding),
  };
}

export interface QuarterlyPlan {
  /** The smaller of the two safe-harbor targets — what you must pay in to avoid a penalty. */
  requiredAnnualPayment: number;
  /** Which rule produced `requiredAnnualPayment`. */
  basis: 'currentYear90' | 'priorYearSafeHarbor';
  /** 90% of the current year's projected tax. */
  currentYearTarget: number;
  /** 100% (or 110% for higher earners) of the prior year's tax, when supplied. */
  priorYearTarget: number | null;
  /** True when the 110% rule applied because prior-year AGI exceeded the limit. */
  usedHigherPriorYearRate: boolean;
  /** Required payment less withholding, spread across the remaining quarters. */
  totalEstimatedPayments: number;
  installments: readonly { period: number; dueDate: string; amount: number }[];
}

/** Prior-year AGI above this triggers the 110% safe harbor instead of 100%. */
const HIGH_INCOME_SAFE_HARBOR_AGI = 150_000;
const HIGH_INCOME_SAFE_HARBOR_AGI_MFS = 75_000;

/**
 * Turn an estimate into a quarterly payment plan under the IRC § 6654 safe harbors.
 *
 * You avoid an underpayment penalty by paying in the *lesser* of 90% of this
 * year's tax or 100% of last year's (110% if last year's AGI was above
 * $150,000, or $75,000 filing separately). Supplying `priorYearTotalTax` is what
 * makes the second, usually cheaper, option available.
 *
 * Due dates are the statutory ones and are not adjusted for weekends or holidays.
 */
export function quarterlyEstimatedPayments(
  estimate: EstimateResult,
  options: {
    priorYearTotalTax?: number;
    priorYearAdjustedGrossIncome?: number;
  } = {},
): QuarterlyPlan {
  const currentYearTarget = roundCents(estimate.totalTax * 0.9);

  let priorYearTarget: number | null = null;
  let usedHigherPriorYearRate = false;

  if (options.priorYearTotalTax !== undefined) {
    const priorTax = nonNegative(options.priorYearTotalTax, 'priorYearTotalTax');
    const limit =
      estimate.filingStatus === 'marriedFilingSeparately'
        ? HIGH_INCOME_SAFE_HARBOR_AGI_MFS
        : HIGH_INCOME_SAFE_HARBOR_AGI;
    const priorAgi = options.priorYearAdjustedGrossIncome;
    usedHigherPriorYearRate = priorAgi !== undefined && priorAgi > limit;
    priorYearTarget = roundCents(priorTax * (usedHigherPriorYearRate ? 1.1 : 1.0));
  }

  const requiredAnnualPayment =
    priorYearTarget !== null ? Math.min(currentYearTarget, priorYearTarget) : currentYearTarget;
  const basis =
    priorYearTarget !== null && priorYearTarget < currentYearTarget
      ? 'priorYearSafeHarbor'
      : 'currentYear90';

  const totalEstimatedPayments = Math.max(0, roundCents(requiredAnnualPayment - estimate.withholding));
  const perQuarter = roundCents(totalEstimatedPayments / 4);
  const y = estimate.year;

  const dueDates = [`${y}-04-15`, `${y}-06-15`, `${y}-09-15`, `${y + 1}-01-15`];
  const installments = dueDates.map((dueDate, i) => ({
    period: i + 1,
    dueDate,
    // Put any rounding remainder in the final installment so the four sum exactly.
    amount: i < 3 ? perQuarter : roundCents(totalEstimatedPayments - perQuarter * 3),
  }));

  return {
    requiredAnnualPayment,
    basis,
    currentYearTarget,
    priorYearTarget,
    usedHigherPriorYearRate,
    totalEstimatedPayments,
    installments,
  };
}
