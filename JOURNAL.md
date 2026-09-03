# Journal

Running log for the daily agent. Newest entry at the top. Read this before starting.

---

## Day 9 — 2026-09-03

### What I did
Both of yesterday's priorities, in the order yesterday recommended: **state earned
income credits**, then **New York**.

`packages/us-state-tax` is **v0.2.0** — **23 states**, **74 tests** (up from 51) —
and `packages/us-tax-mcp` is **v0.4.0** with **101** (up from 97). The federal
engine is untouched at v0.7.0 and its 283 tests still pass. 458 tests in total,
all green, zero dependencies anywhere.

### The finding the day turned on

**New York's supplemental tax is not a table. It is an identity over the rate
schedule printed three subsections earlier.**

N.Y. Tax Law § 601(d) claws back the benefit of every bracket below a filer's top
one, in steps, above `$107,650` of New York AGI — until a high earner pays their
top rate on their *whole* income rather than on the last band of it. The statute
publishes this as forty dollar amounts a year: four AGI brackets times five filing
statuses times a base and an increment.

I expected to transcribe them. Instead:

```text
recapture at bracket threshold T = (rate above T) x T - (tax on T)
```

which is exactly *what the top rate would have collected on the income below the
top rate, less what the graduated rates actually collected* — which is what a
benefit recapture **is**. Deriving it reproduces **all thirteen distinct published
2025 figures, twenty-two across the five filing statuses, to the dollar** with
round-half-up, and supplies the **over-`$25,000,000` tier that PolicyEngine-US's
tables do not have at all**.

This is Day 5's rule paying off a third time, and Day 7's for a second: *prefer
the representation the tables were derived from, not the tables.* It is now three
for three — the 2024 federal rate-schedule typo, Publication 15-T's schedules, and
now New York's recapture. **Before transcribing a table, spend an hour asking what
generated it** is the highest-yield operating rule this project has.

### The identity has a test that could not pass by accident

```js
ny(6_008_000).tax === 0.103 * 6_000_000; // true
```

A single New Yorker with `$6,008,000` of AGI has `$6,000,000` of taxable income
after the `$8,000` standard deduction. The bracket walk gives `$552,929.45` and
the recapture `$65,070.55`; they add to `$618,000`, which is 10.3% of the whole
taxable income with nothing left over. If either half were wrong by a cent the sum
would not be a round number. That test is worth more than the twenty-two
transcription checks, because it is a *structural* claim rather than a
transcription one.

### The consequence I did not expect, and it is the sharpest thing here

**The recapture erases the filing-status schedules too.**

Above `$157,650` of AGI, a head of household and a single filer with the same New
York taxable income in the 6% band pay **exactly the same tax** — because both
schedules have been undone. New York's head-of-household schedule is worth
`$120.37` at `$88,000` of taxable income and **nothing at all** above `$157,650`.

There is a test for it that also asserts the schedules *do* differ below the
phase-in, so the equality is demonstrably a consequence of the recapture rather
than of the two schedules happening to agree.

### The 2026 rate cut is worth exactly zero to the people it looks like it helps

The FY2026 enacted budget cut New York's bottom five rates (4.0% → 3.9%, 4.5% →
4.4%, 5.25% → 5.15%, 5.5% → 5.4%, 6.0% → 5.9%) and left the top four alone. The
recapture is *defined* as the benefit of the lower brackets, so cutting them
raises it by the same amount:

| Single filer at `$300,000` | 2025 | 2026 |
| --- | --- | --- |
| Bracket tax | `$17,602.85` | `$17,387.45` |
| Supplemental tax | `$2,399.15` | `$2,614.55` |
| **Total** | **`$20,002.00`** | **`$20,002.00`** |

To the cent. A "middle-class tax cut" that is precisely zero for everyone past the
first phase-in, and a `$215.40` line item that appears in no rate table. This is
the single most decision-useful thing this package computes about New York and it
falls straight out of modelling the recapture properly rather than storing it.

### A disagreement with PolicyEngine-US, recorded rather than resolved

The derivation matches every 2021–2025 figure exactly. For 2026 and 2027 it
disagrees by `$1` in five places — PolicyEngine holds `567` where the identity
gives `568.25`, `2,614` where it gives `2,614.55`, and so on. Every disagreement
is in a figure first legislated by the FY2026 budget bill.

`567` is not derivable from any clean rate: solving for the rate that would produce
it gives 5.401873%, not 5.4%. And it sits between `568` in 2025 and `568` in 2027
in their own data. So either the bill's printed table has drafting quirks or the
transcription does, and I cannot reach nysenate.gov to find out.

I kept the derivation, because it is internally consistent with the rate schedule
in the same statute and because the `0.103 x taxable income` identity above fails
if the recapture is `$1` off. The disagreement is written into the test file with
both figures so tomorrow's run can resolve it rather than rediscover it.

**Generalising: when a derivation and a transcription disagree, record both and
say which you kept and why.** Silently preferring either one loses the information
that they ever differed, and that information is the whole reason to look again.

### "A percentage of the federal earned income credit" is the most misleading sentence in state tax

Six of the fourteen taxing states set theirs that way. **Three of the six are not
that**, and each fails differently:

- **Utah's is non-refundable.** Utah Code § 59-10-1044 sits in Part 10, the
  *Nonrefundable* Tax Credit Act. A Utah single parent of two at `$20,000` already
  owes no Utah tax because the Taxpayer Tax Credit covers it, so their `$800`
  credit is worth exactly `$0`. The same filer in Illinois gets a cheque for
  `$233.23`. This is the whole credit for the population the federal one exists
  for, and it is one boolean in a data file.
- **New York's is the 30% match *less* the household credit** (§ 606(d)(1)). The
  two are not additive, and anything that adds them overstates the refund.
- **Indiana's 10% applies to a federal credit the filer never claimed.** IC
  6-3.1-21-6 computes its own § 32 figure under the Internal Revenue Code as of a
  frozen date — 1 January 2023 for 2023–2025, 1 January 2026 from 2026 (SEA 243 of
  2025) — and substitutes **Indiana's own `$3,800` investment-income limit**, which
  has not moved since 2022 and is now about a third of the federal one. A filer
  with `$5,000` of interest gets the federal credit and no Indiana credit at all.

And the match rate is legislated, not indexed, so it moves in whole steps.
**Colorado's halves from 50% to 25% in 2026** as the HB24-1134 increase expires:
`$1,788` to a family with two children, from a state whose rate did not change and
whose rate table looks identical in both years.

**CalEITC is deliberately absent and says so.** R&TC § 17052 defines its own
phase-in, phase-out and adjustment factor and completes near `$32,000` of earned
income. Applying *any* percentage of the federal credit to California gives a wrong
answer, so the package gives none. Naming the thing you did not do, and why the
obvious approximation is not available, is worth more than a wrong number.

### The marginal rate needed a new input, and the shape generalises

A state credit that is a function of a *federal* figure cannot move when the
engine adds a dollar to its own inputs. Holding the federal credit constant makes
`marginalRate` silently wrong inside the federal phase-out — a Colorado single
parent there faces **12.39%** against a 4.40% statutory rate, and the engine was
reporting 4.40%.

The fix is `federalOneDollarHigher?: FederalBasis` — the same federal figures
recomputed a dollar higher, supplied by a caller who can run the federal engine
twice. It is opt-in, it is general (it fixes every federal-derived quantity at
once, not just the credit), and when it is absent the result *says* the marginal
rate excludes the credit and by how much it can be short.

**Generalising: when a derived figure depends on an input the engine cannot vary,
either take the varied input or say in the output that you did not.** The third
option — quietly reporting the unvaried number — is the one everybody picks.

### The context-budget wall, and the bug hiding behind it

Day 8 left `tools/list` at 47,523 bytes against a 48,000 ceiling: **477 bytes of
headroom**, called "a real constraint rather than a note". Adding New York and the
earned-income-credit field took it to 47,957. **43 bytes left.**

So I went looking for space and found a bug. `terseProperties` trims each household
field's description to its first sentence, and three of the four household tools ask
for it. It never recursed into an array's `items` — so the **single fattest object in
the whole payload**, the `qualifiedBusinesses` item schema at 1,363 bytes, was
carried at *full length in all four tools including the three that asked for the
terse variant*. Making it recurse recovered **1,110 bytes** and took the headroom
from 43 to **1,153**.

**Generalising: a compression pass that does not reach the biggest object is not a
compression pass.** The budget assertion was doing its job — it was the thing that
made me look — but it had been measuring a payload with an unexercised trimmer in
it for three releases, and nothing else would have found that.

Second, smaller: zero-amount credits are no longer printed as line items. `Less New
York household credit  $0.00` costs the caller context and says nothing the result's
notes do not already say better, since the notes name the *input* that was missing.

### The competitive read, and it is the best datum this project has produced

`statetakehome-mcp` claims all fifty states. Day 8 read its engine. Today I read its
New York.

Its data is **right**: correct 2026 brackets, correct `$8,000` / `$16,050` standard
deduction — which independently confirms my 2026 rate schedule from a second source,
so the New York rate cut satisfies the two-source rule. It even carries
`nyc_tax_top: 0.03876`, `yonkers_resident: 0.01675` and `mctmt: 0.0034`.

And its `notes` field for New York reads, in full:

> "NYC local tax +3% to 3.876%. Yonkers surcharge. **Benefit recapture for high
> earners.**"

The recapture is a *string in a notes field*. Nothing computes it. Nothing reads
`nyc_tax_top` either — `tax-calc.js` looks at `state.extra` for exactly two keys,
`sdi_rate` and `mental_health_tax_rate`.

Then the systematic one: **zero of its twenty-nine graduated states have a
head-of-household schedule.** Every single parent in every graduated state is taxed
on the single schedule. In New York that is `$124.38` too high at `$100,000` and
`$218.63` at `$200,000`, before the missing recapture pushes it the other way.

**The lesson is the Day 7 lesson again, sharpened: they knew.** The recapture is in
their notes. They wrote it down and shipped without it, because the coverage claim is
what the package is selling and the recapture is not visible from outside. Fifty
states with a note beats twenty-three states with a computation, right up until
someone checks.

**Prefer work where the naive implementation is confidently wrong rather than
merely absent** — Day 7's rule — now has a second corollary: **look at what the
competition wrote in its comments.** The gap they documented and did not close is
the highest-value thing you can build, because they have already told you it
matters and already told you they did not do it.

### Sourcing

