import { getYearParameters, nonNegative, roundCents, standardDeduction } from './core.js';
import { childTaxCredit, earnedIncomeCredit, earnedIncomeForCredits } from './credits.js';
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
  CreditsResult,
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
  /**
   * Children under 17 at the end of the year who have a social security number
   * valid for employment — § 24(c) and § 24(h)(7). Supplying this (or
   * `otherDependents`) is what turns on the child tax credit.
   */
  qualifyingChildren?: number;
  /**
   * Dependents worth the $500 credit for other dependents rather than the child
   * tax credit: a child who turned 17, a dependent parent, a qualifying relative.
   */
  otherDependents?: number;
  /**
   * Children meeting the § 32(c)(3) tests for the earned income credit.
   *
   * Usually the same as `qualifyingChildren`, but the two definitions genuinely
   * differ — § 32 has no age-17 cut-off for a permanently disabled child and no
   * requirement that the taxpayer claim the dependency exemption. Defaults to
   * `qualifyingChildren`.
   */
  eitcQualifyingChildren?: number;
  /**
   * Age of the filer at the end of the year.
   *
   * Required to compute the earned income credit for a household with no
   * qualifying children, because § 32(c)(1)(A)(ii)(II) allows it only between 25
   * and 64. **With no qualifying children and no `age`, the EITC is not
   * computed at all** — the credit is left `null` rather than guessed, since
   * eligibility cannot be inferred from any other input.
   */
  age?: number;
  /**
   * Disqualified investment income for § 32(i): taxable and tax-exempt interest,
   * dividends, net capital gain, net rental and royalty income, and net passive
   * income. Above the limit ($12,200 in 2026) the earned income credit is
   * disallowed entirely.
   *
   * Defaults to `longTermCapitalGains`, which is the only component this function
   * can identify with certainty. **A filer with substantial interest or ordinary
   * dividends inside `otherOrdinaryIncome` must supply this explicitly**,
   * otherwise the limit is tested against too small a figure.
   */
  disqualifiedInvestmentIncome?: number;
  /**
   * Whether a married filer filing separately meets § 32(d)(2). Defaults to
   * `false`, which bars the earned income credit.
   */
  separatedFromSpouse?: boolean;
  /**
   * Whether the taxpayer (or a spouse, on a joint return) has a social security
   * number valid for employment, as OBBBA § 70104(c) requires from 2025 for the
   * child portion of the § 24 credit. Defaults to `true`.
   */
  taxpayerHasWorkAuthorizedSocialSecurityNumber?: boolean;
  /**
   * Employee-share social security and Medicare tax withheld by an employer,
   * used only by the § 24(d)(1)(B)(ii) alternative for families with three or
   * more qualifying children.
   *
   * Defaults to the employee FICA implied by `w2Wages`. Supply it directly when
   * the filer had more than one employer or any excess OASDI withheld. The half
   * of self-employment tax that § 24(d)(2)(A)(ii) also counts is added for you.
   */
  employeeSocialSecurityAndMedicareTax?: number;
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
  /**
   * The § 26(a) regular tax liability: `ordinaryIncomeTax + capitalGainsTax`.
   *
   * This is the ceiling on every non-refundable credit, and it is deliberately
   * *not* the total tax — self-employment tax, NIIT and Additional Medicare Tax
   * sit outside it and no non-refundable credit can reduce them.
   */
  incomeTaxBeforeCredits: number;
  /** The § 24 and § 32 credits, or nulls when they were not computed. */
  credits: CreditsResult;
  /**
   * Total Form 1040 liability **after** non-refundable credits, floored at zero
   * for the income tax component.
   *
   * Refundable credits are *not* netted here — they are payments, and they
   * appear in {@link EstimateResult.balanceDue}. Excludes employee FICA already
   * withheld by an employer.
   */
  totalTax: number;
  /** Total tax before any credit, for comparison against {@link totalTax}. */
  totalTaxBeforeCredits: number;
  /** Marginal rate on the next dollar of ordinary income. */
  marginalRate: number;
  /** `totalTax / grossIncome`. */
  effectiveRate: number;
  withholding: number;
  /**
   * Positive means a payment is owed; negative means a refund.
   *
   * `totalTax - withholding - refundable credits`. Refundable credits are
   * subtracted here rather than from the tax because they are paid out in full
   * even when they exceed the liability — which is exactly how a household with
   * no income tax still receives the EITC.
   */
  balanceDue: number;
}

