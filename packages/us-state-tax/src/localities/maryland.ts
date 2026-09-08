/**
 * Maryland's twenty-four local income taxes — twenty-three counties and
 * Baltimore City.
 *
 * ## The county tax is not a rounding error, it is a third of the bill
 *
 * Every Maryland resident owes one. There is no county-free jurisdiction, the
 * rate runs from 2.25% to 3.30% of the same Maryland taxable income the state
 * taxes, and for a middle-income filer it is roughly a third of the whole
 * Maryland income tax. A single filer at `$100,000` owes Montgomery County
 * `$2,990.40` — more than the *entire* state income tax of eleven of the
 * twenty-six states in this package at the same income: every one of the nine
 * that do not tax income, plus Arizona and Indiana. It appears in no table of
 * state income tax rates, because it is not one.
 *
 * ## Two counties have more than one rate, and only one of them is graduated
 *
 * Anne Arundel and Frederick both appear as multi-row entries in the same local
 * rate chart. They are not the same kind of object:
 *
 * ```text
 * Anne Arundel   marginal brackets     2.70% on the first $50,000, 2.94% above
 * Frederick      one rate, by bracket  2.96% on ALL of $150,000, 3.20% on all
 *                                      of $150,001
 * ```
 *
 * So the dollar that takes a Frederick single filer from `$150,000` of Maryland
 * taxable income to `$150,001` costs `$360.03`, and the same dollar in Anne
 * Arundel costs three cents. A model that reads the chart as brackets — which is
 * what a chart of rates and income ranges looks like — is wrong about Frederick
 * by the whole rate step times the whole income, three times over.
 *
 * ## The local earned income credit is the rate, times ten
 *
 * Md. Code, Tax-Gen. § 10-704(d) sets the county earned income credit at the
 * lesser of the county tax and **ten times the county rate** times the federal
 * § 32 credit. So twenty-four counties have twenty-four different earned income
 * credits and there is not one credit parameter in this file: Worcester's 2.25%
 * is a 22.5% match and Dorchester's 3.30% is a 33% match, and both follow the
 * rate automatically the next time a county council moves it.
 *
 * ## What sets the rate a nonresident pays
 *
 * § 10-106.1 charges a nonresident with Maryland-source income a "special
 * nonresident tax" in place of the county tax, and does not name a rate: it is
 * *the lowest county rate in the state*, which is Worcester's 2.25%. That is the
 * second derived figure here, and `test/maryland.test.js` asserts it against the
 * table below rather than storing it.
 */
import { byStatusOf } from '../states/helpers.js';
import type { LocalIncomeTaxDefinition } from './definition.js';
import type { Bracket, ByStatus, Citation, StateCode } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title: 'Md. Code, Tax-Gen. § 10-106 — county income tax rates, and the band a county may set within',
    url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-106&enactments=false',
  },
  {
    title: 'Md. Code, Tax-Gen. § 10-704 — the credit against the county income tax for earned income',
    url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-704&enactments=false',
  },
  {
    title: 'Md. Code, Tax-Gen. § 10-106.1 — the special nonresident tax, set to the lowest county rate',
    url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-106.1&enactments=false',
  },
  {
    title: 'Maryland 2025 Resident Tax Forms and Instructions — local tax rate chart and the local earned income credit worksheet',
    url: 'https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/2025/resident-booklet.pdf',
  },
  {
    title: 'Maryland Comptroller — local income tax rates and brackets',
    url: 'https://services.marylandcomptroller.gov/taxes/en/maryland-income-tax-rates-and-brackets',
  },
];

/**
 * The band a county rate may sit in, and the two figures derived from it.
 *
 * The floor is what the special nonresident tax rate is set to; the ceiling was
 * raised from 3.20% by local legislation that Dorchester and Kent are the only
 * users of. Exported so the tests can assert that every rate in the table is
 * inside it — a typo'd rate is otherwise indistinguishable from a rate change.
 */
export const MD_COUNTY_RATE_FLOOR = 0.0225;
export const MD_COUNTY_RATE_CEILING = 0.033;

