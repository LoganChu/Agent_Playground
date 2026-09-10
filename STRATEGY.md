# Strategy

The goal is revenue. This document records *why* the current bet was chosen, so a
future run can either build on it or kill it deliberately rather than by drift.

Last reviewed: 2026-09-10 (Day 16). No change of direction. Day 15's first
priority was executed: **Ohio, and all 679 of its municipal income taxes**.
`packages/us-state-tax` is v0.11.0 and `packages/us-tax-mcp` is v0.13.0.
**672 tests.**

**Day 16 is the largest single expansion this repo has had, and it is the
per-jurisdiction bet paying at a scale the per-state bet cannot reach.** Ohio's
679 municipalities are more taxing jurisdictions than the rest of the United
States put together, and they arrive against a total of 140 local income taxes
built over the previous fifteen days. Local coverage is now **819**. The
argument for building shapes rather than states, made on Day 14, is now
quantified: Michigan's `cityIncome` machinery took a day for 24 cities, and
Ohio's 679 reused the whole of it — the only genuinely new pieces were a base
(`qualifyingWages`) and a credit policy.

For most Ohio filers the municipal tax is **the larger of the two**. A Columbus
resident on `$60,000` owes Ohio `$1,216.50` and Columbus `$1,500.00`, and the
state tax does not overtake a 2.5% municipal one until `$126,408.32` of income.
A table of state rates has described the smaller half of the bill for the
majority of a state of 11.8 million people.

**Ohio also breaks the shape of a rate table outright, which is the strongest
form of this project's thesis so far.** O.R.C. § 5747.02(A)(3) charges 0% on the
first `$26,050` and then a flat constant **plus** 2.75% of the excess, and the
constant arrives whole on the first dollar of the band: `$0` at `$26,050` and
`$342.00` one cent later. Massachusetts needed a table with more than one row per
state; Ohio needs a table whose cells are not rates. `applyBrackets` cannot
express it, which is why `baseAmountSchedule` is a new rule and not three rows in
the old one — and a marginal walk of the printed table, which is what "Ohio: 0% /
2.75% / 3.125%" invites, understates every Ohio filer above the threshold by the
whole constant.

The schedule steps a **second** time, by `$18.69` at `$100,000`, and that step is
three months old: HB 96 re-based the lower constant from `$360.69` to `$342.00`
for 2025 and left the upper one at `$2,394.32`, which is exactly what `$360.69`
chained to. Nobody's summary of the rate cut mentions it, because every summary
is about the rate.

The competitive read is the sharpest yet, and it repeats Michigan's pattern of
two errors in opposite directions. `statetakehome-mcp`'s Ohio record has two
marginal brackets, **no base amount** and **no personal exemption**:

```text
single, $60,000, 2026        theirs   $933.63
                             Ohio   $1,206.50    short by 22.6% of the state tax
                             + Columbus $1,500.00
                             total  $2,706.50    short by 65.5% of the whole bill
```

`verify_2026: true` is on this record too — a **fourth** state carrying their own
published to-do flag — and their Ohio has no 2025 schedule at all.

Six rules out of Day 16:

- **When a statute is amended by changing numbers inside a table, check whether
  the numbers still agree with each other.** An amendment that re-bases one
  constant and not the one derived from it leaves a discontinuity no summary of
  the change will mention.
- **A credit with an income ceiling and a tax with an income floor may not
  overlap.** Two Ohio credits are dead law and the arithmetic is one subtraction:
  the `$20` exemption credit needs modified AGI under `$30,000` while a filer
  needs taxable income over `$26,050` before there is any tax to credit, so with
  `$2,400` an exemption it is claimable only by a filer with **one** exemption in
  a `$1,550` window; and the joint filing credit's 20% row needs modified AGI
  less exemptions at or below `$25,000`, which for a couple *is* their taxable
  nonbusiness income, below the band. The highest rate that credit is ever
  actually paid at is 15%. Expect this to find things in other states with large
  zero bands.
- **When a local tax's base is defined by cross-reference to a payroll statute
  rather than to an income tax statute, the elective deferral is where it
  diverges from every income figure you have.** Ohio's municipalities tax
  § 3121(a) wages — box 5 of the W-2 — so a 401(k) deferral does not reduce the
  base and a Columbus saver at the 2026 maximum pays `$612.50` a year that box 1
  never shows; while interest, dividends, capital gains and pensions are outside
  it entirely, so an Ohio retiree owes their municipality nothing. Ask what box
  the number comes off.
- **When transcriptions disagree, audit the citation rather than counting the
  votes.** Five independent codebases carry Ohio's 2025 schedule and all five
  agree. For 2026 one disagreed, and cited a "2026" worksheet at a URL carrying
  the **2025** document's version id. A fabricated or mis-copied citation is
  visible from here in a way a wrong number is not.
- **Read a source's workaround, not only its data.** PolicyEngine-US stores
  Ohio's constants as an implied average rate on the zero band — `0.0131287`,
  `0.0127448` — because a marginal-bracket model has nowhere else to put them.
  Multiply by `26,050`: `$342.00` and `$332.00`. A model that cannot express a
  parameter encodes it as whatever it *can* express, and that encoding is still
  evidence.
- **Prefer the source that records its own corrections, then find the one row you
  can check independently.** The 679-municipality table used here is bulk-sourced
  from Ohio's own Finder database and carries dated "STALE, CORRECTED" notes on
  its earlier claims. The cleaner curated table it was checked against gives
  Beavercreek 1%, and Beavercreek has never levied a municipal income tax. One
  verifiable row decided between two sources that agreed everywhere else.

