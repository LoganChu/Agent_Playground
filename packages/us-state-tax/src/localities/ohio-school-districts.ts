/**
 * Ohio's 214 school district income taxes.
 *
 * ## A third base, on the same paycheck
 *
 * Ohio taxes a wage three times over, and the three do not agree about what a
 * wage is. The state taxes federal AGI as adjusted; a municipality taxes
 * § 718.01(R) qualifying wages, which is box 5 of the W-2; and a school district
 * taxes one of **two** further bases, chosen by the district's own ballot
 * language:
 *
 * ```text
 * traditional      MAGI less exemptions — Ohio AGI with the business income
 *                  deduction ADDED BACK, less the personal exemptions
 *                  146 districts
 *
 * earned income    wages and net self-employment earnings only, to the extent
 *                  included in MAGI, with NO deductions and NO exemptions
 *                   68 districts
 * ```
 *
 * The second is where it gets interesting, because it is a wage tax sitting
 * beside another wage tax with the opposite answer:
 *
 * ```text
 * a $24,500 elective deferral, for a filer in both jurisdictions
 *   municipality   box 5 of the W-2, gross of the deferral   -> taxed
 *   school district  wages included in MAGI, box 1           -> not taxed
 * ```
 *
 * **The same dollar, deferred out of the same paycheck, is inside one local wage
 * tax and outside the other.** A model that reads "Ohio local wage tax" as one
 * thing gets one of the two wrong whichever way it guesses.
 *
 * The traditional base has the mirror-image quirk. A pass-through owner's
 * business income deduction takes `$250,000` out of Ohio AGI and out of the
 * municipal base — and a traditional district **adds it straight back**, so the
 * district taxes income the state does not. An earned-income district does not
 * add it back, because self-employment earnings are already inside its base.
 *
 * ## The rates are quarter points, and that is a statute rather than a habit
 *
 * O.R.C. § 5748.02 requires a school district income tax to be levied at a
 * multiple of one quarter of one per cent, and all 214 are:
 *
 * ```text
 * 0.25%    2 districts
 * 0.50%   20
 * 0.75%   29
 * 1.00%   81 — the modal rate
 * 1.25%   27
 * 1.50%   28
 * 1.75%   20
 * 2.00%    7
 * ```
 *
 * That is also the strongest check available on a transcription of the table:
 * 214 rates that are all exact multiples of `0.0025` is not what a mis-parse
 * looks like.
 *
 * ## Every levy has an expiry date, and the name carries it
 *
 * Ohio publishes each district's rate with the terms of the levies that make it
 * up — `Danville LSD (1.25% expires 2034; 0.50% CPT)` is a 1.75% rate built from
 * a levy that ends in 2034 and one that runs until repealed. The note is kept
 * verbatim in the district's name rather than parsed into a structure, because
 * the thing a caller needs from it is that **this rate has an end date**, and
 * the composition is Ohio's own words for why.
 *
 * ## What this is not
 *
 * A district is where the filer **lives**, not where they work: § 5748.01(E)
 * reaches residents only, so there is no nonresident school district tax and no
 * credit for tax paid to another district. A filer who moves between districts
 * mid-year files a part-year return this package does not compute.
 */
import { normaliseCounty } from './counties.js';
import type { LocalIncomeTaxDefinition } from './definition.js';
import type { Citation, StateCode } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title: 'O.R.C. Chapter 5748 — school district income taxes, the two bases and the quarter-point rate',
    url: 'https://codes.ohio.gov/ohio-revised-code/chapter-5748',
  },
  {
    title: 'O.R.C. § 5748.01(E) — the traditional base, and (E)(1)(b) the earned income base',
    url: 'https://codes.ohio.gov/ohio-revised-code/section-5748.01',
  },
  {
    title: 'Ohio Department of Taxation — school district income tax rates for tax year 2026 (SDIT_LIST)',
    url: 'https://tax.ohio.gov/static/tax_analysis/tax_data_series/school_district_data/SDIT_LIST.pdf',
  },
  {
    title: "Ohio Department of Taxation — Guide to Ohio's School District Income Tax",
    url: 'https://tax.ohio.gov/static/tax_analysis/tax_data_series/school_district_data/sditqa.pdf',
  },
  {
    title: 'Ohio SD 100 — the school district income tax return',
    url: 'https://tax.ohio.gov/individual/file-now/it-1040-instructions',
  },
];

