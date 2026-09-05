/**
 * `us-state-tax` — US state individual income tax, for tax years 2025 and 2026.
 *
 * Dependency-free, MIT, and built around one claim: the rate is the easy part.
 * What decides whether a state number is right is the *starting point* — which
 * federal figure the state begins from, and which federal deductions it then adds
 * back — and that is the thing every table of "state tax rates" leaves out.
 *
 * Designed to take the output of `estimateFederalTax()` from the companion
 * `us-federal-tax` package directly, without a dependency in either direction:
 * {@link FederalBasis} is a structural subset of that package's `EstimateResult`.
 */
export { stateIncomeTax, applyBrackets, roundCents } from './engine.js';
export {
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  NO_INCOME_TAX_STATES,
  getStateDefinition,
  isSupported,
  stateName,
  supportedYears,
} from './states/index.js';
export {
  SUPPORTED_LOCALITIES,
  getLocalityDefinition,
  localityState,
} from './localities/index.js';
export { NYC_ADDITIONAL_TAX_RATE, NYC_PERMANENT_RATES, nycRate } from './localities/new-york.js';
export { ownEarnedIncomeCreditAt, childCountBand } from './engine.js';
export {
  doubled,
  CALEITC_2015_STATUTORY_AMOUNTS,
  CALEITC_ADJUSTMENT_FACTOR,
  CALEITC_RATES,
} from './states/california.js';
export { FILING_STATUSES } from './types.js';
export type {
  Bracket,
  BracketDetail,
  ByStatus,
  Citation,
  ConformityBase,
  CreditDetail,
  FederalBasis,
  FederalDeductionKey,
  FederalDeductionsTaken,
  FilingStatus,
  LocalIncomeTaxResult,
  LocalityCode,
  ParameterStatus,
  StateCode,
  StateIncomeTaxInput,
  StateIncomeTaxResult,
  SurtaxDetail,
} from './types.js';
export type {
  ByChildCount,
  ChildCreditRule,
  CreditStep,
  DeductionRule,
  EarnedIncomeCreditRule,
  ExemptionCreditRule,
  ExemptionRule,
  ForgivenessRule,
  HouseholdCreditRule,
  OwnEarnedIncomeCreditRule,
  RateRule,
  RecaptureRule,
  StateIncomeTaxDefinition,
  SurtaxRule,
  TaxpayerCreditRule,
  YoungChildCreditRule,
} from './definition.js';
export type {
  LocalBase,
  LocalIncomeTaxDefinition,
  LocalPerPersonCreditRule,
  SchoolTaxCreditRule,
  SlidingEarnedIncomeCreditRule,
} from './localities/definition.js';
