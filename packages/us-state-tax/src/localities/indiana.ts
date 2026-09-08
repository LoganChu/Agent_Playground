/**
 * Indiana's 92 county income taxes.
 *
 * ## The county tax is not a supplement, it is a second income tax
 *
 * Indiana's state rate is 3.00% in 2025 and 2.95% in 2026. The average county
 * rate is **1.914%**, so for a typical Indiana filer the county tax is about
 * **39% of the whole income tax bill** — and it is charged on the same line the
 * state rate is charged on, IT-40 line 7, after the same deductions and the same
 * $1,000 exemptions.
 *
 * The spread across the state is the part no summary carries:
 *
 * ```text
 * Randolph County   3.0000%   the statutory maximum, and MORE than the 2.95%
 *                             state rate in 2026 — a Randolph filer pays their
 *                             county more than their state
 * Cass County       2.9500%   exactly the 2026 state rate
 * Porter County     0.5000%   one sixth of Randolph's, on the same income
 * ```
 *
 * ## Four counties have rates with six decimal places
 *
 * Brown 2.5234%, Carroll 2.2733% (2.4733% from 2026), Jasper 2.8640%, Whitley
 * 1.6829%. A rate nobody would choose is a rate that was **computed** — Indiana's
 * local income tax rates are built from separate expenditure, public safety,
 * economic development and property tax relief components under IC 6-3.6, and
 * what the chart prints is their sum.
 *
 * ## 2026: the state cut its rate and six counties raised theirs by more
 *
 * The state rate falls 0.05 points for 2026. Carroll, Grant, Greene, Howard,
 * Shelby and Union all raised their county rate on the same day, by 0.10 to
 * **0.75** points. For a Union County filer with `$60,000` of Indiana taxable
 * income the state cut is worth `$30` and the county rise costs `$450`: the
 * state rate cut is invisible to them, and their total rate went **up** by 14%.
 *
 * ## Two rules a rate table cannot express
 *
 * **The county is the one you lived in on 1 January.** IC 6-3.6-8 and the CT-40
 * both key the whole year's county tax to the county of residence on New Year's
 * Day, so moving in February changes nothing until the following year — and a
 * filer who moved *before* it pays the new county's rate on income earned in the
 * old one.
 *
 * **The rate withheld and the rate owed can differ.** County rates take effect on
 * 1 January or on 1 October depending on when the ordinance was adopted
 * (IC 6-3.6-3), and the Department of Revenue revises Departmental Notice #1 for
 * withholding when they do. The annual return uses the 1 January rate. So a
 * county that raises its rate in October is withholding at one rate and settling
 * at another for the rest of the year, and this package models the return.
 */
import { countyRegistry, resolveCounty } from './counties.js';
import type { CountyLookup } from './counties.js';
import type { LocalIncomeTaxDefinition } from './definition.js';
import type { Citation, StateCode } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title: 'IC 6-3.6 — Indiana local income taxes, including the rate components and the maximum',
    url: 'https://iga.in.gov/laws/2025/ic/titles/6#6-3.6',
  },
  {
    title: 'Indiana Departmental Notice #1 — county income tax rates and county codes',
    url: 'https://www.in.gov/dor/files/dn01.pdf',
  },
  {
    title: 'Indiana DOR — county tax rates',
    url: 'https://www.in.gov/dor/i-am-a/business-corp/county-tax-information/',
  },
  {
    title: 'Schedule CT-40, County Tax Schedule for Indiana Residents — line 1 is IT-40 line 7',
    url: 'https://www.in.gov/dor/tax-forms/indiana-individual-income-tax-forms/',
  },
];

