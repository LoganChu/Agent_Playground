/**
 * us-federal-tax — a dependency-free US federal tax engine for JavaScript.
 *
 * Every published figure is traceable to the IRS Revenue Procedure it came from
 * via `getYearParameters(year).sources`.
 *
 * This library computes tax. It is not tax advice, and it does not model AMT or
 * state tax — see the README for the full list of what is and is not covered.
 */

export {
  LATEST_YEAR,
  SUPPORTED_YEARS,
  UnsupportedYearError,
  YEARS,
  applyBrackets,
  getYearParameters,
  marginalRateAt,
  roundCents,
  standardDeduction,
} from './core.js';

export {
  additionalMedicareTax,
  federalIncomeTax,
  ficaTax,
  longTermCapitalGainsTax,
  netInvestmentIncomeTax,
  selfEmploymentTax,
} from './taxes.js';

export {
  additionalDeductions,
  qualifiedOvertimeDeduction,
  qualifiedTipsDeduction,
  scheduleOneAParameters,
  seniorDeduction,
  vehicleLoanInterestDeduction,
} from './obbba.js';
export type { AdditionalDeductionsInput } from './obbba.js';

export {
  childTaxCredit,
  childTaxCreditParameters,
  earnedIncomeCredit,
  earnedIncomeCreditParameters,
  earnedIncomeCreditRow,
  earnedIncomeForCredits,
} from './credits.js';
export type { ChildTaxCreditInput, EarnedIncomeCreditInput } from './credits.js';

export { qbiDeduction, section199AParameters } from './qbi.js';
export type { QbiDeductionInput } from './qbi.js';

export { saltCapParameters, stateAndLocalTaxDeduction } from './salt.js';
export type { SaltDeductionInput } from './salt.js';

export { estimateFederalTax, quarterlyEstimatedPayments } from './estimate.js';
export type { EstimateInput, EstimateResult, QuarterlyPlan } from './estimate.js';

export { YEAR_2024 } from './data/2024.js';
export { YEAR_2025 } from './data/2025.js';
export { YEAR_2026 } from './data/2026.js';

export { FILING_STATUSES } from './types.js';
export type {
  AdditionalDeductionPart,
  AdditionalDeductionsResult,
  Bracket,
  BracketDetail,
  CapitalGainsResult,
  ChildTaxCreditParameters,
  ChildTaxCreditResult,
  Citation,
  CreditsResult,
  EarnedIncomeCreditParameters,
  EarnedIncomeCreditResult,
  EarnedIncomeCreditRow,
  FicaResult,
  FicaSide,
  FilingStatus,
  IncomeTaxResult,
  QbiBusinessDetail,
  QbiDeductionResult,
  QualifiedBusiness,
  SaltCapParameters,
  SaltDeductionResult,
  ScheduleOneAParameters,
  Section199AParameters,
  SelfEmploymentTaxResult,
  SteppedPhaseOut,
  YearParameters,
} from './types.js';
