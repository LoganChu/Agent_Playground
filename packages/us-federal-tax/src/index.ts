/**
 * us-federal-tax — a dependency-free US federal tax engine for JavaScript.
 *
 * Every published figure is traceable to the IRS Revenue Procedure it came from
 * via `getYearParameters(year).sources`.
 *
 * This library computes tax. It is not tax advice, and it does not model credits,
 * AMT, or state tax — see the README for the full list of what is and is not
 * covered.
 */

export {
  LATEST_YEAR,
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

export { qbiDeduction, section199AParameters } from './qbi.js';
export type { QbiDeductionInput } from './qbi.js';

export { saltCapParameters, stateAndLocalTaxDeduction } from './salt.js';
export type { SaltDeductionInput } from './salt.js';

export { estimateFederalTax, quarterlyEstimatedPayments } from './estimate.js';
export type { EstimateInput, EstimateResult, QuarterlyPlan } from './estimate.js';

export { YEAR_2026 } from './data/2026.js';

export { FILING_STATUSES } from './types.js';
export type {
  AdditionalDeductionPart,
  AdditionalDeductionsResult,
  Bracket,
  BracketDetail,
  CapitalGainsResult,
  Citation,
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