/** How many times the county rate the local earned income credit is worth. */
export const MD_LOCAL_EITC_RATE_MULTIPLE = 10;

const NOTES: readonly string[] = [
  'Every Maryland resident owes a county income tax — there is no county-free jurisdiction — and it is charged on the same Maryland taxable income as the state tax, at 2.25% to 3.30%. For a middle-income filer it is about a third of the total Maryland bill, and it is invisible in every table of state income tax rates.',
  'The local earned income credit is not a stored number. Md. Code, Tax-Gen. § 10-704(d) makes it the lesser of the county tax and ten times the county rate times the federal earned income credit, so each county\'s match follows its own rate: 22.5% in Worcester, 33% in Dorchester. Supply the federal credit (Form 1040 line 27) or it is computed as zero.',
  'Not modelled: the LOCAL poverty level credit, which mirrors the state one against the county tax; the local child and dependent care credit; and Montgomery County\'s own refundable supplement, which pays a further 56% of the state refundable earned income credit and is a county programme rather than a Maryland tax credit. A Montgomery County family with a federal earned income credit is owed more than this package reports.',
  'A nonresident with Maryland-source income pays the special nonresident tax of § 10-106.1 instead of a county tax. It is not a stored rate either: the statute sets it to the lowest county rate in the state, which is Worcester\'s 2.25%. This package computes a full-year resident return; pass the county the filer lived in.',
];

const GRADUATED_NOTE =
  'This county is one of only two in Maryland with more than one rate, and the two are different KINDS of schedule. Anne Arundel\'s rates are marginal — each band is taxed at its own rate. Frederick\'s are not: the bracket selects ONE rate and it applies to the whole Maryland taxable income, so crossing a Frederick threshold costs the rate step times the entire income. At $150,000 of taxable income that is $360.03 on one dollar, against three cents for the same dollar in Anne Arundel.';

const EITC_RATE_NOTE =
  'Which rate a county with more than one of them uses for the local earned income credit is not recoverable from any source reachable here. This package follows PolicyEngine-US: Anne Arundel uses its lowest marginal rate, and Frederick uses the rate its bracket selects. The two readings can only differ for a filer whose Maryland taxable income leaves the bottom band while a federal earned income credit remains, and that bounds the disagreement at FIVE percentage points of the federal credit: a Frederick filer with enough taxable income to reach the 2.96% band has no federal earned income credit left, so only the 2.75% band is reachable. It is a narrow window, but it is a real one, and this note is here rather than a silent choice.';

/** One county's rate structure, in the shape the local engine walks. */
type CountyRate =
  | { readonly kind: 'flat'; readonly rate: number }
  | { readonly kind: 'brackets'; readonly byStatus: ByStatus<readonly Bracket[]> }
  | { readonly kind: 'rateByBracket'; readonly byStatus: ByStatus<readonly Bracket[]> };

/** A rate schedule whose thresholds differ between the single and joint columns. */
function twoColumn(
  single: readonly Bracket[],
  joint: readonly Bracket[],
): ByStatus<readonly Bracket[]> {
  return byStatusOf<readonly Bracket[]>({
    single,
    joint,
    // Married filing separately follows the single column in both counties, which
    // is the usual Maryland pattern — the state's own rate schedule does the same.
    separate: single,
    headOfHousehold: joint,
    qualifyingSurvivingSpouse: joint,
  });
}

/**
 * Anne Arundel County, marginal — Bill 79-24.
 *
 * The top band and the middle threshold are the parts a rate chart hides: 3.20%
 * above `$400,000` (`$480,000` joint) was added for 2024, and the middle rate
 * rose from 2.81% to 2.94% for 2025.
 */
const ANNE_ARUNDEL: CountyRate = {
  kind: 'brackets',
  byStatus: twoColumn(
    [
      { upTo: 50_000, rate: 0.027 },
      { upTo: 400_000, rate: 0.0294 },
      { upTo: Infinity, rate: 0.032 },
    ],
    [
      { upTo: 75_000, rate: 0.027 },
      { upTo: 480_000, rate: 0.0294 },
      { upTo: Infinity, rate: 0.032 },
    ],
  ),
};

