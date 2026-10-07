# us-state-tax

US **state and local** individual income tax for tax years **2025 and 2026**, across **32
states** including **Oregon**, **New York**, **New Jersey**, **Missouri**, **Connecticut**, **Alabama**,
**Massachusetts**, **Maryland**, **Ohio** and **Virginia**, plus **1,033 local income taxes**: New York City, Yonkers, all 24
Maryland jurisdictions, all 92 Indiana counties, all 24 Michigan cities, all **679 Ohio
municipalities** and all **214 Ohio school districts** — more taxing jurisdictions than the
rest of the United States put together. Dependency-free, MIT, ESM and CommonJS, TypeScript types included.

New in 0.38.0: **Oregon, where the top rate starts at `$125,000` and does not reach a single filer until `$133,161`.**

Oregon is the third state here that deducts the federal income tax, and the three do
it three different ways — which is the whole argument for modelling a state rather
than transcribing its rate table.

| state | the chart varies | read against | sits |
| --- | --- | --- | --- |
| Alabama | nothing — 100%, uncapped | — | below the deduction |
| Missouri | the **share** of the bill | **Missouri** AGI | below the deduction |
| Oregon | the **ceiling** on the bill | **federal** AGI | **inside Oregon AGI** |

Oregon's ceiling is `$8,750` for 2026 and it falls in five equal steps, each one a
cliff of the whole difference. The income where it starts falling is the same
`$125,000` where Oregon's top 9.9% rate begins — the two steepest things in the
schedule aimed at the same dollar:

| federal AGI | ceiling | one more dollar costs |
| --- | --- | --- |
| `$125,000` | 8,750 → 7,000 | `$153.22` |
| `$130,000` | 7,000 → 5,250 | `$153.21` |
| `$135,000` | 5,250 → 3,500 | `$173.35` |
| `$140,000` | 3,500 → 1,750 | `$173.35` |
| `$145,000` | 1,750 → 0 | `$173.35` |

**The first two cost less than the last three, and the subtraction itself is why.**
The lost `$1,750` is charged at whatever Oregon rate the filer is on, and up to
`$8,750` of subtraction holds them *below* the `$125,000` where 9.9% starts. Which
produces the fact worth more than the cliffs: **Oregon's top rate nominally begins at
`$125,000` and does not reach a single filer until `$133,161` of federal AGI.** The
two steepest things in the schedule are aimed at the same dollar and never meet
there.

**And no two of the three states subtract the same federal credits from the
deduction.** The worksheets take the refundable credits off, because those are money
received rather than tax paid — and they disagree about which:

| | earned income credit | refundable child tax credit | refundable AOC |
| --- | --- | --- | --- |
| Alabama | subtracted | subtracted | subtracted |
| Missouri | subtracted | — | subtracted |
| **Oregon** | **—** | subtracted | subtracted |

Publication OR-17 says it in a sentence: the subtraction is the federal tax "after
all credits other than the earned income tax credit". So `federal.earnedIncomeCredit`
moves the answer three ways in this one library — down in the six states that match
it, **up** in Alabama and Missouri, and down-only in Oregon, which matches it *and*
refuses to claw it back. Missouri reads that one figure twice in opposite directions;
Oregon reads it twice in the same direction, and that is a drafting choice rather
than an accident.

**The Oregon Kids Credit is withdrawn over a width, not at a rate.** `$1,050` for
each dependent under six, up to five of them, and the whole of it goes across
`$5,000` of Oregon AGI above `$26,550` — so the implied marginal rate is
credit ÷ width and *grows with the family*:

| children under 6 | credit withdrawn | over | implied rate |
| --- | --- | --- | --- |
| 1 | `$1,050` | `$5,000` | 21% |
| 3 | `$3,150` | `$5,000` | 63% |
| **5** | **`$5,250`** | **`$5,000`** | **105%** |

At the statutory maximum the withdrawal is **steeper than the income that causes
it**: a family with five children under six is strictly worse off with `$31,550` of
Oregon AGI than with `$26,550`, before Oregon's own rate and before anything federal.

**Two more things only a two-year engine can tell you.** SB 1507 raised Oregon's
earned income credit from 9% to **14%** of the federal credit for 2026, and from 12%
to **17%** where a dependent is under three — so the same household's credit is 55%
larger in one of the two years this package covers. And Oregon's "kicker" surplus
credit is a **biennium rather than a schedule**: 9.863% of the filer's own prior-year
tax for 2025 and *nothing* for 2026, because the biennium it measures ends on 30 June
of odd years. It is not modelled, because it needs a prior-year return this package
is never given, and every 2025 Oregon return says so in a note.

---

Previously, in 0.37.0: **Missouri, where one dollar of income costs `$61.94`.**

Missouri deducts a **share** of the federal income tax, and § 143.171.2 writes the
share as a **cliff chart rather than a phase-out**: 35% of the federal bill at
`$25,000` or less of Missouri adjusted gross income, 25% to `$50,000`, 15% to
`$100,000`, 5% to `$125,000`, nothing above. One percentage applies to the *whole*
bill, so one dollar of income at a boundary moves the entire deduction down a step.

| Missouri AGI | the share | one more dollar costs |
| --- | --- | --- |
| `$25,000` | 35% → 25% | `$4.05` |
| `$50,000` | 25% → 15% | `$18.00` |
| **`$100,000`** | **15% → 5%** | **`$61.94`** |
| `$125,000` | 5% → 0% | `$44.07` |

No table of Missouri's rates can show that, because the figure falling off the cliff
belongs to a different government. It is the largest single-dollar jump in this
package outside Maryland's capital gains surtax, and unlike that one it is reached by
an ordinary wage earner with no gain and no planning.

**And Missouri is the first state in the United States to exempt capital gains
outright.** HB 594, signed 10 July 2025 and retroactive to 1 January, subtracts "one
hundred percent of all income reported as a capital gain for federal income tax
purposes" — **short-term included**, where Massachusetts at the other end of this
package charges short-term gain 8.5%. The part no summary carries is *where* the
subtraction sits: it is a modification in arriving at **Missouri AGI**, which is the
figure the cliff chart above is read against. So the exemption takes the gain out of
the base *and* moves the filer down a step, handing them a share of a federal bill
the gain itself made bigger. On `$90,000` of wages and `$60,000` of long-term gain it
is worth **`$2,960.79`**, where 4.7% of the gain is `$2,820`.

It also brought a dead letter back to life. The `$5,000` / `$10,000` cap on the
federal tax deduction could not bind on any ordinary return between 2019 and 2024 —
35% of a bill reaches `$5,000` only at `$14,286` of federal tax, which nobody with
`$25,000` of Missouri AGI pays. A filer with `$4,000,000` of gain and `$25,000` of
wages now sits in the 35% step with a federal bill near `$900,000`, and the cap is
the only thing between them and `$315,000` of deduction.

**And the number this is all worth, measured rather than asserted.** Asked what
Missouri charges a single filer on `$75,000` of 2025 salary, the answer at the
top of a search engine today is **`$3,525`** — which is 4.7% of `$75,000` to the
cent. This package says **`$2,552.77`**, and the `$972.23` between them
decomposes exactly:

| | |
| --- | --- |
| the standard deduction and the federal tax deduction, at 4.7% | `$796.29` |
| the graduated schedule — the zero band and the six lower rates | `$175.94` |
| **total** | **`$972.23`** |

The competition for "what does Missouri charge" is not another engine. It is a
rate table multiplied by a salary, and it is 38% high.

Three more things no Missouri rate table shows:

- **The eight brackets are one number.** § 143.011.5 indexes the schedule as a block,
  so the bands are the first one's width times one through seven — `$1,348` for 2026,
  `$1,313` for 2025 — the first band is taxed at **zero**, and 4.7% begins at
  `$9,436`. The tax on everything below that is `$262.86` at every income, where a
  flat 4.7% would be `$443.49`: **the whole graduated schedule is worth `$180.63`**.
  And it does not double on a joint return, because the brackets do not change at all
  — Alabama's `$40` becomes `$80` for a couple and Missouri's `$180.63` does not move.
- **A retiree's Social Security eats their public pension exemption.** Form MO-A
  Part 3 Section A caps the public pension deduction at the maximum Social Security
  benefit (`$47,633` for 2025) and then **subtracts the Social Security deduction the
  same person just took**. `$70,000` of public pension alone deducts `$47,633`; the
  same `$70,000` as `$40,000` of pension plus `$30,000` of taxable benefit deducts
  `$40,000`. `$7,633` apart, on identical income, in a state that taxes neither kind
  of it. And the **private** pension deduction on the same form disagrees: its income
  test takes the benefit back *out* of Missouri AGI, so the dollar that destroyed one
  exemption protects the other.
- **The working family tax credit is 20% of the federal earned income credit,
  and it zeroes most low-income Missouri returns.** § 143.177, Form MO-WFTC,
  non-refundable: a head of household with one teenager on `$35,000` of wages
  owes `$264.22` before it and nothing after. It is lost ENTIRELY above `$4,400`
  of investment income — a limit that is a **conformity date** rather than a
  figure Missouri chose, because § 143.177.3(1) reads § 32 as it stood on
  1 January 2021 and the pre-ARPA disqualified-income ceiling is several times
  lower than today's. A Missouri filer with `$5,000` of investment income keeps
  the whole federal credit and loses the whole state one. So Missouri reads the
  federal earned income credit **twice, in opposite directions** — the MO-1040
  line 9 worksheet subtracts it from the federal tax deduction and § 143.177
  matches a fifth of it — and it is the only state here that does.
- **The two states here that deduct the federal tax do not subtract the same
  refundable credits.** Alabama's worksheet takes the refundable child tax credit;
  Missouri's starts from Form 1040 **line 22**, which line 28 never reduced, so it
  does not. `$1,600` of refundable child credit costs an Alabama family `$80` and a
  Missouri family nothing.

---

Also in 0.36.0: **Alabama, where a federal tax cut raises the state tax bill.**