const NOTES: readonly string[] = [
  'A school district income tax is charged on WHERE THE FILER LIVES and on nothing else — § 5748.01(E) reaches residents only. There is no nonresident district tax and no credit for tax paid to another district, which is the whole difference from Ohio’s municipal tax sitting beside it.',
  'Ohio taxes the same wage on three different bases. The state taxes federal AGI as adjusted; a municipality taxes § 718.01(R) qualifying wages, which is BOX 5 of the W-2; and a school district taxes either MAGI less exemptions (traditional) or wages and self-employment earnings as included in MAGI, which is BOX 1 (earned income). So a 401(k) elective deferral is INSIDE the municipal base and OUTSIDE the school district one, on the same paycheck.',
  'A traditional district ADDS BACK the business income deduction: its base is MODIFIED adjusted gross income less exemptions, so a pass-through owner whose $250,000 deduction removed the income from Ohio AGI and from the municipal base is still taxed on it by their school district. An earned income district does not add it back, because self-employment earnings are already in its base.',
  'An earned income district allows NO deductions and NO exemptions at all — not the personal exemption the traditional base subtracts, and nothing else. The rate is charged on the first dollar of wages.',
  'The $50 senior citizen credit is per return and per district, for a filer aged 65 or over, and it is allowed on both bases. It is the only credit against this tax.',
  'The rate published for a district is the SUM of the levies in force, and every levy has terms: the district name here carries Ohio’s own note of them verbatim — "expires 2034" for a dated levy and "CPT" for one that runs until repealed. A rate with an expiry date is a rate that will change.',
  'Not modelled: the part-year return for a filer who moved between districts, the estate tax base some districts once used, and the withholding schedule. Rates are for tax year 2026 as Ohio published them on 30 December 2025 and are carried into 2025 in this package, which is wrong for any district whose rate changed between the two years — pass 2026 for the published figure.',
];

/**
 * Every taxing district: number, county, name, rate in hundred-thousandths, and
 * `t` or `e` for the base.
 *
 * The four-digit number is the key, because it is what Ohio's own forms, its
 * Finder and every payroll system use, and because two district names collide —
 * there are two Northwestern LSDs and two Crestview LSDs in different counties.
 * A name resolves when it is unique and is an error naming the numbers when it
 * is not.
 */