/**
 * Compute a full federal tax picture for a household.
 *
 * This is deliberately a pure function over explicit inputs. It models the common
 * case well; it does not attempt AMT or state tax. Those are documented gaps,
 * not silent ones.
 *
 * The § 24 child tax credit is computed when `qualifyingChildren` or
 * `otherDependents` is supplied. The § 32 earned income credit is computed when
 * there are qualifying children, or when `age` is supplied — with neither, the
 * childless credit's 25-to-64 age test cannot be evaluated and the credit is
 * reported as `null` rather than guessed at. Supplying no dependents and no age
 * therefore leaves every figure identical to what this function returned before
 * credits existed.
 *
 * Note that `totalTax` is now net of *non-refundable* credits, while refundable
 * credits appear in `balanceDue`. `totalTaxBeforeCredits` preserves the old
 * figure.
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

  // The § 26(a) ceiling on non-refundable credits. Note what is *not* in it.
  const incomeTaxBeforeCredits = roundCents(ordinary.tax + gains.tax);
  const otherTaxes = se.total + extraMedicare + niit;
  const totalTaxBeforeCredits = roundCents(incomeTaxBeforeCredits + otherTaxes);

  // § 32(c)(2)(A)(ii): net earnings from self-employment come in already reduced
  // by the § 164(f) deduction, so this is not simply wages plus profit.
  const earnedIncome = earnedIncomeForCredits({
    wages,
    selfEmploymentNetEarnings: se.belowThreshold ? netProfit : se.netEarnings,
    deductibleHalfOfSelfEmploymentTax: se.deductibleHalf,
  });

  const eitcChildren = input.eitcQualifyingChildren ?? input.qualifyingChildren ?? 0;
  // With no qualifying children the credit turns on the filer's age, which
  // nothing else in the input implies. Rather than assume eligibility either
  // way, leave the credit uncomputed and say so in the result.
  const computeEitc = eitcChildren > 0 || input.age !== undefined;
  const eitc = computeEitc
    ? earnedIncomeCredit({
        filingStatus,
        year,
        earnedIncome,
        adjustedGrossIncome,
        qualifyingChildren: eitcChildren,
        investmentIncome: input.disqualifiedInvestmentIncome ?? ltcg,
        age: input.age,
        separatedFromSpouse: input.separatedFromSpouse,
      })
    : null;

  const hasDependents =
    (input.qualifyingChildren ?? 0) > 0 || (input.otherDependents ?? 0) > 0;

  // § 24(d)(2): the employee half of FICA plus Additional Medicare Tax plus one
  // half of self-employment tax. Only consulted with three or more children.
  const employeeFica =
    input.employeeSocialSecurityAndMedicareTax ??
    Math.min(wages, params.socialSecurityWageBase) * params.rates.socialSecurityEmployee +
      wages * params.rates.medicareEmployee;
  const socialSecurityTaxes =
    nonNegative(employeeFica, 'employeeSocialSecurityAndMedicareTax') +
    extraMedicare +
    se.deductibleHalf;

  const ctc = hasDependents
    ? childTaxCredit({
        filingStatus,
        year,
        qualifyingChildren: input.qualifyingChildren,
        otherDependents: input.otherDependents,
        adjustedGrossIncome,
        foreignEarnedIncomeExclusion: input.foreignEarnedIncomeExclusion,
        incomeTaxBeforeCredits,
        earnedIncome,
        socialSecurityTaxes,
        earnedIncomeCredit: eitc?.credit ?? 0,
        taxpayerHasWorkAuthorizedSocialSecurityNumber:
          input.taxpayerHasWorkAuthorizedSocialSecurityNumber,
      })
    : null;

  const totalNonRefundable = roundCents(ctc?.nonRefundableCredit ?? 0);
  const totalRefundable = roundCents((ctc?.refundableCredit ?? 0) + (eitc?.credit ?? 0));
  const credits: CreditsResult = {
    childTaxCredit: ctc,
    earnedIncomeCredit: eitc,
    totalNonRefundable,
    totalRefundable,
  };

  // Non-refundable credits reduce the income tax only, and only to zero. The
  // `max` is belt and braces — `nonRefundableCredit` is already capped at the
  // same figure — but it keeps the invariant local and obvious.
  const totalTax = roundCents(
    Math.max(0, incomeTaxBeforeCredits - totalNonRefundable) + otherTaxes,
  );
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
    incomeTaxBeforeCredits,
    credits,
    totalTax,
    totalTaxBeforeCredits,
    marginalRate: ordinary.marginalRate,
    effectiveRate: grossIncome > 0 ? totalTax / grossIncome : 0,
    withholding,
    balanceDue: roundCents(totalTax - withholding - totalRefundable),
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
