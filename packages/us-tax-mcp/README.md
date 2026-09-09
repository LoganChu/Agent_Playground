# us-tax-mcp

**US federal, state and local tax as an MCP server.** Eight tools that compute income tax,
self-employment tax, FICA, capital gains, NIIT, the child tax credit and EITC, the Section
199A deduction, the SALT cap, quarterly estimated payments, **paycheck withholding**,
**state income tax for 26 states including New York, New Jersey, Massachusetts and Maryland**
and **140 local income taxes — New York City, Yonkers, all 24 Maryland jurisdictions, all
92 Indiana counties and all 24 Michigan cities** — for **tax years 2024, 2025 and 2026** — entirely offline, with every figure cited to
the IRS release or state statute it came from.

- **Zero dependencies.** Nothing to install but this package. An MCP server is spawned once
  per conversation; every dependency is latency the user pays each time.
- **MIT.** Usable in a commercial product.
- **Deterministic and offline.** No API key, no network call, no rate limit. The same inputs
  give the same answer forever.
- **Three tax years, not one** — which is what makes "what changed for me" answerable.

```jsonc
// claude_desktop_config.json, .mcp.json, or your client's equivalent
{
  "mcpServers": {
    "us-tax": {
      "command": "npx",
      "args": ["-y", "us-tax-mcp"]
    }
  }
}
```

That is the whole setup. `npx -y us-tax-mcp` needs Node 18 or later and nothing else.

---

## Why this rather than the model's own knowledge

A language model asked "what will I owe on $95,000 of 1099 income" will produce a number.
It will usually be wrong, and it will always be confident. Three reasons, all of which this
server fixes:

**1. 2025 was changed retroactively, and the training data is split.** The One Big Beautiful
Bill Act was signed on 4 July 2025 and amended tax year 2025 *after* the IRS had already
published that year's parameters in Rev. Proc. 2024-40. Four figures were superseded:

| | Rev. Proc. 2024-40 said | Actually true for 2025 |
| --- | --- | --- |
| Standard deduction | $15,000 / $30,000 / $22,500 | **$15,750 / $31,500 / $23,625** |
| SALT cap | $10,000 | **$40,000**, phasing down above $500,000 |
| Child tax credit | $2,000 | **$2,200** |
| Schedule 1-A deductions | did not exist | **all four live** |

And two OBBBA changes are explicitly *not* retroactive — the § 199A phase-in range and the
§ 199A(i) minimum deduction both start in 2026 — so copying 2026's rules backward is wrong
in the other direction. **There is no year adjacent to 2025 that you can safely edit into
it.**

**2. The tax bracket is usually not the marginal rate.** Ask "what does a $1,000 raise
cost me" and the honest answer is frequently double the bracket:

| Filer | Bracket | What another $1,000 actually costs |
| --- | --- | --- |
| Head of household, 2 children, $30,000 | 10% | **21.06%** |
| Head of household, 1 child, $45,000 | 12% | **27.98%** |
| Joint, $560,000, $60,000 of state tax | 35% | **45.5%** |

The first row is the striking one: the child tax credit absorbs the entire income tax at
both incomes, so the bracket is invisible and the whole marginal cost is earned income
credit withdrawal. `effective_marginal_rate` measures this by running the full estimate
twice and differencing it, so it cannot miss an interaction.

**3. The IRS issues errata, and a model trained on a cached PDF carries them.** Two of the
tables this server uses were corrected after first publication, and both corrections are
carried here:

- The **2024 Form 1040 rate schedules** were corrected on 8 January 2025. Married filing
  separately, taxable income over $365,600: the tax is **$98,334.75** + 37%, not the
  $99,334.75 that was printed. This engine cannot reproduce the error even in principle —
  it stores no base-tax column and walks the bands instead, so the corrected figure is
  *derived*.
- **Rev. Proc. 2025-32 was reissued on 17 October 2025**, correcting the 2026 EITC completed
  phase-out for a joint return with three or more children from $70,224 to **$70,244**.

---

## Withholding is not the tax on the return, and that gap is the point

`paycheck_withholding` runs IRS Publication 15-T, and the useful thing about it is that it
disagrees with `estimate_federal_tax` in ways a user cannot see coming.