const NOTES: readonly string[] = [
  'Indiana\'s county income tax is charged on the SAME figure as the state tax — IT-40 line 7, Indiana taxable income after deductions and the $1,000 exemptions — so Schedule CT-40 line 1 is the state return\'s own bottom line. The average county rate is 1.914% against a state rate of 3.00% (2025) and 2.95% (2026), which makes the county tax about 39% of a typical Indiana income tax bill.',
  'The county is the one the filer lived in on 1 JANUARY, for the whole year (IC 6-3.6-8 and the CT-40 instructions). Moving in February changes nothing until the following year, and a filer who moved on New Year\'s Eve pays the new county\'s rate on income earned in the old one.',
  'A county rate can change on 1 October as well as on 1 January, depending on when the ordinance was adopted (IC 6-3.6-3), and the Department of Revenue revises Departmental Notice #1 for withholding when it does. The ANNUAL RETURN uses the 1 January rate, which is what this package stores — so in a county that raised its rate in October, the rate withheld and the rate owed are different numbers.',
  'Not modelled: Schedule CT-40PNR, the nonresident and part-year county tax, which apportions by the county the income was earned in rather than the county of residence. This package computes a full-year resident return.',
];

/**
 * Every Indiana county and its rate for each supported year.
 *
 * A rate that differs between the two years is written as a pair rather than as
 * one figure carried forward: ten counties changed for 2025 and six — Carroll,
 * Grant, Greene, Howard, Shelby and Union — for 2026.
 */
const COUNTIES: readonly {
  readonly name: string;
  readonly rate2025: number;
  readonly rate2026?: number;
}[] = [
  { name: 'Adams', rate2025: 0.016 },
  { name: 'Allen', rate2025: 0.0159 },
  { name: 'Bartholomew', rate2025: 0.0175 },
  { name: 'Benton', rate2025: 0.0179 },
  { name: 'Blackford', rate2025: 0.025 },
  { name: 'Boone', rate2025: 0.017 },
  { name: 'Brown', rate2025: 0.025234 },
  { name: 'Carroll', rate2025: 0.022733, rate2026: 0.024733 },
  { name: 'Cass', rate2025: 0.0295 },
  { name: 'Clark', rate2025: 0.02 },
  { name: 'Clay', rate2025: 0.0235 },
  { name: 'Clinton', rate2025: 0.0265 },
  { name: 'Crawford', rate2025: 0.0165 },
  { name: 'Daviess', rate2025: 0.015 },
  { name: 'DeKalb', rate2025: 0.0213 },
  { name: 'Dearborn', rate2025: 0.014 },
  { name: 'Decatur', rate2025: 0.0245 },
  { name: 'Delaware', rate2025: 0.015 },
  { name: 'Dubois', rate2025: 0.012 },
  { name: 'Elkhart', rate2025: 0.02 },
  { name: 'Fayette', rate2025: 0.0282 },
  { name: 'Floyd', rate2025: 0.0189 },
  { name: 'Fountain', rate2025: 0.021 },
  { name: 'Franklin', rate2025: 0.017 },
  { name: 'Fulton', rate2025: 0.0288 },
  { name: 'Gibson', rate2025: 0.013 },
  { name: 'Grant', rate2025: 0.0255, rate2026: 0.0275 },
  { name: 'Greene', rate2025: 0.0215, rate2026: 0.0235 },
  { name: 'Hamilton', rate2025: 0.011 },
  { name: 'Hancock', rate2025: 0.0194 },
  { name: 'Harrison', rate2025: 0.01 },
  { name: 'Hendricks', rate2025: 0.017 },
  { name: 'Henry', rate2025: 0.0202 },
  { name: 'Howard', rate2025: 0.0195, rate2026: 0.0235 },
  { name: 'Huntington', rate2025: 0.0195 },
  { name: 'Jackson', rate2025: 0.021 },
  { name: 'Jasper', rate2025: 0.02864 },
  { name: 'Jay', rate2025: 0.025 },
  { name: 'Jefferson', rate2025: 0.0103 },
  { name: 'Jennings', rate2025: 0.025 },
  { name: 'Johnson', rate2025: 0.014 },
  { name: 'Knox', rate2025: 0.017 },
  { name: 'Kosciusko', rate2025: 0.01 },
  { name: 'LaGrange', rate2025: 0.0165 },
  { name: 'LaPorte', rate2025: 0.0145 },
  { name: 'Lake', rate2025: 0.015 },
  { name: 'Lawrence', rate2025: 0.0175 },
  { name: 'Madison', rate2025: 0.0225 },
  { name: 'Marion', rate2025: 0.0202 },
  { name: 'Marshall', rate2025: 0.0125 },
  { name: 'Martin', rate2025: 0.025 },
  { name: 'Miami', rate2025: 0.0254 },
  { name: 'Monroe', rate2025: 0.0214 },
  { name: 'Montgomery', rate2025: 0.0265 },
  { name: 'Morgan', rate2025: 0.0272 },
  { name: 'Newton', rate2025: 0.01 },
  { name: 'Noble', rate2025: 0.0175 },
  { name: 'Ohio', rate2025: 0.02 },
  { name: 'Orange', rate2025: 0.0175 },
  { name: 'Owen', rate2025: 0.025 },
  { name: 'Parke', rate2025: 0.0265 },
  { name: 'Perry', rate2025: 0.014 },
  { name: 'Pike', rate2025: 0.012 },
  { name: 'Porter', rate2025: 0.005 },
  { name: 'Posey', rate2025: 0.0145 },
  { name: 'Pulaski', rate2025: 0.0285 },
  { name: 'Putnam', rate2025: 0.023 },
  { name: 'Randolph', rate2025: 0.03 },
  { name: 'Ripley', rate2025: 0.0238 },
  { name: 'Rush', rate2025: 0.0215 },
  { name: 'Scott', rate2025: 0.0216 },
  { name: 'Shelby', rate2025: 0.016, rate2026: 0.017 },
  { name: 'Spencer', rate2025: 0.008 },
  { name: 'St. Joseph', rate2025: 0.0175 },
  { name: 'Starke', rate2025: 0.0171 },
  { name: 'Steuben', rate2025: 0.0199 },
  { name: 'Sullivan', rate2025: 0.017 },
  { name: 'Switzerland', rate2025: 0.0145 },
  { name: 'Tippecanoe', rate2025: 0.0128 },
  { name: 'Tipton', rate2025: 0.026 },
  { name: 'Union', rate2025: 0.02, rate2026: 0.0275 },
  { name: 'Vanderburgh', rate2025: 0.0125 },
  { name: 'Vermillion', rate2025: 0.015 },
  { name: 'Vigo', rate2025: 0.02 },
  { name: 'Wabash', rate2025: 0.029 },
  { name: 'Warren', rate2025: 0.0212 },
  { name: 'Warrick', rate2025: 0.01 },
  { name: 'Washington', rate2025: 0.02 },
  { name: 'Wayne', rate2025: 0.0125 },
  { name: 'Wells', rate2025: 0.021 },
  { name: 'White', rate2025: 0.0232 },
  { name: 'Whitley', rate2025: 0.016829 },
];

