/**
 * The registry of supported state-years.
 *
 * Support is per state *and* per year, not per state. Seven of the fourteen taxing
 * states here changed their rate between 2025 and 2026, so a request for an
 * unsupported year is an error rather than a silent fallback to the nearest one.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { alabama } from './alabama.js';
import { arkansas } from './arkansas.js';
import { california } from './california.js';
import { connecticut } from './connecticut.js';
import { federalTaxableBaseStates } from './federal-taxable-base.js';
import { flatStates } from './flat-states.js';
import { iowa } from './iowa.js';
import { kansas } from './kansas.js';
import { louisiana } from './louisiana.js';
import { maryland } from './maryland.js';
import { massachusetts } from './massachusetts.js';
import { minnesota } from './minnesota.js';
import { missouri } from './missouri.js';
import { newJersey } from './new-jersey.js';
import { newMexico } from './new-mexico.js';
import { newYork } from './new-york.js';
import { northDakota } from './north-dakota.js';
import { ohio } from './ohio.js';
import { oklahoma } from './oklahoma.js';
import { oregon } from './oregon.js';
import { southCarolina } from './south-carolina.js';
import {
  NO_INCOME_TAX_NAMES,
  NO_INCOME_TAX_STATES,
  noIncomeTaxDefinitions,
} from './no-income-tax.js';
import { utahAndPennsylvania } from './utah-pennsylvania.js';
import { virginia } from './virginia.js';
import { wisconsin } from './wisconsin.js';
import type { StateCode } from '../types.js';

/** Every tax year any state in this package covers. */
export const SUPPORTED_YEARS: readonly number[] = [2025, 2026];

function definitionsForYear(year: number): StateIncomeTaxDefinition[] {
  const al = alabama(year);
  const ar = arkansas(year);
  const ca = california(year);
  const ct = connecticut(year);
  const ia = iowa(year);
  const ks = kansas(year);
  const la = louisiana(year);
  const ma = massachusetts(year);
  const md = maryland(year);
  const mn = minnesota(year);
  const mo = missouri(year);
  const nj = newJersey(year);
  const nm = newMexico(year);
  const ny = newYork(year);
  const nd = northDakota(year);
  const oh = ohio(year);
  const ok = oklahoma(year);
  const or = oregon(year);
  const sc = southCarolina(year);
  const va = virginia(year);
  const wi = wisconsin(year);
  return [
    ...noIncomeTaxDefinitions(year),
    ...flatStates(year),
    ...federalTaxableBaseStates(year),
    ...utahAndPennsylvania(year),
    ...(al ? [al] : []),
    ...(ar ? [ar] : []),
    ...(ca ? [ca] : []),
    ...(ct ? [ct] : []),
    ...(ia ? [ia] : []),
    ...(ks ? [ks] : []),
    ...(la ? [la] : []),
    ...(ma ? [ma] : []),
    ...(md ? [md] : []),
    ...(mn ? [mn] : []),
    ...(mo ? [mo] : []),
    ...(nj ? [nj] : []),
    ...(nm ? [nm] : []),
    ...(nd ? [nd] : []),
    ...(ny ? [ny] : []),
    ...(oh ? [oh] : []),
    ...(ok ? [ok] : []),
    ...(or ? [or] : []),
    ...(sc ? [sc] : []),
    ...(va ? [va] : []),
    ...(wi ? [wi] : []),
  ];
}

const REGISTRY: ReadonlyMap<string, StateIncomeTaxDefinition> = new Map(
  SUPPORTED_YEARS.flatMap((year) =>
    definitionsForYear(year).map(
      (def) => [`${def.code}:${year}`, def] as [string, StateIncomeTaxDefinition],
    ),
  ),
);

const NAMES: ReadonlyMap<string, string> = new Map(
  [...REGISTRY.values()].map((d) => [d.code, d.name]),
);

/** Every state code this package supports, sorted. */
export const SUPPORTED_STATES: readonly StateCode[] = [...new Set([...NAMES.keys()])]
  .sort()
  .map((c) => c as StateCode);

export { NO_INCOME_TAX_STATES, NO_INCOME_TAX_NAMES };