const TABLE = `
0203|Allen|Bluffton EVSD (expires 2028)|500|t
0204|Allen|Delphos CSD (expires 2030)|500|t
0209|Allen|Spencerville LSD (expires 2027)|1000|t
0302|Ashland|Hillsdale LSD (expires 2033)|1250|e
0303|Ashland|Loudonville-Perrysville EVSD|1250|t
0404|Ashtabula|Geneva Area CSD (expires 2028)|1250|e
0502|Athens|Athens CSD (expires 2028)|1000|e
0505|Athens|Trimble LSD (expires 2030)|1000|e
0601|Auglaize|Minster LSD (expires 2031)|1000|t
0602|Auglaize|New Bremen LSD|1000|t
0603|Auglaize|New Knoxville LSD (0.25% expires 2029; 1.00% CPT)|1250|t
0604|Auglaize|St Marys CSD (expires 2028)|1000|e
0605|Auglaize|Wapakoneta CSD|750|t
0606|Auglaize|Waynesfield-Goshen LSD (expires 2026)|1000|t
0905|Butler|Madison LSD|500|t
0907|Butler|New Miami LSD|1000|t
0908|Butler|Ross LSD|1250|e
0909|Butler|Talawanda CSD|1000|t
1102|Champaign|Mechanicsburg EVSD (1.00% expires 2041; 0.50% CPT)|1500|t
1103|Champaign|Triad LSD (0.50% expires 2030; 1.00% CPT)|1500|t
1105|Champaign|West Liberty-Salem LSD (1.00% expires 2027; 0.25% expires 2036; 0.50% CPT)|1750|t
1203|Clark|Northeastern LSD (expires 2035)|1000|e
1204|Clark|Northwestern LSD|1000|e
1205|Clark|Southeastern LSD|1000|t
1303|Clermont|Clermont-Northeastern LSD|1000|t
1305|Clermont|Goshen LSD|1000|t
1401|Clinton|Blanchester LSD (expires 2028)|1000|e
1402|Clinton|Clinton-Massie LSD (expires 2030)|1000|e
1502|Columbiana|Columbiana EVSD|1000|t
1503|Columbiana|Crestview LSD|1000|t
1510|Columbiana|United LSD|500|t
1701|Crawford|Buckeye Central LSD|1500|t
1703|Crawford|Colonel Crawford LSD|1250|t
1704|Crawford|Crestline EVSD|250|e
1901|Darke|Ansonia LSD (1.00% expires 2030; 0.75% CPT)|1750|t
1902|Darke|Arcanum-Butler LSD (0.75% expires 2030; 0.75% CPT)|1500|t
1903|Darke|Franklin Monroe LSD|750|t
1904|Darke|Greenville CSD|500|t
1905|Darke|Mississinawa Valley LSD (0.75% expires 2031; 1.00% CPT)|1750|t
1906|Darke|Tri-Village LSD|1500|t
1907|Darke|Versailles EVSD (expires 2028)|1000|t
2001|Defiance|Ayersville LSD (expires 2027)|1000|t
2002|Defiance|Central LSD (0.50% expires 2029; 0.75% CPT)|1250|t
2003|Defiance|Defiance CSD|500|t
2004|Defiance|Hicksville EVSD (0.75% expires 2029; 0.75% CPT)|1500|t
2101|Delaware|Big Walnut LSD|750|t
2102|Delaware|Buckeye Valley LSD|1000|t
2301|Fairfield|Amanda-Clearcreek LSD (expires 2034)|2000|e
2302|Fairfield|Berne Union LSD|2000|e
2303|Fairfield|Bloom-Carroll LSD|1250|t
2304|Fairfield|Fairfield Union LSD (1.00% expires 2036; 1.00% CPT)|2000|t
2305|Fairfield|Lancaster CSD|1500|e
2306|Fairfield|Liberty Union-Thurston LSD|1750|t
2307|Fairfield|Pickerington LSD|1000|t
2308|Fairfield|Walnut Township LSD (expires 2033)|1750|e
2402|Fayette|Washington Court House CSD (expires 2027)|1000|e
2501|Franklin|Bexley CSD|750|t
2502|Franklin|Canal Winchester LSD|750|t
2509|Franklin|Reynoldsburg CSD|500|t
2514|Franklin|Westerville CSD (CPT)|750|e
2602|Fulton|Evergreen LSD (0.25% expires 2027; 0.50% expires 2029; 0.75% CPT)|1500|t
2603|Fulton|Fayette LSD|1000|t
2604|Fulton|Pettisville LSD|1000|t
2605|Fulton|Pike-Delta-York LSD (existing 1% expires 2026, 1.25% CPT begins 2027)|1000|t
2606|Fulton|Swanton LSD (expires 2029)|750|t
2607|Fulton|Wauseon EVSD (expires 2027)|1750|e
2801|Geauga|Berkshire LSD|1000|e
2902|Greene|Cedar Cliff LSD (0.25% expires 2038; 1.00% CPT)|1250|t
2903|Greene|Fairborn CSD|500|t
2904|Greene|Greeneview LSD|1000|t
2906|Greene|Xenia Community CSD (expires 2030)|500|t
2907|Greene|Yellow Springs EVSD|2000|t
3118|Hamilton|Southwest LSD|750|e
3122|Hamilton|Wyoming CSD|1250|t
3201|Hancock|Arcadia LSD (expires 2029)|1000|t
3202|Hancock|Arlington LSD|1750|t
3203|Hancock|Cory-Rawson LSD (0.75% expires 2028; 1.00% CPT)|1750|t
3204|Hancock|Findlay CSD (CPT)|1000|e
3205|Hancock|Liberty-Benton LSD (expires 2030)|750|t
3206|Hancock|McComb LSD|1500|t
3207|Hancock|Van Buren LSD (expires 2030)|1000|t
3208|Hancock|Vanlue LSD|1000|t
3301|Hardin|Ada EVSD (0.75% expires 2027; 0.75% CPT)|1500|t
3302|Hardin|Hardin Northern LSD|1750|t
3303|Hardin|Kenton CSD|1000|t
3304|Hardin|Ridgemont LSD (0.75% expires 2030; 1.00% CPT)|1750|t
3305|Hardin|Riverdale LSD (expires 2026)|1000|t
3306|Hardin|Upper Scioto Valley LSD|500|t
3501|Henry|Holgate LSD|1500|t
3502|Henry|Liberty Center LSD|1750|t
3504|Henry|Patrick Henry LSD|1750|t
3603|Highland|Greenfield EVSD|1250|e
3604|Highland|Hillsboro CSD|1000|t
3901|Huron|Bellevue CSD (expires 2036)|500|t
3902|Huron|Monroeville LSD|1500|e
3903|Huron|New London LSD|1000|t
3904|Huron|Norwalk CSD|500|t
3905|Huron|South Central LSD|1250|t
3906|Huron|Western Reserve LSD|1250|t
3907|Huron|Willard CSD|750|e
4201|Knox|Centerburg LSD|750|t
4202|Knox|Danville LSD (1.25% expires 2034; 0.50% CPT)|1750|t
4501|Licking|Granville EVSD (expires 2028)|750|t
4503|Licking|Johnstown-Monroe LSD (expires 2028)|1000|t
4506|Licking|Licking Valley LSD|1000|t
4507|Licking|Newark CSD|1000|t
4508|Licking|North Fork LSD (expires 2031)|1000|e
4509|Licking|Northridge LSD (expires 2046)|500|e
4510|Licking|Southwest Licking LSD|750|t
4604|Logan|Riverside LSD|1500|e
4712|Lorain|Oberlin CSD (0.75% expires 2027; 1.25% CPT)|2000|t
4715|Lorain|Wellington EVSD|1000|t
4901|Madison|Jefferson LSD (expires 2033)|1000|e
4902|Madison|Jonathan Alder LSD (0.75% expires 2026, 0.50% expires 2031)|1250|e
4903|Madison|London CSD|1000|t
4904|Madison|Madison Plains LSD (expires 2033)|1250|e
5008|Mahoning|Sebring LSD (expires 2026)|1000|e
5010|Mahoning|Springfield LSD (expires 2029)|1000|t
5101|Marion|Elgin LSD|750|e
5103|Marion|Pleasant LSD (expires 2029)|1000|e
5104|Marion|Ridgedale LSD|1000|e
5105|Marion|River Valley LSD (expires 2029)|1000|e
5204|Medina|Cloverleaf LSD (0.75% expires 2034, 0.25% CPT)|1000|e
5401|Mercer|Celina CSD (expires 2028)|1000|e
5402|Mercer|Coldwater EVSD (0.50% expires 2030, 0.50% CPT)|1000|t
5403|Mercer|Marion LSD (expires 2053)|500|e
5405|Mercer|Parkway LSD (expires 2030)|1000|t
5406|Mercer|Fort Recovery LSD|1500|t
5501|Miami|Bethel LSD (expires 2030)|750|e
5502|Miami|Bradford EVSD|1750|t
5503|Miami|Covington EVSD (1.25% expires 2030; 0.75% CPT)|2000|t
5504|Miami|Miami East LSD|1750|e
5505|Miami|Milton Union EVSD (0.75% expires 2030, 1.25% CPT)|2000|e
5506|Miami|Newton LSD (0.75% expires 2028; 1.00% CPT)|1750|t
5507|Miami|Piqua CSD|1250|t
5509|Miami|Troy CSD|1500|e
5708|Montgomery|New Lebanon LSD (0.75% expires 2030; 0.50% expires 2031)|1250|t
5713|Montgomery|Valley View LSD|1750|t
5901|Morrow|Cardington-Lincoln LSD (expires 2028)|750|e
5902|Morrow|Highland LSD|500|t
5903|Morrow|Mount Gilead EVSD (0.75% CPT)|750|t
5904|Morrow|Northmor LSD|1000|t
6301|Paulding|Antwerp LSD (0.75% expires 2030; 0.75% CPT)|1500|t
6302|Paulding|Paulding EVSD|1000|t
6303|Paulding|Wayne Trace LSD (0.75% expires 2031; 0.50% CPT)|1250|t
6501|Pickaway|Circleville CSD|750|e
6502|Pickaway|Logan Elm LSD (expires 2030)|1000|e
6503|Pickaway|Teays Valley LSD|1500|e
6704|Portage|James A Garfield LSD (expires 2028)|1500|e
6802|Preble|National Trail LSD (0.75% expires 2030; 1.00% CPT)|1750|t
6803|Preble|Eaton CSD (0.75% expires 2030; 0.75% CPT)|1500|t
6804|Preble|Preble-Shawnee LSD (0.75% expires 2031; 1.00% CPT)|1750|t
6805|Preble|Twin Valley Community LSD (0.75% expires 2027; 0.75% expires 2028)|1500|t
6806|Preble|Tri-County North LSD (expires 2029)|1000|e
6901|Putnam|Columbus Grove LSD (0.75% expires 2030; 0.25% expires 2032)|1000|t
6902|Putnam|Continental LSD|1000|t
6903|Putnam|Jennings LSD (expires 2030)|750|t
6904|Putnam|Kalida LSD|1000|t
6905|Putnam|Leipsic LSD|750|t
6906|Putnam|Miller City-New Cleveland LSD|1250|t
6907|Putnam|Ottawa-Glandorf LSD|1500|t
6908|Putnam|Ottoville LSD|750|t
6909|Putnam|Pandora-Gilboa LSD (1.00% expires 2036; 0.75% expires 2033)|1750|t
7001|Richland|Clear Fork Valley LSD (expires 2037)|1000|e
7007|Richland|Plymouth-Shiloh LSD|1000|t
7008|Richland|Shelby CSD|1000|t
7106|Ross|Union-Scioto LSD (expires 2029)|500|t
7107|Ross|Zane Trace LSD (CPT)|750|e
7201|Sandusky|Clyde-Green Springs EVSD (0.50% expires 2030; 1.00% CPT)|1500|e
7202|Sandusky|Fremont CSD (expires 2028)|1250|t
7203|Sandusky|Gibsonburg EVSD (expires 2028)|1000|e
7204|Sandusky|Lakota LSD|1500|t
7403|Seneca|Hopewell-Loudon LSD (expires 2048)|500|e
7404|Seneca|New Riegel LSD (0.75% expires 2031; 0.75% CPT)|1500|t
7405|Seneca|Old Fort LSD|1000|t
7406|Seneca|Seneca East LSD (expires 2030)|1000|t
7407|Seneca|Tiffin CSD (expires 2031)|750|e
7501|Shelby|Anna LSD|1500|t
7502|Shelby|Botkins LSD|1250|e
7503|Shelby|Fairlawn LSD|750|t
7504|Shelby|Fort Loramie LSD (expires 2029)|1500|t
7505|Shelby|Hardin-Houston LSD|750|t
7506|Shelby|Jackson Center LSD|1500|e
7507|Shelby|Russia LSD|750|t
7508|Shelby|Sidney CSD (expires 2031)|750|e
7612|Stark|Northwest LSD (expires 2032)|1000|e
7711|Summit|Norton CSD|500|e
8001|Union|Fairbanks LSD (0.25% CPT; 0.75% CPT)|1000|t
8003|Union|North Union LSD|1000|t
8101|Van Wert|Crestview LSD|1000|t
8104|Van Wert|Van Wert CSD|1000|t
8301|Warren|Carlisle LSD|1000|t
8303|Warren|Kings LSD (CPT)|1000|e
8501|Wayne|Chippewa LSD (expires 2027)|1000|e
8502|Wayne|Dalton LSD|750|t
8503|Wayne|Green LSD (expires 2028)|500|e
8504|Wayne|Norwayne LSD (expires 2028)|750|e
8505|Wayne|Northwestern LSD|1250|t
8509|Wayne|Triway LSD (expires 2045)|1000|e
8601|Williams|Bryan CSD|1000|t
8602|Williams|Edgerton LSD|1000|t
8604|Williams|Millcreek-West Unity LSD|1000|t
8605|Williams|Montpelier EVSD|1250|e
8607|Williams|Stryker LSD (0.25% expires 2031; 1.25% CPT)|1500|t
8701|Wood|Bowling Green CSD (0.75% expires 2030, 0.50% CPT)|1250|t
8702|Wood|Eastwood LSD (expires 2031)|1000|e
8703|Wood|Elmwood LSD (0.50% expires 2030; 0.75% expires 2031)|1250|t
8705|Wood|North Baltimore LSD (1.00% expires 2027; 0.25% expires 2034)|1250|e
8706|Wood|Northwood LSD|250|e
8707|Wood|Otsego LSD|1000|t
8708|Wood|Perrysburg EVSD|500|t
8801|Wyandot|Carey EVSD (expires 2029)|1000|t
8802|Wyandot|Mohawk LSD (expires 2030)|1000|t
8803|Wyandot|Upper Sandusky EVSD (expires 2029)|1250|t`;

