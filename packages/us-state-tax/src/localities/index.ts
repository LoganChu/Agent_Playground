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

/**
 * Every locality definition that exists for one tax year.
 *
 * Exported for `test/year-guard.test.js`, for the same reason the state
 * registry's is: the year check lives in the builders, and on Day 83 two of the
 * state builders were missing it. Both localities here were clean — New York
 * City and Yonkers refuse every year outside the supported two — and the gate
 * is what keeps that a fact rather than a spot check.
 */
export function definitionsForYear(year: number): LocalIncomeTaxDefinition[] {
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

/** Whether this package holds a definition for one locality in one tax year. */
export function isLocalitySupported(locality: string, year: number): boolean {
  return REGISTRY.has(`${locality}:${year}`);
}

/**
 * The tax years one locality is actually served for.
 *
 * The counterpart of {@link supportedYears} for states, and it exists for the
 * same reason that one does: `SUPPORTED_YEARS` is every year ANY jurisdiction in
 * this package covers, which is not every year a particular one covers. The
 * refusal below used to quote the package-wide list, so the first year served by
 * states and not by localities would have told a New York City caller that 2027
 * was a supported year in the same sentence that refused it.
 *
 * That was not a latent nicety. Tax year 2027 is served by twelve states — the
 * nine with no income tax, plus Indiana, Mississippi and Pennsylvania, whose
 * 2027 is already law — and by no locality at all, because every locality here
 * has a figure
 * that arrives later: New York City's and Yonkers' brackets, Maryland's 24
 * county rates, Indiana's 92, Ohio's 679 municipalities and 214 school districts.
 */
export function supportedLocalityYears(locality: LocalityCode): readonly number[] {
  return SUPPORTED_YEARS.filter((y) => isLocalitySupported(locality, y));
}

/**
 * Every tax year at least one locality is served for.
 *
 * Derived from the registry rather than listed, so it narrows on its own the day
 * a locality stops covering a year and widens the day one starts.
 */
export const SUPPORTED_LOCALITY_YEARS: readonly number[] = SUPPORTED_YEARS.filter((y) =>
  [...REGISTRY.keys()].some((k) => k.endsWith(`:${y}`)),
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
      `${locality} is not a supported locality code. This package covers ` +
        `${SUPPORTED_LOCALITIES.join(', ')} by code, and Maryland's 23 counties and ` +
        `Baltimore City and Indiana's 92 counties by name — pass those as \`county\`, and ` +
        `Michigan's 24 cities as \`city\`, rather than as \`locality\`. Local income taxes ` +
        `it does NOT cover include Ohio's municipal income taxes, Kentucky's occupational ` +
        `taxes and Philadelphia. Returning zero for those would be a wrong answer rather ` +
        `than a missing one.`,
    );
  }
  throw new RangeError(
    `${locality} is supported but tax year ${year} is not. Supported years: ` +
      `${supportedLocalityYears(locality).join(', ')}. A year this package serves for ` +
      `some state is not necessarily served for any locality: every local income tax ` +
      `here has a rate or a bracket that the jurisdiction publishes separately.`,
  );
}

export type { LocalIncomeTaxDefinition };
