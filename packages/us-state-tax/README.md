# us-state-tax

US **state and local** individual income tax for tax years **2025 and 2026**, across **28
states** including **New York**, **New Jersey**, **Massachusetts**, **Maryland**, **Ohio**
and **Virginia**, plus **1,033 local income taxes**: New York City, Yonkers, all 24
Maryland jurisdictions, all 92 Indiana counties, all 24 Michigan cities, all **679 Ohio
municipalities** and all **214 Ohio school districts** — more taxing jurisdictions than the
rest of the United States put together. Dependency-free, MIT, ESM and CommonJS, TypeScript types included.

New in 0.14.0: **Maryland's retirement subtractions** — the pension exclusion, which is
claimed *per person* and reduced dollar for dollar by the same person's Social Security, so
**Maryland taxes the benefit it exempts and exempts the pension it taxes**; the military
retirement subtraction, which has no age gate at all; and the centenarian subtraction.

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

### New York City is bigger than most states, and it is not a state

Pass a `locality` and the local income tax comes back alongside the state one. It is the
largest local income tax in the country and it appears in no table of state rates, because
it is not a state tax.

```js
const nyc = stateIncomeTax({
  state: 'NY', year: 2025, filingStatus: 'single', locality: 'NYC',
  federal: { adjustedGrossIncome: 100_000, taxableIncome: 92_000,
             deduction: 8_000, deductionKind: 'standard' },
});

nyc.tax;                    // 4951.75   New York State
nyc.localTaxes[0].tax;      // 3174.69   New York City
nyc.totalTax;               // 8126.44
nyc.totalMarginalRate;      // 0.0965    6% state + 3.876% city - 0.228% credit
```

That `$3,174.69` is **more than the entire state income tax of thirteen of the twenty-seven
states in this package** at the same income — every one of the nine with no income tax,
plus Arizona, Indiana, Ohio and Pennsylvania. Omit the locality on a New York return and the
result says so, and says what it would have cost this filer.

**The published city rates are derived, not stored.** N.Y.C. Admin. Code § 11-1701 imposes
2.7% / 3.3% / 3.35% / 3.4%; nobody has ever paid those, because § 11-1704.1 adds a tax of
**14% of that tax**. The schedule the state publishes is the product, to the last digit:

```text
2.7%  x 1.14 = 3.078%      3.35% x 1.14 = 3.819%
3.3%  x 1.14 = 3.762%      3.4%  x 1.14 = 3.876%
```

Two more of the city's published tables turn out to be generated as well — the school tax
credit's base column is `round(0.171% x threshold)`, and the married-filing-separately
household credit table is the joint table halved and rounded — so this package stores the
statute and derives the forms.

**The city earned income credit has not been 5% since 2021.** Since 2022 it slides from
**30% to 10%** of the federal credit, shedding five points across each of four `$2,500`
windows of New York AGI. The Department of Taxation and Finance publishes that as a long
table of income ranges and decimals; six stored numbers reproduce every row of it. Inside
a window the city takes back `0.00002` of the federal credit per dollar of income — an
average of **15.6 points of marginal rate** for a family with a `$7,800` federal credit,
from a city whose top statutory rate is 3.876%.

And because the worksheet rounds the match to four decimal places, that phase-down is a
**staircase**: the credit holds flat across five dollars of income and then drops a whole
basis point, so the true marginal rate is zero four dollars in five and **78 cents on the
dollar** on the fifth. Both figures are in the result; the note says which one to plan with.

**Yonkers taxes the tax.** A resident owes 16.75% of the New York State tax — not of income
— so every state credit and the whole state rate schedule are already inside it, and the
FY2026 state rate cut cut the Yonkers surcharge with no action by Yonkers. It is measured
**before** the state's refundable credits, which are claimed further down the return:

```js
// Head of household, $20,000, two children, $6,000 federal earned income credit.
const y = stateIncomeTax({ /* ... */ state: 'NY', locality: 'YONKERS' });
y.tax;                  // -1528.00  New York owes this family a refund
y.localTaxes[0].tax;    //    30.49  16.75% of the $182 of state tax before it
```

Netting the refundable credit first gives `-$255.94` — a payment *from* Yonkers of 16.75%
of a state refund. A reference model that computes the surcharge on the state tax after
refundable credits does exactly that.

A resident pays the surcharge and never the non-resident earnings tax; someone who works in
Yonkers but lives elsewhere pays 0.5% of Yonkers-source wages instead
(`yonkersNonresidentEarnings`). Because a filer can live in one taxing locality and work in
another, `localTaxes` is a list.

### "Phases out above $110,000" ends nowhere near $110,000

New York's Empire State child credit is the largest credit on a New York family
return — `$1,000` for each child under 4, and `$330` (2025) or `$500` (2026) for each
child aged 4 to 16, refundable. Pass `dependentAges` and it is computed; pass only a
count and the result says it was computed as zero and what that cost, because a count
cannot tell a toddler from a nineteen-year-old and the two are worth `$1,000` and
nothing.

The phase-out is where the answers diverge. It reduces the **whole credit** by `$16.50`
for each `$1,000` of AGI above the threshold — not each child's share of it — so a
bigger family does not phase out faster, it phases out **later**:

| Joint return | Threshold | Last dollar of credit |
| --- | --- | --- |
| One child under 4 | `$110,000` | `$170,000` |
| Three children under 4 | `$110,000` | `$291,000` |

And `$16.50` is exactly one third of the federal § 24 phase-out of `$50` per `$1,000`.
New York's credit *was* 33% of the federal child tax credit from 2018 to 2024; the
FY2026 budget replaced the amount with flat dollar figures and left the phase-out at a
third of the federal rate, so the old credit is still visible in the one parameter
nobody quotes.

The increment counts "or fraction thereof", which makes it a staircase rather than a
slope: the dollar that crosses each `$1,000` boundary costs `$16.50` at once and every
other dollar in the band costs nothing.

```js
const kids = (agi) => stateIncomeTax({
  state: 'NY', year: 2025, filingStatus: 'headOfHousehold', dependentAges: [2],
  federal: { adjustedGrossIncome: agi, taxableIncome: agi - 11_200,
             deduction: 11_200, deductionKind: 'standard' },
});

kids(75_000).marginalRate; // 16.555  <- $16.50 of credit on one dollar, plus 5.5 cents of tax
kids(75_001).marginalRate; //  0.055  <- and nothing again for another $999
```

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

### California computes its own, and it is a triangle

CalEITC is not a percentage of the federal credit, so it needs `earnedIncome` rather than
`federal.earnedIncomeCredit`. R&TC § 17052 adopts the federal § 32 *structure* as it stood
in 2015 — the credit percentages are the federal 7.65% / 34% / 40% / 45% — and then changes
three things, each of which moves real money:

1. **The ceiling is half the federal one, frozen at 2015 and indexed since.** The statutory
   table of `$3,290` / `$4,940` / `$6,935` is exactly half the federal 2015 earned income
   amounts. In 2025 that is `$4,661` / `$6,998` / `$9,823`.
2. **The whole credit is multiplied by 85%**, the adjustment factor the Budget Act has set
   every year since 2015 (§ 17052(a)(2)(B)). So a one-child filer's first `$6,998` is
   subsidised at **28.9%**, not 34%.
