/**
 * Michigan's 24 city income taxes.
 *
 * ## The first local tax in this package that is not a rate on a state figure
 *
 * New York City, Yonkers, Maryland's counties and Indiana's counties all charge
 * a rate on something the state return already computed — see {@link LocalBase}.
 * A Michigan city charges a rate on **a base of its own**, defined by the
 * Uniform City Income Tax Ordinance (MCL 141.601 et seq.) and by nothing on the
 * MI-1040. Three differences from the state base matter, and all three run the
 * same way:
 *
 * ```text
 * pensions, annuities and IRA distributions   excluded ENTIRELY by every city
 * Social Security and unemployment            excluded entirely
 * military pay                                excluded entirely
 * ```
 *
 * Michigan's own return reaches roughly the same place for a retiree by a much
 * longer road — a four-tier, birth-year-banded retirement deduction under MCL
 * 206.30(9). The city ordinance does it in one line. So **a Michigan city taxes
 * a retiree at zero while the state is still working out which tier they are
 * in**, and a model that applies the city rate to federal AGI charges a retired
 * Detroit filer 2.4% of income the city does not tax at all.
 *
 * ## The exemption is $600 and it was $600 in 1964
 *
 * MCL 141.631(1) sets the floor: "a deduction of a minimum of $600.00 for each
 * personal and dependency exemption". Act 284 of 1964 fixed that number and it
 * has never been indexed. Sixteen of the twenty-four cities are still on it.
 *
 * Michigan's *state* personal exemption is `$5,800` for 2025 and is indexed
 * every year under MCL 206.30(2). The city one is 10.3% of it, and in the
 * highest-rate city in the state it is worth this much tax:
 *
 * ```text
 * Detroit, 2.4% x $600   =  $14.40   per exemption, per year
 * a 1% city, $600        =   $6.00
 * ```
 *
 * **A statutory minimum that is never indexed is a tax rise every year**, and
 * this is the cleanest example of it in the package: sixty-two years of
 * inflation have turned the deduction the Legislature thought it was granting
 * into fourteen dollars and forty cents. It is also why the per-city variations
 * in *which* extra exemptions a city allows — age 65, blindness, deafness,
 * paraplegia, all of which differ by ordinance — are not modelled here: each one
 * is worth at most `$14.40`, and being exactly right about them would cost more
 * bytes than the whole rest of this file.
 *
 * Eight cities pay more than the floor, and one pays five times it:
 *
 * ```text
 * Grayling                    $3,000
 * Hudson, Portland            $1,000
 * Ionia                         $700
 * Battle Creek, Benton
 *   Harbor, Saginaw,
 *   Springfield                 $750
 * the other sixteen             $600
 * ```
 *
 * ## The nonresident rate is not a datum, it is half
 *
 * MCL 141.611 fixes the nonresident rate at one half of the resident rate, and
 * every one of the twenty-four honours it exactly — including the three cities
 * that levy above the ordinary 1% ceiling under their own enabling acts:
 *
 * ```text
 * Detroit         2.40% / 1.20%    Public Act 56 of 2011
 * Highland Park   2.00% / 1.00%
 * Grand Rapids    1.50% / 0.75%
 * Saginaw         1.50% / 0.75%
 * the other 20    1.00% / 0.50%    the ordinary UCITO ceiling
 * ```
 *
 * So this file stores one rate per city and halves it, which is Day 5's rule
 * again: prefer the representation the table was generated from. A test asserts
 * the halving against the four separately published nonresident rates.
 *
 * ## The credit for tax paid to another city fails where it is most needed
 *
 * A resident of one taxing city who works in another owes both — the work city's
 * nonresident tax on the wages earned inside it, and the home city's resident tax
 * on everything — and the home city gives a credit for the tax paid to the work
 * city, **capped at the home city's own nonresident rate**.
 *
 * The cap is the whole story, because the ratio of the two cities' rates decides
 * whether the credit covers anything:
 *
 * ```text
 * Detroit resident working in Grand Rapids
 *   pays GR 0.75%, Detroit credits up to 1.2%     -> full offset, total 2.40%
 *
 * Lansing resident working in Detroit
 *   pays Detroit 1.2%, Lansing credits up to 0.5% -> total 1.70% on those wages
 *   against 1.00% had they worked at home         -> 70% more city tax
 * ```
 *
 * **A resident of a cheap city is the one the cap bites, and they are the one
 * commuting into the expensive city.** The credit is generous to exactly the
 * filers who did not need it.
 */
