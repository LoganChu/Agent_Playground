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
export { doubled } from './states/california.js';
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
  ParameterStatus,
  StateCode,
  StateIncomeTaxInput,
  StateIncomeTaxResult,
  SurtaxDetail,
} from './types.js';
export type {
  DeductionRule,
  ExemptionCreditRule,
  ExemptionRule,
  ForgivenessRule,
  RateRule,
  StateIncomeTaxDefinition,
  SurtaxRule,
  TaxpayerCreditRule,
} from './definition.js';