**Two jobs, two blank W-4s.** The tables assume the job in front of them is the only income
there has ever been. A married couple earning $90,000 and $60,000 in 2026, both W-4s blank,
has **$9,280** withheld against **$15,340** owed. Checking Step 2 on both switches each job
to the halved schedule and closes the gap — exactly, when the two jobs pay the same.

**2025 withholds on a standard deduction the 2025 return does not use.** OBBBA raised it to
$15,750 / $31,500 in July 2025, seven months after Publication 15-T for 2025 was published,
and the IRS never reissued the tables. A joint filer at $130,000 has **$11,828** withheld
against **$11,498** owed — over-withheld by $330, on purpose. Anything that derives 2025
withholding from the 2025 return's standard deduction gets this backwards.

**Additional Medicare Tax is withheld on the wrong threshold, deliberately.** An employer
withholds 0.9% above $200,000 that *it* paid, with no regard for filing status; Form 8959
uses the filing-status threshold. Two spouses at $150,000 each have $0 withheld and owe
$450. One spouse at $230,000 filing jointly has $270 withheld and owes nothing.

Pass `targetAnnualTax` — normally `estimate_federal_tax`'s `totalTax` — and the tool answers
the question the tables cannot: whether the current W-4 will cover a liability that includes
income the employer never sees, and what to put on Step 4(c) to close it. Withholding counts
as paid evenly across the year no matter when it happened (§ 6654(g)), so fixing a shortfall
in November still cures an underpayment from March. A late estimated payment does not.

Both revisions of Form W-4 are handled: the 2020-or-later form with its Steps 2, 3 and 4,
and the 2019-or-earlier form with allowances at $4,300 each.

### The tables are derived, not transcribed

Publication 15-T prints six percentage-method rate schedules a year. None of them is stored
here, because every one is an arithmetic consequence of the year's ordinary rate schedule
and standard deduction:

```text
standard schedule band  =  taxable income band + standardDeduction - step1gAmount
checkbox schedule band  = (taxable income band + standardDeduction) / 2
```

`step1gAmount` is $12,900 in the joint column and $8,600 in the other two — three and two
withholding allowances at the frozen $4,300 rate, because the tables were built for the
pre-2020 Form W-4 and its default allowances. That identity reproduces every threshold the
IRS published for 2024 and 2025, three columns and seven bands each, and all forty-two are
pinned by tests. Publication 15-T for 2026 was not reachable to check against, which the
tool says in its own output rather than only here.

---

## State tax: the rate is the easy part

Every list of state income tax rates gives you a percentage. A percentage of *what* is the
question that decides the answer, and it is different in every state — which is why
`state_income_tax` takes the federal figures from `estimate_federal_tax` rather than
describing the household a second time.

**The One Big Beautiful Bill Act cut 2025 tax in four states that never voted on it**, each
by a different route, because each reaches under federal AGI somewhere:

| State | Route | Cut for one single filer |
| --- | --- | --- |
| Arizona | Its standard deduction *is* the federal one (A.R.S. § 43-1041) | $28.75 |
| Colorado | Starts from federal **taxable** income | $50.60 |
| Idaho | Starts from federal **taxable** income | $60.95 |
| Utah | Its Taxpayer Tax Credit is 6% of the federal deduction | $69.00 |

Illinois and Michigan, on federal AGI, got nothing. No state form changed in any of the six.

**And "starts from federal taxable income" is not "passes it through."** Colorado has added
the § 199A deduction back since 2021, and from tax year 2026 adds back the OBBBA **overtime**
deduction — while still allowing the **tips** deduction sitting beside it on the same
federal schedule. Idaho, on the same base, allows all of them. Same starting line, different
answer, and it changes every year.

**New York claws the brackets back, so walking them is the wrong computation.** Above
$107,650 of New York AGI, Tax Law § 601(d) adds a supplemental tax that recaptures the
benefit of every bracket below the filer's top one, until a high earner pays their top rate
on their *whole* income. A single filer at $300,000 owes **$2,399** more than the rate
schedule says; at $6,000,000 it is **$65,071**. The statute prints forty dollar amounts a
year for this; `state_income_tax` stores none of them and derives every one from the rate
schedule, which reproduces all thirteen distinct published 2025 figures to the dollar and
supplies the over-$25,000,000 tier that reference datasets omit.