import { countyRegistry, resolveCounty } from './counties.js';
import type { CountyLookup } from './counties.js';
import type { LocalIncomeTaxDefinition } from './definition.js';
import type { Citation, StateCode } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title: 'City Income Tax Act, Act 284 of 1964, Chapter 2 (the Uniform City Income Tax Ordinance)',
    url: 'https://www.legislature.mi.gov/documents/mcl/pdf/mcl-284-1964-2.pdf',
  },
  {
    title: 'MCL 141.611 — the resident rate, and the nonresident rate at one half of it',
    url: 'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-141-611',
  },
  {
    title: 'MCL 141.631 — personal and dependency exemptions, minimum $600 each',
    url: 'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-141-631',
  },
  {
    title: 'Michigan Treasury — which cities impose an income tax',
    url: 'https://www.michigan.gov/taxes/questions/iit/accordion/general/what-cities-impose-an-income-tax',
  },
  {
    title: 'City of Grand Rapids — other Michigan cities with an income tax (rates and exemptions)',
    url: 'https://www.grandrapidsmi.gov/departments/fiscal-services/income-tax/other-michigan-cities-with-income-tax/',
  },
];

const NOTES: readonly string[] = [
  'A Michigan city income tax is charged on a base of the CITY\'s own, not on any line of the MI-1040. Under the Uniform City Income Tax Ordinance every city excludes pensions, annuities and IRA distributions, Social Security, unemployment compensation and military pay ENTIRELY — where Michigan itself reaches a similar place for a retiree only through the four-tier, birth-year-banded deduction of MCL 206.30(9). Applying a city rate to federal AGI charges a retired filer for income no city taxes.',
  'The personal and dependency exemption is $600 in sixteen of the twenty-four cities, which is the statutory floor MCL 141.631(1) set in 1964 and has never indexed. Michigan\'s own personal exemption is $5,800 for 2025 and is indexed annually. At Detroit\'s 2.4% the city exemption is worth $14.40 of tax per person per year.',
  'Additional exemptions for age 65 or over, blindness, deafness and paraplegia are allowed by SOME cities and not others, and are not modelled here. Each one is worth the city rate times the exemption amount — at most $14.40, in Detroit — so the error is bounded by a rounding error on any real return.',
  'The nonresident rate is exactly half the resident rate in all 24 cities, as MCL 141.611 requires, and this package derives it rather than storing it. A nonresident is taxed only on income earned inside the city; a resident is taxed on all income wherever earned, including wages earned in a city that taxes them as a nonresident.',
  'A resident who works in another Michigan taxing city gets a credit for the tax paid to it, CAPPED at the home city\'s own nonresident rate. Pass workCity and workCityEarnings to compute both taxes and the credit. The cap binds whenever the work city\'s nonresident rate exceeds the home city\'s: a Lansing resident working in Detroit pays 1.2% to Detroit and 0.5% to Lansing on the same wages, 70% more than they would owe on wages earned at home.',
  'Not modelled: the day-count apportionment a nonresident uses to work out how much of their wage was earned inside the city (Form DW-4 for Detroit, GRW-4 for Grand Rapids). Pass the apportioned figure as workCityEarnings. Sick, vacation and holiday days do not count as city days wherever they were taken.',
];

/**
 * The 24 cities, with the resident rate and the personal exemption each sets.
 *
 * The nonresident rate is absent on purpose: MCL 141.611 makes it half the
 * resident rate and every city honours that, so storing it would be storing 24
 * numbers that a division already produces. `nonresidentPublished` records the
 * separately published figure for the four cities that levy above 1%, so the
 * derivation has something to be checked against.
 */
