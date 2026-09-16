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
import { countyRegistry, normaliseCounty, resolveCounty } from './county-registry.js';
import type { CountyLookup, CountyRegistry } from './county-registry.js';
import type { LocalIncomeTaxDefinition } from './definition.js';
import type { StateCode } from '../types.js';

// Re-exported so that `counties.js` remains the one import path for all of this
// — the split is about the module graph, not about the public surface.
export { countyRegistry, normaliseCounty, resolveCounty };
export type { CountyLookup, CountyRegistry };

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