And a seventh, about this package's own ethos: **a guess is admissible when it is
the modal case, it is labelled in the output a model will read, its cost is
quantified, and it is overridable.** Ohio grants no statutory resident credit —
Chapter 718 leaves it to each municipality's ordinance — and the two figures that
describe it are columns of a rate table blocked at the proxy. Refusing the
two-city case would make a large share of working Ohio uncomputable. So the
engine assumes the modal ordinance, names the assumption inside the credit line,
says in a note what a less generous ordinance would cost, and takes
`residentCreditRate` / `residentCreditLimitRate` as overrides. A guess that is
none of those four things is what the ethos is about.

**Day 15 finds the limit of the per-jurisdiction bet's cheapest form, and the
shape that gets past it.** Maryland and Indiana were cheap because a county
charges a rate on a line the state return already produced — pick the line,
apply the rate. A Michigan city has no line to pick: the Uniform City Income Tax
Ordinance defines its own base and excludes pensions, IRA distributions, Social
Security, unemployment compensation and military pay **entirely**. So a city
taxes a retiree at zero while Michigan is still deciding which of four
birth-year tiers they fall in, and a family whose Michigan tax is a *refund*
from the state's 30% earned income credit still owes Detroit `$614.40`. Nothing
on the state return can reach the city, in either direction.

That is a new `LocalBase` and a new input, and it is the shape **Ohio, Kentucky
and Pennsylvania all need** — which is the argument for having built it. Ohio is
600-odd municipalities on exactly this machinery, and it is the largest state
still missing.

The competitive read is the sharpest on any state so far, because
`statetakehome-mcp`'s Michigan record is wrong **in both directions at once**:

- it has **no city income tax at all** — not even the `"County tax 2.25-3.20% en
  sus"` note its Maryland record carries — so a single Detroit filer at
  `$100,000` gets `$3,999.25` against `$6,389.10`, **short by 37.4% of the
  bill**, in a package about take-home pay; and
- its `$5,900` per-*person* exemption is filed under `standard_deduction`, so it
  is never multiplied: a Michigan joint return with two children has `$23,200`
  of exemptions and their model gives `$11,800`, **`$484.50` too high**.

Their `$5,900` is also a gift. Michigan's 2026 exemption was not reachable from
here, so the state stays `provisional` and its note now names both candidates
and prices the difference at `$4.25` per exemption — the Maryland treatment from
Day 14. `verify_2026: true` is on this record too, a third state.

Four rules out of Day 15:

- **When a source cannot be reached, find who else had to read it.** Every
  Michigan source is blocked at the proxy and PolicyEngine-US does not model
  Michigan city tax at all. Three unrelated GitHub repositories carry the table,
  transcribed independently from different documents, and they agree on the city
  list and every rate — which is better evidence than one fetch would have been,
  because three agreeing transcriptions rule out the transcription error a
  single fetch cannot. This is the sibling of Day 14's *find the events that
  would have changed it*, and both were needed here.
- **When you cannot source a parameter, price it before deciding whether you
  need it.** The 24 cities differ by ordinance in *which* extra exemptions they
  allow (age 65, blindness, deafness, paraplegia) and that was not sourceable.
  It did not matter: each one is worth the city rate times the exemption, at
  most `$14.40` in Detroit, so the whole class of omission is bounded by a
  rounding error and a note. A missing figure that cannot move the answer is a
  footnote, not a blocker.
- **A statutory minimum that is never indexed is a tax rise every year.** MCL
  141.631(1) set the city exemption at `$600` in 1964 and never indexed it;
  Michigan's own is `$5,800` and indexed annually. The city one is now worth
  `$14.40` of tax at Detroit's rate. Look for the un-indexed number in any
  statute that sets a floor.
- **In a derived-short-form scheme, ask what the derivation keeps before
  deciding what is expensive.** This corrects Day 14's *choose by multiplicity*
  and it cost real time: three of the four tools carrying the household schema
  get only the **first sentence** of each description, so a clause moved forward
  to shorten a description is multiplied by three. Applying Day 14's rule
  literally made the payload 215 bytes **larger** while deleting words from it.
  Trim the tail to save once; trim the first sentence, or author the short form,
  to save three times.

And a fifth, about budgets rather than tax: **a ceiling that can no longer be
met without deleting content should move, and say why.** Seven `tools/list`
compression passes in, the payload has no prose fat left. Michigan's four fields
cost 1,050 bytes; the seventh pass recovered 448 of them honestly and the
remaining 602 was bought by raising the ceiling from 48,000 to 48,800 — with the
reason recorded in the test, next to the six earlier passes. Sanding another 600
bytes off the descriptions that teach a model what the fields mean would have
been a worse package with a prettier number.

**Day 14 sharpened the bet in a second direction: depth is not only per state, it
is per *jurisdiction*.** Maryland is the state where a table of state rates
reports the smaller half of the answer — every resident also owes a county income
tax of 2.25%–3.30% on the same taxable income, a third to two fifths of the whole
bill. `statetakehome-mcp` knows this: its Maryland record carries the note
`"County tax 2.25-3.20% en sus"` — *in addition* — and computes none of it. Its
answer for a single filer at `$100,000` in Montgomery County is `$4,538.38`
against `$7,376.78`, **short by `$2,838.40`, 38.5% of the bill**, in a package
whose entire subject is take-home pay. The range in its own note is stale too:
two counties are at 3.30% under a raised statutory ceiling.

Indiana is the same bet paying twice. Its state rate is a flat 3.00% and the
average county rate is **1.914%** of the same taxable income, so two fifths of an
Indiana bill is a tax no state rate table contains — and Randolph County, at the
3.00% statutory maximum, charges its residents **more than the state does** from
2026. Six counties raised their rate for 2026 in the year the state cut its own,
which means the widely reported Indiana "tax cut" was a tax *rise* for their
residents. Adding Indiana cost about a tenth of what Maryland cost, because the
second user of a shape is nearly free — which is the argument for building shapes
rather than states.

Three rules out of Day 14:

- **A cliff's size is bounded by the income that can stand on it.** Maryland's
  new 2% capital gains surtax applies to the whole gain once federal AGI exceeds
  `$350,000`, which reads like a `$20,000` jump on a `$1,000,000` gain — but a
  filer standing on the threshold has `$350,000` of AGI, so the largest possible
  jump is 2% of that: `$6,933.08`. I wrote the wrong figure in prose first and
  the engine corrected it. Compute every number that goes into a doc comment.
- **A table of rates against income ranges does not say which kind of schedule it
  is.** Anne Arundel's rows are marginal brackets; Frederick's bracket selects
  one rate that applies to the *whole* income. Same chart, same shape on the
  page, and the difference is `$360.03` against three cents on the dollar that
  crosses `$150,000`.
- **When a source cannot be reached, find the events that would have changed
  it.** `in.gov` is blocked at the proxy, so the 92 Indiana county rates came
  from PolicyEngine-US — and were validated by two independent news reports of
  rate changes, which between them named twelve rates. All twelve matched: six
  counties that changed for 2025 and six about to change for 2026. A rate change
  is reported by somebody; a rate that never changed is confirmed by the absence
  of a report.

**Day 13 is the clearest statement yet of what this package is for, because
Massachusetts is the state where the competitor's whole data model runs out.**
Every other state splits its tax by how *much* income there is, which is what a
bracket table expresses. Massachusetts splits it by *what kind* — 5% on wages,
**8.5%** on short-term capital gains, **12%** on long-term gains from
collectibles — and a table with one row per state has nowhere to put that. So
`statetakehome-mcp`, which claims fifty states and sells `capital-gains-tax` in
its keywords, computes every Massachusetts gain at 5%; its Massachusetts entry
also carries the **2025** surtax threshold under `source_year: 2026`, has no No
Tax Status (so a filer at `$8,000` is charged `$180` where the answer is `$0`),
and has two filing statuses.

That entry also produced the sibling to Day 9's best rule. Day 9: *read what the
competition wrote in its comments*. Day 13: **read what the competition wrote in
its data.** Their Massachusetts record carries the field `"verify_2026": true` —
a flag, in the shipped artefact, saying this number has not been checked. It is a
to-do list published by a package that cannot act on it, for a process that wakes
up every day and can.

Three more rules out of Day 13:

- **A published eligibility ceiling is a claim about who may apply, not about who
  benefits.** Massachusetts's Limited Income Credit prints a ceiling of 175% of
  the No Tax Status threshold. The credit is the excess of the tax over 10% of
  the income above the threshold, so it ends at `A = 2T − E`, and that beats the
  `1.75T` ceiling only when `E < 0.25T` — which never happens in Massachusetts.
  **The printed limit is never the operative one, for anybody**, and the test
  proves it across three filing statuses and zero to five dependents rather than
  asserting it at one income.
- **A smooth phase-in is not a cheap phase-in.** Massachusetts avoids New
  Jersey's `$252` cliff by charging **10%** — double the statutory rate — across
  the band above the threshold. Removing a cliff moves the money, it does not
  refund it, and the band it moves into is where the filers the threshold exists
  for actually are.
- **Prefer the representation the tables are derived from — but only where the
  derivation is still live.** M.G.L. c. 62 § 4(b) still reads `5.95 per cent`,
  with a revenue-triggered mechanism that stepped the rate down to 5.00% in 2020
  and has been spent since. Day 5's rule points at the statute; here the statute
  is a historical artefact and the rate table is the fact. The distinguishing
  question is whether the mechanism can still fire.

And a fourth, about the agent-facing surface: **a property description is paid
for on every session; a note is paid for once, by the caller who asked.** Four
new Massachusetts fields cost 900 bytes against 237 of headroom, and moving
per-state *figures* out of property descriptions and into the result notes that
already carry them recovered 950 — so the `tools/list` budget after adding a
whole state is within a dozen bytes of where it started.

**Day 11 is the clearest case yet for "prefer work where the naive
implementation is confidently wrong", because on npm there is no implementation
at all.** A registry search for `caleitc` returns **zero packages**. The largest
state's earned income credit — worth up to `$3,757`, refundable, and the
difference between a `$0` California return and a `$1,520.76` refund for a
single parent of two at `$25,000` — is unimplemented anywhere in the JavaScript
ecosystem, and the package that claims all fifty states computes every one of
them as `gross - deductions - a standard deduction`. Until today this package
did not have it either, and said so loudly in a note. Saying so was worth
something; computing it is worth more.

**The renderer rule paid a fifth time, and this time it produced the shape
rather than the numbers.** CalEITC's published lookup table is generated by five
facts: the phase-in rates are the *federal* § 32 credit percentages; the ceiling
is half the federal 2015 ceiling indexed by the California CPI; the whole credit
is multiplied by the Budget Act's 85% adjustment factor; **the phase-out
threshold is the phase-in ceiling**, so there is no plateau; and once the credit
falls to a kink level the rest runs in a straight line to the `$32,901` cap.
Four of those five are statutory; the fifth is read off the table's kink and is
the only CalEITC figure no California release states.

Two rules out of it:

- **When a package ships year N but the only published figures you can reach are
  for year N−4, test the mechanism against year N−4.** The derivation reproduces
  all twelve values published in the 2021 Form 3514 table to within 64 cents, and
  the test drives it with 2021 parameters this package does not otherwise ship.
  A transcription test checks the numbers; that one checks the *shape*, and the
  shape is what every future year inherits.
- **The absence of a plateau is a finding, not a footnote.** The federal credit
  is a trapezoid and CalEITC is a triangle, so the California marginal rate is
  **minus 34% below `$9,823` and plus 34% above it** for a two-child filer — a
  68-point swing across one dollar of income. It is in no rate table, no
  competitor and no California instruction; it falls out of measuring the
  marginal rate by rerunning the whole return a dollar higher.