The FY2026 budget cut New York's bottom five rates and left the top four alone, so the
recapture rose by exactly what the cut was worth: a single filer at $300,000 saves $215.40
of bracket tax, pays $215.40 more supplemental tax, and owes **exactly the same**.

**New York City is bigger than most states, and it is not a state.** Pass `locality: "NYC"`
and the city tax comes back beside the state one. A single filer at $100,000 owes the city
**$3,174.69** — more than the entire state income tax of **twelve of these twenty-six
states** at the same income. The published city rates are derived rather than stored:
N.Y.C. Admin. Code § 11-1701 imposes 2.7% / 3.3% / 3.35% / 3.4%, § 11-1704.1 adds a tax of
**14% of that tax**, and 2.7% x 1.14 = 3.078% to the last digit. The city earned income
credit has been a sliding **30% to 10%** of the federal one since 2022, not the flat 5% it
was before — and because the worksheet rounds the match to four places, it falls in $5
steps, so the true marginal rate is zero four dollars in five and **78 cents on the dollar**
on the fifth for a family with a $7,800 federal credit.

**Yonkers taxes the tax**, at 16.75% of the New York State tax — measured *before* the
state's refundable credits, which are claimed further down the return. A Yonkers family
whose state earned income credit exceeds their state tax owes **$30.49**; netting the
refundable credit first gives **-$255.94**, a payment from Yonkers of 16.75% of a state
refund.

**"Phases out above $110,000" ends nowhere near $110,000.** Pass `dependentAges` and New
York's Empire State child credit is computed: **$1,000** for each child under 4 and **$330**
(2025) or **$500** (2026) for each child aged 4 to 16, refundable. Its phase-out reduces the
*whole* credit by **$16.50 per $1,000** of AGI above the threshold — not each child's share
— so a bigger family phases out **later**, not faster: one child under 4 keeps some credit
to **$170,000**, three keep some to **$291,000**. And $16.50 is exactly one third of the
federal § 24 phase-out of $50 per $1,000, because New York's credit *was* 33% of the federal
one until the FY2026 budget replaced the amount and left the rate alone.

**Indiana's county tax is two fifths of the bill, on the same line as the state's.** Pass
`county` and all 92 counties are computed on IT-40 line 7 — the state's own taxable income,
after the same deductions and the same $1,000 exemptions. The state rate is 3.00% (2.95% in
2026); the average county rate is **1.914%**, and the spread is six to one: Porter County
charges 0.5% and **Randolph County charges 3.00%**, the statutory maximum — so from 2026 a
Randolph filer pays their county **more than their state**. Six counties raised their rate
for 2026 in the same year the state cut its own, and for a Union County filer the state cut
is worth $29.50 against a county rise of $442.50: their bill went up 14% in a tax-cut year.
The county is the one they lived in on **1 January**, for the whole year, and a county rate
can change on 1 October as well — so the rate withheld and the rate owed can differ.

**A Michigan city taxes what the MI-1040 does not.** Every other local tax here charges a
rate on a state figure. Michigan's 24 cities define their own base under the Uniform City
Income Tax Ordinance, and it excludes pensions, IRA distributions, Social Security,
unemployment compensation and military pay **entirely** — so a retired Detroit filer owes
the city nothing on their pension while Michigan is still working out which tier of MCL
206.30(9) they are in, and a family whose Michigan tax is a refund from the state's 30%
earned income credit still owes Detroit in full. Pass `city`, and `cityIncome` if the filer
has any of those. At $100,000 a Detroit resident owes the state $4,003.50 and the city
**$2,385.60** — 60% as much again, from a rate no table of state taxes contains.

The exemption is the **$600** the Legislature set in Act 284 of **1964** and never indexed,
against Michigan's own indexed $5,800: at Detroit's 2.4% it is worth **$14.40** of tax a
year. The nonresident rate is one half of the resident rate by statute, so this server
derives it rather than storing 24 more numbers. And a resident who works in another taxing
city gets a credit for the tax paid — **capped at their own city's nonresident rate**, which
means it is whole for a Detroit resident commuting to Grand Rapids and short for a Lansing
resident commuting to Detroit, who pays **70% more** city tax than one working at home. Pass
`workCity` and `workCityEarnings` and both are computed.

