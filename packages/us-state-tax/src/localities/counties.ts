/**
 * The county income taxes — the local taxes identified by **name** rather than
 * by code.
 *
 * Two states here levy one, and between them they are 116 jurisdictions: 23
 * Maryland counties plus Baltimore City, and all 92 Indiana counties. Neither
 * belongs in the {@link LocalityCode} union, for the reason recorded when the
 * design was settled: that type is published, every county added to it is a
 * breaking change to anything switching on it exhaustively, and county rates are
 * revised every year — five Maryland jurisdictions changed for 2025 and two for
 * 2026, ten Indiana counties for 2025 and six for 2026. **A type whose members
 * change every October is the wrong type.**
 *
 * So a county is a string, validated at runtime against the year's table, with
 * the rates in data. This file is the part the two states share: normalising a
 * name, building the registry, and producing an error that names the
 * alternatives rather than a zero.
 *
 * What they do *not* share is the tax. Maryland's counties charge 2.25%–3.30%,
 * two of them with more than one rate, and give an earned income credit derived
 * from the rate. Indiana's charge 0.5%–3.00% flat and give nothing. Both are
 * charged on the state's own taxable income, which is the fact that makes them
 * expressible at all — see {@link LocalBase}.
 */
import { indianaCounties, indianaCounty } from './indiana.js';
import { michiganCities, michiganCity } from './michigan.js';
import { ohioMunicipalities, ohioMunicipality } from './ohio.js';
import { marylandCounties, marylandCounty } from './maryland.js';
import type { LocalIncomeTaxDefinition } from './definition.js';
import type { StateCode } from '../types.js';

/**
 * Normalise a county name for matching.
 *
 * Case, punctuation and the abbreviation "Co." are all optional, because a
 * caller — often a language model filling in a form — writes "montgomery",
 * "Montgomery County" and "MONTGOMERY CO." for the same place. The word
 * "County" itself is handled by the lookup rather than stripped here, because
 * stripping it would erase the only thing separating Baltimore City from
 * Baltimore County.
 */
export function normaliseCounty(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/\bco\b/g, 'county')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * "A and B", "A, B and C" — the ambiguity message reads to a person and to a
 * model, and Ohio has three villages called Oakwood where Maryland had two
 * Baltimores.
 */
