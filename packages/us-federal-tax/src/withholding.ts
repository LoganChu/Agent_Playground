/**
 * Federal income tax withholding — IRS Publication 15-T, percentage method.
 *
 * ## Why the tables are not in this file
 *
 * Publication 15-T prints eight rate schedules per year: three filing-status
 * columns times a standard and a "Step 2 checkbox" variant, plus the pre-2020
 * form's. Every one of them is *derived* from the year's ordinary rate schedule
 * and standard deduction:
 *
 * ```text
 * standard  band i = taxable band i + standardDeduction - step1gAmount
 * checkbox  band i = (taxable band i + standardDeduction) / 2
 * ```
 *
 * where `step1gAmount` is $12,900 in the joint column and $8,600 in the other
 * two — which are three and two withholding allowances at the frozen $4,300
 * rate, because the tables were built for the pre-2020 Form W-4 and its default
 * allowances. Worksheet 1A line 1g adds them back for a modern W-4; Worksheet 1B
 * subtracts the employee's actual allowances instead.
 *
 * Deriving rather than transcribing is deliberate, and it is the same choice
 * that made this package immune to the IRS's own 2024 rate-schedule erratum: a
 * table copied out of a PDF can be copied wrong, and an arithmetic identity
 * cannot. The derivation reproduces every published threshold for 2024 and 2025
 * — four columns, seven bands each — and `test/withholding.test.js` pins all of
 * them.
 *
 * ## What is not modelled
 *
 * - The **wage bracket method** tables. They are a rounded presentation of the
 *   same percentage method and an employer may use either; this is the exact one.
 * - **Nonresident alien** employees, who take an extra amount added to wages
 *   before Step 1 (Publication 15-T, Table 1 in the "Nonresident Alien" section).
 * - Supplemental wages, backup withholding, and pension/annuity withholding
 *   (Forms W-4P/W-4R).
 * - State and local withholding.
 */

import {
  applyBrackets,
  getYearParameters,
  marginalRateAt,
  nonNegative,
  roundCents,
} from './core.js';
import type {
  Bracket,
  FilingStatus,
  LegacyW4,
  ModernW4,
  PaycheckResult,
  PayPeriod,
  W4,
  WithholdingColumn,
  WithholdingPlan,
  WithholdingResult,
} from './types.js';

/**
 * Pay periods in a year, exactly as Publication 15-T assigns them.
 *
 * `daily` is the publication's "Daily or Miscellaneous" period and uses 260
 * working days, not 365.
 */
export const PAY_PERIODS_PER_YEAR: Readonly<Record<PayPeriod, number>> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
  daily: 260,
};

export const PAY_PERIODS: readonly PayPeriod[] = Object.keys(
  PAY_PERIODS_PER_YEAR,
) as PayPeriod[];

/** The filing status whose rate schedule each withholding column is built on. */
const COLUMN_BRACKET_STATUS: Readonly<Record<WithholdingColumn, FilingStatus>> = {
  singleOrMarriedFilingSeparately: 'single',
  marriedFilingJointly: 'marriedFilingJointly',
  headOfHousehold: 'headOfHousehold',
};

/**
 * Which section of the Publication 15-T tables a filing status uses.
 *
 * Form W-4 Step 1(c) has three boxes and the tables have three sections, so the
 * five filing statuses collapse into three. Two collapses are lossless —
 * qualifying surviving spouse genuinely shares the joint schedule — and one is
 * not: **married filing separately is withheld on the single schedule**, whose
 * 37% band starts far higher than an MFS return's does. That is the table's
 * behaviour, not this package's approximation of it, and it is reported in
 * {@link WithholdingResult.notes} when it can actually bite.
 */
export function withholdingColumn(filingStatus: FilingStatus): WithholdingColumn {
  switch (filingStatus) {
    case 'marriedFilingJointly':
    case 'qualifyingSurvivingSpouse':
      return 'marriedFilingJointly';
    case 'headOfHousehold':
      return 'headOfHousehold';
    case 'single':
    case 'marriedFilingSeparately':
      return 'singleOrMarriedFilingSeparately';
    default:
      throw new TypeError(`Unknown filing status: ${String(filingStatus)}`);
  }
}