/** The 92 county names, as Departmental Notice #1 spells them. */
export const INDIANA_COUNTIES: readonly string[] = COUNTIES.map((c) => c.name);

/** The maximum a county may levy under IC 6-3.6-6, and the lowest in force. */
export const IN_COUNTY_RATE_CEILING = 0.03;

function definitionsFor(year: number): readonly LocalIncomeTaxDefinition[] {
  return COUNTIES.map((county) => ({
    code: `${county.name} County`,
    name: `${county.name} County, Indiana`,
    state: 'IN' as StateCode,
    year,
    status: 'published' as const,
    // Schedule CT-40 line 1 is IT-40 line 7 — the state's own taxable income,
    // after the deductions and the exemptions. So every Indiana exemption is
    // already inside the county tax, and a county rate quoted against gross
    // income overstates it.
    base: 'stateTaxableIncome' as const,
    rate: {
      kind: 'flat' as const,
      rate: year >= 2026 && county.rate2026 !== undefined ? county.rate2026 : county.rate2025,
    },
    notes: NOTES,
    citations: CITATIONS,
  }));
}

const LOOKUP: CountyLookup = {
  names: INDIANA_COUNTIES,
  byYear: countyRegistry([2025, 2026], definitionsFor),
  describe: 'Indiana has 92 counties, each setting its own income tax rate',
};

export function indianaCounty(county: string, year: number): LocalIncomeTaxDefinition {
  return resolveCounty(LOOKUP, 'IN', county, year);
}

/** Every Indiana county's definition for a year, for tests and tooling. */
export function indianaCounties(year: number): readonly LocalIncomeTaxDefinition[] {
  return [...(LOOKUP.byYear.get(year)?.values() ?? [])];
}
