/**
 * Ohio's 679 municipal income taxes.
 *
 * ## The largest local income tax system in the country, and the least modelled
 *
 * Six hundred and seventy-nine Ohio cities and villages levy an income tax —
 * more taxing jurisdictions than the rest of the United States put together, and
 * five times the 140 this package covered before them. Between them they raise
 * over `$6 billion` a year, which is more than half of what Ohio's own income
 * tax raises, and **for most Ohio filers the municipal tax is the larger of the
 * two**:
 *
 * ```text
 * Columbus resident, $60,000 of qualifying wages
 *   Ohio             $1,216.50
 *   Columbus         $1,500.00   at 2.5%
 *   total            $2,716.50 — the city is 55% of it
 * ```
 *
 * The state tax does not overtake a 2.5% municipal one until **`$126,408.32`**
 * of income. Below that, a table that reports "Ohio: 0% / 2.75% / 3.125%" has
 * described the smaller half of the bill.
 *
 * ## Three structural differences from Michigan, and each of them costs money
 *
 * **1. The base is Medicare wages, not an income measure.** O.R.C. § 718.01(R)
 * defines the base as "wages, as defined in section 3121(a) of the Internal
 * Revenue Code, without regard to any wage limitations" — box 5 of the W-2 and
 * not box 1. So a **401(k) elective deferral does not reduce it**: a Columbus
 * resident deferring the `$24,500` 2026 maximum is charged 2.5% on every dollar
 * of it, `$612.50` a year that a model reading box 1 or federal AGI never sees.
 * A § 125 cafeteria plan contribution *does* reduce it, because it is outside
 * § 3121(a) altogether. And § 718.01(S) puts interest, dividends and capital
 * gains outside the base entirely, along with pensions, IRA distributions,
 * Social Security and unemployment compensation — so an Ohio retiree with no
 * wages owes their municipality **nothing**, whatever their income.
 *
 * **2. There is no nonresident rate.** Michigan halves it by statute, MCL
 * 141.611. Ohio does not halve anything: a municipality charges a commuter the
 * same rate it charges a resident, and it is the *workplace* municipality that
 * is paid first, by employer withholding, under § 718.03. Ohio's municipal
 * income tax is a tax on where you work, with a residence tax layered on top.
 *
 * **3. There is no statutory resident credit.** This is the one that cannot be
 * put in a rate table. Michigan's credit is in the Uniform City Income Tax
 * Ordinance and applies to all 24 cities on the same terms, so the cap follows
 * from the home city's own rate. O.R.C. Chapter 718 grants **no** credit: the
 * home municipality decides, by its own ordinance, what share of the other
 * municipality's tax it will absorb and what rate it caps that at. Ohio's own
 * rate table publishes the two figures as "Credit Rate" and "Credit Factor"
 * columns, and they vary — 100% up to the home rate is the common case, but
 * partial credits and low caps are not rare.
 *
 * This package therefore takes both figures as inputs, and where neither is
 * supplied it assumes the modal ordinance, names the assumption in the credit
 * line, and says in the result what it is worth. See
 * {@link LocalIncomeTaxDefinition.residentCreditByOrdinance}: the alternative
 * was refusing to compute the commute that a large share of working Ohio makes
 * every day.
 *
 * ## The rates
 *
 * ```text
 * 0.45%    Indian Hill — the lowest levy in the state
 * 1.00%    266 municipalities, the modal rate
 * 1.50%    122
 * 2.00%    122
 * 2.50%    41, including Columbus, Cleveland, Toledo, Akron, Dayton and Parma
 * 2.75%    Youngstown, Trotwood, North Randall
 * 2.85%    Euclid
 * 3.00%    Bedford and Parma Heights — the statutory ceiling without a vote
 * ```
 *
 * Twelve of the 679 are registered at **0%**: a municipality that repealed its
 * levy keeps its row in Ohio's database, and this package keeps it too, because
 * "Amelia charges nothing" is a better answer to a caller than "Amelia is not a
 * taxing jurisdiction".
 *
 * Above 1% a levy needs the electorate's approval under § 718.04(G), which is
 * why the distribution is so lumpy: 266 municipalities sit exactly on the
 * un-voted ceiling and the next 122 sit exactly on 1.5%.
 *
 * ## What is not here
 *
 * **School district income tax.** About 200 of Ohio's school districts levy
 * their own, at 0.25% to 2.00%, on a separate SD 100 return — and it is charged
 * on *Ohio taxable income* in a traditional district and on *earned income only*
 * in an earned-income district, so it is a third base again. A resident of a
 * taxing district owes it on top of everything here. It is a separate dataset
 * and it is not modelled; the notes say so.
 *
 * **JEDDs and JEDZs.** Joint economic development districts are contractual
 * zones rather than municipalities, they levy at the rate of the partner city,
 * and Ohio keys them separately. Not modelled.
 *
 * **The 20-day rule.** § 718.011 relieves an employer of withholding for a
 * municipality where an employee worked 20 days or fewer in the year, with the
 * tax owed to the principal place of work instead. This package takes the
 * apportioned figure the caller supplies and cannot apply the day count.
 */
