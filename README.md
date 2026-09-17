# Agent_Playground

A repository worked on by an autonomous agent that runs once a day in a fresh
sandbox. Nothing survives a run except what gets committed here.

## What is in here

| Path | What it is |
| --- | --- |
| [`packages/us-federal-tax`](packages/us-federal-tax) | A zero-dependency US federal tax engine for JavaScript. Income tax, self-employment tax, FICA, capital gains, NIIT, the Section 199A QBI deduction, the SALT cap, the OBBBA Schedule 1-A deductions, quarterly estimated payments, and Publication 15-T paycheck withholding — every figure cited to the IRS release it came from. |
| [`packages/us-state-tax`](packages/us-state-tax) | A zero-dependency US **state and local** income tax engine for 28 states and **1,033 local income taxes** — New York City, Yonkers, all 24 Maryland jurisdictions, all 92 Indiana counties, all 24 Michigan cities, all 679 Ohio municipalities and all 214 Ohio school districts — 2025 and 2026. Built around the part a table of state rates cannot hold: **Ohio**, whose printed schedule is not a function — 0% on the first $26,050 and then a flat constant *plus* 2.75%, charged whole on the first dollar of the band, so a filer at $26,050 owes $0 and one at $26,050.01 owes $342.00, and a marginal walk of the printed rows understates every Ohio filer by the whole constant — which steps a second time by $18.69 at $100,000 because HB 96 re-based one constant and left the other at what the old one chained to; where the first $250,000 of business income is deducted and the excess taxed at a flat 3%, so $250,000 of Schedule C profit costs $0 where $250,000 of wages costs $7,022.45; where two published credits turn out to be unclaimable once the zero band is set against their income ceilings; and whose 679 municipalities charge 0.45%–3.00% on *qualifying wages*, box 5 of the W-2, so a 401(k) deferral does not reduce the base ($612.50 a year for a Columbus saver) while a retiree owes nothing at all — making the municipal tax the larger half of every Ohio return below $126,408.32 of income — and whose 214 school districts levy a THIRD tax on the same paycheck, 68 of them on box 1, so a 401(k) deferral is inside one local wage tax and outside the other; **Michigan**, whose 24 cities tax a base the MI-1040 does not contain, excluding pensions, IRA distributions, Social Security, unemployment and military pay entirely, where Detroit charges residents 2.4% against a state rate of 4.25%, where the personal exemption has been the $600 fixed in 1964 and is worth $14.40 of tax against an indexed $5,800 state exemption, and where a resident working in another taxing city is credited only up to their own city's nonresident rate — so a Lansing resident commuting to Detroit pays 70% more city tax than one working at home; **Indiana**, where the average county rate is 1.914% against a state rate of 3.00%, so two fifths of the bill is levied by a county — Randolph County at the 3.00% statutory maximum charges more than the state does from 2026, Porter County charges one sixth of that, and six counties raised their rate for 2026 in the year the state cut its own; **Maryland**, where every resident owes a county income tax of 2.25%–3.30% on the same taxable income — a third to two fifths of the whole bill, reported by no table of state rates — where Frederick County's bracket selects one rate that applies to the *whole* income so one dollar at $150,000 costs $360.03 while the same dollar in Anne Arundel costs three cents, where the county earned income credit is not stored but is ten times each county's own rate, and where the new 2% capital gains surtax is a test rather than a floor, so one dollar of AGI at $350,000 can cost $6,933.08; **Georgia**, whose retirement income exclusion is the mirror image of Maryland's and is described that way nowhere: both exempt "retirement income" at 65 and publish a number for it, and then Georgia counts taxable IRA distributions in full and charges nothing against the exclusion while Maryland writes an IRA out of it by name and charges the whole Social Security benefit against it — so the rollover every adviser recommends costs $0.00 in Georgia and $3,378.83 a year in Maryland, and moving a third of a retirement into Social Security saves $1,272.45 in one and costs $357.75 in the other; where at most $5,000 of a person's wages may enter the exclusion, making it a test on the type of a retiree's income rather than its amount — at 65 a filer with $65,000 of dividends owes nothing and one with $65,000 of wages owes $2,245.50; where net capital gain is in the pool and the allowance is annual and per person, so the "retirement income exclusion" is also a capital gains allowance that lets a couple both 65 realise $130,000 of gain a year tax-free; and where composing the ordinary exclusion with the military one gives a true maximum of $70,000 rather than the $65,000 every table prints, for a disabled veteran under 62 whose exclusion then falls by half on their sixty-second birthday — the birthday every guide calls the one where Georgia's exclusion begins; **Kentucky**, whose published $31,110 pension exclusion is not its maximum and is not its shape: retired pay from the federal government, the Commonwealth or a Kentucky local government is exempt *in full* to the extent it is attributable to service performed before 1 January 1998, with no ceiling — and that exemption does not consume the $31,110, which stays available against everything else, so a teacher who served 1975–2005 with a $70,000 pension and a $40,000 IRA excludes $84,776.67; where the exclusion has **no age test at all**, making Kentucky the only one of the three retirement states an early retiree can use — at 55 a couple with $70,000 of pension pays $157.85 in Kentucky, $1,996.00 in Georgia and $4,471.05 in Montgomery County, and at 65 the ranking reverses and Kentucky is the only one of the three that charges anything; and where the 1998 cutoff has never moved, so every further month of service dilutes the exempt percentage and two teachers with identical pensions pay $1,878.33 apart on the decade they happened to work; **Massachusetts**, which every rate table reports as a flat 5% and which taxes short-term capital gains at 8.5% and long-term gains on collectibles at 12% on half the gain; New York's supplemental tax, which claws back the benefit of the lower brackets so a high earner pays their top rate on their whole income; New York City's resident tax, which costs more than the entire state tax of thirteen of those states; New Jersey, which has no federal starting line at all and whose retirement exclusion ends in a wall that costs a joint retiree $1,381 on one dollar of income; which federal figure each state starts from; which federal deductions it adds back; California's CalEITC, which has no plateau at all, so a single parent faces minus 34% and plus 34% on consecutive dollars of income; **Utah**, whose 4.45% flat tax reaches a real marginal rate of **15.26%** on a retiree — 3.4 times the statutory rate, and three rules compounding with no bracket among them: § 86 puts $1.85 of taxable income behind each dollar of pension, Utah taxes all of it, withdraws 2.5 cents of Social Security Benefits Credit per dollar of it and 1.3 cents of Taxpayer Tax Credit per dollar of it — and the rate runs 10.64% → 15.26% → 8.25% as income rises, so the highest-taxed next dollar in Utah belongs to a household in the 12% federal bracket; where the state taxes the benefit and hands the whole tax back as a credit below $90,000 of modified AGI, making Social Security free and then charging 2.5% for every dollar of *anything else*; where tax-exempt interest is added back for that test, so a municipal bond is taxed at 2.5% while appearing on no line of Utah income; where the three retirement credits are an **election** — code 18 or codes AH and AJ, never both — and code 18 is all but dead law, worth at most $395.00 in a $22,600 window of income, to filers born on or before 31 December 1952, and only where there is no Social Security at all; and where the military retirement credit is *defined* as the rate by cross-reference rather than stored as a number, which is why it moved when the rate did and PolicyEngine-US's stored copy did not; where the child tax credit is withdrawn at TEN cents on the dollar — 2.2 times the state's own rate, so the withdrawal is a larger marginal tax than the tax is — taking a working couple with two children to **20.00% on the next dollar**, higher than the retiree's 15.26%, and where a family with MORE eligible children can face a LOWER rate because the band's length scales with the credit and its end moves out of the earned income credit's own withdrawal; and the credit phase-outs that make Utah's and Pennsylvania's flat taxes anything but flat. **And ten states that exempt Social Security by statute were taxing it until v0.18.0** — Arizona, California, Idaho, Illinois, Indiana, Michigan, Mississippi, North Carolina, New York and Ohio — worth up to $1,517 a year to one retiree and enough to move fifteen of the nineteen taxing states in a ranking. Found by a differential test against an independent model, not by a test of a claimed feature: no feature had been claimed. |
| [`packages/us-tax-mcp`](packages/us-tax-mcp) | Both engines as an MCP server, so an AI assistant can compute tax rather than recall it. **Nine tools**, zero dependencies, and one `npx` line that works today without npm. The ninth is `describe_state`, which is also how the startup payload got 14% smaller while gaining a tool: twenty-eight states do not need the same inputs, so `state_income_tax` now carries each per-state field's name, type and state list and nothing else, and a caller who names Ohio reads Ohio's documentation rather than everyone's. |
| [`site`](site) | A **retirement tax calculator** built on both engines and running entirely in the browser — put in what a household *receives* and it computes the federal return and then all 28 states at once, plus every Maryland and Indiana county. No server, no analytics, no network call after the page loads. Publishes itself to GitHub Pages once Pages is switched on — and does not wait for that: every push also attaches **`retirement-tax-calculator.html`**, the whole thing as one 622 KB file, to the [`calculator`](https://github.com/LoganChu/Agent_Playground/releases/tag/calculator) release. Download it, double-click it, and it works, offline, for ever. (An earlier note here claimed the Pages *artifact* worked that way. It does not: a `<script type="module">` loaded from a `file://` URL is blocked by CORS and the page comes up blank. The single file exists because that claim was tested and failed.) |
| [`tools/differential`](tools/differential) | **437 households through both this project's engines and [PolicyEngine-US](https://github.com/PolicyEngine/policyengine-us)**, every figure compared to the dollar. Twenty-two days used PolicyEngine as a *parameter* reference — read the YAML, check a number. This runs it as a *model*, which is where the interesting errors live: not what a figure is, but what a computation does with it. Its first run found ten states taxing Social Security that exempt it by statute, a $17,159 difference in federal taxable income that turned out to be a real property of the harness rather than of either engine, and a metric mismatch in the harness itself. Every remaining difference is either matched by a reason in `known-divergences.json` or printed at the top of the report. |
| [`STRATEGY.md`](STRATEGY.md) | Why this work and not something else, what was rejected, and the conditions under which the current bet should be abandoned. |
| [`JOURNAL.md`](JOURNAL.md) | Daily log: what was done, what was learned, what to do next. |
| [`NOTES-FOR-HUMAN.md`](NOTES-FOR-HUMAN.md) | The short list of things the agent cannot do itself. |

## Install

These packages are not on npm yet. They do not need to be. All three have **zero
runtime dependencies**, so `npm pack` produces a self-contained tarball, and npm
installs a tarball from an https URL without a registry, an account or a token:

```bash
npm i https://github.com/LoganChu/Agent_Playground/releases/download/us-state-tax-v0.18.0/us-state-tax-0.18.0.tgz
npm i https://github.com/LoganChu/Agent_Playground/releases/download/us-federal-tax-v0.9.0/us-federal-tax-0.9.0.tgz
npm i https://github.com/LoganChu/Agent_Playground/releases/download/us-tax-mcp-v0.21.0/us-tax-mcp-0.21.0.tgz
```

Every version is on the [releases page](https://github.com/LoganChu/Agent_Playground/releases)
at an immutable tag, built and tested from the commit it was cut from by the
[Distribute workflow](.github/workflows/dist.yml). Node 18 or later; nothing else.

When the packages do land on npm the names shorten to `npm i us-state-tax` and the
URLs above keep working. What npm adds is **reach** — a name that can be searched
for — not capability.

## The calculator

[`site/`](site) is the same two engines with a face on, for the question they have
always been able to answer and have never been able to answer to anybody who is not
a programmer: **what does a retirement actually cost?** You enter what a household
*receives* — box 5 of the Social Security statement, the pension, the IRA — and it
derives the federal return from that and ranks all 28 states, with every Maryland
and Indiana county priced, because in those two states every resident owes a county
income tax and a "state tax" that leaves it out is not smaller, it is wrong.

```bash
cd site && npm test   # builds dist/ and checks its figures
# then open site/dist/index.html — it works from the filesystem
```

There is no bundler and no dependency. Both engines compile to ES modules with
explicit `.js` extensions on every relative import, which is exactly what a browser
loads natively, so the build is a copy that drops declarations and sourcemaps. The
page a visitor loads is the same code the test suites run.

Three things it does that a rate table cannot:

- **Measures the real marginal rate** by running the whole estimate twice and
  differencing it. A retired couple in the 22% bracket can see 45.58%.
- **Shows a mandatory local income tax as a range.** One test household's Maryland
  *state* tax is `$0.00` and its *county* tax is `$758.25` to `$1,112.10`.
- **Asks whose name the retirement income is in**, because three states — Georgia,
  Maryland and Kentucky — claim their exclusion per person. On identical household
  totals that is worth `$4,264.85`, and the federal return cannot see the
  difference at all, so nothing else would warn you.

**It is not on Pages yet, and that is the one thing a human has to do.** An Actions
token can read the Pages configuration and cannot create it — `POST /repos/.../pages`
is closed to it whatever permissions the workflow requests — so Pages has to be
switched on once, by hand, at *Settings → Pages → Source: GitHub Actions*. The
[Pages workflow](.github/workflows/pages.yml) does not fail while it is off: it
builds, tests, uploads the site as an artifact and says so in the run summary.

**It no longer waits for that.** Download
[`retirement-tax-calculator.html`](https://github.com/LoganChu/Agent_Playground/releases/download/calculator/retirement-tax-calculator.html)
— 622 KB, the whole calculator in one file — and open it. No server, no install, no
network, nothing to switch on.

That file exists because the sentence above it used to end "and attaches an artifact
that works offline", and **that was false**. Opening `index.html` from the artifact
gives a blank page: a `<script type="module">` loaded from a `file://` URL is blocked
by CORS in every Chromium browser, and the claim had been written without opening it
that way. The single-file build inlines all 46 modules — each as a Blob URL with its
import specifiers rewritten — so there is nothing left to fetch. Finding it also
turned up a real dependency **cycle** in `us-state-tax`, four of them, which had been
invisible for thirteen days because Node resolves a cycle of hoisted functions
without complaint; a loader that has to produce a module before anything can
reference it cannot, and it recursed until the stack ran out.

## us-federal-tax

```bash
cd packages/us-federal-tax
npm install
npm test
```

```js
import { estimateFederalTax, quarterlyEstimatedPayments } from 'us-federal-tax';

const estimate = estimateFederalTax({
  filingStatus: 'single',
  year: 2026,
  selfEmploymentNetProfit: 120_000,
});

estimate.totalTax;             // 32660.36
estimate.selfEmployment.total; // 16955.46
quarterlyEstimatedPayments(estimate).installments;
```

```js
import { computePaycheck } from 'us-federal-tax';

const check = computePaycheck({
  wagesThisPeriod: 3_000,
  filingStatus: 'single',
  payPeriod: 'biweekly',
  year: 2026,
});

check.federalIncomeTax.withholding; // 320.38
check.takeHomeAfterFederal;         // 2450.12
```

```js
import { estimateFederalTax } from 'us-federal-tax';

// § 86: give it what the SSA-1099 says, not the taxable part.
const retired = estimateFederalTax({
  filingStatus: 'marriedFilingJointly',
  year: 2026,
  socialSecurityBenefits: 90_000,
  otherOrdinaryIncome: 80_000,
  age65OrOlder: true,
  spouseAge65OrOlder: true,
});

retired.socialSecurity.taxableBenefits; // 74850 — 83.2% of the benefit
retired.socialSecurity.untaxedBenefits; // 15150 — never reaches gross income
retired.marginalRate;                   // 0.22 — the bracket
// and the real rate on the next $1,000 is 45.58%, above the 37% top rate
```

See the [package README](packages/us-federal-tax/README.md) for the full API, the
correctness details it handles that most implementations miss, and an explicit list
of what it does *not* cover.

## us-state-tax

```bash
cd packages/us-state-tax
npm install
npm test
```

```js
import { stateIncomeTax } from 'us-state-tax';

// One single filer, $100,000 of wages, 2025. Three states, three different taxes.
const federal = {
  adjustedGrossIncome: 100_000,
  taxableIncome: 84_250,
  deduction: 15_750,
  deductionKind: 'standard',
};

stateIncomeTax({ state: 'CA', year: 2025, filingStatus: 'single', federal }).tax; // 5054.98
stateIncomeTax({ state: 'NY', year: 2025, filingStatus: 'single', federal }).tax; // 4951.75
stateIncomeTax({ state: 'CO', year: 2025, filingStatus: 'single', federal }).tax; // 3707.00
stateIncomeTax({ state: 'AZ', year: 2025, filingStatus: 'single', federal }).tax; // 2106.25
```

Colorado taxes federal *taxable* income and Arizona defines its standard deduction as the
federal one, so the One Big Beautiful Bill Act cut both states' 2025 tax with no state
legislation. Illinois, on federal AGI, got nothing. That difference is invisible in a table
of state rates, and it is what this package exists to model.

New York is the sharpest case of the same idea. Above $107,650 of AGI it adds a
supplemental tax that recaptures the benefit of every bracket below the filer's top one, so
walking the rate schedule is not merely incomplete — it is the wrong computation, short by
$2,399 for a single filer at $300,000 and $65,071 at $6,000,000. The statute prints forty
dollar amounts a year for that recapture; this package stores none of them and derives every
one from the rate schedule.

New York's Empire State child credit is the largest credit on a family return there —
`$1,000` per child under 4, `$330` (2025) or `$500` (2026) per child aged 4 to 16,
refundable — and its phase-out reduces the *whole* credit by `$16.50` per `$1,000` of AGI
rather than each child's share, so a bigger family phases out later rather than faster: one
young child keeps some credit to `$170,000`, three keep some to `$291,000`. That `$16.50` is
exactly a third of the federal § 24 rate, which is what is left of the credit's old life as
33% of the federal one.

California is where the same idea pays best, because the credit everyone skips is the
largest one on a low-income return. CalEITC is not a percentage of the federal credit: it
adopts the federal § 32 rates, halves the federal 2015 phase-in ceiling, multiplies the
result by the Budget Act's 85% adjustment factor, and — the part no rate table can express —
**sets the phase-out threshold equal to the phase-in ceiling**, so the credit peaks at a
single dollar of income instead of holding a plateau.

```js
const parent = (earnedIncome) => stateIncomeTax({
  state: 'CA', year: 2025, filingStatus: 'headOfHousehold',
  federal: { adjustedGrossIncome: earnedIncome, taxableIncome: Math.max(0, earnedIncome - 22_500),
             deduction: 22_500, deductionKind: 'standard' },
  earnedIncome, dependentAges: [3, 7],
});

parent(8_000).marginalRate;  // -0.34
parent(10_000).marginalRate; //  0.34
parent(25_000).marginalRate; //  0.042
parent(25_000).tax;          // -1520.76  <- a refund, where every rate table returns 0
```

A 68-point swing across the single dollar at `$9,823`. The Young Child Tax Credit adds
`$1,189` on top, refundable, one per return however many children — and its phase-out rate
of `$21.71` per `$100` is not a stored figure either: it is the rate that runs the credit to
exactly zero at the CalEITC income cap, which reproduces the published number in 2021, 2022,
2024 and 2025.

New York City is the same idea one level down. Pass `locality: 'NYC'` and the city tax comes
back beside the state one: `$3,174.69` for that single filer at `$100,000`, which is more
than the entire state income tax of twelve of the twenty-four states here. Its published
rates are derived rather than stored — N.Y.C. Admin. Code § 11-1701 imposes 2.7% / 3.3% /
3.35% / 3.4% and § 11-1704.1 adds a tax of **14% of that tax**, and 2.7% x 1.14 = 3.078% to
the last digit. Yonkers taxes the *tax*, at 16.75% of the state's, measured before the
state's refundable credits so it can never come out negative.

Massachusetts is the case that breaks the table format outright. Every other state here
splits its tax by how *much* income there is; Massachusetts splits it by *what kind*, and
M.G.L. c. 62 § 4(a) sets three rates where every summary reports one.

```js
const ma = (fields) => stateIncomeTax({
  state: 'MA', year: 2025, filingStatus: 'single', federal, ...fields,
});

ma({ massachusettsFivePercentIncome: 100_000 }).tax;                               // 4780.00
ma({ massachusettsFivePercentIncome: 80_000, shortTermCapitalGains: 20_000 }).tax; // 5480.00
ma({ massachusettsFivePercentIncome:  8_001 }).tax;                                //    0.10
ma({ massachusettsFivePercentIncome: 10_000 }).marginalRate;                       //    0.1
```

The same `$100,000`: `$700` more when `$20,000` of it was held eleven months rather than
earned, because a short-term gain is taxed at **8.5%** and a long-term gain on collectibles
at **12%** on half the gain. And the fourth line is the other half of the state — just above
No Tax Status the Limited Income Credit limits the tax to **10% of the income above the
threshold**, which is not a softening of the 5% rate but **double** it. Massachusetts buys
the absence of New Jersey's cliff at twice the price, across exactly the band where the
filers the threshold exists for actually are. The `$16,400` and `$14,400` No Tax Status
figures are not stored here either: they are `$7,600` plus that status's own personal
exemption.

New Jersey is the other half of the same idea, and it is the sharpest case of the *base*
rather than the credit. It has no federal starting line at all: it ignores Social Security
and unemployment compensation and taxes 403(b) deferrals and traditional IRA contributions
that never reach federal AGI, so the package demands `newJerseyGrossIncome` rather than
accepting an approximation. On top of that base sit three things no rate table shows —

```js
const nj = (grossIncome, extra) => stateIncomeTax({
  state: 'NJ', year: 2025, filingStatus: 'marriedFilingJointly', federal,
  newJerseyGrossIncome: grossIncome, ...extra,
});

nj(20_000).tax;                                       // 0     <- below the filing threshold
nj(20_001).tax;                                       // 252.01

const retired = { retirementIncome: 100_000, filerAge: 70 };
nj(150_000, retired).tax;                             // 3965.50
nj(150_001, retired).tax;                             // 5346.81
nj(150_000, retired).marginalRate;                    // 1381.3052
```

— a filing threshold that makes the first `$20,000` of gross income free of tax and the next
dollar cost `$252`, a retirement income exclusion that ends in a wall rather than a taper,
and a child tax credit that is a staircase of five cliffs, each `$600` per step for a family
of three young children and `$750` from 2026 under P.L. 2026, c.26. The thirteen subtraction
constants New Jersey prints in its rate schedules — "multiply by `.05525` and subtract
`$1,492.50`" — are derived here rather than transcribed.

Maryland is the case where a rate table reports the *smaller* half of the answer. Every
Maryland resident also owes a county income tax on the same taxable income:

```js
const md = stateIncomeTax({
  state: 'MD', year: 2025, filingStatus: 'single', county: 'Montgomery County', federal,
});

md.tax;                 // 4386.38   Maryland State
md.localTaxes[0].tax;   // 2990.40   Montgomery County — more than Arizona's whole state tax
md.totalTax;            // 7376.78
```

Twenty-three counties and Baltimore City, each setting its own rate between the statutory
floor of 2.25% and the ceiling of 3.30% — and two of them with more than one rate, only one
of which is graduated. Frederick County's bracket picks a single rate that applies to the
*whole* income, so a Frederick filer crossing $150,000 of taxable income pays $360.03 of tax
on one dollar; the same dollar in Anne Arundel, whose rates are marginal, costs three cents.
The county earned income credit is not a parameter at all: § 10-704(d) makes it ten times
the county rate, so twenty-four counties have twenty-four different credits and every one of
them follows its rate.

Indiana is the same lesson in a state nobody thinks of as complicated. Its rate is a flat
3.00% (2.95% in 2026) — and all 92 counties levy their own tax on the same line of the same
return:

```js
const marion = stateIncomeTax({
  state: 'IN', year: 2025, filingStatus: 'single', county: 'Marion',
  federal: { adjustedGrossIncome: 60_000, taxableIncome: 44_250,
             deduction: 15_750, deductionKind: 'standard' },
});

marion.tax;                 // 1770.00   the state
marion.localTaxes[0].tax;   // 1191.80   Marion County — 40% of the bill
```

The average county rate is 1.914%, the spread is six to one — Porter County 0.5%, Randolph
County 3.00% — and from 2026 a Randolph County filer pays their county more than their
state, because the state rate fell to 2.95% and the county's is the statutory maximum. Six
counties raised their rate for 2026 in the same year the state cut its own.

Michigan is the case where the shape itself had to change. Every local tax above charges a
rate on a line the state return already produced; a Michigan city has no line to charge. The
Uniform City Income Tax Ordinance defines its own base and excludes pensions, IRA
distributions, Social Security, unemployment compensation and military pay **entirely** — so
a city taxes a retiree at zero while Michigan is still working out which of four birth-year
tiers of retirement deduction they fall in, and a family whose Michigan tax is a *refund*
from the state's 30% earned income credit still owes Detroit in full:

```js
const detroit = stateIncomeTax({
  state: 'MI', year: 2025, filingStatus: 'single', city: 'Detroit',
  federal: { adjustedGrossIncome: 100_000, taxableIncome: 84_250,
             deduction: 15_750, deductionKind: 'standard' },
});

detroit.tax;                 // 4003.50   Michigan, at 4.25%
detroit.localTaxes[0].tax;   // 2385.60   Detroit, at 2.4% of a base the state never computes
```

The city exemption is the $600 the Legislature set in Act 284 of 1964 and never indexed,
against Michigan's own indexed $5,800 — $14.40 of tax a year at Detroit's rate. The
nonresident rate is one half of the resident rate by statute, so it is derived rather than
stored. And the credit a home city gives for tax paid to a work city is capped at the home
city's *own* nonresident rate, which makes it whole for a Detroit resident commuting to Grand
Rapids and short for a Lansing resident commuting to Detroit.

It takes the output of `estimateFederalTax()` directly, but neither package depends on the
other. See the [package README](packages/us-state-tax/README.md) for the full list of what
is and is not covered.

## us-tax-mcp

Both engines, exposed over the Model Context Protocol so an assistant can compute a
tax figure instead of recalling one. Add it to any MCP client:

```jsonc
{
  "mcpServers": {
    "us-tax": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/LoganChu/Agent_Playground/releases/download/us-tax-mcp-v0.21.0/us-tax-mcp-0.21.0.tgz"
      ]
    }
  }
}
```

`npx` runs a tarball URL exactly as it runs a package name, so that config works
today with nothing installed and no account anywhere. It becomes
`"args": ["-y", "us-tax-mcp"]` once the package is on npm.

Eight tools: `estimate_federal_tax`, `compare_tax_years`, `effective_marginal_rate`,
`quarterly_estimated_payments`, `paycheck_withholding`, `state_income_tax`,
`get_tax_parameters` and `list_supported_years`. Most of them answer questions a bracket
table cannot — 2025 was amended *retroactively* after the IRS had published it, the
marginal rate on the next dollar is routinely double the bracket once credit phase-outs
are counted, what an employer withholds is a different number from what the return owes,
a state's answer depends on which federal figure it starts from, and a New York answer that
does not ask where in New York the filer lives can be short by more than a whole state's
income tax.

```bash
cd packages/us-tax-mcp
npm install
npm test
```

See the [package README](packages/us-tax-mcp/README.md) for the tool list, worked
examples, and the same explicit list of what is not covered.

## License

MIT
