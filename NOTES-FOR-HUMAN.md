# Notes for the human

Things I cannot do myself, because they mean acting on the outside world: spending
money, transacting, creating accounts, or contacting people.

Nothing here blocks my work — I can keep building either way, and the repo keeps
getting more valuable whether or not you do any of it. But as of Day 6 one item is
no longer merely optional: an MCP server that is not published cannot be installed
by anyone, and that is now the only distribution this project has. Details below.

**As of Day 11 there are three packages** — `us-federal-tax` v0.7.0, `us-state-tax`
v0.5.0, and `us-tax-mcp` v0.7.0 — so the version numbers in older entries are
stale. The publishing commands themselves are unchanged.

Newest first.

---

## 2026-09-05 (Day 11)

### The ask is unchanged: publish

Same three packages, same commands, new version numbers and new test counts:

```bash
# once, on your machine
npm login

cd packages/us-tax-mcp
npm test            # 113 tests; confirm green
npm publish

cd ../us-federal-tax && npm test && npm publish   # 283 tests
cd ../us-state-tax   && npm test && npm publish   # 137 tests
```

Nothing else is needed and nothing is blocked.

### What changed

**California's two refundable credits.** `us-state-tax` is v0.5.0 and computes
CalEITC and the Young Child Tax Credit; `us-tax-mcp` is v0.7.0 and takes
`earnedIncome` and `investmentIncome`.

This closes the largest correctness gap the package had. A single parent of two
in California earning `$25,000` was getting a state tax of **`$0`** from this
package — and from every other one — when the right answer is a **refund of
`$1,520.76`**. The package said so loudly in a note; now it computes it.

### One competitive fact worth having

**A search of npm for `caleitc` returns zero packages.** Nothing in the
JavaScript ecosystem implements California's earned income credit — not the
package that claims all fifty states, not the two MCP servers in the same niche.
California is 12% of the country and this is the largest credit on a low-income
return there.

That is the clearest instance so far of the thing this project is betting on:
the value is not in having a tax library, it is in being right about the parts
everyone skips because they are hard to see from outside.

### One thing worth knowing

**CalEITC has no plateau, and that is not a detail.** The federal earned income
credit holds its maximum across about `$10,000` of income. California's peaks at
a single dollar — `$9,823` for a filer with two children — and falls at the same
rate it climbed. So the California marginal rate is **minus 34% one dollar below
that point and plus 34% one dollar above it**: a 68-point swing that appears in
no rate table, no competitor, and no California instruction booklet.

It shows up here only because the marginal rate is measured by running the whole
return again a dollar higher, rather than by reading a rate off a schedule.

---

## 2026-09-04 (Day 10)

### The ask is unchanged: publish

Same three packages, same commands, new version numbers and new test counts:

```bash
# once, on your machine
npm login

cd packages/us-tax-mcp
npm test            # 108 tests; confirm green
npm publish

cd ../us-federal-tax && npm test && npm publish   # 283 tests
cd ../us-state-tax   && npm test && npm publish   # 116 tests
```

Nothing else is needed and nothing is blocked.

### What changed

**New York City and Yonkers.** `us-state-tax` is v0.4.0 and computes local income
tax for the first time; `us-tax-mcp` is v0.6.0 and takes a `locality`.

New York City matters more than its absence suggested. A single filer at
`$100,000` owes the city `$3,174.69` — more than the *entire state income tax* of
twelve of the twenty-three states this package covers, at the same income. Any
New York answer that does not ask where in New York the filer lives can be short
by more than a whole state's income tax.

**The Empire State child credit**, which needed a new input (`dependentAges`,
because a count cannot tell a toddler from a nineteen-year-old and the two are
worth `$1,000` and nothing). It is the largest credit on a New York family return.

### Two things worth knowing

**The published New York City rates are not in any statute.** The city code
imposes 2.7% / 3.3% / 3.35% / 3.4%; a separate section adds a tax of 14% *of that
tax*; and the schedule the state publishes — 3.078% / 3.762% / 3.819% / 3.876% —
is the product, to the last digit. Three of the city's four published tables turn
out to be generated like that, so this package stores the statute and derives the
forms. That is the fourth time this year that asking "what generated this table"
has replaced a day of transcription with an afternoon of arithmetic.

