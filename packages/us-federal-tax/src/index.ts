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

/** § 86 — the taxable portion of a Social Security benefit. */
export { socialSecurityTaxability } from './socialSecurity.js';
export type { SocialSecurityTaxabilityOptions } from './socialSecurity.js';
export { SOCIAL_SECURITY_TAXABILITY } from './data/social-security.js';
export type { SaltDeductionInput } from './salt.js';

export {
  KNOWN_ESTIMATE_INPUT_FIELDS,
  estimateFederalTax,
  quarterlyEstimatedPayments,
} from './estimate.js';
export type {
  EstimateInput,
  EstimateOptions,
  EstimateResult,
  QuarterlyPlan,
} from './estimate.js';

/** The unknown-input guard's own parts, for a caller who wants to run it early. */
export { nearestFields, unknownInputKeys } from './unknown-input.js';

export {
  PAY_PERIODS,
  PAY_PERIODS_PER_YEAR,
  computePaycheck,
  computeWithholding,
  withholdingColumn,
  withholdingMarginalRateAt,
  withholdingPlan,
  withholdingRateSchedule,
} from './withholding.js';
export type {
  PaycheckInput,
  WithholdingInput,
  WithholdingPlanInput,
} from './withholding.js';

export {
  FEDERAL_FIGURE_PROVENANCE,
  documentsBehindFigures,
  figureProvenance,
  figureProvenanceMatches,
} from './data/provenance.js';
export type { FigureSource, FigureSourceKind } from './data/provenance.js';
export { CODE_SOURCES, SCHEDULE_ONE_A_CODE_SOURCES } from './data/sources.js';

export { YEAR_2024 } from './data/2024.js';
export {
  YEAR_2025,
  SUPERSEDED_2025_STANDARD_DEDUCTION,
  OBBBA_2025_STANDARD_DEDUCTION_INCREASE,
} from './data/2025.js';
export { YEAR_2026 } from './data/2026.js';

export { FILING_STATUSES, WITHHOLDING_COLUMNS } from './types.js';
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
  LegacyW4,
  ModernW4,
  PayPeriod,
  PaycheckResult,
  QbiBusinessDetail,
  QbiDeductionResult,
  QualifiedBusiness,
  SaltCapParameters,
  SaltDeductionResult,
  ScheduleOneAParameters,
  Section199AParameters,
  SelfEmploymentTaxResult,
  SeparateReturnRule,
  SocialSecurityTaxabilityParameters,
  SocialSecurityTaxabilityResult,
  SteppedPhaseOut,
  W4,
  WithholdingColumn,
  WithholdingParameters,
  WithholdingPlan,
  WithholdingResult,
  YearParameters,
} from './types.js';