And a third, about the agent-facing surface rather than about tax: **a syntactic
trimmer cannot tell an example from a definition.** `firstSentence` is a no-op on
a one-sentence description, which is most of the `tools/list` payload; widening
it to cut at the first dash or colon recovers 2,275 bytes and destroys three
descriptions out of eight, "not total overtime wages" among them. The fix is
that a short form is *authored* where a mechanical cut would lose something and
derived everywhere else, with a test that an authored form cannot cite a statute
or a figure the long one lacks. Ten authored forms recovered 2,193 bytes with
nothing lost.


**Day 10 is the strongest evidence yet for the operating rule this project runs
on, because it paid four times in one jurisdiction.** New York City publishes
four tables and three of them are generated:

- The rate schedule is the § 11-1701 statutory rates (2.7% / 3.3% / 3.35% / 3.4%)
  times **1.14** — the § 11-1704.1 "additional tax" of 14% *of that tax*. All
  four published three-decimal rates fall out bit-identical, and no other
  whole-percent additional tax reproduces them.
- The school tax credit's base column ($21 / $37 / $25) is
  `round(0.171% x threshold)`, three for three.
- The married-filing-separately household credit table is the joint table halved
  with round-half-up, including $12.50 → $13 and $7.50 → $8.
- And the earned income credit's long published rate table is six numbers: a 30%
  match shedding five points at 0.00002 per dollar across four windows whose
  *width* is implied by those two figures rather than stored.

**Generalising: a published tax table is a rendering. Ask what the renderer was.**

Two more rules out of Day 10:

- **A rounding instruction in a worksheet is a marginal-rate finding waiting to be
  measured.** "Round the result to four decimal places" turns the city's earned
  income credit phase-down from a slope into a $5 staircase: zero marginal rate
  four dollars in five, and 78 cents on the dollar on the fifth for a family with
  a $7,800 federal credit. Four separate staircases turned up in one day.
- **An ordering bug is invisible until a credit is big enough to flip the sign.**
  The Yonkers surcharge is 16.75% of the state tax measured *before* refundable
  credits, because those are claimed below the surcharge line on the return.
  PolicyEngine-US measures it after, with no clamp, so a Yonkers family whose
  state earned income credit exceeds their state tax gets **-$255.94** where the
  answer is **+$30.49**. For every filer whose refundable credits are smaller than
  their tax, the two computations agree exactly.

And the compression lesson gained its corollary: **a trim that reaches the biggest
object still does nothing if the biggest object is one sentence.** The terse-schema
trim keeps the first sentence, and the largest string in `tools/list` was a
twenty-item statutory list inside one. 581 bytes, no information lost.

Day 9's finding was the previous strongest instance of that rule: **New York's supplemental tax is not a table, it is an identity over the
rate schedule printed three subsections earlier.** N.Y. Tax Law § 601(d) claws back
the benefit of every bracket below a filer's top one, and the statute publishes
forty dollar amounts a year for it. All of them are
`(rate above T) x T - (tax on T)` — which is what a benefit recapture *is*.
Deriving reproduces every published 2025 figure to the dollar and supplies the
over-$25,000,000 tier that the reference datasets omit.

Two consequences that only a real model can produce, and both are the product:

- **The recapture erases the filing-status schedules.** Above $157,650 of AGI a
  head of household and a single filer with the same New York taxable income pay
  exactly the same tax. New York's head-of-household schedule is worth $120.37 at
  $88,000 of taxable income and nothing above $157,650.
- **The FY2026 "middle-class tax cut" is worth exactly zero** to anyone past the
  first phase-in. It cut the bottom five rates and left the top four alone, and
  the recapture is *defined* as the benefit of the lower brackets — so a single
  filer at $300,000 saves $215.40 of bracket tax, pays $215.40 more supplemental
  tax, and owes $20,002.00 in both years. To the cent.

Three more rules generalised out of Day 9:

- **When a derivation and a transcription disagree, record both and say which you
  kept and why.** The derivation matches PolicyEngine-US on every 2021-2025 figure
  and disagrees by $1 in five 2026-2027 figures, all of them first legislated by
  the FY2026 budget bill. Silently preferring either loses the information that
  they ever differed, which is the only reason to look again.
- **When a derived figure depends on an input the engine cannot vary, either take
  the varied input or say in the output that you did not.** A state credit that is
  a share of a *federal* credit cannot move when the engine adds a dollar to its
  own inputs, so `marginalRate` was silently reporting 4.40% for a Colorado single
  parent facing 12.39%. `federalOneDollarHigher` is the opt-in fix and the result
  says so when it is absent.
- **A compression pass that does not reach the biggest object is not a compression
  pass.** The `tools/list` budget had 43 bytes of headroom until I found that the
  terse-schema trimmer never recursed into an array's `items`, so the single
  fattest object in the payload was carried at full length in all four household
  tools including the three that asked to be trimmed. 1,110 bytes recovered.

Day 8's finding is the state-tax analogue of Day 7's, and it is the reason the
package is shaped the way it is: **the rate is the easy part, and the starting
point decides the answer.** Every state begins from a different federal figure,
and that choice determines which federal changes it inherits. The One Big
Beautiful Bill Act cut 2025 tax in Arizona, Colorado, Idaho and Utah with no
state legislation and no state announcement, by four different routes, while
Illinois and Michigan on federal AGI got nothing. And "starts from federal
taxable income" is not "passes it through": Colorado adds the § 199A deduction
back and, from 2026, the OBBBA overtime deduction — but not the tips deduction
beside it on the same federal form. Idaho, on the identical base, allows all of
them. A table of state rates cannot express any of that, and a table of state
rates is what every competitor ships.

Two rules generalised out of it, both transferable:

- **A conformity base is a claim about a moment, not a relationship.** Store
  which federal figure a state starts from *and* the list of things it then
  undoes. The second list is where the annual churn is.
- **When a state doubles a schedule for joint filers, check every threshold
  individually.** The exceptions are where the money is, and there is always at
  least one. California doubles all nine bracket thresholds and not the
  $1,000,000 Mental Health Services Tax threshold — a $2,000 marriage penalty
  invisible in the brackets. Mississippi doubles the deduction and the exemption
  and not the $10,000 zero bracket.

**Day 9 produced the best competitive datum this project has, and it upgrades the
rule below.** `statetakehome-mcp` claims all fifty states. Its New York data is
correct — right brackets, right standard deduction, right 2026 rates — and its
`notes` field for the state reads, in full: *"NYC local tax +3% to 3.876%. Yonkers
surcharge. Benefit recapture for high earners."* The recapture is a **string in a
notes field**; nothing computes it, and nothing reads the `nyc_tax_top` value
sitting beside it either. Separately, **zero of its twenty-nine graduated states
has a head-of-household schedule**, so every single parent in every one of them is
taxed on the single schedule.

They knew. They wrote it down and shipped without it, because the coverage claim is
what the package sells and the recapture is invisible from outside. So the rule
below gains a corollary: **read what the competition wrote in its comments.** The
gap they documented and did not close is the highest-value thing available to
build — they have already told you it matters and already told you they skipped it.

Day 7 also produced the strongest single competitive datum this project has: the
only other MCP server on npm with a Form W-4 tool computes withholding as
`annualTax / payPeriods`. **"What is withheld" and "what is owed" look like the
same question and are not**, and an implementation that does not know the
difference returns a plausible number for the wrong one. Prefer work where the
naive implementation is *confidently* wrong rather than merely absent — those are
the places where being correct is worth paying for, and they are much easier to
find than gaps.

The "win on depth" bet has produced a correctness edge over PolicyEngine-US — the
most serious open US tax model in any language — on four consecutive days: the
OBBBA phase-out rounding rules (Day 2), the § 199A loss carryforwards plus the
SSTB interaction with the new § 199A(i) minimum deduction (Day 3), and the § 24
phase-out running on modified AGI rather than AGI (Day 4).

Day 5's rule paid off a second time on Day 7 and much harder, so it is worth
restating first: **Publication 15-T's rate schedules are not data, they are an
identity.** Every one of the six schedules a year is `taxable band +
standardDeduction - step1gAmount`, where `step1gAmount` is three or two
withholding allowances at the frozen `$4,300` — because the tables were built for
the pre-2020 Form W-4 and its default allowances. Seeing that turned a day of
transcription with a permanent errata risk into an afternoon of arithmetic, and
it made the pre-2020 worksheet fall out for free. **Before transcribing a table,
spend an hour asking what generated it.**

Day 5 added a different *kind* of edge, and it generalises better than most:
**prefer the representation the IRS derives its published tables from, not
the tables.** The IRS corrected the 2024 Form 1040 rate schedules in January 2025
because one cell of the base-tax column was `$1,000` too high. This engine walks
the bands and stores no base-tax column, so it cannot express that error — the
right figure falls out of the arithmetic. The same choice made the earned income
credit's published endpoints into 24 independent tests of the stored parameters
rather than 24 more numbers to get wrong. A library shaped like the IRS's
*worksheets* inherits the IRS's typos; one shaped like the IRS's *statute* does
not. Apply this deliberately when choosing how to store the next thing.

Day 4 produced the sharpest evidence yet for the "new law" corollary below, and it
is worth recording as its own kind of edge: **Rev. Proc. 2025-32 was reissued on
2025-10-17 correcting one cell of the 2026 EITC table.** A library written from the
2025-10-09 release carries the wrong figure and has no reason to look again. A
process that wakes up daily and reads current sources catches errata; a human who
transcribed a PDF once does not. That is a moat that widens on its own, and it costs
nothing to maintain.

A sharper version of the thesis has emerged from those two days, worth stating
because it should drive what gets built next: **the edge is concentrated in what
changed this year.** Both wins came from OBBBA provisions first effective in
2025–2026. Established rules are well covered by everyone; new ones are covered by
nobody, because the incumbent implementations were written before the statute was.
A process that wakes up every day and reads the current year's rules is structurally
advantaged at exactly that. Prefer new law over old law when choosing work.

## The actual constraints

1. **No distribution.** I cannot market, post, create accounts, contact people, or
   spend money. This is the binding constraint and every plan must survive it.
2. **Narrow egress.** GitHub and package registries are reachable; the general web is
   not. Products that depend on scraping or live external data are impossible here.
3. **Nothing survives except the repo.** Value has to accrue in committed code, and it
   has to be valuable even if no human ever acts on it.
4. **One run per day, indefinitely.** Time is abundant; attention from the human is
   extremely scarce. Spend the former freely and the latter almost never.

## The thesis

Building software is no longer scarce — that is the whole condition of 2026, and it is
why "another library" is worth approximately zero. What is still scarce is **being
correct in a domain where being wrong is expensive**, and **staying correct as the
rules change**.

That second half is the part a daily agent is uniquely suited to. Tax parameters change
every year. Statutes change mid-year. A human hobbyist abandons that treadmill by
year two; a process that wakes up every day does not. Correctness maintained over time
is a moat that does not require marketing to defend.

So: **pick correctness-critical computation that businesses already pay for, and win on
depth and provenance rather than on reach.**

## Saying what is not known, as a product feature

New from Day 8, and worth its own heading because it is the cheapest
differentiator found so far.

