/**
 * The per-state fields of `state_income_tax`, and the one place they are
 * documented.
 *
 * Twenty-eight states and 1,033 local taxes do not need the same inputs, and
 * until this file existed `state_income_tax` carried all of them fully described
 * in its input schema. That is **16,500 bytes paid by every client on every
 * session to describe the one state they named and twenty-seven they did not**,
 * and it is 36% of a `tools/list` payload that had reached 44,945 bytes against a
 * 45,000-byte ceiling. Utah was the state that ran the payload into the wall.
 *
 * Day 21 found the rule that fixes it: *when a schema already tells the reader
 * where the real documentation lives, the duplicate beside it is not
 * documentation.* It did not reach this tool, because the three tools it fixed
 * could point at `estimate_federal_tax` and there was no second tool for
 * `state_income_tax` to point at. **So this is the second tool.**
 *
 * What stays in the schema is everything a client needs to make a legal call:
 * the field, its type, and which states it belongs to. What moves here is the
 * prose — what the figure is, which form line it comes off, and what happens if
 * it is left out. A caller who has named a state gets exactly their state's
 * share of it from `describe_state`, and a caller who has not named one pays for
 * none of it.
 *
 * The table is also the single source of truth for the state lists, which used
 * to appear twice: once in the schema description a model reads and once in the
 * validation that rejects the call. Two copies of a fact that must agree is a
 * bug with a waiting period, so `test/state-fields.test.js` calls the tool with
 * each field against a state the table excludes and requires the refusal.
 */
import type { JsonSchema } from './schema.js';
import {
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
} from './state-engine/index.js';

/**
 * The states that read `blindOrDisabled`, DERIVED from the engine.
 *
 * It was a literal `['NJ', 'IL', 'IN']` until Day 26, and it was wrong on the
 * day it was written: Maryland, Massachusetts and Virginia all carried a blind
 * exemption already, and Maryland's own note tells the caller to pass this very
 * field. The loop at the bottom of `state_income_tax` refuses a field a state
 * is not listed for, so this server was refusing Maryland callers a figure the
 * Maryland return needs — on the strength of a list nobody had checked since
 * the field was added.
 *
 * That is this module's own header, which says two copies of a fact that must
 * agree is a bug with a waiting period. The waiting period was five days.
 * California, Michigan and Mississippi joined the engine on Day 26 and this
 * list needed no edit to know it.
 */
const BLIND_STATES: readonly string[] = SUPPORTED_STATES.filter((code) =>
  SUPPORTED_YEARS.some((year) => {
    const def = getStateDefinition(code, year);
    return (
      def?.exemption?.perBlindOrDisabledFiler !== undefined ||
      def?.exemptionCredit?.perBlindOrDisabledFiler !== undefined
    );
  }),
);

export interface StateField {
  /** The argument name, as `state_income_tax` takes it. */
  readonly name: string;
  /** The JSON Schema fragment, less its description. */
  readonly schema: JsonSchema;
  /** The state codes this field means anything for. */
  readonly states: readonly string[];
  /**
   * States that will not compute without it. These are the fields whose absence
   * is a wrong answer rather than a missing one, and `describe_state` says so
   * first.
   */
  readonly requiredIn?: readonly string[];
  /** The documentation, served by `describe_state` and nowhere else. */
  readonly doc: string;
  /**
   * The second sentence of the refusal, where this field had a message worth
   * more than the generic one. The generic message names the field and its
   * states; this says what the caller should do instead.
   */
  readonly refusal?: string;
}

const number: JsonSchema = { type: 'number' };
const integer: JsonSchema = { type: 'integer' };
const string: JsonSchema = { type: 'string' };
const boolean: JsonSchema = { type: 'boolean' };

/**
 * A person's retirement income, in the four states that need it split.
 *
 * The sub-schema keeps its property names and types — a client has to know the
 * shape to build a legal object — and loses the 1,400-character description of
 * what each one means, which is now in {@link STATE_FIELDS} under `retirement`.
 */
const PERSON_RETIREMENT: JsonSchema = {
  type: 'object',
  properties: {
    employerPlanPension: number,
    iraDistributions: number,
    investmentIncome: number,
    earnedIncome: number,
    socialSecurityBenefits: number,
    militaryRetirement: number,
    totallyDisabled: boolean,
    governmentPension: number,
    serviceMonthsBefore1998: number,
    serviceMonthsAfter1997: number,
  },
  additionalProperties: false,
};