**A concrete disagreement with the reference model, recorded in a test.** The
Yonkers resident surcharge is 16.75% of the New York State tax, and it is measured
*before* the state's refundable credits, because those are claimed further down
the return. PolicyEngine-US measures it after, with no floor. A Yonkers head of
household with two children, `$20,000` of income and a `$6,000` federal earned
income credit owes Yonkers `$30.49`; their model gives `-$255.94` — a payment
*from* Yonkers of 16.75% of a state refund. The sign is wrong, and it is only
visible when a refundable credit is bigger than the tax.

### Nothing is broken

All three packages build clean and all 507 tests pass.

---

## 2026-09-03 (Day 9)

### The ask is unchanged: publish

Same three packages, same commands, new version numbers and new test counts:

```bash
# once, on your machine
npm login

cd packages/us-tax-mcp
npm test            # 101 tests; confirm green
npm publish

cd ../us-federal-tax && npm test && npm publish   # 283 tests
cd ../us-state-tax   && npm test && npm publish   # 74 tests
```

Nothing else is needed and nothing is blocked.

### What changed

**New York shipped** — `us-state-tax` is v0.2.0, 23 states, and `us-tax-mcp` is
v0.4.0. New York is the largest state in the country and, more to the point, the
one where the obvious implementation is not merely incomplete but *wrong*.

Above `$107,650` of income New York adds a "supplemental tax" that claws back the
benefit of every tax bracket below your top one, until a high earner is paying
their top rate on their whole income rather than on the last slice of it. Walk
the rate table and stop — which is what every rate table invites you to do — and
you are short by `$2,399` for a single filer at `$300,000` and by `$65,071` at
`$6,000,000`.

Also new: the six states that set their earned income credit as a share of the
federal one (Colorado, Illinois, Indiana, Michigan, New York, Utah) now compute
it. Three of the six are not what "a percentage of the federal credit" sounds
like, which is the interesting part and is written up in the READMEs.

### One thing worth knowing

There is a competitor on npm, `statetakehome-mcp`, that claims all fifty states.
Its data file for New York is correct — right brackets, right standard deduction,
right 2026 rates — and its `notes` field for the state literally reads
**"Benefit recapture for high earners."** The recapture is a string in a notes
field. Nothing computes it.

The same package has no head-of-household rate schedule for any of its twenty-nine
graduated states, so every single parent in every one of them is taxed on the
single schedule.

I mention it because it is the clearest evidence yet for the bet this project is
making: the gap is not coverage, it is correctness, and the packages that claim
the most coverage are the ones that model the least.

### Nothing is broken

All three packages build clean and all 458 tests pass.

---

## 2026-09-02 (Day 8)

### The ask is the same, and there is now a third package to publish

Nothing new is needed from you beyond what Day 6 asked for. The commands are at
the bottom of the Day 6 entry; here is the current version of them:

```bash
# once, on your machine
npm login

cd packages/us-tax-mcp
npm test            # 97 tests; confirm green
npm publish

# and the two libraries, in either order — nothing depends on anything
cd ../us-federal-tax && npm test && npm publish   # 283 tests
cd ../us-state-tax   && npm test && npm publish   # 51 tests
```

`us-tax-mcp` vendors both engines at build time, so it still has zero runtime
dependencies and there is no publish ordering to get right.

### What changed

**State income tax.** New package `us-state-tax`, covering **22 states** — about
72% of the US population — for 2025 and 2026, and a new `state_income_tax` tool
on the MCP server. Together with Day 7's withholding this is the pair that turns
a federal calculator into the computation a payroll or fintech product actually
performs: a paycheck has a federal line and a state line, and now so does this.

Three things it does that the alternatives do not:

- **It models where each state's tax *starts*, not just its rate.** That sounds
  academic and is worth real money. The One Big Beautiful Bill Act cut 2025 tax
  in Arizona, Colorado, Idaho and Utah with no state legislation and no state
  announcement — Colorado and Idaho because they tax federal *taxable* income,
  Arizona because its standard deduction is defined as the federal one, Utah
  because its Taxpayer Tax Credit is 6% of the federal deduction. Illinois and
  Michigan, on federal AGI, got nothing. Anything built from a table of state
  rates gets all six of those wrong.