function listOf(names: readonly string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** One state's county table for one year, keyed by normalised name. */
export type CountyRegistry = ReadonlyMap<string, LocalIncomeTaxDefinition>;

export interface CountyLookup {
  /** The display names, in the order the state's own chart lists them. */
  readonly names: readonly string[];
  /** Names that must not be resolved, and what they could mean. */
  readonly ambiguous?: ReadonlyMap<string, readonly string[]>;
  readonly byYear: ReadonlyMap<number, CountyRegistry>;
  /** How the state describes its jurisdictions, for the error message. */
  readonly describe: string;
  /**
   * The word a caller may leave off the end of a name — "County" for Maryland
   * and Indiana. `null` for a state whose jurisdictions are cities, where there
   * is no suffix to make optional and claiming there is one would be a lie in
   * the error message a model reads.
   */
  readonly suffix?: string | null;
  /** What one of these jurisdictions is called, for the error message. */
  readonly noun?: string;
}

/**
 * Resolve a county name to its definition for a year.
 *
 * @throws {RangeError} when the name is not one of the state's jurisdictions,
 * when it is ambiguous, or when the year is not supported. Every message names
 * the alternatives: the caller is often a language model, and a model that
 * cannot see the list will invent a county that does not exist.
 */
export function resolveCounty(
  lookup: CountyLookup,
  state: StateCode,
  county: string,
  year: number,
): LocalIncomeTaxDefinition {
  const key = normaliseCounty(county);
  // Checked before the lookup, so that dropping the "County" suffix — which is
  // otherwise allowed — cannot silently resolve Baltimore County.
  const ambiguous = lookup.ambiguous?.get(key);
  if (ambiguous) {
    throw new RangeError(
      `"${county}" is ambiguous in ${state}: ${listOf(ambiguous)} are separate ` +
        `jurisdictions that set their own income tax rates. Name which one.`,
    );
  }
  const suffix = lookup.suffix === undefined ? 'county' : lookup.suffix;
  const noun = lookup.noun ?? 'county';
  const forYear = lookup.byYear.get(year);
  if (!forYear) {
    throw new RangeError(
      `${state} ${noun} income tax is supported for ${[...lookup.byYear.keys()].join(' and ')}, ` +
        `not ${year}. Rates are revised every year, so there is no fallback to the nearer one.`,
    );
  }
  const def = forYear.get(key) ?? (suffix === null ? undefined : forYear.get(`${key} ${suffix}`));
  if (!def) {
    throw new RangeError(
      `"${county}" is not a ${state} taxing jurisdiction. ${lookup.describe}: ` +
        `${lookup.names.join(', ')}.` +
        (suffix === null || suffix === ''
          ? ' Matching ignores case.'
          : ` The word "${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}" is optional and matching ignores case.`),
    );
  }
  return def;
}

/** Build the year-keyed registry from a per-year definition builder. */
export function countyRegistry(
  years: readonly number[],
  build: (year: number) => readonly LocalIncomeTaxDefinition[],
): ReadonlyMap<number, CountyRegistry> {
  return new Map(
    years.map((year) => [
      year,
      new Map(build(year).map((def) => [normaliseCounty(String(def.code)), def])),
    ]),
  );
}

/**
 * The states whose local income tax is identified by county name.
 *
 * Maryland and Indiana. Both are *complete* coverage of the state — every
 * Maryland resident and every Indiana resident owes one — which is why a county
 * is closer to required than optional on those two returns.
 */
export const COUNTY_TAX_STATES: readonly StateCode[] = ['IN', 'MD'];

/**
 * Resolve a county on whichever state's table owns it.
 *
 * The state decides the table, so passing an Indiana county on a Maryland return
 * is an error about the county rather than about the state — and passing one on
 * a return for a state with no county income tax at all names the two that have
 * one, rather than returning a zero that looks like an answer.
 */
export function countyDefinition(
  state: StateCode,
  county: string,
  year: number,
): LocalIncomeTaxDefinition {
  if (state === 'MD') return marylandCounty(county, year);
  if (state === 'IN') return indianaCounty(county, year);
  throw new RangeError(
    `county applies to a return in ${COUNTY_TAX_STATES.join(' or ')}; state is ${state}. ` +
      `Maryland's 23 counties and Baltimore City, and all 92 Indiana counties, levy an ` +
      `income tax on the state's own taxable income. Michigan's 24 city income taxes and ` +
      `Ohio's 679 municipal ones are modelled too, but they are cities rather than counties ` +
      `— pass \`city\` on a Michigan or Ohio return. Kentucky's occupational taxes and ` +
      `Philadelphia's wage tax are not modelled here, and returning zero for them would be a ` +
      `wrong answer rather than a missing one.`,
  );
}

/**
 * The states whose local income tax is identified by **city or village** name.
 *
 * Michigan's 24 and Ohio's 679, and the two are not the same kind of tax. A
 * Michigan city taxes a base of its own that resembles AGI with four classes
 * removed, halves its rate for a commuter by statute, and credits another city's
 * tax on terms the statute fixes. An Ohio municipality taxes Medicare wages,
 * halves nothing, and credits another municipality's tax only to the extent its
 * own ordinance says. So the field is shared and nothing behind it is.
 */
export const CITY_TAX_STATES: readonly StateCode[] = ['MI', 'OH'];

/**
 * Resolve a city on whichever state's table owns it.
 *
 * The same dispatch `countyDefinition` does, and for the same reason: the state
 * decides the table, so an unknown name is an error about the city rather than
 * about the state, and a state with no city income tax at all names the two that
 * have one instead of returning a zero that looks like an answer.
 */
export function cityDefinition(
  state: StateCode,
  city: string,
  year: number,
): LocalIncomeTaxDefinition {
  if (state === 'MI') return michiganCity(city, year);
  if (state === 'OH') return ohioMunicipality(city, year);
  throw new RangeError(
    `city applies to a return in ${CITY_TAX_STATES.join(' or ')}; state is ${state}. ` +
      `Michigan's 24 cities and Ohio's 679 municipalities levy an income tax on a base of ` +
      `their own — city income under the Uniform City Income Tax Ordinance in Michigan, ` +
      `qualifying wages under O.R.C. § 718.01(R) in Ohio. Maryland's and Indiana's county ` +
      `income taxes are modelled too, but they are counties rather than cities — pass ` +
      `\`county\` there. Kentucky's occupational taxes and Philadelphia's wage tax are not ` +
      `modelled, and returning zero for them would be a wrong answer rather than a missing one.`,
  );
}

/** Every city definition a state has for a year. */
export function citiesFor(state: StateCode, year: number): readonly LocalIncomeTaxDefinition[] {
  if (state === 'MI') return michiganCities(year);
  if (state === 'OH') return ohioMunicipalities(year);
  return [];
}

/** Every county definition a state has for a year. */
export function countiesFor(state: StateCode, year: number): readonly LocalIncomeTaxDefinition[] {
  if (state === 'MD') return marylandCounties(year);
  if (state === 'IN') return indianaCounties(year);
  return [];
}