interface District {
  readonly number: string;
  readonly county: string;
  readonly name: string;
  readonly rate: number;
  readonly earnedIncomeBase: boolean;
}

const DISTRICTS: readonly District[] = TABLE.trim()
  .split('\n')
  .map((line) => {
    const [number, county, name, rate, base] = line.split('|') as [
      string,
      string,
      string,
      string,
      string,
    ];
    return {
      number,
      county,
      name,
      rate: Number(rate) / 100_000,
      earnedIncomeBase: base === 'e',
    };
  });

/** Every taxing district's four-digit number, in Ohio's own order. */
export const OHIO_SCHOOL_DISTRICTS: readonly string[] = DISTRICTS.map((d) => d.number);

/** Each district's rate, keyed by its four-digit number. */
export const OHIO_SCHOOL_DISTRICT_RATES: ReadonlyMap<string, number> = new Map(
  DISTRICTS.map((d) => [d.number, d.rate]),
);

/** The 68 districts that tax earned income only, keyed by number. */
export const OHIO_EARNED_INCOME_DISTRICTS: readonly string[] = DISTRICTS.filter(
  (d) => d.earnedIncomeBase,
).map((d) => d.number);

/** § 5748.02: a school district income tax rate is a multiple of this. */
export const OH_SDIT_RATE_INCREMENT = 0.0025;