function payPeriodsPerYear(payPeriod: PayPeriod): number {
  const periods = PAY_PERIODS_PER_YEAR[payPeriod];
  if (periods === undefined) {
    throw new TypeError(
      `Unknown pay period: ${String(payPeriod)}. Expected one of ${PAY_PERIODS.join(', ')}.`,
    );
  }
  return periods;
}

/**
 * One of the year's percentage method rate schedules, in annual wage terms.
 *
 * The returned bands are *withholding* bands: they run on the adjusted annual
 * wage amount, not on taxable income, so the first band is the 0% band that
 * stands in for the standard deduction.
 */
export function withholdingRateSchedule(options: {
  column: WithholdingColumn;
  year?: number;
  /** Form W-4 Step 2 checkbox — the halved, two-job schedule. */
  multipleJobsCheckbox?: boolean;
}): readonly Bracket[] {
  const params = getYearParameters(options.year);
  const column = options.column;
  const standard = params.withholding.standardDeduction[column];
  if (standard === undefined) {
    throw new TypeError(`Unknown withholding column: ${String(column)}`);
  }
  const brackets = params.ordinaryBrackets[COLUMN_BRACKET_STATUS[column]];

  if (options.multipleJobsCheckbox) {
    // Half a schedule for half the household's income. Two jobs each withholding
    // on this schedule sum to what one job on the full schedule would withhold.
    return [
      { rate: 0, upTo: standard / 2 },
      ...brackets.map((b) => ({
        rate: b.rate,
        upTo: b.upTo === Infinity ? Infinity : (b.upTo + standard) / 2,
      })),
    ];
  }

  const zeroBand = standard - params.withholding.step1gAmount[column];
  return [
    { rate: 0, upTo: zeroBand },
    ...brackets.map((b) => ({
      rate: b.rate,
      upTo: b.upTo === Infinity ? Infinity : b.upTo + zeroBand,
    })),
  ];
}

export interface WithholdingInput {
  /** Federal-taxable wages for this pay period. */
  readonly wagesThisPeriod: number;
  /** Form W-4 Step 1(c). Both married statuses are handled — see {@link withholdingColumn}. */
  readonly filingStatus: FilingStatus;
  /** Required. Guessing a pay frequency silently scales the answer. */
  readonly payPeriod: PayPeriod;
  readonly year?: number;
  /** Defaults to a 2020-or-later Form W-4 with every box blank. */
  readonly w4?: W4;
  /** Publication 15-T permits rounding withholding to whole dollars. */
  readonly roundToWholeDollars?: boolean;
}

function isLegacy(w4: W4 | undefined): w4 is LegacyW4 {
  return w4 !== undefined && (w4 as LegacyW4).revision === '2019OrEarlier';
}

/**
 * The adjusted annual wage amount, plus the column and schedule it is measured
 * against. Worksheet 1A Step 1 or Worksheet 1B Step 1.
 */
function adjustWage(input: WithholdingInput): {
  adjustedAnnualWage: number;
  column: WithholdingColumn;
  multipleJobsCheckbox: boolean;
  annualCredits: number;
  extraWithholding: number;
  notes: string[];
} {
  const params = getYearParameters(input.year);
  const periods = payPeriodsPerYear(input.payPeriod);
  const wages = nonNegative(input.wagesThisPeriod, 'wagesThisPeriod');
  const annualWage = wages * periods;
  const notes: string[] = [];

  if (isLegacy(input.w4)) {
    // Worksheet 1B. The old form had no head-of-household box, so a legacy W-4
    // can only land in the single or the joint column.
    const legacy = input.w4;
    const married =
      !legacy.withholdAtHigherSingleRate &&
      (input.filingStatus === 'marriedFilingJointly' ||
        input.filingStatus === 'qualifyingSurvivingSpouse');
    const column: WithholdingColumn = married
      ? 'marriedFilingJointly'
      : 'singleOrMarriedFilingSeparately';

    if (input.filingStatus === 'headOfHousehold') {
      notes.push(
        'A Form W-4 from 2019 or earlier has no head-of-household box, so the single ' +
          'schedule is used. Filing a current Form W-4 would withhold less.',
      );
    }
    if (
      legacy.withholdAtHigherSingleRate &&
      (input.filingStatus === 'marriedFilingJointly' ||
        input.filingStatus === 'qualifyingSurvivingSpouse')
    ) {
      notes.push('Withheld at the higher single rate, as line 3 of the legacy form directs.');
    }

    const allowances = nonNegative(legacy.allowances, 'allowances');
    const adjusted = Math.max(0, annualWage - allowances * params.withholding.allowanceAmount);

    return {
      adjustedAnnualWage: adjusted,
      column,
      multipleJobsCheckbox: false,
      annualCredits: 0,
      extraWithholding: nonNegative(legacy.extraWithholding, 'extraWithholding'),
      notes,
    };
  }

  // Worksheet 1A.
  const w4 = (input.w4 ?? {}) as ModernW4;
  const column = withholdingColumn(input.filingStatus);
  const otherIncome = nonNegative(w4.otherIncome, 'otherIncome');
  const deductions = nonNegative(w4.deductions, 'deductions');
  const checkbox = w4.multipleJobsCheckbox === true;
  // Line 1g: zero when the Step 2 box is checked, because the halved schedule
  // already carries the whole standard deduction.
  const step1g = checkbox ? 0 : params.withholding.step1gAmount[column];
  const adjusted = Math.max(0, annualWage + otherIncome - (deductions + step1g));

  return {
    adjustedAnnualWage: adjusted,
    column,
    multipleJobsCheckbox: checkbox,
    annualCredits: nonNegative(w4.dependentsCredit, 'dependentsCredit'),
    extraWithholding: nonNegative(w4.extraWithholding, 'extraWithholding'),
    notes,
  };
}