export const STATE_FIELDS: readonly StateField[] = [
  {
    name: 'pennsylvaniaTaxableIncome',
    schema: number,
    states: ['PA'],
    requiredIn: ['PA'],
    doc: 'Pennsylvania compensation and other taxable income. Pennsylvania has no federal starting line at all: it taxes 401(k) deferrals in the year they are contributed, allows no deduction and no exemption, and there is no federal figure that stands in for it. Refused for any other state.',
  },
  {
    name: 'newJerseyGrossIncome',
    schema: number,
    states: ['NJ'],
    requiredIn: ['NJ'],
    doc: 'NJ-1040 line 27, before the retirement exclusion. NOT federal AGI: New Jersey excludes Social Security and unemployment entirely and taxes 403(b) deferrals and IRA contributions that the federal return let through. Refused for any other state.',
  },
  {
    name: 'massachusettsFivePercentIncome',
    schema: number,
    states: ['MA'],
    requiredIn: ['MA'],
    doc: 'Form 1 line 21, total 5.0% income — interest, dividends and LONG-term gains included, short-term and collectibles gains excluded because they are taxed at 8.5% and 12% on their own lines. NOT federal AGI; the result names the add-backs Massachusetts needs. Refused for any other state.',
  },
  {
    name: 'shortTermCapitalGains',
    schema: number,
    states: ['MA'],
    doc: 'Net gains on assets held one year or less, taxed at 8.5% rather than 5%. Do not also include them in massachusettsFivePercentIncome. This is the reason every table that reports Massachusetts as a flat 5% is wrong about it.',
  },
  {
    name: 'collectiblesGains',
    schema: number,
    states: ['MA'],
    doc: 'Long-term gains on collectibles and pre-1996 installment sales, taxed at 12% on HALF the gain. Pass the whole gain; the 50% deduction is applied here.',
  },
  {
    name: 'socialSecurityAndMedicarePaid',
    schema: number,
    states: ['MA'],
    doc: 'FICA, Medicare, railroad and public retirement contributions paid, deducted up to $2,000 per filer. There is no federal equivalent — the federal return never deducts the employee half of FICA — so this figure comes off a W-2 and nothing else.',
  },
  {
    name: 'county',
    schema: string,
    states: ['MD', 'IN'],
    requiredIn: ['MD', 'IN'],
    refusal:
      'county applies to a return in IN or MD, the two states where every resident owes one; no ' +
      'other supported state levies a county income tax, and returning zero for it would be a ' +
      'wrong answer rather than a missing one.',
    doc: 'The county the filer lived in on 1 January. EVERY resident of Maryland and Indiana owes a county income tax on the same taxable income — 2.25%-3.30% in MD, 0.5%-3.00% in IN — so this is a third to two fifths of the whole bill and it appears in no table of state rates. Neither state has a county-free jurisdiction, so an omitted county is not a smaller answer, it is a wrong one. "Baltimore" alone errors: the City and the County are different jurisdictions with different rates.',
  },
  {
    name: 'city',
    schema: string,
    states: ['MI', 'OH'],
    doc: 'The city or municipality the filer LIVES in. Michigan has 24 that levy — Detroit at 2.4%, twenty at 1% — and most Michiganders live in none of them; Ohio has 679 at 0.45%-3.00% and most Ohioans live in one. An unlisted name is an error that lists the alternatives.',
  },
  {
    name: 'cityIncome',
    schema: number,
    states: ['MI'],
    doc: 'Income as the CITY measures it, before its $600-$3,000 exemptions. The Uniform City Income Tax Ordinance excludes pensions, IRA distributions, Social Security, unemployment and military pay entirely, so this is a base the MI-1040 does not contain. Omitted, it is derived from federal AGI less retirementIncome and runs high.',
  },
  {
    name: 'qualifyingWages',
    schema: number,
    states: ['OH'],
    doc: 'O.R.C. 718.01(R) wages — box 5 of the W-2, which a 401(k) deferral does NOT reduce — plus a resident\'s net business or rental profit. Interest, dividends, gains, pensions and Social Security are outside it, so federal AGI is a different figure and using it overstates a retiree and understates a saver. REQUIRED whenever city is given for Ohio.',
  },
  {
    name: 'businessIncome',
    schema: number,
    states: ['OH'],
    doc: 'Schedule IT BUS line 10, before the deduction. Ohio deducts the first $250,000 ($125,000 separate) and taxes the excess at a FLAT 3%, so $250,000 of Schedule C profit costs $0 where $250,000 of wages costs $7,022.45. Omitted, the tax runs high. A TRADITIONAL school district adds the deduction straight back.',
  },
  {
    name: 'bothSpousesHaveQualifyingIncome',
    schema: boolean,
    states: ['OH', 'VA'],
    doc: 'True where EACH spouse on a joint return had income of their own — in Ohio, $500 or more of Ohio AGI less interest, dividends, capital gains and rent. Two states ask the same question and pay differently for the answer: Ohio\'s joint filing credit is a percentage of the tax capped at $650, and Virginia\'s spouse tax adjustment is a flat $257.50 because Virginia never doubled its brackets. Omitted, both are zero.',
  },
  {
    name: 'workCity',
    schema: string,
    states: ['MI', 'OH'],
    doc: 'A DIFFERENT taxing city the filer worked in, charged on workCityEarnings. Michigan halves the rate for a nonresident and caps the home city\'s credit at its OWN nonresident rate, so a Lansing resident commuting to Detroit pays 70% more city tax than one working at home. Ohio halves nothing and has no statutory resident credit at all.',
  },
  {
    name: 'workCityEarnings',
    schema: number,
    states: ['MI', 'OH'],
    doc: 'Wages earned inside workCity, already apportioned by working days (Form DW-4, GRW-4). Required whenever workCity is given: without it the nonresident city tax is zero, which is a wrong answer rather than a missing one.',
  },
  {
    name: 'residentCreditRate',
    schema: number,
    states: ['OH'],
    doc: 'The share of the workCity tax the HOME municipality credits — Ohio\'s "Credit Rate" column. Omitted, the modal 100%-capped-at-the-home-rate ordinance is assumed and the result says so. Ohio sets this by ordinance rather than by statute, which is why it is an input.',
  },
  {
    name: 'residentCreditLimitRate',
    schema: number,
    states: ['OH'],
    doc: 'The rate that credit is capped at — Ohio\'s "Credit Factor" column. A home municipality credits the LESSER of residentCreditRate applied to the work-city tax and this rate applied to the same income, so a city with a 100% credit rate and a 1.5% credit factor still charges a commuter who works somewhere dearer. Ohio has no statutory resident credit at all, so both figures come from the home city\'s own ordinance.',
  },
  {
    name: 'schoolDistrict',
    schema: string,
    states: ['OH'],
    doc: 'The four-digit district the filer LIVES in, as a string — "0203", not 203. 214 Ohio districts levy 0.25%-2.00% on a separate SD 100, over and above the state and municipal taxes: 146 on modified AGI less exemptions, which ADDS THE BUSINESS INCOME DEDUCTION BACK, and 68 on earnedIncome alone, which they REQUIRE. So one Ohio paycheck is taxed on three bases that disagree about what a wage is.',
  },
  {
    name: 'stateItemizedDeductions',
    schema: number,
    states: ['MD', 'VA', 'GA'],
    doc: 'Federal Schedule A less the state and local INCOME taxes inside it. Needs federalItemized. Maryland reduces it by 7.5% of federal AGI over $200,000 ($100,000 separate); Virginia and Georgia COMPEL it, so a federal itemizer may not take the state standard deduction even when it is larger. Georgia does NOT require the state income tax to come out — its adjustment is for taxes paid to other states and investment interest on exempt income — so pass the Georgia figure as the IT-511 worksheet computes it.',
  },
  {
    name: 'federalItemized',
    schema: boolean,
    states: ['MD', 'VA', 'GA'],
    doc: 'Whether the filer itemized federally. Maryland allows state itemizing only if they did, so the OBBBA standard deduction ended it for many; Virginia and Georgia go further and REQUIRE itemizing on the state return if they did. In GEORGIA this flag is worth money by itself: the eligible itemizer tax credit of O.C.G.A. § 48-7-27.1 pays $300 a taxpayer ($600 joint) for the election alone, with no income test at any level and no state itemized figure needed. At 4.99% that is $6,012 of deduction, so a Georgia filer whose itemized deductions fall that far SHORT of the standard deduction still comes out ahead.',
  },
  {
    name: 'netCapitalGain',
    schema: number,
    states: ['MD'],
    doc: 'Net capital gain inside Maryland taxable income, surtaxed 2% when federal AGI exceeds $350,000. The threshold is a test rather than a floor, so one dollar of AGI at $350,000 can cost $6,933.08. Exclude a principal residence sold for $1.5M or less, § 179 property and retirement-account gains.',
  },
  {
    name: 'taxExemptInterest',
    schema: number,
    states: ['UT'],
    doc: 'Tax-exempt interest, 1040 line 2a. Utah adds it back into the modified AGI its retirement credits are withdrawn against (§ 59-10-1019(1)(b), § 59-10-1042(1)(b)), so a municipal bond is taxed at 2.5% in Utah while appearing on no line of Utah income: $10,000 of it costs a retired couple exactly $250.00 of Utah tax and $0.00 of federal tax. Leave it out and a bondholding Utah retiree comes back too low.',
  },
  {
    name: 'taxableSocialSecurity',
    schema: number,
    states: ['VA', 'MD', 'GA', 'KY', 'UT'],
    doc: 'Social Security and Tier 1 railroad benefits INSIDE federal AGI — 1040 line 6b, not 6a, which is estimate_federal_tax socialSecurity.taxableBenefits. VA, MD, GA and KY SUBTRACT it, and Virginia also tests its age deduction on AGI less it. Utah is the opposite and is the reason to read this: Utah TAXES the benefit and then hands the tax back as a credit (code AH), withdrawn at 2.5 cents per dollar of modified AGI over $90,000 joint, $54,000 single, $45,000 separate — so in Utah this figure sets the size of a credit rather than a subtraction, and a Utah retiree without it comes back far too high. Do not also net it into stateSubtractions. Maryland needs the TOTAL received as well, in retirement.',
  },
  {
    name: 'outOfStateMunicipalInterest',
    schema: number,
    states: ['IL'],
    doc: "Interest on the obligations of OTHER states and their municipalities — the part of 1040 line 2a the filer's own state did not issue. Illinois adds it to base income (35 ILCS 5/203(a)(2)(A)) while exempting its own, so an Illinois bondholder owes tax on income the FEDERAL RETURN NEVER SAW, and an engine that starts at federal AGI and stops is too LOW. It is NOT taxExemptInterest, which is the total and would tax an Illinois resident on Illinois bonds: the split exists on no federal form. Omitted, an Illinois return with out-of-state bonds is understated by 4.95% of them. Every other state here that does the same thing takes it through stateAdditions.",
    refusal:
      'Only Illinois reads it here. Every other state that adds back another state\'s municipal interest — and most of them do — takes it through stateAdditions, because this package will not assert a list of twenty-eight states it has not checked one at a time.',
  },
  {
    name: 'retirement',
    schema: {
      type: 'object',
      properties: {
        filer: PERSON_RETIREMENT,
        spouse: { type: 'object', description: "The spouse's own, same fields." },
      },
      additionalProperties: false,
    },
    states: ['MD', 'GA', 'KY', 'UT', 'IL', 'MS', 'MI', 'NY', 'NC'],
    doc: [
      'Retirement income PER PERSON, because these states do not read it off a federal AGI and four of them cap an exclusion per person — so a return\'s totals do not determine its tax. Omit it and everything lands on one spouse, which is the worst of the cases, and the result says so in the name of the subtraction.',
      'NINE states read this. Four of them — IL, MS, MI, NY — exempt most or all of a pension and BEFORE v0.19.0 taxed it unless the caller netted it out through stateSubtractions. They no longer do, so a caller who is still passing both now subtracts twice: take it out of stateSubtractions.',
      '  IL — everything, no cap, NO AGE TEST. A 40-year-old drawing a pension owes Illinois nothing on it.',
      '  MS — everything, no cap, at 59½. An early distribution is taxable (§ 27-7-15(4)(l)).',
      '  MI — ONE cap for the RETURN, keyed to the OLDER spouse: $67,610 single / $135,220 joint for 2026, and 75% of the 2025 figures for 2025. Military pay is exempt in full and comes OFF that cap.',
      '  NY — $20,000 PER PERSON at 59½, unused room lost, AND a federal, NY State or NY local government pension exempt in full at ANY age. Put a government pension in governmentPension, not employerPlanPension: the two differ by the whole of the tax.',
      '  NC — taxes every pension in FULL and deducts military retired pay in full. It is in every list of retiree-friendly states and does not belong there.',
      'Fields, on filer and spouse alike:',
      '  employerPlanPension — taxable pension from a qualified plan, 401(a), 401(k), 403(b) or 457(b). NOT an IRA, Roth, ROLLOVER IRA, SEP or 457(f), which MD § 10-209(a) excludes by name and GA counts in full.',
      '  iraDistributions — taxable IRA and Roth-conversion income, 1040 line 4b. GA-qualifying, MD-disqualifying: the rollover every adviser recommends costs $0.00 in Georgia and $3,428.03 a year in Maryland.',
      '  investmentIncome — interest, dividends, net capital gain, rents, royalties, alimony. GA only, and may be negative. It is in Georgia\'s pool, which makes the "retirement income exclusion" also a capital gains allowance.',
      '  earnedIncome — wages plus partnership and S corp income. GA counts at most $5,000 of it per person, and doubles the military exclusion above $17,500.',
      '  socialSecurityBenefits — the TOTAL received, Tier I and Tier II, taxable or not. MD charges the whole of it against its exclusion; GA charges nothing.',
      '  militaryRetirement — retired or survivor pay, not also counted in employerPlanPension. MD subtracts it with no age gate, GA excludes it only BELOW 62, UT credits it at the state rate with no phase-out at all.',
      '  totallyDisabled — qualifies at any age, and in MD for the spouse too.',
      '  governmentPension — KY and NY: federal, Commonwealth or Kentucky local retired pay, military service included. New York exempts a federal, NY State or NY local pension in full and at any age, which is the largest single fact about a New York retirement. The share attributable to service before 1 January 1998 is exempt WITHOUT LIMIT and does not consume the $31,110, so Kentucky has no maximum for that cohort.',
      '  serviceMonthsBefore1998, serviceMonthsAfter1997 — KY only: months of service credit either side of the cutoff, which set that share. A person who retired before 1998 has none after.',
      'Utah needs only militaryRetirement here.',
    ].join('\n'),
  },
  {
    name: 'lesserSpouseIncome',
    schema: number,
    states: ['VA'],
    doc: 'Line 5 of the Spouse Tax Adjustment Worksheet — the SMALLER spouse\'s Virginia AGI less their exemptions. Omitted, an even split is assumed, which produces the adjustment\'s $257.50 maximum, and the result says so.',
  },
  {
    name: 'federalPovertyGuideline',
    schema: number,
    states: ['VA', 'MD'],
    doc: 'Overrides the HHS guideline two credits are a cliff at. VA: the $300-a-head Credit for Low Income Individuals — pass 0 to switch it off for a filer barred from it by a military or state-employee subtraction this server cannot see. MD: the poverty level credit, which forgives the WHOLE Maryland bill, state and county, below the guideline. The guideline is republished every January for a year already under way, so a caller with the real figure should pass it.',
  },
  {
    name: 'dependentsAttendingCollege',
    schema: integer,
    states: ['NJ', 'IN'],
    doc: 'Dependents in full-time study, also counted in dependents. NJ: under 22, a second $1,000 exemption on top of the $1,500 dependent one. IN: the only way a dependent aged 19 to 23 reaches the $1,500 child exemption, which otherwise stops at 18.',
  },
  {
    name: 'retirementIncome',
    schema: number,
    states: ['NJ', 'OH', 'MI', 'IL', 'MS', 'NY'],
    doc: 'Taxable pension, annuity and IRA withdrawals as a RETURN total. IL, MS, MI and NY will subtract it under their own rules if `retirement` is not supplied, placing all of it on the first filer — which understates the New York exclusion, the only one of the four that is capped per person. New Jersey excludes up to $100,000 joint / $75,000 single at 62 or over, ending in a wall at $150,000 of total income that costs a joint retiree $1,381 on one dollar. Ohio bands a small retirement income credit on it. Michigan derives cityIncome from federal AGI less this figure when cityIncome is omitted. MD, GA, KY and UT read `retirement` instead, because theirs are per person.',
  },
  {
    name: 'propertyTaxPaid',
    schema: number,
    states: ['NJ'],
    doc: 'Property tax paid on a principal residence in the state. New Jersey allows a $15,000 deduction OR a flat $50 refundable credit, and the engine computes the return both ways and keeps the lower tax — which is not the same as taking the larger deduction.',
  },
  {
    name: 'rentPaid',
    schema: number,
    states: ['NJ', 'MA'],
    doc: 'Rent paid on a principal residence in the state. New Jersey treats 18% of it as property tax, and ignores it when propertyTaxPaid is given; Massachusetts deducts half of it, capped at $4,000.',
  },
  {
    name: 'locality',
    schema: string,
    states: ['NY'],
    doc: 'The locality the filer LIVES in. New York City charges 3.078%-3.876% of state taxable income — more than the entire state tax of thirteen of the supported states — and Yonkers charges a surcharge of 16.75% of the state tax. Omitting it for a city resident understates the bill by thousands.',
  },
  {
    name: 'yonkersNonresidentEarnings',
    schema: number,
    states: ['NY'],
    doc: 'Wages earned in Yonkers by someone who lives elsewhere, taxed at 0.5%. Ignored when locality is YONKERS: a resident pays the surcharge instead, never both.',
  },
  {
    name: 'investmentIncome',
    schema: number,
    states: ['CA'],
    doc: 'Interest (taxable and tax-exempt), dividends, net capital gain, net rent and royalty income. California only, where above $4,814 it is a CLIFF that costs the whole CalEITC.',
  },
  {
    name: 'earnedIncome',
    schema: number,
    states: ['CA', 'GA', 'OH', 'MD'],
    doc: 'Wages plus net self-employment earnings. REQUIRED in practice for a low-income Maryland filer: the poverty level credit is 5% of it against the state tax and the county\'s own rate against the county tax, and between them they take a $15,000 Maryland worker from $160.85 to nothing. Required for California, where the CalEITC and the Young Child Tax Credit are functions of earnings alone rather than of AGI — and CalEITC has no plateau at all, so a single parent faces minus 34% and plus 34% on consecutive dollars. REQUIRED for Ohio when schoolDistrict names one of the 68 districts that tax earned income alone: they reach box 1 of the W-2, net of a 401(k) deferral, where the same filer\'s municipality reaches box 5, gross of it.',
  },
  {
    name: 'dependentAges',
    schema: { type: 'array', items: integer },
    states: ['NY', 'CA', 'NJ', 'MA', 'MD', 'UT', 'GA', 'IN'],
    doc: 'Age of EVERY dependent at year end, not only the children. IN: a dependent CHILD carries $1,500 of exemption that a dependent parent does not, so a count alone costs an Indiana family $74.55 a child in Marion County. Seven states band a credit by age and return ZERO without it, and the result says what that cost. UT: $1,000 for each child under 6, withdrawn at TEN cents on the dollar — 2.2 times the state rate — so a Utah working couple reaches 20% on the next dollar against a headline 4.45%. GA: $250 for each child under 6 from 2026 (HB 136), with no phase-out at any income.',
  },
  {
    name: 'filerAge',
    schema: integer,
    states: ['VA', 'NJ', 'MD', 'GA', 'KY', 'UT', 'OH', 'IL', 'MS', 'MI', 'NY', 'IN', 'CA'],
    doc: 'Filer age at year end. CA: one MORE personal exemption CREDIT at 65 — $153, worth the same at every rate and every income, and claimed per person, so a couple both 65 claim four personal exemptions rather than two. MS: $1,500 of extra exemption at 65, on the same line as the dependents. IN: $1,000 of extra exemption at 65 and $500 MORE where federal AGI is under $40,000 — a cliff, so one dollar of income at $40,000 costs a joint retired couple $49.75 in Marion County. IL: $1,000 of extra exemption at 65 — and NOTHING for the retirement subtraction, which has no age test at any point, so Illinois is the one state here where a 40-year-old retiree owes nothing. MS: 59 1/2 for the retirement exemption, because an early distribution stays taxable. NY: 59 1/2 for the $20,000 pension exclusion — but a GOVERNMENT pension is exempt at any age, so a police officer who left at 45 pays nothing fourteen years before anyone else. MI: for 2025 only, the phased-in deduction runs from a birth year of 1946 to 1966, so ages 59 to 79, and the whole RETURN is keyed to the OLDER spouse. VA: an $800 exemption at 65 and the $12,000 age deduction, withdrawn DOLLAR FOR DOLLAR over $50,000 ($75,000 joint). NJ: $1,000 at 65, the retirement exclusion at 62. MD: $1,000 and the senior credit at 65, the pension exclusion at 65, $100,000 at 100. GA: $35,000 excluded at 62, $65,000 at 65, and the military exclusion BELOW 62 only. UT: the retirement credit (code 18) needs a birth year of 1952 or earlier, so 74 or over in 2026. KY has no age test at all, which is what makes it the one an early retiree can use. Omitted, a retiree return runs far too high.',
  },
  {
    name: 'spouseAge',
    schema: integer,
    states: ['VA', 'NJ', 'MD', 'UT', 'GA', 'KY', 'IL', 'MS', 'MI', 'NY', 'IN', 'CA'],
    doc: 'Spouse age at year end, joint returns. California and Mississippi both claim their age allowance PER PERSON, so the second spouse at 65 is worth another $153 in California and another $60 of Mississippi tax. MI is the one that runs the other way: its cap is one figure for the RETURN and is keyed to the OLDER spouse, so a 66-year-old married to a 58-year-old qualifies the younger spouse\'s pension too. NY and MS test each person separately and IL tests nobody. Virginia gives a SECOND $12,000 age deduction withdrawn over the same band, so two 65-year-olds face 11.5% on $24,000 of income. New Jersey\'s senior exemption is per person, and Utah\'s code 18 credit is $450 a head.',
  },
  {
    name: 'blindOrDisabled',
    schema: integer,
    states: BLIND_STATES,
    doc: 'How many of filer and spouse are blind or disabled, 0-2. MICHIGAN\'s is the largest here: the $3,400 special exemption of MCL 206.30(3)(a), worth $144.50, and it covers deafness and total disability under 66 as well as blindness. MASSACHUSETTS allows $2,200. CALIFORNIA states it as a CREDIT rather than a deduction — $153 a person, worth the same at every rate and at every income, and it stacks with the $153 California adds at 65, so a blind Californian of 65 claims three personal exemptions. MISSISSIPPI adds $1,500, on the same line as the dependents and the $1,500 it adds at 65. Indiana and Illinois each add $1,000, stacking with the $1,000 each adds at 65 — and neither Illinois figure is indexed, where the $2,850 beside them moves with the CPI every year. New Jersey adds $1,000, cumulative with its age exemption. Maryland adds $1,000, and unlike its $3,200 personal exemption it is NOT reduced by income. Virginia adds $800 and claims it alongside the $800 it adds at 65. There is no income test and no proration anywhere.',
  },
];

/** The short pointer a per-state field carries in the input schema. */
export function shortDescription(field: StateField): string {
  const required =
    field.requiredIn && field.requiredIn.length > 0
      ? ` Required in ${field.requiredIn.join(', ')}.`
      : '';
  return `${field.states.join(', ')} only.${required} describe_state documents it.`;
}

/** The schema fragment, pointer included, for one per-state field. */
export function fieldSchema(field: StateField): JsonSchema {
  return { ...field.schema, description: shortDescription(field) } as JsonSchema;
}

/** Every per-state field, as the `properties` map `state_income_tax` merges in. */
export function stateFieldProperties(): Record<string, JsonSchema> {
  return Object.fromEntries(STATE_FIELDS.map((field) => [field.name, fieldSchema(field)]));
}

/** The fields one state reads, required ones first. */
export function fieldsForState(state: string): readonly StateField[] {
  const mine = STATE_FIELDS.filter((field) => field.states.includes(state));
  const isRequired = (field: StateField) => (field.requiredIn ?? []).includes(state);
  return [...mine.filter(isRequired), ...mine.filter((f) => !isRequired(f))];
}
