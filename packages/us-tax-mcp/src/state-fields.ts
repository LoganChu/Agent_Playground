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
  STATES_READING_RETIREMENT,
  SUPPORTED_STATES,
  SUPPORTED_YEARS,
  getStateDefinition,
} from './state-engine/index.js';
import type { StateIncomeTaxDefinition } from './state-engine/index.js';

/**
 * A dotted path into a state definition, with `[]` for "any element of this
 * array".
 *
 * **Day 53's finding is why this exists.** Seven of these lists were literals or
 * were derived from too few places, and every one of the seven refused a field
 * that moves a state's tax: `$1,856.25` of Arizona, `$1,598.00` of Missouri,
 * `$420.00` of New Jersey, `$300.00` of Alabama, `$263.00` of Oregon, `$250.00`
 * of Connecticut and `$90.00` of South Carolina, on one return each. A list of
 * states is a second copy of a fact the definitions already hold, so the way to
 * stop writing it wrong is to stop writing it.
 *
 * The compiler proves the FIRST segment is a real key of
 * {@link StateIncomeTaxDefinition} — which is the guard
 * `RETIREMENT_READING_RULES` carries in the engine, and whose comment records
 * the first draft naming `centenarianSubtraction`, a key that does not exist,
 * and the build refusing it. The rest of a path cannot be typed that way, so
 * `test/state-field-witnesses.test.js` requires every path in
 * {@link DERIVATION_PATHS} to occur in at least one state-year. **A misspelt
 * leaf is a place the derivation does not look, and a place it does not look is
 * a field this server refuses.**
 */
type DefinitionPath = `${keyof StateIncomeTaxDefinition}${string}`;

const PATHS_USED: string[] = [];

/**
 * Every path any list below reads, so the test can require each to be live.
 *
 * Exported rather than internal because the whole point is that it is checkable:
 * a path nothing matches has silently stopped contributing states.
 */
export const DERIVATION_PATHS: readonly string[] = PATHS_USED;

function valueAt(value: unknown, segments: readonly string[]): boolean {
  if (segments.length === 0) return value !== undefined && value !== null;
  const head = segments[0];
  const rest = segments.slice(1);
  if (head === undefined) return false;
  if (value === null || typeof value !== 'object') return false;
  if (head === '[]') return Array.isArray(value) && value.some((element) => valueAt(element, rest));
  return valueAt((value as Record<string, unknown>)[head], rest);
}

function segmentsOf(path: string): readonly string[] {
  return path.split('.').flatMap((part) => (part.endsWith('[]') ? [part.slice(0, -2), '[]'] : [part]));
}

function read(value: unknown, segments: readonly string[]): unknown {
  if (segments.length === 0) return value;
  const head = segments[0];
  const rest = segments.slice(1);
  if (head === undefined) return undefined;
  if (value === null || typeof value !== 'object') return undefined;
  if (head === '[]') {
    if (!Array.isArray(value)) return undefined;
    return value.map((element) => read(element, rest)).find((found) => found !== undefined);
  }
  return read((value as Record<string, unknown>)[head], rest);
}

/**
 * The states whose definition declares a NON-ZERO, non-`false` value at any of
 * these paths.
 *
 * **A declared `0` or `false` is the state answering no, not asking the
 * question**, and reading it as a yes is how Missouri got into
 * {@link DEPENDENT_AGE_STATES}: `exemption.perDependent` is `0` there, cited to
 * § 143.161.1 granting an exemption "for each exemption to which the taxpayer is
 * entitled for federal income tax purposes" and § 151(d)(5) having set that to
 * zero since 2018. The figure is declared because somebody read the statute, and
 * what they read was that there is none.
 */
function declaredBy(...paths: readonly DefinitionPath[]): readonly string[] {
  return matching((value) => value !== 0 && value !== false, ...paths);
}

/**
 * The states whose definition declares a value at any of these paths that
 * SATISFIES the predicate.
 *
 * Presence is not always the question. `separateReturnSpouse` is declared by
 * nineteen states and says `'claimed'` in five of them; the other fourteen have
 * been read and answer no, which is the declaration doing its job. A derivation
 * on presence alone would hand the field to all nineteen.
 */
function matching(
  predicate: (value: unknown) => boolean,
  ...paths: readonly DefinitionPath[]
): readonly string[] {
  for (const path of paths) if (!PATHS_USED.includes(path)) PATHS_USED.push(path);
  const split = paths.map(segmentsOf);
  return SUPPORTED_STATES.filter((code) =>
    SUPPORTED_YEARS.some((year) => {
      const def = getStateDefinition(code, year);
      if (def === undefined) return false;
      return split.some((segments) => {
        const found = read(def, segments);
        return found !== undefined && found !== null && predicate(found);
      });
    }),
  );
}

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
      def?.exemptionCredit?.perBlindOrDisabledFiler !== undefined ||
      // Oregon's is neither an exemption nor an exemption credit: ORS 316.695(8)
      // puts it INSIDE the standard deduction, which is why a list derived from
      // the two exemption rules alone missed it. A derived list is only as wide
      // as the places it looks.
      def?.standardDeductionAgedOrBlindAddition !== undefined
    );
  }),
);

/**
 * The states that count a separate filer's spouse under IRC § 151(b), DERIVED
 * from the engine's own per-state declaration.
 *
 * Never a literal. This module's header says two copies of a fact that must
 * agree is a bug with a waiting period, and `BLIND_STATES` above is the entry
 * that proved it — five days between a state gaining a blind exemption and this
 * server agreeing to be told about it. Four states declare `claimed` today and a
 * fifth will need no edit here.
 */
const SPOUSE_151B_STATES: readonly string[] = matching(
  (value) => value === 'claimed',
  'exemption.separateReturnSpouse.spouse',
  // **Oregon, and the reason this is a list of two paths rather than one.** Its
  // § 151(b) spouse is an exemption CREDIT, not an exemption — ORS 316.085 and
  // Form OR-40's exemption boxes — and the engine reads
  // `exemptionCredit.separateReturnSpouse` in a function of its own. A
  // derivation that looked only at `exemption` refused Oregon the field for as
  // long as Oregon has had the rule, which the engine's own comment says it
  // gained because the differential grid found it `$251.91` out. Worth
  // `$263.00` for 2026 and `$256.00` for 2025, on a separate return.
  //
  // `BLIND_STATES` above carries the same sentence about the same state: *a
  // derived list is only as wide as the places it looks.* Oregon has now broken
  // it twice, in two lists, for one reason — it puts rules where no other state
  // here puts them.
  'exemptionCredit.separateReturnSpouse.spouse',
);