/**
 * Every definition key that reads {@link StateIncomeTaxInput.retirement}.
 *
 * Exported because a SECOND copy of this fact was wrong for three states, and
 * the second copy was in the MCP server. `us-tax-mcp` gates each of its
 * arguments on a list of the states that read it and REFUSES the argument
 * otherwise, with a message naming the states that do — and its
 * `RETIREMENT_STATES` was the one list in that file still written by hand. On
 * Day 51 it read 13 states and the engine read 16: Ohio's retirement income
 * credit, South Carolina's whole retirement rule and Wisconsin's exclusion
 * election were all refused an input that moves their tax, and the refusal told
 * the caller the field did not apply to their state. **A field that is silently
 * ignored is a wrong answer with no symptom; a field that is REFUSED with a
 * false explanation is a wrong answer the caller has been argued out of.**
 *
 * South Carolina had been in the engine for two days and Ohio for a great deal
 * longer, which is the measurement that matters: the drift is not a race
 * condition between two commits, it is a list nobody re-reads.
 */
export const RETIREMENT_READING_RULES = [
  'retirementIncomeSubtractions',
  'pensionExclusion',
  'militaryRetirementSubtraction',
  'retirementIncomeExclusion',
  'militaryRetirementExclusion',
  'pensionIncomeExclusion',
  'stateRetirementDeduction',
  'planTypeRetirement',
  'exclusiveRetirementCredits',
  'retirementIncomeCredit',
  'retirementSubtractionSchedule',
  'retirementIncomeExclusionElection',
  'reducedBaseRetirementCredit',
] as const satisfies readonly (keyof StateIncomeTaxDefinition)[];

/**
 * The states that read {@link StateIncomeTaxInput.retirement}, DERIVED from the
 * definitions rather than listed.
 *
 * `agedIncomeSubtraction` is deliberately not in
 * {@link RETIREMENT_READING_RULES}, and it is the judgement call in this list.
 * It carries Maryland's centenarian subtraction and South Carolina's § 12-6-1170(B)
 * senior deduction, and it reads retirement income only through
 * `reducedByRetirementSubtractions` — which South Carolina sets and Maryland does
 * not. Both states are already here through a rule of their own, so including it
 * would widen the list by nothing today and by a WRONG state the day an age
 * deduction is given to a state with no retirement rule at all. `ageDeduction`
 * (Virginia's) is out for the same reason and has no retirement reading at all.
 *
 * The compile-time `satisfies` above is what keeps this honest, and it earned its
 * place immediately: the first draft of the list named `centenarianSubtraction`,
 * which is not a definition key — Maryland's centenarian rule IS
 * `agedIncomeSubtraction` — and the build refused it. A derived list is only as
 * wide as the places it looks, and a misspelt place is a place it does not look.
 */
export const STATES_READING_RETIREMENT: readonly StateCode[] = SUPPORTED_STATES.filter((code) =>
  SUPPORTED_YEARS.some((year) => {
    const def = getStateDefinition(code, year) as unknown as Record<string, unknown>;
    return RETIREMENT_READING_RULES.some((rule) => def[rule] !== undefined);
  }),
);