/** Withholding for one period, before Step 4(c) and before rounding. */
function withholdingBeforeExtraFor(input: WithholdingInput): number {
  const adjusted = adjustWage(input);
  const schedule = withholdingRateSchedule({
    column: adjusted.column,
    year: input.year,
    multipleJobsCheckbox: adjusted.multipleJobsCheckbox,
  });
  const { tax } = applyBrackets(adjusted.adjustedAnnualWage, schedule);
  const periods = payPeriodsPerYear(input.payPeriod);
  const afterCredits = Math.max(0, tax - adjusted.annualCredits);
  return afterCredits / periods;
}

/**
 * Federal income tax to withhold from one paycheck.
 *
 * Publication 15-T, Worksheet 1A (Form W-4 from 2020 or later) or Worksheet 1B
 * (2019 or earlier), whichever the `w4` argument describes.
 */
export function computeWithholding(input: WithholdingInput): WithholdingResult {
  const params = getYearParameters(input.year);
  const periods = payPeriodsPerYear(input.payPeriod);
  const adjusted = adjustWage(input);
  const schedule = withholdingRateSchedule({
    column: adjusted.column,
    year: input.year,
    multipleJobsCheckbox: adjusted.multipleJobsCheckbox,
  });

  const { tax, details } = applyBrackets(adjusted.adjustedAnnualWage, schedule);
  const creditsApplied = Math.min(adjusted.annualCredits, tax);
  const beforeExtra = (tax - creditsApplied) / periods;
  const withholding = beforeExtra + adjusted.extraWithholding;
  const rounded = input.roundToWholeDollars
    ? Math.round(withholding)
    : roundCents(withholding);

  // Run the whole thing again one dollar higher rather than reading the rate off
  // the schedule: unused Step 3 credits make the true marginal rate zero well
  // above the zero-rate band, and a schedule lookup cannot see that.
  const marginalRate = roundCents(
    (withholdingBeforeExtraFor({ ...input, wagesThisPeriod: input.wagesThisPeriod + 1 }) -
      withholdingBeforeExtraFor(input)) *
      100,
  ) / 100;

  const notes = [...adjusted.notes, ...params.withholding.notes];

  if (input.filingStatus === 'marriedFilingSeparately') {
    const mfsTop = params.ordinaryBrackets.marriedFilingSeparately.find(
      (b) => b.rate === 0.35,
    )?.upTo;
    const singleTop = params.ordinaryBrackets.single.find((b) => b.rate === 0.35)?.upTo;
    if (mfsTop !== undefined && singleTop !== undefined && mfsTop < singleTop) {
      notes.push(
        'Married filing separately shares the single column of the Publication 15-T ' +
          `tables, whose 37% band begins at $${singleTop.toLocaleString('en-US')} of taxable ` +
          `income rather than the $${mfsTop.toLocaleString('en-US')} that applies on an MFS ` +
          'return. Above that, withholding is short by 2% of the difference.',
      );
    }
  }

  if (adjusted.annualCredits > tax && adjusted.annualCredits > 0) {
    notes.push(
      'Step 3 credits exceed the tentative withholding, so nothing is withheld and the ' +
        'excess is not carried anywhere. Any refund is claimed on the return.',
    );
  }

  return {
    year: params.year,
    payPeriod: input.payPeriod,
    payPeriodsPerYear: periods,
    column: adjusted.column,
    schedule: adjusted.multipleJobsCheckbox ? 'multipleJobsCheckbox' : 'standard',
    adjustedAnnualWage: roundCents(adjusted.adjustedAnnualWage),
    tentativeAnnualWithholding: tax,
    annualCreditsApplied: roundCents(creditsApplied),
    withholdingBeforeExtra: roundCents(beforeExtra),
    extraWithholding: roundCents(adjusted.extraWithholding),
    withholding: rounded,
    annualizedWithholding: roundCents(rounded * periods),
    marginalRate,
    rateSchedule: schedule,
    brackets: details,
    notes,
  };
}