**Maryland is two income taxes, and rate tables report the smaller one.**  Every Maryland
resident owes a **county** income tax of 2.25% to 3.30% on the same taxable income the state
taxes — there is no county-free jurisdiction, and for a middle-income filer it is a third to
two fifths of the whole bill. A single filer at $100,000 owes the state **$4,386.38** and
Montgomery County **$2,990.40**, and that county half alone is more than the entire state
income tax of Arizona or Indiana. Pass `county`; leave it out and the result says what the
cheapest and dearest counties would have cost that filer.

Two counties have more than one rate and **only one of them is graduated**. Anne Arundel's
rows are marginal brackets; Frederick's bracket selects *one rate that applies to the whole
income*, so a Frederick filer crossing $150,000 of taxable income pays 3.20% on all of it
instead of 2.96% — **$360.03 of tax on one dollar**, where the same dollar in Anne Arundel
costs three cents. And the county earned income credit is not a stored number at all:
§ 10-704(d) makes it **ten times the county rate** times the federal credit, so twenty-four
counties have twenty-four different credits and none of them is a parameter.

The 2025 budget act (HB 352) added two brackets, a **2% capital gains surtax** whose
$350,000 threshold is a *test rather than a floor* — $6,933.08 of tax on one dollar for a
single filer whose $350,000 is all gain, the largest single-dollar step in this package —
and an **itemized deduction limit** that is § 68 revived by a state seven years after
Congress suspended the federal one: deductions fall by 7.5% of federal AGI over $200,000, a
threshold that is not doubled for a joint return. Maryland's two published earned income
credits (50% non-refundable, 45% refundable) are **one credit with a floor**, whose effective
match rises from 45% to 50% as the filer's tax rises — and 100% for an unmarried childless
filer, paid in full.

**Massachusetts is not a 5% flat tax state, and it is the only state here where the rate
depends on the KIND of income.** M.G.L. c. 62 § 4(a) sets three: 5% on Part B income and on
the interest, dividends and long-term gains taxed alongside it, **8.5%** on short-term
capital gains, and **12%** on long-term gains from collectibles, on half the gain. The same
$100,000 costs **$700 more** when $20,000 of it was held eleven months rather than earned.
Pass `massachusettsFivePercentIncome` — it is **required**, because Massachusetts has no
federal starting line either — plus `shortTermCapitalGains` and `collectiblesGains`, and
`result.incomeClasses` reports each with its own rate.

Three more Massachusetts facts no rate table holds. **The statute reads 5.95%**; § 4(b)
steps it down 0.05 points per qualifying revenue year and the steps ran out in 2020 at
exactly 5.00%. **No Tax Status is a generated table** — the published $16,400 joint and
$14,400 head of household are $7,600 plus that status's own personal exemption — and the
**Limited Income Credit above it charges 10%, double the statutory rate**, which is how
Massachusetts buys the absence of New Jersey's cliff. And the **4% surtax threshold**
($1,083,150 for 2025, $1,107,750 for 2026) is per return and cannot be doubled by filing
separately, because since 2024 a couple filing a joint federal return must file jointly
here: that requirement costs two $700,000 earners **$12,322**.

**Six states match the federal earned income credit, and three of them are not what that
sounds like.** Pass `federalEarnedIncomeCredit` from `estimate_federal_tax` and Colorado
(50% in 2025, **25% in 2026**), Illinois (20%), Indiana (10%), Michigan (30%), New York
(30%) and Utah (20%) compute their own. Utah's is **non-refundable**, so a filer whose
Taxpayer Tax Credit already covers their tax gets nothing. New York's is netted against the
New York household credit. Indiana's applies to a federal credit the filer never claimed —
computed under a frozen Internal Revenue Code with Indiana's own $3,800 investment-income
limit.

**California computes its own instead, and it is a triangle.** Pass `earnedIncome` and
`dependentAges` for a California filer. CalEITC adopts the *federal* credit percentages —
7.65% / 34% / 40% / 45% — halves the federal 2015 phase-in ceiling, multiplies the whole
credit by the Budget Act's 85% adjustment factor, and then does the thing no rate table can
show: **it has no plateau.** The phase-out threshold *is* the phase-in ceiling, so the
credit peaks at a single dollar of income and falls at the rate it climbed.

```text
Head of household, two children, 2025          state marginal rate
  $8,000 of wages                                    -34.00%
  $10,000 of wages                                   +34.00%
  $25,000 of wages                                    +4.20%
```