Alabama is the only state here whose tax base contains the **federal tax bill
itself**. Form 40 line 12 deducts the federal income tax paid — Ala. Code
§ 40-18-15(a)(3) allows "taxes paid or accrued within the taxable year, including
income taxes ... imposed by authority of the United States" — and it is deducted by
**every** filer, not only by itemizers. So every dollar the federal government stops
charging is a dollar more of Alabama taxable income:

| the federal change | what it does in Alabama |
| --- | --- |
| a `$2,200` child tax credit | **+`$110`** of Alabama tax |
| the OBBBA tips and overtime deductions | **+5%** of whatever they save federally |
| a `$4,000` earned income credit | **+`$200`**, because the worksheet subtracts the refundable credits too |
| the `$3,820` a single filer owes on `$50,000` of wages | **−`$191.00`** |

Six states in this package match the federal earned income credit and move the way
Congress moves. Alabama moves the other way, for every federal credit, rate and
deduction at once. `federal.earnedIncomeCredit` is read by both kinds of state, and
**the same input moves the answer in opposite directions depending on which state it
is handed to** — nothing in its name says which.

Three more things no Alabama rate table shows:

- **Alabama's marginal rate is 5% minus 5% of the federal one, and it FALLS as
  income rises.** One more dollar of wages adds 5 cents of Alabama tax — and adds
  the federal marginal rate to the federal bill, which line 12 deducts, giving
  part of the 5 cents back. In the 12% federal bracket the next dollar costs
  **4.4%** in Alabama; in the 22% bracket **3.9%**; in the 37% bracket **3.15%**,
  which is less than a filer on a quarter of the income pays. The state's own
  schedule is flat above `$3,000` and its marginal rate is **regressive**, and
  the figure is in no Alabama table because it is two governments meeting. Pass
  `federalOneDollarHigher` and this engine reports it exactly; without it the
  engine reports the schedule's 5% and says so in a note.

- **The 5% top rate starts at `$3,000`** of taxable income (`$6,000` joint) and has
  since 1935. The tax on that first `$3,000` is `$110` whatever the filer earns, and
  measured against a flat 5% the whole graduated schedule is worth `$40` — `$80` on a
  joint return. Alabama is a flat 5% state with a `$40` discount.
- **The standard deduction is a staircase that rounds the opposite way from
  Connecticut's.** § 40-18-15(b) withdraws `$25` per `$500` of Alabama AGI above
  `$25,500` for a single filer (`$175` joint, `$135` head of family, `$88` per `$250`
  separate) down to a floor. There is **no "or fraction thereof"**, so the first
  `$499` above the threshold cost nothing — where Connecticut's § 12-702, which has
  the clause, charges the whole step on the first dollar. Every column reaches its
  floor at `$35,500` in exactly twenty steps, and the separate column proves it: its
  `$88` is `$87.50` rounded up, so its twentieth step is worth `$78` and the floor
  absorbs the difference.
- **Retirement turns on the TYPE OF PLAN, which no federal figure records.** A
  defined benefit payment is exempt in full, at any age, with no cap — Ala. Admin.
  Code r. 810-3-19-.04 reads IRC § 414(j) and reaches non-qualified plans, SERPs and
  excess benefit plans — while a defined contribution distribution is taxable above
  `$6,000` and only from 65. At 62 a `$60,000` pension is free and a `$60,000` 401(k)
  draw costs **`$2,760.00`**. Both arrive on a 1099-R; both land on line 5b.

And the dependent exemption is **one chart for all five filing statuses** — `$1,000`
each at or below `$50,000` of Alabama AGI, `$500` to `$100,000`, `$300` above — so two
single parents at `$50,000` each claim `$1,000` a child and the same two people filing
jointly on `$100,000` claim `$500`. The statute's boundaries are inclusive in its own
words ("equal to or less than fifty thousand dollars"), so a filer at exactly `$50,000`
keeps the `$1,000`; PolicyEngine-US reads that boundary the other way, which is `$25`
of tax for a filer standing on it.

Alabama also exempted overtime before Congress did and stopped the month Congress
started: Act 2023-421 excluded the **whole** overtime wage from gross income, uncapped,
for overtime paid before 30 June 2025, and HB 527 — signed in April 2026 — deducts the
**premium only**, capped at `$1,000`, for 2026 through 2028. The same ten hours of
overtime at `$30` against a `$20` regular rate are `$300` of Alabama exclusion in the
first half of 2025 and `$100` of Alabama deduction in 2026, against a federal § 225 cap
of `$12,500` on that same `$100`.

New in 0.35.0: **Connecticut, where there is no continuous stretch of income tax
above $30,000.**

Every state's rate table leaves something out. Connecticut's leaves out four
staircases, three of them built from the same four words of statute — **"or fraction
thereof"** — and each of them reached by *one dollar* of extra income rather than by a
proportion of it:

| above | step | one dollar costs a single filer |
| --- | --- | --- |
| `$30,000` | `$1,000` of personal exemption per `$1,000` of Connecticut AGI | **`$45`**, fifteen times over to `$45,000` |
| `$56,500` | `$25` of rate phase-out add-back per `$5,000` | **`$25`**, ten times over to `$106,500` |
| `$105,000` / `$200,000` / `$500,000` | `$25` / `$90` / `$50` of tax recapture per `$5,000` | **`$25`**, **`$90`**, **`$50`** |
| 27 rows of Table E | a percentage point or five of the whole tax | up to **`$20`** |

And the exemption withdrawal is **dollar for dollar**, so each `$1,000` of income adds
`$2,000` of Connecticut taxable income: a single filer between `$30,000` and `$45,000`
is in the 4.5% bracket and pays **9%** on the next dollar, which is a figure that
appears in no Connecticut table because it is two rules meeting.

The trap underneath is that **half of Connecticut's tables scale between filing
statuses and half do not, and the two halves look identical.** The rate schedule is
one table scaled — single and separate are exactly half the joint figures, head of
household exactly four fifths — and the recapture scales too, except for one row:
§ 12-700(b) charges a head of household `$140` per `$8,000` in the middle tier to a
maximum of `$4,200`, where four fifths of the joint figures would be `$144` and
`$4,320`. The exemption, the add-back thresholds and the personal credit do not scale
at all. Half of a joint exemption is `$12,000` and half of a joint
add-back threshold is `$50,250`, and both of those are **real Connecticut numbers
belonging to a separate filer** — so a model that scales what it should not lands on a
plausible figure for the wrong status and never looks wrong. `test/connecticut.test.js`
asserts the scaling where it holds and the exact disagreement where it does not — and
that one `$140` row is there because the test, written from the statute, disagreed
with the comment above it.

One more, with a date on it: Connecticut's IRA subtraction is phasing in over four tax
years — 25%, 50%, 75%, 100% — so **2026 is the first year a Connecticut retiree's
traditional IRA is treated the same as their pension**, and the two years this package
covers sit on either side of that line.

And one that is not in the statute I read. Connecticut's earned income tax credit
gained a **flat `$250`** for a filer with at least one qualifying child, new for tax
year 2025 and printed on CT-1040 line 20a. It was found by the differential harness —
ten Connecticut households with children came back exactly `$250` apart from
PolicyEngine-US on the first run against this state — and it is flat rather than a
percentage, so one child and three are worth the same and it does not taper with
§ 32: it is a **cliff** at the income where the Connecticut credit reaches zero.

New in 0.24.0: **a one-person return cannot hold two blind people.**

v0.23.0 fixed the per-person *exemption* for a qualifying surviving spouse and
left the per-person *condition*, which is the same fact counted by a different
helper. `filerCount()` calls that status two filers, and for an AMOUNT it is
usually right — most state returns put it in the joint column, and California's
Form 540 says so about the count itself: line 7 reads *"If you checked box 2 or
5, enter 2"*, and box 5 **is** the qualifying surviving spouse. So a Californian
widow really does claim two personal exemption credits.

For a COUNT OF PEOPLE it is never right. A caller who passes
`blindOrDisabled: 2` for a widow — which is exactly what a caller who believes
the status implies two filers would pass — was allowed **two** blind allowances
against a household of one: `$153` in California, `$144.50` in Michigan, `$60`
in Mississippi, and the same doubling in Illinois, Indiana and New Jersey. A
single filer was correctly capped at one the whole time. A `spouseAge` supplied
on the same return bought a second *senior* allowance the same way.

Every condition is now capped by `livingFilerCount()`, and the two helpers are
kept deliberately apart rather than reconciled — reconciling them would mean
overruling the FTB's own instruction about California's line 7. **When one fact
is counted by two helpers the bug is not that they disagree; it is that nothing
says which question each one answers.**

Also in 0.23.0: **two conditions a rate table cannot hold, and one filing status
nothing had ever filed.**

**A qualifying surviving spouse is ONE person.** `perPerson()` — the helper that
builds a per-head exemption table — gave that status the joint figure, because
that is the near-universal rule for a *statutory* amount and is right for a
standard deduction. It is not right for a count of people: the spouse is dead,
the return has one filer on it, and every state form asks the filer to tick a box
for themselves and another for a spouse **if filing jointly**. Illinois, Indiana
and Michigan were each giving a widow an exemption for a person who was not there
— `$141.08`, `$49.70` and `$246.50` a year.

**And Virginia has no surviving-spouse status at all.** Form 760 sends a federal
head of household *or* qualifying surviving spouse to Filing Status 1, **Single**,
so a Virginia widow takes the `$8,750` standard deduction and one `$930` exemption
rather than the joint figures: `$556.60` a year. Virginia's own age deduction and
filing thresholds in this package already said single; the standard deduction and
the exemption did not. Two figures in one state disagreeing about one filing
status is what a default you never have to write looks like when it is wrong.

New in 0.23.0 as well: **two conditions a rate table cannot hold — being 65, and being blind.**

Six states here already added an exemption for blindness. Four more provisions
existed and had no rule, and all four are now computed:

| | | worth |
| --- | --- | --- |
| **California** | one more exemption **credit** at 65, and one more for blindness — `$153` each, Form 540 lines 8 and 9 | `$306` a year to a retired couple |
| **Michigan** | the `$3,400` special exemption, MCL 206.30(3)(a) — blindness, deafness, or total disability under 66 | `$144.50` |
| **Mississippi** | `$1,500` at 65 and `$1,500` for blindness, § 27-7-21(f) and (g) | `$60` a box |

