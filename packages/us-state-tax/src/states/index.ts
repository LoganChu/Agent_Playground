/**
 * The registry of supported state-years.
 *
 * Support is per state *and* per year, not per state. Six of the thirteen taxing states
 * here changed their rate between 2025 and 2026, so a request for an unsupported
 * year is an error rather than a silent fallback to the nearest one.
 */
import type { StateIncomeTaxDefinition } from '../definition.js';
import { california } from './california.js';
import { federalTaxableBaseStates } from './federal-taxable-base.js';
import { flatStates } from './flat-states.js';
import {
  NO_INCOME_TAX_NAMES,
  NO_INCOME_TAX_STATES,
  noIncomeTaxDefinitions,
} from './no-income-tax.js';
import { utahAndPennsylvania } from './utah-pennsylvania.js';
import type { StateCode } from '../types.js';

/** Every tax year any state in this package covers. */
export const SUPPORTED_YEARS: readonly number[] = [2025, 2026];

function definitionsForYear(year: number): StateIncomeTaxDefinition[] {
  const ca = california(year);
  return [
    ...noIncomeTaxDefinitions(year),
    ...flatStates(year),
    ...federalTaxableBaseStates(year),
    ...utahAndPennsylvania(year),
    ...(ca ? [ca] : []),
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
        `The states it does NOT cover include every graduated-rate state other than ` +
        `California and Mississippi — New York, New Jersey, Massachusetts, Ohio, Virginia, ` +
        `Maryland, Minnesota, Wisconsin, Oregon, South Carolina, Missouri, Alabama, ` +
        `Connecticut and the rest — and the District of Columbia. Returning zero for ` +
        `those would be a wrong answer rather than a missing one.`,
    );
  }
  throw new RangeError(
    `${state} is supported but tax year ${year} is not. Supported years: ` +
      `${supportedYears(state).join(', ')}. There is deliberately no fallback to an ` +
      `adjacent year: Georgia, Indiana, Kentucky, Mississippi, North Carolina and Utah ` +
      `all changed their rate between 2025 and 2026.`,
  );
}