export interface PaycheckInput extends WithholdingInput {
  /**
   * Wages subject to Social Security and Medicare this period, when they differ
   * from `wagesThisPeriod`.
   *
   * They usually do. A 401(k) deferral reduces federal income tax withholding
   * and not FICA; a §125 cafeteria plan premium reduces both. Omit this and FICA
   * is computed on `wagesThisPeriod`.
   */
  readonly ficaWagesThisPeriod?: number;
  /**
   * Social Security wages this employer has already paid the employee this
   * calendar year, used to apply the wage base. The base is per employer: an
   * employee with two jobs over-withholds and claims the excess on their return.
   */
  readonly yearToDateSocialSecurityWages?: number;
  /** Medicare wages paid year to date, used for the Additional Medicare threshold. */
  readonly yearToDateMedicareWages?: number;
}

/**
 * Everything an employer withholds from one paycheck, employee side, plus the
 * employer's matching share.
 *
 * The Additional Medicare Tax rule here is the one payroll code most often gets
 * wrong: an employer withholds 0.9% on wages above $200,000 that *it* paid this
 * calendar year, with no regard for filing status, and the employee reconciles
 * on Form 8959. A joint filer can be under-withheld (two $150,000 salaries owe
 * $450 with nothing withheld) or over-withheld (a single $230,000 earner filing
 * jointly with a non-earning spouse has $270 withheld and owes nothing).
 */
export function computePaycheck(input: PaycheckInput): PaycheckResult {
  const params = getYearParameters(input.year);
  const gross = nonNegative(input.wagesThisPeriod, 'wagesThisPeriod');
  const ficaWages =
    input.ficaWagesThisPeriod === undefined
      ? gross
      : nonNegative(input.ficaWagesThisPeriod, 'ficaWagesThisPeriod');
  const ytdSs = nonNegative(input.yearToDateSocialSecurityWages, 'yearToDateSocialSecurityWages');
  const ytdMedicare = nonNegative(input.yearToDateMedicareWages, 'yearToDateMedicareWages');

  const federal = computeWithholding(input);

  const baseRemaining = Math.max(0, params.socialSecurityWageBase - ytdSs);
  const ssWages = Math.min(ficaWages, baseRemaining);
  const socialSecurity = roundCents(ssWages * params.rates.socialSecurityEmployee);
  const medicare = roundCents(ficaWages * params.rates.medicareEmployee);

  const threshold = params.withholding.additionalMedicareWithholdingThreshold;
  const overThreshold = Math.max(
    0,
    Math.min(ficaWages, ytdMedicare + ficaWages - threshold),
  );
  const additionalMedicare = roundCents(overThreshold * params.rates.additionalMedicare);

  const ficaTotal = roundCents(socialSecurity + medicare + additionalMedicare);
  const totalWithheld = roundCents(federal.withholding + ficaTotal);

  const notes: string[] = [];
  if (baseRemaining === 0) {
    notes.push(
      `Social Security wages for the year have reached the $${params.socialSecurityWageBase.toLocaleString('en-US')} ` +
        'wage base with this employer, so no further OASDI is withheld.',
    );
  } else if (ssWages < ficaWages) {
    notes.push(
      'This paycheck crosses the Social Security wage base; only the part below it is ' +
        'subject to OASDI.',
    );
  }
  if (additionalMedicare > 0) {
    notes.push(
      'Additional Medicare Tax is withheld on wages above $200,000 from this employer ' +
        'regardless of filing status. The actual liability is settled on Form 8959.',
    );
  }

  return {
    year: params.year,
    payPeriod: input.payPeriod,
    grossPay: roundCents(gross),
    federalIncomeTax: federal,
    socialSecurity,
    medicare,
    additionalMedicare,
    ficaTotal,
    totalWithheld,
    takeHomeAfterFederal: roundCents(gross - totalWithheld),
    employerFica: {
      socialSecurity: roundCents(ssWages * params.rates.socialSecurityEmployer),
      medicare: roundCents(ficaWages * params.rates.medicareEmployer),
      total: roundCents(
        ssWages * params.rates.socialSecurityEmployer +
          ficaWages * params.rates.medicareEmployer,
      ),
    },
    socialSecurityWagesThisPeriod: roundCents(ssWages),
    notes,
  };
}