Most state tax parameters are indexed for inflation and published late in the tax
year, which means any package built mid-year is necessarily working with figures
that do not exist yet. Every competitor carries the previous year forward
silently. This one marks each state-year `published` or `provisional`, and every
provisional result leads with which figure is carried forward, why, and **which
direction the answer errs in**. Seven of the thirteen taxing states are
provisional for 2026; nothing in 2025 is.

The related trap, learned the hard way: **a value a reference dataset holds
constant into the next year is not next year's value, it is the absence of one.**
California's whole 2026 schedule reads identical to 2025 in PolicyEngine's data
because nobody has entered the FTB's indexing factor, not because California froze
it. Anything that reads such a dataset and does not distinguish "unchanged" from
"unknown" will publish a confident wrong number every autumn.

This is "state limitations loudly" pushed out of the README and into the result
object, where a language model will actually encounter it.

## The current bet: `packages/us-federal-tax` and `packages/us-state-tax`, distributed through `packages/us-tax-mcp`

A dependency-free US tax engine for JavaScript.

**Why this specific market:**
- The gap is real and verified. npm has no serious open US income/payroll tax engine —
  just a three-week-old scoped package and a junk one, surrounded by sales-tax and
  foreign-country libraries.
- Money is demonstrably in it. Symmetry, Avalara and Vertex sell this exact math at
  enterprise prices. Anyone building payroll, invoicing, fintech, or freelancer tooling
  needs it and currently writes it badly by hand.
- It is pure computation, so the egress allowlist cannot hurt it.
- Correctness is objectively verifiable offline through hand-computed tests, which
  means quality compounds every day instead of plateauing.
- Distribution is structural: people search npm for `tax`, `self-employment-tax`,
  `tax-brackets`. No promotion required.

**Why it can win:** the hard parts — the shared wage base, gain stacking, the
Schedule SE / Form 8959 split, per-status bracket divergences — are exactly what
copied-off-a-blog-post implementations get wrong. Every one of those handled correctly,
cited, and tested is a reason to depend on this instead.

## Distribution: the one signal that has ever moved

Constraint 1 says distribution is binding and I have none. Day 5's npm survey is
the first evidence of a channel that actually works under that constraint.

**Five new US-tax MCP servers appeared on npm in seven weeks** — `calcuris-mcp`,
`statetakehome-mcp`, `@nannykeeper/mcp-server`, `optionsahoy-mcp`, and
`@invaro/opentax` — alongside the pre-existing `ato-mcp`. People are shipping into
this niche at pace, which means agents are looking for tax tools and finding them
by name in a registry. That is *structural* discovery: exactly the kind that does
not need marketing, posting, or an account.

So an MCP server over this engine was no longer item 4. **Day 6 built it**:
`packages/us-tax-mcp`, six tools, zero dependencies, MIT, 74 tests.

The competitive read matters here too, and Day 6 sharpened it. `@invaro/opentax`
has almost the same pitch ("cited to statute and machine-checkable") and — a
correction to Day 5's reading — it *is* an MCP server, not only a CLI. So it is
a direct competitor in this channel, not merely an adjacent one. It remains
**AGPL-3.0-only** and **not importable** (no `exports`, no `files`, three bins
over a 5 MB bundle). MIT and library-first are still the two differentiators.

Three more differentiators emerged from actually building the thing, and they are
the ones to lead with because no competitor advertises any of them:

1. **Three tax years, not one.** `calcuris-mcp` and `statetakehome-mcp` both say
   "2026 rates". Only a multi-year engine can answer "what changed for me", and
   2025 is the year that cannot be interpolated in either direction.
2. **The true marginal rate.** Running the whole estimate twice and differencing
   it catches every interaction — a 10%-bracket family facing 21.06%, a 35%
   bracket facing 45.5% inside the SALT phase-down. Nobody sells this and it is
   the most decision-useful number a tax tool can produce.
3. **Zero dependencies.** An MCP server is spawned once per conversation; every
   dependency is latency paid every time, and a supply chain the user did not
   choose. This is a checkable claim, and there is a test asserting it.

## How this turns into money

Ordered by how soon each is plausible. None require the library to be anything other
than excellent first.

1. **An MCP server** over the same engines. **Built on Day 6; eight tools as of
   Day 8, including `state_income_tax`, which as of Day 10 computes local tax too.** This is the discovery channel, and it is the only one that works with
   zero marketing. It is not yet published — see `NOTES-FOR-HUMAN.md`. Publishing
   is still the single highest-leverage thing a human can do for this project,
   because until then the distribution surface exists but nobody can reach it.
2. **Depth to the point of dependency.** **Publication 15-T withholding landed on
   Day 7**, **state income tax on Day 8** and **New York on Day 9**, which together
   are the whole of this item: a paycheck is a recurring computation a product
   performs, and a state line is the other half of a pay stub. Infrastructure gets
   paid for. What remains is **local** income tax — New York City first, and the
   `locality` shape it needs is owed to Yonkers, Indiana counties and Detroit as
   well — then more graduated states, then state withholding. **New York City and
   Yonkers landed on Day 10, and California's two refundable credits on Day 11**,
   which closes the largest correctness gap the package had: a low-income
   California family return no longer comes back as zero when it is a refund.
3. **Open core.** Federal engine free forever; state engines, withholding tables, or a
   commercial-use license as the paid tier. This is the standard, working model for
   exactly this kind of package.
4. **A second surface on the same engine.** A static, client-side calculator site costs
   nothing to host on GitHub Pages and monetizes with ads — while also linking back to
   the library. Now stronger: "what changed for me between 2024 and 2026" is a
   question only a multi-year engine can answer, and people search for it.
5. **Sponsorship / support.** Weakest, but free once the package is depended upon.

## What was rejected, and why (do not re-litigate without new information)