A 68-point swing across the dollar at `$9,823`, then a long flat tail to the `$32,901` cap.
The **Young Child Tax Credit** adds `$1,189`, refundable, for any child under 6 — one credit
per return however many children, and gated on CalEITC, so the `$4,814` investment-income
limit is a cliff worth `$4,528.82`. A single parent of two at `$25,000` goes from a
California tax of `$0` to a refund of `$1,520.76`.

**New Jersey has no federal starting line at all, and the cliffs are the point.** Pass
`newJerseyGrossIncome` — NJ-1040 line 27 — because federal AGI is not an approximation of it:
New Jersey ignores Social Security and unemployment compensation and *taxes* 403(b) deferrals
and traditional IRA contributions, which never reach federal AGI. Then three things happen
that no rate table can show.

- **Below the filing threshold there is no tax at all**, and one dollar later the whole first
  bracket arrives: `$0` at `$10,000` of gross income and `$126.01` at `$10,001` for a single
  filer, `$252.01` for a joint one. The threshold is on gross income and the tax is on taxable
  income, so how far a filer falls depends on their own exemptions.
- **The retirement income exclusion ends in a wall.** Pass `filerAge` and `retirementIncome`
  and a 62-year-old excludes 100% of a pension below `$100,000` of total income, 50% to
  `$125,000`, 25% to `$150,000` — and **nothing** at `$150,001`. For a joint return with a
  `$100,000` pension that single dollar costs **$1,381.31**, the largest one-dollar cliff in
  this package.
- **The child tax credit is a staircase with five steps.** `$1,000` per child under 6 at
  `$30,000` of New Jersey taxable income and `$800` at `$30,001`, so a family with three
  young children loses `$600` on one dollar — and `$750` from 2026, because P.L. 2026, c.26
  raised every step by exactly 25% for 2026 through 2028.

The published rate schedules are generated too: New Jersey prints its tax as "multiply by
.05525 and subtract `$1,492.50`", and all thirteen subtraction constants across the two
schedules are `rate x threshold - the tax already collected below it`. This package stores
the marginal schedule and derives every one of them. A head of household files on the
**joint** schedule, which almost no other state does, and a qualifying surviving spouse gets
three different mappings on one return — the joint rate schedule, the single `$75,000`
exclusion maximum, and one `$1,000` exemption rather than two.

**A flat rate is not a marginal rate.** `state_income_tax` measures the marginal rate by
running the whole computation one dollar higher, which is the only way any of this is
visible:

| State | Headline rate | What the next dollar actually costs |
| --- | --- | --- |
| Utah, single, $25,000 | 4.45% | **5.75%** — the Taxpayer Tax Credit phases out underneath it |
| Pennsylvania, single parent of two | 3.07% | **~34%** across the Special Tax Forgiveness staircase |
| Illinois, single at $250,000 | 4.95% | **$141.12 on one dollar** — the exemption is a cliff, not a phase-out |
| California, at a credit phase-out step | 9.3% | 9.3 cents **plus $6** of lost exemption credit |
| New York, single at $130,000 | 6% | **7.14%** — the supplemental tax phases in underneath the rate |
| Maryland, Frederick County at $150,000 of taxable income | 2.96% | **$360.03 on one dollar** — the county rate applies to the whole income, not the band |
| Maryland, single at $350,000 of capital gain | 5.75% | **$6,933.08 on one dollar** — the 2% surtax threshold is a test, not a floor |
| Indiana, Randolph County, 2026 | 2.95% | **5.95%** — the county rate is 3.00%, more than the state's |
| Michigan, Detroit resident | 4.25% | **6.65%** — the city takes another 2.4% of a base the state return does not compute |

Seven of the seventeen taxing states cut their rate for 2026, so an unsupported year is an
error rather than a fallback to the nearest one — and eight of the 2026 state-years carry at
least one indexed figure forward from 2025, which every result says out loud.

Maryland is two income taxes rather than one. Every resident owes a **county** income tax of
2.25% to 3.30% on the same taxable income the state taxes — a third to two fifths of the whole
bill, and absent from every table of state rates. Pass `county`; leave it out and the result
says what the cheapest and dearest counties would have cost that filer.

---

## The tools