export interface WithholdingPlanInput extends WithholdingInput {
  /**
   * The tax the year is expected to produce — normally
   * `estimateFederalTax(...).totalTax`, less any credits already reflected there.
   */
  readonly targetAnnualTax: number;
  /** Pay periods left in the year. Defaults to a full year. */
  readonly payPeriodsRemaining?: number;
  /** Federal income tax already withheld this year, from all employers. */
  readonly withheldToDate?: number;
}

/**
 * Whether the current Form W-4 will cover a target liability, and what to put on
 * Step 4(c) if it will not.
 *
 * This is the question the withholding tables exist to answer and the one they
 * are worst at: the tables assume this job is the only income there has ever
 * been. A second job, a spouse's salary, self-employment income, or a capital
 * gain all break that assumption in the same direction, and the employee finds
 * out in April.
 */
export function withholdingPlan(input: WithholdingPlanInput): WithholdingPlan {
  const params = getYearParameters(input.year);
  const periods = payPeriodsPerYear(input.payPeriod);
  const remaining =
    input.payPeriodsRemaining === undefined
      ? periods
      : Math.max(0, Math.floor(input.payPeriodsRemaining));
  const withheldToDate = nonNegative(input.withheldToDate, 'withheldToDate');
  const target = nonNegative(input.targetAnnualTax, 'targetAnnualTax');

  const perPeriod = computeWithholding(input).withholding;
  const projected = roundCents(withheldToDate + perPeriod * remaining);
  const shortfall = roundCents(target - projected);

  const notes: string[] = [];
  if (remaining === 0 && shortfall > 0) {
    notes.push(
      'No pay periods remain, so withholding cannot be increased. The balance is due with ' +
        'the return, and a § 6654 estimated tax penalty may apply — see quarterlyEstimatedPayments.',
    );
  }
  if (shortfall > 0 && remaining > 0) {
    notes.push(
      'Withholding is treated as paid evenly across the year no matter when it happened ' +
        '(§ 6654(g)), so catching up through Step 4(c) late in the year still cures an ' +
        'earlier underpayment. A late estimated tax payment does not.',
    );
  }

  return {
    year: params.year,
    payPeriod: input.payPeriod,
    payPeriodsRemaining: remaining,
    withheldToDate,
    projectedAnnualWithholding: projected,
    targetAnnualTax: target,
    shortfall,
    extraWithholdingPerPeriod:
      shortfall > 0 && remaining > 0 ? roundCents(shortfall / remaining) : 0,
    projectedBalance: shortfall,
    notes,
  };
}

/**
 * The rate the next dollar of *annual* wages would be withheld at, read straight
 * off a schedule.
 *
 * Exposed for callers building their own worksheets. Prefer
 * {@link WithholdingResult.marginalRate}, which accounts for Step 3 credits.
 */
export function withholdingMarginalRateAt(options: {
  adjustedAnnualWage: number;
  column: WithholdingColumn;
  year?: number;
  multipleJobsCheckbox?: boolean;
}): number {
  return marginalRateAt(
    options.adjustedAnnualWage,
    withholdingRateSchedule({
      column: options.column,
      year: options.year,
      multipleJobsCheckbox: options.multipleJobsCheckbox,
    }),
  );
}