/** The senior citizen credit, per return and per district. SD 100 line 4. */
export const OH_SDIT_SENIOR_CREDIT = 50;

function definitionFor(district: District, year: number): LocalIncomeTaxDefinition {
  return {
    code: district.number,
    name: `${district.name} school district (${district.number}), ${district.county} County, Ohio`,
    state: 'OH' as StateCode,
    year,
    // Rates are published for 2026 and carried into 2025 — see the notes. A
    // district rate changes only by a vote of its electors, but it changes often
    // enough that a year-old figure is a real risk, which is what `provisional`
    // is for.
    status: year >= 2026 ? ('published' as const) : ('provisional' as const),
    base: district.earnedIncomeBase
      ? ('stateEarnedIncome' as const)
      : ('stateModifiedTaxableIncome' as const),
    rate: { kind: 'flat' as const, rate: district.rate },
    seniorCredit: {
      name: 'Senior citizen credit',
      amount: OH_SDIT_SENIOR_CREDIT,
      minimumAge: 65,
    },
    notes: NOTES,
    citations: CITATIONS,
  };
}

const BY_YEAR: ReadonlyMap<number, ReadonlyMap<string, LocalIncomeTaxDefinition>> = new Map(
  [2025, 2026].map((year) => [
    year,
    new Map(DISTRICTS.map((d) => [d.number, definitionFor(d, year)])),
  ]),
);

