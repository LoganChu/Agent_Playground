/**
 * The registry of supported locality-years.
 *
 * Same rule as the state registry: support is per locality *and* per year, and an
 * unsupported year is an error rather than a silent fall back to the nearest one.
 */
import { newYorkCity, yonkers } from './new-york.js';
import { citiesFor, countiesFor } from './counties.js';
import { ohioSchoolDistricts } from './ohio-school-districts.js';
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

/**
 * The tax years ONE STATE's local income taxes are served for — every kind of
 * them, in one answer.
 *
 * ## Why this exists, and why `SUPPORTED_LOCALITY_YEARS` was not enough
 *
 * There are five kinds of local income tax here and they are in five registries:
 * the two named localities (New York City and Yonkers), Maryland's and Indiana's
 * counties, Michigan's and Ohio's cities, and Ohio's school districts. Each one
 * refuses an unsupported year correctly and on its own.
 *
 * What nothing could answer was the question a CALLER has: *given this state,
 * which years can I ask about and get the local tax too?* `SUPPORTED_YEARS` is
 * every year any state has, `supportedYears(state)` is every year this state
 * has, and both are wider than this the moment a state's own figures outrun its
 * localities' — which happened for Indiana on Day 85 and for New York today.
 *
 * It cost an outright defect in the MCP server, where the default year became
 * "the latest year this STATE serves" and a caller who asked for Indiana with a
 * county and no year was refused with a sentence about a year they never named.
 * Every Indiana resident owes a county tax; it was the most likely Indiana call
 * there is.
 *
 * **THE RULE: a surface that defaults a year must default it to a year the WHOLE
 * request can be answered for, not a year one axis of it can.**
 *
 * Empty for a state with no local income tax at all, which is most of them, and
 * the empty array is the answer rather than an error: "which years does Oregon's
 * local income tax cover" has an answer and it is "none, there isn't one".
 */
export function localTaxYears(state: StateCode): readonly number[] {
  return SUPPORTED_YEARS.filter(
    (year) =>
      definitionsForYear(year).some((def) => def.state === state) ||
      countiesFor(state, year).length > 0 ||
      citiesFor(state, year).length > 0 ||
      (state === 'OH' && ohioSchoolDistricts(year).length > 0),
  );
}

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