| Tool | What it answers |
| --- | --- |
| `estimate_federal_tax` | "What do I owe?" "What's my refund?" A complete Form 1040 picture for one household and one year. |
| `compare_tax_years` | "How does 2026 compare to 2025?" "What did OBBBA do to my return?" The same household run through every year, with the provisions that moved named. |
| `effective_marginal_rate` | "Should I take the raise?" "What will this bonus cost me?" The true cost of the next dollar, decomposed. |
| `quarterly_estimated_payments` | "What do I send the IRS each quarter?" The IRC § 6654 safe harbors and four dated installments. |
| `get_tax_parameters` | "What are the 2026 brackets?" Every published figure for a year, cited. |
| `paycheck_withholding` | "What will my take-home pay be?" "How should I fill out my W-4?" One paycheck by the Publication 15-T percentage method, and what to put on Step 4(c). |
| `state_income_tax` | "What do I owe California?" "What does New York take?" "What about New York City, Marion County, or Detroit?" A state and local return for 26 states plus New York City, Yonkers, all 24 Maryland jurisdictions, all 92 Indiana counties and all 24 Michigan cities, taking the federal figures from `estimate_federal_tax` — because which federal figure a state starts from is what decides the answer. |
| `list_supported_years` | What is covered, what is **not** covered, and where each year's numbers came from. |

Every tool is read-only, touches nothing outside the process, and returns both a
human-readable text block and machine-readable `structuredContent`.

### What it looks like

> **Head of household, two children, $30,000 of wages, 2026.**

```
Gross income                            $30,000.00
Deduction (standard)                    $24,150.00
Taxable income                           $5,850.00

Ordinary income tax                        $585.00

Child tax credit (§ 24)                  $4,400.00
  applied against income tax               $585.00
  refundable (ACTC)                      $3,400.00
  unused (neither offset nor paid)         $415.00
Earned income credit (§ 32)              $6,029.23

Total tax                                    $0.00
REFUND                                   $9,429.23

Marginal ordinary rate (bracket)               10%
```

> **The same household, `effective_marginal_rate`.**

```
Ordinary tax bracket                           10%
TRUE MARGINAL RATE                          21.06%
Cost of the extra income                   $210.60
You keep                                   $789.40

Where it goes:
  Ordinary income tax                      $100.00
  Earned income credit withdrawn           $210.60
```

The components always sum exactly to the cost — there is a test for it. Here the income tax
rises by $100 and the child tax credit grows by $100 to absorb it, so the entire net cost is
EITC withdrawal at the § 32 phase-out rate.

---

## Correctness

The engines underneath live in the same repository. `packages/us-federal-tax`: **283 tests**
against hand-computed figures, every parameter cross-checked against two independent
sources. `packages/us-state-tax`: **51 tests**, every state figure cited to its statute.
This package adds **97 more** covering the protocol and the tool layer.

Some things it gets right that comparable implementations do not:

- **The four OBBBA phase-outs disagree with each other, and that is deliberate.** § 224
  (tips) and § 225 (overtime) reduce by $100 for each **full** $1,000 of excess — $999 over
  the threshold costs nothing. § 163(h)(4) (vehicle loan interest) says "or portion
  thereof", so **one dollar** over costs a full $200. The senior deduction is a continuous
  6%. PolicyEngine-US — the most serious open US tax model in any language — models the
  first two as a flat 10%, which is right on exact multiples of $1,000 and wrong everywhere
  else.
- **A non-refundable credit cannot reduce self-employment tax.** SE tax, NIIT and the
  Additional Medicare Tax are not chapter 1 subchapter A liabilities. A head-of-household
  filer with $30,000 of Schedule C profit and one child owes $373.06 of income tax and
  $4,238.87 of SE tax; the credit erases the first and none of the second. Netting credits
  against one "total tax" figure gets that wrong in the filer's favour.
- **The § 24 phase-out rounds up.** "$50 for each $1,000 **or fraction thereof**" — a joint
  filer at $400,001 loses $50, not five cents.
- **Earned income for both credits is net of half of self-employment tax** (§ 32(c)(2)(A)(ii),
  via § 164(f)). Using gross profit overstates the credit while it phases in and
  *understates* it once the phase-out starts — a bug that changes sign, which is very hard
  to catch by sampling.
- **The EITC joint-filer add-on is not a constant.** The IRS rounds the resulting sum to the
  nearest $10 rather than the addend, so for 2026 it is $7,280 with no children and $7,270
  with children. Storing one value misplaces one of the two tables by $10 of income.