/** Names that more than one district answers to, keyed by the normalised name. */
const BY_NAME: ReadonlyMap<string, readonly District[]> = (() => {
  const groups = new Map<string, District[]>();
  for (const district of DISTRICTS) {
    // The parenthetical is Ohio's note of the levies making up the rate, not
    // part of the name a caller will type.
    const bare = normaliseCounty(district.name.replace(/\s*\(.*?\)\s*/g, ' '));
    groups.set(bare, [...(groups.get(bare) ?? []), district]);
  }
  return groups;
})();

/**
 * Resolve a school district by its four-digit number or by its name.
 *
 * @throws {RangeError} when the name is unknown, when it names more than one
 * district, or when the year is not supported. The message always names the
 * four-digit numbers, because that is the identifier Ohio's own forms use and
 * the one a caller can act on.
 */
export function ohioSchoolDistrict(district: string, year: number): LocalIncomeTaxDefinition {
  const forYear = BY_YEAR.get(year);
  if (!forYear) {
    throw new RangeError(
      `Ohio school district income tax is supported for ${[...BY_YEAR.keys()].join(' and ')}, ` +
        `not ${year}.`,
    );
  }
  const trimmed = district.trim();
  const byNumber = forYear.get(trimmed) ?? forYear.get(trimmed.padStart(4, '0'));
  if (byNumber) return byNumber;

  const matches = BY_NAME.get(normaliseCounty(trimmed.replace(/\s*\(.*?\)\s*/g, ' '))) ?? [];
  if (matches.length === 1) return forYear.get(matches[0]!.number)!;
  if (matches.length > 1) {
    throw new RangeError(
      `"${district}" names ${matches.length} Ohio school districts: ` +
        `${matches.map((m) => `${m.number} (${m.county} County)`).join(', ')}. ` +
        `Pass the four-digit district number — it is what the SD 100, Ohio's Finder and every ` +
        `payroll system identify a district by, and two districts can share a name.`,
    );
  }
  throw new RangeError(
    `"${district}" is not an Ohio school district that levies an income tax. ${DISTRICTS.length} ` +
      `of the state's 600-odd districts do, identified by a four-digit number — 0203 is Bluffton ` +
      `EVSD in Allen County. A district that levies nothing has no number in this table, and a ` +
      `resident of one owes no school district income tax at all. Ohio's Finder resolves an ` +
      `address to its district; this package cannot.`,
  );
}

/** Every district's definition for a year, for tests and tooling. */
export function ohioSchoolDistricts(year: number): readonly LocalIncomeTaxDefinition[] {
  return [...(BY_YEAR.get(year)?.values() ?? [])];
}

/** True where the district taxes earned income only. */
export function ohioSchoolDistrictTaxesEarnedIncomeOnly(district: string): boolean {
  return ohioSchoolDistrict(district, 2026).base === 'stateEarnedIncome';
}
