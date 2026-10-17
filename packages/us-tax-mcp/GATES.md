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

## Where it stands (Day 53)

**47 gates. 13 derived, 34 literal — and the eight the derivation CHANGED are in
`test/state-field-witnesses.test.js`'s header with what each was worth.**

### THE INVENTORY BELOW CONTAINED TWO OF THE EIGHT, SIDE BY SIDE, AND DID NOT SAY SO

This is the most useful thing on this page and it is about the page rather than the code.
Two rows of the Day 52 table name a state list and the definition keys that would imply
it, and the two columns disagree:

```text
earnedIncome              CA GA OH MD           ownEarnedIncomeCredit, retirementExclusion, +2
                                                `retirementExclusion` is declared by NJ
                                                ALONE, and NJ is not in the state list.
                                                GA is in the state list and is implied by
                                                no key at all.
stateItemizedDeductions   MD VA GA MO AL OR WI  itemizedDeduction, itemizedDeductionCredit, …
                                                `itemizedDeduction` is declared by
                                                AL,AZ,GA,MD,MO,OR,VA — Arizona included,
                                                and AZ is not in the state list.
```

Both were worth money: New Jersey `$420.00`, Arizona `$1,856.25`. **The document written
to make these lists derivable had already computed two of the answers and put them in
adjacent columns of the same row.**

**THE RULE: AN INVENTORY WHOSE TWO COLUMNS ARE BOTH WRITTEN BY HAND IS TWO CLAIMS, NOT A
CROSS-CHECK.** The fix is not a more careful table. It is that the key list is the only
hand-written column and the state list is computed from it — which is what
`state-fields.ts` now does, and the reason the rows below keep the KEYS and drop the
state lists.

### What the plan got right, and the one thing it got wrong

The shape proposed below — a declared map from input field to definition keys, with a
compile-time `satisfies` that each name is real — is what shipped. It was one level too
COARSE, in three ways that each cost a finding:

- **A key's PRESENCE is not its answer.** Alabama, Arizona and Oregon declare
  `itemizedDeduction.requiresFederalItemizing: false`, and Missouri declares
  `exemption.perDependent: 0` cited to the statute that zeroed it. A derivation on
  presence hands the field to all four. **A declared `0` or `false` is the state answering
  no, not asking the question.**
- **A key can hold a rule that does NOT read the field.** Kentucky declares
  `pensionIncomeExclusion`, which is in `RETIREMENT_READING_RULES`, and reads no age
  anywhere — so a key-level age derivation puts Kentucky in, which is where it already
  wrongly was.
- **The same fact can live under two different top-level keys.** Oregon's § 151(b) spouse
  is `exemptionCredit.separateReturnSpouse`, everyone else's is
  `exemption.separateReturnSpouse`.

So the unit is a DOTTED PATH with a value predicate, not a key: `declaredBy(...paths)` and
`matching(predicate, ...paths)` in `src/state-fields.ts`, 56 paths over seven lists. The
compiler still proves the first segment; `state-field-witnesses.test.js` proves every path
still reaches a figure, because a misspelt leaf is a place the derivation does not look.

### The 13 derived

```text
DERIVED  outOfStateMunicipalInterest                 MUNICIPAL_ADDBACK_STATES
DERIVED  federalIncomeTax                            FEDERAL_TAX_DEDUCTION_STATES
DERIVED  federalAdditionalChildTaxCredit             REFUNDABLE_CREDIT_STATES.additionalChildTaxCredit
DERIVED  federalRefundableAmericanOpportunityCredit  REFUNDABLE_CREDIT_STATES.refundableAmericanOpportunityCredit
DERIVED  retirement                                  RETIREMENT_STATES  (STATES_READING_RETIREMENT)
DERIVED  blindOrDisabled                             BLIND_STATES
DERIVED  spouseHasNoGrossIncomeAndIsNotADependent    SPOUSE_151B_STATES      (+OR, Day 53)
DERIVED  stateItemizedDeductions                     STATE_ITEMIZED_STATES   (+AZ, Day 53)
DERIVED  federalItemized                             FEDERAL_ITEMIZED_STATES (+SC, Day 53)
DERIVED  earnedIncome                                EARNED_INCOME_STATES    (+NJ, -GA, Day 53)
DERIVED  dependentAges                               DEPENDENT_AGE_STATES    (+CT, Day 53)
DERIVED  filerAge                                    OWN_AGE_STATES    (+AL +MO -KY, Day 53)
DERIVED  spouseAge                                   OWN_AGE_STATES    (+AL +MO -KY, Day 53)
```