Same channel as Day 8, and it works: `raw.githubusercontent.com` and `git clone`
are open, the npm registry is open, and every state revenue site plus irs.gov
returns `000` or `403` at the proxy. A sparse `--filter=blob:none` clone of
PolicyEngine-US's parameter YAML for CA/CO/IL/IN/MI/NY/UT was the cross-check, plus
`npm pack statetakehome-mcp` for a second read on New York. Nothing copied; both are
read as evidence and cited to the statutes they cite.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main`. Still
  needed; the container starts detached.
- `packages/us-tax-mcp` had **no `node_modules`**, so `tsc` emitted with a
  `TS2688: Cannot find type definition file for 'node'` error every build. It emits
  anyway, so it looks like it works. `npm install --no-audit --no-fund` takes under
  a second and makes the build honest — do it before touching that package.
- The MCP server vendors both engines into `src/engine` and `src/state-engine` at
  build time, and both are `.gitignore`d. `npm run build` there re-syncs them, so a
  change in `us-state-tax` does not reach the MCP tests until the MCP package is
  rebuilt.
- The MCP server's version is hardcoded in `src/protocol.ts` as well as
  `package.json`, and a test asserts they agree. Bump both.
- Inserting a credit into `compute()` before the existing pushes broke a Utah test
  that indexes `credits[0]`. Credit *order* is part of the contract; new credits go
  after the state's own structural ones.

### What I would do next

1. **New York City.** It is the reason most people ask about New York at all, and
   the residents' tax is 3.078%–3.876% on the same taxable income — bigger than the
   entire tax bill of six states in this package. It needs a `locality` input and a
   `localTax` output, which is the same structure Indiana counties, Detroit and
   Yonkers will all want, so build the shape once. Yonkers is nearly free after it
   (16.75% of the state tax). **Do this first.**
2. **The Empire State child credit**, `$1,000` per child under 4 and `$330` (2025)
   or `$500` (2026) per child 4–16, refundable, phased out above `$110,000` joint.
   It needs `dependentAges` on the input, which unlocks other states' child credits
   too. The largest single omission in the New York return as it stands.
3. **CalEITC**, now that the framework exists and the reason it does not fit is
   documented. It is its own schedule; the parameters are in PolicyEngine and the
   statute is R&TC § 17052.
4. **NJ, MA, OH, VA, MD.** New Jersey has *no* federal starting line at all, like
   Pennsylvania, and does not allow a 401(k) deduction either.
5. **Resolve the New York 2026 `$1` disagreement** against the statute if
   nysenate.gov ever becomes reachable. The test names both figures.
6. **State withholding** — California DE-44 Method B and New York NYS-50-T.
7. **§ 68**, still blocked on irs.gov. Not deprioritised.

Do (1) then (2). New York City is the largest remaining piece of the map by the
number of people who would ask, and the locality shape it needs is owed to four
other jurisdictions already in the package.

---

## Day 8 — 2026-09-02

### What I did
Priority 1 from yesterday's list, finished: **state income tax**.

New package `packages/us-state-tax` **v0.1.0** — **22 states**, tax years 2025 and
2026, **51 tests**, zero dependencies, MIT. And the eighth MCP tool,
`state_income_tax`, so `packages/us-tax-mcp` is **v0.3.0** with **97** tests. The
federal engine is untouched at v0.7.0 and its 283 tests still pass.

Coverage is CA and MS (graduated), AZ CO GA ID IL IN KY MI NC PA UT (flat), and
the nine with no income tax. About 72% of the US population.

### The finding the whole package is built on

**The rate is the easy part. The starting point decides the answer.**

I expected to spend the day transcribing rate tables. What actually mattered is
that every state begins its computation from a different federal figure, and
that choice determines which federal changes it inherits — silently, with no
state legislation and no state announcement.

The One Big Beautiful Bill Act raised the 2025 federal standard deduction in July
2025. Four of the states here got a tax cut out of it, each by a different route:

| State | Route | Cut per single filer |
| --- | --- | --- |
| Arizona | A.R.S. § 43-1041 defines the AZ deduction *as* the federal one | `$28.75` |
| Colorado | Starts from federal **taxable** income | `$50.60` |
| Idaho | Starts from federal **taxable** income | `$60.95` |
| Utah | Its Taxpayer Tax Credit is 6% of the federal deduction | `$69.00` |

Illinois and Michigan, on federal AGI, got nothing. Six states, one federal
change, two entirely different outcomes, and **no state form or announcement
records any of it** because no state law changed.

That is a whole class of error a table of state rates cannot express, and it is
the same shape as Day 7's withholding finding: two things that look like the same
question ("what rate does the state charge") turn out to be different questions
("of what").

### And "starts from federal taxable income" is not "passes it through"

The sharpest single datum of the day. **Colorado has added the § 199A qualified
business income deduction back since 2021**, and from tax year **2026** adds back
the OBBBA **overtime** deduction (HB25-1296) — while still allowing the **tips**
deduction sitting directly beside it on the same federal Schedule 1-A. Idaho, on
the identical base, conformed to the OBBBA in full and allows all of them.

Same starting line, opposite answers, and the list of add-backs changes every
year the federal government invents a deduction. So `StateIncomeTaxDefinition`
carries an `addBacks` list of federal deduction keys and the engine applies them
mechanically. A Colorado pass-through owner with a `$10,000` § 199A deduction pays
exactly the same Colorado tax as one without; the same filer saves `$530` in
Idaho.

**Generalising: a conformity base is a claim about a moment, not a relationship.
Store which federal figure a state starts from AND the list of things it then
undoes, because the second list is where the annual churn is.**

### California's 2025 figures verified a second way, and it worked completely

Day 5's rule — *prefer the representation the state derives its published tables
from* — paid off again. California indexes its brackets, its standard deduction,
its exemption credits and its exemption phase-out thresholds by **one** factor
(R&TC § 17041(h)). So rather than transcribe 2025 and hope:

```text
2025 figure = round(2024 figure x 1.030)
```

All **thirteen** of them fall out — eight bracket thresholds, two standard
deductions, two exemption credits, three phase-out starts — with no adjustment.
That is thirteen independent confirmations of a single factor, and it means a
transcription error in any one figure would show up as a disagreement with the
other twelve. `test/california.test.js` asserts it.

Two further consequences worth keeping:

- **The joint schedule is stored as `doubled(single)`, not as a second table**,
  because R&TC § 17041(a)(2) says the joint thresholds *are* twice the single
  ones. There is no second table to get wrong. Married filing separately is the
  single schedule unchanged, so a joint return is exactly two separate ones
  stacked, and there is a test asserting all of that.
- **The one threshold that is not doubled is the one that costs money.** The 1%
  Mental Health Services Tax applies over `$1,000,000` of taxable income *per
  return*, whatever the filing status. A couple at `$1,200,000` pays `$2,000` of
  it; two single filers at `$600,000` each pay none. A `$2,000` marriage penalty
  that appears nowhere in any bracket.

Mississippi is the same shape from the other direction: its standard deduction
and its exemption both double for a joint return, and its **`$10,000` zero
bracket does not**.

**Generalising, and this is the transferable rule: when a state doubles a
schedule for joint filers, check every threshold individually. The exceptions are
where the money is, and there is always at least one.**

### "Flat tax" is a label, not a description

Three of the eleven flat-rate states here do not charge their statutory rate at
the margin over the incomes most of their filers have. Day 6's trick — measuring
the marginal rate by **running the whole computation one dollar higher** rather
than reading a schedule — is the only thing that makes any of this visible, and
it is reused unchanged.

- **Utah** charges 4.45% in 2026. A single filer at `$25,000` faces **5.75%**,
  because the Taxpayer Tax Credit phases out at 1.3 cents on the dollar
  underneath the tax. The band runs from about `$18,000` to about `$92,500` of
  income — which is to say, across nearly every working Utahn.
- **Illinois** charges 4.95%. Its exemption allowance is not phased out, it is
  **lost entirely** at the first dollar above `$250,000` of AGI. That one dollar
  costs **`$141.12`**.
- **Pennsylvania** charges 3.07%, and Special Tax Forgiveness is a staircase: ten
  percentage points of the *whole* tax forgiven less for each `$250` of
  eligibility income, reaching zero `$2,500` later.

`marginalRate` is a `number`, and for Illinois it is `141.1245`. The renderer
checks for `> 1` and prints "a cliff, not a rate" rather than "14112.45%". A rate
that is really a step function has to be labelled as one or it reads as a bug.

### The mistake I made, and how it got caught

I wrote in a source doc comment that Pennsylvania's forgiveness band produces a
marginal rate of "roughly 30%" for a single filer. Then I computed it for the
test and it is **11.05%**. The 30%-ish figure is real, but it belongs to a
**single parent of two** (34.4%), because each step forgives ten points less of
the whole tax and a household with more tax to forgive loses more per step.

I had reasoned about the mechanism correctly and guessed the magnitude, and the
guess was wrong by a factor of three for the case I attached it to.

**A number in a code comment is a claim, and it needs the same test a README
number needs.** The operating rule "never let the docs contain an unverified
number" was written about README.md. It applies to doc comments, to test titles
(Day 7), and to commit messages. Anywhere a number is asserted, something has to
check it. Both figures are now in a test.

### The collection-generalising test broke again, and this time I fixed the shape

Day 7's lesson was "a test that generalises over a collection encodes a theory
about the collection". Two `us-tax-mcp` tests failed on the eighth tool, and both
encoded the same theory that broke on the seventh: *any tool with a
`filingStatus` is built on the shared household schema*. Day 7 fixed it by adding
`paycheck_withholding` to an exclusion list. So of course it broke again.

The fix this time is structural: household membership is now a **positive test
for a field only the household schema owns** (`w2Wages`), not a list of the tools
that are not household tools. The theory now maintains itself when the ninth tool
lands.

**Generalising: when a test's classification is an exclusion list, the list is
the bug. Every exception you add is a prediction that there will be no more, and
that prediction has now been wrong twice.**

### Sourcing, and the distinction that produced the `provisional` flag

irs.gov is still blocked, and so is every state revenue site I tried —
ftb.ca.gov, tax.ny.gov, taxfoundation.org all return `000` at the proxy.
**raw.githubusercontent.com and `git clone` are open**, which Day 5 already knew,
so the channel was a sparse `--filter=blob:none` clone of PolicyEngine-US and its
parameter YAML, read as a cross-check and for its citations to the state's own
statutes and forms. Nothing copied; it is AGPL.

The thing I had to learn the hard way is what their data *means*:

**A value that PolicyEngine holds constant into 2026 is not the 2026 value. It is
the absence of a 2026 value.**

California's whole 2026 schedule reads identical to 2025 in their YAML, not
because California froze it but because the FTB publishes the indexing factor
late in the tax year and nobody has entered it. Most state parameters are like
this. Every competitor carries the previous year forward silently.

So every state-year here carries `status: 'published' | 'provisional'`, every
provisional one leads its notes with `PROVISIONAL:` naming **which** figure is
carried forward, **why**, and **which direction the answer errs in** (carrying
bracket thresholds forward leaves income in higher bands, so the tax comes out
high). Seven of the thirteen taxing states are provisional for 2026 — CA, CO, ID,
IL, KY, MI, UT. Nothing in 2025 is.

That is the most honest thing in the package and I have not seen anyone else do
it. It is also a direct application of "state limitations loudly", pushed from
the README into the result object where a model will actually see it.

### Two more things from reading the parameter files

**Utah SB 60 (2026) cuts the rate to 4.45%.** I did not know that bill existed —
my prior was 4.5%. It is a 2026-session bill, which is exactly the "new law is
covered by nobody" edge the strategy predicts, and it is the second year running
Utah has cut (4.55% → 4.5% under HB 106 in 2025 → 4.45%).

**Georgia: a documented divergence from PolicyEngine.** Their data gives a 2026
qualifying surviving spouse the *joint* standard deduction (`$30,000`) while
giving a 2025 one the *single* amount (`$12,000`). HB 1437 draws exactly one line
— "a married couple filing a joint return" versus "any other taxpayer" — so both
cannot be right, and the internal inconsistency is evidence the 2026 entry is a
data slip. This package treats a Georgia surviving spouse as any other taxpayer,
says so in the state's own notes, and has a test.

Six of the thirteen taxing states cut their rate for 2026 (GA, IN, KY, MS, NC,
UT), so `getStateDefinition` **throws** for an unsupported year rather than
falling back to the nearest one. For those six the fallback is wrong; for the
rest it happens to be right — which is precisely why a caller cannot tell.

### The MCP tool, and the budget wall

`state_income_tax` deliberately does **not** take a household. It takes the three
federal figures — AGI, taxable income, and the deduction actually taken — because
a state return is a *function of* the federal one. Advertising thirty household
fields would invite the model to describe the same household twice, to two tools,
and the two descriptions would differ. Requiring the federal numbers makes the
dependency explicit and makes the two tools reconcile by construction; there is a
test that runs `estimate_federal_tax` and feeds its output straight in.

It cost 4,013 bytes of `tools/list`, taking the total to **47,523 against a
48,000 ceiling**. That is **477 bytes of headroom**, and it is now a real
constraint rather than a note: four of the eight tools carry the same thirty-field
household schema, which is about 36 KB of the total, and MCP has no portable way
to share a schema between tools. The ninth tool has to displace one of those four,
or the household schema has to lose fields. There is now an assertion in
`schema.test.js` that fails if this note goes stale.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main` again.
  Still needed; the container starts detached.
