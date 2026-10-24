/**
 * The registry of supported state-years.
 *
 * Support is per state *and* per year, not per state. Seven of the fourteen taxing
 * states here changed their rate between 2025 and 2026, so a request for an
 * unsupported year is an error rather than a silent fallback to the nearest one.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { alabama } from './alabama.js';
import { california } from './california.js';
import { connecticut } from './connecticut.js';
import { federalTaxableBaseStates } from './federal-taxable-base.js';
import { flatStates } from './flat-states.js';
import { louisiana } from './louisiana.js';
import { maryland } from './maryland.js';
import { massachusetts } from './massachusetts.js';
import { minnesota } from './minnesota.js';
import { missouri } from './missouri.js';
import { newJersey } from './new-jersey.js';
import { newYork } from './new-york.js';
import { ohio } from './ohio.js';
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
  const ca = california(year);
  const ct = connecticut(year);
  const la = louisiana(year);
  const ma = massachusetts(year);
  const md = maryland(year);
  const mn = minnesota(year);
  const mo = missouri(year);
  const nj = newJersey(year);
  const ny = newYork(year);
  const oh = ohio(year);
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
    ...(ca ? [ca] : []),
    ...(ct ? [ct] : []),
    ...(la ? [la] : []),
    ...(ma ? [ma] : []),
    ...(md ? [md] : []),
    ...(mn ? [mn] : []),
    ...(mo ? [mo] : []),
    ...(nj ? [nj] : []),
    ...(ny ? [ny] : []),
    ...(oh ? [oh] : []),
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
 * supported state, so the two cannot disagree. Forty-two jurisdictions tax
 * income; this package covers twenty-seven of them, which is why this list has
 * fifteen entries.
 */
export const UNCOVERED_TAXING_JURISDICTIONS: readonly string[] = [
  'Oklahoma',
  'Iowa',
  'Arkansas',
  'Kansas',
  'Nebraska',
  'New Mexico',
  'Montana',
  'Maine',
  'Rhode Island',
  'Vermont',
  'Delaware',
  'Hawaii',
  'North Dakota',
  'West Virginia',
  'the District of Columbia',
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
