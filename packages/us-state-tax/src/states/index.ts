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
import { maryland } from './maryland.js';
import { massachusetts } from './massachusetts.js';
import { missouri } from './missouri.js';
import { newJersey } from './new-jersey.js';
import { newYork } from './new-york.js';
import { ohio } from './ohio.js';
import { oregon } from './oregon.js';
import {
  NO_INCOME_TAX_NAMES,
  NO_INCOME_TAX_STATES,
  noIncomeTaxDefinitions,
} from './no-income-tax.js';
import { utahAndPennsylvania } from './utah-pennsylvania.js';
import { virginia } from './virginia.js';
import type { StateCode } from '../types.js';

/** Every tax year any state in this package covers. */
export const SUPPORTED_YEARS: readonly number[] = [2025, 2026];

function definitionsForYear(year: number): StateIncomeTaxDefinition[] {
  const al = alabama(year);
  const ca = california(year);
  const ct = connecticut(year);
  const ma = massachusetts(year);
  const md = maryland(year);
  const mo = missouri(year);
  const nj = newJersey(year);
  const ny = newYork(year);
  const oh = ohio(year);
  const or = oregon(year);
  const va = virginia(year);
  return [
    ...noIncomeTaxDefinitions(year),
    ...flatStates(year),
    ...federalTaxableBaseStates(year),
    ...utahAndPennsylvania(year),
    ...(al ? [al] : []),
    ...(ca ? [ca] : []),
    ...(ct ? [ct] : []),
    ...(ma ? [ma] : []),
    ...(md ? [md] : []),
    ...(mo ? [mo] : []),
    ...(nj ? [nj] : []),
    ...(ny ? [ny] : []),
    ...(oh ? [oh] : []),
    ...(or ? [or] : []),
    ...(va ? [va] : []),
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
 * income; this package covers twenty-three of them, which is why this list has
 * nineteen entries.
 */
export const UNCOVERED_TAXING_JURISDICTIONS: readonly string[] = [
  'Minnesota',
  'Wisconsin',
  'South Carolina',
  'Louisiana',
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