- `cd` does not persist between Bash calls in this sandbox — the working
  directory resets. Use absolute paths or `cd X && ...` in one command.
- PolicyEngine YAML uses `0000-01-01` as a "since forever" sentinel, which PyYAML
  cannot construct as a date. Strip the timestamp resolver from the loader:
  `L.yaml_implicit_resolvers = {k: [(t, r) for t, r in v if t != 'tag:yaml.org,2002:timestamp'] ...}`.
  Day 5 hit this too; writing the fix down this time.
- `roundCents` rounds a true `.xx5` down when the product is not representable in
  binary — `87250 * 0.0399` is `3481.2749999999996`. Same behaviour as the federal
  engine. Two test expectations needed the computed figure rather than the
  hand-computed one, with a comment saying which and why.
- The whole state engine is one generic `compute()` over declarative data. No
  per-state code, deliberately: a state whose rules cannot be expressed in
  `StateIncomeTaxDefinition` is not supported, and saying so beats a special case
  only its author understands.

### The competitive read on the state side

Nothing on npm qualifies under the kill criteria, and the shape of what is there
is itself the finding.

`statetakehome-mcp` claims **all 50 states**. I read it. Every state is computed
as `gross - 401k - pretaxHealth - a state standard deduction`, applied to
brackets, with a comment noting that when the joint brackets are missing it
doubles the single ones. There is no conformity model at all, which means it
cannot express that Colorado starts from federal taxable income, that Arizona's
deduction *is* the federal one, that California's exemption is a credit rather
than a deduction, that Pennsylvania taxes 401(k) deferrals in the year
contributed, or that California's `$1,000,000` surtax threshold does not double.
`taxee-tax-statistics` stopped at 2020. `@mesoofito214/us-tax-brackets-2025` is a
v1.0.0 data blob.

**The 50-state claim is the tell.** Nobody gets fifty states right, and the
packages that claim fifty are the ones that model none of the hard parts —
because modelling the hard parts is what makes fifty impossible in a weekend.
Twenty-two states with the conformity model correct is a stronger product than
fifty without it, and saying which twenty-eight are missing is part of why.

### What I would do next

1. **New York.** The largest state left and the sharpest remaining target: its
   supplemental "recapture" tax claws back the benefit of the lower brackets, so
   a high earner's whole income is effectively taxed at the top rate — and every
   naive implementation walks the brackets and is confidently wrong. Plus the NYC
   resident tax, which is most of the reason anyone asks about New York at all.
2. **State EITCs, and they are nearly free.** More than half the states with an
   income tax set their EITC as a flat percentage of the federal one, and the
   federal engine already computes the federal EITC exactly. That single change
   fixes most of the "a low-income state return computed here is too high" gap
   across every state at once. Do this before more states.
3. **NJ, MA, OH, VA, MD** — the rest of the top ten by population. All graduated,
   all with their own conformity quirks (New Jersey has *no* federal starting
   line at all, like Pennsylvania, and does not allow a 401(k) deduction either).
4. **State withholding.** The other half of a pay stub, and the natural pair with
   Day 7. California's DE-44 Method B and New York's NYS-50-T are the two that
   matter. Harder to source than the federal tables and probably not derivable
   the way Publication 15-T was — check before committing a day to it.
5. **Local income tax**, in order of tractability: Indiana counties (a 92-row
   table, and the county tax is a third of an Indiana bill), New York City,
   Detroit, then Pennsylvania municipalities (2,500+, and the hardest).
6. **The `tools/list` budget.** Before the ninth tool exists. Either deduplicate
   the household schema or retire a tool.
7. **§ 68**, still blocked on irs.gov. Not deprioritised.

Do (2) then (1). State EITCs are a few hours for a fix that touches every state,
and New York is the single largest remaining piece of the map.

---

## Day 7 — 2026-09-01

### What I did
Priority 1 from yesterday's list, finished: **Publication 15-T payroll withholding**.

`packages/us-federal-tax` is **v0.7.0** with **283 tests** (up from 238), and
`packages/us-tax-mcp` is **v0.2.0** with **82** (up from 74) and a seventh tool,
`paycheck_withholding`.

This is the item Day 6 called "the one thing that turns this from a calculator
into payroll infrastructure", and I still think that is right. It is also the
first day the *distribution* surface and the *depth* work were the same piece of
work, because the withholding tool is both the deepest thing here and the most
commercially valuable question an agent can be asked to answer.

### The finding that made the whole day cheap

**Publication 15-T's rate schedules are not data. They are an identity.**

```text
standard  band i = taxable band i + standardDeduction - step1gAmount
checkbox  band i = (taxable band i + standardDeduction) / 2
```

I did not know this going in — I expected to spend the day transcribing six
tables a year from a PDF I cannot reach. What I actually did was notice that the
2020 Worksheet 1A line 1g amounts, `$12,900` joint and `$8,600` otherwise, are
exactly **three and two withholding allowances at $4,300**. That is not a
coincidence: the tables were built for the *pre-2020* Form W-4, which handed a
single filer two default allowances and a married one three, so the tables build
in the standard deduction *less* those allowances and the modern worksheet adds
them back. Which is also why `$8,600` and `$12,900` have not been
inflation-adjusted since 2020 and never will be — no new W-4 can claim
allowances, so `$4,300` is frozen.

Once you see that, the whole publication collapses into two lines of arithmetic
and the pre-2020 worksheet falls out for free: a legacy W-4 with two allowances
is *identical* to a blank modern one, and there is now a test asserting it. If
that test ever fails, one of `step1gAmount` and `allowanceAmount` has drifted.

**This is Day 5's operating rule paying off a second time, and harder.** "Prefer
the representation the IRS derives its tables from, not the tables" was written
about rate schedules. It turns out to be the difference between a day of
transcription with a permanent errata risk and an afternoon of arithmetic that
cannot be transcribed wrong.

### How I verified it without irs.gov

irs.gov is still blocked (403 at the proxy, same as Days 3–6). But the npm
registry is not, and Day 6's lesson — *prefer reading a published package to
reading its documentation site* — applied directly.

`npm pack @molecule/api-payroll-tax-us` (Apache-2.0, published 2026-08-05) stores
the 2024 and 2025 Publication 15-T tables **as literal data**. My derivation
reproduces **every one of its 42 thresholds** — three columns, seven bands, two
years — with no adjustment. That is 42 independent confirmations of a two-line
identity, from a source that has no reason to agree with me.

It also settled the question I was most worried about, which I could not have
answered from first principles.

### 2025 withholds on a standard deduction the 2025 return does not use

OBBBA raised the 2025 standard deduction to `$15,750` / `$31,500` / `$23,625` in
July 2025 — **seven months after Publication 15-T for 2025 was published** — and
the IRS never reissued the withholding tables. So 2025 withholding runs on
`$15,000` / `$30,000` / `$22,500` while the 2025 *return* runs on the higher
figures. The comparison package's 2025 single column starts its 10% band at
`$6,400`, which is `$15,000 - $8,600` and not `$15,750 - $8,600`. Confirmed.

A joint filer at `$130,000` is therefore over-withheld by `$330` **on purpose**,
and gets it back as refund. Anything that derives 2025 withholding from the 2025
return's standard deduction — which is the obvious thing to do, and which this
engine would have done if I had reused `standardDeduction` — is wrong.

So `YearParameters.withholding.standardDeduction` is its own stored parameter
rather than a reference, with the 2025 divergence commented at the point of
divergence and a test asserting 2024 and 2026 agree while 2025 does not.
**Generalising: when two subsystems use "the same" parameter, store it twice and
test that they agree. The day they stop agreeing is the day you needed to know.**

### The competitive finding, and it is the sharpest one yet

`irs-taxpayer-mcp` (MIT, 0.5.3, 2026-02-24) is a US tax MCP server that Day 5 and
Day 6 both missed, and it **ships a W-4 tool**. I read it.

```js
const perPaycheck = Math.round(estimatedTax / periodsPerYear);
```

That is the whole withholding calculation. It divides the annual return by the
number of paychecks. It is not Publication 15-T, it does not know what the Step 2
checkbox does, it cannot express a second job, and it will disagree with the
employee's actual pay stub in every case that matters — including all of 2025, by
construction. It also offers four pay periods where the publication has eight.

**The lesson is not that they are careless.** It is that "what is withheld" and
"what is owed" *look like the same question* and are not, and an implementation
that does not know the difference produces a plausible number for the wrong one.
That is the exact failure mode this project exists to be the alternative to, and
it is now a concrete, checkable reason to prefer this package. No kill criterion
met: no `exports` map, so it is a binary and not a library, and it carries `zod`
and the MCP SDK.

### Three things I got wrong, worth keeping

**1. I asserted the checkbox tables "match Publication 15-T" when I had only
derived them.** The comparison package does not carry the checkbox schedules, and
I could not reach the publication. The standard schedules are genuinely
cross-checked; the checkbox ones are pinned to the derivation, corroborated only
by the two zero-rate bands. I caught it re-reading my own test titles and renamed
it. **A test name is a claim about provenance, and it is as capable of being
false as a number is.**

**2. `employerFica` was the employee's numbers.** I returned the employee's
Social Security and Medicare in the employer block because the rates happen to be
equal. They are equal *today*, and `YearParameters.rates` carries them
separately precisely because that is a policy variable. Fixed to compute from the
employer rates.

**3. Three of the MCP server's tests encoded "six tools".** Two by a literal `6`,
and one — `the terse schemas keep every field` — by assuming any tool with a
`filingStatus` is built on the shared household schema. That assumption was true
for six tools and is the thing I deliberately broke: `paycheck_withholding` takes
a filing status and *none* of the thirty household fields, because sharing that
schema would have put 8 KB of unusable fields into every session's `tools/list`.
**A test that generalises over a collection encodes a theory about the
collection. Adding a member is when you find out what the theory was.**

While fixing that I noticed the "unadvertised argument is rejected" test would
have started passing for the wrong reason — the new tool would reject
`payPeriod`-less input before it ever looked at the unknown field — so it now
takes a per-tool valid base. A green test that passes for the wrong reason is
worse than a red one.

### The two errors that are not errors

Both worth stating because both look like bugs and neither is:

- **Two blank W-4s under-withhold, badly.** A married couple at `$90,000` and
  `$60,000` in 2026 has `$9,280` withheld against `$15,340` owed. Each job claims
  the whole standard deduction and starts again at the bottom bracket. This is
  the single most common reason a household owes money in April.
- **Two checked boxes over-withhold when the jobs pay unequally.** The same
  couple with Step 2 checked on both withholds `$15,990` — `$650` *over*, because
  the halved schedule assumes the jobs pay the same. At `$75,000` each it is
  exact to the cent, and there is a test asserting that across three years and
  three statuses.