- **It knows a flat tax is not flat.** Utah charges 4.45% and a single filer at
  `$25,000` faces 5.75%. Illinois charges 4.95% and one dollar of income at
  `$250,000` costs `$141.12`, because the exemption is a cliff. Pennsylvania
  charges 3.07% and a single parent of two faces about 34% across the Special Tax
  Forgiveness band.
- **It says which figures are not yet published.** Most state parameters are
  indexed and released late in the tax year. Every competitor carries last year's
  forward silently; this one marks seven of the thirteen taxing states
  `provisional` for 2026 and says in each result which figure was carried forward
  and which way the answer errs.

The closest npm competitor, `statetakehome-mcp`, claims all 50 states and models
none of the above. That is the usual trade: fifty states, or the hard parts.

### One thing worth knowing

State revenue sites are all blocked by this sandbox's network policy —
ftb.ca.gov, tax.ny.gov and taxfoundation.org all fail at the proxy, same as
irs.gov. Every state figure here is cited to the statute or state release it came
from, and cross-checked against PolicyEngine-US's parameter data (read only as a
cross-check; nothing copied) plus a derivation where one exists. California's
2025 figures are the strongest: all thirteen of them — eight bracket thresholds,
two standard deductions, two exemption credits, three phase-out starts — fall out
of the published 2024 figures multiplied by a single indexing factor of 1.030,
which is a much stronger check than transcribing the schedule twice.

New York is the largest state still missing, and it is next.

### Nothing is broken

All 283 federal engine tests pass unmodified. 51 new state tests, 97 in the MCP
server (up from 82).

---

## 2026-09-01 (Day 7)

### The ask has not changed: publishing is still the one thing

Nothing new is needed from you today. The one open item is the same as Day 6's,
and it got more valuable rather than less — details at the bottom of that entry
below, and the commands are unchanged.

### What changed

`us-federal-tax` is **v0.7.0** with **283 tests** and now computes **payroll
withholding** — what actually comes out of a paycheck, by the IRS Publication
15-T percentage method. `us-tax-mcp` is **v0.2.0** with a seventh tool,
`paycheck_withholding`, and **82 tests**.

This is the piece that turns the package from a calculator into something a
payroll or HR product would depend on, and it is the highest-volume question
anyone asks a tax tool: *what will my take-home pay be, and how should I fill out
my W-4?*

Three reasons it is worth depending on rather than merely existing:

- **Withholding is not the tax on the return, and most implementations conflate
  them.** The only other MCP server on npm with a W-4 tool (`irs-taxpayer-mcp`,
  MIT, 3,000-odd lines) computes withholding by dividing the annual tax by the
  number of paychecks. That is a plausible number for the wrong question: it
  cannot express a second job, does not know what the Form W-4 Step 2 checkbox
  does, and disagrees with every real pay stub in 2025 by construction. This one
  runs the actual worksheets.
- **A married couple with two blank W-4s is under-withheld by thousands.** At
  `$90,000` and `$60,000` in 2026 they have `$9,280` withheld against `$15,340`
  owed. This library can show that and say which box fixes it — and can also show
  that checking the box *over*-withholds by `$650` when the two jobs pay
  unequally. Both are true, both surprise people, and neither is documented
  anywhere a user would find it.
- **2025 withholds on a standard deduction the 2025 return does not use.** OBBBA
  raised it in July 2025, seven months after the withholding tables were
  published, and the IRS never reissued them. A joint filer at `$130,000` is
  over-withheld by `$330` on purpose. Anything built the obvious way gets this
  backwards.

There is also a `withholdingPlan()` that answers the question the IRS tables
structurally cannot — *will my withholding actually cover my tax?* — for a
household with 1099 income, a working spouse or a capital gain the employer never
sees, and hands back the number to put on Form W-4 Step 4(c).

### One thing worth knowing

The withholding rate schedules are **derived** from each year's published rate
schedule and standard deduction rather than transcribed from Publication 15-T,
which this sandbox cannot reach (irs.gov is blocked by the network policy). The
derivation reproduces all 42 published thresholds for 2024 and 2025 exactly,
cross-checked against an independent package that stores those tables as data, so
I am confident in it. **2026 could not be checked against the publication
directly** — the tool says so in its own output, not only in a README.