/**
 * Every definition key whose rule reads
 * {@link StateIncomeTaxInput.taxableSocialSecurity}.
 *
 * **This list exists because the hand-written copy of its ANSWER drifted on six
 * consecutive new states.** `us-tax-mcp` gates each of its arguments on the
 * states that read it and refuses the argument otherwise; `taxableSocialSecurity`
 * was the last gate in that file still written as a list of state codes, and
 * Louisiana, North Dakota, Oklahoma, Iowa, Arkansas and Kansas each needed a line
 * added to it. The file's own comment forecast the drift correctly five times and
 * argued each time that the list was safe BECAUSE the drift was caught — which is
 * true, and is an argument for a cheaper way of being right.
 *
 * > **A LIST WHOSE STALENESS IS RELIABLY CAUGHT IS NOT A SAFE LIST, IT IS A LIST
 * > WHOSE COST HAS MOVED FROM THE BUG TO THE CHORE.** Six for six is a
 * > measurement rather than a forecast, and the chore is paid by whoever adds the
 * > next state, in a package they did not open.
 *
 * It is the keys and not the states, for the reason {@link RETIREMENT_READING_RULES}
 * is: a state that arrives using a mechanism this package already has gains the
 * field with no edit anywhere, and only a state that arrives with a NEW mechanism
 * for reading the benefit needs this list touched. Of the six drifts above, all
 * six were states using `subtractsTaxableSocialSecurity`, which is to say that
 * none of them would have touched this list at all.
 *
 * **Five of the nine keys are each the sole reason for exactly one state** — MN's
 * `socialSecuritySubtraction`, UT's `exclusiveRetirementCredits`, MO's
 * `stateRetirementDeduction`, CT's `retirementSubtractionSchedule` and the
 * twenty-four of `subtractsTaxableSocialSecurity` — so the derivation is not a
 * generalisation from one case. The other four are included although nothing
 * needs them today: Virginia's `ageDeduction` tests its allowance on federal AGI
 * LESS the benefit, Connecticut's `socialSecurityBenefitAdjustment` sets the
 * excess it charges 25% of, and Maryland's `pensionExclusion` and Oregon's
 * `reducedBaseRetirementCredit` both offset against the benefit the
 * `retirementIncome` fallback supplies. Each genuinely reads the figure and each
 * is currently declared only by a state already here through another key, so
 * naming them costs nothing now and covers the state that arrives with one of
 * them alone.
 *
 * > **A DERIVED LIST SHOULD NAME EVERY MECHANISM THAT READS THE FIELD, NOT THE
 * > FEWEST THAT REPRODUCE TODAY'S ANSWER.** The minimal set is five keys and is
 * > exactly as right today and wrong the day a state arrives with only Virginia's
 * > mechanism — which is the same failure as the hand-written list, one level up
 * > and harder to see.
 */
export const SOCIAL_SECURITY_READING_RULES = [
  'subtractsTaxableSocialSecurity',
  'socialSecuritySubtraction',
  'socialSecurityBenefitAdjustment',
  'ageDeduction',
  'exclusiveRetirementCredits',
  'stateRetirementDeduction',
  'retirementSubtractionSchedule',
  'reducedBaseRetirementCredit',
  'pensionExclusion',
] as const satisfies readonly (keyof StateIncomeTaxDefinition)[];

/**
 * The states that read {@link StateIncomeTaxInput.taxableSocialSecurity},
 * DERIVED from the definitions rather than listed.
 *
 * `subtractsTaxableSocialSecurity` is a BOOLEAN, so the test is on its truth and
 * not on its presence — which `RETIREMENT_READING_RULES` never had to care about,
 * every one of its keys being an object. A `!== undefined` here would admit a
 * state that declared `false`, and a state declaring `false` is a state saying in
 * terms that it does not read the field.
 */
export const STATES_READING_TAXABLE_SOCIAL_SECURITY: readonly StateCode[] =
  SUPPORTED_STATES.filter((code) =>
    SUPPORTED_YEARS.some((year) => {
      const def = getStateDefinition(code, year) as unknown as Record<string, unknown>;
      return SOCIAL_SECURITY_READING_RULES.some(
        (rule) => def[rule] !== undefined && def[rule] !== false,
      );
    }),
  );

/**
 * The jurisdictions that tax individual income and that this package does not
 * cover, by name.
 *
 * It is a declared list rather than a sentence inside an error message, and the
 * reason is a defect that sat in this file for a day: the message that tells a
 * caller which states are missing **named Connecticut as missing on the day
 * Connecticut shipped**, because a prose list of what a package lacks is a
 * second copy of the registry and drifts the moment the registry grows.
 *
 * `test/registry.test.js` now fails if any name here is also the name of a
 * supported state, so the two cannot disagree.
 *
 * **AND THE SENTENCE THAT STOOD HERE WAS A COUNT, SO IT WENT STALE.** It said
 * "forty-two jurisdictions tax income; this package covers twenty-seven of them,
 * which is why this list has fifteen entries" — written when that was true, left
 * behind by North Dakota on Day 61, and by then wrong about both numbers while
 * the list beside it was right. Day 60's rule was that a declared list only
 * guards the sentences somebody pointed at it, and nothing was pointed here.
 * `test/registry.test.js` now derives the arithmetic — supported taxing states
 * plus this list must be forty-two — so the fact is checked and no longer
 * written down.
 */
