/**
 * The registry of supported locality-years.
 *
 * Same rule as the state registry: support is per locality *and* per year, and an
 * unsupported year is an error rather than a silent fall back to the nearest one.
 */
import { newYorkCity, yonkers } from './new-york.js';
import type { LocalIncomeTaxDefinition } from './definition.js';
import type { LocalityCode, StateCode } from '../types.js';
import { SUPPORTED_YEARS } from '../states/index.js';

function definitionsForYear(year: number): LocalIncomeTaxDefinition[] {
  return [newYorkCity(year), yonkers(year)].filter(
    (d): d is LocalIncomeTaxDefinition => d !== undefined,
  );
}

const REGISTRY: ReadonlyMap<string, LocalIncomeTaxDefinition> = new Map(
  SUPPORTED_YEARS.flatMap((year) =>
    definitionsForYear(year).map(
      (def) => [`${def.code}:${year}`, def] as [string, LocalIncomeTaxDefinition],
    ),
  ),
);

const STATE_OF: ReadonlyMap<string, StateCode> = new Map(
  [...REGISTRY.values()].map((d) => [d.code, d.state]),
);

/** Every locality code this package supports, sorted. */
export const SUPPORTED_LOCALITIES: readonly LocalityCode[] = [...new Set(STATE_OF.keys())]
  .sort()
  .map((c) => c as LocalityCode);

/** The state a locality sits in. */
export function localityState(locality: LocalityCode): StateCode {
  const state = STATE_OF.get(locality);
  if (state === undefined) throw new RangeError(`Unknown locality ${locality}`);
  return state;
}

export function getLocalityDefinition(
  locality: LocalityCode,
  year: number,
): LocalIncomeTaxDefinition {
  const def = REGISTRY.get(`${locality}:${year}`);
  if (def) return def;
  if (!STATE_OF.has(locality)) {
    throw new RangeError(
      `${locality} is not a supported locality. This package covers ` +
        `${SUPPORTED_LOCALITIES.join(', ')}. Local income taxes it does NOT cover ` +
        `include Indiana's 92 counties, Michigan's 24 cities, Ohio's municipal income ` +
        `taxes, Kentucky's occupational taxes, Maryland's counties and Philadelphia. ` +
        `Returning zero for those would be a wrong answer rather than a missing one.`,
    );
  }
  throw new RangeError(
    `${locality} is supported but tax year ${year} is not. Supported years: ` +
      `${SUPPORTED_YEARS.join(', ')}.`,
  );
}

export type { LocalIncomeTaxDefinition };
