# The 47 gates, and which of them are DERIVED

`state_income_tax` pairs every per-state argument with the states that read it and
**refuses the argument for any other state**, on purpose: a silently ignored field is a
wrong answer with no symptom. The table is in `src/state-fields.ts`.

A refusal with a FALSE explanation is worse than the problem it solves. Day 51 found
eleven lists that had drifted — including a Social Security figure refused in fifteen
states that subtract it — and the refusal told the caller the field did not apply to
their state. **A field that is silently ignored is a wrong answer with no symptom; a
field that is REFUSED with a false explanation is a wrong answer the caller has been
argued out of.**

So the standing item is: every list in that table should be DERIVED from the engine's
own declarations rather than written here. This file is the inventory, so that the work
is a list to walk rather than a question to re-ask.

## Where it stands (Day 52)

**47 gates. 6 derived, 41 literal.**

```text
DERIVED  outOfStateMunicipalInterest                 MUNICIPAL_ADDBACK_STATES
DERIVED  federalIncomeTax                            FEDERAL_TAX_DEDUCTION_STATES
DERIVED  federalAdditionalChildTaxCredit             REFUNDABLE_CREDIT_STATES.additionalChildTaxCredit
DERIVED  federalRefundableAmericanOpportunityCredit  REFUNDABLE_CREDIT_STATES.refundableAmericanOpportunityCredit
DERIVED  retirement                                  RETIREMENT_STATES  (STATES_READING_RETIREMENT)
DERIVED  blindOrDisabled                             BLIND_STATES
```

The 41 literals, grouped by what a derivation would have to read. **Every definition
key named below was checked against the 80 keys `StateIncomeTaxDefinition` actually
declares** — the first draft of this table invented `ficaDeduction`, `incomeClasses`,
`localIncomeTax`, `municipalIncomeTax`, `cityIncomeTax`, `schoolDistrictIncomeTax` and
`taxForgiveness`, none of which exist. They are `payrollTaxDeduction`,
`separatelyRatedIncome`, `forgiveness`, and — for the local taxes — nothing at all,
which is the most useful thing in the table and is why it is a group of its own below.
**A plausible key name in a design document is the same defect as a misspelt one in a
derived list, one day earlier.**

```text
--- GENUINELY ONE STATE BY CONSTRUCTION: the state defines its own base, or the field
--- belongs to a locality registry rather than to a definition at all
pennsylvaniaTaxableIncome                 PA           stateDefinedBase
newJerseyGrossIncome                      NJ           stateDefinedBase
massachusettsFivePercentIncome            MA           stateDefinedBase
pennsylvaniaSpouseEligibilityIncome       PA           forgiveness
separatedFromSpouse                       PA           forgiveness
shortTermCapitalGains                     MA           separatelyRatedIncome
collectiblesGains                         MA           separatelyRatedIncome
longTermCapitalGainAfter2011              AZ           capitalGainsSubtraction
spouseAdjustedFederalAdjustedGrossIncome  VA           spouseTaxAdjustment
spouseClaimsAgeDeduction                  VA           ageDeduction
--- LOCALITY FIELDS. These derive from the LOCALITY REGISTRIES, not from
--- StateIncomeTaxDefinition: there is no definition key for "has counties". The engine
--- already exports marylandCounties(), indianaCounties(), michiganCities(),
--- ohioMunicipalities() and ohioSchoolDistricts(); the derivation is "the states whose
--- registry is non-empty for some supported year", and it is the cheapest group to do.
county                                    MD IN        county registries
city / workCity / workCityEarnings        MI OH        city and municipality registries
cityIncome                                MI           city registry
qualifyingWages                           OH           municipality registry
residentCreditRate                        OH           municipality registry
residentCreditLimitRate                   OH           municipality registry
schoolDistrict                            OH           school district registry
locality                                  NY           locality registry
yonkersNonresidentEarnings                NY           locality registry
--- TWO OR MORE STATES, each mapping to one or two definition keys. These are the lists
--- that can drift and the ones to derive first.
socialSecurityAndMedicarePaid             MA AL                   payrollTaxDeduction
businessIncome                            OH MO                   businessIncome, businessIncomeDeduction
bothSpousesHaveQualifyingIncome           OH VA                   jointFilingCredit, spouseTaxAdjustment
stateItemizedDeductions                   MD VA GA MO AL OR WI    itemizedDeduction, itemizedDeductionCredit, itemizerCredit
federalItemized                           MD VA GA MO             itemizedDeduction, itemizerCredit
netCapitalGain                            MD MO AZ SC WI          capitalGainsSubtraction, capitalGainsSurtax
taxExemptInterest                         UT CT OR                taxpayerCredit, socialSecurityBenefitAdjustment, + one more
lesserSpouseIncome                        VA SC WI                marriedCoupleCredit, spouseTaxAdjustment
federalPovertyGuideline                   VA MD                   povertyLevelCredit, lowIncomeCredit
dependentsAttendingCollege                NJ IN                   exemption
propertyTaxPaid                           NJ WI                   propertyTaxRelief, schoolPropertyTaxCredit
rentPaid                                  NJ MA WI                rentDeduction, propertyTaxRelief
earnedIncome                              CA GA OH MD             ownEarnedIncomeCredit, retirementExclusion, + two more
investmentIncome                          CA                      ownEarnedIncomeCredit (the investment-income CLIFF on it)
--- THE BIG FIVE. Each is read by many rules in many states, each list is the longest,
--- and each is therefore the most likely to be wrong -- Day 51's eleven were mostly
--- these. filerAge alone is read by agedCredit, agedIncomeSubtraction, ageDeduction,
--- seniorCredit, standardDeductionAgedOrBlindAddition, exemption, exemptionCredit, every
--- retirement rule with an age band, and the zeroTaxThreshold.
taxableSocialSecurity                     ~15 states
retirementIncome                          ~15 states
dependentAges                             ~15 states
filerAge                                  ~20 states
spouseAge                                 ~20 states
```