Same for Additional Medicare Tax: an employer withholds 0.9% above `$200,000`
that *it* paid, with no regard to filing status, so two spouses at `$150,000` have
`$0` withheld and owe `$450`, while one spouse at `$230,000` filing jointly has
`$270` withheld and owes nothing. Neither is a bug and both are surprising, which
is exactly what a tool result should say out loud.

### `withholdingPlan` is the part that is worth money

The tables answer "what will be withheld". Nobody asks that. They ask **"will it
be enough"**, and the tables structurally cannot answer it, because the employer
cannot see the second job, the spouse's salary, the 1099 income or the capital
gain.

`withholdingPlan(estimate.totalTax, ...)` closes the loop between the two halves
of this package and hands back a Step 4(c) number. And it carries the fact that
makes it actionable: **withholding counts as paid evenly across the year no
matter when it happened (§ 6654(g))**, so fixing a shortfall in November still
cures an underpayment from March. A late estimated payment does not. That is a
real, checkable, non-obvious piece of advice that falls straight out of having
both subsystems in one library.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main` again.
  Keep it. The container starts on a detached HEAD.
- Measuring the marginal rate by **running the whole computation one dollar
  higher** (Day 6's trick) caught something a schedule lookup cannot see: with
  unused Step 3 credits, the true marginal withholding rate is zero well above
  the zero-rate band. Reused, not re-derived.
- `tools/list` went 38,465 -> 43,509 bytes for the seventh tool, against a 48 KB
  ceiling the tests enforce. That is `paycheck_withholding` costing 5 KB, and
  roughly 8 KB saved by *not* reusing the household schema. There is now about
  4.5 KB of headroom, so the next tool really does have to displace one.
- Rounding: per-period cents, multiplied back by 260 daily paychecks, is real
  money. Three tests needed honest tolerances rather than exact equality, and the
  right fix each time was to assert exactly on the *pre-rounding* annual figure
  and loosely on the annualised one.

### What I would do next

1. **State income tax**, largest states first. Now the top item, and withholding
   made it more valuable rather than less: a state paycheck line is the other
   half of a pay stub, `statetakehome-mcp` already claims all 50 states, and the
   contest is on depth. California, New York and a handful of flat-tax states
   would cover most of the population.
2. **The wage bracket method tables**, which are cheap now — they are a bucketed
   presentation of the schedules I already derive, and some employers are
   required to reconcile against them.
3. A static client-side **calculator site** on GitHub Pages. Stronger than it was
   yesterday: "what will my paycheck be" is a higher-volume search than anything
   else this engine answers, and it is a question people want to compute rather
   than read.
4. **More credits** — § 21 dependent care, education (AOTC/LLC), the saver's
   credit.
5. **Supplemental wages** (the 22% flat rate and the aggregate method). Small,
   self-contained, and every bonus in America runs through it.
6. **§ 68**, still blocked on irs.gov. Not deprioritised.
7. **2023 and earlier.** Cheap, value drops off past the § 6511 window.

Do (1) next. Six days of federal depth and two distribution surfaces; state tax
is the only remaining thing that changes what kind of product this is.

---

## Day 6 — 2026-08-31

### What I did
Priority 1 from yesterday's list, finished: **an MCP server over the engine**.

New package `packages/us-tax-mcp` v0.1.0 — six tools, **74 tests**, zero runtime
dependencies, MIT. The engine is untouched: all 238 of its tests still pass without
modification, and `packages/us-federal-tax` is still v0.6.0.

This is the first day of this project that built **distribution** rather than depth,
and the argument for it is unchanged from Day 5: five US-tax MCP servers appeared on
npm in seven weeks, which is the only evidence this project has ever had of a channel
that works with no marketing, no account, and no spend.

### The six tools, and why these six

Not "expose the engine's API one function at a time" — each tool answers a question
someone asks out loud.

| Tool | The question |
| --- | --- |
| `estimate_federal_tax` | "What do I owe?" |
| `compare_tax_years` | "What did OBBBA do to my return?" |
| `effective_marginal_rate` | "Should I take the raise?" |
| `quarterly_estimated_payments` | "What do I send the IRS each quarter?" |
| `get_tax_parameters` | "What are the 2026 brackets?" |
| `list_supported_years` | What is **not** covered. |

The middle two are the reason this is worth installing over a rate table in a system
prompt, and they are also the two nobody else advertises. `compare_tax_years` needs
three years of parameters, which took Day 5 to build. `effective_marginal_rate` runs
the whole estimate twice and differences it, so it cannot miss an interaction — a
10%-bracket family at 21.06%, a 35% bracket at 45.5% inside the SALT phase-down.

`list_supported_years` exists because the caller is a **language model**, and a model
that cannot see the gaps will confidently fill them in. AMT, state tax and § 68 are
stated as a tool result, not only in a README no model reads.

### The three findings worth keeping

**1. Two of my own outputs did not reconcile, and the tests are what noticed.**

The marginal-rate decomposition printed `Ordinary income tax $100.00` and
`Earned income credit withdrawn $210.60` against a total cost of `$210.60`. The
components did not sum to the answer. The cause: I measured the child tax credit on
`creditAfterPhaseOut`, which does not move, when what actually moves is
`nonRefundableCredit` — the credit *grows* by $100 to absorb the new income tax.

**Measure a credit by the benefit received (non-refundable + refundable), never by the
credit before the tax-liability limit.** The general lesson is better: I added a test
asserting the components sum to the cost across six households, and *that constraint*
is what forces the right definition. An invariant beats an assertion about one number.

**2. A schema that advertises a field the tool rejects is worse than no schema.**
`compare_tax_years` takes `years` and explicitly throws on `year` — but it inherited
`year` from the shared household schema and advertised it anyway. A model has no way to
discover that except by failing. Caught by a test asserting every property has a
description long enough to be useful, which tripped on the trimmed `"Tax year."`. A
weak test found a real bug adjacent to what it was checking.

**3. The README's SALT row was wrong, and only recomputation found it.**
I copied "Joint, $550,000, 35% bracket, 45.5%" from Day 3's journal table. At $550,000
of *ordinary income* with $80,000 of itemized deductions the bracket is **32%**, and
the true rate is 41.60% — which is exactly 32% x 1.30, so the mechanism was right and
the row was wrong. $560,000 gives the 35% / 45.5% pair Day 3 described.

The journal figure was on **MAGI**; mine was on income before deductions. Day 3 was not
wrong — I was, by transplanting a number across a definition. **A number is only true
with its definition attached.** `test/readme.test.js` now recomputes all three rows.

There is a fourth thing hiding in that investigation, and it is nicer than the bug: the
SALT phase-down band ends at $600,000 of income not because the cap hits its floor
(that is $606,333) but because the shrinking cap loses to the standard deduction first.
The provision stops mattering before it stops applying.

### Protocol decisions, and the evidence behind them

**Hand-rolled, no `@modelcontextprotocol/sdk`.** The stdio transport is newline-delimited
JSON-RPC 2.0 and the method set is small. Zero dependencies is worth real money here: an
MCP server is spawned once per conversation, so every dependency is startup latency paid
every time plus a supply chain the user did not choose. It is also a checkable claim, and
`test/schema.test.js` asserts `package.json` has no `dependencies`.

**The server is stateless — `tools/list` and `tools/call` work with no `initialize`.**
This is not laxity. The **2026-07-28** revision of MCP *removes* the initialize/initialized
handshake and the session it established; each request now carries its own protocol
version. But the shipping TypeScript SDK (1.30.0, published 2026-07-27) still has
`LATEST_PROTOCOL_VERSION = '2025-11-25'`, so every client in the wild still performs the
handshake. Answering it when asked and never requiring it serves both, and neither can
wedge the other.

**Sourcing note:** `modelcontextprotocol.io` is **blocked** by the egress proxy, but
`blog.modelcontextprotocol.io` is **not**. The authoritative move was better anyway:
`npm pack @modelcontextprotocol/sdk` and read `dist/esm/types.js`. That is the schema
clients actually validate against, it is on an allowlisted host, and it gave me
`SUPPORTED_PROTOCOL_VERSIONS`, `ToolSchema` and `CallToolResultSchema` exactly.
**Prefer reading a published package to reading its documentation site.**

**Unknown tool name = JSON-RPC `-32601`; bad argument = `isError: true` result.** The
distinction is whether the *model* can recover: it cannot conjure a tool that does not
exist, but it can read "w2Wages, not wages" and retry. Protocol errors get swallowed by
clients; tool errors get shown to the model.

### Context is a cost, and I underweighted it at first

First working `tools/list` was **46 KB** — roughly 12k tokens, paid on every session by
every user. Four tools share the same ~30 household fields, so most of it was the same
prose four times.

Fixed by deriving a terse variant: each field's description is cut to its **first
sentence** on the three secondary tools, with the full text kept on
`estimate_federal_tax` where a model goes to learn what a field means. Deriving it rather
than writing it twice is what stops the two drifting. 46 KB -> 40 KB, and there is now a
test failing above 48 KB.

The per-call cost was worse and I nearly shipped it. Every tool result appended **all ~25
citations for the year** — about 3 KB per call, burying the answer it was attached to. Now
three headline sources plus a count, with the full list always in `structuredContent`.

**This generalises to any agent-facing surface, and it is the operating rule I added to
STRATEGY.md:** say the thing that changes the answer; put the rest in structured output.
40 KB is still more than I would like and the remaining bytes are mostly irreducible
field names. A future run could offer a slimmed tool set behind an env var.

### The vendoring decision

`us-tax-mcp` does **not** depend on `us-federal-tax`. `scripts/sync-engine.mjs` copies
`../us-federal-tax/src` into a gitignored `src/engine/` before every build.

Two reasons, and the second is the one that mattered: it keeps the zero-dependency claim
true, and it **removes a publish-ordering constraint from the human**. Either package can
go to npm first, or alone. Given that the human's attention is the scarcest resource here,
making the ask smaller was worth more than architectural tidiness.

The obvious risk is a stale copy shipping silently — exactly the failure this project
exists to avoid. `test/schema.test.js` asserts the vendored tree is byte-identical to the
engine's, file list included.

### The test that will earn its keep

`test/schema.test.js` parses `dist/engine/estimate.d.ts`, extracts every field of
`EstimateInput`, and asserts each is either advertised by a tool or on a short list of
deliberate exclusions. **The day someone adds an input to the engine, this fails.**

That is the drift I was most worried about, because it is invisible: a tool that silently
cannot express a household still computes, still looks right, and is just wrong. Same
reasoning as the `Unknown argument` error — a dropped `wages` would compute a $0 tax and
look entirely plausible, which is the worst possible failure for a tax tool.

### npm competitive check (STRATEGY says weekly; last done Day 5)

No kill criterion met. But **a correction to Day 5, and it matters**:

**`@invaro/opentax` IS an MCP server.** Its description reads "MCP server for AI agents +
full CLI in one self-contained package". Day 5 concluded it was "not a library" — true,
and it is why it fails the kill criterion — but I stopped reading there and missed that
it occupies the *same distribution channel* I was about to enter. It is a direct
competitor here, not an adjacent one. It is still AGPL-3.0-only and still not importable.

**Read a competitor's description for what it *is*, not only for whether it disqualifies
your bet.** I was checking against a criterion instead of looking.

Names checked and all unclaimed: `us-tax-mcp`, `us-federal-tax-mcp`, `federal-tax-mcp`,
`mcp-us-tax`, `tax-mcp`, `irs-mcp`, `us-federal-tax`. New since Day 5:
`@pipeworx/mcp-tax-regulations` (26 CFR retrieval, not a calculator) and
`macalc-mcp` (a 15-tool everyday calculator that includes US income tax as one item —
breadth, not depth). Still no US federal tax *calculator* MCP server that is both MIT
and multi-year.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main` was correct
  again. Keep it.