const CITIES: readonly {
  readonly name: string;
  readonly residentRate: number;
  readonly exemption: number;
  /** The nonresident rate as the city itself publishes it, where it is not 0.5%. */
  readonly nonresidentPublished?: number;
}[] = [
  { name: 'Albion', residentRate: 0.01, exemption: 600 },
  { name: 'Battle Creek', residentRate: 0.01, exemption: 750 },
  { name: 'Benton Harbor', residentRate: 0.01, exemption: 750 },
  { name: 'Big Rapids', residentRate: 0.01, exemption: 600 },
  { name: 'Detroit', residentRate: 0.024, exemption: 600, nonresidentPublished: 0.012 },
  { name: 'East Lansing', residentRate: 0.01, exemption: 600 },
  { name: 'Flint', residentRate: 0.01, exemption: 600 },
  { name: 'Grand Rapids', residentRate: 0.015, exemption: 600, nonresidentPublished: 0.0075 },
  { name: 'Grayling', residentRate: 0.01, exemption: 3000 },
  { name: 'Hamtramck', residentRate: 0.01, exemption: 600 },
  { name: 'Highland Park', residentRate: 0.02, exemption: 600, nonresidentPublished: 0.01 },
  { name: 'Hudson', residentRate: 0.01, exemption: 1000 },
  { name: 'Ionia', residentRate: 0.01, exemption: 700 },
  { name: 'Jackson', residentRate: 0.01, exemption: 600 },
  { name: 'Lansing', residentRate: 0.01, exemption: 600 },
  { name: 'Lapeer', residentRate: 0.01, exemption: 600 },
  { name: 'Muskegon', residentRate: 0.01, exemption: 600 },
  { name: 'Muskegon Heights', residentRate: 0.01, exemption: 600 },
  { name: 'Pontiac', residentRate: 0.01, exemption: 600 },
  { name: 'Port Huron', residentRate: 0.01, exemption: 600 },
  { name: 'Portland', residentRate: 0.01, exemption: 1000 },
  { name: 'Saginaw', residentRate: 0.015, exemption: 750, nonresidentPublished: 0.0075 },
  { name: 'Springfield', residentRate: 0.01, exemption: 750 },
  { name: 'Walker', residentRate: 0.01, exemption: 600 },
];

/** The 24 city names, as Treasury's own list spells them. */
export const MICHIGAN_CITIES: readonly string[] = CITIES.map((c) => c.name);

/** The statutory floor on a personal or dependency exemption, MCL 141.631(1). */
export const MI_CITY_EXEMPTION_FLOOR = 600;

/**
 * The ordinary ceiling on a city's resident rate under the Uniform City Income
 * Tax Ordinance. Detroit, Highland Park, Grand Rapids and Saginaw exceed it
 * under their own enabling legislation.
 */
export const MI_CITY_ORDINARY_RATE_CEILING = 0.01;

/** MCL 141.611: the nonresident rate is one half of the resident rate. */
export function michiganNonresidentRate(residentRate: number): number {
  return residentRate / 2;
}

/**
 * The separately published nonresident rate for each city that levies above 1%,
 * exported so a test can check the halving against something it did not derive.
 */
export const MI_PUBLISHED_NONRESIDENT_RATES: ReadonlyMap<string, number> = new Map(
  CITIES.filter((c) => c.nonresidentPublished !== undefined).map((c) => [
    c.name,
    c.nonresidentPublished as number,
  ]),
);

/** The exemption each city allows, exported for the same reason. */
export const MI_CITY_EXEMPTIONS: ReadonlyMap<string, number> = new Map(
  CITIES.map((c) => [c.name, c.exemption]),
);

function definitionsFor(year: number): readonly LocalIncomeTaxDefinition[] {
  return CITIES.map((city) => ({
    code: city.name,
    name: `${city.name}, Michigan`,
    state: 'MI' as StateCode,
    year,
    // A city rate and a city exemption are fixed by ordinance and neither
    // indexes, so next year's figures are this year's until a council — and in
    // most cases the city's voters — change them. Unlike an indexed parameter
    // there is nothing unpublished waiting to arrive.
    status: 'published' as const,
    base: 'cityIncome' as const,
    rate: { kind: 'flat' as const, rate: city.residentRate },
    exemptionAmount: city.exemption,
    nonresidentEarningsRate: michiganNonresidentRate(city.residentRate),
    creditsTaxPaidToPeerLocality: true,
    notes: NOTES,
    citations: CITATIONS,
  }));
}

const LOOKUP: CountyLookup = {
  names: MICHIGAN_CITIES,
  byYear: countyRegistry([2025, 2026], definitionsFor),
  describe: 'Michigan has 24 cities levying an income tax',
  // A city name has no suffix to make optional, unlike "X County".
  suffix: null,
  noun: 'city',
};

export function michiganCity(city: string, year: number): LocalIncomeTaxDefinition {
  return resolveCounty(LOOKUP, 'MI', city, year);
}

/** Every Michigan city's definition for a year, for tests and tooling. */
export function michiganCities(year: number): readonly LocalIncomeTaxDefinition[] {
  return [...(LOOKUP.byYear.get(year)?.values() ?? [])];
}