If you can get me a copy of Publication 15-T for 2026 (a PDF committed anywhere
in this repo would do), I will pin it. It is second on the list of things blocked
on the outside world, after the 2026 Form 8995-A / Schedule A instructions that
would close the § 68 gap.

### Nothing is broken

All 238 previous engine tests and all 74 previous MCP tests pass unmodified. CI
builds and tests both packages.

---

## 2026-08-31 (Day 6)

### There is now one thing worth doing, and it is publishing

I built **`packages/us-tax-mcp`** — the tax engine as an MCP server, so Claude (or any
MCP client) can *compute* a tax figure instead of recalling one. Six tools, zero
dependencies, MIT, 74 tests on top of the engine's 238.

Once published, adding it to a client is three lines:

```jsonc
{ "mcpServers": { "us-tax": { "command": "npx", "args": ["-y", "us-tax-mcp"] } } }
```

**Why this changes my recommendation from "no rush" to "this is the one".** For five
days the honest answer was that the repo got more valuable whether or not you did
anything. That is still true of the engine. It is *not* true of the MCP server: an MCP
server that is not on npm cannot be installed by anyone, and the entire reason it is
worth having is that people discover MCP servers by searching a package registry. It
is the only distribution channel this project has, and it is closed until you publish.

There is also a clock on it. In the last seven weeks five other US-tax MCP servers
appeared on npm. One of them, `@invaro/opentax`, has nearly the same pitch as mine —
though it is AGPL-3.0 (which most companies cannot use in a product) and cannot be
imported as a library.

### What publishing takes

Both packages are ready and independent — `us-tax-mcp` vendors the engine at build
time, so there is no ordering constraint and you can publish either, both, or neither.

```bash
# once, on your machine
npm login

cd packages/us-tax-mcp
npm test            # 74 tests; confirm green
npm publish         # already set to public access

# optionally, the library on its own
cd ../us-federal-tax
npm test            # 238 tests
npm publish
```

The names `us-tax-mcp` and `us-federal-tax` are both unclaimed as of today. If you would
rather use different ones, tell me here and I will rename.

**If you would rather I not publish anything to npm at all, say so in this file** and I
will stop planning around it and treat the repo itself as the deliverable.

### What the server actually does that a chatbot cannot

Three things, and they are the reason it is worth someone's install:

1. **It knows 2025 was amended retroactively.** The One Big Beautiful Bill Act was signed
   in July 2025 and changed that year *after* the IRS had published it — the standard
   deduction, the SALT cap, the child tax credit and four brand-new deductions. Two other
   OBBBA changes are explicitly not retroactive. A model answering from memory gets 2025
   wrong in one direction or the other, confidently.
2. **It reports the real marginal rate.** Ask "what does a $1,000 raise cost me" and the
   answer is usually not the tax bracket. A head-of-household filer with two children at
   $30,000 is in the 10% bracket and faces **21.06%** — the whole cost is earned income
   credit withdrawal, and the bracket is invisible. That is computed by running the full
   estimate twice and differencing it, so it cannot miss an interaction.
3. **It carries the IRS's own corrections.** Two of the tables it uses were corrected
   after first publication, and both corrections are in here with tests pinning them.

### Nothing is broken

The engine is untouched — all 238 of its tests still pass without modification. CI now
builds and tests both packages.

---

## 2026-08-30 (Day 5)

### Nothing new is needed from you

Still the one open question below: whether to publish to npm, and under what name.

### What changed

`packages/us-federal-tax` is now **v0.6.0** with **238 tests**, all passing, and
covers **three tax years — 2024, 2025 and 2026** instead of one.

Everything built over the past four days now works for a prior-year return, an
amended return, or a year-over-year comparison. A family with two children,
$120,000 of wages and $25,000 of state taxes owes $6,432 for 2024, $5,563 for
2025 and $5,544 for 2026 — and the library can now show all three and say why
they differ.

Two reasons this is worth more than it sounds:

- **2025 cannot be interpolated from its neighbours.** The One Big Beautiful Bill
  Act was signed in July 2025 and changed 2025 *retroactively*, after the IRS had
  already published that year's numbers. Four of them were superseded (the
  standard deduction, the SALT cap, the child tax credit, and the four new
  deductions that did not exist at all). Two other OBBBA changes are explicitly
  **not** retroactive, so copying 2026's rules backward is equally wrong. A 2025
  calculator built either way is wrong, and most will be.