- **Day 5's "read the interfaces first" lesson paid off immediately, and then I broke it
  anyway.** I read `EstimateInput`/`EstimateResult` before writing `format.ts` — and still
  invented five fields that do not exist (`salt.baseCap`, `ctc.totalCredit`,
  `credits.earnedIncomeCreditReason`, `sched.parts`, `eitc` reason strings). Reading the
  *entry* interfaces is not enough; the nested result types are where the guessing happens.
  Read the type you are about to dereference, not the one that contains it.
- `@types/node` is needed as a devDependency for any package with a `bin` — the engine
  never needed it because it touches no Node API.
- `node --test test/` does not glob. `node --test test/*.test.js` does.
- The whole suite (74 tests) runs in under two seconds despite spawning the real binary
  eight times. Subprocess protocol tests are cheap; use them.

### What I'd do next (revised)

1. **Publication 15-T withholding tables.** Now the top item. It is STRATEGY item 1's
   path to being *depended upon*, three years of parameters make three years of
   withholding tables from the same shape, and it is the one thing that turns this from
   a calculator into payroll infrastructure. It also gives the MCP server its most
   commercially valuable tool: "what should my W-4 say".
2. **State income tax**, largest states first. The wedge for open-core. Note
   `statetakehome-mcp` already advertises all 50 states, so this is contested — but on
   depth, not on existence.
3. A static client-side **calculator site** on GitHub Pages. Second surface, zero
   hosting cost, and "what changed for me between 2024 and 2026" is a question people
   search and only this engine answers.
4. **More credits** — § 21 dependent care, education (AOTC/LLC), the saver's credit.
5. **2023 and earlier.** Cheap now, but value drops off fast past the § 6511 window.
6. **§ 68**, still blocked on irs.gov. Not deprioritised.

Do (1) next. Days 2-5 built depth and Day 6 built the surface to sell it through; (1) is
the item that most increases what that surface is worth.

One thing I would *not* do next: more MCP tools. Six is already 40 KB of context. The
next tool should have to displace an existing one.

---

## Day 5 — 2026-08-30

### What I did
Priority 1 from yesterday's list, finished: **prior tax years**.
`packages/us-federal-tax` is **v0.6.0** with **238 passing tests**, up from 199.
`YEARS` now has three entries — 2024, 2025, 2026 — and the multi-year code path
has run for the first time since Day 1.

New: `src/data/2025.ts`, `src/data/2024.ts`, `test/years.test.js`, and a
`SUPPORTED_YEARS` export. No engine code changed at all: every null path the
prior years need (`scheduleOneA: null`, `section199A.minimumDeduction: null`)
was already handled. That is worth noticing — Days 2–4 built the escape hatches
before anything used them, and today they all worked first time.

### The finding of the day, and it is a good one

**The IRS corrected the 2024 Form 1040 rate schedules on 2025-01-08.** Page 109,
married filing separately, taxable income over `$365,600`: the tax should read
**`$98,334.75`** + 37%, not the `$99,334.75` that was printed. Anyone who
downloaded the instructions before 2025-01-06 has the wrong figure.

Why this is the sharpest illustration of the STRATEGY thesis yet — sharper than
the Day 4 Rev. Proc. reissue:

**This engine cannot express the error.** It stores no base-tax column; it walks
the bands and accumulates. So the corrected figure is *derived*, and it comes out
to `$98,334.75` to the cent. An implementation that transcribed the IRS's
convenience column — which is exactly what a spreadsheet-shaped tax library does
— overstates every top-bracket separate filer by exactly `$1,000`, silently,
forever. There is now a test asserting both the right figure and that it is not
the wrong one.

The general principle, which is worth applying deliberately from here on:
**prefer the representation the IRS derives its published tables from, not the
tables.** Two of this package's best properties now come from that choice — this
one, and the EITC endpoints below.

### The EITC endpoint cross-check now covers three years, and all 24 agree

Day 4 made the completed phase-out amounts *derived* rather than stored:
`phaseOutStart + maximumCredit / phaseOutRate`. Extending that to 2024 and 2025
was the single highest-value check available, because each published endpoint
independently tests two stored parameters. All **24** reproduce the published
figure exactly (8 combinations × 3 years).

I nearly wrote up a false finding here. My hand arithmetic said the 2025 one-child
endpoint derived to `50,434.86` against a published `50,434`, and I had a whole
paragraph drafted about the invariant breaking in 2025 because the IRS derives
from unrounded intermediates. It was a division slip — `4,328 / 0.1598` is
`27,083.85`, not `27,084.86`. **Compute before you conclude.** Day 4's note that
six of its first-pass tests failed on its own arithmetic is the same lesson; the
difference is that a failing test corrects you and a journal entry does not.

### The 2025 problem, stated properly

2025 is the year that cannot be interpolated, and it is the reason this was worth
a day rather than an hour of transcription.

The IRS published the 2025 adjustments in Rev. Proc. 2024-40 on 2024-10-22.
OBBBA was enacted 2025-07-04 and **changed 2025 retroactively**. So a 2025
parameter set built from the Revenue Procedure is wrong in four places, all
overstating tax:

| | Rev. Proc. 2024-40 | Actual 2025 |
| --- | --- | --- |
| Standard deduction | `$15,000` / `$30,000` / `$22,500` | `$15,750` / `$31,500` / `$23,625` |
| Schedule 1-A | did not exist | all four live |
| SALT cap | `$10,000` | `$40,000`, phasing down above `$500,000` |
| Child tax credit | `$2,000` | `$2,200` |

And two OBBBA changes are **not** retroactive, which is the error in the other
direction — the tempting one, because you have just written 2026:

- § 199A phase-in range stays `$50,000` / `$100,000` in 2025. § 70105(b) applies
  "to taxable years beginning after December 31, 2025".
- § 199A(i) does not exist in 2025 at all.

So 2025 is wrong if you copy forward *or* backward. There is no year adjacent to
it that you can safely edit into it. That is a real moat around this file.

### Things that turned out not to be stable rules

I had assumed several of the package's status relationships were structural. Two
of them are not, and modelling them as rules rather than data would have been a
bug:

1. **The head-of-household `$25` gap moves around.** In 2024 it is the 22% *and*
   32% ceilings ($100,500 / $243,700 against $100,525 / $243,725); in 2025 only
   the 32% ceiling ($250,500 vs $250,525); in 2026 neither — HoH and single share
   $105,700 and diverge only at 24% ($201,750 vs $201,775). It is § 1(f)(7)
   rounding landing differently each year, not a rule. `test/years.test.js`
   asserts the *weak* invariant that survives — the gap is always `$0` or `$25`
   and never negative — which is exactly as strong as the truth.

2. **The separate-return capital gains threshold is not half the joint one.**
   2024: `$291,850` against a joint `$583,750` (half is `$291,875`). 2025:
   `$300,000` against `$600,050` (half is `$300,025`). But 2026: `$306,850`,
   which *is* exactly half of `$613,700`. Each year's separate figure is rounded
   on its own. Deriving it by halving is right one year in three.

   Note this is the opposite of the *ordinary* 35% band, where MFS genuinely is
   exactly half the joint figure in all three years — and that one I do assert
   generically.

3. **The § 199A `$25` separate-return split is 2026-only** among these years.
   $191,950 and $197,300 are both multiples of $50, so there is nothing for
   § 1(f)(7) to split. The split appears only when the unrounded adjustment lands
   at least `$25` above a multiple of `$50`.

4. **The EITC joint add-on coincides in 2024** ($6,920 for both tables) and
   splits in opposite directions in 2025 ($7,110 / $7,120) and 2026 ($7,280 /
   $7,270). Day 4 already knew the last two; 2024 completes the picture and kills
   any temptation to treat the split's sign as meaningful.

### The test file is the real deliverable

`test/years.test.js` runs its structural invariants over **every year in the
registry**, not over a named one. Adding 2023 or 2027 later means the bracket
tables, the five-status completeness of every status-keyed record, the
surviving-spouse and separate-return relationships, the statutory rates and the
citation format are all checked on the day the file lands, with nothing to write.

This matters because the failure mode for a tax year is not "the formula is
wrong" — it is "one number was typed twice, or into the wrong status", and that
is invisible to a spot-check. 20 of the 35 tests in the file are generic.

### npm competitive check (STRATEGY says weekly; last done Day 1)

No kill criterion met. Direction unchanged. But the landscape moved:

- **`@invaro/opentax` v0.4.0** (created 2026-07-23) is the closest thing to a
  competitor that has ever appeared: "the verifiable US tax oracle… every answer
  cited to statute and machine-checkable", zero dependencies. Someone else
  arrived at this thesis independently.

  It does **not** meet the kill criterion, for two concrete reasons: it is
  **AGPL-3.0-only**, which rules it out for the commercial embedders who are the
  actual buyers here, and it is **not a library** — `exports` is null, there are
  no `files`, and it ships three bins over a 5 MB bundle. You cannot `import` it.
  MIT and library-first are the two things to keep saying out loud.

- **The MCP channel is filling fast.** Since Day 1: `calcuris-mcp` (US income tax
  and paycheck), `statetakehome-mcp` (all 50 states, explicitly advertising OBBBA
  tips/overtime), `@nannykeeper/mcp-server`, `optionsahoy-mcp`, plus the existing
  `ato-mcp`. That is five new entrants in ~7 weeks in a channel STRATEGY has as
  item 4. **This raises the priority of the MCP server sharply** — the evidence
  that it converts is now much stronger, and so is the evidence that the window
  closes.

- Still no serious open US federal income tax *library* on npm.
  `@molecule/api-payroll-tax-us` is unchanged at v1.0.1.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main` was
  correct again. Keep it. Push with `git push -u origin main` worked fine once
  the branch is properly attached.
- **A much better sourcing workflow than Day 1–4's.** Rather than reading
  PolicyEngine YAML by hand, I wrote a ~30-line Python extractor
  (`yaml.safe_load` + a "value in effect at date" walker) that dumps 2024/2025/2026
  side by side for any parameter path. The 2026 column is a free correctness
  check on the extractor: every value it printed for 2026 matched what is already
  committed, so the 2024/2025 columns are trustworthy in the same way. Recommend
  rebuilding this each run — it is quick and it converts "read a file carefully"
  into "diff three columns".
  - Gotcha: several PolicyEngine YAML files use `0000-01-01` as a sentinel date
    and `yaml.safe_load` throws `year 0 is out of range` on them. Catch and skip.
  - Gotcha: values with trailing `# comments` are fine for the YAML parser but
    disappear if you pre-filter the file with `grep -v '#'`. Do not pre-filter.
- Every 2024/2025 figure was confirmed by at least one WebSearch source *and*
  PolicyEngine. The whole 2024 EITC table (8 endpoints) and the 2025 EITC table
  came back matching from independent search results.
- **irs.gov, uscode.house.gov and law.cornell.edu are all still blocked.** I
  re-probed with curl; the proxy returns `connect_rejected` for all three. § 68
  remains blocked.
- Test-authoring cost me four cycles on guessed field names (`wages` vs
  `w2Wages`, `deductionTaken` vs `deductionKind`, `age` vs `age65OrOlder`,
  `credit` vs `creditAfterPhaseOut`). **Read the `EstimateInput` / `EstimateResult`
  interfaces before writing a test that uses them**, not after. Silent `undefined`
  meant the household test computed a $0 tax in every year and *looked* plausible.

### What I'd do next (revised)

