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
export { applyBaseAmountSchedule } from './engine-core.js';
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
export {
  MARYLAND_COUNTIES,
  MD_COUNTY_RATE_CEILING,
  MD_COUNTY_RATE_FLOOR,
  MD_LOCAL_EITC_RATE_MULTIPLE,
  marylandCounties,
  marylandCounty,
} from './localities/maryland.js';
export {
  INDIANA_COUNTIES,
  IN_COUNTY_RATE_CEILING,
  indianaCounties,
  indianaCounty,
} from './localities/indiana.js';
export {
  MICHIGAN_CITIES,
  MI_CITY_EXEMPTIONS,
  MI_CITY_EXEMPTION_FLOOR,
  MI_CITY_ORDINARY_RATE_CEILING,
  MI_PUBLISHED_NONRESIDENT_RATES,
  michiganCities,
  michiganCity,
  michiganNonresidentRate,
} from './localities/michigan.js';
export {
  OHIO_MUNICIPALITIES,
  OHIO_MUNICIPAL_RATES,
  OH_UNVOTED_RATE_CEILING,
  ohioMunicipalities,
  ohioMunicipality,
} from './localities/ohio.js';
export {
  OH_BASE_AMOUNT,
  OH_TOP_BASE_AMOUNT_2025,
  OH_TOP_BASE_AMOUNT_CHAINED_2025,
  OH_ZERO_BAND_CEILING,
} from './states/ohio.js';
export {
  OHIO_EARNED_INCOME_DISTRICTS,
  OHIO_SCHOOL_DISTRICTS,
  OHIO_SCHOOL_DISTRICT_RATES,
  OH_SDIT_RATE_INCREMENT,
  OH_SDIT_SENIOR_CREDIT,
  ohioSchoolDistrict,
  ohioSchoolDistricts,
  ohioSchoolDistrictTaxesEarnedIncomeOnly,
} from './localities/ohio-school-districts.js';
export {
  CITY_TAX_STATES,
  COUNTY_TAX_STATES,
  citiesFor,
  cityDefinition,
  countiesFor,
  countyDefinition,
  normaliseCounty,
} from './localities/counties.js';
export { NYC_ADDITIONAL_TAX_RATE, NYC_PERMANENT_RATES, nycRate } from './localities/new-york.js';
export { massachusettsSurtaxThreshold } from './states/massachusetts.js';
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
  IncomeClassDetail,
  LocalIncomeTaxResult,
  LocalTaxJurisdiction,
  LocalityCode,
  ParameterStatus,
  PersonRetirementIncome,
  RetirementIncomeSplit,
  StateCode,
  StateDefinedBaseField,
  StateIncomeTaxInput,
  StateIncomeTaxResult,
  SurtaxDetail,
} from './types.js';
export type {
  AgeBand,
  ByChildCount,
  CapitalGainsSurtaxRule,
  ChildCreditRule,
  CreditStep,
  BaseAmountBand,
  BusinessIncomeRule,
  DeductionRule,
  EarnedIncomeCreditRule,
  ExemptionCreditRule,
  ExemptionRule,
  ForgivenessRule,
  HouseholdCreditRule,
  IncomeClassRule,
  IncomeMeasure,
  JointFilingCreditRule,
  ItemizedDeductionRule,
  OwnEarnedIncomeCreditRule,
  AgedIncomeSubtractionRule,
  MilitaryRetirementSubtractionRule,
  PayrollTaxDeductionRule,
  PensionExclusionRule,
  PropertyTaxReliefRule,
  RateRule,
  RecaptureRule,
  RentDeductionRule,
  RetirementExclusionRule,
  RetirementIncomeCreditRule,
  SeniorCreditRule,
  SteppedChildCreditRule,
  StateIncomeTaxDefinition,
  SurtaxRule,
  TaxpayerCreditRule,
  YoungChildCreditRule,
  ZeroTaxThresholdRule,
} from './definition.js';
export type {
  LocalBase,
  LocalIncomeTaxDefinition,
  LocalPerPersonCreditRule,
  SchoolTaxCreditRule,
  SlidingEarnedIncomeCreditRule,
} from './localities/definition.js';