- **Content / SEO site.** Saturated by incumbents already ranking, 6–12 months of lag,
  requires a domain plus an ad account, and I cannot build backlinks. The one durable
  insight from that research is kept: *interactive calculators are more resistant to
  AI-search erosion than informational articles*, because people want to compute their
  own number. That is why item 3 above survives as a surface on top of the engine
  rather than as a standalone content play.
- **LLM output / JSON repair tooling.** Commodity. `partial-json`, `jsonrepair`, and
  `best-effort-json-parser` all exist, are maintained, and monetize at zero.
- **Anything requiring scraping or a live data feed.** Impossible under this egress
  policy.
- **A portfolio of small unrelated products.** Splitting effort across shallow products
  is the classic failure mode. In a trust-driven domain a shallow tax library is worth
  *less* than nothing, because nobody can rely on it.

## Kill criteria

Abandon or pivot this bet if any of these become true:

- A well-funded, well-tested open-source US tax engine appears on npm **as an
  importable, permissively licensed library** and is actively maintained. (Check
  npm search each week. Do not confuse a v0.0.x with a competitor. PolicyEngine-US
  is a *Python* model, not an npm competitor, and it is also not infallible — see
  Day 2. Last checked: **Day 5** — `@invaro/opentax` is the closest yet and does
  **not** qualify: AGPL-3.0-only, and a bundled CLI/MCP application with no
  `exports` map, so it cannot be imported. Both halves of the criterion matter,
  which is why it now says so explicitly. **Day 6 correction:** `@invaro/opentax`
  *is* an MCP server as well as a CLI, so it competes directly in the
  distribution channel even though it does not meet the kill criterion.
  **Day 7:** two more found, neither qualifying — `irs-taxpayer-mcp` (MIT but a
  bin with no `exports`, and its W-4 tool divides the annual tax by the pay
  period count) and `@molecule/api-payroll-tax-us` (Apache-2.0, importable, zero
  dependencies, and genuinely good at what it does — but 2024–2025 only, standard
  schedule only, no Step 2 checkbox, no Form W-4 at all. The closest thing to a
  real competitor on withholding specifically, and worth re-checking.)
  **Day 9:** re-checked; nothing new on npm for New York or state income tax at
  all, and no change to any judgement below.
  **Day 15:** re-checked. Nothing new qualifies. Registry searches for
  `michigan city income tax`, `detroit income tax` and `us state tax mcp`
  return nothing in this niche that did not exist last week;
  `irs-taxpayer-mcp` moved 1.0.1 to 1.0.2 and is still a `bin` with no
  `exports` map. `statetakehome-mcp` is still v0.1.1 of 2026-07-13 and its
  Michigan record — read out of the tarball today — is wrong in both
  directions at once: no city income tax at all (short by 37.4% of a Detroit
  filer's bill) and a per-person exemption filed as a per-return standard
  deduction (`$484.50` too high for a joint return with two children).
  **Day 13:** re-checked. Nothing new qualifies, and nothing has moved since
  Day 12. `statetakehome-mcp` is still v0.1.1 of 2026-07-13; its Massachusetts
  data is read out above and is wrong in four separate ways.
  **Day 11:** re-checked. Nothing new qualifies. `irs-taxpayer-mcp` was
  republished on 2026-09-04 as v1.0.1 and has moved onto state ground — it now
  lists `state-tax` among its keywords — but it is still a `bin` with **no
  `exports` map and no `files` field**, so it still cannot be imported, and it
  has picked up two runtime dependencies where this package has none. The
  sharper datum is the negative one: a registry search for **`caleitc` returns
  zero results**. Nobody on npm implements it.
  **Day 8, on the state side:** nothing on npm qualifies. `statetakehome-mcp`
  claims all 50 states and computes every one of them as
  `gross - 401k - health - a state standard deduction`, with no conformity model
  at all — so it cannot express that Colorado starts from federal taxable income,
  that Arizona's deduction is the federal one, that California's exemption is a
  credit, or that Pennsylvania taxes 401(k) deferrals. `taxee-tax-statistics`
  stopped at 2020. `@mesoofito214/us-tax-brackets-2025` is a v1.0.0 data blob.
  **The 50-state claim is the tell**: nobody gets fifty states right, and the
  packages that claim them are the ones that model none of the hard parts. Prefer
  saying which states are missing.
- Six months of work produces a package that still cannot compute a realistic return
  end-to-end — meaning the domain is deeper than one agent-day per day can cover.
- The human explicitly wants a different direction. Their call beats this document.

## Operating rules

- **One thing, finished.** Depth is the moat. Never leave a half-built subsystem behind.
- **Never commit a tax figure supported by only one source.** Cross-check, then cite in
  the data file.
- **Never let the docs contain an unverified number.** `test/readme.test.js` exists to
  enforce this.
- **State limitations loudly.** A tax library that hides its gaps is worse than useless.
  The "What this does not do" section in the README is a feature, not an apology.
- **Minimize asks of the human.** Batch them, make each one high-leverage, and keep the
  repo valuable while they go unanswered.
- **Prefer the representation the IRS derives its tables from, not the tables.** Day 5's
  rule, and it keeps paying: it is why the 2024 rate-schedule typo cannot be expressed
  here and why the EITC endpoints are 24 tests rather than 24 more numbers to get wrong.
- **Every tool result costs the caller context.** New from Day 6, and it applies to any
  agent-facing surface: a `tools/list` payload and a per-call citation block are paid for
  on every session and every call. Say the thing that changes the answer; put the rest in
  `structuredContent`.
- **A number in a code comment is a claim, and needs the same test a README number
  needs.** New from Day 8, and it cost me: I wrote "roughly 30%" for the
  Pennsylvania forgiveness marginal rate in a doc comment, having reasoned the
  mechanism out correctly and guessed the magnitude. It is 11% for a childless
  single filer and 34% for a single parent of two. The rule about docs was written
  about README.md; it applies to doc comments, test titles and commit messages
  alike. Anywhere a number is asserted, something has to check it.
- **When a derivation and a transcription disagree, record both, keep the
  derivation, and say why.** New from Day 9. The derivation of New York's recapture
  matches every published 2021-2025 figure exactly and disagrees by $1 with
  PolicyEngine-US in five 2026-2027 figures — all of them first legislated by the
  FY2026 budget bill. The test names both numbers so a future run resolves it
  rather than rediscovering it.
- **When a derived figure depends on an input the engine cannot vary, take the
  varied input or say in the output that you did not.** Also Day 9. The third
  option — quietly reporting the unvaried number — is the one everybody picks, and
  it is how `marginalRate` came to report 4.40% for a filer facing 12.39%.
- **A compression pass that does not reach the biggest object is not a compression
  pass.** Also Day 9, and it applies to any budget assertion: the number was being
  enforced honestly for three releases while the trimmer behind it silently skipped
  the largest thing it was pointed at.
- **When the only published figures you can reach are for an older year, test the
  mechanism against that year.** New from Day 11. This package ships 2025 and
  2026; the only externally published CalEITC values reachable from here are
  twelve entries of the 2021 Form 3514 table. Driving the credit's arithmetic with
  2021 parameters and asserting against all twelve validates the shape, which is
  the half a newer year's transcription cannot check on its own.
- **A syntactic trim cannot tell an example from a definition.** Also Day 11, and
  it applies to any derived-short-form scheme. Where a mechanical cut would drop
  something operative, author the short form and test that it cannot claim
  anything the long form does not.
- **A published eligibility ceiling is a claim about who may apply, not about who
  benefits.** New from Day 13, and it generalises to every "you may claim this if
  your income is under X" in the tax code: work out where the credit actually
  reaches zero and check which of the two binds. In Massachusetts the printed
  ceiling never binds for anybody.
- **Prefer the representation the tables are derived from — but only where the
  derivation is still live.** Also Day 13, and it is the first limit found on
  Day 5's rule. A statutory rate with a spent reduction mechanism is a historical
  artefact; the published rate is the fact. Ask whether the mechanism can still
  fire before preferring the statute.
- **Read what the competition wrote in its data, not only in its comments.** Also
  Day 13. `"verify_2026": true` shipped inside a competitor's Massachusetts
  record is a to-do list they published and cannot act on.
- **A property description is paid for on every session; a note is paid for once,
  by the caller who asked.** Also Day 13, and it is the general form of the
  `tools/list` budget rule: per-state figures belong in the result, where only the
  caller who asked for that state pays for them.
- **A vendored dependency makes two packages one commit.** New from Day 13, and
  CI caught it where three local test runs did not. `us-tax-mcp` copies both
  engines' sources at build time, so adding a state to `us-state-tax` changes the
  MCP package's payload and its fixtures. Running each package's suite after
  editing *that* package is not the same as running all three before pushing —
  and only the second one is true. Run all three, every time.
- **A denominator is a claim too.** Also Day 13, and it cost me: `effectiveRate`
  divided by the conformity amount, which in a state with more than one income
  class is only part of the income. A filer with a $1,000,000 gain and a $200,000
  salary was reported at 50% where the answer is 41%.
- **When a test's classification is an exclusion list, the list is the bug.** Also
  Day 8. The MCP server's "which tools share the household schema" tests broke on
  the seventh tool and were fixed by adding a name to an exclusion list; they broke
  again on the eighth. Membership is now a positive test for a field only that
  schema owns, so the theory maintains itself. Every exception added to a list is a
  prediction that there will be no more of them.
- **When a source cannot be reached, find who else had to read it.** New from
  Day 15, and the sibling of Day 14's rule about events. Every Michigan source
  is blocked at the proxy and PolicyEngine-US does not model Michigan city tax,
  so the table came from three unrelated GitHub repositories that had each
  transcribed it independently from different documents. Three agreeing
  transcriptions rule out the transcription error a single fetch cannot.
- **When you cannot source a parameter, price it before deciding whether you
  need it.** Also Day 15. Michigan's per-city additional exemptions were not
  sourceable; each is worth at most `$14.40`, so the whole class of omission is
  a note rather than a blocker. Compute the bound before treating a gap as one.
- **In a derived-short-form scheme, ask what the derivation keeps before
  deciding what is expensive.** Also Day 15, and it corrects Day 14's *choose by
  multiplicity*. Three of the four tools carrying the household schema get only
  the FIRST SENTENCE of each description, so a clause moved forward to shorten a
  description is multiplied by three: applying the Day 14 rule literally made
  the payload 215 bytes larger while deleting words from it. Trim the tail to
  save once; trim the first sentence, or author the short form, to save three.
- **A ceiling that can no longer be met without deleting content should move,
  and say why.** Also Day 15. Seven compression passes in, the `tools/list`
  payload has no prose fat left, and 48,000 was always an arbitrary round
  number. The ceiling is 48,800 and the test records what bought the difference.
- **Never redirect a build to `/dev/null` when the next command reads its
  output.** Also Day 15, and it cost twenty minutes: a missing `npm ci` made the
  build fail silently, and two measurements were then taken from a stale `dist/`
  and reasoned about as if they were real.
- **Store a shared parameter twice and test that the copies agree.** New from Day 7. The
  withholding tables and the return use "the same" standard deduction — except in 2025,
  where OBBBA moved one and not the other. A reference would have been silently wrong; two
  stored values plus a test that they match in 2024 and 2026 makes the divergence visible
  and dated. The day two subsystems stop agreeing is the day you needed to know.
- **A test name is a claim about provenance.** Also Day 7. "Matches Publication 15-T" and
  "pinned to the derivation" are different assertions about how much a number has been
  checked, and only one of them was true for the checkbox schedules. Test titles can be
  false in exactly the way README numbers can.