3. **There is no plateau.** The phase-out threshold *is* the phase-in ceiling, and the
   phase-out rate is the phase-in rate. The federal credit is a trapezoid; this one is a
   triangle with a long flat tail bolted on to reach the `$32,901` cap.

The consequence is a marginal rate no rate table can show:

```js
const parent = (earnedIncome) => stateIncomeTax({
  state: 'CA', year: 2025, filingStatus: 'headOfHousehold',
  federal: { adjustedGrossIncome: earnedIncome, taxableIncome: Math.max(0, earnedIncome - 22_500),
             deduction: 22_500, deductionKind: 'standard' },
  earnedIncome, dependentAges: [3, 7],
});

parent(8_000).marginalRate;  // -0.34  <- California pays 34 cents on the next dollar
parent(10_000).marginalRate; //  0.34  <- and takes 34 cents, $1,824 later
parent(25_000).marginalRate; //  0.042 <- the tail: 4.2 cents on the dollar for $15,000
```

A **68-point swing across the single dollar** at `$9,823`, where the credit peaks. Stacked
on the federal credit's own 40% phase-in for two children, the two earned income credits
together **add 74 cents to every dollar** a California single parent earns up to `$9,823`,
before payroll tax.

**The Young Child Tax Credit** (§ 17052.1) is `$1,189`, refundable, and three things about
it are usually wrong elsewhere:

- **It is one credit per return, not one per child.** One child under 6 and three under 6
  are both worth `$1,189`.
- **It is gated on CalEITC**, so the `$4,814` investment-income limit is a cliff worth
  `$4,528.82` to a single parent of two young children at `$9,823` of earnings — one
  dollar of interest, and both credits go.
- **Its phase-out rate is not a parameter.** `$21.71` per `$100` is
  `amount ÷ ((cap − threshold) ÷ $100)` truncated to the cent — the rate that runs the
  credit to zero exactly at the CalEITC cap. That identity reproduces the published figure
  for 2021, 2022, 2024 and 2025.

And it is per `$100` *or fraction thereof*, so it is a staircase: 99 dollars in 100 cost
nothing and the hundredth costs `$21.71`.

Still absent in California: the Foster Youth Tax Credit (identical `$1,189` on an identical
phase-out, but it needs a foster-care history this package has no input for), the renter
credit, and the California AMT.

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

### New Jersey: a base of its own, and three cliffs

New Jersey is the second state here with no federal starting line, and the larger one. Its
gross income tax enumerates its own categories, and the differences run both ways: it does
not tax Social Security or unemployment compensation, and it *does* tax 403(b) elective
deferrals and traditional IRA contributions, which never reach federal AGI. So it demands
`newJerseyGrossIncome` — NJ-1040 line 27 — rather than accepting federal AGI.

**The published rate schedules are generated.** New Jersey prints its tax as "multiply by
`.05525` and subtract `$1,492.50`". All thirteen subtraction constants across the two
schedules are `rate x threshold - the tax already collected below it`; this package stores
the marginal schedule and derives every one of them.

**Below the filing threshold there is no tax at all**, and one dollar later the whole first
bracket arrives:

```js
const single = (grossIncome) => stateIncomeTax({
  state: 'NJ', year: 2025, filingStatus: 'single', federal, newJerseyGrossIncome: grossIncome,
});

single(10_000).tax;  // 0
single(10_001).tax;  // 126.01
```

The threshold is on *gross* income and the tax it triggers is on *taxable* income, so the
size of the cliff is a property of the filer standing on it: `$126.01` for a single filer
with one exemption, `$252.01` for a joint couple with two.

**The retirement income exclusion ends in a wall.** Pass `filerAge` and `retirementIncome`
and a filer aged 62 excludes 100% of a pension below `$100,000` of total income, 50% to
`$125,000`, 25% to `$150,000` — and nothing at `$150,001`:

```js
const retiree = (totalIncome) => stateIncomeTax({
  state: 'NJ', year: 2025, filingStatus: 'marriedFilingJointly', federal,
  newJerseyGrossIncome: totalIncome, retirementIncome: 100_000, filerAge: 70,
});

retiree(150_000).tax;          // 3965.50
retiree(150_001).tax;          // 5346.81
retiree(150_000).marginalRate; // 1381.3052  <- one dollar of income
```

That is the largest one-dollar cliff in this package. The exclusion's six non-joint
percentages are derived rather than stored: in each partial tier the percentage is the joint
one scaled by that status's share of the joint maximum, so `0.5 x (75,000/100,000) = 0.375`
and `0.25 x (50,000/100,000) = 0.125` — four for four against the published figures.

**The child tax credit is a staircase with five steps**, not a phase-out: `$1,000` per child
under 6 at `$30,000` of New Jersey taxable income and `$800` at `$30,001`, so a family with
three young children loses `$600` on one dollar — and `$750` from 2026, because P.L. 2026,
c.26 raised every step by exactly 25% for tax years 2026 through 2028. Married filing
separately gets none of it, and the income steps are not halved for that status either.

Two more things a table cannot hold. A **head of household files on the joint schedule**,
which almost no other state does. And a **qualifying surviving spouse gets three different
mappings on one return** — the joint rate schedule, the single `$75,000` exclusion maximum,
and one `$1,000` personal exemption rather than two.

### Massachusetts is not a 5% flat tax state

Every table of state income tax rates gives Massachusetts one row, and the row says 5%.
M.G.L. c. 62 § 4(a) sets three rates, and which one applies depends on the **kind** of
income rather than on how much of it there is — the one shape a rate table cannot hold,
because a rate table has one row per state.

```js
const ma = (fields) => stateIncomeTax({
  state: 'MA', year: 2025, filingStatus: 'single', federal, ...fields,
});

ma({ massachusettsFivePercentIncome: 100_000 }).tax;                              // 4780.00
ma({ massachusettsFivePercentIncome: 80_000, shortTermCapitalGains: 20_000 }).tax; // 5480.00
ma({ massachusettsFivePercentIncome: 80_000, collectiblesGains: 20_000 }).tax;     // 4980.00
```

The same `$100,000`. Twenty thousand of it held eleven months rather than earned costs
**`$700` more**, because a short-term capital gain is taxed at **8.5%** — 70% above the
headline rate. A long-term gain on collectibles is taxed at **12%** on half the gain, an
effective 6%, and `result.incomeClasses` reports each class with its own rate and tax.

Three more things here are invisible from outside.

**The statute says 5.95%.** § 4(b) still reads `5.95 per cent`, with a mechanism that
steps the rate down 0.05 points in any year the commonwealth's revenue growth clears a
test. The steps ran out in tax year 2020 at exactly 5.00%. Reading the statute gives a
number 19% too high; reading the rate table misses the mechanism that produced it.

**No Tax Status is a generated table, and the credit above it charges double the rate.**
The published `$16,400` (joint) and `$14,400` (head of household) are `$7,600` plus that
status's own personal exemption, and the `$1,000` per dependent is the dependent exemption
— so this package stores `$7,600` and the exemptions, not the table. Above the threshold
the Limited Income Credit limits the tax to **10% of the income above it**, which is not a
softening of the 5% rate, it is twice it:

```js
ma({ massachusettsFivePercentIncome:  8_000 }).tax;          // 0
ma({ massachusettsFivePercentIncome:  8_001 }).tax;          // 0.10   <- not $180
ma({ massachusettsFivePercentIncome: 10_000 }).marginalRate; // 0.1
ma({ massachusettsFivePercentIncome: 11_600 }).marginalRate; // 0.05
```

That is Massachusetts buying the absence of New Jersey's `$252` cliff at the price of the
most expensive marginal band in the return. And the `175%`-of-threshold eligibility ceiling
the instructions print — `$14,000` for a single filer — is **never** the operative limit:
the credit is the excess of the tax over that 10%, so it reaches zero where the two lines
cross, at `2 × threshold − exemptions`. For every filing status and every number of
dependents that crossover comes first.

**The 4% surtax is per return, and filing separately no longer escapes it.** The threshold
is `$1,083,150` for 2025 and `$1,107,750` for 2026, and it is not doubled for a joint
return. Since tax year 2024, M.G.L. c. 62 § 4(d) requires a couple who filed a joint
federal return to file jointly in Massachusetts, which closed the split-return route two
spouses used in 2023:

```js
const each = ma({ massachusettsFivePercentIncome: 700_000, filingStatus: 'marriedFilingSeparately' });
const both = ma({ massachusettsFivePercentIncome: 1_400_000, filingStatus: 'marriedFilingJointly' });

each.surtaxes.length;        // 0
both.surtaxes[0].amount;     // 12322.00
both.tax - 2 * each.tax;     // 12322.00
```

The surtax base is **total** taxable income across all three rate classes, so a single
large capital gain reaches it for a filer whose salary does not: `$200,000` of salary
beside a `$1,000,000` short-term gain owes exactly the `$4,498` of surtax that a
`$1,200,000` salary does.

### Maryland is two income taxes, and rate tables report the smaller one

Every Maryland resident pays a **county** income tax of 2.25% to 3.30% on the same taxable
income the state taxes. There is no county-free jurisdiction, and for a middle-income filer
the county half is a third to two fifths of the whole bill.

```js
const md = stateIncomeTax({
  state: 'MD', year: 2025, filingStatus: 'single', county: 'Montgomery County',
  federal: { adjustedGrossIncome: 100_000, taxableIncome: 84_250,
             deduction: 15_750, deductionKind: 'standard' },
});

md.tax;                  // 4386.38   Maryland State
md.localTaxes[0].tax;    // 2990.40   Montgomery County, 3.20% of the same $93,450
md.totalTax;             // 7376.78
```

That `$2,990.40` of county tax is more than the **entire** state income tax of Arizona or
Indiana at the same income. Leave `county` out and the result says what the cheapest and
dearest counties would have cost this exact filer.

**Two counties have more than one rate, and only one of them is graduated.** Anne Arundel
and Frederick appear as multi-row entries in the same chart. Anne Arundel's rows are
marginal brackets. Frederick's are not: the bracket selects **one rate that applies to the
whole income**.

```js
const frederick = (taxableIncome) => stateIncomeTax({
  state: 'MD', year: 2025, filingStatus: 'single', county: 'Frederick',
  federal: { adjustedGrossIncome: taxableIncome + 3_350, taxableIncome,
             deduction: 0, deductionKind: 'standard' },
}).localTaxes[0].tax;

frederick(150_000);   // 4440.00   2.96% of all of it
frederick(150_001);   // 4800.03   3.20% of all of it
```

`$360.03` of tax on one dollar of income. The same dollar in Anne Arundel costs three
cents.

**The local earned income credit is not a stored number.** Md. Code, Tax-Gen. § 10-704(d)
makes it ten times the county rate, times the federal credit, capped at the county tax — so
twenty-four counties have twenty-four different earned income credits and this package
stores none of them. Worcester's 2.25% is a 22.5% match; Dorchester's 3.30% is 33%.

**The 2025 legislation left four cliffs in the state half.** HB 352 added two brackets
(6.25% and 6.5%), a capital gains surtax, an itemized deduction limit, and a flat standard
deduction, all at once:

```text
$350,000 federal AGI   the 2% capital gains surtax applies to the WHOLE gain — the
                       threshold is a test, not a floor. For a single filer whose
                       $350,000 is all gain that is $6,933.08 of tax on one dollar,
                       the largest single-dollar step in this package
$100,000 / $150,000    the $3,200 personal exemption steps down to $1,600, then $800,
                       then nothing — times every exemption on the return, so a joint
                       return with four dependents loses $9,600 at one threshold:
                       $763.28 of state and county tax on one dollar
$100,000 / $150,000    the senior tax credit's income limit, $1,000 or $1,750, gone
                       entirely one dollar over
$150,000 (Frederick)   the county rate step above
```

And the itemized deduction limit is § 68 — the federal "Pease" limitation — revived by a
state seven years after Congress suspended the federal one. Maryland itemized deductions
fall by **7.5% of federal AGI over `$200,000`**, a threshold that is *not* doubled for a
joint return:

```js
const itemizer = stateIncomeTax({
  state: 'MD', year: 2025, filingStatus: 'single', county: 'Howard County',
  stateItemizedDeductions: 40_000,
  federal: { adjustedGrossIncome: 300_000, taxableIncome: 250_000,
             deduction: 50_000, deductionKind: 'itemized' },
});

itemizer.deduction;           // 32500     $40,000 less 7.5% of $100,000
itemizer.totalMarginalRate;   // 0.0962    8.95% charged on 1.075 dollars per dollar earned
```

Maryland allows itemizing **only** if the filer itemized federally, so the OBBBA's larger
federal standard deduction took the Maryland itemized deduction away from filers whose
Maryland deductions never changed — this package's conformity story, one level down.

**And its two published earned income credits are one credit.** The 50% non-refundable
credit is capped at the Maryland tax; the 45% refundable one pays whatever the cap
withheld. So the effective match *rises* from 45% to 50% as the filer's tax rises, and
adding the two published percentages to get 95% is wrong by roughly the whole state tax.
For an unmarried childless filer the match is **100%** and it is paid in full — the largest
state match of the federal childless credit in the country.

### Maryland taxes Social Security and exempts pensions

Which is the reverse of every summary of Maryland's treatment of retirement income, and it
follows from two rules that are each quoted correctly and never quoted together.

Maryland does not tax Social Security. Maryland also excludes up to `$41,200` (2025) of
**employee retirement system** pension for a filer aged 65 or over — and Md. Code, Tax-Gen.
§ 10-209(b) reduces that exclusion, dollar for dollar, by the **total** benefits the filer
received, taxable or not. Worksheet 13A line 3 says so in as many words: Social Security and
railroad retirement, Tier I *and* Tier II, "whether or not you included any portion of these
amounts in your federal adjusted gross income".

So in the whole band where the pension reaches the cap, the two rules cancel:

```js
const withBenefits = stateIncomeTax({
  state: 'MD', year: 2025, filingStatus: 'single', county: 'Montgomery County',
  filerAge: 70, taxableSocialSecurity: 25_500,
  federal: { adjustedGrossIncome: 85_500, taxableIncome: 69_750,
             deduction: 15_750, deductionKind: 'standard' },
  retirement: { filer: { employerPlanPension: 60_000, socialSecurityBenefits: 30_000 } },
});

withBenefits.stateAdjustedGrossIncome;   // 48800   $30,000 of benefits + $60,000 of pension
withBenefits.totalTax;                   // 2226.88
```

A retiree with `$90,000` of pension and **no benefits at all** reaches the same `$48,800` and
the same `$2,226.88`. A dollar of benefit adds a full dollar to Maryland's base — 0.85 of it
through federal AGI and taken straight back out, 1.00 of it through the lost exclusion — while
a dollar of pension adds nothing. **The benefit Maryland exempts is worth less than the
pension it taxes**, and the 15% of benefits the federal government never taxes is clawed back
with the rest.

### A Maryland couple's totals do not determine their tax

The exclusion is claimed by a **person**, capped per person, and offset by that person's own
benefits. So one couple both aged 70, with `$80,000` of employer-plan pension and `$40,000`
of Social Security between them, has three different taxes:

| how the income is split | excluded | state + county tax |
| --- | --- | --- |
| `$40,000` and `$20,000` each | `$42,400` | `$720.00` |
| the pension on one spouse, the benefits on the other | `$41,200` | `$758.40` |
| all of both on the same spouse | `$1,200` | `$3,261.65` |

`$41,200` of exclusion and **`$2,541.65` of tax**, on identical household totals, decided by
nothing but whose name the income is in. Note that separating the pension from the benefits is
*worse* than splitting both evenly: the cap wastes the allowance of a spouse with no pension
behind it.

Every other computation in this package can be performed from a household total. This one
cannot, which is why there is a `retirement` input with a `filer` and a `spouse`. Supply only
`retirementIncome` and the engine puts it all on one spouse — the worst of the three cases —
and says so in the name of the subtraction.

### An IRA is not an employee retirement system, and the rollover costs $3,428.03 a year

§ 10-209(a) excludes from "employee retirement system" an individual retirement account or
annuity under IRC § 408, a Roth account under § 408A, a **rollover** IRA, a simplified
employee pension under § 408(k), and an ineligible deferred compensation plan under § 457(f).
Qualified defined benefit and defined contribution plans, `401(a)`, `401(k)`, `403(b)` and
`457(b)` plans qualify.

So the single most routinely recommended move in retirement planning — roll the 401(k) into an
IRA — converts up to `$41,200` a year of excluded income into fully taxed income for the rest
of the retiree's life, at no federal cost and with nothing on the federal return to show it
happened. For a single Montgomery County retiree aged 70:

```text
$50,000 a year, left in the 401(k)          $40.00
$50,000 a year, rolled into an IRA       $2,322.28
$150,000 a year, left in the 401(k)      $8,196.80
$150,000 a year, rolled into an IRA     $11,624.83
```

### Two more Maryland retirement rules, on two more age tests

**Military retirement income has no age gate at all.** § 10-207(q) subtracts up to `$12,500`
for a person under 55 and `$20,000` at 55 or over, per person, with no benefit offset — so a
42-year-old military retiree has a subtraction twenty-five years before any other Maryland
retiree has one, and the fifty-fifth birthday is worth `$596.25`. The statute includes death
benefits received as a result of military service, so a Survivor Benefit Plan payment is
capped on the **survivor's** age, not the service member's. The two routes are not additive
and they swap places: for a military retiree aged 65 or over the pension exclusion is worth
more whenever their benefits are below `$21,200` (2025) and the military subtraction when they
are above it.

**And at 100 the first `$100,000` of income comes off, whatever it is.** § 10-207(nn), per
person, with no income or source test — the largest subtraction in this package by a factor of
two. It takes a Montgomery County filer on `$120,000` from `$9,049.60` to `$1,064.48` on the
day they turn 100.

**The maximum pension exclusion falls in 2026**, from `$41,200` to `$40,600`. Both figures are
published by the Comptroller. § 10-209(a) ties the maximum to the maximum annual benefit under
the Social Security Act, but the published figures have never matched the Social Security
Administration's own maxima, so it cannot be derived — and **it is the only parameter in this
package that has ever gone down**. A model that indexes it upward is wrong for 2026 in the
expensive direction.

### Indiana's county tax is 39% of the bill, and it is charged on the same line

Indiana's state rate is 3.00% in 2025 and 2.95% in 2026. The average county rate is
**1.914%** of the same figure — IT-40 line 7, after the same deductions and the same `$1,000`
exemptions — so about two fifths of an Indiana income tax bill is levied by a county.

```js
const inCounty = (county) => stateIncomeTax({
  state: 'IN', year: 2025, filingStatus: 'single', county,
  federal: { adjustedGrossIncome: 60_000, taxableIncome: 44_250,
             deduction: 15_750, deductionKind: 'standard' },
});

inCounty('Marion').tax;                 // 1770.00   the state, at 3%
inCounty('Marion').localTaxes[0].tax;   // 1191.80   Marion County, at 2.02%
inCounty('Porter').localTaxes[0].tax;   //  295.00   0.5%, the lowest in the state
inCounty('Randolph').localTaxes[0].tax; // 1770.00   3.00%, the statutory maximum
```

Randolph County's rate is exactly the state's — and from 2026, when the state rate falls to
2.95%, **a Randolph County filer pays their county more than their state.** Porter County's
is one sixth of it, on the same income.

**Six counties raised their rate for 2026, in the same year the state cut its own.** Carroll,
Grant, Greene, Howard, Shelby and Union all moved on 1 January 2026, by 0.10 to 0.75 points,
against a state cut of 0.05. For a Union County filer with `$59,000` of Indiana taxable
income the state cut is worth `$29.50` and the county rise costs `$442.50`: their total bill
went **up 14%** in a tax-cut year.

Two rules a rate table cannot express, and this package models both:

- **The county is the one the filer lived in on 1 January**, for the whole year. Moving in
  February changes nothing until the next return.
- **A county rate can change on 1 October as well as on 1 January**, and the Department of
  Revenue revises the withholding notice when it does — so the rate withheld and the rate
  the return settles at can be different numbers. This package stores the 1 January rate,
  which is the one the annual return uses.

Four counties have rates with more than four decimal places — Brown 2.5234%, Carroll 2.2733%,
Jasper 2.8640%, Whitley 1.6829% — because an Indiana county rate is assembled from separate
expenditure, public safety, economic development and property tax relief components under
IC 6-3.6. A rate nobody would choose is a rate that was computed.

### Detroit's city tax is 60% of what Michigan itself charges

Michigan is a flat 4.25% on federal AGI less a `$5,800` exemption. Twenty-four Michigan
cities levy an income tax of their own **on a base the MI-1040 does not contain**, and
Detroit's is the largest local income tax in this package outside New York City.