- **The § 24 and § 164(b)(6) phase-outs run on *modified* AGI**, not AGI — AGI plus income
  excluded under § 911, § 931 and § 933.

## What is not modelled

Stated here and by `list_supported_years`, because a model that cannot see the gaps will
confidently fill them in.

- **Alternative minimum tax (§ 55).** A filer who owes AMT owes more than this reports.
- **24 states, the District of Columbia, and every local income tax outside New York,
  Maryland, Indiana and Michigan.** `state_income_tax` covers 26 states — AK, AZ, CA, CO, FL, GA, ID, IL, IN, KY,
  MA, MD, MI, MS, NC, NH, NJ, NV, NY, PA, SD, TN, TX, UT, WA, WY — for 2025 and 2026, and
  nothing else. Ohio, Virginia and Minnesota are absent, and asking for one is an error
  rather than a zero. Local tax is New York City, Yonkers, Maryland's 24 jurisdictions,
  Indiana's 92 counties and Michigan's 24 cities: Pennsylvania municipal earned income
  taxes, Ohio municipalities and Kentucky's occupational taxes are not modelled, nor is
  part-year city residency, Maryland's local poverty level credit, Indiana's Schedule
  CT-40PNR for a nonresident, or the day-count apportionment behind a Michigan
  nonresident's city wage — pass `workCityEarnings` already apportioned. State earned income credits
  are modelled for the six states that set them as a share of the federal credit, and New
  York's Empire State child credit and California's Young Child Tax Credit from
  `dependentAges`; no other state child credit or retirement exclusion is, so a family or
  retiree state return outside New York and California comes out **too high**. California's
  Foster Youth Tax Credit — the same `$1,189` on the same phase-out — needs a foster-care
  history there is no field for, and CalEITC qualifying children are counted from
  `dependentAges` alone, so a full-time student under 24 and a permanently disabled
  dependent are both missed.
- **The new § 68 overall limitation on itemized deductions** (OBBBA § 70111, first effective
  2026). Its formula needs the § 199A deduction, and § 199A needs taxable income, which
  needs itemized deductions after § 68 — a genuine fixed point the statute does not resolve.
  Rather than invent an ordering the IRS has already chosen differently, it is left out and
  bounded: above $640,600 ($768,700 joint), an itemizer's deduction is overstated by at most
  2/37 — 5.4% — of it. Everyone below is unaffected.
- **The 0.5%-of-AGI charitable floor** (OBBBA § 70425) and the 7.5%-of-AGI medical floor.
  `otherItemizedDeductions` is taken as given.
- **Education credits, the § 21 dependent care credit, the saver's credit, the premium tax
  credit, energy credits, the foreign tax credit, and business credits.**
- Trust, estate and corporate returns; part-year and non-resident returns.
- **Withholding**: the wage bracket method tables (a rounded presentation of the same
  percentage method), nonresident alien employees, supplemental wages, backup withholding,
  Forms W-4P and W-4R, and state or local withholding. No year's withholding tables account
  for the Schedule 1-A deductions either — claim those on Form W-4 Step 4(b).

**This computes tax. It is not tax advice**, and it is not a substitute for a return
preparer. See the licence for the full disclaimer of warranty.

---

## Using it as a library

The tools are also importable, so they can be mounted inside a server you already run.
`handleMessage` is a pure function from a decoded JSON-RPC message to a response — no hidden
state, no I/O.

```js
import { handleMessage, TOOLS, estimateFederalTax } from 'us-tax-mcp';

// The MCP layer:
handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

// Or the engine directly — the whole of `us-federal-tax` is re-exported:
estimateFederalTax({ filingStatus: 'single', w2Wages: 95000, year: 2026 });
```

## Protocol notes

Speaks MCP over stdio, negotiating `2026-07-28`, `2025-11-25`, `2025-06-18`, `2025-03-26`,
`2024-11-05` and `2024-10-07`; an unrecognised version is answered with `2025-11-25` rather
than failing the handshake.

The server is **stateless**: `tools/list` and `tools/call` are answered whether or not
`initialize` was sent first. That is the direction the protocol moved — the 2026-07-28
revision removes the handshake and the session it established — while older clients still
perform it. One implementation serves both.

## Licence

MIT. Copyright (c) 2026 Logan Chu.