import { countyRegistry, normaliseCounty, resolveCounty } from './counties.js';
import type { CountyLookup } from './counties.js';
import type { LocalIncomeTaxDefinition } from './definition.js';
import type { Citation, StateCode } from '../types.js';

const CITATIONS: readonly Citation[] = [
  {
    title: 'O.R.C. Chapter 718 — municipal income taxes, the uniform provisions of HB 5 of 2014',
    url: 'https://codes.ohio.gov/ohio-revised-code/chapter-718',
  },
  {
    title: 'O.R.C. § 718.01(R) — "qualifying wages", IRC § 3121(a) wages without any wage limitation',
    url: 'https://codes.ohio.gov/ohio-revised-code/section-718.01',
  },
  {
    title: 'O.R.C. § 718.04 — the ordinance a municipality levies under, the 1% ceiling without a vote, and the resident credit it MAY grant',
    url: 'https://codes.ohio.gov/ohio-revised-code/section-718.04',
  },
  {
    title: 'O.R.C. § 718.011 — the 20-day rule for withholding to a non-principal place of work',
    url: 'https://codes.ohio.gov/ohio-revised-code/section-718.011',
  },
  {
    title: 'Ohio Department of Taxation, The Finder — the municipal income tax rate database, including the credit rate and credit factor columns',
    url: 'https://thefinder.tax.ohio.gov/StreamlineSalesTaxWeb/default_taxrates.aspx',
  },
  {
    title: 'Regional Income Tax Agency (RITA) — the 400-odd municipalities it collects for, and their rates',
    url: 'https://www.ritaohio.com/TaxRatesTable',
  },
  {
    title: 'Central Collection Agency (CCA), City of Cleveland — its member municipalities and their rates',
    url: 'https://ccatax.ci.cleveland.oh.us/?p=taxrates',
  },
];

