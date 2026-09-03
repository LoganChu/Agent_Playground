# us-state-tax

US **state** individual income tax for tax years **2025 and 2026**, across **23 states**
including **New York**. Dependency-free, MIT, ESM and CommonJS, TypeScript types included.

Companion to [`us-federal-tax`](https://www.npmjs.com/package/us-federal-tax) — it takes
that package's `estimateFederalTax()` result directly, but neither depends on the other.

```bash
npm install us-state-tax
```

## The rate is the easy part

Every list of "state income tax rates" gives you a percentage. A percentage of *what* is
the question that decides the answer, and it is different in every state.

```js
import { stateIncomeTax } from 'us-state-tax';

// One single filer, $100,000 of wages, 2025.
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
stateIncomeTax({ state: 'TX', year: 2025, filingStatus: 'single', federal }).tax; // 0
```

Colorado's 4.4% is charged on **federal taxable income**. Arizona's 2.5% is charged on
federal AGI less **the federal standard deduction**, because Arizona law defines its own
deduction as equal to the federal one. Illinois' 4.95% is charged on federal AGI with no
deduction at all. Those are three different taxes, and only one of them is visible in a
table of rates.

Every result says which:

```js
const co = stateIncomeTax({ state: 'CO', year: 2025, filingStatus: 'single', federal });
co.conformity; // { base: 'federalTaxableIncome', amount: 84250 }
```

## What this gets right that rate tables cannot

### The One Big Beautiful Bill Act cut taxes in states that never voted on it

OBBBA raised the 2025 federal standard deduction from `$14,600` to `$15,750` in July 2025.
Four of the states here inherited that automatically — each by a different route, and none
of them by legislating:

| State | Why | Cut per single filer |
| --- | --- | --- |
| Arizona | Its standard deduction *is* the federal one (A.R.S. § 43-1041) | `$28.75` |
| Colorado | Starts from federal taxable income | `$50.60` |
| Idaho | Starts from federal taxable income | `$60.95` |
| Utah | Its Taxpayer Tax Credit is 6% of the federal deduction | `$69.00` |

Illinois and Michigan, on federal AGI, got nothing. No state form changed and no state
announcement was made in any of the four, because no state law changed.

### "Starts from federal taxable income" is not "passes it through"

Colorado has added the § 199A qualified business income deduction back since 2021, and
from **tax year 2026** adds back the OBBBA **overtime** deduction — while still allowing
the **tips** deduction sitting beside it on the same federal schedule (HB25-1296).

```js
// The same $100,000, one filer with a $10,000 QBI deduction and one without.
stateIncomeTax({
  state: 'CO', year: 2025, filingStatus: 'single',
  federal: { ...federal, taxableIncome: 74_250 },
  federalDeductions: { qualifiedBusinessIncome: 10_000 },
}).tax; // 3707.00 — identical. Colorado puts it straight back.
```

Idaho, on the same base, allows it: `$530` cheaper on the same facts.

### New York claws back the brackets, so walking them is the wrong computation

Above `$107,650` of New York AGI, N.Y. Tax Law § 601(d) adds a **supplemental tax** that
recaptures the benefit of every bracket below the filer's top one — until a high earner
pays their top rate on their *whole* income rather than on the last band of it.

```js
const ny = (agi) => stateIncomeTax({
  state: 'NY', year: 2025, filingStatus: 'single',
  federal: { adjustedGrossIncome: agi, taxableIncome: agi - 8_000,
             deduction: 8_000, deductionKind: 'standard' },
});

ny(300_000).taxBeforeCredits; // 17602.85  <- what a bracket table gives you
ny(300_000).tax;              // 20002.00  <- what New York charges

// Past the phase-in, the graduated rates have been undone completely:
ny(6_008_000).tax === 0.103 * 6_000_000; // true
```

The statute prints the recapture as forty dollar amounts a year. **This package stores
none of them**, because they are an identity over the rate schedule three subsections
earlier:

```text
recapture at bracket threshold T = (rate above T) x T - (tax on T)
```

Deriving it reproduces all thirteen distinct published 2025 figures — twenty-two across
the five filing statuses — to the dollar, and supplies the over-`$25,000,000` tier that the
reference datasets checked here omit.

It also makes 2026 legible. The FY2026 budget cut New York's bottom five rates and left the
top four alone, so **the recapture rises by exactly what the cut is worth**: a single filer
at `$300,000` saves `$215.40` of bracket tax and pays `$215.40` more supplemental tax, for a
net change of **zero**.

### Six states match the federal earned income credit, and three of them do not

Pass `federal.earnedIncomeCredit` and Colorado, Illinois, Indiana, Michigan, New York and
Utah compute their own credit from it. The three exceptions are the point:

| State | Match | The catch |
| --- | --- | --- |
| Colorado | 50% (2025) → **25% (2026)** | Legislated year by year, not indexed. Worth `$1,788` to a family with two children. |
| Illinois | 20% | Refundable. |
| Indiana | 10% | Of a federal credit **the filer never claimed** — computed under a frozen IRC with Indiana's own `$3,800` investment-income limit. |
| Michigan | 30% | Refundable. Was 6% through 2022. |
| New York | 30% | **Less the New York household credit** (§ 606(d)(1)); the two are not additive. |
| Utah | 20% | **Non-refundable.** A Utah filer whose Taxpayer Tax Credit already covers their tax gets nothing. |

**California is deliberately absent.** CalEITC is not a percentage of the federal credit —
R&TC § 17052 defines its own phase-in, phase-out and adjustment factor, completing near
`$32,000` of earned income. Applying any percentage to the federal credit gives a wrong
California answer, so this package gives none and says so.

### A flat rate is not a marginal rate

`marginalRate` is measured by running the whole computation one dollar higher, so it
catches every credit phase-out, cliff and staircase underneath the rate.

- **Utah** charges **4.45%** in 2026. A single filer at `$25,000` faces **5.75%** — the
  Taxpayer Tax Credit phases out at 1.3 cents on the dollar underneath the tax.
- **Illinois** charges **4.95%**. Its exemption allowance is not phased out, it is *lost
  entirely* one dollar above `$250,000` of AGI: that dollar costs **`$141.12`**.
- **Pennsylvania** charges **3.07%**. Across the Special Tax Forgiveness band a childless
  single filer faces about **11%** and a single parent of two about **34%**, delivered as
  ten discrete jumps of ten percentage points each.
- **California** at a credit phase-out step: 9.3 cents of bracket plus **`$6`** of lost
  exemption credit, on one dollar.
- **New York** charges 6% at `$130,000`. The filer faces **7.14%**, because the
  supplemental tax phases `$568.25` in over `$50,000` of AGI underneath the rate.
- **Colorado** charges 4.40%. A single parent inside the federal earned income credit's
  phase-out faces **12.39%**, because Colorado matches 50% of a credit that is itself
  falling at 15.98 cents on the dollar. Supply `federalOneDollarHigher` to see it.

### California, in the three places it is usually got wrong

1. **The joint schedule is the single one doubled** (R&TC § 17041(a)(2)), so it is stored
   as a derivation, not a second table. **The $1,000,000 Mental Health Services Tax
   threshold is not doubled.** A couple with `$1,200,000` of taxable income pays `$2,000`
   of it; two single filers with `$600,000` each pay none.
2. **Exemptions are credits, not deductions.** `$153` is worth `$153` at the 1% rate and
   `$153` at the 12.3% rate. Modelling it as a deduction is wrong by an order of magnitude
   at the top of the schedule.
3. **The credit phases out in whole `$2,500` steps, per exemption.** One dollar past a
   step costs `$6` — or `$18` for a filer with two dependents.

### Mississippi's zero bracket is per return

The first `$10,000` of Mississippi taxable income is taxed at 0%, and unlike the
Mississippi standard deduction and exemption, that bracket is **not** doubled for a joint
return.

## Provisional figures are labelled

Most state parameters are indexed for inflation and published late in the tax year. Seven
of the 2026 state-years here have at least one figure carried forward from 2025 because
the state had not released it. Every one of them says so, in the result:

```js
const ca2026 = stateIncomeTax({ state: 'CA', year: 2026, filingStatus: 'single', federal });
ca2026.provisional;  // true
ca2026.notes[0];     // 'PROVISIONAL: the 2026 bracket thresholds, standard deduction ...'
```

Provisional for 2026: **CA, CO, ID, IL, KY, MI, UT**. Published: **AZ, GA, IN, MS, NC, NY,
PA** and the nine states with no income tax. Nothing is provisional for 2025.

New York is published for both years because it indexes nothing: its brackets, standard
deduction and dependent exemption are all fixed in statute.

## No fallback to a neighbouring year

Seven of the fourteen taxing states cut their rate between 2025 and 2026 — New York's
bottom five brackets (FY2026 enacted budget), Georgia
5.19% → 4.99%, Indiana 3.00% → 2.95%, Kentucky 4.00% → 3.50%, Mississippi 4.4% → 4.0%,
North Carolina 4.25% → 3.99%, Utah 4.5% → 4.45%. Asking for an unsupported year throws
rather than answering with the nearest one.

## Coverage

**Graduated:** California, Mississippi, New York.
**Flat rate:** Arizona, Colorado, Georgia, Idaho, Illinois, Indiana, Kentucky, Michigan,
North Carolina, Pennsylvania, Utah.
**No income tax:** Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas,
Washington, Wyoming.

New Hampshire's interest and dividends tax was repealed after tax year **2024** — 2025 is
the first year it taxes nothing. Washington has no income tax and *does* levy a 7% excise
tax on large long-term capital gains, which this package does not compute and says so.

## What this does not do

State tax is deep and this is version 0.1.0. Stated loudly, because a tax library that
hides its gaps is worse than useless:

- **Only 23 states.** No New Jersey, Massachusetts, Ohio, Virginia, Maryland, Minnesota,
  Wisconsin, Oregon, South Carolina, Missouri, Alabama, Connecticut, or the District of
  Columbia. Asking for one throws rather than returning zero.
- **No local income tax.** Every Indiana county, most Pennsylvania municipalities and
  school districts, Detroit and 23 other Michigan cities, **New York City** and Yonkers all
  levy their own. A New York City resident pays roughly 3.08% to 3.88% more than this
  package reports; for an Indiana or Pennsylvania filer the local tax is a large fraction
  of the bill.
- **No state child credits, and New York's is large.** The Empire State child credit is
  `$1,000` per child under 4 for 2025 and 2026, and `$330` (2025) or `$500` (2026) per
  child aged 4 to 16. Also absent: CalEITC and the Young Child Tax Credit, the Arizona
  dependent credit, the North Carolina child deduction, the Georgia and Kentucky retirement
  exclusions, and the Utah retirement and Social Security credits. A family return or a
  retiree return computed here will be **too high**.
- **No state alternative minimum tax** (California and Colorado both have one).
- **No additions or subtractions are enumerated.** They are a long, state-specific list —
  municipal bond interest, US government interest, 529 contributions, military pay — and a
  partial list would be worse than none. Supply totals through `additions` and
  `subtractions`.
- **No withholding.** This computes the tax on a return, not what an employer takes out of
  a paycheck. Those are different questions with different answers.
- **No part-year or non-resident apportionment.**

## API

```ts
stateIncomeTax(input: StateIncomeTaxInput): StateIncomeTaxResult
```

`input.federal` is a structural subset of `us-federal-tax`'s `EstimateResult`, so the
output of `estimateFederalTax()` can be passed straight in.

Pennsylvania requires `pennsylvaniaTaxableIncome` and refuses to accept federal AGI as a
substitute: Pennsylvania taxes 401(k) elective deferrals in the year contributed, allows
no standard deduction and no personal exemption, and does not let a loss in one income
class offset a gain in another. Federal AGI is not a Pennsylvania number.

Also exported: `SUPPORTED_STATES`, `SUPPORTED_YEARS`, `NO_INCOME_TAX_STATES`,
`supportedYears(state)`, `isSupported(state, year)`, `getStateDefinition(state, year)`,
and `stateName(state)`.

## Provenance

Every figure is cited in its source file to the statute or state release it came from, and
every result carries those citations. Where a figure could not be confirmed against a
published state release it is marked provisional rather than presented as fact.

California's 2025 figures are stored as published, and `test/california.test.js` checks
them a second way: California indexes its brackets, its standard deduction, its exemption
credits and its exemption phase-out thresholds by a single factor (R&TC § 17041(h)). All
thirteen of the 2025 figures fall out of the 2024 ones multiplied by **1.030**, which is a
much stronger check than transcribing the same schedule twice.

## Licence

MIT.