- **A published IRS table for 2024 contains a typo, and this library cannot
  reproduce it.** The IRS corrected the 2024 Form 1040 rate schedules in January
  2025: one line was $1,000 too high. Because this library computes tax from the
  brackets rather than copying the IRS's shortcut column, it gets the corrected
  figure automatically. Anything built from a PDF downloaded that first week does
  not. There is a test pinning it.

### One competitive note, since it may matter to your publishing decision

A package called **`@invaro/opentax`** appeared on npm in late July with a very
similar pitch — a US tax engine with everything cited to statute. I checked it
carefully. It is **AGPL-3.0-only** (which most companies cannot use in a product)
and it is **not importable as a library** — it ships command-line tools, not a
module you can `import`. So it does not occupy the same space, but it is the
first thing that has come close, and it is one more reason not to wait forever.

Separately: **five new tax-related MCP servers were published to npm in the last
seven weeks.** That is a real signal that AI agents are looking for tax tools and
finding them by searching a package registry — which is the one distribution
channel that works without any marketing. I plan to build an MCP server over this
engine next, for exactly that reason.

### Nothing is broken and nothing is blocked

No engine code changed today — the prior years dropped into paths that were
already there. All 199 previous tests passed untouched.

---

## 2026-08-29 (Day 4)

### Nothing new is needed from you

Still the one open question below: whether to publish to npm, and under what name.

### What changed

`packages/us-federal-tax` is now **v0.5.0**, with **199 tests**, all passing. It
computes **tax credits** for the first time: the child tax credit (with the $500
credit for other dependents and the refundable portion) and the earned income
credit.

This is the biggest single jump in usefulness so far. Until today the engine
stopped at tax *before* credits, which for an ordinary family with children is not
the number anyone wants — a household with two kids and $28,000 of wages owes no
income tax and is due a **$9,850 refund**, and the library could not previously say
so. It can now, end to end.

Why it is worth depending on rather than merely existing:

- **A non-refundable credit cannot reduce self-employment tax.** Most
  implementations subtract credits from one "total tax" figure. That understates
  what a freelancer with children actually owes — the child tax credit erases their
  income tax and none of their SE tax. This library keeps the two apart.
- **The child tax credit phase-out rounds up.** One dollar over the threshold costs
  a full $50, not five cents. Modelled as the statute writes it.
- **The IRS corrected the 2026 EITC table on 17 October 2025**, a week after the
  original release. This library carries the corrected figure and has a test
  pinning it. Anything transcribed from the first release is wrong in that cell.

I also found another small correctness edge over PolicyEngine-US, the most serious
open US tax model in any language — the child tax credit phase-out runs on
*modified* AGI and they use plain AGI. Details in the journal.

### Nothing is broken and nothing is blocked

Existing behaviour is unchanged: if you do not tell the engine about dependents, it
returns exactly what it did yesterday. All 138 previous tests passed without
modification.

---

## 2026-08-28 (Day 3)

### Nothing new is needed from you

Still the one open question below: whether to publish to npm, and under what name.

### What changed

`packages/us-federal-tax` is now **v0.4.0**, with **138 tests**, all passing, and
two new subsystems:

**Section 199A**, the qualified business income deduction, in full: the
specified-service-business phase-out, the W-2 wage and property cap, loss netting
across businesses, the taxable income limit, and the new $400 minimum deduction.

**The SALT cap** ($40,400 for 2026) and its phase-down above $505,000 of income.

Why they matter commercially: 199A is the number every pass-through owner actually
wants, and both provisions changed for 2026 in ways that code written last year
gets silently wrong — the 199A phase-in range widened by 50%, a $400 minimum
deduction did not exist before, and the SALT phase-down is brand new. A library
that is right about *this* year is worth depending on in a way that one repeating
last year's rules is not.

I also found small correctness edges over PolicyEngine-US again, written up in the
journal.

### One thing worth knowing, because it is a real limitation

There is a new overall limitation on itemized deductions for 2026 (OBBBA § 70111)
that I did **not** implement. Its formula depends on taxable income, which depends
on the 199A deduction, which depends on itemized deductions — a genuine circle
that the statute does not resolve, and the IRS worksheet that does resolve it is
on irs.gov, which this sandbox cannot reach.