const NOTES: readonly string[] = [
  'The base is QUALIFYING WAGES — O.R.C. § 718.01(R), "wages as defined in section 3121(a) of the Internal Revenue Code without regard to any wage limitations", which is box 5 of the W-2 and not box 1. A 401(k), 457 or SIMPLE elective deferral does NOT reduce it, so a Columbus resident deferring the 2026 maximum of $24,500 is charged 2.5% on all of it — $612.50 a year that a model reading box 1 or federal AGI never sees. A section 125 cafeteria plan (health premium) contribution DOES reduce it.',
  'Interest, dividends and capital gains are outside the base entirely under § 718.01(S), and so are pensions, IRA distributions, Social Security and unemployment compensation. An Ohio retiree with no wages owes their municipality nothing however large their income — while still owing Ohio itself on the pension, which the state taxes in full. A resident IS taxed on the net profit of a business or rental carried on anywhere; add it to qualifyingWages.',
  'Ohio has NO nonresident rate. Unlike Michigan, which halves it by statute, an Ohio municipality charges a commuter exactly what it charges a resident, and § 718.03 makes the employer withhold it for the WORKPLACE municipality. Ohio municipal income tax is a tax on where you work with a residence tax layered over it, not the other way round.',
  'There is no statutory resident credit. O.R.C. Chapter 718 grants none: each municipality decides by its own ordinance what share of another municipality’s tax it credits and what rate it caps the credit at, and Ohio publishes the two figures as the "Credit Rate" and "Credit Factor" columns of its own rate table. Where a filer works in one taxing municipality and lives in another and neither figure is supplied, this package ASSUMES the modal ordinance — 100% of the tax paid, capped at the home municipality’s own rate — and labels the assumption in the credit line. Pass residentCreditRate and residentCreditLimitRate for a municipality that grants less.',
  'Ohio’s own personal exemption is a state figure under § 5747.025 and does not reach a municipality. There are no municipal exemptions in this package because there are none in Chapter 718: the rate is charged on the first dollar of qualifying wages.',
  'Not modelled: Ohio school district income tax. About 200 of the state’s school districts levy their own at 0.25% to 2.00% on a separate SD 100 return — on Ohio taxable income in a traditional district and on earned income alone in an earned-income district — and a resident of a taxing district owes it on top of everything computed here.',
  'Not modelled: joint economic development districts and zones (JEDDs and JEDZs), which are contractual zones rather than municipalities and levy at the partner city’s rate; and the § 718.011 twenty-day rule, which relieves an employer of withholding for a municipality where the employee worked 20 days or fewer. Pass the apportioned figure as workCityEarnings.',
  'Twelve of the 679 municipalities are registered at a 0% rate — a levy that was repealed keeps its row in Ohio’s own database — so naming one of them is answered with a zero tax rather than an error. Above 1% a levy needs voter approval under § 718.04(G), which is why 266 municipalities sit exactly on 1% and 122 exactly on 1.5%.',
];

/**
 * Every taxing municipality and its rate, packed as `name,rate|name,rate`.
 *
 * The rate is in hundred-thousandths — `2500` is 2.5% — because every one of the
 * 679 is an exact multiple of `0.00001` and an integer cannot drift the way a
 * decimal literal transcribed 679 times can. Ordered by name, which is the order
 * the lookup's error message lists them in when it has to.
 *
 * Sourced from Ohio's own Finder municipal rate database, filtered to the rows
 * still in force, and cross-checked against two independent transcriptions for
 * the six largest municipalities — Columbus 2.5%, Cleveland 2.5%, Cincinnati
 * 1.8%, Toledo 2.5%, Akron 2.5% and Dayton 2.5%, all three agreeing. Where the
 * two disagreed elsewhere — Shaker Heights, Cleveland Heights, Springfield,
 * Lancaster, Mansfield, Barberton, Bowling Green — this file follows the
 * Finder-sourced figure, and Beavercreek is why: a widely copied secondary table
 * gives it 1%, and Beavercreek has never levied a municipal income tax at all.
 */