/**
 * The states that read a filer's or a spouse's OWN age, DERIVED from every place
 * in a definition that names one.
 *
 * It was an eighteen-state literal until Day 53 and it was wrong in both
 * directions at once. **Alabama and Missouri were refused it and both read it
 * for money** — Ala. Admin. Code r. 810-3-19-.04 taxes a defined CONTRIBUTION
 * distribution only from 65, so the `$6,000` exclusion is `$300.00` at
 * Alabama's 5%; Mo. Rev. Stat. § 143.125 exempts the whole taxable Social
 * Security benefit from 62, which on a `$40,000` benefit is `$1,598.00` at
 * 2025's 4.7%. **Missouri's own shipped note says *"pass `filerAge` and, on a
 * joint return, `spouseAge`"* — the engine was telling the caller to supply a
 * figure this server refused them**, which is Day 51's finding again in a
 * different field.
 *
 * And **Kentucky was in the list and reads no age at all**, which the field's own
 * documentation said in as many words while the list beside it disagreed. KRS
 * 141.019(1)'s pension exclusion has no age test, which is the whole reason
 * Kentucky is the state an early retiree can use.
 *
 * The paths are enumerated rather than recalled: the definitions were WALKED for
 * every key whose name is an age or a birth year, and the result is the list
 * below less the ones that are a DEPENDENT's age. Utah is why `born` is in that
 * search — its retirement credit tests a birth YEAR (`bornOnOrBefore: 1952`) and
 * a search for `age` alone would have dropped it.
 */
const OWN_AGE_STATES: readonly string[] = declaredBy(
  // Age tests that belong to the filer or the spouse.
  'standardDeductionAgedOrBlindAddition.age',
  'exemption.seniorAge',
  'exemptionCredit.seniorAge',
  'seniorCredit.minimumAge',
  'agedCredit.minimumAge',
  'agedIncomeSubtraction.minimumAge',
  'ageDeduction.minimumAge',
  'ageDeduction.fullAmountIfBornBefore',
  'pensionExclusion.minimumAge',
  'retirementExclusion.minimumAge',
  'retirementIncomeExclusion.minimumAge',
  'retirementIncomeExclusion.olderAge',
  'retirementIncomeExclusionElection.minimumAge',
  'retirementIncomeSubtractions[].minimumAge',
  'retirementIncomeSubtractions[].maximumAge',
  'retirementIncomeSubtractions[].cappedMinimumAge',
  'retirementIncomeSubtractions[].capByAge',
  'militaryRetirementExclusion.maximumAge',
  'militaryRetirementSubtraction.ageThreshold',
  'planTypeRetirement.definedContributionAge',
  'reducedBaseRetirementCredit.minimumAge',
  'stateRetirementDeduction.socialSecurityMinimumAge',
  'exclusiveRetirementCredits.retirement.bornOnOrBefore',
  'ownEarnedIncomeCredit.minimumAgeWithoutChildren',
);

/**
 * The states that read `dependentAges`, DERIVED — and the one list here where
 * the right answer is WIDER than "reads an age".
 *
 * The field is also how a caller supplies the COUNT, because `dependents`
 * defaults to `dependentAges.length`. So a state that bands nothing by age still
 * reads this field, and narrowing the list to the age-readers would refuse a
 * legal call in nineteen states to protect against nothing.
 *
 * What the derivation adds is **Connecticut, which was refused it and loses
 * `$250.00` REFUNDABLE by the refusal.** Conn. Gen. Stat. § 12-704e's child
 * bonus pays a flat `$250` to a filer eligible for the Connecticut earned income
 * credit with at least one qualifying child, and the engine reads
 * `earnedIncomeCreditChildBonus.maxChildAge` against the ages — `ages.some((age)
 * => age <= 18)`. With the field refused, `ages` is `undefined`, `some` is never
 * called and the bonus is zero. A household with two children aged 4 and 8 and a
 * `$6,000` federal credit was `$250` short; the same household with children of
 * 19 and 22 is correctly paid nothing, which is how we know the engine reads the
 * ages rather than the count.
 */
const DEPENDENT_AGE_STATES: readonly string[] = declaredBy(
  // A child's own age.
  'childCredit.amountByAge',
  'earnedIncomeCredit.youngChildMaxAge',
  'earnedIncomeCreditChildBonus.maxChildAge',
  'exemption.qualifyingChildMaxAge',
  'exemption.qualifyingChildStudentMaxAge',
  'ownEarnedIncomeCredit.qualifyingChildMaxAge',
  'steppedChildCredit.maxAge',
  'youngChildCredit.ineligibleAge',
  // And every rule that reads a dependent COUNT, because the count arrives
  // through this field.
  'exemption.perDependent',
  'exemption.perDependentSteps',
  'exemption.perQualifyingChild',
  'exemption.perCollegeDependent',
  'exemption.perSeniorDependent',
  'exemptionCredit.perDependent',
  'forgiveness.perDependent',
  'zeroTaxThreshold.perDependent',
  'childCredit.maxChildren',
  'earnedIncomeCredit.childlessMatchRate',
  'earnedIncomeCredit.matchRateByChildCount',
  'ownEarnedIncomeCredit.byChildCount',
);

/**
 * The states with a surplus credit on a prior-year liability, DERIVED — one.
 *
 * Derived rather than written `['OR']` for the reason this whole module is
 * derived, and for one more: this is the only field whose availability has a
 * YEAR as well as a state. Oregon's kicker lands on odd tax years, so
 * `surplusCredit` is declared for 2025 and ABSENT for 2026, and `matching`
 * takes a state that declares the path in ANY supported year. That is the right
 * answer for a gate — refusing an Oregon caller the field because the server
 * also knows an even year would be worse than accepting it in one — but it
 * means the gate cannot say "not this year". The engine does: it reports the
 * field as IGNORED on a 2026 Oregon return and names the biennium. **A gate
 * with one dimension cannot refuse on two, and the honest move is to let the
 * narrower instrument answer rather than to widen this one until it lies.**
 */
const SURPLUS_CREDIT_STATES: readonly string[] = declaredBy('surplusCredit.rate');

/**
 * The input field that feeds that credit, READ OFF THE DEFINITIONS rather than
 * written here.
 *
 * `SurplusCreditRule.basisField` names the input in the engine, so this module
 * has no business holding a second copy of the name: a gate that advertises
 * `oregonPriorYearTaxBeforeCredits` while the engine reads something else is
 * Day 53's Pennsylvania defect with the spelling changed. `test/state-fields.test.js`
 * requires exactly one distinct value here.
 */
const SURPLUS_CREDIT_FIELD: string = (() => {
  const names = new Set<string>();
  for (const code of SUPPORTED_STATES) {
    if (!SURPLUS_CREDIT_STATES.includes(code)) continue;
    for (const year of SUPPORTED_YEARS) {
      const field = getStateDefinition(code, year)?.surplusCredit?.basisField;
      if (field !== undefined) names.add(field);
    }
  }
  /* c8 ignore next -- one state declares one field; the throw is the guard that says so. */
  if (names.size !== 1) throw new Error(`expected one surplus-credit basis field, got ${names.size}`);
  return [...names][0]!;
})();

/**
 * The states with a state itemized deduction of their own, DERIVED.
 *
 * It was a seven-state literal and it was missing **ARIZONA, which is the
 * largest single figure Day 53 found: `$1,856.25` on one return.** A.R.S.
 * § 43-1042 lets an Arizona filer itemize whether or not they itemized
 * federally, and the engine's own shipped note says so — *"this package reads
 * `stateItemizedDeductions` and takes the larger of that and the standard
 * deduction"* — while this server told an Arizona caller the field applies to
 * seven other states. `$90,000` of Arizona itemized deductions against a
 * `$15,750` standard deduction is `$74,250` at 2.5%.
 */
const STATE_ITEMIZED_STATES: readonly string[] = declaredBy(
  'itemizedDeduction',
  // Wisconsin's is a CREDIT on the itemized total rather than a deduction of it,
  // and it is the second place the engine reads the same field.
  'itemizedDeductionCredit',
);