I chose to document the gap loudly rather than guess at an ordering, because a
silent wrong answer is the one thing a tax library must never produce. The effect
is bounded and stated in the README: for someone with income above $640,600
($768,700 filing jointly) who itemizes, the deduction is overstated by at most
5.4%. Everyone below that is unaffected.

**If you can get me a copy of the 2026 Form 8995-A or Schedule A instructions**
(a PDF committed anywhere in this repo would do), I can close this. It is the
highest-value thing currently blocked on the outside world.

### My publishing recommendation has changed

On Day 1 I suggested waiting until the OBBBA deductions and 199A were both done
before a first release. **They are both done now**, and so is the SALT cap. The
package covers ordinary income tax, self-employment tax, FICA, capital gains,
NIIT, the SALT cap, Schedule 1-A and Section 199A, with 138 hand-computed tests
and cited sources for every figure.

If you want to publish, this is a reasonable first release. If you would rather
wait, nothing breaks — I will keep deepening it either way. Next up is prior tax
years (2025 and 2024), which makes everything already built more useful without
adding new risk.

---

## 2026-08-27 (Day 2)

### Nothing new is needed from you

The only open question is still the one below — whether to publish to npm, and under
what name. Today's work made the answer more attractive, not more urgent.

### What changed

`packages/us-federal-tax` is now **v0.2.0**, with the four One Big Beautiful Bill Act
deductions — tips, overtime, the senior deduction, and car loan interest — fully
implemented and tested. 77 tests, all passing. CI is green.

Why that matters commercially: those four deductions are new for 2025–2028, they
change real tax bills materially, and their phase-out rules quietly contradict each
other in ways most implementations get wrong. I found that even PolicyEngine-US — the
most serious open-source US tax model in any language — computes the tips and
overtime phase-outs as a flat percentage when the IRS worksheet says to drop partial
$1,000 increments. This package now gets that right, which is a concrete, checkable
reason for someone to depend on it.

I also corrected a Day 1 mistake: **GitHub Actions is not disabled.** It works, both
runs passed, and you can ignore what yesterday's note said about it.

### One thing you might want to know about

`packages/us-federal-tax` now builds against TypeScript 6. TypeScript 7 will remove
the module-resolution mode the CommonJS half of the build relies on, so that build
step will need reworking eventually. It is written down in the journal; nothing is
broken today.

---

## 2026-08-26 (Day 1)

### What exists now

`packages/us-federal-tax` — a zero-dependency US federal tax engine for JavaScript.
44 passing tests, ESM + CommonJS + TypeScript types, CI configured. Not published.

Why it is worth something: the JavaScript ecosystem has no serious open US income or
payroll tax engine, while Symmetry, Avalara and Vertex sell that math at enterprise
prices. Reasoning is in `STRATEGY.md`; the build log is in `JOURNAL.md`.

### Decision I would like from you, when convenient

**Should I publish this to npm, and under what name?**

The name `us-federal-tax` is currently unclaimed, as are `us-tax-engine`,
`federal-tax-us`, `paycheck-tax` and `taxkit-us`. Publishing needs an npm account,
which I cannot create.

If you want it published, the steps are:

```bash
# once, on your machine
npm login

cd packages/us-federal-tax
npm test          # 77 tests as of Day 2; confirm green before publishing
npm publish       # already set to public access
```

There is no rush. The package gets better every day it stays unpublished, and a first
release that is thin is worse than a later one that is not. My own suggestion: let me
add the OBBBA deductions and Section 199A first, then publish — that would make it
clearly the best free option rather than merely the only one.

**If you would rather I not publish anything to npm at all, say so in this file** and
I will treat the repo itself as the deliverable and stop planning around it.

### Two things worth knowing

1. **This is a tax library, so liability deserves a thought before it is public.** It
   ships MIT with an explicit no-warranty disclaimer and a prominent "this is not tax
   advice" section, which is the normal posture for this kind of package. I flag it
   because it is your name on the package, not because I think it is a problem.

2. **The `LICENSE` file says "Copyright (c) 2026 Logan Chu".** I inferred that from the
   git remote. Correct it if it should read something else.

### Nothing else is needed from you

No domains, no hosting, no accounts, no spending. If you do nothing at all, tomorrow's
run continues deepening the engine.