```js
const mi = (city) => stateIncomeTax({
  state: 'MI', year: 2025, filingStatus: 'single', city,
  federal: { adjustedGrossIncome: 100_000, taxableIncome: 84_250,
             deduction: 15_750, deductionKind: 'standard' },
});

mi('Detroit').tax;                     // 4003.50   Michigan, at 4.25%
mi('Detroit').localTaxes[0].tax;       // 2385.60   Detroit, at 2.4%
mi('Highland Park').localTaxes[0].tax; // 1988.00   2.0%
mi('Grand Rapids').localTaxes[0].tax;  // 1491.00   1.5%
mi('Lansing').localTaxes[0].tax;       //  994.00   1.0%, and twenty cities are here
mi('Grayling').localTaxes[0].tax;      //  970.00   1.0%, with a $3,000 exemption
```

**A Michigan city is not downstream of the Michigan return.** The other local taxes in this
package charge a rate on a state figure — New York City on New York taxable income, Yonkers
on the New York tax, Maryland's and Indiana's counties on the state's own taxable income —
so every state deduction and credit is already inside them. The Uniform City Income Tax
Ordinance (MCL 141.601 et seq.) defines its own base instead, and it **excludes pensions,
annuities and IRA distributions, Social Security, unemployment compensation and military pay
entirely**, for every city. So a retired Detroit filer owes the city nothing on their pension
while Michigan is still working out which tier of MCL 206.30(9) they fall in — and a family
whose Michigan tax is a refund because of the state's 30% earned income credit still owes
Detroit in full.

Pass `cityIncome` for the city's own figure. Leave it out and the result says it was derived
from federal AGI less `retirementIncome`, and that the answer is **too high** by the city
rate times any Social Security, unemployment or military pay inside AGI.

#### The exemption has been `$600` since 1964

MCL 141.631(1) set the floor at `$600` for each personal and dependency exemption and never
indexed it. Sixteen of the twenty-four cities are still on it, against Michigan's own
`$5,800` state exemption, which *is* indexed annually.

```text
Detroit, 2.4% x $600   =  $14.40   of tax, per person, per year
a 1% city, $600        =   $6.00
```

That is also why the per-city variations in *which* additional exemptions a city allows —
age 65, blindness, deafness, paraplegia, all set by ordinance — are not modelled: each one
is bounded by `$14.40`. Eight cities pay above the floor, and Grayling's `$3,000` is enough
to make it the cheapest city in the state despite sharing a rate with nineteen others.

#### The nonresident rate is derived, not stored

MCL 141.611 fixes the nonresident rate at **one half** of the resident rate, and all
twenty-four honour it exactly — including the four levying above the ordinary 1% ceiling
under their own enabling acts (Detroit 2.4%/1.2% under Public Act 56 of 2011, Highland Park
2.0%/1.0%, Grand Rapids and Saginaw 1.5%/0.75%). So this package stores one rate per city
and halves it, and a test checks the halving against the four separately published figures.

#### The credit for tax paid to another city fails in the direction people commute

A resident of one taxing city who works in another owes both, and the home city credits the
tax paid — **capped at the home city's own nonresident rate**. Pass `workCity` and
`workCityEarnings` (the day-count-apportioned wage from Form DW-4 or GRW-4) and both are
computed:

```js
const commute = stateIncomeTax({
  state: 'MI', year: 2025, filingStatus: 'single',
  city: 'Lansing', workCity: 'Detroit', workCityEarnings: 60_000,
  federal: { adjustedGrossIncome: 60_000, taxableIncome: 44_250,
             deduction: 15_750, deductionKind: 'standard' },
});

commute.localTaxes[0].tax;             // 712.80   Detroit, nonresident, at 1.2%
commute.localTaxes[1].tax;             // 297.00   Lansing, after a $297 credit
commute.localTaxes[1].credits[0];      // capped at Lansing's own 0.5%
```

`$1,009.80` against the `$594.00` the same filer would owe on wages earned at home: **70%
more city tax for the same wage**. Reverse it and the credit is exactly whole — a Detroit
resident working in Grand Rapids pays Grand Rapids `$445.50` and Detroit `$980.10`, which is
the `$1,425.60` they would have owed Detroit anyway. The cap binds only when the work city
charges more than the home city would, which is the direction traffic runs.

### Ohio's rate schedule is not a function, and $342 arrives on one cent

Every other state here charges a tax that rises continuously with income. Ohio's does not.
O.R.C. § 5747.02(A)(3) prints three rows for 2025:

```text
$0 - $26,050         0.000%
$26,050 - $100,000   $342.00 plus 2.750% of the excess over $26,050
over $100,000        $2,394.32 plus 3.125% of the excess over $100,000
```

and the constants are charged **in full on the first dollar of the band**:

```js
const oh = (agi) => stateIncomeTax({
  state: 'OH', year: 2025, filingStatus: 'single',
  federal: { adjustedGrossIncome: agi, taxableIncome: agi - 15_750,
             deduction: 15_750, deductionKind: 'standard' },
});

oh(28_450).tax;      //   0.00   Ohio taxable income of exactly $26,050
oh(28_450.01).tax;   // 322.00   one cent later
```

`$322` rather than `$342` because the `$20` exemption credit is worth something to the
second filer and nothing to the first. The credit makes the cliff smaller; it does not make
it a slope. Reading the printed table as ordinary marginal brackets — which is what "Ohio:
0% / 2.75% / 3.125%" invites — **understates every Ohio filer above the threshold by the
whole constant**.

The `$342` is a fossil: before 2019 Ohio taxed the bottom of the schedule at 0.495% and up,
and when the legislature zeroed those bands it kept the constants they had accumulated.

#### There is a second discontinuity, and it is three months old

HB 96 (signed 30 June 2025) cut the top rate from 3.5% to 3.125% and lowered the `$26,050`
constant from `$360.69` to `$342.00` — but left the `$100,000` constant at `$2,394.32`,
which is precisely what `$360.69` chained to (`$360.69 + 2.75% × $73,950 = $2,394.315`).
Against the new constant the same arithmetic gives `$2,375.63`:

```js
oh(101_900).tax;     // 2375.63   Ohio taxable income of exactly $100,000
oh(101_900.01).tax;  // 2394.32   $18.69 later, on one cent
```

Four independent transcriptions of the 2025 booklet agree on both constants. This package
implements the table as printed rather than the smooth schedule the drafter meant.

From **2026** HB 96 finishes the flattening: one rate above `$26,050`, no `$100,000` step,
and the constant re-based to `$332.00`. "Ohio is a flat 2.75% state" is now true of the rate
and still false of the tax.

#### Two taxes on one return, at two unrelated rates

The first `$250,000` of Ohio **business income** (`$125,000` married filing separately) is
deducted outright and the excess is taxed at a flat **3%**, while everything else runs up
the schedule above:

```js
oh(250_000).tax;                                  // 7022.45   $250,000 of wages
stateIncomeTax({ ...same, businessIncome: 250_000 }).tax;  // 0.00   $250,000 of Schedule C
```

The deduction is a *subtraction* on the Schedule of Adjustments, so it moves Ohio AGI — but
the exemption chart and every credit limit are read against **modified** AGI, which adds it
straight back. A pass-through owner whose Ohio AGI is near zero is still tested at the full
amount.

#### Two Ohio credits are dead law, and the arithmetic says why