const TABLE =
  "Aberdeen,1000|Ada,1650|Addyston,1500|Adelphi,1000|Akron,2500|Alexandria,1000|Alger,1000|Alli" +
  "ance,2000|Amanda,1000|Amberley,2000|Amelia,0|Amherst,1500|Amsterdam,1000|Andover,1500|Anna,1" +
  "750|Ansonia,1000|Antwerp,1000|Apple " +
  "Creek,1000|Arcanum,1000|Archbold,1800|Arlington,1000|Arlington Heights,2100|Ashland,2000|Ash" +
  "ley,1000|Ashtabula,1800|Ashville,1000|Athens,1950|Aurora,2000|Avon,1950|Avon " +
  "Lake,1500|Baltic,1500|Baltimore,1000|Barberton,2250|Barnesville,1000|Batavia,1000|Bay " +
  "Village,1500|Beach City,1000|Beachwood,2000|Beaverdam,1000|Bedford,3000|Bedford " +
  "Heights,2000|Bellaire,1000|Belle Center,1000|Bellefontaine,1600|Bellevue,2000|Bellville,1000" +
  "|Belpre,1000|Bentleyville,1000|Berea,2000|Bethel,1000|Bettsville,1000|Beverly,1250|Bexley,25" +
  "00|Blanchester,1000|Bloomdale,1000|Bloomingdale,1000|Bloomville,1000|Blue " +
  "Ash,1250|Bluffton,1650|Bolivar,1000|Boston Heights,2000|Botkins,1500|Bowerston,1000|Bowling " +
  "Green,2150|Bradford,1000|Bradner,1000|Bratenahl,2000|Brecksville,2000|Bremen,1000|Brewster,2" +
  "000|Brice,2000|Bridgeport,1000|Broadview Heights,2000|Brook Park,2000|Brooklyn,2500|Brooklyn" +
  " Heights,2500|Brookville,2000|Brunswick,2000|Bryan,1800|Buckland,1000|Bucyrus,2250|Burbank,1" +
  "000|Burton,1000|Butler,1000|Byesville,1000|Cadiz,1000|Cairo,500|Caldwell,1000|Cambridge,2000" +
  "|Camden,1000|Campbell,2500|Canal Fulton,2000|Canal Winchester,2000|Canfield,1000|Canton,2500" +
  "|Cardington,1000|Carey,1500|Carlisle,1500|Carroll,750|Carrollton,1000|Castine,0|Catawba,1000" +
  "|Cecil,1000|Cedarville,1250|Celina,1500|Centerburg,1000|Centerville,2250|Chagrin Falls,1850|" +
  "Chardon,2000|Chesterville,1000|Cheviot,2000|Chickasaw,1000|Chillicothe,1800|Cincinnati,1800|" +
  "Circleville,2500|Clarksville,1000|Clay Center,1500|Clayton,2500|Cleveland,2500|Cleveland " +
  "Heights,2250|Clinton,1000|Clyde,1500|Coal Grove,1000|Coldwater,1500|College " +
  "Corner,0|Columbiana,1000|Columbus,2500|Columbus Grove,1250|Commercial Point,750|Conesville,5" +
  "00|Conneaut,1650|Continental,1000|Convoy,1000|Corwin,500|Coshocton,2000|Covington,1500|Crest" +
  "line,2000|Creston,1000|Cridersville,1500|Crooksville,1500|Cuyahoga Falls,2000|Cuyahoga " +
  "Heights,2500|Cygnet,1000|Dalton,1500|Danville,1500|Darbyville,1000|Dayton,2500|De " +
  "Graff,1750|Deer Park,1500|Defiance,1800|Delaware,1850|Dellroy,0|Delphos,1750|Delta,1500|Denn" +
  "ison,2000|Deshler,1000|Dover,1500|Doylestown,2000|Dresden,1000|Dublin,2000|Dunkirk,1000|East" +
  " Canton,1500|East Cleveland,2000|East Liverpool,1500|East Palestine,1500|Eastlake,2000|Eaton" +
  ",1500|Edgerton,1750|Edison,500|Edon,1750|Elida,750|Elmore,1750|Elmwood Place,2000|Elyria,225" +
  "0|Empire,1000|Englewood,1750|Euclid,2850|Evendale,1200|Fairborn,2000|Fairfax,1750|Fairfield," +
  "1500|Fairlawn,2000|Fairport Harbor,2000|Fairview Park,2000|Farmersville,1000|Fayette,1500|Fa" +
  "yetteville,1000|Felicity,1000|Findlay,1000|Forest,1250|Forest Park,1500|Fort " +
  "Jennings,1000|Fort Loramie,1500|Fort Recovery,1500|Fostoria,2000|Franklin,2000|Frazeysburg,1" +
  "000|Fredericksburg,1000|Fredericktown,1000|Fremont,1500|Fulton,1000|Gahanna,2500|Galena,1000" +
  "|Galion,2000|Gallipolis,1500|Gambier,1500|Garfield Heights,2000|Garrettsville,1750|Gates Mil" +
  "ls,1000|Geneva,1500|Geneva-On-The-Lake,1500|Genoa,1500|Georgetown,1000|Gettysburg,1000|Gibso" +
  "nburg,1000|Girard,2000|Glandorf,1500|Glenmont,1000|Glenwillow,2000|Gnadenhutten,1500|Golf " +
  "Manor,1700|Grafton,1500|Grand Rapids,1000|Grand River,2000|Grandview,0|Grandview " +
  "Heights,2500|Granville,1500|Gratis,1000|Green,2000|Green " +
  "Springs,1000|Greenfield,1625|Greenhills,1500|Greenville,1500|Greenwich,1000|Grove " +
  "City,2000|Groveport,2000|Hamersville,1000|Hamilton,2000|Hamler,1000|Hanging Rock,1000|Hanove" +
  "r,1000|Harrisburg,1000|Harrison,1000|Harrod,1000|Hartville,1500|Haskins,1000|Heath,2000|Hebr" +
  "on,1500|Helena,1000|Hicksville,1000|Highland Heights,2000|Highland Hills,2500|Hilliard,2500|" +
  "Hillsboro,1500|Hiram,2250|Holgate,1000|Holland,2250|Holmesville,1000|Hopedale,1000|Hubbard,1" +
  "500|Huber Heights,2250|Hudson,2000|Hunting " +
  "Valley,0|Huntsville,1000|Huron,1000|Independence,2000|Indian " +
  "Hill,450|Ironton,1000|Jackson,1500|Jackson " +
  "Center,1500|Jamestown,1000|Jefferson,1500|Jeffersonville,1000|Jenera,1000|Jerry City,1000|Je" +
  "wett,1000|Johnstown,1000|Kalida,1000|Kent,2250|Kenton,1500|Kettering,2250|Kettlersville,0|Ki" +
  "llbuck,1000|Kirby,1000|Kirkersville,1000|Kirtland,2000|Lagrange,1500|Lakeline,1000|Lakemore," +
  "2250|Lakeview,1000|Lakewood,1500|Lancaster,2300|Latty,1000|Lebanon,1500|Leesburg,1000|Leeton" +
  "ia,1500|Leipsic,1500|Lewisburg,1750|Lexington,1000|Liberty Center,1000|Lima,1500|Lincoln Hei" +
  "ghts,2000|Linndale,2000|Lisbon,2000|Lithopolis,1000|Lockbourne,2500|Lockington,1000|Lockland" +
  ",2100|Lodi,1000|Logan,2000|London,1500|Lorain,2500|Lordstown,1500|Loudonville,1750|Louisvill" +
  "e,2000|Loveland,1000|Lowellville,2000|Luckey,1000|Lyndhurst,2000|Lyons,1000|Macedonia,2500|M" +
  "adeira,1000|Madison,1000|Maineville,1000|Malinta,1000|Malta,1000|Malvern,1000|Manchester,100" +
  "0|Mansfield,2250|Mantua,2000|Maple Heights,2500|Marble " +
  "Cliff,2000|Marengo,1000|Mariemont,1250|Marietta,1850|Marion,2000|Marshallville,1000|Martins " +
  "Ferry,1000|Marysville,1500|Mason,1120|Massillon,2000|Maumee,1500|Mayfield,2000|Mayfield Heig" +
  "hts,1500|Mcclure,1000|Mccomb,1000|Mcconnelsville,1000|Mcdonald,2000|Mcguffey,1000|Mechanicsb" +
  "urg,1000|Medina,1250|Melrose,1000|Mendon,0|Mentor,2000|Mentor-On-The-Lake,2000|Metamora,1000" +
  "|Miamisburg,2250|Middle Point,1500|Middleburg Heights,2000|Middlefield,1250|Middleport,1000|" +
  "Middletown,2000|Midvale,1500|Mifflin,1000|Milan,1000|Milford,1000|Milford " +
  "Center,1000|Millbury,1500|Miller " +
  "City,1000|Millersburg,1500|Millersport,1000|Millville,1000|Mineral " +
  "City,1000|Minerva,1500|Minerva Park,2000|Mingo Junction,2000|Minster,1500|Mogadore,2500|Monr" +
  "oe,2000|Monroeville,1000|Montgomery,1000|Montpelier,1800|Moraine,2500|Moreland " +
  "Hills,1000|Morral,1000|Morrow,1000|Moscow,0|Mount Blanchard,1000|Mount Cory,1000|Mount " +
  "Eaton,1000|Mount Gilead,1250|Mount Healthy,2000|Mount Orab,1350|Mount Sterling,1000|Mount " +
  "Vernon,2000|Mount Victory,1000|Munroe " +
  "Falls,2250|Napoleon,1500|Nashville,1000|Navarre,1750|Nelsonville,1750|New Albany,2000|New " +
  "Bavaria,1000|New Bloomington,1000|New Boston,2500|New Bremen,1500|New Carlisle,1500|New " +
  "Concord,2250|New Franklin,2000|New Knoxville,1500|New Lebanon,1000|New Lexington,1000|New " +
  "London,1500|New Madison,1000|New Miami,1750|New Paris,1000|New Philadelphia,1500|New " +
  "Richmond,1000|New Riegel,1000|New Washington,1500|New Waterford,1000|Newark,1750|Newburgh " +
  "Heights,2000|Newcomerstown,2000|Newton " +
  "Falls,1000|Newtonsville,0|Newtown,1000|Ney,1000|Niles,2000|North Baltimore,1000|North " +
  "Canton,2000|North College Hill,1500|North Kingsville,1300|North Lewisburg,1750|North " +
  "Olmsted,2000|North Perry,1000|North Randall,2750|North Ridgeville,1000|North " +
  "Robinson,1000|North Royalton,2000|North " +
  "Star,500|Northfield,2000|Northwood,1500|Norton,2000|Norwalk,1500|Norwood,2000|Oak " +
  "Harbor,1000|Oak Hill,1000|Oakwood (Cuyahoga),2500|Oakwood (Montgomery),2500|Oakwood " +
  "(Paulding),1000|Oberlin,2500|Obetz,2500|Octa,1000|Ohio City,1000|Olmsted Falls,1500|Ontario," +
  "1500|Orange,2000|Oregon,2250|Orrville,1000|Orwell,1500|Osgood,1000|Ostrander,1000|Ottawa,100" +
  "0|Ottawa Hills,1500|Ottoville,1000|Owensville,1000|Oxford,2000|Painesville,2000|Pandora,1500" +
  "|Parma,2500|Parma Heights,3000|Pataskala,1000|Patterson,500|Paulding,1000|Payne,1000|Pemberv" +
  "ille,1000|Peninsula,2000|Pepper Pike,1000|Perry,2000|Perrysburg,1500|Perrysville,1000|Philli" +
  "psburg,1500|Pickerington,1000|Piketon,1000|Pioneer,1000|Piqua,2000|Pitsburg,1000|Plain " +
  "City,1500|Pleasant Hill,1000|Pleasantville,1000|Plymouth,1000|Pomeroy,1000|Port " +
  "Clinton,1500|Port Washington,1500|Portage,1000|Portsmouth,2500|Powell,2000|Powhatan Point,10" +
  "00|Quincy,1000|Ravenna,2500|Reading,2000|Reminderville,1500|Reynoldsburg,2500|Richfield,2000" +
  "|Richmond Heights,2250|Richwood,1000|Ridgeway,1000|Rio " +
  "Grande,2000|Ripley,1000|Risingsun,1000|Rittman,1500|Riverside,2500|Rock " +
  "Creek,1000|Rockford,1000|Rocky River,2000|Roseville,1000|Rossford,2250|Roswell,1000|Rushsylv" +
  "ania,1000|Rushville,1000|Russells Point,1000|Russia,1500|Rutland,1000|Sabina,1500|Salem,1250" +
  "|Salineville,1000|Sandusky,1250|Sardinia,1000|Scio,1000|Sebring,2000|Seven " +
  "Hills,2500|Seville,1000|Shaker Heights,2250|Sharonville,1500|Shawnee Hills " +
  "(Delaware),2000|Shawnee Hills (Greene),0|Sheffield,2000|Sheffield " +
  "Lake,2000|Shelby,1750|Sherrodsville,1000|Sherwood,1000|Shreve,1000|Sidney,1750|Silver " +
  "Lake,2000|Silverton,1250|Smithfield,0|Smithville,1500|Solon,2000|Somerset,1000|South " +
  "Amherst,1000|South Bloomfield,1000|South Charleston,1250|South Euclid,2000|South " +
  "Lebanon,1000|South Russell,1250|South Solon,1000|South Vienna,1000|South " +
  "Zanesville,1500|Spencerville,1500|Springboro,1500|Springdale,2000|Springfield,2400|St. " +
  "Bernard,2100|St. Clairsville,750|St. Henry,1500|St. Louisville,1000|St. Marys,1500|St. " +
  "Paris,1000|Steubenville,2000|Stone Creek,1000|Stoutsville,1000|Stow,2000|Strasburg,1500|Stra" +
  "tton,1000|Streetsboro,2000|Strongsville,2000|Struthers,2000|Stryker,1500|Sugar Grove,750|Sug" +
  "arcreek,1500|Sunbury,1000|Swanton,1500|Sycamore,1000|Sylvania,1500|Tallmadge,2250|Thurston,1" +
  "000|Tiffin,2000|Timberlake,2000|Tipp " +
  "City,1500|Tiro,1000|Toledo,2500|Tontogany,1000|Toronto,2000|Tremont City,1000|Trenton,1500|T" +
  "rimble,1000|Trotwood,2750|Troy,1750|Tuscarawas,1500|Twinsburg,2000|Uhrichsville,2000|Union,1" +
  "500|Union City,1000|University Heights,2500|Upper Arlington,2500|Upper " +
  "Sandusky,1750|Urbana,1400|Urbancrest,2000|Utica,1750|Valley Hi,1000|Valley View,2000|Van Wer" +
  "t,1720|Vandalia,2000|Vanlue,1000|Vermilion,1500|Versailles,1500|Wadsworth,1400|Wakeman,1000|" +
  "Walbridge,1500|Walton Hills,2500|Wapakoneta,1500|Warren,2500|Warrensville Heights,2600|Warsa" +
  "w,1000|Washington,1950|Washingtonville,1000|Waterville,2000|Wauseon,1500|Waverly " +
  "City,1000|Wayne,750|Wayne Lakes,1000|Waynesfield,1000|Waynesville,750|Wellington,1750|Wellst" +
  "on,1000|Wellsville,1500|West Alexandria,1000|West Carrollton City,2250|West Elkton,1000|West" +
  " Jefferson,1000|West Lafayette,1500|West Liberty,1000|West Mansfield,1000|West " +
  "Millgrove,1000|West Milton,1500|West Salem,1000|West Union,1000|West " +
  "Unity,1500|Westerville,2000|Westfield Center,1000|Westlake,1500|Weston,1000|Whitehall,2500|W" +
  "hitehouse,1500|Wickliffe,2000|Willard,1750|Williamsburg,1000|Williamsport,500|Willoughby,200" +
  "0|Willoughby Hills,2000|Willowick,2000|Willshire,1000|Wilmington,1500|Wilmot,1750|Windham,15" +
  "00|Wintersville,1000|Woodlawn,2300|Woodmere,2500|Woodsfield,1000|Woodstock,1000|Wooster,1500" +
  "|Worthington,2500|Wyoming,1000|Xenia,2250|Yellow " +
  "Springs,1500|Yorkshire,1000|Youngstown,2750|Zanesville,1900";