California's are **credits**, so they are worth the same `$306` to a retired
couple at `$30,000` and at `$250,000` — which is the whole reason California
states its exemptions that way, and the reason an engine that models them as
deductions is wrong in both directions. They are claimed **per person**, and
§ 17054(c) and (d) stack on one person: a blind Californian of 65 claims three
personal exemptions.

Also fixed in California: the AGI limitation on the exemption credits is applied
to each **line** of Form 540 and floored at zero there, not netted across the
return. Above about `$315,000` a single filer's `$153` personal credit is already
gone and the `$475` dependent credit is not, and one subtraction across both
would let the dead credit eat the live one.

And a defect in the MCP server that these found: `blindOrDisabled` was refused
for every state outside a hand-written `['NJ', 'IL', 'IN']`, so a **Maryland**
caller was refused a field Maryland's own note tells them to pass — and
Massachusetts and Virginia the same. The list is now derived from the engine.

Why it took twenty-five days: the differential grid had **no blind filer in it
at all**, and its only 65-year-olds were retirees in states that exempt
retirement income, where the tax is zero either way and an exemption cannot
show. The grid gained a `blind-worker` and a `blind-senior` on the same day.

Also in 0.22.0: **two credits that turn on facts no income figure carries.**

**Georgia's eligible itemizer tax credit** (O.C.G.A. § 48-7-27.1) is `$300` for each
taxpayer — `$600` on a joint return — and its only test is which box was ticked on the
**federal** return. Not income, not age, not what the deductions were. It is worth the
same `$300` at `$50,000` and at `$5,000,000`.

The reason it exists is the reason it inverts the rule every guide states. § 48-7-27(a)(1)
ties the Georgia election to the federal one in **both** directions — a federal itemizer
must itemize here even where the Georgia standard deduction is larger — and HB 1437 raised
that standard deduction to `$15,000`/`$30,000` while leaving the itemized figure alone. At
4.99% the credit is worth **`$6,012` of deduction**, so a Georgia itemizer whose itemized
deductions fall that far *short* of the standard deduction still comes out ahead, and a
joint couple `$12,024` short. Pass `federal.deductionKind`; `stateItemizedDeductions` is
now read for Georgia too, where it had been accepted and silently ignored.

**Indiana's unified tax credit for the elderly** (IC 6-3-3-9) is refundable, and for a
household living on Social Security it is the **entire return**: Indiana exempts the
benefit, the `$5,000` of exemptions takes Indiana AGI below zero, the tax is nothing, and
the `$140` is the only figure that moves. It is `$100`/`$50`/`$40` for one filer at 65 and
`$140`/`$90`/`$80` for two, banded on **federal** AGI under `$1,000`, `$3,000` and
`$10,000` — so none of Indiana's own generosity buys a dollar of room under the ceiling.
Every edge is a cliff and there are three: one dollar at `$1,000` costs `$50`. Pass
`filerAge` and `spouseAge`.

One correction that is not a number: this package cited the itemizer credit as
O.C.G.A. § 48-7-29.23 until 0.22.0, copied from PolicyEngine-US's own variable file. **No
such section exists.** Their *parameter* file has it right, and the two disagree.

Also in 0.21.0: **two low-income corrections, both of them the whole bill.**

**Indiana was computing the smallest of the four exemptions on its own Schedule 3.** The
published figure is `$1,000` a person and that is right for exactly one household — a
working adult with no children. On top of it Indiana allows `$1,500` more for each
dependent **child**, `$1,000` for each filer at 65, `$1,000` for each blind filer, and
`$500` MORE for each filer at 65 whose federal AGI is under `$40,000`. None of the four was
computed here, and the note that said so put the cost at "about `$44` per qualifying
child" — which was the **state** rate on `$1,500` in a state where two fifths of the bill
is levied by a county. The real figure in Marion County is **`$74.55` a child**, `$149.10`
for a family with two, and `$149.10` for a retired couple under `$40,000`.

The `$500` is the only means-tested exemption in this package and it is a **cliff**: a
joint return with both spouses at 65 claims `$3,000` of age exemption at `$39,999` of
federal AGI and `$2,000` at `$40,000`, so one dollar of income costs **`$49.75`** in Marion
County. And the child exemption needs `dependentAges`, not `dependents`: an Indiana
dependent child is worth `$2,500` of exemption and a dependent parent `$1,000`, and a count
cannot tell them apart.

**Maryland's poverty level credit** (Md. Code, Tax-Gen. § 10-709) is now computed, and it
is the only thing in a Maryland return that can forgive the **whole** bill. It is claimed
twice at two different rates: 5% of earned income against the state tax, and **the county's
own rate** against the county tax — 2.25% in Worcester, 3.30% in Dorchester, so the credit
is worth a different amount in each of the twenty-four jurisdictions and there is no
per-county figure stored anywhere. A single Maryland worker at `$15,000` went from
`$160.85` to **nothing**. Pass `earnedIncome`; without it both halves compute as zero and
the result says what that cost.

After both, a 437-household differential against PolicyEngine-US has **zero unexplained
differences** for the first time.

New in 0.29.0, and it is an eight-day backlog entry that was never the four booleans it
looked like: **the addition for other states' municipal interest now covers five states, and
each of them asks for a different number.** Indiana, Ohio, Virginia and Maryland all
legislate the addition Illinois has had here since 0.20.0, and it sat at the bottom of eight
consecutive plans reading like data entry — because the field recording it was a `boolean`,
and a flag can record that a state does this and cannot record what it reaches:

| state | provision | what belongs in the figure |
| --- | --- | --- |
| Illinois | 35 ILCS 5/203(a)(2)(A) | the interest, gross |
| Virginia | § 58.1-322.01(1) | the interest, **less related expenses** not deducted federally |
| Maryland | Tax-Gen. § 10-204(b), Form 502 line 1b | interest **and dividends**, less related expenses |
| Ohio | R.C. 5747.01(A)(1), Schedule of Adjustments line 1 | interest **and dividends**, gross |
| Indiana | IC 6-3-1-3.5(a)(11) | interest on obligations **acquired after 31 December 2011** |

**THE RULE: five states doing "the same thing" are five rules, and a flag that records the
thing cannot record the differences.** A bond fund's exempt-interest dividends belong in this
figure in Ohio and Maryland and in neither Virginia nor Indiana. Two of the five are net of
expenses. And Indiana's turns on a **trade date** — Income Tax Information Bulletin #19 makes
acquisition the trade date, so an Indiana resident holding an Illinois bond bought in 2010
owes Indiana nothing on it *permanently*, and the same bond bought in 2012 is taxable. No
return carries a trade date, so the engine adds back what it is given and **says so**.

The two axes are independent and all four corners are occupied: Ohio is wide and gross,
Maryland wide and net, Virginia narrow and net, Illinois narrow and gross. That is why they
are stored as two fields rather than as one list of five state codes.

**PolicyEngine-US models this addition in Illinois and in none of the other four** — its
Illinois additions list is literally `[tax_exempt_interest_income, il_schedule_m_additions]`,
and the second has no formula — so the differential grid gained four new divergences the day
this landed, each with its own bound derived from the state's own top rate. An agreement count
that falls is not by itself a sign of being less right.

New in 0.20.0: **the one place this package was too LOW.** Illinois adds back interest on
the obligations of *other* states and their municipalities — 35 ILCS 5/203(a)(2)(A) — while
exempting its own, so an Illinois bondholder owes tax on income **the federal return never
saw**, and an engine that starts at federal AGI and stops misses the whole of it. Pass
`outOfStateMunicipalInterest`; it is deliberately **not** `taxExemptInterest`, because
taking that total would tax an Illinois resident on Illinois bonds and the split exists on
no federal form. Every difference this project had found against an independent model until
now had it charging too much; this one appeared the moment the new retirement subtraction
took a retiree's base to zero and nothing else was left to be wrong about.

New in 0.19.0, and it is the second **correction rather than a feature** in two releases:
**four states that exempt most or all retirement income were taxing it** — Illinois,
Mississippi, Michigan and New York. The package documented that each needed its exclusion
netted out by the caller through `subtractions`, accepted a `retirement` split that
contained everything needed to compute it, and taxed the pension anyway. A retired couple
with a `$60,000` pension and `$40,000` of Social Security was charged `$2,588.85` in
Illinois, `$2,057.00` in Michigan and `$1,336.00` in Mississippi, where all three of those
states charge **nothing at all**, and `$2,040.80` in New York where the answer is `$154.05`.
(`$79.05` until v0.27.0, and the `$75` between them is a second correction in the same
household: this couple was being given New York's **household credit**, a relief whose
ceiling is `$32,000`, because the credit was measured on New York AGI after the `$40,000`
pension exclusion rather than on the federal AGI § 606(b) actually names.)

Four states, four different constructions, and every difference between them is worth
money:

| | age | cap | scope |
| --- | --- | --- | --- |
| **Illinois**, 35 ILCS 5/203(a)(2)(F) | none | none | each person |
| **Mississippi**, § 27-7-15(4)(k) | 59½ | none | each person |
| **New York**, Tax Law § 612(c)(3-a) | 59½ | `$20,000` | each person |
| **Michigan**, MCL 206.30(1)(f), (9) | none from 2026 | `$67,610` / `$135,220` | the **return** |

**Illinois has no age test at any point**, so a 40-year-old drawing a `$200,000` pension
pays Illinois nothing on it — the one state here an early retiree can use, and every table
that groups it with Mississippi hides that. **New York's `$20,000` is per person and
unused room is lost**, so the same `$40,000` of pension is excluded in full when a couple
split it and half taxed when one of them holds it: `$1,080` decided by whose name is on the
plan. And a federal, New York State or New York local government pension is exempt **in
full and at any age** — a retired New York City teacher on `$90,000` pays nothing where a
private-sector retiree on the same `$90,000` pays on `$70,000` of it. **Michigan's cap is
one figure for the return, keyed to the older spouse**, and it is 75% of itself for 2025
because Public Act 4 of 2023 is restoring it a quarter at a time.