/**
 * The states that read whether the filer itemized FEDERALLY, DERIVED.
 *
 * Missing **South Carolina**, whose 2025 return adds back the standard-deduction
 * increase its frozen Code does not recognize — and
 * `recognizedStandardDeductionAddBack` returns nothing at all where
 * `federal.deductionKind !== 'standard'`, because an itemizer took no standard
 * deduction to add back. With the field refused, every South Carolina ITEMIZER
 * was charged the add-back anyway: `$45.00` single, `$67.50` head of household,
 * `$90.00` joint, at the 6% top rate on `$750`, `$1,125` and `$1,500`.
 */
const FEDERAL_ITEMIZED_STATES: readonly string[] = declaredBy(
  // `declaredBy` and not presence, because three states DECLARE
  // `requiresFederalItemizing: false` — Alabama, Arizona and Oregon let a filer
  // itemize on the state return whether or not they itemized federally, and a
  // declared "no" is the answer to the question rather than the asking of it. A
  // derivation on presence handed the field to all three.
  'itemizedDeduction.requiresFederalItemizing',
  'itemizedDeduction.forcedWhenFederalItemizing',
  'itemizerCredit',
  'recognizedStandardDeduction',
);

/**
 * The states that read `earnedIncome`, DERIVED — plus Ohio, which a derivation
 * over STATE definitions cannot see.
 *
 * Missing **NEW JERSEY, where an OMITTED field is not a zero.** § 54A:6-15's
 * pension exclusion has a Part II that applies the unused allowance to other
 * income, but only for a filer with `$3,000` or less of earned income, and the
 * engine reads `input.earnedIncome === undefined` as failing that test rather
 * than as passing it — which is the right default, because a caller who said
 * nothing has not said "none". So a New Jersey retiree who genuinely earns
 * nothing could not say so: `$420.00` on a single filer of 66 with a `$20,000`
 * pension, and the cliff is exactly one dollar wide — `$3,000` of earnings is
 * `$0.00` of tax and `$3,001` is `$420.00`.
 *
 * And **Georgia came OUT.** It was in the literal, the field's own documentation
 * makes no Georgia claim, and no Georgia household this server can build moves
 * on it.
 */
const EARNED_INCOME_STATES: readonly string[] = [
  ...declaredBy(
    'povertyLevelCredit',
    'ownEarnedIncomeCredit',
    'youngChildCredit',
    'retirementExclusion.otherIncomeEarnedIncomeLimit',
  ),
  // Ohio's reading is in the SCHOOL DISTRICT registry and not in the state
  // definition: 68 of the 214 districts tax earned income alone, so a filer who
  // names one needs either this or `qualifyingWages` and the engine throws
  // without one. A derivation over state definitions is blind to a locality
  // rule, which is the same shape as Oregon's two misses above and is why this
  // one is spelled out with its reason instead of being quietly added.
  'OH',
];

/**
 * The states that add back interest on OTHER states' municipal obligations,
 * DERIVED from the engine's own per-state declaration.
 *
 * It was the literal `['IL']` for eight days, and the hand-written list is the
 * same bug `BLIND_STATES` proved: on the day four more states were read, this
 * server would have refused a field their own notes told the caller to pass.
 */