interface Municipality {
  readonly name: string;
  readonly rate: number;
}

const MUNICIPALITIES: readonly Municipality[] = TABLE.split('|').map((entry) => {
  const comma = entry.lastIndexOf(',');
  return { name: entry.slice(0, comma), rate: Number(entry.slice(comma + 1)) / 100_000 };
});

/** The 679 municipality names, as Ohio's own database spells them. */
export const OHIO_MUNICIPALITIES: readonly string[] = MUNICIPALITIES.map((m) => m.name);

/** Each municipality's rate, exported so a test can check the packing round-trips. */
export const OHIO_MUNICIPAL_RATES: ReadonlyMap<string, number> = new Map(
  MUNICIPALITIES.map((m) => [m.name, m.rate]),
);

/**
 * The rate above which a levy needs the electorate's approval — § 718.04(G).
 * 266 of the 679 sit exactly on it, which is what a ceiling looks like in data.
 */
export const OH_UNVOTED_RATE_CEILING = 0.01;

/**
 * Names that appear more than once in Ohio, disambiguated by county.
 *
 * Ohio has three villages called Oakwood and two called Shawnee Hills, and they
 * do not share a rate: Oakwood in Cuyahoga County and Oakwood in Montgomery
 * County both levy 2.5% and Oakwood in Paulding County levies 1%. So `'Oakwood'`
 * alone is an error naming the three rather than a guess — the same treatment
 * `'Baltimore'` gets on a Maryland return, and for the same reason.
 */