**North Carolina was on the same list and does not belong there.** It taxes a pension, an
IRA distribution and a 401(k) distribution in full at 3.99%; the only things it lets go are
Social Security, the Bailey cohort and military retired pay, which is now deducted in full
here.

Also new in 0.19.0: the **Illinois child tax credit** (35 ILCS 5/244), 40% of the Illinois
earned income credit for a filer with a child under 12 — a credit that is a percentage of a
credit, so it inherits the whole of § 32's taper and takes a working Illinois parent of two to
**10.85%** on the next dollar in a state whose entire tax policy is one rate for everybody.
And Illinois's `$1,000` additional exemption at 65, which is not indexed and has not moved
since 2004.

Both corrections were found the same way: by running
[PolicyEngine-US](https://github.com/PolicyEngine/policyengine-us) over the same 437
households — see [`tools/differential`](https://github.com/LoganChu/Agent_Playground/tree/main/tools/differential).

Companion to [`us-federal-tax`](https://github.com/LoganChu/Agent_Playground/tree/main/packages/us-federal-tax) —
it takes that package's `estimateFederalTax()` result directly, but neither depends on the
other.

```bash
# Not on npm yet — and it does not have to be. Zero runtime dependencies means the
# tarball is self-contained, and npm installs one from a URL without an account.
npm i https://github.com/LoganChu/Agent_Playground/releases/download/us-state-tax-v0.38.0/us-state-tax-0.38.0.tgz
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
  Taxpayer Tax Credit phases out at 1.3 cents on the dollar underneath the tax. A retired
  couple faces **15.26%**, three and a half times the statutory rate, and the arithmetic is
  `1.85 × (4.45 + 2.5 + 1.3)`: § 86 drags 85 cents of Social Security into federal AGI
  behind each dollar of pension, Utah taxes all `$1.85` of it, and *two* credits are
  withdrawn against it at once. The rate runs **10.64% → 15.26% → 8.25%** as income rises
  and peaks at `$90,387.50` of federal AGI, so the highest-taxed next dollar in Utah
  belongs to a household in the **12%** federal bracket, not the 22% one.
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

### Georgia and Maryland use the same words for opposite rules

Both states exempt "retirement income" at 65 and both publish a number for it. The numbers are
comparable — `$65,000` in Georgia, `$41,200` in Maryland — and nothing else about the two
provisions is. Three questions decide what an exclusion is actually worth, and Georgia and
Maryland answer all three the other way round:

|                                             | Georgia § 48-7-27(a)(5)                                                                     | Maryland § 10-209(b)                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **What counts**                             | interest, dividends, capital gain, rents, royalties, alimony, pensions, **IRA distributions** | employee retirement systems only — an IRA is written out by name |
| **What is charged against it**              | nothing                                                                                       | the **whole** Social Security benefit received, taxable or not |
| **What the cap is measured on**             | the income's character — at most `$5,000` of a person's wages may enter it                     | the plan's form; wages are irrelevant          |

So the same two decisions land in opposite places, on identical figures. A single filer aged
70 with `$150,000` a year:

```text
                                     Georgia     Maryland (Montgomery)
left in the 401(k)                 $3,493.00              $8,246.00
rolled into an IRA                 $3,493.00             $11,624.83
the cost of the rollover               $0.00              $3,378.83
```

And `$120,000` of income at 70, once as pension alone and once with `$30,000` of Social
Security benefits in place of `$30,000` of pension — in two states that both say they do not
tax Social Security:

```text
                                     Georgia     Maryland (Montgomery)
$120,000 of pension                $1,996.00              $5,786.78
$94,500 of pension + $30,000 SS      $723.55              $6,144.53
the swap                          -$1,272.45                +$357.75
```

**The rule: the headline number is the least informative thing about an exclusion.** What
decides its value is which income it counts and what is charged against it, and those two
facts are never printed next to the number.

### Georgia's retirement exclusion is a test on the TYPE of income, not the amount

At most `$5,000` of one person's earned income may enter the qualifying pool — and everything
else that qualifies enters in full. So at 65 in 2026, on a single return:

```text
$65,000 of dividends       excludes $65,000      tax     $0.00
$65,000 of wages           excludes  $5,000      tax $2,245.50
```

Identical income, identical age, identical state. Georgia counts partnership and S corporation
income as *earned* for this purpose, so an active owner's distributive share is inside the
`$5,000` cap and a passive investor's dividends are not. (The `$5,000` figure has applied since
2024. Most summaries still print the `$4,000` that preceded it.)

Because net capital gain is in the pool, and the allowance is annual, per person and
use-it-or-lose-it, **Georgia's "retirement income exclusion" is also a capital gains
allowance**: a couple both 65 with no other income may realise `$130,000` of gain every year
and owe Georgia nothing on it, indefinitely. No guide to the provision says so, because of what
it is called.

### Georgia's largest exclusion is $70,000, and it falls by half at 62

Georgia has two exclusions and they are on separate worksheets, so a filer who qualifies for
both claims both. The military exclusion of § 48-7-27(a)(5.1) is `$17,500` — plus a second
`$17,500` for a veteran whose earned income **exceeds** `$17,500` — and it is available only
**below** 62. The ordinary exclusion starts *at* 62, and disability opens it at any age.

Compose them. A permanently disabled veteran with `$35,000` of military retired pay, `$40,000`
of IRA distributions and `$20,000` of wages:

```text
age 61     excludes $70,000     tax   $499.00
age 62     excludes $35,000     tax $2,245.50
age 64     excludes $35,000     tax $2,245.50
age 65     excludes $65,000     tax   $748.50
```

`$70,000` is more than the `$65,000` every table prints as Georgia's maximum, it arrives
twenty-four years earlier, and **the sixty-second birthday — the one every guide to Georgia
describes as the birthday the retirement exclusion begins — costs this filer `$1,746.50`**,
which is not recovered until 65.

The second `$17,500` is also a cliff on employment, and the largest single-dollar step in the
state. A veteran of 55 with `$40,000` of military retired pay:

```text
$17,500 of wages    excludes $17,500    tax $1,247.50
$17,501 of wages    excludes $35,000    tax   $374.30
```

`$873.20` of tax on one dollar of wages. A veteran too disabled to work cannot meet the test;
what saves them is the ordinary exclusion, which disability opens at any age. **The rule: where
a benefit is conditioned on a threshold of earnings, ask who is structurally unable to cross
it.**

### What a Georgia rate table charges a retiree

Georgia is a 4.99% flat tax with a `$15,000` standard deduction, and that is all a rate table
has. Against this package, for 2026:

```text
                                                rate table      here    over by
single 66, $55,000 of pension                    $1,996.00     $0.00  $1,996.00
single 63, $40,000 of pension                    $1,247.50     $0.00  $1,247.50
couple both 67, $90,000 of IRA + $30,000 SS      $4,491.00     $0.00  $4,491.00
couple both 65, $130,000 of capital gains        $4,990.00     $0.00  $4,990.00
veteran 45, $45,000 military pay + $25,000 wages $2,744.50   $998.00  $1,746.50
single 66, $55,000 of wages                      $1,996.00 $1,746.50    $249.50
```

Four of those six are a bill against a true zero. And the last row is the reason the exclusion
has to be modelled rather than assumed: the same `$55,000` at the same age is `$1,746.50` or
nothing depending only on where it came from.

New for 2026 and gone after 2028: HB 463 also excludes up to `$1,750` of qualified overtime and
up to `$1,750` of cash tips. The federal § 224 and § 225 deductions are below the line, so the
compensation they exempt is still inside every conforming state's base — which is why a state
that wants to follow has to legislate its own subtraction, and why Georgia's is a fourteenth
the size of the federal one.

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

## The spouse who is not on the return (v0.28.0, extended in v0.29.0)

A separate return is the one filing status whose answer turns on a person it does not
contain. **IRC § 151(b)** allows the filer an exemption for their spouse "if a separate
return is made by the taxpayer, and if the spouse, for the calendar year in which the
taxable year of the taxpayer begins, has no gross income and is not the dependent of another
taxpayer". It is the one sentence in the Code that gives a separate return something a joint
one does not, and the reason is mechanical: on a joint return both spouses are already the
taxpayer, so the clause has nothing to do.

Until v0.28.0 this package had no way to be told the fact, so it counted nobody everywhere.

**Four states reach § 151(b)'s result, by two different routes, and a fifth expressly
refuses it.**

| state | what the state's own words do | worth |
| --- | --- | --- |
| Virginia | § 58.1-322.03(1) — `$930` for each personal exemption **allowable federally** | `$930` + `$800` |
| Illinois | 35 ILCS 5/204(b) — the basic amount for each exemption allowable under § 151 | `$2,850` + `$1,000` |
| Maryland | Tax-Gen. § 10-211(a) — § 151(b)'s own sentence, copied | `$3,200`, stepped |
| Indiana | IC 6-3-1-3.5(a) — § 151(b)'s own sentence, copied | `$1,000` + `$1,000` |
| New Jersey | N.J.S.A. 54A:3-1(b) — spouse exemption **conditioned on a joint return** | nothing |

New Jersey is the useful one: it *has* the § 151(b)-shaped rule and attaches it to somebody
else — the "files no New Jersey return" condition belongs to its **domestic partner**
exemption. The shape of the federal rule is present in New Jersey law and points at a
different person, which is exactly why a state cannot inherit this answer from the Code.

```js
const separate = {
  year: 2025, filingStatus: 'marriedFilingSeparately',
  federal: { adjustedGrossIncome: 55_000, taxableIncome: 38_900,
             deduction: 16_100, deductionKind: 'standard' },
  filerAge: 68, spouseAge: 68,
};

stateIncomeTax({ state: 'VA', ...separate }).exemptions;            // 1730
stateIncomeTax({ state: 'VA', ...separate,
  spouseHasNoGrossIncomeAndIsNotADependent: true }).exemptions;     // 3460
```

### The aged half is a second claim, and it is answered three different ways (v0.29.0)

A statute that made the spouse an exemption has not thereby made the spouse an **aged**
exemption. All four states have now been read on it, and **they answer by three different
mechanisms and in two directions**:

| state | how its aged addition is written | the spouse |
| --- | --- | --- |
| Virginia | `$800` to "each blind or aged taxpayer **as defined under § 63(f)**" — § 58.1-322.03(2)(b) | **follows** |
| Indiana | `$1,000` for "each **additional amount allowable under Section 63(f)**" — IC 6-3-1-3.5(a) | **follows** |
| Illinois | `$1,000` for the spouse at 65 and `$1,000` if blind, with § 151(b)'s own two conditions attached — 35 ILCS 5/204(d) | **follows** |
| Maryland | `$1,000` "if **the individual**" is 65, and again if blind — Tax-Gen. § 10-211(b)(3), (b)(4) | **does not** |

Virginia and Indiana adopt § 63(f) by reference, and § 63(f)(1)(B) and (f)(2)(B) are exactly
the subparagraphs that reach this spouse through § 151(b). Illinois never mentions § 63(f)
and writes the spouse's two amounts out itself. **Maryland is the one worth reading twice,
because the argument is a contrast inside a single subsection**: (b)(1) is `$3,200` for "each
exemption that the individual may deduct under subsection (a)" — a count that includes this
spouse, which is why the base exemption follows — while (b)(3) and (b)(4) name *the
individual* and nobody else. A drafter who meant the spouse in (3) had (1)'s phrase two lines
above. So the same spouse is worth `$1,730` in Virginia, `$2,000` in Indiana, `$3,850` in
Illinois and `$3,200` in Maryland on otherwise identical 2025 returns — `$3,925` in Illinois
for 2026, because Illinois indexes the `$2,850` and has never indexed the `$1,000` beside it.

A caller who supplies a `spouseAge` Maryland then discards is told that **the state has been
read and the answer is no** — which is a different sentence from "nobody read it", and the
engine does not use the same one for both.

### And Indiana's means-tested `$500` is a THIRD claim, pointing the other way

Indiana's exemption subsection carries a further `$500` for a filer at 65 whose federal AGI
is under `$40,000` (`$20,000` on a separate return). It shares a subsection, a dollar sign
and an age test with the two `$1,000`s that do follow the spouse — and it is **not in their
sentence**. It references **§ 63(f)(1)** alone, so blindness never reaches it, and Indiana's
own Income Tax Information Bulletin describes this one as available to "the taxpayer **or the
taxpayer's spouse if filing a joint return**", a phrase it does not use of the `$1,000`s.

So `separateReturnSpouse.lowIncomeSenior` is its own field with its own citation, it is
`unresolved`, and the engine counts nobody for it. A single field covering "the aged
additions" would have swept the `$500` along on the credibility of the two figures somebody
actually read, which is the defect this repository learned on 2026-09-24 and keeps finding at
finer grain.

### Eleven states declare an answer, and four of the answers are "nobody read it"

`ExemptionRule.separateReturnSpouse` is **required** of every state with an exemption rule,
because the alternative is a silent default and a silent default is what kept fourteen
states counting a dead spouse for twenty-seven days. Four states are `claimed`, one is
`notClaimed`, two are `noFilerExemption` — Georgia and New York give the filer nothing, so
there is nothing for a spouse to be added to — and **four are `unresolved`**: Massachusetts,
Michigan, Mississippi and Ohio. Each carries the provision somebody has to read and what it
would be worth.

The aged half is declared the same way and is now read wherever the first half is: no state
is `unresolved` about an aged spouse while being resolved about the spouse, and a test
asserts that pairing. An aged claim that outlived its exemption claim would be the harder gap
to see, because the exemption's citation would be sitting beside it looking like evidence.

The test file proves rather than trusts. No two `claimed` states may share a citation, and
the aged claim may never reuse the exemption claim's — that is the rule this repository
learned on 2026-09-24, when one citation covered four provisions and named two. Every
`claimed` declaration is proved **reachable** by running the engine and watching the answer
move; every `noFilerExemption` declaration is proved against the `perFiler` table beside it;
and the spouse's worth is asserted against each state's own joint column rather than
restated as a number.

## A threshold is not a test: Virginia's age deduction on a separate return (v0.29.0)

Virginia gives a filer of 65 a **`$12,000` age deduction**, withdrawn a dollar a dollar above
`$50,000` of "adjusted federal adjusted gross income" — federal AGI less the Social Security
taxed inside it. The threshold is `$75,000` on a joint return, and the table in this package
has carried `$75,000` for a **separate** return since the day it was written, with a comment
calling that the one place Virginia treats filing separately more generously than filing
single.

**The comment was wrong, and it was wrong in a way a table of figures cannot express.** The
same sentence that hands a separate filer the joint threshold says what the excess is measured
on:

> For married taxpayers filing separately, the deduction shall be reduced by \$1 for every
> \$1 that the **total combined** adjusted federal adjusted gross income **of both spouses**
> exceeds \$75,000.
>
> — Va. Code § 58.1-322.03(5)(b)

The Form 760 Age Deduction Worksheet says the same in the Department's words: all married
taxpayers enter the **combined** figure, even when filing separately. It is the one line of
that form where a separate return reads the other return's income.

So a separate filer is not treated generously. They are given the **joint test whole** — the
joint figure against the joint income — and a package that reads the joint threshold against
one spouse's income gives them a larger deduction than either a single or a joint return would
allow. That is what this package did until v0.29.0: **`$690` of Virginia tax, in the filer's
favour, on a fact that is on no line of their return.**

### What changed

`ageDeduction.separateReturn` is a **required** declaration with one citation per claim, and
the income-tested deduction is **refused** rather than guessed when the figure is missing:

```js
const separate = {
  state: 'VA', year: 2026, filingStatus: 'marriedFilingSeparately',
  federal: { adjustedGrossIncome: 55_000, taxableIncome: 38_900,
             deduction: 16_100, deductionKind: 'standard' },
  filerAge: 68, spouseAge: 68,
};

stateIncomeTax(separate).tax;                                          // 2302.40 — and a note
stateIncomeTax({ ...separate,
  spouseAdjustedFederalAdjustedGrossIncome: 0 }).tax;                  // 1612.40
stateIncomeTax({ ...separate,
  spouseAdjustedFederalAdjustedGrossIncome: 40_000 }).tax;             // 2302.40 — withdrawn
```

The refusal is scoped to exactly the half that needs the number: subdivision (a)'s untested
`$12,000`, for a filer born before 1 January 1939, has no income test to fail and is
unaffected. Refusing the tested half and keeping the untested one is the difference between a
gap and a guess.

### And a third claim: both spouses claiming share one excess

Where **both** spouses claim an income-tested deduction, the worksheet computes a *joint*
deduction — two `$12,000`s against the one combined income test — and allocates half to each
spouse. On a joint return the halves sum back to the same figure. On two separate returns each
return carries one of them, and the shared excess costs this filer half of what their own
amount tested alone would: `(2a − e) / 2 = a − e / 2`. It is worth **more** to the filer than
their own tested amount, so it takes an explicit `spouseClaimsAgeDeduction: true` and defaults
to the answer that does not flatter.

### The case was already in the test suite

This is the part worth keeping. `test/separate-return-spouse.test.js` has run a Virginia
separate filer of 68 with `$55,000` since the day it was written — straight through the defect
— and asserts that claiming the § 151(b) spouse is worth `$99.47`. **It is `$99.47` with the
age deduction at `$12,000` and `$99.47` with it at `$0`**, because the deduction is a term on
both sides of the subtraction.

**THE RULE: an assertion on a DIFFERENCE is blind to every term the difference cancels.** The
missing case was not a household; it was a *level*. `test/virginia-age-deduction.test.js` pins
both, on the same household, and the pair is checked against each other.

## A widow is one person, in fourteen more places (v0.27.0)

A **qualifying surviving spouse** is an unmarried filer with a dependent child, for the two
years *after* the year a spouse died — the year of death itself is a joint return. § 2(a)
hands the status the joint **rate schedule** and nothing else.

v0.23.0 gave her one per-person exemption. v0.24.0 gave her one blind allowance and one
senior allowance. Both were written as "the exemption was wrong", and the mistake was never
in an exemption: it was in a helper called `filerCount()` that answered *how many people are
on this return* with a fact about **which column of a form the status sits in**. Those are
different questions, they have different answers, and thirteen call sites were asking the
first and reading the second. The helper is now named `claimedFilerCount()` for the question
it can answer, it has exactly two callers left, and a test fails if a third appears.

| | what it did | what it does | worth |
| --- | --- | --- | --- |
| **Pennsylvania** tax forgiveness | the `$13,000` MARRIED allowance | `$6,500` unmarried | **`$614.00`** — her whole PA tax |
| **Virginia** Credit for Low Income Individuals | `$300` × 2 filers | × 1 | **`$639.50`** with the guideline below |
| **Virginia** age deduction | `$12,000` for a dead spouse | one filer's | **`$591.80`** |
| **Georgia** military retired pay | two `$17,500` exclusions | one | **`$873.25`** |
| **Maryland** poverty level credit | a 3-person poverty guideline | 2-person | **`$465.25`** — her whole MD tax |
| **Massachusetts** FICA deduction | capped at `$4,000` | `$2,000` | **`$100.00`** |
| **Utah** retirement credit | `$450` + `$450` | `$450` | **`$450.00`** of credit |
| **New York** + **New York City** household credits | a 2-adult household | 1 | **`$20.00`** |
| **Michigan's** 24 cities | two `$600` exemptions | one | **`$14.40`** in Detroit |
| the retirement split, Maryland's and Georgia's per-person exclusions | read `retirement.spouse` | ignore it | varies |

Three of them are states that **do not have the status at all**. Pennsylvania's Schedule SP
has three claimant boxes — unmarried, separated, married — and its own guide puts "divorced
or widowed and unmarried at the end of the taxable year" in the first. Massachusetts Form 1
offers single, married filing jointly, married filing separately and head of household.
Michigan's MI-1040 offers the first three. Virginia's instructions say it in a sentence:
*"Filing Status 1 (Single) should be used if you claimed one of the following federal filing
statuses … Single, Head of Household, or Qualifying Widow(er)/Qualifying Surviving Spouse."*

Pennsylvania is the largest because of the *shape* of its rule rather than the size of the
figure. The allowance is not a deduction; it is where 100% forgiveness of the **whole** tax
begins stepping down, ten percentage points per `$250` of eligibility income. Moving it
`$6,500` to the right moved the entire staircase, and a widow `$4,000` past her real
allowance was being forgiven everything.

Maryland's is the one the statute settles in words. Md. Code, Tax-Gen. § 10-709(a)(3):
*"an individual, or an individual and the individual's spouse **if they file a joint income
tax return**"*. And a poverty guideline one person too large runs the wrong way twice — it
admits filers whose income is above the real cliff, **and** it raises the earned-income
ceiling § 10-709(a)(3)(ii) tests them against.

Every one of the fourteen needed a caller who supplied a `spouseAge`, or a
`retirement.spouse`, or who simply filed this status in a state that does not have it —
which is exactly what a caller who believes the status means two filers would do. So a
result now **says** when it has dropped one:

```js
stateIncomeTax({ state: 'VA', year: 2026, filingStatus: 'qualifyingSurvivingSpouse',
                 federal: { adjustedGrossIncome: 40_000 }, filerAge: 70, spouseAge: 70 })
  .notes.at(-1);
// "Filing status is qualifyingSurvivingSpouse, which is a ONE-PERSON return … so
//  spouseAge describes nobody and was ignored here. … If the figure belongs to the
//  surviving filer (a survivor annuity, for instance, which is the survivor's own
//  income), pass it under `retirement.filer`."
```

Dropping the field errs towards **more** tax in every one of the fourteen, which is why it
is safe to do silently and still worth not doing silently.

### The same helper was wrong about a second status, in the opposite direction

PA-40 Schedule SP has three claimant boxes — *unmarried*, *separated*, *married* — and they
do not line up with filing statuses in either direction. One helper was mapping five
statuses onto three boxes and got **two** wrong, one each way:

| | got | should get |
| --- | --- | --- |
| qualifying surviving spouse | married, `$13,000` | unmarried, `$6,500` |
| married filing **separately** | unmarried, `$6,500` | married, `$13,000` |

There is no separate-return table. Pennsylvania's guide: *"married claimants are not
dependents of one another for Tax Forgiveness purposes, even when one spouse does not have
any Eligibility Income. Each must use the Joint Eligibility Income and Eligibility Income
Table 2."* So the allowance doubles **and** the income is both spouses' — and taking one
without the other is worse than taking neither, because a `$13,000` allowance against one
spouse's income forgives a two-earner couple twice over.

The spouse's eligibility income is on no line of a separate return, so the engine asks:

```js
const separate = { state: 'PA', year: 2026, filingStatus: 'marriedFilingSeparately',
                   wages: 20_000, pennsylvaniaTaxableIncome: 20_000, dependents: 1,
                   dependentAges: [10], federal: { adjustedGrossIncome: 20_000 } };

stateIncomeTax(separate).totalTax;                                   // 614.00
stateIncomeTax({ ...separate, pennsylvaniaSpouseEligibilityIncome: 0 }).totalTax;      // 0.00
stateIncomeTax({ ...separate, pennsylvaniaSpouseEligibilityIncome: 10_000 }).totalTax; // 614.00
stateIncomeTax({ ...separate, separatedFromSpouse: true }).totalTax;                   // 614.00
```

Unanswered, the return keeps the smaller allowance — **too much tax**, which is the safe
direction — and the result says so and prices it. `0` is a real answer and is the right one
for a spouse with no income. And a claimant who is *separated* — living apart at all times
during the last six months, or under a written agreement — ticks the Unmarried oval on line
19a and genuinely is one claimant on their own income, whatever the spouse figure says.

## Provisional figures are labelled, and now say what would settle them

Most state parameters are indexed for inflation and published late in the tax year. Six of
the 2026 state-years here have at least one figure carried forward from 2025 because the
state had not released it. Every one of them says so, in the result:

```js
const ca2026 = stateIncomeTax({ state: 'CA', year: 2026, filingStatus: 'single', federal });
ca2026.provisional;  // true
ca2026.notes[0];     // 'PROVISIONAL: the 2026 bracket thresholds, standard deduction ...'
```

Provisional for 2026: **CA, CO, ID, MI, MO, OH, OR, UT**. Published: **AZ, GA, IL, IN, KY, MA, MD,
MS, NC, NJ, NY, PA, VA** and the nine states with no income tax. Nothing is provisional for
2025.

Oregon joined that list on Day 42 for **two figures out of forty-odd**, which is the
narrowest the flag has ever been: the Oregon Kids Credit amount and its phase-out
threshold, both indexed and both published in the January after the tax year. The rest
of Oregon's 2026 is published, because the Department of Revenue's 2026 withholding
formula — out on 31 December 2025 — carries the brackets, the standard deduction, the
federal tax subtraction ceiling and its whole phase-out table. **An agency does not
publish a withholding formula for a figure it has not settled**, which is the single
most useful sourcing fact this package has found, and it is why `provisionalFigures`
matters more than the per-state flag.

**The counts changed in v0.33.0 and the states did not.** 103 figures are carried forward
across those six state-years, against 148 before: Idaho gained four and Ohio twelve, where
the flag had named one filing status of five, and California lost 60, where it had named
five subtrees and swept the statutory rates in with the indexed thresholds. See *Where
every figure came from* below for both halves of that.

**Three have come off that list: Illinois in v0.25.0, Kentucky and Maryland in v0.26.0.**
Illinois's 2026 exemption allowance is `$2,925` from the `$2,850` of 2025. Kentucky's 2026
standard deduction is `$3,360` from `$3,270` — announced by the Department of Revenue and
carried in the 2026 withholding formula, and worth `$3.15` a filer at the 3.5% rate.
Maryland's is `$3,350`, **unchanged**, confirmed by the Comptroller's own 2026 withholding
guide and Form MW507 and by the fiscal note on a 2026 bill to raise it that died in
committee. Michigan's personal exemption went `$5,800` to `$5,900`, `$4.25` per exemption
on every Michigan return.

### The flag is per figure, because a state-year is rarely provisional as a whole

A `provisional` state-year lists exactly which figures are not from a published source, and
what would settle each one:

```js
getStateDefinition('MI', 2026).provisionalFigures;
// [{ path: 'exemption.perBlindOrDisabledFiler',
//    reason: 'awaiting-publication',
//    carriedForwardFrom: 2025,
//    resolvedBy: 'the 2026 MI-1040 instructions (line 9), published in January 2027 ...' }]
```

Michigan is the case that forced it. Its **personal** exemption is published for 2026 — the
state's withholding guide carries it, because withholding needs it — and its **special**
exemption for a blind or disabled filer is not, because that one appears on the MI-1040 and
on no withholding document. One enum on the state-year cannot say that, and the prose note
that used to say it could not be checked by anything.

Three assertions keep the list honest, in `test/provisional.test.js`: every path must
resolve, so the list cannot rot; a figure marked `carriedForwardFrom: 2025` must still
**equal** the 2025 value, so a figure cannot be quietly resolved while the warning about it
stays up; and `resolvedBy` must name a document rather than a government.

### Two kinds, and only one of them is a debt

`reason` distinguishes them, and the distinction changes what a reader should do:

| reason | meaning | what to do |
| --- | --- | --- |
| `awaiting-publication` | the state will publish it, on a calendar | go and read the named document |
| `determined-after-year-end` | the **law** does not fix it until the year closes | nothing, until then |

**Colorado is the second kind and nothing can move it.** Its 4.40% rate is the statutory
figure that a TABOR surplus calculation can cut for a single year — that produced 4.25% for
2024 — and the calculation runs *after* tax year 2026 ends. So the rate here is an **upper
bound** and the 25% earned income credit match is a **floor**: a Colorado 2026 return
computed by this package is the most tax and the least credit Colorado can ask for. Filing
against it in 2027 means recomputing.

The other five are debts with due dates, and four of the dates are in **January 2027** —
Utah's TC-40 instructions, Ohio's IT 1040 booklet, Michigan's MI-1040 instructions and the
Franchise Tax Board's 2026 release. Only Idaho's rate schedule could plausibly land sooner.

Ohio is provisional for its exemption chart and **not** for its rate schedule, which was
flagged until v0.26.0 and should not have been: HB 96 wrote "$332.00 plus 2.75% of the
amount in excess of $26,050" into § 5747.02(A)(3), so the `$26,050` band is statutory for
2026 and the `$332.00` constant is pinned to it. Reading the Revised Code for the exemption
chart is a trap worth naming: § 5747.025(A) prints `$2,350 / $2,100 / $1,850`, which are
the **2015 base amounts** the GDP-deflator indexing of § 5747.025(B) runs on, not the
`$2,400 / $2,150 / $1,900` actually in force.

California is deliberately **not** resolved. Several sources report a 2026 California
standard deduction of `$5,706 / $11,412` — which is this package's **2025** figure — while
giving an exemption credit of `$158 / $316` against 2025's `$153 / $306`. California indexes
both by the same CCPI factor, so a source that moves one and not the other has stitched a
fresh number onto a stale one. Never commit a tax figure that only one source supports.

New York is published for both years because it indexes nothing: its brackets, standard
deduction and dependent exemption are all fixed in statute. Massachusetts is published for
the same reason with one exception, and the exception has already been certified: the 4%
surtax threshold is the only indexed figure in the whole Massachusetts computation, and
the Department of Revenue has published `$1,107,750` for 2026 against `$1,083,150` for
2025. So the entire year-over-year change in Massachusetts income tax is `$984` — 4% of
the `$24,600` the threshold moved — and it is owed by nobody below a million dollars.

## No fallback to a neighbouring year

Eight of the twenty taxing states cut their rate between 2025 and 2026 — New York's
bottom five brackets (FY2026 enacted budget), Georgia
5.19% → 4.99%, Indiana 3.00% → 2.95%, Kentucky 4.00% → 3.50%, Mississippi 4.4% → 4.0%,
North Carolina 4.25% → 3.99%, Utah 4.5% → 4.45%, and Ohio, which abolished its 3.125%
bracket outright and re-based the constant beneath it from `$342.00` to `$332.00`. Asking
for an unsupported year throws rather than answering with the nearest one.

## Every filing status, priced, and a proof that the pins are load-bearing (v0.31.0)

The package's own mutation audit — `tools/mutation/mutate.mjs`, which sets one number
in the build wrong and runs the suite — reported that its largest blind spot was a
**filing status** and not a rule. `separate` and `headOfHousehold` cells, in nine
states at once: California's exemption credit and renter's credit, Maryland's senior
credit and poverty limit, Ohio's business-income limit, three Utah credit tables, New
Jersey's retirement exclusion, New York's standard deduction.

Those two statuses carry their own numbers in nearly every state here, and they are
the two a test author reaches for last. Massachusetts proves it is about attention
rather than about the statuses: there the *separate* cell is the tested one and the
other three are not.

`test/status-sweep.test.js` removes the choice. 26 frozen households run under **all
five statuses** in all 20 taxing state-years, and 5,200 answers are pinned. Beside it
is the test that makes those pins mean something: it takes every `byStatus` table the
package ships, sets a cell wrong, and fails unless a pinned answer moves.

**A fixture of expected values and a proof that the values are sensitive are two
different tests, and only the second one is about coverage.** 5,200 rows that all
happened to be zero would pass every day and guard nothing.

Connecticut added four of the twenty-six households, and three of the four are not
about Connecticut. Its recapture's top tier climbs `$80` per `$8,000` from `$800,000`
for a head of household and stops after nine steps, so the tier's step size is only
visible inside a `$72,000` band — and the battery's doubling ladder jumped from
`$540,000` to `$1,400,000` with nothing in between. **The gap was a missing rung, not
a missing state**, and it had been there since the battery was written. The fourth is
a retired couple for whom Social Security is the *majority* of the income: every other
retiree in the battery has benefits that are a minority of a larger income, and that
one-sided shape hid a whole branch of Connecticut's § 86 arithmetic.

What that buys a caller is narrow and worth stating exactly: **no parameter that
differs by filing status can change in this package without a test failing.** It is
not a claim that the parameters are right — the statute citation on each figure and
the 779-household differential against an independently built model are what speak to
that, and neither is affected by this file.

### Why 22 households and not five hundred

Because the size of the battery is arithmetic. A mutation sets a parameter `P` to
`2P + 1`, so a household only notices `P` if its income lands in `(P, 2P + 1]`. A
geometric ladder with ratio 2 catches every threshold it spans: if `pᵢ ≤ P < pᵢ₊₁`
then `pᵢ₊₁ > P` and `pᵢ₊₁ = 2pᵢ ≤ 2P`. **The number of households a suite needs is
logarithmic in the range of incomes the law covers, not linear in the number of
parameters** — ten rungs from `$3,000` to `$1,600,000`, run separately in wages, in a
family with dependents and in a retirement, because a threshold on pension income is
not reached by a wage.

### An unknown `retirement` field is now an error

Building the battery found a fourth kind of defect, and the worst of the four for a
caller. `retirement: { filer: { pension: 28_000 } }` type-checks as an error and did
nothing at run time: the key was dropped, the person was left with no retirement
income, and every exclusion and credit that reads one came back as if the retiree had
none. For a Maryland retiree that moves up to `$41,200` into the taxable base and
returns a plausible number.

TypeScript catches it and nothing else did, which is no help to the callers who
matter most — an MCP server receives its input as JSON from a language model, and a
model writing `pension` for a pension is the most likely input error this package
will ever see. It is now a `RangeError` that names the nearest real field:

```
retirement.filer.pension is not a field of PersonRetirementIncome.
Did you mean `employerPlanPension` or `governmentPension`?
```

And a check at this boundary turned out not to reach that caller at all. `us-tax-mcp`
builds the person object from its own list of field reads, so an unknown key produced
an empty person and never arrived here — the guard could not have fired for the callers
it was written for. **A check at the inner boundary is not a check at the outer one**,
and every layer that copies fields by name needs its own. `us-tax-mcp` v0.34.0 rejects
it there too, from this package's exported `PERSON_RETIREMENT_FIELDS` rather than from a
third copy of the names.


`FederalBasis` and the top-level input are deliberately left open — the first is
documented as a structural subset of `us-federal-tax`'s result, so extra keys are
part of the contract. The difference is whether a superset is expected.

## Every step of every staircase, probed (v0.32.0)

The sweep above closed the `byStatus` cells and left ten numbers the audit could
still have shipped wrong. All ten were rows of a **staircase** — Ohio's retirement
income credit pays a different amount in each of six bands of pension income, and
five of the six were untested — and no bigger battery of households would have
reached them.

**A battery of households is a ladder in one dimension of a return; a staircase is a
second ladder inside one rule.** Ohio's steps sit between `$500` and `$8,000` of
pension, and the shared battery's rungs are `$3,000`, `$6,000`, `$12,000` and up,
because they also have to reach a millionaire. Catching this one credit with
households costs five more of them in every state's run, and then five more for New
York's household credit, and five more for New Jersey's child credit.

**THE RULE: a chart of steps needs a probe inside each step, not a household for
each step.** `test/step-probes.test.js` is that instrument. It finds every staircase
in the package by SHAPE rather than by a list of field names, puts one frozen probe
inside every step of every one, and pins the return each probe produces.

The probes sit against each step's FLOOR, at `upTo[i-1] + 1`, and the placement is
the point: a mutation doubles a ceiling, so a probe just above the old ceiling falls
back into the step below it and the pinned answer moves. A probe in the middle of a
wide step survives the same mutation — `$1,500` doubled is `$3,001`, and a probe at
`$2,250` is still inside the step it started in.

Beside it is the same companion the sweep has. It takes **every number in every
staircase the package ships** — 1,497 of them, ceilings, floors, amounts, fractions
and age bounds alike — sets each one wrong, and fails unless a pinned answer moves.
Four rows are exempt, each with a written reason and a direct assertion in their
place:

- Ohio's 20% joint-filing-credit row, which is arithmetic no return can reach: it
  applies below `$25,000` and Ohio charges nothing until `$26,050`, so 20% of the
  remaining tax is 20% of zero.
- Ohio's zero band's base amount, because **a doubling mutation cannot perturb a zero
  by more than a dollar**, and a dollar of Ohio tax is absorbed by the `$20`
  nonrefundable exemption credit every return inside the band carries.
- The first row of Connecticut's pension phase-out, which is the same arithmetic
  from the other direction: the row begins at `$0`, and the only return a mutation
  to `$1` could move is one with under a dollar of federal AGI.

And the instrument's own vocabulary was the thing Connecticut found. A staircase was
an array whose rows carry `upTo`, `maxAge` or `minAge` — **ceilings only** — and
Connecticut writes both of its charts as floors, because § 12-703 and Public Act
23-204 both print "the row that begins here". So eight charts and 254 numbers were
neither probed nor claimed, and this file reported a clean sweep over them.
**A shape-based finder is only as broad as its vocabulary of shapes, and a
vocabulary is a list of names** — Day 34's rule, in the one place the package had
built a mechanism specifically to avoid it. The tell was not in this file: it was a
count that went up by 104 when a state arrived carrying 254 more.

### The notes are pinned too, and they are what this package sells

"State limitations loudly" is this package's own claim, and the notes in the result
object are where it is made — in the object a language model reads, rather than in a
README it never sees. **Nothing asserted them.** A note written for 2026 could have
appeared on a 2025 return, or vanished from 2026, and the suite would have been
green.

`test/notes.test.js` pins the first 72 characters of all **630** notes every
state-year emits, in order. Not the whole note, because the prose is edited and a
fixture that churned would stop being read; what the prefix catches is a note
appearing, vanishing, moving or swapping years. Beside it is a hand-written table of
exactly which notes 2026 has that 2025 does not — twelve states, seventeen notes, each
a statement about the law a reader can check — because **a year branch is a selector,
and a selector is caught by an assertion on the relation between its branches, not by
a household sitting between them.**

The same rule closed two more of the audit's survivors. Michigan's tier-one
retirement deduction is gated on being born before 1946, which is a closed cohort, so
its minimum age is exactly `year - 1945` and is asserted as that relation rather than
as two numbers. The federal poverty guideline that Virginia and Maryland both read is
asserted per branch, per state, with its own `year` label — the two states read one
federal table, so a branch that swapped in one of them would make the two disagree,
and a disagreement is checkable without knowing which is right.

And a rule's `name` is now checked against the rule. A name travels in the result
object — `"Michigan retirement and pension benefits deduction (phased in, 75% for
2025)"` — so a percentage or a dollar figure printed in one is a claim a caller
reads, and all 17 of them are now required to equal a figure the rule actually holds.

## Where every figure came from, and why it did not move (v0.33.0)

Every figure here was already cited to a statute or a state release. What nothing said
was **which document any one figure came from**. Today the ledger covers 4,286 numeric
figures over 66 state-years, against 398 citations; when it was written there was no
mapping between the two at all. **A list of sources beside a list of figures
is not provenance. The mapping is the provenance, and it is the part nobody writes
down.**

The mapping's absence was hiding a bigger question than a missing citation. Comparing
the two tax years this package ships:

```text
measured over commit c85e8aa, which is 28 states and the tree before the ledger
numeric figures over 56 state-years                       2,293
figures identical in 2025 and 2026, unbounded excluded      949
  flagged as carried forward                                148
  explained by nothing at all                                801
```

Each of those 801 is one of two unrelated things. Either the law fixes the figure — New
Jersey's brackets have stood since 2020, Virginia's rate schedule since 1990, New York
indexes nothing at all — in which case 2026 equals 2025 *because the statute says so*.
Or nobody read the 2026 document, in which case it is a silent carry-forward: the exact
failure this package took nineteen days to notice in Illinois.

**THE RULE: a figure that did not move is a claim, and "it did not move" is not the
evidence for it.**

`STATE_FIGURE_PROVENANCE` maps every figure to a document and a kind of authority, and
`test/provenance.test.js` checks the *claims* rather than the figures:

| assertion | what it catches |
| --- | --- |
| coverage, both ways | a figure no entry claims, and an entry no figure needs |
| `constant`, both ways | an entry claiming constancy whose figures moved, **and one claiming movement whose figures did not** — which is the shape of a silent carry-forward |
| an `indexed` figure that has not moved | must carry a written reason. Six do |
| `document` | must be a substring of a citation the state-year **already carries**. The ledger maps figures to evidence this package has; it may not invent evidence |
| `carried-forward` | must agree with `provisionalFigures`, in both directions |

The one Maryland entry is why the whole file is worth having. Maryland is `published`
for both years with no provisional figure, and 199 of its 204 figures are identical —
which is precisely what a silent carry-forward looks like. It is not one. The brackets
and exemptions are fixed in Tax-General, and the one indexed figure, the standard
deduction, **was read for 2026 and found not to have moved**: three Maryland documents
say `$3,350`, two of them the state telling its own employers what to withhold. Without
that sentence in the data, a reader cannot tell Maryland from a defect.

### What a new tax year costs, derived rather than remembered

The `kind` field answers one operational question. Over the 2,143 figures of tax year
2026:

| for a new tax year | figures |
| --- | --- |
| nothing at all (`statute`, `derived`, `sentinel`) | **1,765** |
| the statute's own schedule (`statute-scheduled`) | **113** |
| a release read (`indexed`, `agency`, `carried-forward`, `determined-after-year-end`) | **258** |
| nothing to the state, everything to whoever tracks the federal figure (`federal-conformity`) | **7** |

Those four numbers are now pinned by `test/provenance.test.js` rather than quoted.
Adding Connecticut falsified every live number in this section at once, and nothing
failed: `readme.test.js` has pinned the quick-start figures, the staircase counts and
the note counts since Day 8, and the provenance section's own totals were the set it
never covered. **A README test that covers most of a README teaches a reader that the
whole of it is covered.**

```js
import { newYearCost, stateFigureProvenance, getStateDefinition } from 'us-state-tax';

const ca = getStateDefinition('CA', 2026);
stateFigureProvenance(ca, 'CA', 2026, 'rate.byStatus.single.4.rate').kind;
// 'statute'          — § 17041 prints it; no indexing provision moves it
stateFigureProvenance(ca, 'CA', 2026, 'rate.byStatus.single.4.upTo').kind;
// 'carried-forward'  — the 2025 threshold, standing in
```

That is the split worth knowing about California: **the rate is certain and the
threshold it applies to is last year's.** New York needs no release at all for 2027 —
204 figures, every one fixed in the Tax Law — and nor do New Jersey, Georgia, Indiana,
Mississippi, North Carolina, Pennsylvania or Arizona. Michigan needs 17 of its 22.

### Both ways of getting a provisional flag wrong

Building the ledger found two defects in the flag it was measuring, and they are mirror
images of each other.

**Idaho and Ohio under-reported, by four fifths.** Idaho's 2026 zero bracket is one
indexed amount applied at `$4,811` for single and separate filers and twice that for the
three doubled statuses. The ledger named `rate.byStatus.single.0.upTo` and stopped. Ohio
was worse: three indexed exemption amounts, identical in all five columns because Ohio's
exemption does not vary by filing status, flagged in the `single` column alone — three of
fifteen. A caller inspecting `provisionalFigures` to decide which numbers to check was
told about a fifth of them.

**California over-reported, by 60 figures.** It flagged five whole *subtrees* —
deliberately, so the non-vacuity check would reach every leaf — and in doing so told
every caller that California's 45 statutory rates were provisional, three lines above a
note saying the rates "are statutory and are correct". Over-reporting is not the harmless
direction: the rate is the one California figure a caller can rely on completely, and a
flag saying otherwise spends the credibility that makes the other 76 worth reading.

**THE RULE: a provisional entry written as a SUBTREE over-reports by everything in the
subtree the state did publish, exactly as one written as a LEAF under-reports by every
sibling.** Both come from a path written by hand from the figure the author happened to
be looking at. Both are fixed by generating the list from the shape of the data, which
all three states now do — and `test/provisional-coverage.test.js` fails on a flag that
stops at one filing status, so the class cannot come back.

The one missing citation the ledger found is worth stating for its size: **one, not
forty-one.** The federal package's equivalent audit found 41 documents missing across
three tax years, because a citation list kept *per year* is three chances to forget the
same statute. A state's citations are kept per state **and** per year, so that failure
cannot happen here, and the only gap was the HHS poverty guidelines behind Maryland's
poverty level credit — which Virginia, with the same cliff, had cited all along.

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

State tax is deep and this is version 0.38.0. Stated loudly, because a tax library that
hides its gaps is worse than useless:

- **Only 32 states.** No Minnesota, Wisconsin,
  South Carolina, Louisiana, Oklahoma, Iowa, or the District of Columbia.
  Asking for one throws rather than returning zero, and the message is built from a
  declared list of the uncovered jurisdictions rather than from a sentence — because
  the sentence named Connecticut as uncovered on the day Connecticut shipped.
- **Alabama's municipal occupational licence taxes are not modelled.** Birmingham
  charges 1% of gross wages, Gadsden 2%, and about two dozen more something between —
  on gross compensation, with no deduction and no reference to the return. They are
  not in the locality registry yet, so an Alabama city worker is too low by the whole
  of it.
- **Alabama's 2025 half-year overtime exclusion is not modelled**, because the figure
  it needs — overtime paid before 30 June 2025 — is in the payroll records and not on
  the return. Supply it through `subtractions`; the note says so.
- **Connecticut's property tax credit, alternative minimum tax, teachers' retirement
  subtraction, military retirement subtraction and credit for taxes paid to other
  jurisdictions are not modelled**, and nor are the 2026 farm investment credit and
  family childcare home credit. The notes say so. Above the Social Security threshold
  the § 86 combined income excess is reconstructed from federal AGI and the benefit
  figures, which cannot see federally tax-exempt interest the caller did not pass —
  a conditional note says so on exactly the returns it can reach.
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
  Youth Tax Credit, the Arizona dependent credit, the North Carolina child deduction, and
  the Utah child tax credit — whose thresholds HB 290 (2026) raised to `$49,000` single and
  `$61,000` joint and which is withdrawn at **ten cents on the dollar**, so a Utah family
  inside that band faces about 14% against a headline 4.45%. A family return outside New
  York and California will be **too high**. **A Utah retiree return no longer is:** the
  retirement credit (code 18), the Social Security benefits credit (code AH) and the
  military retirement credit (code AJ) all landed in v0.17.0, with the § 59-10-1019(5)
  election between them.
- **Georgia's exclusions need `retirement`, and say so when they do not get it.** The
  exclusion is measured on the character of the income, which a federal AGI does not
  record, so a Georgia return that supplies only an age gets no exclusion — and a note on
  that return prices what the omitted field is worth on those very figures.
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

## Three contracts, three answers to an unknown key (v0.34.0)

`StateIncomeTaxInput` has 52 fields and several of them are the difference between
a right answer and a plausible one. Until v0.34.0 a key this engine did not
recognise was dropped in silence — which is how `wages` for `w2Wages` produced a
$0 federal tax bill on the first call ever made against the companion package, and
how `stateSubtractions` for `subtractions` lived inside this package's own test
suite long enough to turn a regression test into one that could not fail on the
bug it guards.

An unrecognised key now says so, and the engine gives three different answers
because the three places have three different contracts:

```js
stateIncomeTax({ state: 'OH', year: 2026, filingStatus: 'single',
                 federal: { adjustedGrossIncome: 60_000 },
                 subtractons: 40_000 }).notes[0];
// 'Ignored unknown input: `subtractons` is not a field of StateIncomeTaxInput. An
//  unrecognised key is dropped, so every figure in the result is computed as if
//  it had not been supplied. Did you mean `subtractions`?'
```

| where | answer | why |
| --- | --- | --- |
| **the top level** | a note in `result.notes` | a caller's own object may reasonably carry their bookkeeping, so a throw would break an upgrade — but a dropped figure must not be silent |
| **`input.retirement`** | a `RangeError`, always | its field names are documented as exhaustive, and an unknown key there leaves a retiree with no pension and every exclusion computed as if they had none |
| **`input.federal`** | nothing at all | it is documented as a structural subset of `estimateFederalTax()`'s whole result, so every extra key on it is expected |

The note is unconditional and `strict: true` escalates it to a throw:

```js
stateIncomeTax(input, { strict: true }); // RangeError: `subtractons` is not a field of …
```

That default is a correction rather than a preference. Four days of worklists
specified this as opt-in strictness, and an opt-in guard protects exactly the
people who did not need it: the caller who gets a field name wrong is the caller
who does not know the field name, and they do not know to ask for strict either.

A test suite is the one caller that does know, and this one asks for the throw
from all **721 tests**. Turning it on, when there were 618 of them, is what
measured the cost of not having
it: **109 tests were passing a key this engine does not read**, through fourteen
household helpers that each spread their own option bag into the input. None of
them changed an answer — they were all helper options with no field to land on —
but two real defects were living in the pattern, and one of them was a regression
test that had stopped being able to fail.

Also exported: `KNOWN_STATE_INPUT_FIELDS` (every field name, proved against the
interface by the compiler), `nearestFields(key, known)` and
`unknownInputKeys(input, known)`.

## API

```ts
stateIncomeTax(input: StateIncomeTaxInput, options?: StateIncomeTaxOptions): StateIncomeTaxResult
```

`options.strict` throws on an input key this engine does not read instead of
reporting it in `result.notes` — see **Three contracts, three answers to an
unknown key** above. It defaults to off.

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