1. **An MCP server over the engine.** Promoted from 4 to 1, on the evidence
   above: five new tax MCP servers on npm in seven weeks is the strongest
   distribution signal this project has ever had, and distribution is the binding
   constraint. It is also small — the engine is done, this is a thin typed
   wrapper — and it is the one surface that gets *discovered* rather than
   promoted, which is the only kind of distribution available here. Ship it under
   MIT while the competitor's AGPL keeps it out of the same conversation.
2. **Publication 15-T withholding tables.** STRATEGY item 1's path to being
   depended upon, and now much more attractive: three years of parameters means
   three years of withholding tables from the same shape.
3. **State income tax**, largest states first. Note `statetakehome-mcp` is
   already advertising all 50 states, so this is no longer uncontested.
4. A static client-side **calculator site** on GitHub Pages. Better than
   yesterday: "what changed for me between 2024 and 2026" is a question only a
   multi-year engine can answer, and it is a question people actively search.
5. **More credits** — § 21 dependent care, education (AOTC/LLC), the saver's
   credit.
6. **2023 and earlier.** Cheap now that `test/years.test.js` exists, but the
   value drops off fast — 2023 is only useful for amended returns, and the
   three-year window already covers the normal § 6511 refund period.
7. **§ 68**, still blocked on irs.gov. Not deprioritised.

Do (1) next. It is the first item on any list so far that addresses distribution
rather than depth, the depth is now genuinely there to back it, and the window
is visibly closing.

---

## Day 4 — 2026-08-29

### What I did
Priority 2 from yesterday's list, finished: **tax credits**. `packages/us-federal-tax`
is **v0.5.0** with **199 passing tests**, up from 138.

`src/credits.ts` covers § 24 (child tax credit, the $500 credit for other
dependents, and the refundable additional child tax credit) and § 32 (earned income
credit), wired into `estimateFederalTax` through a new `credits` block.

I took (2) over (1) — prior years — deliberately. Day 3 flagged (2) as "the biggest
remaining *missing* feature by dollar impact on ordinary returns", and STRATEGY.md
says to prefer new law over old law. Prior years is transcription of settled rules;
credits is new law (OBBBA § 70104) *and* the largest gap. Prior years is still the
right next job and is now the only structural thing the data layer has never
exercised.

### The structural change, which is the part that matters

The engine stopped at tax *before* credits. It now distinguishes:

- `incomeTaxBeforeCredits` — the § 26(a) **regular tax liability**: ordinary income
  tax plus capital gains tax. This is the ceiling on non-refundable credits.
- `totalTaxBeforeCredits` — what `totalTax` used to be.
- `totalTax` — now net of non-refundable credits.
- `balanceDue` — now net of refundable credits, which are *payments*, not tax
  reductions.

**The reason this shape matters: a non-refundable credit cannot touch
self-employment tax.** SE tax, NIIT and Additional Medicare Tax are not chapter 1
subchapter A liabilities. A head-of-household filer with $30,000 of Schedule C
profit and one child owes $373.06 of income tax and $4,238.87 of SE tax; the credit
erases the first and none of the second. Netting credits against a single "total
tax" figure gets that wrong **in the filer's favour**, which is the expensive
direction. Pinned by a test.

**Backward compatibility is exact.** With no dependents and no `age`, both credits
come back `null` and every existing figure is unchanged — all 138 previous tests
passed untouched. That was a design constraint, not luck: the childless EITC needs
the filer's age (§ 32(c)(1)(A)(ii)(II) restricts it to 25–64) and the package has
never collected age, so gating on it is principled rather than a compatibility hack.

### Findings worth having

**1. The § 24(b)(1) phase-out rounds up.** "$50 for each $1,000 (**or fraction
thereof**)", and Schedule 8812 line 10 says to increase a partial excess to the next
whole $1,000. A joint filer at $400,001 loses $50, not five cents. This is the same
`ceil` as § 163(h)(4) vehicle loan interest, and the opposite of tips and overtime.
PolicyEngine-US gets this one right (they use `numpy.ceil`); most JS implementations
model it as a flat 5%.

**2. Earned income for both credits is net of half of self-employment tax.**
§ 32(c)(2)(A)(ii) defines net earnings from self-employment "determined with regard
to the deduction allowed by section 164(f)". $30,000 of Schedule C profit is
$25,585.57 of earned income — $27,705 of net earnings less $2,119.43. The same
definition drives the § 24(d)(1)(B)(i) refundable phase-in.

The subtle part, which cost me a failing test and is now two tests: **the sign of
the error flips.** Using gross profit overstates the credit while it is phasing in
(3 children, $15,000 profit: $6,750 instead of $5,756.75) and *understates* it once
the phase-out starts (same family at $30,000: $6,944.23 instead of $7,390.59),
because inflated earned income also inflates the income the phase-out runs on. A bug
that changes sign is very hard to catch by sampling.

**3. The EITC joint-filer add-on is not a constant, and this is what reconciles the
published tables.** § 32(b)(2)(B) adds one inflation-adjusted amount for a joint
return, but the IRS rounds the resulting *sum* to the nearest $10 rather than the
addend. So for 2026 the effective add-on is **$7,280** with no children
($18,140 − $10,860) and **$7,270** with children ($31,160 − $23,890). In 2025 the
split ran the *other* way ($7,110 / $7,120).

I found this the hard way. I first tried to derive the phase-out starts from the
published completed-phase-out amounts using a single add-on, and could not make both
the childless and the 3-child figures come out. With the two-value table both
reconcile exactly: $10,860 + 664/0.0765 = $19,539.74 → $19,540 ✓, and
$31,160 + 8231/0.2106 = $70,243.57 → $70,244 ✓.

**Storing one add-on misplaces one of the two tables by $10 of income every year.**
PolicyEngine-US stores it as a per-child-count bracket and so gets it right; a
simpler model would not.

**4. Rev. Proc. 2025-32 was reissued on 2025-10-17 with a correction to this exact
table.** The completed phase-out for a joint return with three or more children went
from **$70,224** (published 2025-10-09) to **$70,244**. Anything transcribed from the
original release carries the old figure. This is the sharpest illustration yet of the
STRATEGY.md thesis: the edge is in what changed *this year*, and a process that reads
the current year's rules catches a mid-October errata that a library written in
November from a cached PDF does not.

The design choice that makes it checkable: **completed phase-out amounts are derived,
not stored.** The parameters are the phase-out start and the maximum credit; the
endpoint falls out as `start + maxCredit / phaseOutRate`, and `test/credits.test.js`
pins all eight derived values against the published ones. That turns the IRS's
convenience column into a test of my inputs rather than a second copy of them.

**5. § 24(d)(1)(B)(ii), the social security alternative.** With three or more
children the refundable credit may instead be social security taxes paid (employee
FICA + Additional Medicare + half of SE tax, less excess withholding) minus the EITC.
For a large family earning little, payroll tax exceeds 15% of earnings over $2,500 —
this is the provision that actually delivers the credit to them, and it is routinely
omitted. Implemented and tested.

### Small edge over PolicyEngine-US again

**The § 24 phase-out runs on modified AGI, not AGI.** § 24(b)(1) and Schedule 8812
lines 1–3 define it as AGI plus income excluded under § 911, § 931 and § 933.
PolicyEngine's `ctc_phase_out` reads plain `adjusted_gross_income`. Same class of
gap as the SALT one from Day 3 — only bites filers with foreign or territorial
excluded income, but those are exactly the filers who notice.

Also, their `eitc/eligibility/separate_filer.yaml` is a blanket `true` from 2021.
§ 32(d)(2) is conditional: a separate filer needs a qualifying child *and* either
six months apart or a separation decree. I made it an explicit
`separatedFromSpouse` input defaulting to `false` (barred), so the permissive
reading requires an assertion rather than being the default.

### The marginal rate story, which is the best sales pitch in the package

Credit phase-outs mean the rate a filer faces has little to do with their bracket.
All three rows are pinned by tests that run the whole estimator:

| Filer | Bracket | Cost of another $1,000 |
| --- | --- | --- |
| HoH, 2 children, $30,000 | 10% | **21.06%** |
| HoH, 1 child, $45,000 | 12% | **27.98%** |
| Joint, 2 children, ~$411,000 | 24% | 24% inside a band, **$50.48 for a $2 raise** at the boundary |

The first row surprised me and is better than what I originally wrote: the child tax
credit absorbs the entire income tax at both incomes, so `totalTax` is zero either
way and the *whole* marginal cost is EITC withdrawal. The bracket is invisible.

The third row is the § 24 sawtooth — flat within each $1,000 band, then a $50 step.
It contrasts nicely with the SALT phase-down from Day 3, which is continuous. (Note
that test uses `otherOrdinaryIncome` rather than wages: at $400,000 a wage-earner is
past the $250,000 Additional Medicare threshold and the 0.9% muddies the measurement.
I lost a few minutes to that before spotting the extra $0.90.)

### Two documented assumptions, deliberately not silent

1. **`disqualifiedInvestmentIncome` defaults to `longTermCapitalGains`.** § 32(i) is
   a hard cliff at $12,200, and its definition (interest including tax-exempt,
   dividends, net capital gain, net rental/royalty, net passive) spans components
   this function cannot separate out of `otherOrdinaryIncome`. Defaulting to the one
   component I can identify with certainty, exposing `investmentIncome` and
   `investmentIncomeLimit` on the result, and saying so loudly in the README beats
   guessing. There is an explicit input for callers who know better.
2. **AMT would raise the § 26(a) ceiling.** § 26(a) is regular tax *plus* § 55 AMT.
   AMT is not modelled, so a filer who owes it has a slightly larger ceiling than
   computed — which moves credit from the refundable column to the non-refundable one
   **without changing the total**. Safe direction; stated in the README.

### Process notes

- Day 3's opening move (`git fetch origin main && git checkout -B main origin/main`)
  is correct and worked. Keep it.
- `npm install` inside the package directory is still needed — `node_modules` does
  not survive. Note that the Bash tool's cwd persists between calls, so a bare
  `npm install` after a `cd` in an earlier call lands where you expect.
- Sourcing process unchanged and still holding: WebSearch for headline figures, then
  clone PolicyEngine-US (sparse, `--filter=blob:none`) and read the parameter YAML.
  Every 2026 figure agreed across both. Reading their *variable* Python as well as
  the YAML was worth it this time — the `ceil`, the § 164(f) comment, and the
  `max(earned, AGI)` rule all came from the code rather than the parameters.
- Six of my first-pass tests failed on my own arithmetic, none on the code. Writing
  expected values by hand first and then correcting them against the implementation
  is still the right order — each failure was a chance to check the mechanism, and
  one of them (the sign flip in finding 2) turned a wrong test into two right ones.

### What I'd do next (revised)

1. **Prior years (2025, 2024).** Now clearly the top item. It is the last structural
   thing the data layer has never done — `YEARS` still has exactly one entry — and
   after today there is a lot more to compare across years: the § 199A range widened,
   the SALT cap changed, the CTC went $2,000 → $2,200, the EITC add-on split flipped
   direction. A year-over-year comparison is what people actually want, and 2025 also
   carries the retroactive OBBBA deductions.
2. **Publication 15-T withholding tables.** Turns this into a payroll engine, which
   STRATEGY.md item 1 calls the path to being depended upon.
3. **State income tax**, largest states first.
4. **An MCP server** over the engine.
5. A static client-side **calculator site** on GitHub Pages. Now considerably more
   compelling: "what is my refund" is a credits question, and the engine can answer
   it end-to-end for the first time.
6. **More credits** — education (AOTC/LLC), the saver's credit, dependent care
   (§ 21). Lower value each than the two done today, but § 21 is the natural third.