The `$20` exemption credit needs modified AGI **below `$30,000`**; the zero band means a
filer needs taxable income **above `$26,050`** before there is any tax to credit. With
`$2,400` an exemption those two conditions overlap in a `$1,550` window — and a *second*
exemption moves the lower end to `$30,850` and closes it. So the credit is claimable only by
a childless single or married-filing-separately filer, and is worth exactly `$20`.

The joint filing credit's top row, 20% of the tax, needs modified AGI less exemptions at or
below `$25,000` — which for a couple with no business income *is* their taxable nonbusiness
income, below the `$26,050` zero band, so the tax it would be a share of is zero. Business
income cannot rescue it either: the 3% only reaches income above the `$250,000` deduction,
so any couple with business tax has a modified AGI ten times the row's ceiling. **The
highest rate that credit is ever actually paid at is 15%.**

### Ohio's 679 municipalities are the larger half of most Ohio returns

Six hundred and seventy-nine Ohio cities and villages levy an income tax — more taxing
jurisdictions than the rest of the United States put together, and five times the 140 this
package covered before them.

```js
const columbus = stateIncomeTax({
  state: 'OH', year: 2025, filingStatus: 'single',
  city: 'Columbus', qualifyingWages: 60_000,
  federal: { adjustedGrossIncome: 60_000, taxableIncome: 44_250,
             deduction: 15_750, deductionKind: 'standard' },
});

columbus.tax;                  // 1216.50   Ohio
columbus.localTaxes[0].tax;    // 1500.00   Columbus, at 2.5%
columbus.totalTax;             // 2716.50
```

The state tax does not overtake a 2.5% municipal one until **`$126,408.32`** of income.
Below that, a table of state rates has described the smaller half of the bill.

```text
0.45%    Indian Hill — the lowest levy in the state
1.00%    266 municipalities, the modal rate and the ceiling without a vote
1.50%    122
2.00%    122
2.50%    41, including Columbus, Cleveland, Toledo, Akron, Dayton and Parma
2.75%    Youngstown, Trotwood, North Randall
2.85%    Euclid
3.00%    Bedford and Parma Heights
```

#### The base is box 5, so a 401(k) deferral does not reduce it

O.R.C. § 718.01(R) adopts "wages, as defined in section 3121(a) of the Internal Revenue
Code, without regard to any wage limitations" — **Medicare wages, box 5 of the W-2**, not
box 1. A Columbus resident deferring the `$24,500` 2026 maximum is charged 2.5% on every
dollar of it: **`$612.50` a year** that a model reading box 1 or federal AGI never sees. A
§ 125 cafeteria plan contribution *does* reduce it, because it is outside § 3121(a).

And § 718.01(S) puts interest, dividends and capital gains outside the base entirely, along
with pensions, IRA distributions, Social Security and unemployment compensation. **An Ohio
retiree with no wages owes their municipality nothing** — the mirror image of Michigan,
where the city excludes the pension and the state taxes it through a four-tier deduction.
Here the municipality excludes it and Ohio taxes it in full. So `qualifyingWages` is asked
for rather than derived: federal AGI is a different figure, not a rough one, and an Ohio
return naming a `city` without it is an error.

#### There is no nonresident rate, and no statutory resident credit

Michigan halves the commuter rate by statute. Ohio halves nothing — a municipality charges a
commuter exactly what it charges a resident, and § 718.03 makes the *workplace* municipality
the one paid first, by withholding. And O.R.C. Chapter 718 grants **no** resident credit at
all: the home municipality decides by its own ordinance what share of the other tax it
absorbs and at what rate it caps that.

Where an ordinance credits in full — the common case — the result is a symmetry Michigan
does not have:

```js
// $60,000 of wages, Westerville 2.0% and Columbus 2.5%.
live('Westerville', 'Columbus'); // Columbus 1500.00 + Westerville    0.00 = 1500.00
live('Columbus', 'Westerville'); // Westerville 1200.00 + Columbus  300.00 = 1500.00
```

**A commuter pays the higher of the two rates, whichever way they commute.** In Michigan the
same commute costs 70% more in one direction than the other. What still differs is who is
paid.

Pass `residentCreditRate` and `residentCreditLimitRate` — the "Credit Rate" and "Credit
Factor" columns of Ohio's own municipal rate table — for a municipality that credits less.
Leave them out and the result labels the credit as assumed and says what it is worth.

### Ohio taxes one paycheck on three bases, and they disagree about what a wage is

214 of Ohio's 600-odd school districts levy an income tax of their own, at 0.25% to 2.00%,
on a separate SD 100 return and **on top of** the state and municipal taxes. Pass
`schoolDistrict` — the four-digit number Ohio's own forms use.

The base is one of two, chosen by the district's own ballot language, and they are not
variations of each other:

```text
traditional     modified AGI less exemptions — Ohio AGI with the business income
                deduction ADDED BACK, less the personal exemptions      146 districts
earned income   wages and net self-employment earnings only, to the extent included
                in modified AGI, with NO deductions and NO exemptions    68 districts
```

Stack the three and the disagreement is visible on one deferral:

```js
// $100,000 salary, $24,500 deferred to a 401(k), 2026.
const oh = stateIncomeTax({
  state: 'OH', year: 2026, filingStatus: 'single',
  city: 'Columbus',        qualifyingWages: 100_000,   // box 5 — gross of the deferral
  schoolDistrict: '0404',  earnedIncome:     75_500,   // box 1 — net of it
  federal: { adjustedGrossIncome: 75_500, taxableIncome: 59_750,
             deduction: 15_750, deductionKind: 'standard' },
});

oh.localTaxes[0].baseAmount;   // 100000   Columbus, at 2.5%
oh.localTaxes[1].baseAmount;   //  75500   Geneva Area CSD, at 1.25%
```

**The same dollar, deferred out of the same paycheck, is inside one local wage tax and
outside the other** — worth `$612.50` to Columbus and saving `$306.25` from the district.
A model that reads "Ohio local wage tax" as one thing gets one of the two wrong whichever
way it guesses.

The traditional base has the mirror-image quirk. A pass-through owner's `$250,000` business
income deduction takes the income out of Ohio AGI and out of every municipal base in the
state — and a traditional district **adds it straight back**, so it is the only base in this
package that reaches income the state's own return does not.

Every rate is a multiple of one quarter of one per cent, because § 5748.02 requires it, and
all 214 are — which is also the strongest check available on a transcription of a five-page
PDF. The `$50` senior citizen credit is per return and per district, on both bases, and
unlike the state's own `$50` credit it has **no income limit at all**.

A district taxes where the filer **lives** and nothing else: § 5748.01(E) reaches residents
only, so there is no nonresident district tax and no credit for tax paid to another district
— the opposite of the municipal tax sitting beside it.

### Virginia's graduated rates are worth $257.50, to everybody, forever

Every table of state income tax rates prints Virginia as four brackets — 2%, 3%, 5% and
5.75%. All four are real. What the table cannot show is that **the thresholds are the same
for every filing status and have not moved since 1990**, so the top rate begins at
`$17,000` of taxable income for a single filer and at `$17,000` on a joint return.

That makes the whole value of the graduation a constant:

```text
tax on the first $17,000, graduated   $720.00     2% x 3,000 + 3% x 2,000 + 5% x 12,000
tax on the first $17,000, at 5.75%    $977.50
the entire benefit of four brackets   $257.50
```

`$257.50` is the most Virginia's rate schedule can save anybody, at any income, in any year
since 1990. **Virginia is a 5.75% flat tax with a `$257.50` discount** — and the same number
turns up twice more.

```js
const va = stateIncomeTax({ state: 'VA', year: 2025, filingStatus: 'single', federal });
va.tax;            // 2635.90 on $60,000 — 4.39% effective, 5.75% marginal
```

### The $259 ceiling on Virginia's spouse tax adjustment cannot be reached

Because the brackets are not doubled, marrying costs a two-earner couple one trip up the
low bands. Form 760 line 17 hands it back by computing the tax as though the return had
been split in two, and the Commonwealth publishes the result as **"up to `$259`"**.

The worksheet's output *is* the difference above, so `$257.50` is the largest figure it can
produce:

```js
const both = stateIncomeTax({ state: 'VA', year: 2025, filingStatus: 'marriedFilingJointly',
                              federal, bothSpousesHaveQualifyingIncome: true });
both.tax;          // 5271.80 on $120,000
// the same couple on one income                       5529.30
// the adjustment, which is also the graduation           257.50
```

**The published ceiling is `$1.50` above anything that can reach it, and has been since the
5.75% bracket was set at `$17,000` in 1990.** `test/virginia.test.js` searches the whole
surface — every joint taxable income against every split of it — and asserts that the cap
never binds. Pass `lesserSpouseIncome` (line 5 of the worksheet) where the second earner is
small; without it the engine assumes an even split and says so inside the credit's name.

### A Virginia sixty-five-year-old faces 11.5%, twice the state's top rate

Va. Code § 58.1-322.03(5) gives a filer aged 65 or over a `$12,000` deduction and withdraws
it **dollar for dollar** above `$50,000` of adjusted federal AGI — `$75,000` on a joint
return. A 100% withdrawal rate on top of a 5.75% tax is an 11.5% marginal rate, and it is
*per person*, so a couple who are both 65 lose `$24,000` of deduction across `$24,000` of
income:

```text
joint, both aged 70, 2025
  $75,000   $1,469.80
  $99,000   $4,229.80
  ---------------------------------------
  $2,760.00 of tax on $24,000 of income — 11.50%, exactly, across the whole band
```

There is no 11.5% in any table of Virginia rates, because 11.5% is not a rate; it is two
rules meeting. It is the highest marginal rate anywhere in this package that is not a cliff.

The income the withdrawal is tested on is *adjusted* federal AGI — federal AGI **less the
taxable Social Security inside it** — while the deduction comes off Virginia AGI. Two
different figures, one line apart, and the gap between them is the largest single thing a
Virginia retiree's return turns on:

```js
stateIncomeTax({ state: 'VA', year: 2025, filingStatus: 'marriedFilingJointly', federal,
                 filerAge: 70, spouseAge: 70, taxableSocialSecurity: 30_000 }).tax;
// 622.00 on $90,000 of federal AGI
// 3194.80 for the same couple with taxableSocialSecurity left out
```

A filer born on or before 1 January 1939 takes the full `$12,000` with **no income test at
all**, at any income. The statute has never moved that date, so the untested group is closed
and shrinking by mortality — a tax provision that sunsets by attrition rather than by a date.

### Virginia has two poverty floors, and which one bites depends on family size

Two different governments set them. § 58.1-321 exempts a filer whose Virginia AGI is below
`$11,950` — `$23,900` joint — from the tax entirely, and the figure has not moved since
2021. The Credit for Low Income Individuals zeroes the tax up to the **federal poverty
guideline**, which HHS republishes every January and which rises `$5,500` a head.

```text
2025, the dollar that crosses each line
  single, no dependents     filing threshold $11,950     $0.00   the credit already covers it
                            poverty guideline $15,650  $168.55
  joint, no dependents      poverty guideline $21,150     $0.00   below the joint threshold
                            filing threshold $23,900   $106.23
  joint, two dependents     filing threshold $23,900     $0.00
                            poverty guideline $32,150  $416.55   their whole Virginia tax
```

And whether the last of those exists is decided on the **federal** return. The `$300`-a-head
credit and Virginia's 20% earned income match are alternatives — § 58.1-339.8 allows exactly
one — and only the match is refundable. The same family of four with a `$4,000` federal
earned income credit takes the `$800` match, is `$383.50` in refund on both sides of the
guideline, and walks over the discontinuity without noticing it. This package computes both
and takes whichever leaves the filer better off.

Since tax year 2025 the refundable match has been 20%, the same rate as the non-refundable
one in § 58.1-339.8.B.2 — which leaves the non-refundable option dominated at every income
and never the right election. It is still on the return.

### Virginia has no local income tax, and that is worth saying

No county, city or town in the Commonwealth levies one. Localities are funded by the BPOL
licence tax, the machinery and tools tax and the personal property "car tax", none of which
touch an individual return. Virginia sits between Maryland, where every resident owes a
county income tax of 2.25% to 3.30%, and Kentucky, where 87 counties levy an occupational
tax on gross wages — and it is the largest state in this package with a single layer.

```js
va.localTaxes;     // []
va.totalTax;       // === va.tax
```

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

Provisional for 2026: **CA, CO, ID, IL, KY, MD, MI, OH, UT**. Published: **AZ, GA, IN, MA,
MS, NC, NJ, NY, PA** and the nine states with no income tax. Nothing is provisional for
2025.

Ohio is provisional for the two indexed figures behind an otherwise statutory schedule. HB
96 wrote "$332.00 plus 2.75% of the amount in excess of $26,050" into § 5747.02(A)(3), but
the `$26,050` band and the exemption chart are re-indexed by the tax commissioner each
August and the 2026 booklet is not out. Both have held since 2022.

Maryland is provisional for one figure and one only. Every threshold in its rate schedule,
its exemption chart, its capital gains surtax and its itemized deduction limit is a fixed
dollar amount in statute; the flat standard deduction that replaced the old 15%-of-AGI
formula in 2025 is indexed from 2026, and the sources reachable here disagree between
`$3,350` unchanged and `$3,400`. That disagreement is worth about `$4` of state and county
tax, and the note says so rather than leaving the year looking settled.

New York is published for both years because it indexes nothing: its brackets, standard
deduction and dependent exemption are all fixed in statute. Massachusetts is published for
the same reason with one exception, and the exception has already been certified: the 4%
surtax threshold is the only indexed figure in the whole Massachusetts computation, and
the Department of Revenue has published `$1,107,750` for 2026 against `$1,083,150` for
2025. So the entire year-over-year change in Massachusetts income tax is `$984` — 4% of
the `$24,600` the threshold moved — and it is owed by nobody below a million dollars.

## No fallback to a neighbouring year

Eight of the eighteen taxing states cut their rate between 2025 and 2026 — New York's
bottom five brackets (FY2026 enacted budget), Georgia
5.19% → 4.99%, Indiana 3.00% → 2.95%, Kentucky 4.00% → 3.50%, Mississippi 4.4% → 4.0%,
North Carolina 4.25% → 3.99%, Utah 4.5% → 4.45%, and Ohio, which abolished its 3.125%
bracket outright and re-based the constant beneath it from `$342.00` to `$332.00`. Asking
for an unsupported year throws rather than answering with the nearest one.