const MUNICIPAL_ADDBACK_STATES: readonly string[] = SUPPORTED_STATES.filter((code) =>
  SUPPORTED_YEARS.some(
    (year) => getStateDefinition(code, year)?.outOfStateMunicipalInterestAddition !== undefined,
  ),
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
/**
 * The states that read `retirement`, declared once so that the field's own
 * documentation can count them instead of saying a number.
 */
/**
 * The states whose definition carries a federal income tax deduction, and WHICH
 * refundable credits each one's worksheet subtracts — both derived from the
 * engine rather than listed here.
 *
 * They were hand-written lists until Day 42, and both were wrong. `states` for
 * the refundable child tax credit said `['AL']` and Oregon subtracts it too; the
 * `refusal` text for all three fields said "Alabama alone", which Missouri had
 * falsified a day earlier and nothing noticed, because a sentence about a list is
 * a second copy of the list.
 *
 * THE RULE, which this file has now learned twice: a prose claim about a declared
 * list drifts the moment the list grows, so derive the claim or test it. The
 * `retirement` field's "N states read this" count was the first instance.
 */
const FEDERAL_TAX_DEDUCTION_STATES: readonly string[] = SUPPORTED_STATES.filter((code) =>
  SUPPORTED_YEARS.some(
    (year) => getStateDefinition(code, year)?.federalIncomeTaxDeduction !== undefined,
  ),
);

const REFUNDABLE_CREDIT_STATES = {
  earnedIncomeCredit: subtractorsOf('earnedIncomeCredit'),
  additionalChildTaxCredit: subtractorsOf('additionalChildTaxCredit'),
  refundableAmericanOpportunityCredit: subtractorsOf('refundableAmericanOpportunityCredit'),
} as const;

function subtractorsOf(credit: string): readonly string[] {
  return SUPPORTED_STATES.filter((code) =>
    SUPPORTED_YEARS.some((year) =>
      (getStateDefinition(code, year)?.federalIncomeTaxDeduction?.refundableCredits ?? []).includes(
        credit as never,
      ),
    ),
  );
}

/**
 * The states that read `retirement`, DERIVED from the engine.
 *
 * **It was the literal `['MD','GA','KY','UT','IL','MS','MI','NY','NC','CT','AL','MO','OR']`
 * until Day 51, and it was wrong for THREE states.** The engine reads the field
 * for sixteen; this named thirteen. Ohio's retirement income credit, South
 * Carolina's whole § 12-6-1170 rule and Wisconsin's exclusion election were all
 * refused an input that moves their tax — and the refusal below does not ignore
 * the field, it REFUSES it with a message naming the states that do read it. So
 * a model asking about an Ohio retiree was told, in terms, that Ohio does not
 * read a pension. **A silently ignored field is a wrong answer with no symptom; a
 * field refused with a false explanation is a wrong answer the caller has been
 * argued out of, and the second is worse because the caller stops looking.**
 *
 * This module's header says two copies of a fact that must agree is a bug with a
 * waiting period. `BLIND_STATES` waited five days. This one waited longer: Ohio's
 * credit has read the field since v0.18.0 and South Carolina joined the engine on
 * Day 49, two days before anybody noticed. **The length of the wait is the
 * argument — the drift is not a race between two commits, it is a list nobody
 * re-reads.**
 *
 * The engine owns the fact and proves it two ways: a compile-time `satisfies`
 * that every name in `RETIREMENT_READING_RULES` is a real definition key, and a
 * test that runs households in all 35 states and fails if any state's tax moves
 * when `retirement` is supplied and the list omits it.
 */
const RETIREMENT_STATES: readonly string[] = STATES_READING_RETIREMENT;

const PERSON_RETIREMENT: JsonSchema = {
  type: 'object',
  properties: {
    employerPlanPension: number,
    definedContributionPlan: number,
    iraDistributions: number,
    investmentIncome: number,
    earnedIncome: number,
    socialSecurityBenefits: number,
    militaryRetirement: number,
    totallyDisabled: boolean,
    governmentPension: number,
    serviceMonthsBefore1998: number,
    serviceMonthsAfter1997: number,
    survivorPension: number,
    survivorMilitaryRetirement: number,
    deceasedSpouseAge: number,
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
    states: ['MA', 'AL'],
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
    states: ['OH', 'MO'],
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
    states: STATE_ITEMIZED_STATES,
    doc: 'Federal Schedule A less the state and local INCOME taxes inside it. Needs federalItemized in the four states that require it and in none of the others. ARIZONA, ALABAMA and OREGON do NOT: A.R.S. \u00a7 43-1042 lets an Arizona filer itemize whether or not they itemized federally, and Arizona itemized deductions are their own figure \u2014 state income taxes disallowed, and \u00a7 43-1042(D) caps the SALT part at a flat $10,000 from 2026. Leave it out in Arizona and the return takes the standard deduction: $90,000 of Arizona itemized deductions against a $15,750 standard deduction is $1,856.25 of tax at 2.5%. Maryland reduces it by 7.5% of federal AGI over $200,000 ($100,000 separate); Virginia and Georgia COMPEL it, so a federal itemizer may not take the state standard deduction even when it is larger. Georgia does NOT require the state income tax to come out — its adjustment is for taxes paid to other states and investment interest on exempt income — so pass the Georgia figure as the IT-511 worksheet computes it.',
  },
  {
    name: 'federalItemized',
    schema: boolean,
    states: FEDERAL_ITEMIZED_STATES,
    doc: 'Whether the filer itemized federally. SOUTH CAROLINA reads it for the opposite reason from the other four: its 2025 return adds back the standard-deduction increase its frozen Code does not recognize, and an ITEMIZER took no standard deduction to add back \u2014 so the flag switches the add-back OFF and is worth $45.00 single, $67.50 head of household and $90.00 joint at the 6% top rate. Maryland allows state itemizing only if they did, so the OBBBA standard deduction ended it for many; Virginia and Georgia go further and REQUIRE itemizing on the state return if they did. In GEORGIA this flag is worth money by itself: the eligible itemizer tax credit of O.C.G.A. § 48-7-27.1 pays $300 a taxpayer ($600 joint) for the election alone, with no income test at any level and no state itemized figure needed. At 4.99% that is $6,012 of deduction, so a Georgia filer whose itemized deductions fall that far SHORT of the standard deduction still comes out ahead.',
  },
  {
    name: 'netCapitalGain',
    schema: number,
    states: ['MD', 'MO', 'AZ', 'SC', 'WI'],
    doc:
      "Net capital gain, Form 1040 line 7, and THREE STATES READ IT FOR THREE DIFFERENT PURPOSES. MARYLAND surtaxes it 2% when federal AGI exceeds $350,000; the threshold is a test rather than a floor, so one dollar of AGI at $350,000 can cost $6,933.08, and you should exclude a principal residence sold for $1.5M or less, § 179 property and retirement-account gains. MISSOURI subtracts 100% of it, short-term gain included (§ 143.121.3(14)), so pass the whole line. ARIZONA reads it as a TEST AND NOT AS AN AMOUNT: § 43-1022(22) subtracts a quarter of the long-term gain only where there is a net capital gain overall, so this field is the gate on longTermCapitalGainAfter2011 and Arizona subtracts nothing without it. One field, three mechanisms, and the figure to pass is the same one.",
  },
  {
    name: 'longTermCapitalGainAfter2011',
    schema: number,
    states: ['AZ'],
    doc:
      "Net LONG-TERM capital gain from assets acquired after 31 December 2011 — Arizona only, and the figure Form 140 asks for on a line of its own. A.R.S. § 43-1022(22) subtracts 25% of it, which is 0.625% of the gain in tax: $625.00 on $100,000, and an effective Arizona rate of 1.875% on a qualifying long-term gain against 2.5% on a wage. It cannot be derived from netCapitalGain: Form 1040 line 7 is already netted short against long, Schedule D splits the halves but not the vintages, and nothing on a federal return records when an asset was bought. SHORT-TERM ITEMS DO NOT BELONG HERE, as gains or as losses — the Form 140 worksheet says “do not include any short-term capital gains or (losses) in this worksheet”, which is where Arizona parts company with Wisconsin, whose statute nets them in first. Pass it ALONGSIDE netCapitalGain: the subtraction is allowed only where there is a net capital gain overall, because § 43-1022(22) reaches only gain included in federal AGI and a year that nets to a loss includes none, so a $50,000 long-term gain behind a $100,000 short-term loss subtracts nothing. Leave it out and an Arizona answer with long-term gains comes back too high.",
  },
  {
    name: 'taxExemptInterest',
    schema: number,
    states: ['UT', 'CT', 'OR'],
    doc: 'Tax-exempt interest, 1040 line 2a. Utah adds it back into the modified AGI its retirement credits are withdrawn against (§ 59-10-1019(1)(b), § 59-10-1042(1)(b)), so a municipal bond is taxed at 2.5% in Utah while appearing on no line of Utah income: $10,000 of it costs a retired couple exactly $250.00 of Utah tax and $0.00 of federal tax. Leave it out and a bondholding Utah retiree comes back too low. CONNECTICUT reads it for a different reason and only above its Social Security threshold: tax-exempt interest belongs in \u00a7 86 provisional income, which sets the combined income excess Connecticut charges 25% of, so omitting it understates the excess and understates Connecticut tax. Below $75,000 of federal AGI ($100,000 joint) Connecticut does not read it at all. OREGON adds it into the household income its retirement credit is reduced by (ORS 316.157), so a municipal bond cuts an Oregon retiree\u2019s credit dollar for dollar while appearing on no line of Oregon income.',
  },
  {
    name: 'taxableSocialSecurity',
    schema: number,
    states: [
      'VA', 'MD', 'GA', 'KY', 'UT', 'CT', 'MO',
      'AL', 'AZ', 'CA', 'ID', 'IL', 'IN', 'MI', 'MN', 'MS', 'NC', 'NY', 'OH', 'OR', 'SC', 'WI',
    ],
    doc: 'Social Security and Tier 1 railroad benefits INSIDE federal AGI — 1040 line 6b, not 6a, which is estimate_federal_tax socialSecurity.taxableBenefits. VA, MD, GA and KY SUBTRACT it, and Virginia also tests its age deduction on AGI less it. Utah is the opposite and is the reason to read this: Utah TAXES the benefit and then hands the tax back as a credit (code AH), withdrawn at 2.5 cents per dollar of modified AGI over $90,000 joint, $54,000 single, $45,000 separate — so in Utah this figure sets the size of a credit rather than a subtraction, and a Utah retiree without it comes back far too high. Do not also net it into stateSubtractions. Maryland needs the TOTAL received as well, in retirement. CONNECTICUT subtracts the WHOLE of it below $75,000 of federal AGI ($100,000 joint and for a qualifying surviving spouse) and at the threshold replaces that subtraction rather than tapering it \u2014 one dollar of income can cost a couple with $40,000 of benefits $405 \u2014 so a Connecticut retiree without this figure comes back far too high. Connecticut needs the GROSS benefit as well, in retirement.socialSecurityBenefits.',
  },
  {
    name: 'outOfStateMunicipalInterest',
    schema: number,
    states: MUNICIPAL_ADDBACK_STATES,
    doc: "Interest on the obligations of OTHER states and their municipalities — the part of 1040 line 2a the filer's own state did not issue. These dollars never reached federal AGI, so a state that wants them has to legislate an addition and an engine that starts at federal AGI and stops is too LOW. It is NOT taxExemptInterest, which is the total and would tax an Illinois resident on Illinois bonds: the split exists on no federal form. FIVE STATES READ IT AND EACH ASKS FOR A DIFFERENT NUMBER — Illinois the interest gross (35 ILCS 5/203(a)(2)(A)); VIRGINIA the interest less related expenses not deducted federally (§ 58.1-322.01(1)); MARYLAND interest AND DIVIDENDS less related expenses (Tax-Gen. § 10-204(b), Form 502 line 1b); OHIO interest AND DIVIDENDS, gross (R.C. 5747.01(A)(1), Schedule of Adjustments line 1); INDIANA only obligations the taxpayer ACQUIRED after 31 December 2011 (IC 6-3-1-3.5(a)(11), where Bulletin #19 makes acquisition the trade date). So a bond fund's exempt-interest dividends belong in this figure in Ohio and Maryland and not in Virginia or Indiana, and an Indiana resident holding an out-of-state bond bought in 2010 owes Indiana nothing on it forever. Each of the five says in notes what it assumed about the figure you gave it. Omitted, the return is understated by that state's rate on the coupon — 4.95% in Illinois, 5.75% in Virginia, up to 8.95% in Maryland with the county. PolicyEngine-US models this addition in Illinois ALONE, and models Illinois's as the whole of tax-exempt interest with no in-state carve-out.",
    refusal:
      'Five states read it: Illinois, Indiana, Ohio, Virginia and Maryland, each under its own statute. The other twenty-three that do something like it take it through stateAdditions, because this package will not assert a list of twenty-eight states it has not checked one at a time — and this list is derived from the engine, so a state that gains a declaration gains the field here with no edit.',
  },
  {
    name: 'federalIncomeTax',
    schema: number,
    states: FEDERAL_TAX_DEDUCTION_STATES,
    doc: 'Form 1040 line 22 — the federal income tax AFTER non-refundable credits — plus the Form 8960 net investment income tax. THREE STATES DEDUCT THE FEDERAL BILL and all three give every filer the deduction, not only itemizers: Alabama deducts the whole of it at 5% (Form 40 line 12), Missouri a SHARE of it chosen by a cliff chart on Missouri AGI (MO-1040 line 13), and Oregon the whole of it up to a CEILING chosen by a chart on FEDERAL AGI (Form OR-40 line 10, $8,750 for 2026). So a federal tax cut is a state tax INCREASE in all three. Omit it and the Alabama answer is too high by 5% of the whole federal bill — $191.00 on the $3,820 a single filer owes on $50,000 of wages — and the Oregon answer by up to 9.9% of the ceiling, which is $866.25. The result says so in a note either way.',
    refusal:
      'Only Alabama, Missouri and Oregon have the federal bill itself inside their base — Ala. Code § 40-18-15(a)(3), Mo. Rev. Stat. § 143.171 and ORS 316.695(1)(d). No other state in this package reads it, so there is nothing for the figure to do.',
  },
  {
    name: 'federalAdditionalChildTaxCredit',
    schema: number,
    states: REFUNDABLE_CREDIT_STATES.additionalChildTaxCredit,
    doc: "Schedule 8812's refundable child tax credit, Form 1040 line 28. The worksheets that compute a federal-tax deduction subtract the refundable federal credits from it, because they are money received rather than tax paid — so where it is subtracted a refundable credit RAISES state tax. ALABAMA AND OREGON SUBTRACT IT AND MISSOURI DOES NOT, because Missouri's worksheet starts from Form 1040 line 22 and line 28 never reduced it: the same $1,600 costs an Alabama family $80 and a Missouri family nothing.",
    refusal:
      "No state in this package subtracts the refundable child tax credit from a federal-tax deduction. Missouri has such a deduction and this is the credit its worksheet leaves out.",
  },
  {
    name: 'federalRefundableAmericanOpportunityCredit',
    schema: number,
    states: REFUNDABLE_CREDIT_STATES.refundableAmericanOpportunityCredit,
    doc: 'Form 8863 line 8, Form 1040 line 29 — the REFUNDABLE part of the American Opportunity credit only. The non-refundable part has already reduced federalIncomeTax and must not be counted twice. It is the one refundable credit all three federal-tax-deduction states subtract.',
    refusal:
      'Only the states that deduct the federal income tax subtract the refundable federal credits from it, and only because the credits reduce the tax they are deducting.',
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
    states: RETIREMENT_STATES,
    doc: [
      'Retirement income PER PERSON, because these states do not read it off a federal AGI and four of them cap an exclusion per person — so a return\'s totals do not determine its tax. Omit it and everything lands on one spouse, which is the worst of the cases, and the result says so in the name of the subtraction.',
      // The count used to be written here as a word — "NINE states read this" —
      // and the list beside it had grown to ELEVEN before anybody noticed, then
      // twelve when Missouri arrived. A prose count of a list that is declared
      // three lines above is a second copy of that list, and it drifts the
      // moment the list grows. It is derived now, and `test/state-fields.test.js`
      // fails if the sentence and the array disagree.
      `${RETIREMENT_STATES.length} states read this. Four of them — IL, MS, MI, NY — exempt most or all of a pension and BEFORE v0.19.0 taxed it unless the caller netted it out through stateSubtractions. They no longer do, so a caller who is still passing both now subtracts twice: take it out of stateSubtractions.`,
      '  IL — everything, no cap, NO AGE TEST. A 40-year-old drawing a pension owes Illinois nothing on it.',
      '  MS — everything, no cap, at 59½. An early distribution is taxable (§ 27-7-15(4)(l)).',
      '  MI — ONE cap for the RETURN, keyed to the OLDER spouse: $67,610 single / $135,220 joint for 2026, and 75% of the 2025 figures for 2025. Military pay is exempt in full and comes OFF that cap.',
      '  NY — $20,000 PER PERSON at 59½, unused room lost, AND a federal, NY State or NY local government pension exempt in full at ANY age. Put a government pension in governmentPension, not employerPlanPension: the two differ by the whole of the tax.',
      '  NC — taxes every pension in FULL and deducts military retired pay in full. It is in every list of retiree-friendly states and does not belong there.',
      '  MO — the public pension deduction is capped at the maximum Social Security benefit ($47,633) and then REDUCED BY the Social Security deduction the same person took, so a benefit consumes a pension exemption rather than adding to it; the private pension deduction beside it is $6,000 per person withdrawn dollar for dollar above $25,000 ($32,000 combined) of Missouri AGI LESS that same benefit, so one dollar of Social Security destroys one exemption and protects the other. Military retired pay is exempt in full at any age, outside both. Put government retired pay in governmentPension, not employerPlanPension.',
      '  AL — the TYPE OF PLAN decides the whole answer and no federal figure records it. A DEFINED BENEFIT payment is exempt in full at ANY age with no cap (Ala. Admin. Code r. 810-3-19-.04, reading IRC § 414(j), and reaching non-qualified plans and SERPs); a DEFINED CONTRIBUTION distribution is taxable above $6,000 per person and only from 65. At 62 a $60,000 pension is free and a $60,000 401(k) draw costs $2,760.00.',
      'Fields, on filer and spouse alike:',
      '  employerPlanPension — taxable pension from a qualified plan, 401(a), 401(k), 403(b) or 457(b). NOT an IRA, Roth, ROLLOVER IRA, SEP or 457(f), which MD § 10-209(a) excludes by name and GA counts in full. IN ALABAMA this field means a DEFINED BENEFIT pension only.',
      '  definedContributionPlan — a 401(k), 403(b) or 457(b) DISTRIBUTION, as against the defined benefit pension above. Alabama is the only state here where the difference decides the answer; every other state pools the two, so passing it costs them nothing. Do not put the same dollars in both.',
      '  iraDistributions — taxable IRA and Roth-conversion income, 1040 line 4b. GA-qualifying, MD-disqualifying: the rollover every adviser recommends costs $0.00 in Georgia and $3,428.03 a year in Maryland.',
      '  investmentIncome — interest, dividends, net capital gain, rents, royalties, alimony. GA only, and may be negative. It is in Georgia\'s pool, which makes the "retirement income exclusion" also a capital gains allowance.',
      '  earnedIncome — wages plus partnership and S corp income. GA counts at most $5,000 of it per person, and doubles the military exclusion above $17,500.',
      '  socialSecurityBenefits — the TOTAL received, Tier I and Tier II, taxable or not. MD charges the whole of it against its exclusion; GA charges nothing.',
      '  militaryRetirement — retired or survivor pay, not also counted in employerPlanPension. MD subtracts it with no age gate, GA excludes it only BELOW 62, UT credits it at the state rate with no phase-out at all.',
      '  totallyDisabled — qualifies at any age, and in MD for the spouse too.',
      '  governmentPension — KY and NY: federal, Commonwealth or Kentucky local retired pay, military service included. New York exempts a federal, NY State or NY local pension in full and at any age, which is the largest single fact about a New York retirement. The share attributable to service before 1 January 1998 is exempt WITHOUT LIMIT and does not consume the $31,110, so Kentucky has no maximum for that cohort.',
      '  serviceMonthsBefore1998, serviceMonthsAfter1997 — KY only: months of service credit either side of the cutoff, which set that share. A person who retired before 1998 has none after.',
      '  survivorPension, survivorMilitaryRetirement, deceasedSpouseAge — retirement income received AS A SURVIVING SPOUSE, on a deceased spouse\'s behalf. SC ONLY changes its answer: § 12-6-1170(A) gives a survivor a SECOND deduction beside their own, capped at $3,000/$10,000 by the age the DECEASED SPOUSE WOULD HAVE REACHED this year rather than the claimant\'s — so pass deceasedSpouseAge, not the survivor\'s age, and an absent one takes the $3,000 band. The decedent\'s military retired pay comes out in full under § 12-6-1171 beside it, and NEITHER amount is reduced by the other or reduces the $15,000 senior deduction, which is the exact negation of (C)(1) on the veteran\'s own return. Worth $25,000 of deduction to a 65-year-old widow of a career soldier with a pension of her own. EVERY OTHER STATE reads these dollars exactly as employerPlanPension and militaryRetirement, so passing them costs nothing and loses nothing — Maryland\'s § 10-207(q) already defines military retirement income to INCLUDE death benefits from military service. Do not also put the same dollars in the own-income fields.',
      '  SC — $3,000 of retirement income at any age and $10,000 from 65, PER PERSON; military retired pay in full and uncapped under § 12-6-1171, but § 12-6-1170(C)(1) charges it against that cap AND against the $15,000 age-65 deduction, so the pair is a FLOOR of $15,000 rather than a sum. A surviving spouse claims the whole thing a second time on the decedent\'s income, by their age, with (C)(1) switched off.',
      '  OH — the retirement income credit is a staircase on retirement income, capped at $200, and lost entirely above the modified-AGI limit. It reads this field and was REFUSED it before v0.49.0.',
      '  WI — the retirement income exclusion election.',
      '  OR — the reduced-base retirement credit, from 62.',
      'Utah needs only militaryRetirement here.',
    ].join('\n'),
  },
  {
    name: 'pennsylvaniaSpouseEligibilityIncome',
    schema: number,
    states: ['PA'],
    doc: 'PA only, and only on a marriedFilingSeparately return: the SPOUSE\'s own eligibility income. Pennsylvania has no separate-return forgiveness table — Schedule SP\'s three claimant boxes are unmarried, separated and married, and a married claimant who files separately is a MARRIED claimant, with a $13,000 allowance rather than $6,500 and the JOINT eligibility income of both spouses. The allowance and the income move together, so this server will not take one without the other: pass this — 0 is a real answer, and it is the answer for a spouse with no income — or the return keeps the smaller allowance, which is too much tax, and the result says what that costs.',
  },
  {
    name: SURPLUS_CREDIT_FIELD,
    schema: number,
    states: SURPLUS_CREDIT_STATES,
    doc: 'OR only, and only on an ODD tax year: the filer\'s OWN Oregon income tax before credits for the PRIOR year, which is the base of Oregon\'s surplus "kicker". Line 24 of the 2024 Form OR-40 for a 2025 return, LESS any credit claimed there for income tax paid to another state \u2014 the Department of Revenue defines the base as Oregon tax "before any credits, withholding, or payments, other than a credit for income taxes paid to another state on mutually taxed income", so that one credit comes off and no other does, and nothing on the 2025 return can do the subtraction for you. The credit is 9.863% of it for 2025 and REFUNDABLE, so it is paid where the 2025 tax is zero: worth $3,993.89 to one household in this package\'s differential grid and about $562 to a single filer on $80,000 of wages. OMITTING IT MEANS NO KICKER RATHER THAN AN ESTIMATED ONE, which is a real answer: the credit requires a 2024 Oregon return that SHOWED A LIABILITY, so a non-filer, a first-year resident or a household with no 2024 tax is owed nothing, and that case is indistinguishable from a caller who did not pass the figure. There is no 2026 kicker at all \u2014 the credit lands on odd years, because the biennium Or. Const. Art. IX \u00a7 14(4) measures ends on 30 June of an odd year \u2014 and a 2026 return reports the field as ignored rather than multiplying it by zero in silence. A couple whose filing status changed between the two years has a base this server cannot assemble; it is whatever the 2024 return showed.',
  },
  {
    name: 'separatedFromSpouse',
    schema: boolean,
    states: ['PA'],
    doc: 'PA only: living apart from a spouse at ALL times during the last six months of the year, or separated under a written agreement. Schedule SP asks this directly and the answer decides the table: a separated claimant ticks the Unmarried oval on line 19a of the PA-40 and is one claimant on their own income, whatever pennsylvaniaSpouseEligibilityIncome says. It is the same fact § 32(d)(2) turns on federally.',
  },
  {
    name: 'spouseAdjustedFederalAdjustedGrossIncome',
    schema: number,
    states: ['VA'],
    doc: 'SEPARATE returns only: the spouse\'s OWN federal AGI less the Social Security taxed inside it — Virginia\'s "adjusted federal adjusted gross income", measured on the other return. Va. Code § 58.1-322.03(5)(b) withdraws the $12,000 age deduction against "the total combined adjusted federal adjusted gross income of BOTH SPOUSES" on a separate return, and the Form 760 Age Deduction Worksheet says all married taxpayers enter the combined figure even when filing separately. So the $75,000 in the separate column of the threshold table is the JOINT test and not a generous one, and a package that reads it against one spouse\'s income gives a separate filer a larger deduction than either a single or a joint return — which is what this one did until v0.29.0. OMIT IT AND THE INCOME-TESTED DEDUCTION IS REFUSED, not guessed: worth up to $690 of Virginia tax. The pre-1939 cohort\'s $12,000 has no income test and is unaffected.',
  },
  {
    name: 'spouseClaimsAgeDeduction',
    schema: boolean,
    states: ['VA'],
    doc: 'SEPARATE returns only: the spouse claims an INCOME-TESTED age deduction on their own return. The Form 760 worksheet then computes a JOINT age deduction — both $12,000s against the one combined income test — and allocates half to each spouse, so the shared excess costs this filer half of what their own amount tested alone would: (2a − e) / 2 = a − e / 2. It is worth MORE than the filer\'s own tested amount, which is why it defaults to false. Needs a spouse who is 65 or over and born after 1 January 1939; a spouse in the untested cohort has no tested amount to pool.',
  },
  {
    name: 'lesserSpouseIncome',
    schema: number,
    states: ['VA', 'SC', 'WI'],
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
    states: [
      'NJ', 'OH', 'MI', 'IL', 'MS', 'NY',
      'CT', 'GA', 'KY', 'MD', 'MO', 'OR', 'SC', 'WI',
    ],
    doc: 'Taxable pension, annuity and IRA withdrawals as a RETURN total. IL, MS, MI and NY will subtract it under their own rules if `retirement` is not supplied, placing all of it on the first filer — which understates the New York exclusion, the only one of the four that is capped per person. New Jersey excludes up to $100,000 joint / $75,000 single at 62 or over, ending in a wall at $150,000 of total income that costs a joint retiree $1,381 on one dollar. Ohio bands a small retirement income credit on it. Michigan derives cityIncome from federal AGI less this figure when cityIncome is omitted. MD, GA, KY and UT read `retirement` instead, because theirs are per person.',
  },
  {
    name: 'propertyTaxPaid',
    schema: number,
    states: ['NJ', 'WI'],
    doc: 'Property tax paid on a principal residence in the state. New Jersey allows a $15,000 deduction OR a flat $50 refundable credit, and the engine computes the return both ways and keeps the lower tax — which is not the same as taking the larger deduction.',
  },
  {
    name: 'rentPaid',
    schema: number,
    states: ['NJ', 'MA', 'WI'],
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
    states: EARNED_INCOME_STATES,
    refusal:
      'Four states read earnings as a figure of their own: California for CalEITC and the ' +
      'Young Child Tax Credit, Maryland for the poverty level credit, New Jersey for the ' +
      '$3,000 limit on \u00a7 54A:6-15\'s Part II, and Ohio for the 68 school districts that ' +
      'tax earned income alone. Everywhere else the state reads a federal figure instead, so ' +
      'there is nothing for this one to do. GEORGIA was on this list until Day 53 and no ' +
      'Georgia household moves on it.',
    doc: 'Wages plus net self-employment earnings. REQUIRED for a NEW JERSEY retiree, and this is the one place where an omitted field is not a zero: \u00a7 54A:6-15 lets the unused part of the pension exclusion be applied to OTHER income, but only for a filer with $3,000 or less of earned income, and a field that was not supplied FAILS that test rather than passing it \u2014 which is right, because a caller who said nothing has not said \"none\". So a retiree who genuinely earns nothing has to say so: $420.00 on a single filer of 66 with a $20,000 pension, and the cliff is one dollar wide ($3,000 of earnings is $0.00 of New Jersey tax and $3,001 is $420.00). REQUIRED in practice for a low-income Maryland filer: the poverty level credit is 5% of it against the state tax and the county\'s own rate against the county tax, and between them they take a $15,000 Maryland worker from $160.85 to nothing. Required for California, where the CalEITC and the Young Child Tax Credit are functions of earnings alone rather than of AGI — and CalEITC has no plateau at all, so a single parent faces minus 34% and plus 34% on consecutive dollars. REQUIRED for Ohio when schoolDistrict names one of the 68 districts that tax earned income alone: they reach box 1 of the W-2, net of a 401(k) deferral, where the same filer\'s municipality reaches box 5, gross of it.',
  },
  {
    name: 'dependentAges',
    schema: { type: 'array', items: integer },
    states: DEPENDENT_AGE_STATES,
    doc: 'Age of EVERY dependent at year end, not only the children. CT: the $250 child bonus of \u00a7 12-704e is REFUNDABLE and is paid to a filer eligible for the Connecticut earned income credit with at least one qualifying child \u2014 the engine reads it as \"some dependent is 18 or under\", so a count alone pays nothing and two children of 19 and 22 correctly pay nothing either. IN: a dependent CHILD carries $1,500 of exemption that a dependent parent does not, so a count alone costs an Indiana family $74.55 a child in Marion County. Seven states band a credit by age and return ZERO without it, and the result says what that cost. UT: $1,000 for each child under 6, withdrawn at TEN cents on the dollar — 2.2 times the state rate — so a Utah working couple reaches 20% on the next dollar against a headline 4.45%. GA: $250 for each child under 6 from 2026 (HB 136), with no phase-out at any income. OR: TWO credits need it — the Oregon Kids Credit is $1,050 for each dependent UNDER SIX up to five of them, withdrawn across $5,000 of Oregon AGI so that a family with five of them faces an implied marginal rate of 105%; and the earned income credit is 17% of the federal credit where a dependent is under THREE against 14% otherwise. A count of dependents reaches neither, and the result says what that cost.',
  },
  {
    name: 'filerAge',
    schema: integer,
    states: OWN_AGE_STATES,
    refusal:
      'Nineteen states read an own age and this one declares no age test anywhere in its ' +
      'definition. See spouseAge for the same list and the same reason; KENTUCKY is the ' +
      'common case and its pension exclusion has no age test at all.',
    doc: 'Filer age at year end. CA: one MORE personal exemption CREDIT at 65 — $153, worth the same at every rate and every income, and claimed per person, so a couple both 65 claim four personal exemptions rather than two. MS: $1,500 of extra exemption at 65, on the same line as the dependents. IN: $1,000 of extra exemption at 65 and $500 MORE where federal AGI is under $40,000 — a cliff, so one dollar of income at $40,000 costs a joint retired couple $49.75 in Marion County. IL: $1,000 of extra exemption at 65 — and NOTHING for the retirement subtraction, which has no age test at any point, so Illinois is the one state here where a 40-year-old retiree owes nothing. MS: 59 1/2 for the retirement exemption, because an early distribution stays taxable. NY: 59 1/2 for the $20,000 pension exclusion — but a GOVERNMENT pension is exempt at any age, so a police officer who left at 45 pays nothing fourteen years before anyone else. MI: for 2025 only, the phased-in deduction runs from a birth year of 1946 to 1966, so ages 59 to 79, and the whole RETURN is keyed to the OLDER spouse. VA: an $800 exemption at 65 and the $12,000 age deduction, withdrawn DOLLAR FOR DOLLAR over $50,000 ($75,000 joint). NJ: $1,000 at 65, the retirement exclusion at 62. MD: $1,000 and the senior credit at 65, the pension exclusion at 65, $100,000 at 100. GA: $35,000 excluded at 62, $65,000 at 65, and the military exclusion BELOW 62 only. UT: the retirement credit (code 18) needs a birth year of 1952 or earlier, so 74 or over in 2026. AL: a defined CONTRIBUTION distribution is taxed above $6,000 and only from 65, where a defined BENEFIT payment is exempt in full at any age \u2014 so the $6,000 exclusion is worth exactly $300.00 at Alabama\'s 5% and turning 65 is the whole of it. MO: \u00a7 143.125 deducts the WHOLE taxable Social Security benefit from 62 with no income test, so a $40,000 benefit is $1,598.00 of 2025 tax, and Social Security DISABILITY has no age test at all. KENTUCKY IS NOT ON THIS LIST and that is the point: KRS 141.019(1)\'s pension exclusion has no age test anywhere, which is what makes Kentucky the one an early retiree can use, so the field is refused there rather than accepted and ignored. Omitted, a retiree return runs far too high.',
  },
  {
    name: 'spouseAge',
    schema: integer,
    states: OWN_AGE_STATES,
    refusal:
      'Nineteen states read an own age and this one declares no age test anywhere in its ' +
      'definition. KENTUCKY is the state most callers land here with, and its answer is ' +
      'genuinely age-free: KRS 141.019(1) excludes up to $31,110 of pension income per person ' +
      'with no age test at all, and retired pay for service before 1998 is uncapped. So there ' +
      'is nothing for an age to do, and this list is derived from the definitions rather than ' +
      'typed \u2014 a state that gains an age test gains this field with no edit here.',
    doc: 'Spouse age at year end, joint returns. California and Mississippi both claim their age allowance PER PERSON, so the second spouse at 65 is worth another $153 in California and another $60 of Mississippi tax. MI is the one that runs the other way: its cap is one figure for the RETURN and is keyed to the OLDER spouse, so a 66-year-old married to a 58-year-old qualifies the younger spouse\'s pension too. NY and MS test each person separately and IL tests nobody. Virginia gives a SECOND $12,000 age deduction withdrawn over the same band, so two 65-year-olds face 11.5% on $24,000 of income. New Jersey\'s senior exemption is per person, and Utah\'s code 18 credit is $450 a head.',
  },
  {
    name: 'spouseHasNoGrossIncomeAndIsNotADependent',
    schema: boolean,
    states: SPOUSE_151B_STATES,
    doc: 'SEPARATE returns only: the spouse had NO gross income at all for the year and is not another taxpayer\'s dependent. IRC § 151(b) then allows an exemption for that spouse on a return the spouse is not on — the one sentence in the Code that gives a separate return something a joint one does not, because on a joint return both spouses are already the taxpayer. FIVE states reach the same result and they reach it three different ways. OREGON\'s is an exemption CREDIT rather than an exemption \u2014 ORS 316.085 and the Form OR-40 exemption boxes, where a separate filer whose spouse has no income checks a second Regular box: $263 for 2026, $256 for 2025, and worth the same at every rate because a credit is. The other four: VIRGINIA (§ 58.1-322.03(1), $930 for each exemption allowable FEDERALLY) and ILLINOIS (35 ILCS 5/204(b), the basic amount for each exemption allowable under § 151) point at the federal provision; MARYLAND (Tax-Gen. § 10-211) and INDIANA (IC 6-3-1-3.5(a)) copy § 151(b)\'s own sentence into their statutes. NEW JERSEY expressly does not, and attaches the same condition to a DOMESTIC PARTNER instead, so this is not a federal rule a state inherits. Worth $3,200 of Maryland exemption — stepped by federal AGI like every other exemption there, so the same spouse is worth $3,200, $1,600, $800 or nothing at four different incomes — $2,850 in Illinois, $930 in Virginia and $1,000 in Indiana. Defaults to FALSE, because nothing else on a return implies it and one dollar of the spouse\'s gross income fails it outright; a separate return that leaves it out is told what it cost. Whether the state\'s aged and blind ADDITIONS follow that spouse is a SECOND question with a different answer in each state, and all four are now read: VIRGINIA and INDIANA adopt § 63(f) by reference (§ 58.1-322.03(2)(b), "each blind or aged taxpayer as defined under § 63(f)"; IC 6-3-1-3.5(a), "each additional amount allowable under Section 63(f)"), ILLINOIS writes the spouse\'s own two $1,000s out in 35 ILCS 5/204(d), and MARYLAND says NO — § 10-211(b)(3) and (b)(4) allow $1,000 "if THE INDIVIDUAL" is 65 or blind where (b)(1) counts "each exemption ... under subsection (a)". So the spouse is worth $1,730 in Virginia, $2,000 in Indiana, $3,850 in Illinois and $3,200 in Maryland on the same return. Indiana\'s further MEANS-TESTED $500 is a THIRD question and is open: it references § 63(f)(1) alone and Indiana\'s bulletin glosses it as joint-only, so this package counts nobody for it.',
  },
  {
    name: 'blindOrDisabled',
    schema: integer,
    states: BLIND_STATES,
    doc: 'How many of filer and spouse are blind or disabled, 0-2. MICHIGAN\'s is the largest here: the $3,400 special exemption of MCL 206.30(3)(a), worth $144.50, and it covers deafness and total disability under 66 as well as blindness. MASSACHUSETTS allows $2,200. CALIFORNIA states it as a CREDIT rather than a deduction — $153 a person, worth the same at every rate and at every income, and it stacks with the $153 California adds at 65, so a blind Californian of 65 claims three personal exemptions. MISSISSIPPI adds $1,500, on the same line as the dependents and the $1,500 it adds at 65. Indiana and Illinois each add $1,000, stacking with the $1,000 each adds at 65 — and neither Illinois figure is indexed, where the $2,850 beside them moves with the CPI every year. New Jersey adds $1,000, cumulative with its age exemption. Maryland adds $1,000, and unlike its $3,200 personal exemption it is NOT reduced by income. Virginia adds $800 and claims it alongside the $800 it adds at 65. There is no income test and no proration anywhere.',
  },
];

/** The short pointer a per-state field carries in the input schema. */
/**
 * The fifteenth compression pass, and the smallest one: nine bytes a field.
 *
 * Day 21's move was to stop copying a field's PROSE into the schema and point at
 * `describe_state` instead, and it saved 7,800 bytes. What survived it was the
 * pointer, spelled out on every per-state field — "describe_state documents it."
 * — and two tests require a pointer to be there, correctly: a model reading one
 * property in isolation has to be told where the rest is. So this is not the
 * pointer rule again. It is just the observation that a sentence repeated forty
 * times should be the shortest sentence that does the job.
 *
 * The reason it had to be found today is the interesting part. The ceiling was
 * 130 bytes away and two fields Pennsylvania genuinely needs would not fit.
 * **A context budget that blocks a correctness fix has stopped being a budget
 * and become a bug**, so the fix arrived with a pass rather than with a raised
 * ceiling — which is the fourth time this project has chosen that way round, and
 * the first time the alternative was shipping a known wrong answer.
 */
export function shortDescription(field: StateField): string {
  const required =
    field.requiredIn && field.requiredIn.length > 0
      ? ` Required in ${field.requiredIn.join(', ')}.`
      : '';
  return `${field.states.join(', ')} only.${required} See describe_state.`;
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