const AMBIGUOUS: ReadonlyMap<string, readonly string[]> = (() => {
  const groups = new Map<string, string[]>();
  for (const { name } of MUNICIPALITIES) {
    const open = name.indexOf(' (');
    if (open < 0) continue;
    const bare = normaliseCounty(name.slice(0, open));
    groups.set(bare, [...(groups.get(bare) ?? []), name]);
  }
  return groups;
})();

function definitionsFor(year: number): readonly LocalIncomeTaxDefinition[] {
  return MUNICIPALITIES.map((municipality) => ({
    code: municipality.name,
    name: `${municipality.name}, Ohio`,
    state: 'OH' as StateCode,
    year,
    // A municipal rate is fixed by ordinance and, above 1%, by a vote of the
    // electorate. Nothing about it is indexed, so next year's rate is this
    // year's until a council or a ballot changes it — unlike a state parameter
    // there is no unpublished indexed figure waiting to arrive.
    status: 'published' as const,
    base: 'qualifyingWages' as const,
    rate: { kind: 'flat' as const, rate: municipality.rate },
    // Ohio halves nothing: a commuter is charged the resident rate, and the
    // workplace municipality is paid first by withholding under § 718.03.
    nonresidentEarningsRate: municipality.rate,
    creditsTaxPaidToPeerLocality: true,
    residentCreditByOrdinance: true,
    notes: NOTES,
    citations: CITATIONS,
  }));
}

const LOOKUP: CountyLookup = {
  names: OHIO_MUNICIPALITIES,
  ambiguous: AMBIGUOUS,
  byYear: countyRegistry([2025, 2026], definitionsFor),
  describe: 'Ohio has 679 municipalities levying an income tax',
  // A municipality has no suffix to make optional.
  suffix: null,
  noun: 'municipality',
};

export function ohioMunicipality(name: string, year: number): LocalIncomeTaxDefinition {
  return resolveCounty(LOOKUP, 'OH', name, year);
}

/** Every Ohio municipality's definition for a year, for tests and tooling. */
export function ohioMunicipalities(year: number): readonly LocalIncomeTaxDefinition[] {
  return [...(LOOKUP.byYear.get(year)?.values() ?? [])];
}