export const UNCOVERED_TAXING_JURISDICTIONS: readonly string[] = [
  // ALL NINE ARE ORDERED LARGEST FIRST AND THE WHOLE LIST IS NOW CHECKED,
  // which it has not been since Day 61 — and the only edit the figures forced
  // was ONE SWAP at the bottom.
  //
  // Day 64 checked three against Census Vintage 2025 and spent two of them on
  // Kansas and New Mexico. Day 67's server-side search read the remaining eight
  // off the Bureau's own QuickFacts pages, since `census.gov` does not resolve
  // from this sandbox by `curl` or by `WebFetch`:
  //
  //   Nebraska                   2,018,006
  //   West Virginia              1,766,147
  //   Hawaii                     1,432,820
  //   Maine                      1,414,874
  //   Montana                    1,144,694
  //   Rhode Island               1,114,521
  //   Delaware                   1,059,952
  //   the District of Columbia     693,645
  //   Vermont                      644,663
  //
  // The committed order had VERMONT ABOVE THE DISTRICT OF COLUMBIA and Vermont
  // is the smaller of the two. Everything above them was already descending, so
  // eight days of a comment claiming "largest first" over an unmeasured tail
  // turned out to be wrong in exactly one place.
  //
  // > **AN UNMEASURED LIST THAT TURNS OUT TO BE NEARLY RIGHT IS THE WORST CASE,
  // > NOT THE BEST.** Day 64's finding was that a sentence describing the whole
  // > list is evidence about the part that was measured and a guess about the
  // > rest. The guess was 8 of 9 correct, which is exactly the hit rate that
  // > keeps a claim like this alive for another eight days.
  //
  // WHAT MAKES THE FIGURES TRUSTWORTHY IS A COINCIDENCE, AND IT IS NOT METHOD.
  // The search that produced them flagged Hawaii, New Hampshire and Maine as its
  // own least certain pairings, those three values sitting next to each other in
  // a scrambled extract — and Maine's 1,414,874 is the figure Day 66 had already
  // obtained from a different query on a different day. A second landing on
  // exactly the row the search called weakest is why Hawaii's 1,432,820 is
  // written down at all. West Virginia's 1,766,147 came independently from its
  // own QuickFacts page. **If anything downstream of this order looks wrong,
  // re-check Hawaii, Maine and Montana first**; the pair at the bottom is 48,982
  // apart and safe, and Nebraska is the only entry a worklist should read.
  'Nebraska',
  'West Virginia',
  'Hawaii',
  'Maine',
  'Montana',
  'Rhode Island',
  'Delaware',
  'the District of Columbia',
  'Vermont',
];

export function stateName(state: StateCode): string {
  const name = NAMES.get(state);
  if (name === undefined) throw new RangeError(`Unknown state ${state}`);
  return name;
}

export function isSupported(state: string, year: number): boolean {
  return REGISTRY.has(`${state}:${year}`);
}

/** Years supported for one state. Every supported state currently covers both. */
export function supportedYears(state: StateCode): readonly number[] {
  return SUPPORTED_YEARS.filter((y) => isSupported(state, y));
}

export function getStateDefinition(state: StateCode, year: number): StateIncomeTaxDefinition {
  const def = REGISTRY.get(`${state}:${year}`);
  if (def) return def;
  if (!NAMES.has(state)) {
    throw new RangeError(
      `${state} is not supported. This package covers ${SUPPORTED_STATES.join(', ')}. ` +
        `The jurisdictions that tax income and are NOT covered — ` +
        `${UNCOVERED_TAXING_JURISDICTIONS.join(', ')}. Returning zero for one of those ` +
        `would be a wrong answer rather than a missing one.`,
    );
  }
  throw new RangeError(
    `${state} is supported but tax year ${year} is not. Supported years: ` +
      `${supportedYears(state).join(', ')}. There is deliberately no fallback to an ` +
      `adjacent year: Georgia, Indiana, Kentucky, Mississippi, North Carolina and Utah ` +
      `all changed their rate between 2025 and 2026.`,
  );
}