## The shape that fixes it

`RETIREMENT_READING_RULES` in `us-state-tax`'s `src/states/index.ts`, generalised:

```ts
export const INPUT_READING_RULES = {
  retirement: [ 'retirementIncomeSubtractions', 'pensionExclusion', /* ... */ ],
  taxableSocialSecurity: [ 'subtractsTaxableSocialSecurity', 'socialSecuritySubtraction', /* ... */ ],
  // ...
} as const satisfies Record<string, readonly (keyof StateIncomeTaxDefinition)[]>;
```

and `STATES_READING[field]` derived by filtering `SUPPORTED_STATES` on
`SUPPORTED_YEARS.some(year => RULES.some(rule => def[rule] !== undefined))`.

Three properties make it worth the work, and all three were paid for already:

1. **The `satisfies` is a compile-time proof that each name is a real key.** The first
   draft of `RETIREMENT_READING_RULES` named `centenarianSubtraction`, which is not a
   key — Maryland's centenarian rule IS `agedIncomeSubtraction` — and the build refused
   it. **A misspelt place in a derived list is a place the list does not look.**
2. **A new state needs no edit here.** `BLIND_STATES` was a literal `['NJ','IL','IN']`
   that was wrong on the day it was written and stayed wrong for five days; California,
   Michigan and Mississippi joined the engine and the derived version needed no edit to
   know it.
3. **The engine is where the fact lives.** The gate is a claim about which definitions
   read an input. Keeping it in the server is a second copy of a fact that must agree,
   which this module's own header calls a bug with a waiting period.

## What a derivation CANNOT do, and the honest alternative for those

A derived list says which states' DEFINITIONS declare a rule that reads the field. It
does not say the field changes the answer: Oregon reads `retirement` through a credit
that needs age 62 and a low income together, and `federalItemized` does nothing without
`stateItemizedDeductions` beside it. So `test/state-field-gates.test.js` — a sweep that
supplies a field and watches the tax — is a GUARD and not a derivation, and it can only
see a state whose tax moves in a household it happens to probe.

Both are wanted, and they fail differently: the derivation is wrong when a definition key
is missing from a list, the sweep is wrong when no household reaches the provision. The
sweep's own blind spot is worth writing down next to it — and Day 52 added a third kind
of blindness to the list, from the state package: **a sweep that builds its own federal
block can only probe households that block can express.** `state-field-gates.test.js`
builds one.