/**
 * Frederick County — one rate, selected by bracket, charged on the whole income.
 *
 * Four rates and three cliffs. The largest is at the top: 2.96% to 3.20% on all
 * of `$150,000` is `$360.03` of tax on the dollar that crosses it.
 */
const FREDERICK: CountyRate = {
  kind: 'rateByBracket',
  byStatus: twoColumn(
    [
      { upTo: 25_000, rate: 0.0225 },
      { upTo: 50_000, rate: 0.0275 },
      { upTo: 150_000, rate: 0.0296 },
      { upTo: Infinity, rate: 0.032 },
    ],
    [
      { upTo: 25_000, rate: 0.0225 },
      { upTo: 100_000, rate: 0.0275 },
      { upTo: 250_000, rate: 0.0296 },
      { upTo: Infinity, rate: 0.032 },
    ],
  ),
};

/**
 * Every Maryland taxing jurisdiction, with the rate for each supported year.
 *
 * A rate that differs between the two years is written as a pair rather than as
 * one figure carried forward, because a carried-forward rate is not next year's
 * rate — it is the absence of one. Five counties changed for 2025 (Anne Arundel,
 * Calvert, Cecil, Dorchester and St. Mary's) and two for 2026 (Allegany, from
 * 3.03% to 3.20%, and Kent, from 3.20% to 3.30%).
 */
const COUNTIES: readonly {
  readonly name: string;
  readonly rate2025: CountyRate;
  readonly rate2026?: CountyRate;
}[] = [
  { name: 'Allegany County', rate2025: { kind: 'flat', rate: 0.0303 }, rate2026: { kind: 'flat', rate: 0.032 } },
  { name: 'Anne Arundel County', rate2025: ANNE_ARUNDEL },
  { name: 'Baltimore City', rate2025: { kind: 'flat', rate: 0.032 } },
  { name: 'Baltimore County', rate2025: { kind: 'flat', rate: 0.032 } },
  { name: 'Calvert County', rate2025: { kind: 'flat', rate: 0.032 } },
  { name: 'Caroline County', rate2025: { kind: 'flat', rate: 0.032 } },
  { name: 'Carroll County', rate2025: { kind: 'flat', rate: 0.0303 } },
  { name: 'Cecil County', rate2025: { kind: 'flat', rate: 0.0274 } },
  { name: 'Charles County', rate2025: { kind: 'flat', rate: 0.0303 } },
  { name: 'Dorchester County', rate2025: { kind: 'flat', rate: 0.033 } },
  { name: 'Frederick County', rate2025: FREDERICK },
  { name: 'Garrett County', rate2025: { kind: 'flat', rate: 0.0265 } },
  { name: 'Harford County', rate2025: { kind: 'flat', rate: 0.0306 } },
  { name: 'Howard County', rate2025: { kind: 'flat', rate: 0.032 } },
  { name: 'Kent County', rate2025: { kind: 'flat', rate: 0.032 }, rate2026: { kind: 'flat', rate: 0.033 } },
  { name: 'Montgomery County', rate2025: { kind: 'flat', rate: 0.032 } },
  { name: "Prince George's County", rate2025: { kind: 'flat', rate: 0.032 } },
  { name: "Queen Anne's County", rate2025: { kind: 'flat', rate: 0.032 } },
  { name: "St. Mary's County", rate2025: { kind: 'flat', rate: 0.032 } },
  { name: 'Somerset County', rate2025: { kind: 'flat', rate: 0.032 } },
  { name: 'Talbot County', rate2025: { kind: 'flat', rate: 0.024 } },
  { name: 'Washington County', rate2025: { kind: 'flat', rate: 0.0295 } },
  { name: 'Wicomico County', rate2025: { kind: 'flat', rate: 0.032 } },
  { name: 'Worcester County', rate2025: { kind: 'flat', rate: 0.0225 } },
];

/** The names this package answers to, for the error message and for callers. */
export const MARYLAND_COUNTIES: readonly string[] = COUNTIES.map((c) => c.name);