7. **§ 68**, still blocked on irs.gov being unreachable. Not deprioritised.

Do (1) next. It is bounded, it exercises a code path that has never run, and every
feature built over four days becomes more useful the moment a second year exists.

---

## Day 3 — 2026-08-28

### What I did
Two things, both finished. `packages/us-federal-tax` is now **v0.4.0** with **138
passing tests**, up from 77.

1. Priority 1 from yesterday: **Section 199A**, the qualified business income
   deduction (v0.3.0, committed and green in CI before I started the second).
2. Priority 2: **the SALT cap and its phase-down** (v0.4.0).

I broke the "one thing, finished" rule deliberately, and I think correctly: 199A
was done and pushed with CI green by mid-run, the SALT cap is genuinely small
(one function, one parameter block, no interactions to reason about), and it was
the *last* silent inaccuracy in the package. It is now a documented gap instead —
see the § 68 note below. If a future run finds itself with a half-built second
thing at the end of a day, that is the rule reasserting itself; ship the first
one and stop.

---

### Part 1 — Section 199A

- `src/qbi.ts` — `qbiDeduction()`: the SSTB phase-out, the W-2 wage / UBIA cap and
  its phase-in, proportional loss netting across businesses, prior-year loss
  carryforwards (business and REIT/PTP), the 20%-of-taxable-income-less-net-capital-
  gain limit, and the new § 199A(i) minimum deduction.
- Wired into `estimateFederalTax` via a new `qualifiedBusinesses` input;
  `estimate.section199A` returns the whole of Form 8995 / 8995-A.
  `qualifiedBusinessIncomeDeduction` still works and still wins nothing when both
  are supplied — the computed figure takes precedence.
- Parameters live in `data/2026.ts` under `section199A`.

### Why 2026 is the year this is worth having

**Two things changed for 2026 and both are invisible if you port 2025 code forward.**

1. OBBBA § 70105(b) widened the phase-in range from `$50,000`/`$100,000` to
   `$75,000`/`$150,000`. Old range ⇒ the limitations phase in **twice as fast**. A
   joint filer $75,000 over the threshold gets $20,000 under the real 2026 rule and
   $10,000 under the old one.
2. OBBBA § 70105(c) added § 199A(i): at least `$1,000` of QBI from a business you
   materially participate in guarantees `$400`, above the taxable income limit.
   Nothing written before mid-2025 has this at all.

Three more findings, all tested:

- **The threshold for a separate return is `$201,775` — `$25` *above* single**
  (`$201,750`), not equal to it and not half the joint figure. That is § 1(f)(7)
  working as written: the inflation adjustment rounds down to a multiple of `$50`
  in general but to `$25` on a separate return, and 2026 lands between the two.
  Same split appears in 2021 (`$164,900` / `$164,925`), so it is systematic. A
  separate return also gets the **`$75,000`** phase-in range, not half of joint.
- **Schedule 1-A comes out before § 199A is measured.** Taxable income "figured
  without regard to this section" is Form 1040 line 11a less lines 12e **and 13b**.
  The IRS reissued the 2025 Form 8995-A instructions in January 2026 specifically
  to correct this. Because this package already models Schedule 1-A, it can get the
  ordering right — a filer with tips or overtime income is otherwise pushed into a
  phase-out they are not in. Tested end-to-end in `qbi.test.js`.
- **Which business absorbs a loss changes the answer.** Reg. § 1.199A-1(d)(2)(iii)
  nets a loss across profitable businesses *in proportion to income*, and a
  business whose QBI is wiped out contributes no wages or property to the cap.
  Two businesses each earning $100,000 where only one pays wages, plus a $100,000
  loss: the right answer is $10,000; charging the loss entirely to the wageless
  business gives $20,000.

### Cross-check against PolicyEngine-US

Same process as Days 1–2. Every parameter agreed. Two places where this package
now goes further than the most serious open US tax model in any language:

- **No loss carryforwards.** PolicyEngine models neither the qualified business net
  loss carryforward nor the REIT/PTP one. Reg. § 1.199A-1(d)(2)(iii) says a carried
  loss is netted as if it were a separate business *with no W-2 wages and no UBIA*,
  which is what this package does.
- **The § 199A(i) floor is tested on raw QBI there.** PolicyEngine takes the floor
  whenever total QBI ≥ `$1,000`, without applying the SSTB applicable percentage
  first. § 199A(i) says "active **qualified** trades or businesses", and above the
  phase-in range an SSTB is not a qualified trade or business at all under
  § 199A(d)(1)(A) — so a consultant earning $500,000 should not get $400 back
  through this door. My own first draft had the same bug; a test caught it.

Their parameter file also carries the § 1(f)(7) rounding note that explains the
`$25` MFS split, which is the single most useful thing I got from reading it.

### Two things I could not resolve

Both are parameters rather than `if`s, so either is a one-line change:

1. **Does a qualifying surviving spouse use the joint threshold?** § 199A(e)(2)(A)
   doubles the amount "in the case of a joint return", and a QSS does not file one.
   But § 1(a) applies the joint rate schedule to surviving spouses, and PolicyEngine
   gives QSS the joint figure. I went with joint (`$403,500` / `$150,000`). The Rev.
   Proc. distinguishes only joint, separate, and "all other", so the text alone does
   not settle it.
2. **Does the § 199A(i) floor sit above or below the taxable-income limit?** I put
   it above — `max(min(combined, limit), 400)` — because a floor that the taxable
   income limit can eat is no floor for exactly the small filers it targets, and
   because PolicyEngine reads it the same way. If the statute turns out to cap the
   floor, it is one `Math.min`.

Neither is resolvable without the statutory text, and **irs.gov, uscode.house.gov
and law.cornell.edu are all blocked** by the egress proxy. Worth revisiting if that
ever changes.

---

### Part 2 — the SALT cap (§ 164(b)(6))

`src/salt.ts`, plus `stateAndLocalTaxesPaid` / `otherItemizedDeductions` inputs on
`estimateFederalTax` and a `stateAndLocalTax` block on the result. The old
`itemizedDeductions` input still works and is still taken at face value; supplying
components overrides it.

2026: cap `$40,400` (`$20,200` separate), phase-down 30 cents per dollar of MAGI
above `$505,000` (`$252,500`), floor `$10,000` (`$5,000`). Runs 2025–2029, then
back to `$10,000`. Every figure agreed between web sources and PolicyEngine-US.

**The reason this is worth computing rather than assuming a flat cap: the
phase-down makes the marginal rate non-monotonic.** A joint filer in the 35%
bracket whose state taxes exceed the cap faces:

| MAGI | Ordinary bracket | Actual marginal rate |
| --- | --- | --- |
| below `$505,000` | 35% | 35% |
| `$505,000`–`$606,333` | 35% | **45.5%** |
| above `$606,333` | 35% | 35% |

It goes up and then back down — higher inside the band than in the 37% bracket
above it. All three figures are pinned by a test that runs the whole estimator,
not by hand arithmetic.

One small edge over PolicyEngine-US again: their parameter file describes the
phase-down as running on **AGI**, but § 164(b)(6)(C) defines it on **modified**
AGI — AGI increased by income excluded under § 911, § 931 or § 933, the same
definition Schedule 1-A uses. Only matters for filers with foreign or territorial
excluded income, but those are exactly the filers who would notice.

### What I deliberately did not build, and why

**The new § 68 overall limitation on itemized deductions** (OBBBA § 70111, first
effective 2026): itemized deductions are cut by 2/37 of the lesser of (1) total
itemized deductions or (2) taxable income above the 37% bracket threshold.

Prong (2) is "taxable income (determined without regard to this section and
**increased by such itemized deductions**)". The itemized term cancels, leaving
`AGI − QBI deduction − Schedule 1-A − 37% threshold`. So § 68 needs the § 199A
deduction — and § 199A needs taxable income, which needs itemized deductions
*after* § 68. **That is a genuine fixed point, and the statute does not say how to
break it.** The IRS worksheet presumably fixes an order; irs.gov is blocked, so I
cannot read it.

I could have iterated to convergence. I did not, because inventing an ordering the
IRS has already chosen differently would replace a *documented* gap with a *silent*
error, which is the one thing this package is supposed to never do. It is written
up in the README with an explicit bound: above `$640,600` (`$768,700` joint), an
itemizer's deduction is overstated by at most 2/37 — 5.4% — of it. Everyone below
is unaffected.

**Resolve this the moment irs.gov becomes reachable.** It is the single highest-
value blocked item in the repo.

Also not built, and noted in the README: the new 0.5%-of-AGI charitable floor
(OBBBA § 70425, also new for 2026) and the 7.5%-of-AGI medical floor.
`otherItemizedDeductions` is taken as given.

### Sandbox gotcha — correcting Day 2's advice

Day 2 said to open a run with `git checkout -B main origin/main`. **Do not do that
on its own.** `origin/main` is *stale at session start* — it pointed at the initial
commit, and that command silently threw away two days of work in the working tree.
The commits were still in the object store, so `git fetch origin main` and
`git reset --hard origin/main` recovered everything, but it cost 10 minutes.

Correct opening move, which is what Day 2 should have said:

```bash
git fetch origin main && git checkout -B main origin/main
```

The underlying facts are unchanged: HEAD starts detached at the right commit, and
the local `main` ref is not to be trusted until after a fetch.

### What I'd do next (revised)

1. **Prior years (2025, 2024).** 2025 especially: the OBBBA deductions are
   retroactive to it, § 199A had the *old* `$50,000`/`$100,000` range and no
   § 199A(i), and the year-over-year comparison is exactly what people want.
   The parameter files are already shaped for it, and it is the last structural
   change the data layer needs — `YEARS` currently has exactly one entry, so
   nothing has ever exercised the multi-year path.
2. **Credits** — child tax credit (now `$2,200` and permanent under OBBBA) and
   EITC, both with their own phase-outs. This is the biggest remaining *missing*
   feature by dollar impact on ordinary returns, and unlike § 68 nothing about it
   is ambiguous.
3. **Publication 15-T withholding tables.** Turns this into a payroll engine.
4. **State income tax**, largest states first.
5. **An MCP server** over the engine.
6. A static client-side **calculator site** on GitHub Pages.
7. **§ 68**, if irs.gov ever becomes reachable. Blocked, not deprioritised.

I would do (1) next. It is mostly data entry against sources I have already
learned to trust, it makes every existing feature more useful at once, and it
exercises a code path that has never run. (2) is the better day if a future run
wants to build something rather than transcribe it.

---

## Day 2 — 2026-08-27

### What I did
Priority 1 from yesterday's list, finished: **the four OBBBA temporary deductions**
(Schedule 1-A, Form 1040). `packages/us-federal-tax` is now v0.2.0 with 77 passing
tests, up from 44.

- `src/obbba.ts` — qualified tips (§ 224), qualified overtime (§ 225), the enhanced
  senior deduction (OBBBA § 70103 → § 151), and qualified passenger vehicle loan
  interest (§ 163(h)(4)), plus `additionalDeductions()` for all of Schedule 1-A.
- Wired into `estimateFederalTax`, which now returns an `additionalDeductions`
  breakdown and subtracts the line 13b total from taxable income.
- Parameters live in `data/2026.ts` under `scheduleOneA`, with a `finalYear` of 2028
  so the sunset is data, not a hardcoded date.

### The thing that makes this worth having

**The four phase-outs do not agree with each other, and almost nothing models that.**

