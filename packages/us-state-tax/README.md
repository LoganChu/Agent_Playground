# us-state-tax

US **state and local** individual income tax for tax years **2025 and 2026**, across **26
states** including **New York**, **New Jersey**, **Massachusetts** and **Maryland**, plus
**116 local income taxes**: New York City, Yonkers, all 24 Maryland jurisdictions and — new
in 0.9.0 — all **92 Indiana counties**. Dependency-free, MIT, ESM and CommonJS, TypeScript
types included.

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

That `$3,174.69` is **more than the entire state income tax of twelve of the twenty-six
states in this package** at the same income — every one of the nine with no income tax,
plus Arizona, Indiana and Pennsylvania. Omit the locality on a New York return and the
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

Provisional for 2026: **CA, CO, ID, IL, KY, MD, MI, UT**. Published: **AZ, GA, IN, MA, MS,
NC, NJ, NY, PA** and the nine states with no income tax. Nothing is provisional for 2025.

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

Seven of the seventeen taxing states cut their rate between 2025 and 2026 — New York's
bottom five brackets (FY2026 enacted budget), Georgia
5.19% → 4.99%, Indiana 3.00% → 2.95%, Kentucky 4.00% → 3.50%, Mississippi 4.4% → 4.0%,
North Carolina 4.25% → 3.99%, Utah 4.5% → 4.45%. Asking for an unsupported year throws
rather than answering with the nearest one.

## Coverage

**Graduated:** California, Maryland, Mississippi, New Jersey, New York.
**Flat rate:** Arizona, Colorado, Georgia, Idaho, Illinois, Indiana, Kentucky,
Massachusetts, Michigan, North Carolina, Pennsylvania, Utah.
**Rated by kind of income:** Massachusetts, which is in the flat list above and does not
belong there — see below.
**No income tax:** Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas,
Washington, Wyoming.

New Hampshire's interest and dividends tax was repealed after tax year **2024** — 2025 is
the first year it taxes nothing. Washington has no income tax and *does* levy a 7% excise
tax on large long-term capital gains, which this package does not compute and says so.

## What this does not do

State tax is deep and this is version 0.7.0. Stated loudly, because a tax library that
hides its gaps is worse than useless:

- **Only 26 states.** No Ohio, Virginia, Minnesota, Wisconsin,
  Oregon, South Carolina, Missouri, Alabama, Connecticut, or the District of Columbia.
  Asking for one throws rather than returning zero.
- **Massachusetts's Schedule B and D netting is not modelled.** Short-term and long-term
  gains are taken as given; the `$2,000` limit on net capital losses deductible against
  interest and dividend income, and the order in which short-term and long-term losses are
  applied against each other, are not computed. Nor is the senior circuit breaker credit,
  which is the largest credit on many Massachusetts retirees' returns.
- **Local income tax in New York, Maryland and Indiana only.** New York City and Yonkers
  are computed from `locality`; all 23 Maryland counties and Baltimore City, and all 92
  Indiana counties, from `county`. Most Pennsylvania municipalities and school districts,
  Detroit and 23 other Michigan cities, Ohio's municipalities and Kentucky's occupational
  taxes are not, and for a Pennsylvania or Ohio filer the local tax is a large fraction of
  the bill. Indiana's nonresident and part-year county tax (Schedule CT-40PNR), which
  apportions by where the income was earned rather than where the filer lived, is not
  modelled either. Nor is part-year city residency, the New York City child and dependent care
  credit, or Maryland's local poverty level credit and Montgomery County's own refundable
  earned income supplement.
- **Maryland's pension exclusion is not computed.** Up to `$41,200` for a filer aged 65 or
  over, reduced by Social Security benefits received — the largest subtraction on a
  Maryland retiree's return, and omitting it can overstate the tax by about `$3,300` of
  state and county tax. Nor is the poverty level credit or the two-income subtraction.
  Pass them through `subtractions`.
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