## Coverage

**Graduated:** California, Maryland, Mississippi, New Jersey, New York, Virginia — though
Virginia's graduation is worth `$257.50` to every filer at every income, forever, because
its top bracket begins at `$17,000` for a single filer and at `$17,000` on a joint return
and has since 1990.
**Flat rate:** Arizona, Colorado, Georgia, Idaho, Illinois, Indiana, Kentucky,
Massachusetts, Michigan, North Carolina, Pennsylvania, Utah.
**A constant plus a rate:** Ohio, whose schedule is neither of the above and cannot be
written as either — see below.
**Rated by kind of income:** Massachusetts, which is in the flat list above and does not
belong there — see below.
**No income tax:** Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas,
Washington, Wyoming.

New Hampshire's interest and dividends tax was repealed after tax year **2024** — 2025 is
the first year it taxes nothing. Washington has no income tax and *does* levy a 7% excise
tax on large long-term capital gains, which this package does not compute and says so.

## What this does not do

State tax is deep and this is version 0.13.0. Stated loudly, because a tax library that
hides its gaps is worse than useless:

- **Only 28 states.** No Minnesota, Wisconsin,
  Oregon, South Carolina, Missouri, Alabama, Connecticut, or the District of Columbia.
  Asking for one throws rather than returning zero.
- **Virginia's four smaller subtractions are not modelled** — the military benefits
  subtraction, the disability income subtraction, the `$15,000` state/federal employee
  subtraction and National Guard pay. Pass them through `subtractions`; the notes say so,
  and say which of them also bar the Credit for Low Income Individuals.
- **Ohio's resident credit is assumed, and labelled.** Chapter 718 grants none, so each
  municipality's ordinance decides; where the two figures are not supplied this package
  assumes the modal 100%-capped-at-the-home-rate and says so in the result.
- **Massachusetts's Schedule B and D netting is not modelled.** Short-term and long-term
  gains are taken as given; the `$2,000` limit on net capital losses deductible against
  interest and dividend income, and the order in which short-term and long-term losses are
  applied against each other, are not computed. Nor is the senior circuit breaker credit,
  which is the largest credit on many Massachusetts retirees' returns.
- **Local income tax in New York, Maryland, Indiana, Michigan and Ohio only.** New York City
  and Yonkers are computed from `locality`; all 23 Maryland counties and Baltimore City, and
  all 92 Indiana counties, from `county`; all 24 Michigan cities and all 679 Ohio
  municipalities from `city` and `workCity`; all 214 taxing Ohio school districts from
  `schoolDistrict`. Most Pennsylvania municipalities and school districts and Kentucky's
  occupational taxes are not, and for a Pennsylvania filer the local
  tax is a large fraction of the bill. Indiana's nonresident and part-year county tax (Schedule
  CT-40PNR), which apportions by where the income was earned rather than where the filer
  lived, is not modelled either. Nor is part-year city residency, the New York City child
  and dependent care credit, Maryland's local poverty level credit and Montgomery County's
  own refundable earned income supplement, or the day-count apportionment behind a Michigan
  nonresident's city wage — pass `workCityEarnings` already apportioned.
- **Michigan's per-city additional exemptions are not modelled.** Age 65, blindness,
  deafness and paraplegia are allowed by some of the 24 cities and not others. Each is
  worth the city rate times the exemption amount, so the whole class of omission is bounded
  by `$14.40` per exemption, in Detroit, and by `$6.00` in twenty of the cities.
- **Two of Maryland's retirement subtractions.** The pension exclusion, the military
  retirement subtraction and the centenarian subtraction are computed — pass `retirement`.
  Absent: the `$15,000` subtraction for retired correctional officers, law enforcement
  officers and fire, rescue or emergency services personnel aged 55 or over (Form 502SU
  code letter `v`), which stacks with the pension exclusion but reduces the pension figure
  the exclusion is computed on; and the Worksheet 13E exclusion for a retired forest, park
  or wildlife ranger, which is available at 55 but **not** to a filer who is 65 or over,
  so a ranger's exclusion can *fall* on their sixty-fifth birthday. HB 792 of the 2025
  session would raise the first from `$15,000` to `$20,000` for tax years after 2024, and
  this package could not establish from any reachable source whether it was enacted, so
  **neither figure is committed** rather than one being guessed. Nor is the poverty level
  credit or the two-income subtraction — which is capped at the lesser spouse's income
  *net of that spouse's own subtractions*, so the pension exclusion reduces it. Pass those
  through `subtractions`.
- **Four states' child credits.** Massachusetts's Child and Family Tax Credit is computed
  for a dependent under 13 or aged 65 and over; a permanently and totally disabled
  dependent of any age also qualifies and this package cannot see disability, so such a
  return is too high by `$440` per such dependent.
- **Three states' child credits.** New York's Empire State child credit, California's
  Young Child Tax Credit and New Jersey's child tax credit are computed from
  `dependentAges`. Absent: the California Foster
  Youth Tax Credit, the Arizona dependent credit, the North Carolina child deduction, the
  Georgia and Kentucky retirement exclusions, and the Utah retirement and Social Security
  credits. A family return or a retiree return outside New York and California will be
  **too high**.
- **CalEITC qualifying children are counted from `dependentAges` alone.** A dependent aged
  18 or under counts; a full-time student under 24 and a permanently disabled dependent of
  any age also qualify under § 17052 and this package cannot see either. Nor does it check
  the filer's own age, which California requires to be at least 18.
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

`input.locality` adds a local income tax. The locality must sit in `input.state` —
passing one that does not is an error rather than a silently ignored field. Local taxes
come back in `result.localTaxes`, a list, because a filer can owe a resident tax to one
locality and an earnings tax to another; `result.totalTax` and `result.totalMarginalRate`
cover both levels, and `result.tax` and `result.marginalRate` remain the state alone.

`input.retirement` splits retirement income between the two spouses, for Maryland, whose
pension exclusion is capped and offset **per person**. It is the only input in this package
that a household total cannot stand in for. Leave it out and `retirementIncome` and
`taxableSocialSecurity` are placed on one spouse — of the possible splits, the one producing
the smallest exclusion — and the subtraction's own name in `result.computedSubtractions`
says so.

`result.stateAdjustedGrossIncome` is the state's AGI, after additions and subtractions and
before the deduction and exemptions. It is reported because it is *not* always the figure
the state's own limits read: Maryland's exemption chart, senior credit and capital gains
surtax are all tested on **federal** AGI, so a `$41,200` pension exclusion moves this number
and none of them.

Also exported: `SUPPORTED_STATES`, `SUPPORTED_YEARS`, `SUPPORTED_LOCALITIES`,
`NO_INCOME_TAX_STATES`, `supportedYears(state)`, `isSupported(state, year)`,
`getStateDefinition(state, year)`, `getLocalityDefinition(locality, year)`,
`localityState(locality)`, `stateName(state)`, and `nycRate(statutoryRate)`.

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