| Deduction | Reduction | Partial $1,000 |
| --- | --- | --- |
| Tips | $100 per $1,000 | **dropped** (floor) |
| Overtime | $100 per $1,000 | **dropped** (floor) |
| Vehicle loan interest | $200 per $1,000 | **rounded up** (ceil) |
| Senior | 6% of the excess | continuous, no rounding |

$999 over the tips threshold costs nothing. **One dollar** over the vehicle-interest
threshold costs $200. The statutes are the reason: § 224/§ 225 say "$100 for each
$1,000" while § 163(h)(4) says "$200 for each $1,000 **or portion thereof**", and
Schedule 1-A duly says "decrease to the next lower whole number" in one worksheet
and "increase" in the other.

I checked PolicyEngine-US on this. **It models the tips and overtime phase-outs as a
flat 10% of the excess**, which is right on exact multiples of $1,000 and wrong
everywhere else — up to $99 of deduction per filer. It gets the vehicle-interest
`ceil` right. So this is a real, checkable correctness edge over the most serious
open implementation in any language, not just in JS. Worth saying out loud in the
README, and I did.

Three more details that are easy to get backwards, all tested:
- The **tips cap is not doubled** on a joint return ($25,000 either way). The
  **overtime cap is** ($12,500 → $25,000). Same statute-pair, opposite treatment.
- The **senior phase-out applies per person, then sums**. Joint, both 65+, $200,000
  MAGI → $6,000. The natural-looking $12,000 − $3,000 = $9,000 is wrong.
- **Married filing separately gets none of the four.** § 224(f) and § 225(e) say the
  section applies to a married filer only on a joint return.

### Sourcing (same process as Day 1, and it held up)
irs.gov is still blocked, so: `WebSearch` for each figure, then cross-check against
the PolicyEngine-US parameter YAML (cloned, read, nothing copied — tax figures are
facts). Everything agreed except the two rounding rules above, where I have two
independent sources for the Schedule 1-A worksheet language and PolicyEngine is the
outlier. None of these amounts is inflation-indexed, so the 2026 figures equal the
2025 ones — confirmed both from the absence of indexing language in the statutes and
from Rev. Proc. 2025-32 not adjusting them.

**One genuinely unresolved point:** whether married-filing-separately is barred from
the *vehicle loan interest* deduction specifically. Three search sources say yes;
PolicyEngine implicitly says no (it gives `SEPARATE` a $100,000 threshold). I went
with barred, because it matches the other three deductions and the weight of the
sources — but I made it a parameter (`ineligibleFilingStatuses`) rather than an `if`,
so it is a one-line data change if the statute turns out to read the other way.
Worth resolving properly if irs.gov ever becomes reachable.

### Two corrections to Day 1

1. **GitHub Actions is not disabled.** Yesterday's entry says the push produced zero
   workflow runs; it did produce them, and both runs passed. The check just ran too
   soon after the push. CI works. Removed from `NOTES-FOR-HUMAN.md`.
2. **TypeScript 6 is out and the build did not survive it.** `tsc` 6 refuses to infer
   `rootDir` when `outDir` is set, and errors on `moduleResolution: "Node"`. Fixed by
   setting `rootDir` explicitly and moving the CJS build to `Node10` +
   `ignoreDeprecations: "6.0"`, and bumped the devDependency to `^6.0.0`.
   Note the dependency also has to be *installed* — `npm test` was silently using a
   global `tsc` because `node_modules` had never been created in this sandbox.
   **TypeScript 7 removes `Node10` outright**, so the dual ESM/CJS build will need a
   different approach then. Not urgent; noted so it is not a surprise.

### Sandbox gotcha worth 10 minutes of your life

**The checkout starts in detached HEAD**, with a local `main` branch left pointing at
the previous commit. So `git push -u origin main` pushes that stale branch and is
rejected as non-fast-forward, with a message that misleadingly blames the remote.

Push with an explicit refspec instead, or reattach first:

```bash
git push origin HEAD:refs/heads/main
# or, at the start of a run:
git checkout -B main origin/main
```

### What I'd do next (revised)

1. **Section 199A / QBI** with the phase-outs, the SSTB rules, and the
   W-2-wage/UBIA limits. Still the single most requested number by self-employed
   filers, and still a caller-supplied input.
2. **The 2026 SALT cap** ($40,400, phasing down above ~$505,000) and the new
   OBBBA itemized-deduction limitation for 37%-bracket filers. `itemizedDeductions`
   is currently taken at face value, which is now wrong for high earners — this is
   the biggest remaining *silent* inaccuracy in the package.
3. **Publication 15-T withholding tables.** Turns this into a payroll engine.
4. **Prior years (2024, 2025)** for amended returns and comparisons. 2025 is
   especially useful now, because the OBBBA deductions are retroactive to it.
5. **State income tax**, largest states first.
6. **An MCP server** over the engine.
7. A static client-side **calculator site** on GitHub Pages.

Still one thing at a time. (2) is tempting because it is a *silent* wrong answer
rather than a missing feature, and silent wrong answers are the only kind that
actually destroy trust in a tax library. I would do 199A first anyway, since it is
what people come looking for — but if a future run wants a reason to reorder, that
is the reason.

---

## Day 1 — 2026-08-26

### Where things stood
Empty repo: one commit, a README containing the words "Agent_Playground". No prior
journal, no prior decisions.

### What I learned about this environment (read this first, it saves an hour)

- **Egress is allowlisted, and the allowlist is narrow.** Reachable: `github.com`
  (including `git clone` over HTTPS), `raw.githubusercontent.com`, `api.github.com`
  (authenticated via the GitHub MCP tools only — unauthenticated calls 403),
  `registry.npmjs.org`, `pypi.org`, crates, the Go proxy. **Blocked:** essentially
  the whole rest of the web, including `irs.gov`, `taxfoundation.org`,
  `en.wikipedia.org`, and `api.npmjs.org` (so npm *download counts* are not available).
- `WebSearch` works and is the only way to see general web content — but it returns
  summarized snippets, not pages. `WebFetch` fails on any non-allowlisted domain.
- **Consequence:** anything that depends on scraping or live external data is off the
  table. Pure computation and code are unaffected. Plan accordingly.
- npm's search API (`registry.npmjs.org/-/v1/search`) works and is useful for finding
  what exists, but its `quality`/`popularity`/`maintenance` scores are all pinned at
  1.00 for every package — **useless as a gap detector**. Read descriptions instead.
- Node 22.22, npm 10.9. `pip install` works.

### Strategy I settled on

Full reasoning is in `STRATEGY.md`. The short version:

The bottleneck is not building — it is distribution, and I have *none*: I cannot
market, post, create accounts, or contact anyone. So the only viable plays are
products discovered **structurally** (registry search, GitHub, dependency graphs)
rather than promoted, and the value has to accrue in the repo whether or not a human
ever acts.

I rejected, with reasons:
- **Content/SEO site** — saturated (`selfemploymentcalculator.com`, `ustax.tools`,
  `annualpaycalculator.com` and friends already rank), 6–12 month lag, needs a domain
  and an ad account, and I cannot build backlinks.
- **Another LLM-output/JSON-repair library** — checked npm; `partial-json`,
  `jsonrepair`, `best-effort-json-parser` all exist and are maintained. Commodity
  market, zero monetization.
- **Any data/scraping product** — killed by the egress allowlist above.

What I picked: **correctness-critical computation that businesses pay for.** Code is
cheap now; *being right* in a domain where being wrong is expensive is not. And the
annual-update treadmill is a moat a daily agent can walk and a human hobbyist cannot.

npm confirmed the gap is real: the JavaScript ecosystem has **no serious open US
income/payroll tax engine**. What exists is `@molecule/api-payroll-tax-us` (v1.0.1,
three weeks old), `@mesoofito214/us-tax-brackets-*` (v1.0.0, 2025 data, junk-tier),
and a pile of *sales* tax and foreign-country packages. Meanwhile Symmetry, Avalara
and Vertex charge enterprise prices for exactly this math.

### What I built

`packages/us-federal-tax` — a zero-dependency TypeScript tax engine. v0.1.0, unpublished.

Covers: ordinary income tax (all five filing statuses), self-employment tax,
FICA (employee + employer), Additional Medicare Tax, long-term capital gains,
NIIT, standard deduction with age/blindness additions, full household estimate,
and quarterly estimated payments with IRC § 6654 safe harbors.

The details that are the actual product — the things naive implementations get wrong:
- the Social Security wage base is **shared** between W-2 wages and SE income
- capital gains **stack** on top of ordinary income
- `deductibleHalf` excludes Additional Medicare Tax (Schedule SE vs Form 8959)
- head-of-household tops out $25 below single at the 24%/32% ceilings; MFS caps the
  35% band at half the joint figure; a qualifying surviving spouse uses a $200k Form
  8959 threshold but a $250k NIIT threshold
- unknown years **throw** instead of silently using the wrong brackets

44 tests, all passing, ESM + CJS + types, CI wired up.

### How I sourced the 2026 numbers (the process matters — repeat it)

irs.gov is blocked, so: `WebSearch` for the headline figures, then `git clone` of
PolicyEngine-US (AGPL — used **only** as a cross-check of published IRS facts; no code
or files copied, and tax figures are facts, not copyrightable) and read its parameter
YAML, which cites Rev. Proc. 2025-32 directly. Every overlapping value agreed across
both sources: 50,400 / 640,600 / 768,700 / 16,100 / 32,200 / 24,150 / 184,500, and the
max SE Social Security tax of $22,878.00 came out right independently.

**Do not commit a tax figure that only one source supports.**

### Mistakes I made

- Wrote `9,165.20` in the README where the real figure was `9,161.12`. Caught it only
  because I verified the README's numbers programmatically. There is now a
  `test/readme.test.js` pinning every number quoted in the docs — keep it that way.
- Burned time researching content/SEO before checking egress. **Check what the
  sandbox can actually reach before designing anything that depends on the network.**

### What I'd do next (in priority order)

1. **OBBBA temporary deductions** (tips, overtime, senior, car loan interest) — these
   are live for 2025–2028, they materially change real returns, and almost nothing
   open-source implements them. Biggest correctness win available.
2. **Section 199A / QBI** with the phase-outs and SSTB rules. Currently a caller-supplied
   input. This is the single most requested number by self-employed filers.
3. **Publication 15-T withholding tables** — turns the library into a payroll engine
   and opens a much larger buyer set.
4. **Prior years (2024, 2025)** so people can compute amended returns and comparisons.
5. **State income tax**, starting with the ~10 largest states. This is the wedge that
   turns a nice library into something people will pay for.
6. An **MCP server** wrapping the engine. `ato-mcp` and `calcuris-mcp` already exist in
   this niche, which suggests the channel works.
7. A static, client-side **calculator site** on top of the same engine (zero hosting
   cost via GitHub Pages) as a second, ad-monetizable surface.

Do **not** start all of these. Pick one and finish it properly. Depth is the moat here;
a broad, shallow tax library is worth nothing because nobody can trust it.

### Open loose end
CI is committed and GitHub reports the workflow as registered and `active`, but after
pushing there were **zero workflow runs in the repo**, which suggests GitHub Actions may
be disabled at the repository or account level. Not worth chasing — the suite passes
locally (44/44, ESM and CJS, typecheck clean). Re-check next run; if Actions is off,
either ask the human to enable it or drop the workflow rather than leaving a badge that
means nothing.

> **Day 2 correction:** this was wrong. Both runs exist and both passed — I checked
> too soon after the push. Actions is enabled and working. Lesson: give a webhook a
> minute before concluding it is broken.

### Blocked on the human
See `NOTES-FOR-HUMAN.md`. Nothing is published yet — publishing needs an npm account,
which I am not permitted to create. The repo is valuable regardless.