/**
 * Normalise a county name for matching.
 *
 * Case, punctuation and the trailing word "County" are all optional, because a
 * caller — often a language model filling in a form — writes "montgomery",
 * "Montgomery County" and "MONTGOMERY CO." for the same place. What is *not*
 * optional is the distinction between Baltimore City and Baltimore County: they
 * are separate jurisdictions with separate rates, so a bare "Baltimore" is
 * rejected rather than resolved to either.
 */
function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/\bco\b/g, 'county')
    .replace(/\s+/g, ' ')
    .trim();
}

const AMBIGUOUS: ReadonlyMap<string, readonly string[]> = new Map([
  ['baltimore', ['Baltimore City', 'Baltimore County']],
]);

/**
 * The Maryland county tax definitions for one year, keyed by normalised name.
 */
function definitionsFor(year: number): Map<string, LocalIncomeTaxDefinition> {
  const map = new Map<string, LocalIncomeTaxDefinition>();
  for (const county of COUNTIES) {
    const rate = year >= 2026 && county.rate2026 ? county.rate2026 : county.rate2025;
    const graduated = rate.kind !== 'flat';
    map.set(normalise(county.name), {
      code: county.name,
      name: `${county.name}, Maryland`,
      state: 'MD' as StateCode,
      year,
      status: 'published',
      // Md. Code, Tax-Gen. § 10-103: the county tax is imposed on Maryland
      // taxable income — the same line 20 the state rate schedule is applied to,
      // after the same deductions and exemptions. So every state deduction is
      // already inside the county tax, and a county rate quoted against gross
      // income overstates it.
      base: 'stateTaxableIncome',
      rate,
      earnedIncomeCreditRateMultiple: MD_LOCAL_EITC_RATE_MULTIPLE,
      notes: graduated ? [GRADUATED_NOTE, EITC_RATE_NOTE, ...NOTES] : NOTES,
      citations: CITATIONS,
    });
  }
  return map;
}

const BY_YEAR: ReadonlyMap<number, ReadonlyMap<string, LocalIncomeTaxDefinition>> = new Map(
  [2025, 2026].map((year) => [year, definitionsFor(year)]),
);

/**
 * Resolve a county name to its definition for a year.
 *
 * @throws {RangeError} when the name is not a Maryland jurisdiction, or is one
 * of the ambiguous ones. Both messages name the alternatives, because the caller
 * is often a language model and a model that cannot see the list will invent an
 * answer for a county that does not exist.
 */
export function marylandCounty(county: string, year: number): LocalIncomeTaxDefinition {
  const key = normalise(county);
  // Checked before the lookup, so that dropping the "County" suffix — which is
  // otherwise allowed — cannot silently resolve Baltimore County.
  const ambiguous = AMBIGUOUS.get(key);
  if (ambiguous) {
    throw new RangeError(
      `"${county}" is ambiguous in Maryland: ${ambiguous.join(' and ')} are separate ` +
        `jurisdictions that set their own income tax rates. Name which one.`,
    );
  }
  const forYear = BY_YEAR.get(year);
  if (!forYear) {
    throw new RangeError(
      `Maryland county income tax is supported for 2025 and 2026, not ${year}. Two counties ` +
        `changed their rate between them, so there is no fallback to the nearer year.`,
    );
  }
  // "Montgomery" and "Montgomery County" are the same place; "Baltimore" is not
  // a place, which is why the ambiguity check above comes first.
  const def = forYear.get(key) ?? forYear.get(`${key} county`);
  if (!def) {
    throw new RangeError(
      `"${county}" is not a Maryland taxing jurisdiction. Maryland has 23 counties plus ` +
        `Baltimore City, each setting its own income tax rate: ${MARYLAND_COUNTIES.join(', ')}. ` +
        `The word "County" is optional and matching ignores case.`,
    );
  }
  return def;
}

/** Every Maryland jurisdiction's definition for a year, for tests and tooling. */
export function marylandCounties(year: number): readonly LocalIncomeTaxDefinition[] {
  return [...(BY_YEAR.get(year)?.values() ?? [])];
}