### The 34 still literal, with their keys (Day 52's inventory, kept for the walk)

```text
DERIVED  outOfStateMunicipalInterest                 MUNICIPAL_ADDBACK_STATES
DERIVED  federalIncomeTax                            FEDERAL_TAX_DEDUCTION_STATES
DERIVED  federalAdditionalChildTaxCredit             REFUNDABLE_CREDIT_STATES.additionalChildTaxCredit
DERIVED  federalRefundableAmericanOpportunityCredit  REFUNDABLE_CREDIT_STATES.refundableAmericanOpportunityCredit
DERIVED  retirement                                  RETIREMENT_STATES  (STATES_READING_RETIREMENT)
DERIVED  blindOrDisabled                             BLIND_STATES
```

Grouped by what a derivation would have to read. **Every definition
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

A derived list says which states' DEFINITIONS declare a rule that reads the field. It does
not say the field changes the answer.

**This section, written on Day 52, named the two hardest cases in advance and both turned
out to be exactly the pairs the Day 53 instrument could not reach**: *"Oregon reads
`retirement` through a credit that needs age 62 and a low income together, and
`federalItemized` does nothing without `stateItemizedDeductions` beside it."* Oregon needed
a household built for it — `retiree-tiny`, because ORS 316.157's credit is reduced dollar
for dollar by household income over `$15,000` — and `federalItemized` for Maryland,
Missouri and Virginia is the only declared pair in the table with NO witness, because the
tool already refuses `stateItemizedDeductions` for those three unless the flag is `true`.
Both are in the new test, one as a named shape and one as the whole of its allowlist.

So the sweep is a GUARD and not a derivation. Both are wanted, and they fail differently:
the derivation is wrong when a definition path is missing from a list, the sweep is wrong
when no household reaches the provision. **And the day they disagree is the day one of them
is wrong**, which is how three of Day 53's narrowings were confirmed twice over.

`test/state-field-witnesses.test.js` replaces `state-field-gates.test.js` and closes the
blind spots that version had, each of which cost a finding. Its header lists them; the
short version is that a sweep is blind to a rule whose limit its single probe value sits
above, to anything that only shows when the field is OMITTED, to a probe value of the wrong
TYPE, to a MAXIMAL value where the rule subtracts one of the things that value contains, to
a parameter pair chosen by the wrong rate, and — Day 52's addition, which still holds — to
every household its own hand-built federal block cannot express. The new one takes its
federal block from the real federal engine.

## The question the gate never asked: is an accepted field USED?

Day 53's largest finding was not a list. `pennsylvaniaSpouseEligibilityIncome` and
`separatedFromSpouse` were in this table, so they were in the input schema, in
`describe_state`'s Pennsylvania section and in the accepted-argument list — and `tools.ts`
never mentioned either name. **The gate decides whether a field is ACCEPTED for a state;
nothing decided whether an accepted field was ever read.** Worth the whole Pennsylvania tax
where forgiveness is total: `$982.40` on one household.

Two checks catch it now and they are different instruments: the witness test fails when a
declared pair has no household that moves the answer, and a grep of `tools.ts` for every
`STATE_FIELDS` name is a ten-line script that names the same two. **The other nine tools
have input schemas and no table to compare against, so nothing says the same thing about
them yet** — see the worklist.
