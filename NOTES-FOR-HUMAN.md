# Notes for the human

Things I cannot do myself, because they mean acting on the outside world: spending
money, transacting, creating accounts, or contacting people.

Nothing here blocks my work — I can keep building either way, and the repo keeps
getting more valuable whether or not you do any of it.

**As of Day 20, nothing here blocks anyone else either.** Every entry below dated
Day 6 to Day 19 says that an unpublished package cannot be installed by anyone and
that publishing is the one thing only you can do. That was wrong, I found out on
Day 20, and it is fixed: all three packages now install from a public URL with no
account and no token. See the Day 20 entry. The npm ask survives but it is now
about reach, not about capability, and those older entries overstate it badly.

**As of Day 43 nothing is waiting on you.** `us-federal-tax` is v0.15.0,
`us-state-tax` v0.39.0, `us-tax-mcp` v0.42.0. 1,347 tests, all passing, and the
differential grid against PolicyEngine-US now covers **1,056 households, 7,392
figures, 6,849 agreeing to the dollar and ZERO unexplained differences**.

Day 43 added **Wisconsin**, the twenty-fourth taxing state, and it is the one
where the published rate table is furthest from the tax. Wisconsin withdraws its
standard deduction **as a percentage of income** rather than in steps — 12% for
a single filer, 19.778% on a joint return, 22.515% for a head of household — so
inside the phase-out band the filer's marginal rate is the statutory rate
MULTIPLIED by one plus the withdrawal rate. A joint filer in the 5.3% bracket
pays **6.348%** on their next dollar. **Wisconsin's published top rate is 7.65%
and the highest marginal rate an ordinary Wisconsin wage earner ever meets is
6.348%, at `$69,260` of joint taxable income — 374,000 dollars of joint income
below where the 7.65% begins.**

And the rate is **not monotonic**. The withdrawal ends, and the statutory rate on
the far side is lower than the inflated rate on this side, so a Wisconsin filer's
marginal rate FALLS as income rises. A head of household's falls twice: 3.500%,
4.290%, 5.391%, **4.930%**, 5.936%, **5.300%**, 7.650%. No other state in this
package has a marginal rate that turns downward at all.

**The thing worth a retiree's attention is four months old.** 2025 Act 15 created
a subtraction of `$24,000` of retirement income at age 67 (`$48,000` where both
spouses on a joint return qualify) — and a filer who claims it **forfeits every
credit on the Wisconsin return**, including the earned income credit and the
homestead credit. It is an election and not a limitation, so this engine computes
the whole return both ways and returns the lower tax, which is what the Schedule
SB instructions tell the filer to do. Measured, the crossover for a couple at 68
with `$80,000` of other income and `$4,000` of property tax is **`$5,692.35`** of
pension: below it the credits are worth more, above it the subtraction is, and
the whole `$300` school property tax credit goes at once on the dollar that tips
it. On the calculator's retired-couple ranking Wisconsin is now the thirteenth
state to pass Utah and **the first to do it by changing its own law** rather than
by being modelled.

**The grid found two defects in the reference model and none in this one**, which
is the first time that has happened on a new state. PolicyEngine-US carries
Wisconsin's 2025 middle bracket as the 2025 Act 15 figure *indexed a year early*,
and uprates Wisconsin's unpublished 2026 standard deduction by the **federal**
inflation index where Wisconsin indexes on its own — and its own 2026 bracket
figures, which it read from the Department of Revenue, imply the Wisconsin index.
The two halves of its 2026 Wisconsin disagree with each other.

**The mutation audit went DOWN, and that is the honest headline.** 1,358 mutants
(up from 1,267, predicted exactly), 1,347 killed, **11 survivors, 99.2%** against
Day 42's 99.5%. Five of Wisconsin's 82 mutants survived: four are a constant
`WI_TOP_BRACKET_BASE` that holds the statutory bases the 2026 derivation rests on
and that **nothing reads** — its own comment points at a test which deliberately
writes its own copy of the figures — and one is a dead conditional. Both are
small fixes and both are now written down; a score that can go down is the only
kind worth quoting, and this is the instrument doing its job on code written the
same day.

**And a 2026 figure nobody has published is now KNOWN rather than carried
forward.** Wisconsin publishes its rate schedules a year early and its standard
deduction table a year late. Because the top bracket is indexed off a statutory
base of `$225,000`, a published threshold pins the indexation factor to 7.5 parts
per million — which determines four of the seven unpublished 2026 figures
outright and narrows the other three to two adjacent multiples of `$10`. Those
three are flagged, each with its interval, both candidates and the bound: **at
most 77 cents of tax.** It is the narrowest provisional flag this package has
ever carried, and `test/wisconsin-indexation.test.js` proves the method by
predicting the published 2025 schedule from 2021–2024 alone.

### One Wisconsin question I could not finish, and it is worth up to $2,861

**Wisconsin appears not to offer the qualifying surviving spouse filing status at
all**, and both this package and PolicyEngine-US currently put that status on
Wisconsin's *joint* rate schedule. Two independent lines of evidence say that is
wrong:

1. **The Form 1 instructions.** "If your spouse died before 2025 and you have not
   remarried, you must file as single or, if qualified, as head of household."
   Federally, a spouse who died in 2023 or 2024 is exactly what makes a 2025
   filer a qualifying surviving spouse — so the sentence excludes the status
   rather than describing it.
2. **The statute's own structure.** Wis. Stat. § 71.06 writes its rate schedules
   for "fiduciaries, single individuals and heads of households" and for
   "married persons" (joint, and separately). **There is no surviving-spouse
   schedule to use.** Single filers and heads of household share one schedule in
   Wisconsin, which this package already models and asserts.

I have not changed it today, for a boring and good reason: the recorded mutation
audit was already running over the build, and changing a parameter mid-run would
have invalidated the score. It is **the first item on tomorrow's worklist**, with
the evidence already gathered.

**The size, measured on the current build** — a surviving spouse with one
dependent, 2026, against what the single and head-of-household schedules would
give:

| Wisconsin AGI | on the joint schedule | as single | as head of household |
| --- | --- | --- | --- |
| `$45,000` | `$708.18` | `$1,299.54` | `$1,235.57` |
| `$90,000` | `$3,123.49` | `$3,796.82` | `$3,796.82` |
| `$450,000` | `$23,034.36` | `$25,895.44` | `$25,895.44` |

So the error, if it is one, runs **up to `$2,861` in the filer's favour** and is
the largest single open question in the package. Note it is in the *flattering*
direction, which is the direction that gets a tax library into trouble.

**Nothing for you to do**, unless you happen to have the 2025 Wisconsin Form 1
instructions to hand, in which case page 2 settles it in one line and you could
drop it in an issue.

Day 42 added **Oregon**, the twenty-third taxing state. The headline is a
composition rather than a figure: **Oregon's top 9.9% rate nominally begins at
`$125,000` and does not reach a single filer until `$133,161` of federal AGI**,
because Oregon lets every filer subtract their federal income tax — up to
`$8,750` — and that subtraction is what holds their Oregon taxable income below
the threshold. The two steepest things in the Oregon schedule are aimed at the
same dollar and never meet there.

Oregon is the third state here that deducts the federal income tax, and the
three do it three incompatible ways: Alabama the whole bill uncapped, Missouri a
*share* of it chosen by a chart on Missouri AGI, Oregon the whole of it up to a
*ceiling* chosen by a chart on **federal** AGI. No two of the three subtract the
same federal credits from it either — Oregon leaves the earned income credit in,
which is the one credit both others take out — so the single input
`federal.earnedIncomeCredit` now moves this library's answer in three different
directions depending on the state.

**The grid earned its keep on the first run of a new state, for the second day
running, and this time the defect was mine.** A married Oregon filer on a
separate return claims **two** exemption credits — the Form OR-40 instructions
let a filer "filing separately but your spouse has no income" check the spouse's
exemption box — and this package claimed one, `$263` a return. The gap was not
Oregon's: the package has modelled that § 151(b) spouse for four states since
Day 30, but on its *exemption* rule, and the *exemption credit* rule had never
been asked the question because the two states that had one before Oregon could
not show it. Fixed, with the spouse deliberately left unclaimed for Ohio and
California because neither has been read on it.

**And the other 37 differences are one fact, with this package on the right
side.** Every one is tax year 2026 and none is 2025. PolicyEngine carries
Oregon's 2026 figures as its 2025 figures *uprated*; this package carries the
ones the Department of Revenue **published** in its 2026 withholding formula on
31 December 2025. The tell is the exemption credit: PolicyEngine computes
`$261.80170566232823` where Oregon prints `$263`. A tax credit that is not a
whole number of dollars is a figure nothing published.

The grid earned its keep again on the first run of a new state. It found a
Missouri credit this package did not have — the **working family tax credit**,
20% of the federal earned income credit and non-refundable, which zeroes most
low-income Missouri returns outright: a head of household with one teenager on
`$35,000` of wages owes `$264.22` before it and nothing after. Five of the
grid's thirteen Missouri differences were that one missing credit. It also
found the reverse: the seven that remained are all one disagreement in which
**this package is the one following the statute**, about which side of
`$50,000` and `$100,000` of income a filer standing exactly on it falls.

The mutation audit was re-run over the build that ships — **1,267 mutants,
1,261 killed, 6 survivors, 99.5%** — with every one of the 82 mutants Oregon
added killed and the same six survivors as before, each of them a number no
return can reach. All four figures were predicted in writing before the run, and
this time so was the count: 76 literals counted by hand in Oregon's own module
and confirmed at exactly 76, plus six in the provenance ledger, which is a file
full of year literals and gets audited like any other.

**One thing cost three runs of that audit and is worth your knowing only because
it is now fixed.** `--record` takes a file path, I passed it as a bare flag, and
the harness read the missing value as "do not record" — so a 105-minute
measurement printed a correct report and wrote nothing, with no error and exit
code 0. The flag now defaults sensibly, errors when a value is genuinely
required, and **announces where it will write at start-up instead of on
success**, so a long measurement can no longer decline to record in silence.
Two earlier runs died on the same underlying rule, which is also now written
down: make every documentation edit before starting the audit, because the
fingerprint that proves a score is current is a hash of raw bytes and a
corrected citation changes them.

Day 41 added **Missouri**, the twenty-second taxing state, and it is the one
where the word "rate" stops meaning anything. Missouri deducts a SHARE of the
federal income tax, and § 143.171.2 writes the share as a cliff rather than a
phase-out: 35% of the federal bill at `$25,000` or less of Missouri adjusted
gross income, 25% to `$50,000`, 15% to `$100,000`, 5% to `$125,000`, nothing
above. One percentage applies to the whole bill, so **one dollar of income at
`$100,000` costs `$61.94`** — the engine's own marginal-rate field reports
`61.946` there and `0.047` a thousand dollars either side.

Missouri is also **the first state in the United States to exempt capital gains
outright** (HB 594, signed 10 July 2025, retroactive to 1 January, short-term
gains included). The two provisions are really one: the exemption is a
subtraction in arriving at Missouri AGI, which is the figure the cliff chart is
read against — so it takes the gain out of the base AND moves the filer down a
step, which on `$90,000` of wages and a `$60,000` gain is worth `$2,960.79`
where 4.7% of the gain alone is `$2,820`. The story is at the top of
`packages/us-state-tax/README.md`.

Day 40 added **Alabama**, the twenty-first taxing state, and it is the one state
in this package where **a federal tax cut raises the state tax bill.** Form 40
line 12 deducts the federal income tax paid, and every Alabama filer takes it —
not only itemizers — so every dollar the federal government stops charging is a
dollar more of Alabama taxable income at 5%. A `$2,200` federal child tax credit
costs an Alabama family `$110` of state tax. The federal earned income credit
raises it too, because Alabama's worksheet subtracts the refundable credits from
the deduction — which makes one input in this library move the answer in
*opposite directions* in two different states. The story is at the top of
`packages/us-state-tax/README.md`.

Day 39 added **Connecticut**, the twentieth taxing state. It is the clearest
demonstration this package has of what it is for: Connecticut has no continuous
stretch of income tax above `$30,000` — four staircases overlap, three of them
built from the same four words of statute ("or fraction thereof"), and each is
reached by ONE DOLLAR of extra income rather than by a proportion of it.

**The thirty-second ask from Day 37 is still the only one worth your time, and
it is still thirty seconds.** It is the first item below: a description and six
topics in this repository's settings.

Re-checked again on Day 42 rather than remembered. I read the repository's own
metadata through the API: **`description` and `topics` are still empty and
`has_pages` is still `false`**, and the record now says the same thing on six
separate days. Day 37 reported that `PATCH /repos/{owner}/{repo}` was refused by
that session's permission layer; today's session reports `admin: true` on the
repository and still exposes **no tool that writes repository metadata** — it can
read, commit, open pull requests, drive Actions and manage releases, and there is
nothing in it for a description or a topic. Either way the answer is the same and
it is the right one: repository settings are yours, not mine.

The one line worth adding after six days of the same answer: **this is the only
item in this file that has never moved, and it is also the cheapest.** Everything
else I listed as blocked turned out either to be something I could do myself
(Day 20: the packages install from a public URL with no account) or something
that stopped mattering. This one is thirty seconds of yours and I cannot do it at
all.

Day 38, for context on why it matters a little more than it did: I installed
the published packages the way a stranger would and the first call I wrote
returned a **$0 tax bill on a household with $180,000 of wages** — because I
typed `wages` where the field is `w2Wages`, and the engine dropped the key and
answered about a household with no income. That is fixed, in both engines, and
the fix found two more defects inside this repository's own test suite. The
whole story is in the journal and at the top of `README.md`. Nothing about it
needs you.

---

## One thing that is not an ask, and is the number you would want before deciding

Nothing below has changed, but Day 39 produced a figure that bears on what this
repository is worth and I would rather you had it than not.

**This package covers twenty-four of the forty-two jurisdictions that tax income.**
The missing eighteen are Minnesota, South Carolina,
Louisiana, Oklahoma, Iowa, Rhode Island, Vermont, Arkansas, Kansas, Nebraska,
New Mexico, Montana, Maine, Delaware, Hawaii, North Dakota, West Virginia and the
District of Columbia. That list is no longer prose: it is a declared, exported
constant the engine's own error message is built from, because the old sentence
named Connecticut as uncovered for the whole of the day Connecticut shipped.

That matters more than it sounds, because **breadth here is a step function and
depth is a curve.** A company that would pay for this needs the states its
employees live in, and almost no US employer's payroll fits inside twenty states.
Every day of the last five weeks has made the twenty states more right, which is
real and is the moat — but a nineteen-state engine and a twenty-state engine are
the same product, and a forty-two-state one is a different one.

Connecticut, Alabama, Missouri, Oregon and Wisconsin each took one day, including
their own test file, their provenance entries and the defects they exposed in the
test machinery. Five states in five days. So the remaining eighteen are **under
three and a half weeks of runs** at the current standard — and the estimate has
got *better* every time it has been restated, which is the opposite of how these
usually go.

The reason it keeps improving is worth one line, because it is the thing that
would decide whether to keep going: the states have started composing. Alabama
needed a new rule for the federal tax deduction, Missouri needed one more field
on it, and Oregon needed two — the machinery is being extended rather than
rebuilt, and each new state audits the ones before it. Oregon found a defect in
the exemption-credit rule that had been there since Day 30.

Day 43 is worth one more line on this, because it is the first time the new state
found defects in the thing this package is checked against rather than in itself.
Wisconsin produced zero defects in `us-state-tax` and two in PolicyEngine-US, and
both are indexation errors on 2026 figures. **The moat is starting to point
outward**: a package that has read the agency documents and done the interval
arithmetic can now say, with a test, which of two models is right about a figure
neither of them can look up.

Nothing for you to do. It is a number you would want if anyone ever asks you what
this is worth.

## Thirty seconds, and it is the first time I have had an ask this cheap

**This repository has no description, no topics and no homepage.** I checked today
and GitHub reports all three empty.

That matters more than it sounds like it should, because the repository is the only
distribution surface this project actually has. GitHub's own search ranks on the
description; its topic pages (`github.com/topics/tax`) are a browsable index that
people and crawlers both use; and a repository with no description renders as a
blank card everywhere it is linked, including in search results and in any chat
window someone pastes the URL into. Right now somebody who finds this repo sees a
name and a file list.

I tried to set it myself. `PATCH /repos/{owner}/{repo}` is refused to me — not by
GitHub, by this session's own permission layer, which treats repository settings as
a shared resource I should not change on my own. That is the right call and it makes
this your thirty seconds rather than mine.

**Settings → General** (the description box is at the very top of the repo page, via
the gear icon beside "About"):

> **Description.** Dependency-free US federal and state income tax engines for
> JavaScript, plus an MCP server. 30 states, 1,033 localities, two tax years,
> every figure cited to the release it came from and a measured mutation score.
> MIT.

> **Topics.** `tax` · `taxes` · `income-tax` · `payroll` · `mcp` ·
> `model-context-protocol` · `typescript` · `javascript`

> **Website.** Leave it blank unless you switch Pages on (see below), in which case
> `https://loganchu.github.io/agent_playground/`.

Change any of it you like — you know what you want this repo to be and I do not.
The specific words matter much less than the three fields not being empty.

## The one optional thing, kept here so it stops being buried

Nothing below blocks me and nothing below blocks a user — all three packages
install today from a public URL with no account. But there is exactly one action
that is worth more than anything I can do on my own, and it has been fourteen
entries deep in this file since Day 22, under a heading that says everything is
fine. So it lives here now.

**Publish the three packages to npm.** Three steps, about ten minutes, once:

1. npmjs.com → your avatar → **Access Tokens** → Generate New Token →
   **Automation**.
2. This repo → Settings → Secrets and variables → Actions → New secret named
   **`NPM_TOKEN`**.
3. Actions → **Release** → Run workflow. Tick the dry run the first time; it
   prints what it would publish and touches nothing.

**What it buys, stated honestly: reach, and nothing else.** The code is no better
for being on npm. What changes is that somebody looking for this can find it.
People discover packages by searching a registry for `tax`, `state-income-tax`,
`self-employment-tax` — five competing US-tax MCP servers appeared on npm in seven
weeks, which is the evidence that agents and developers are looking in exactly
that place. A tarball URL nobody has seen is not much better than a registry entry
nobody has searched for, and only one of those two can be searched.

**What it costs if you would rather not:** nothing breaks, and I keep working. The
reason I keep raising it is that I cannot create an account, and so this is the one
lever in the whole project that is only yours to pull.

### A second one, much smaller, found today: one document I am not allowed to read

There is exactly one group of numbers in the federal package that was never read from
an IRS document — the 2026 payroll withholding amounts. I had recorded that as
"Publication 15-T for 2026 was not available", which today turned out to be the wrong
description. **The document is published.** It is at
`https://www.irs.gov/pub/irs-pdf/p15t.pdf`. What is true is that **this sandbox's
network policy blocks irs.gov**, so I can search for it and not fetch it.

Either of these settles it permanently:

- **Allow irs.gov.** In the cloud environment menu in this session's title bar →
  **Edit** → **Network access**: either a broader access level, or `irs.gov` added to
  the allowed domains. The access levels are described at
  https://code.claude.com/docs/en/claude-code-on-the-web. That would also let future
  runs read Revenue Procedures and state tax booklets first-hand instead of
  reconstructing them, which is the single biggest constraint on this project's
  accuracy work.
- **Or paste me three numbers.** From Publication 15-T (2026), Worksheet 1A line 1c:
  the annual standard deduction for married filing jointly, for single or married
  filing separately, and for head of household. I predict `$32,200`, `$16,100` and
  `$24,150`. If those are right the flag comes off; if they are not, I have a real bug
  and it is in the most-used part of the package.

I have written the prediction down on purpose. It is checkable in thirty seconds by
anyone with the PDF, and a prediction that can be checked is worth more than a caveat
that cannot.

## 2026-10-01 (Day 37)

### I asked our state engine the question I asked the federal one yesterday, and the answer was better news and worse news

Yesterday I found that the federal package's citation list was 41 documents short.
Today I pointed the same audit at the state engine, which is three times bigger — and
**its citations were one document short, not forty-one.** The reason is structural and
worth knowing: a state's citations are kept per state *and* per year, so the failure
that cost the federal package 41 documents (a list kept per year is three chances to
forget the same statute) cannot happen there. The one gap was the federal poverty
guidelines behind Maryland's poverty level credit, which Virginia — with the same
provision — had cited all along.

The worse news was somewhere I had not been looking. Our two tax years agree on **949
numbers**, and only 148 of them were flagged as "carried forward from last year". The
other 801 were identical for one of two completely different reasons:

- **the law fixes them** — New Jersey's brackets have not moved since 2020, Virginia's
  rate schedule since 1990, New York indexes nothing at all — or
- **nobody read the 2026 document**, which is the one thing we say about ourselves that
  nobody else in this space gets right.

Nothing in the package said which. So I built the table that does: every one of the
**2,293 numbers** in all 28 states now names the document it came from and what kind of
authority sets it, with tests that fail if a number claimed to be fixed moves, if a
number claimed to move does not, or if a number cites a document its own state does not
list.

### It found two bugs in our own warning labels, and they are opposite bugs

**Idaho and Ohio were warning about too little.** Idaho's 2026 zero bracket is one
number that applies at $4,811 for single filers and twice that for joint filers — and
the warning named the single column only, so four of five filing statuses were carrying
an unread figure with nothing saying so. Ohio was worse: three numbers across five
columns, flagged in one. **Three of fifteen.** Both are fixed, and there is now a test
that fails on any warning that stops at one filing status.

**California was warning about too much.** It flagged five whole sections of the return,
which swept in **California's 45 tax rates — which are set in statute and are certainly
correct**, three lines above a note of ours saying exactly that. That is not the harmless
direction to be wrong in. The rate is the one California number a user can rely on
completely, and warning about it spends the credibility that makes our other 76 warnings
worth reading. Also fixed.

### The useful thing it produced: what next tax year will cost us, state by state

Every number now says what adding a new tax year would require for it, and the totals
are a work list nobody else publishes:

| for tax year 2027 | numbers |
| --- | --- |
| nothing at all | **892** |
| read the statute's own schedule | **109** |
| read a state release | **145** |

**New York needs nothing** — 204 numbers, all of them fixed in the Tax Law — and nor do
New Jersey, Georgia, Indiana, Mississippi, North Carolina, Pennsylvania or Arizona.
Michigan needs 17 of its 22. California needs 76 of 146. A language model using the MCP
server can ask this per figure now: pass a state to `figure_provenance`.

### And one embarrassing one, which I found by reading my own output

The new tool reported a California tax rate of 0.08 as **"$0.08"** — eight cents, for a
figure that means eight per cent. The federal version of the tool had been doing the
same thing to every rate in the tax code since I built it yesterday. Fixed, with a check
that runs over all 3,092 numbers in both engines.

### One thing you may have seen and I had not: CI has a red X on every commit

I checked the Actions tab today for the first time in a while and **the last five
pushes all failed.** Four of the five jobs pass every time. One — the job added
yesterday to stop the README's test counts going stale — dies after twenty seconds
and has never once finished.

The cause is not in the repository, which is why it survived two days of me saying
"all tests green" honestly. **This sandbox has TypeScript installed globally; the
GitHub runner does not.** So the build step worked here without installing anything
and failed there with `tsc: not found`, and my local runs and CI were checking
different things.

Fixed three ways: the job now installs what it measures, the error now names the
cause instead of reporting that it found nothing, and the tool now **refuses** to
run when a package's dependencies are missing — so a local run fails for the same
reason CI does, which is the only version of this that stays fixed. Reproduced and
re-verified before pushing, by shadowing the global TypeScript so this sandbox
behaved like the runner.

Nothing was wrong with the packages themselves; all 1,143 tests pass and have been
passing. What was broken was the thing watching them, and the lesson is worth more
than the fix: **an instrument nobody looks at is the same as one that was never
built.** If you ever see a red X here and I have not mentioned it, I have not looked.

### Still waiting, unchanged

- **npm.** Three packages, still unpublished. Ten minutes, and it is the only thing that
  buys a name people can search for. Details below under "The one optional thing".
- **`irs.gov`.** Still blocked by this sandbox's network policy — I re-tested it today.
  The one group of federal numbers never read from a document (the 2026 payroll
  withholding amounts) is still unread, and my prediction for them is still written down
  and still unchecked: **$32,200, $16,100, $24,150**.
- **GitHub Pages.** Still off, so the calculator builds and tests on every push and
  publishes nowhere. One dropdown: Settings → Pages → Source: GitHub Actions.

---

## 2026-09-30 (Day 36)

### I went looking at our own headline claim and it was not true

The first thing this package says about itself is that every number in it is cited to
the IRS document it came from. That is the whole pitch: anyone can check us.

It was a list of links on each tax year with **nothing saying which link any
particular number came from**. For 2024 that was 240 numbers and 8 links. So I built
the missing half — a table that maps every number to the document behind it — and the
first thing it did was tell me how many documents were missing.

| tax year | documents we listed | documents our numbers come from | missing |
| --- | --- | --- | --- |
| 2024 | 8 | 19 | **13** |
| 2025 | 10 | 24 | **17** |
| 2026 | 25 | 24 | **11** |

Forty-one. And they are not exotic. The law that sets the Social Security and Medicare
payroll rates, the law that sets self-employment tax, and **the section on taxing
Social Security benefits — which is the finding our own package description leads
with** — were cited by none of the three years.

The lesson generalises and I have written it down: **the figures nobody doubts are the
figures nobody cites.** You write a citation when you are unsure. The payroll rate has
been 6.2% since 1990, nobody ever looks it up, and so nobody ever added the one
document that states it.

All 41 are in now, and there is a test that fails if a number's document is missing
from the year it belongs to — in both directions, so a link nobody reads a number from
has to say what it is for instead.

### The nicest thing in it: the package can now say what it did not read

One group of numbers — the 2026 payroll withholding amounts — was never read from a
document at all. We worked them out from the IRS's published figures using a formula
that reproduces the 2024 and 2025 tables exactly, because the 2026 withholding booklet
was not reachable from this sandbox.

That was true before today, and it was recorded in a sentence of prose that nothing
could act on. Now it is data: those figures are marked `reconstructed`, and they name
**the exact worksheet line of the exact booklet** that would confirm or refute them.
"Nobody read it" and "the document says otherwise" are very different statements, and a
package that can tell you which one applies to a given number is doing something none
of its competitors do.

A model using the server can ask now: there is a new `figure_provenance` tool that
answers "where did this number come from" for any single figure, or groups a whole
year's 279 figures by what kind of document publishes them.

### And one of our own tests was lying to us

A test in the MCP package checked that three test counts quoted in its README were
current. It compared them to three numbers **copied out of that same README.** It
called itself "deliberately brittle" and it had never once fired: the suites had grown
from 283, 51 and 97 tests to 369, 581 and 159 while the test said everything was fine.

**A test that checks a claim against a copy of the claim cannot notice the claim going
stale, and looks exactly like one that can.** A test suite cannot count itself, so the
measurement now lives in a small tool that runs all four suites and fails the build if
the README or the recorded count has drifted. The README numbers are correct again.

**Nothing for you to do about any of this.**

## 2026-09-29 (Day 35)

### A competitor moved, and the move is worth knowing about

`irs-taxpayer-mcp` — the closest thing on npm to what this project builds — released
1.1.0 on 18 September and re-described itself from "MCP server" to "deterministic
local US individual tax engine". Its package manifest now carries the two fields that
say a package can be used as a library.

I checked, because that combination (MIT licence, importable, actively maintained) is
the written condition under which this project should stop and do something else.

**It does not hold, and the reason is one file deep.** The field that says "here is
the library" points at the program that starts the server. Importing it does not give
you a tax engine; it launches an MCP server. The types file beside it declares that
the package exports nothing. So the manifest now advertises something the code does
not do, which is worse for a would-be user than the old version, where the attempt
simply failed.

The part that actually decides the competitive question is smaller and less arguable.
Their package ships a table of all fifty states — and its own source comment says
that table is reference only. The states it can actually compute a tax for are:

- **2024**: California, and the nine states with no income tax
- **2025**: the no-tax states
- **2026**: the no-tax states

So **for the two years this project supports, it cannot produce a non-zero state tax
for any state.** Everything else raises an error rather than guessing, which is good
engineering and I want to say so plainly — it is the same instinct as this project's
"state limitations loudly". But it means the overlap between the two packages is one
state in one year, and in that one their California return applies a deduction and an
exemption to gross income and walks a bracket table, with no credits at all: the
`$144` personal exemption credit that California grants as a credit rather than a
deduction is simply not in the package.

I verified all of this by running their code, not by reading their README.

**Nothing for you to do about it.** I am recording it because "a well-tested,
importable, permissively licensed US tax engine appears on npm" is the written
condition for abandoning this direction, and somebody skimming the registry could
reasonably think it had just happened.

### What I built today

Two instruments, and the second one is the one I would point at.

**The first** finishes the measurement work of the last three days. The weekly audit
that sets every number in the package wrong had ten numbers left that no test would
have noticed, and all ten were rows of a *step chart* — Ohio pays a retirement credit
of `$25`, `$50`, `$80`, `$130` or `$200` depending on which of six bands your pension
income falls in, and five of the six bands had nothing checking them.

The fix is a small idea. Rather than inventing more imaginary households and hoping
one of them lands in each band, the test now puts **one probe inside every step of
every step chart in the package**, automatically, by finding the charts themselves.
It then takes every number in every one of those charts — 627 of them — sets each one
wrong, and fails unless an answer changes. Two of the 627 are exempt and each carries
a written reason.

**The second is about the product rather than the score.** This package's pitch is
that it says what it does not know, *in the answer* — a language model reading the
result sees the caveat, where it would never see a README. Those sentences were the
only output in the package with nothing asserting them at all. A warning written for
2026 could have appeared on a 2025 return, or disappeared from 2026, and every test
would still have passed.

All 462 of them are now pinned: the first 72 characters of each, in order, per state
and year. Not the whole sentence, on purpose — the prose gets edited and a file that
churned every time a clause moved would stop being read, which is the same as not
having it. What it catches is a warning appearing, vanishing, moving or landing in
the wrong year.

### Where the quality number landed, and why the composition matters more

The weekly audit — the one that sets every number in the package wrong and counts
which ones no test notices — went from **26 numbers that could have been wrong
silently to 6**. As a percentage that is 96.3% to 99.1%, and I ran it twice: once to
find what was left, and once after fixing three of them to check that the number was
what I thought. It was. I ran the second one anyway because a score worked out on
paper is a score nobody measured, and a package whose whole pitch is that its quality
claim can be checked cannot publish one it did not check.

The number is not the interesting part. **This is the first time none of what remains
is a missing test.** Four of the six are conditions on a tax year outside the two this
package covers, so no question anyone can ask reaches them; one is a `0.01` used to
mean "just below the next band", where any small number does the same job; one is a
row of Ohio arithmetic that no return can reach, and that one now has a test saying so
explicitly rather than being left alone.

I would rather report that than the percentage, because a percentage can always be
pushed up by writing tests that assert a number equals itself, and that is the failure
mode this project has been careful about since Day 27.

Three of the nine the run found were real, and worth one line each because two of them
are the same mistake in different clothes:

- California's earned income credit has a figure that shapes the long tail of the
  credit for one-child families, and no test household sat in that tail — its
  two-child and three-child neighbours did, which is how it stayed invisible.
- Another California figure *had* a test, and the test was blind: it built its
  imaginary household by reading the very number it was checking, so changing the
  number moved the household with it and the test passed either way.
- And an Ohio threshold turned out to be read by nothing at all. That is actually
  correct — the engine cannot know how a couple's income splits between them, so it
  asks the caller and the `$500` test is theirs to apply — but it left the stored
  figure free to drift away from the `$500` the package tells the caller in words.
  Now they have to agree.

### The one thing worth knowing from the measurement

I found a case the audit cannot see about itself, and it is small and pleasing.

The audit works by doubling a number and adding one. So a number whose correct value
is **zero** can only be made wrong by one dollar — and one dollar of Ohio tax, inside
the band where Ohio charges nothing, is swallowed by the `$20` credit every return
there already has. The row is unreachable in that sense and it is also one of the most
consequential numbers in the state: it is why an Ohio filer at `$26,050` owes nothing
and one at `$26,050.01` owes `$342`.

Both things are true at once, and the useful conclusion is not about Ohio. It is that
what is testable there is the *width* of the band, not the zero at the bottom of it —
so that is what the probes check, and the zero is written down as exempt with the
reason beside it rather than quietly counted as covered.

## 2026-09-28 (Day 34)

### One thing I dropped, and why, so it stops being re-listed

The plan had said for four days that the first job was to record **which filing
statuses each state's own form actually has** — Virginia's Form 760, for instance, has
no head-of-household box at all. I dropped it, and I want to say why plainly because
it will otherwise keep reappearing as "an afternoon's work."

**I cannot get at the source documents from here.** The sandbox's network only reaches
GitHub and the package registries, so a state revenue department's own PDF is
unreachable; what I can reach is a web search that hands back another model's summary
of the page rather than the page. Asked the same question about Michigan's form twice,
neutrally, it gave me two different answers, both of which I believe are wrong, and
neither quoted the form. For Virginia the same search returned the Department's own
sentence verbatim, which is usable.

So the tool works for some states and quietly fails for others, and a table where half
the entries are sourced and half are my recollection is worse than no table — a reader
cannot tell which half they are looking at, and provenance is the whole point of this
package. **The blocker is network access, not effort.** If that ever changes this is
half a day's work.

It also turned out not to block anything: the sweep below needed it only if the sweep
were claiming the figures are *correct*, and it claims they are *watched*, which is a
different thing and needs no statutory authority.

### Yesterday's measurement said the biggest blind spot was a filing status

Yesterday I built something that takes each number out of the tax engine, sets it
wrong, and checks whether any test notices. On the state engine, 100 numbers could
have been wrong silently — and sorting them showed the misses were not spread across
the rules. They were concentrated in two **filing statuses**: married filing
separately, and head of household.

Nearly every state sets its own figures for those two. A separately-filing couple in
California gets a different exemption credit, a different renter's credit and a
different standard deduction; a Maryland head of household gets a different senior
credit and a different poverty limit. Nine states had cells nothing was checking, and
they were all in those two columns.

**The reason is ordinary. A test is written about an imagined person, and the imagined
person is single or married filing jointly, because that is who you picture.** The
proof that it is about attention and not about the statuses is Massachusetts: there
the *separately* figure is the one that was tested and the other three were not.

### The fix, and the one number in it worth knowing

Today's work runs 22 households through **all five statuses** in all 19 taxing states
in both years — 4,180 answers, all pinned. Every one of those blind cells is now
covered.

But the part I would actually want you to know is the second test, because it is the
one that makes the first one honest. **4,180 expected numbers prove nothing on their
own** — if they all happened to be zero, they would pass every day and guard nothing.
So there is a companion test that takes every status-dependent number in the package,
sets it wrong, and fails unless one of those 4,180 answers changes. It runs in a
second, on every push.

That is the weekly audit's question, asked inside the ordinary test suite. The two
now agree by construction instead of by luck.

### Why there are 22 households, which turned out not to be a judgement call

I expected this to be the hard part — guessing which imagined people to write. It
isn't, and the reason is small enough to state.

The audit changes a number by doubling it and adding one. A household only *notices*
a threshold moving from `$50,000` to `$100,001` if its income is somewhere between
the two. So if you line households up at doubling intervals — `$3,000`, `$6,000`,
`$12,000`, and so on to `$1,600,000` — then every threshold in the law has a
household sitting in its window, and no smaller set does.

**The number of households a test suite needs is therefore proportional to how many
times you can double your way across the income range — about ten — and not to how
many parameters there are.** Ten rungs, run three times over (a wage, a family with
children, a retirement, because a rule about pension income is not reached by a
wage), plus a handful of shapes that exist for one thing each: a blind filer, a
veteran, a centenarian, a household with three young children.

### The measurement, and the way it corrected me

Running yesterday's audit again on today's code: **100 numbers that could have been
wrong silently, down to 26.** The score went from 85.8% to 96.3%.

I then read all 26, and they are worth reporting because they are not 26 problems.
**Only ten of them are a missing test.** Those ten are step charts — Ohio's retirement
credit pays a different amount in each of six income bands, and nothing checks five of
them — and they need a different tool than today's, which I have specified rather than
started.

Of the rest: four are conditions on a tax year outside the two this package supports,
so no question anyone can ask reaches them. One is a `0.01` used to mean "just below
the next band", where any small number does the same job. Five are a 2% difference
between the 2025 and 2026 federal poverty guidelines, and those are the ones that
**corrected a claim I had made earlier the same day**, in writing, before the run.

I had argued that the number of households a test suite needs is small because a
doubling ladder catches any doubled number. That is true, and it does not cover a
*year* condition: switching from the 2025 poverty guideline to the 2026 one does not
double anything, it swaps `$15,650` for `$15,960`. Catching a 2% change needs a
household inside a 2%-wide window, and no ladder can promise that. So the households
are the wrong tool for those, however many I add, and the plan now says so.

### And the one I did not expect, which is about the product

The last five survivors are the *prose*. Each state's result carries notes — "this
figure is carried forward from 2025, here is why, and here is the direction it errs
in" — and several states emit a different set of notes for 2026 than for 2025.
**Nothing checks which set comes out.** A 2026-only note appearing on a 2025 return,
or disappearing from a 2026 one, would fail no test.

That is a small number of survivors and, I think, the most interesting thing the run
found. Putting the caveats in the result object rather than in a README is a
deliberate bet this project made early: a language model reading an answer will
encounter them there and will not go and read documentation. Every number in that
answer is now checked several ways over. The sentences beside them — the part that is
actually the differentiator — had nothing behind them at all.

**A test suite that watches numbers cannot see the thing you sell, if the thing you
sell is not a number.** That is tomorrow's job, alongside the step charts.

### And four real defects came out of building it

**Ohio's personal exemption table gave a widow two exemptions.** A qualifying
surviving spouse files alone — the spouse is dead — and Ohio's table said `$4,800`,
the figure for two people. This one is subtle in an interesting way: that table is
**dead**. The engine reads a different one and has always given a widow the right
single exemption. So nothing was wrong in any answer the package produced.

What makes it worth telling you is *why* the dead table was there. Both Ohio and
Maryland keep a duplicate copy of this figure, and both files say, in a comment, that
it is "kept so a test can check it against the chart". Maryland's test existed.
Ohio's did not — and in the 33 days nobody checked, Ohio's copy drifted into being
exactly the bug I spent Day 26 and Day 27 removing from everywhere else.

**A duplicate kept to be cross-checked is only worth keeping if something makes the
cross-check exist. A comment saying a test checks this is not the test.** The check
now runs over every state that has such a chart, so a state added tomorrow gets it
without anybody remembering.

**Maryland's senior credit had four numbers that no return can reach.** The credit is
`$1,000` for one person over 65 and `$1,750` where a married couple filing jointly
are both over 65. "Both" is only possible on a joint return — and the figure was
stored as a table with a cell for each of the five filing statuses, so four of the
five described a situation that cannot happen. They were not even consistent with
each other: single said `$1,000` and head of household said `$1,750`, one copied from
one neighbouring table and one from the other. That is what a number nothing can
check looks like.

**And a typo in the input was silently ignored, which is the expensive one.** If a
caller writes `retirement: { filer: { pension: 28_000 } }` where the field is
`employerPlanPension`, the old behaviour was to drop it and compute the return as if
the retiree had no pension at all. For a Maryland retiree that quietly moves up to
`$41,200` into the taxable base and hands back a plausible number.

TypeScript catches this; nothing else did. That is no help to the callers who matter
most, because the MCP server receives its input as JSON from a language model, and a
model writing `pension` for a pension is the single most likely input error this
project will ever see. It now raises an error naming the nearest real field.

I should say how I found it: **I made the mistake myself, today, building the very
test suite that was supposed to reach retirement rules.** Eighteen households with no
retirement income in them, every assertion passing. Then I made a second version of
the same mistake an hour later, in my own helper, which was dropping `blindOrDisabled`
because it copied input fields through a hand-written list and the list was short.
Three occurrences in one day is a missing guard, not three mistakes.

And then a fourth, which is the one worth your attention because it is about how I
check my own work. I wrote a paragraph in the documentation saying this guard matters
most for the MCP server, since that server's input comes from a language model. Then I
went to confirm that sentence was true, and **it was false**: the MCP server assembles
the retirement object from its own list of field names, so the unknown key was dropped
one layer earlier and the new error could never have fired for exactly the caller I had
written it for. Fixed in `us-tax-mcp` v0.34.0, which now rejects it at that boundary
using the engine's own field list rather than a fourth copy of the names.

**A check at the inner boundary is not a check at the outer one.** And the thing I
would keep from it: writing the claim down is what tested the claim. That is now twice
this week that documenting a property is what found the property to be false.

## 2026-09-27 (Day 33)

### I checked whether my own tests actually work, and 44 of them didn't

Every version of this project has reported a test count — 1,057 yesterday. I have
never been able to tell you what that number *buys*, and today I can, because I
built something that measures it.

The idea is simple enough to explain in a sentence. **Take a number out of the tax
engine — a rate, a threshold, a dollar amount — set it to something wrong, and run
the whole test suite. If no test fails, then that number could be wrong in the
shipped package and nothing would tell you.** Do that for every number, one at a
time.

I ran it on the federal engine: 698 numbers, and **44 of them could have been wrong
with every test still passing.** That is not 44 bugs — the numbers are right. It is
44 places where they were right by luck rather than by check.

### The pattern in the misses is the part worth your time

The 44 were not scattered. Sorted by which tax year they belonged to:

| tax year | numbers nothing was checking |
| --- | --- |
| 2026 | 3 out of 238 |
| 2025 | **20** out of 236 |
| 2024 | **18** out of 194 |

Nineteen of 2025's had an exact twin in 2024 and no twin in 2026. The earned income
credit's percentages, the small-business deduction's percentages, the child credit's
phase-in, the extra Medicare tax threshold — all carefully tested in 2026, and in
the two years behind it nobody had ever looked.

**The reason is ordinary and I think it generalises well past this project.** The
newest year is the year you are working in, so it gets all the attention. The older
years get typed in once and then nothing ever asks them a question again. Every
individual test was fine. The gap was in *which years the tests happened to
mention*, and you cannot see that by reading any one test.

It matters here specifically because "three tax years, not one" is the first thing
this package claims to do better than the alternatives. Two of the three were the
least checked part of it.

All 44 are now covered. **The federal engine is at 698 out of 698.**

### The state engine is a bigger job, and I want to flag the most expensive bit

Same measurement on the state engine: **140 numbers out of 705 could have been
wrong silently.** The worst of it was the rate tables themselves:

- **California's top three tax rates — 10.3%, 11.3% and 12.3% — and the income
  levels where they start.** Also every row of California's head-of-household
  table.
- **Every Maryland bracket above $150,000.**

Those are the highest earners in the two states where that matters most, which
makes them the most expensive possible place to be wrong. The reason they were
missed is almost funny: a test is written around an imagined person, imagined people
have ordinary incomes, and **nobody writes the $900,000 household.**

I fixed that with one test covering every band of every state's table — 436 checks
across 3 years, 28 states and 5 filing statuses — which took the state engine from
140 misses to 100. The remaining 100 are sorted into four groups with a plan for
each in `tools/mutation/STATE-SURVIVORS.md`.

The biggest remaining group has one cause: **married-filing-separately and
head-of-household.** Those two filing statuses have their own numbers in nearly
every state, and they are the two a test author thinks of last. That is tomorrow's
job.

### And yesterday's fix had a sibling I had missed

Yesterday I found a Virginia bug: the $12,000 deduction for people over 65 used the
wrong income test for someone filing separately, worth $690. I fixed it and wrote a
test.

Today's tool changed the *same table* for head-of-household and surviving spouse —
the two cells I had not touched — and nothing failed. **Finding a bug in one place
makes you look hard at that place, which is the one place that no longer needs it.**
Both now have tests.

### One thing I want to say plainly about the 100%

It is a real measurement and it is not a claim that the engine is correct. It says
every number is *watched by a test*. Whether the number is *right* is a different
question, answered by the statute citation next to each one and by the nightly
comparison against PolicyEngine-US, an independently built model.

I have written the limits down next to the number rather than in a footnote: the
measurement covers dollar amounts and percentages, and it does not cover small
integers like an age limit, or the 1,033 individual city tax rates, which cannot
each have a test and should not pretend to.

Nothing here needs you.

## 2026-09-26 (Day 32)

### I was charging one kind of person too little, and the reason is worth two minutes

Virginia gives anyone 65 or over a **$12,000 deduction**, and takes it away a dollar
at a time once your income passes a threshold — $50,000 if you file alone, $75,000
for a married couple. My engine had a table with those numbers in it, and for a
married person who files their **own separate return** the table said $75,000.

That looked generous, and there was a comment next to it saying so.

The law says something the table could not: for a separate return the $75,000 is
measured against **both spouses' income added together**. Virginia's own worksheet
spells it out — every married filer enters the combined figure, *even when filing
separately*. It is the one line of that form where your return has to look at your
spouse's income.

So the separate filer is not being treated generously. They are being given the
married test whole. And because my engine tested the married threshold against one
person's income, it handed out a deduction bigger than a single filer OR a married
couple could get: **$690 of Virginia tax, in the filer's favour, on a number that is
on no line of their own return.**

**What this means if you ever use this for a real return**: on a Virginia separate
return the engine now asks for the spouse's income, and if you do not give it, it
**refuses the deduction rather than guessing**. That is deliberate. The old behaviour
was a wrong answer with no warning; the new one is a missing answer that says exactly
what it needs. Nothing else changed — a single, joint or head-of-household return
answers identically.

### The lesson I want to keep, in plain terms

The test suite already had this exact person in it. A Virginia separate filer, aged
68, $55,000 of income — running straight through the bug for a month.

The test checked a **difference**: how much a particular exemption was worth. That
difference is $99.47 whether the deduction is $12,000 or $0, because the deduction
sits on both sides of the subtraction and cancels.

**An assertion on a difference is blind to everything the difference cancels.** It is
the kind of blind spot that survives good intentions: the household was right, the
law was read correctly, the test was well written, and it could not have failed. The
suite now pins the actual tax as well as the difference, on the same household.

### Three states read, and they disagree about the same question

Yesterday I flagged an open question: when a separate return claims an exemption for a
no-income spouse, does the state's extra allowance for being 65 or blind follow that
spouse too? Illinois, Indiana and Maryland were unread.

All three now are, and **they answer it three different ways** — two by pointing at
the federal rule, one by writing its own version of it, and **Maryland by saying no**.
Maryland's argument is a contrast inside one paragraph: one item is an amount for
"each exemption the individual may deduct", which includes the spouse, and the next
two are amounts "if **the individual**" is 65 or blind. The drafter had the wider
phrase two lines above and did not use it.

Worth flagging honestly: **Maryland is the weakest of the four claims.** I could not
find a source that addresses this exact situation directly, so the answer rests on
that contrast. It is the direction that charges *more* tax rather than less, and if
anyone reads the Comptroller's guidance and finds otherwise it is a one-word change.

### And I paid off the oldest item on my own list

"Add the out-of-state municipal bond addback to four more states" had sat at the
bottom of eight consecutive daily plans, every time looking like fifteen minutes of
typing. It looked that way because the thing recording it was a yes/no flag.

Five states tax the interest on *other* states' municipal bonds, and all five ask for
a different number: two include a bond fund's dividends and two do not, two are net
of expenses, and **Indiana's depends on the date you bought the bond** — an
out-of-state bond bought in 2010 is outside Indiana's tax forever, one bought in 2012
is not, and no tax form anywhere records that date.

Nothing here needs you. I mention it because it is the most useful thing I learned
today: when an item keeps getting deferred while looking cheap, the problem is
usually the shape of the code, not the priority.

---

Yesterday I ended with an open question and said it was the first thing I would do
today. I did it, and the interesting part is not the answer — it is that I had
told myself the question was unanswerable, and it wasn't.

Here is the setup. I run a nightly comparison against PolicyEngine-US, an
independent tax model built by other people. Yesterday it disagreed with me six
times about the same thing: whether Virginia, Maryland and Indiana let someone who
is **married but files their own separate return** claim an exemption for a spouse
who has no income of their own. Their model said yes. Mine said no. Mine charged
more tax.

I did not change it, and I wrote down why: their model might be *reading each
state's form*, or it might simply be *counting people in the household* — and my
comparison only sees the answers, so it cannot tell those apart.

**That was true about my comparison and false about my situation.** Their model is
open source. I cloned it, opened three files, and the question answered itself:

- Virginia: the exemption is a flat amount added up once **per person in the
  household**, with no mention of filing status anywhere in it.
- Maryland: the amount per exemption × **the size of the household**.
- Indiana: **the size of the household** × $1,000.

All three count people. Virginia's own documentation file says so in words. So
their agreement was never evidence about the law — and once I knew that, the only
thing left to do was read the statutes myself, which is what I did.

**The answer is yes in four states, no in one, and it is not a federal rule states
inherit.** The federal tax code has one strange sentence — the only one I have
found that gives a *separate* return something a *joint* one does not — letting
you claim your spouse's exemption if they had no income at all and nobody else
claims them. Virginia and Illinois adopt it by pointing at the federal provision.
Maryland and Indiana adopt it by copying the sentence into their own law almost
word for word.

**New Jersey does not, and New Jersey is the one I want to flag.** New Jersey has
that exact sentence in its law. It attaches it to a *domestic partner* instead —
the spouse's exemption there is available only on a joint return. So the shape of
the federal rule is sitting in New Jersey's statute pointing at a different
person, and an engine that had noticed four states in a row agreeing with the
federal rule and generalised would have got New Jersey confidently wrong, in the
direction that costs someone money and produces no complaint.

**What the fix was worth, per return:** $3,200 of Maryland exemption (and
Maryland's exemption shrinks as income rises, so the same spouse is worth $3,200,
$1,600, $800 or nothing at four different incomes), $2,850 in Illinois, $1,000 in
Indiana, and $930 in Virginia — plus another $800 in Virginia, which is the second
half of the story.

**The second half is a restraint, and I think it is the better half.** A state
saying "your spouse counts as an exemption" has *not* thereby said "your spouse
counts as an *over-65* exemption". Those are two different sentences in the law.
Virginia settles both, because its over-65 exemption explicitly points at the
federal provision that covers this spouse. Maryland, Indiana and Illinois write
their own words for theirs, nobody has read them, and I did not assume. So the
engine counts the spouse once, does **not** give them the over-65 amount, and says
out loud that it doesn't know — including what the missing piece would be worth.

That matters because yesterday's whole lesson was about a citation that covered
four provisions and had only been checked against two.

**Eleven states now have to answer this question in writing.** Four say yes with a
statute behind it, one says no with a statute behind it, two are excluded because
they give no personal exemption at all (Georgia abolished its in 2024; New York
never had one), and **four say "nobody has read the provision"** — Massachusetts,
Michigan, Mississippi and Ohio. Each of those four names the exact statute somebody
has to read and what it would be worth.

I think that last category is the most valuable thing here. Until today, a state
where I had not checked something and a state where I had checked and the answer
was no looked *identical* from outside: both just quietly charged you more.

**One number that did not move, and why I left it.** Of yesterday's six
differences, five have closed. The sixth is $690 in Virginia — and it turned out
never to be the same question at all. It is Virginia's $12,000 "age deduction",
which is a different provision, attached to a person's own date of birth rather
than to an exemption count. Yesterday I put one price tag on six differences and
read them as one problem; they were two problems, and the leftover only became
visible when the first was finished.

**Housekeeping, since it has been on the list for eight days.** The AI-facing
server sends a block of tool documentation to every client on every session, and I
have compressed it sixteen times to stay under a size limit. Each time, I reset
the limit to wherever the compression happened to land. That is not a budget, it
is a ratchet — it tightens whenever I do good work and never loosens, and
yesterday it had 137 bytes of room left and was one field away from blocking a
correctness fix. I have set it to a number with an actual justification (about
1,250 tokens per tool) and written down that changing it again has to be argued
rather than measured.

**Nothing new for you to do.** The npm ask below is unchanged and still optional:
all three packages install today from a public GitHub URL with no account and no
token.

---

**As of Day 30 nothing was waiting on you.** `us-federal-tax` is v0.12.0,
`us-state-tax` v0.27.0, `us-tax-mcp` v0.30.0.


Today I went looking in the opposite direction from the last four days, and I
think the direction is the interesting part.

Days 26 to 29 all found the same kind of error: a widow's tax bill coming out too
**low**. Today's three are in **married filing separately** — what you file when
you are married and send in your own return — and two of the three made the bill
too **high**.

That matters for a reason I want to be plain about. If a tax engine undercharges
someone, the IRS eventually says so. If it *overcharges* them, nobody ever finds
out. There is no letter, no notice, no complaint — the money is simply gone. So
the errors that run in this direction have no natural way of being discovered,
and a package whose whole pitch is being checkable has to go and hunt for them.

The largest was worth **$2,200** on a $90,000 salary: the new deduction for
interest on a car loan, which this package had been refusing to a separate filer
for seventeen days. And the cause is the part worth telling you, because it
was not a wrong number.

**The bug was a citation.** Congress's big 2025 tax act created four new
deductions — tips, overtime, a $6,000 allowance for people over 65, and car loan
interest — and three of them say, in almost identical words, that a married
person can only claim them on a *joint* return. The fourth does not say it. My
code had one setting covering all four, and the note explaining that setting
named the first two by their exact subsection, and then said the other two "carry
the same restriction per IRS guidance."

Two provisions somebody had actually read, and two waved at. One of the two
waved at was right by luck. The other was wrong, and it was wrong precisely
because it was travelling on the credibility of the two that had been checked.
Nothing looked suspicious — that is the whole problem with a shared citation.

There is now a test that fails if any two of those four deductions cite the same
provision. It is a strange-looking test and I think it is one of the more
valuable things in the repository: it does not ask whether a number is right, it
asks whether a claim is *one* claim.

The other two are in the same section of the tax code and pull opposite ways:

- If your spouse itemizes their deductions on their own separate return, **your
  standard deduction is zero** — you have to itemize too, or deduct nothing. I
  was giving you the full amount. Worth $2,222 the wrong way on the example I
  tested.
- If your spouse had no income at all and nobody else claims them, **you can
  take their over-65 and blindness allowances on your own separate return** —
  $1,650 each. I was never giving them. This is a genuinely strange corner: it is
  the one sentence in the tax code I have found that gives a *separate* return
  something a *joint* one does not, and the reason is mechanical — on a joint
  return both people are already the taxpayer, so the sentence has nothing to do.

Neither of those is knowable from anything else on a return, so the engine now
*asks*, and defaults to the answer that does not flatter the filer. And when you
tell it something it cannot use, it now says so: send it your tips on a separate
return and the answer comes back with a line explaining which section of the law
threw them away. That reporting is new on the federal side today (the state side
has had it since Day 24), and it has one rule — it only speaks when it has
actually discarded something you said, so it stays empty on almost every return
and is worth reading when it is not.

I also listed, in the package README, the separate-return rules I *don't* model —
the dependent-care, education and health-insurance credits a separate return is
barred from, the IRA and rental-loss limits, the halved AMT exemption. All of
them make a separate return worse than this library says. I would rather write
down the six things I know are missing than let the three I fixed imply the rest
are handled.

**One more thing happened that I want to flag, because it is the best evidence
this project has produced about whether any of this is right.**

I run a nightly comparison of my answers against PolicyEngine-US — an
independent tax model built by other people reading the same statutes — across
779 made-up households. Today I added two new ones: a separate filer with a
68-year-old spouse who has no income, and the same couple at 61. That shape had
never existed in thirty days of running this, because a separate return is
easy to imagine as one person.

Both engines now agree to the cent on the federal answer for all of them. They
would have disagreed by $1,650 yesterday. That is the first time one of my fixes
has been confirmed by something other than my own reading, on the day I made it.

The same two households also turned up **six differences on the state side**, in
Virginia, Maryland and Indiana, all of them the same question one level down:
does a state let a separate filer claim their spouse's exemption when the spouse
has no income? The other model says yes; I say no; I charge more tax than it does
in all six. **I did not change it.** I could not read those three states' own
instructions from here, the other model might be counting a household member
rather than reading a form, and changing three states because a second model
disagrees is exactly the mistake I made in June and wrote down never to repeat.
It is logged as an open question with a dollar bound, and it is the first thing
on tomorrow's list.

One thing that might amuse you, and one that might not. The amusing one: to fit
the two new questions into the tool descriptions the AI-facing server sends, I
had to compress something, and what I found was three tools each carrying the
same 264-character sentence explaining *why* their fields have no descriptions —
a justification for saving space, paid for three times, and out of date (it said
"thirty-seven descriptions"; there are thirty-nine). The less amusing one: the
tax-calculator sites that dominate these search results are still unreliable.
One told me, today, that the 2025 standard deduction for a separate return is
$15,000. It is $15,750 — the July 2025 act raised it. Another contradicted itself
about the overtime rule inside two sentences. Nothing here is built on them.

---

**As of Day 29 nothing was waiting on you either.** `us-federal-tax` is v0.11.0,
`us-state-tax` v0.27.0, `us-tax-mcp` v0.29.0.

Today I found fourteen wrong answers in one filing status, and I want to tell you
about them honestly, including the part that does not flatter the project.

The status is **qualifying surviving spouse** — what you file for the two years
after a husband or wife dies, if you have a child at home. The year of the death
itself is a joint return; this is the two years after, and there is one adult in
the house.

I have now fixed this status on three separate days. Day 26 gave her one personal
exemption instead of two. Day 27 fixed three federal thresholds. Both times I
wrote it up as "that exemption was wrong", and both times the actual cause was
sitting one level down: a piece of code called `filerCount` that was being asked
*how many people are on this return* and was answering with **which column of a
form the state puts this status in**. Those are different questions. Thirteen
different places in the engine asked the first one and got the second.

What that was worth, per return, in 2026:

- **Pennsylvania, $614** — her whole Pennsylvania tax. The state forgives the
  entire bill below an allowance and then takes the forgiveness back ten points
  at a time. I was giving her the married allowance, which is double, which moved
  the whole staircase. Pennsylvania's own form has three boxes — unmarried,
  separated, married — and none of them is hers; the Department's guide puts
  "divorced or widowed and unmarried at the end of the taxable year" in the first.
- **Georgia, $873.25** — two military retired-pay exclusions for one veteran.
- **Virginia, $639.50** of a low-income credit, plus **$591.80** of an age
  deduction for a spouse who cannot have an age. Virginia's instructions say in a
  sentence that a widow files as Single.
- **Maryland, $465.25** — again her whole state bill. Maryland forgives the tax
  of a household under the federal poverty line, and I was measuring her against
  the poverty line for a household of three when there are two of them.
- **Massachusetts $100, New York and New York City $20 between them, Detroit
  $14.40**, and one more in Utah.

All fourteen ran the same way: her bill was too **low**. Nobody would have
complained.

**The uncomfortable part is why 501 tests did not catch any of it.** Every one of
these bugs needs somebody to tell the engine a fact about a spouse who is dead —
a spouse's age, a spouse's pension — or to file this status in a state that has
never heard of it. That is exactly what a person who believes the status means
two filers would do, and the person who wrote the tests believed it, because he
also wrote the code. A test can only ask a question its author thought of asking.

So four of today's twelve new tests are written a different way: they do not
check a dollar figure at all, they check that *supplying a dead spouse's pension
changes nothing*. That is a claim a believer cannot write down by accident,
because it is only interesting if the belief is false. I think that shape is the
more valuable half of today's work.

The other structural change: the piece of code is now called
`claimedFilerCount`, which is a name you cannot reach for by accident when you
want a number of people, and there is a test that fails if a fourteenth call site
appears. The name was the defect. The fourteen wrong answers were symptoms.

One thing that may reassure you about the direction of all this: the engine now
*says* when it has thrown away something you told it. If you pass a spouse's age
on a widow's return, the result carries a note explaining that there is no living
spouse, that the field was ignored, and where to put the figure if it is really
hers — a survivor's annuity is the survivor's own income. I would rather the
result argue with the caller than quietly disagree with them.

---

**As of Day 28 nothing was waiting on you either.** `us-federal-tax` v0.11.0,
`us-state-tax` v0.26.0, `us-tax-mcp` v0.28.0.

Today is a smaller day than the last three and it is about something I want you
to know the shape of, because it is the part of this project you would have to
trust rather than check.

Every state figure in this package is labelled `published` or `provisional`.
`provisional` means "the state indexes this for inflation and had not released
the number yet, so this is last year's, and I am telling you". Every competitor
carries last year's number forward and says nothing. That label is, honestly,
the most saleable thing here.

**It turned out the label had been doing two completely different jobs under one
word, and that is why it sat untouched for months.** Three of the eight
provisional figures for 2026 were simply sitting in a state document that
nobody had gone and read — Kentucky's standard deduction is $3,360 and I had
$3,270; Michigan's personal exemption is $5,900 and I had $5,800; Maryland's
$3,350 was right all along and had been flagged since Day 8 because two
second-hand sources disagreed about it. Small money each ($3.15 a filer in
Kentucky, $4.25 an exemption in Michigan) and owed to everyone in those states.

But **Colorado's flag can never be removed during the year, as a matter of
law.** Colorado's rate is set by a surplus calculation that runs *after* the tax
year ends — that is why it was 4.25% in 2024 and 4.40% now. There is no office
in Colorado that knows the 2026 rate in 2026. And four more are waiting on forms
that publish in January 2027.

So one word covered *"somebody owes you a trip to a website"* and *"the universe
does not contain this number yet"*, and they are the opposite way round: while
nothing had ever been paid off, every flag looked permanent and nobody looked at
Kentucky; the moment one got paid, the whole list looked like a chore and a
future run would have gone hunting for a Colorado document nobody has written.

Each figure now carries its own entry saying which kind it is and **naming the
document that would settle it**, and there is a test that refuses to pass if a
figure marked "carried forward from 2025" ever stops matching the 2025 value —
so a warning can no longer outlive the thing it warned about.

One thing you may find reassuring and one you may not. Reassuring: for the
Maryland figure, the thing that finally settled it was the *fiscal note on a
bill that failed* — a 2026 bill to raise the deduction to $4,100, which died in
committee, and which had to state current law in order to price the increase.
Less reassuring: several of the tax-calculator sites that now dominate these
search results publish tables labelled 2026 that are mostly last year's numbers
with a few real ones mixed in. One gave California's 2026 standard deduction as
exactly my 2025 figure while giving a 2026 exemption credit that was genuinely
new. California indexes both by the same factor, so they cannot move apart —
which is how I caught it, and why California is still flagged rather than
guessed at.

---

**As of Day 27 nothing is waiting on you, and the thing worth reading is the
same one as yesterday, gone further.** `us-federal-tax` is v0.11.0,
`us-state-tax` v0.24.0, `us-tax-mcp` v0.27.0.

Yesterday I told you a refundable credit had been too high for widows and
widowers. Today I went looking for the rest of that mistake and found **two
more of it**, one of them much larger.

The US tax code writes its thresholds as "$400,000 in the case of a joint
return, and $200,000 in any other case". Someone filing as a **qualifying
surviving spouse** — the status you use for two years after a spouse dies, if
you have a dependent child — does **not** file a joint return. Where the law
means to include them it says so by name, and in three places it does not:

- **The child tax credit.** This package used $400,000 as the income where the
  credit starts to disappear. It is **$200,000**. A widow with two children
  and $300,000 of wages was told she got the full **$4,400**; she gets nothing.
- **The small-business (QBI) deduction — the big one.** Two figures, both
  doubled when they should not have been. **A widowed consultant with $300,000
  of profit and one child was told she owed $63,242.40 for 2026. She owes
  $75,893.38** — an error of **$12,650.98 on a single return**, about eleven
  times yesterday's.

Every year from 2024 was wrong the same way, and every one of these ran in the
same direction: **the widow's bill was too low.**

The § 24 figure is the part I want to flag rather than bury. It had been
sitting in the code with a note on it saying the question was *unresolved*,
because irs.gov is blocked from the sandbox I run in and I could not read the
worksheet first-hand. That was true and it was not a good enough reason: the
sentence of the statute settles it on its own, and it had been quoted in that
very note. The only thing on the other side was that another tax model carries
$400,000 too — and another model agreeing is not evidence.

**What is new besides the numbers is that this question is now closed
permanently.** There is a test that walks the entire parameter tree, finds all
twenty tables that vary by filing status across three tax years, and makes each
one declare which group a surviving spouse belongs to and quote the words that
decide it. Nobody can add a new one without answering the question. It also
fails if an entry becomes *vacuous* — if the two figures it is choosing between
stop differing, so that it would pass no matter what.

**And one more of the same thing on the state side.** If you told the
calculator that a widow was blind, it counted her twice — because a helper in
the state engine treats this filing status as two filers, which is right for
most *amounts* and never right for a *count of people*. It was worth $153 in
California, $144.50 in Michigan, $60 in Mississippi, and the same doubling in
Illinois, Indiana and New Jersey. A single filer was correctly counted once the
whole time.

The reason the two helpers are not simply merged is a nice illustration of why
none of this can be reasoned out from first principles: **California really
does give a widow two personal exemption credits.** Form 540 line 7 says "If you
checked box 2 or 5, enter 2", and box 5 is this filing status. So the state has
already answered the question for that line, in the opposite direction to the
one you would guess, and the fix caps the *conditions* without touching the
*amounts*.

If you or anyone else used the calculator or the packages for a **widow or
widower with a dependent child**, especially one earning over $200,000 or
running a business, **the answer was too low**. It is fixed, tested and
released. `us-state-tax` is v0.25.0.

**Two more things found by cross-checking against an independent model, once
the test grid was told to file a widow's return at a high income rather than a
low one.**

- **Illinois takes its exemption allowance away entirely above $250,000** — a
  cliff, not a taper — and the limit is $500,000 only "for returns with a
  federal filing status of married filing jointly". A widow is not one of
  those, and this package had been letting her keep it. $289.58 a year.
- **Illinois has published its 2026 exemption allowance: $2,925**, up from
  $2,850. This package had been carrying the 2025 figure forward and labelling
  it *provisional*, which is what it does whenever a state has not released a
  figure yet. Illinois is now published, and it is the first of these to be
  paid off — eight states still carry at least one figure forward. The label is
  a debt, not a disclaimer.

Worth one line on the cross-check itself, because it cuts both ways. The
other model, PolicyEngine-US, gives a widow with one child the full $2,200
child tax credit at $250,000 and $300,000 of income. The statute does not, and
this is now the single largest category of difference between the two models —
**38 households where we are ahead of the reference rather than behind it.**

---

**As of Day 26, and this is the entry it follows from.** `us-federal-tax` is v0.10.0, `us-state-tax`
v0.23.0, `us-tax-mcp` v0.26.0.

**A refundable federal credit was too high for widows and widowers, in every
tax year this package covers.** If someone files as a *qualifying surviving
spouse* — the status you use for the two years after a spouse dies, if you
have a dependent child — this package was giving them the **married-filing-
jointly** phase-out threshold for the earned income credit. The law raises
that threshold "in the case of a joint return", and a surviving spouse does
not file one.

A surviving spouse with one child and $45,000 of wages was told their 2026
earned income credit was **$2,215.37**. It is **$1,053.62**. Every year from
2024 was wrong the same way.

And it did not stay federal. **Six states set their own earned income credit
as a flat percentage of the federal one**, so the same mistake made the state
answer wrong in New Jersey, New York, Illinois, Virginia, Indiana and
Maryland at the same time. All of it is fixed, tested and released.

Three smaller corrections for the same filing status, all in the same
direction — too much exemption, so too little tax:

- **Illinois, Indiana and Michigan** were giving a surviving spouse a second
  personal exemption, for a spouse who has died. $141.08, $49.70 and $246.50
  a year.
- **Virginia has no surviving-spouse status at all.** Form 760 tells a federal
  surviving spouse to file as *single*, so the joint standard deduction and
  the second exemption are not available: $556.60 a year.

**And three states' allowances for being 65 or blind were not computed.**
California adds an exemption *credit* of $153 for each filer at 65 and
another for each who is blind — so **a retired California couple was charged
$306 too much every year**, and because it is a credit rather than a
deduction it is worth the same $306 at $30,000 of income as at $250,000.
Michigan's special exemption is $3,400 and covers deafness and total
disability as well as blindness. Mississippi adds $1,500 for each. All four
are now computed; pass the ages and whether anyone is blind.

If you or anyone else used the calculator or the packages for a **surviving
spouse**, a **retired Californian**, or anyone **blind**, the answer was
wrong — too high for the last two, too low for the first. All fixed.

Two additions rather than corrections, both from Day 25's list: **Georgia's
eligible itemizer tax credit** ($300 a taxpayer, $600 joint, for itemizing
federally and nothing else — no income test at any level) and **Indiana's
unified tax credit for the elderly** ($140, refundable, and for a couple
living on Social Security it is the entire Indiana return).

Nothing here needs you. I am telling you because a wrong number that was
shipped is worth knowing about even after it stops being shipped, and the
earned income credit one is the largest this project has got wrong.

---

**As of Day 25 nothing is waiting on you at all, and there are two things worth
knowing.** `us-federal-tax` is v0.9.0, `us-state-tax` v0.21.0, `us-tax-mcp` v0.24.0.

Today's release is two more **corrections**, and both of them are at the bottom
of the income distribution, where being wrong means charging somebody their
whole bill rather than a slice of it.

**Indiana.** The state publishes a $1,000 exemption per person. That is the
smallest of four figures on its own Schedule 3, and this package was computing
only that one. It also allows $1,500 more for each dependent child, $1,000 for
each person aged 65, $1,000 for each blind person, and $500 more for each person
aged 65 whose income is under $40,000. **An Indiana family with two children was
charged $149.10 too much, and so was a retired couple under $40,000.** Both are
fixed. (The old note in the code admitted the gap and priced it at "about $44 a
child" — that was the state rate only, and in Indiana two fifths of the bill is
the county's. The real figure in Marion County is $74.55 a child.)

**Maryland.** There is a credit called the poverty level credit that forgives the
entire Maryland bill — state tax and county tax both — for a household earning
under the federal poverty guideline. It was not computed here. **A single
Maryland worker earning $15,000 was told they owed $160.85. They owe nothing.**
That is fixed too. The credit is claimed at 5% of earnings against the state tax
and at the county's own rate against the county tax, so it is worth a different
amount in every one of the twenty-four Maryland jurisdictions.

If you or anyone else used the calculator or the packages for an Indiana family,
an Indiana retiree, or a low-earning Maryland worker, **the answer was too
high.** Both are fixed, tested and released, and the calculator picks them up on
the next push with nothing to switch on.

One thing that is not a bug and is worth knowing anyway: the project now runs
437 households through this engine and through an independent model
(PolicyEngine-US) and compares every figure. As of today **every single
difference between the two has a written reason**, for the first time — 223 of
them. Two of those reasons are places where the other model is wrong rather than
this one: it charges an Indiana county tax of *minus* $101 to a retiree with no
income, and it is still using Allegany County's 2025 rate.

---

**As of Day 24 nothing is waiting on you at all, and there is one thing worth
knowing — the same kind of thing as yesterday.** `us-federal-tax` is v0.9.0,
`us-state-tax` v0.20.0, `us-tax-mcp` v0.23.0.

Today's release is another **correction**. Until this morning the state engine
charged tax on pension and IRA income in **four states that exempt most or all of
it** — Illinois, Mississippi, Michigan and New York. A retired couple with a
$60,000 pension and $40,000 of Social Security was told they owed $2,588.85 in
Illinois, $2,057.00 in Michigan and $1,336.00 in Mississippi. **All three of
those states charge nothing at all.** New York was $2,040.80 and the right answer
is $79.05.

If you or anyone else used the calculator or the packages for a retiree in one of
those four states, **the answer was much too high.** It is fixed, tested and
released, and the calculator picks it up on the next push with nothing to switch
on.

Two smaller things in the same release, both about Illinois: it has a **child tax
credit** worth 40% of the state earned income credit that this package had never
heard of, and an extra $1,000 of exemption at 65 that it was not giving. And one
correction to something I told you nothing about: North Carolina appears in every
list of states that are kind to retirees, including this project's own working
list yesterday, and it taxes a pension in full at 3.99%. It does not belong on
that list.

Nothing here needs you. I am telling you because a wrong number that was shipped
is worth knowing about even after it stops being shipped — and because this is the
second day running that the largest thing I found was something this project had
got wrong about itself.

One more thing, and it is the opposite direction: **there is now one case where
the calculator's answer was too LOW**, and it is fixed too. Illinois taxes
interest on other states' municipal bonds while exempting its own, and nothing
on a federal return shows that income at all, so the engine simply never saw it.
It only became findable once Illinois stopped taxing pensions, because until then
the answer was wrong in the other direction by more. If you hold out-of-state
municipal bonds and live in Illinois, the calculator needs to be told how much —
that figure is on no federal form and cannot be worked out from anything else.

---

**As of Day 23 nothing is waiting on you at all, and there is one thing worth
knowing.** `us-federal-tax` is v0.9.0, `us-state-tax` v0.18.0, `us-tax-mcp` v0.21.0.
Today's release is a **correction**: until this morning the state engine charged tax
on Social Security benefits in ten states that exempt them — Arizona, California,
Idaho, Illinois, Indiana, Michigan, Mississippi, North Carolina, New York and Ohio.
**If you or anyone else used the calculator or the packages for a retiree in one of
those ten states, the answer was too high**, by up to $1,517 a year in the worst case
in my test grid, and fifteen of the nineteen taxing states change place in the
calculator's ranking now that it is fixed. Nothing about it needs you; it is fixed,
tested and released. I am telling you because a wrong number that was shipped is worth
knowing about even after it stops being shipped.

**As of Day 22 nothing is waiting on you at all.** `us-federal-tax` v0.8.0,
`us-state-tax` v0.17.0, `us-tax-mcp` v0.20.0, and the calculator now ships as a
single downloadable file that needs no Pages and no click. The Pages dropdown is
still worth flipping — it buys a nicer URL — but it no longer blocks anything.
Version numbers in older entries are stale.

Newest first.

---

## 2026-09-16 (Day 22)

### I told you something false yesterday, and here is the correction

Yesterday's note said, of the file the Pages workflow attaches to each run:
*"Open `index.html` from that artifact and the calculator works offline."*

**It does not.** I opened it this morning and got a blank page:

```
Access to script at 'file:///.../app.js' from origin 'null' has been blocked by
CORS policy: Cross origin requests are only supported for protocol schemes:
chrome, chrome-extension, ..., http, https.
```

Browsers refuse to load JavaScript modules from a `file://` URL, and the whole
site is modules. If you downloaded that artifact and saw nothing, **it was not
your computer.** I am sorry; I wrote the sentence without double-clicking the
thing I was describing, which is the exact mistake the last two days of this
file are about.

### The fix is better than what it replaces, and it needs nothing from you

There is now a **`calculator` release** with one file in it:

**<https://github.com/LoganChu/Agent_Playground/releases/download/calculator/retirement-tax-calculator.html>**

622 KB, the entire calculator — page, styles and all 46 code modules inlined.
Download it, double-click it, and it works. No server, no install, no network
connection, nothing switched on by anybody. It refreshes on every push.

**So the Pages ask is no longer an ask.** It is still worth doing if you want a
link you can send someone — *Settings → Pages → Build and deployment → Source:
GitHub Actions* — but the calculator is now distributed either way, and I will
not raise it again. Yesterday I said an unanswered ask should be tested rather
than repeated. Having tested it and found the constraint real, the next move is
to route around it, not to ask louder.

### What else landed today

**`us-state-tax` v0.17.0 — Utah, which was the last state returning a retiree
figure that was too high.** Three credits, and the interesting part is what they
do to the rate:

- **A Utah retiree faces a 15.26% marginal rate against a 4.45% flat tax.**
  Three rules compounding, not one bracket among them: federal law drags 85
  cents of Social Security into income behind each dollar of pension, Utah taxes
  all $1.85, and two separate credits are withdrawn against it at the same time.
  The rate *falls* above $90,387 of income, so the most expensive next dollar in
  Utah belongs to a household in the **12%** federal bracket, not the 22% one.
- **A municipal bond is taxed at 2.5% in Utah** while appearing on no line of
  Utah income, because the exempt interest is added back for those credits.
  $10,000 of it costs a retired couple $250.00 of state tax and $0.00 of federal.
- **Utah's "$450 retirement credit" can never be worth more than $395**, applies
  across a $22,600 window of income, only to people born on or before 31
  December 1952, and only if they have no Social Security at all. It is not a
  credit, it is a fossil.

On the website this moves Utah **eight places**, from 24th to 16th of 28, for a
retired couple with $40,000 of benefits and $60,000 of pension.

**The website now tells a couple something nothing else would.** Three states cap
their retirement exclusion *per person*, so which spouse's name the income is in
changes the tax — and the federal return cannot see the difference, so nothing
else in a household's life would flag it. The page used to compute this and wait
to be asked; it now says it outright, above the table. On one test household that
is **$2,842.00** in Maryland, **$1,247.50** in Georgia and **$1,088.85** in
Kentucky, on identical totals.

**`us-tax-mcp` v0.20.0** gained a ninth tool, `describe_state`, and got **14%
smaller** — the startup payload every AI client pays for on every session went
from 44,945 bytes to 38,707 while gaining a tool. Twenty-eight states do not need
the same inputs, so a caller who asks about Ohio now reads Ohio's documentation
instead of everyone's.

**842 tests, all green, still zero dependencies anywhere.** Two of today's new
tests found real bugs within a minute of being written — one of them a field the
server had been silently ignoring for twelve days.

### The npm ask, unchanged and still optional

Still worth doing, still only buys **reach** — a searchable name, `npm i
us-state-tax` instead of a long URL. Three steps:

1. npmjs.com → your avatar → Access Tokens → Generate New Token → **Automation**.
2. Paste it into this repo as a secret named `NPM_TOKEN`.
3. Actions → **Release** → Run workflow, dry run ticked the first time.

**That is now the only thing on this list, and it is optional.** First time that
has been true.

---

## 2026-09-15 (Day 21)

### There is a website, and it needs one dropdown from you

**Settings → Pages → Build and deployment → Source: GitHub Actions**

That is the whole ask. One dropdown, once, and then it publishes itself forever.

I built a retirement tax calculator — you put in what a household *receives* (the
figure on the Social Security statement, the pension, the IRA) and it works out the
federal return and then **all 28 states at once**, plus every Maryland and Indiana
county. It runs entirely in the visitor's browser: no server, no analytics, no
network call after the page loads, nothing to pay for and nothing that can go down.

It is built, tested and committed. It is not published, because a GitHub Actions
token cannot switch Pages on. **I tested this rather than assuming it**, which is
the whole lesson of yesterday, and this time the constraint turned out to be real:

```
Get Pages site failed.    Error: Not Found
Create Pages site failed. Error: Resource not accessible by integration
```

The first line means Pages is off; the second means the token is allowed to look
and not to create. `POST /repos/.../pages` is closed to an Actions token whatever
permissions it is given, and `pages: write` is the most a workflow can ask for.
There is no scope to add and no way round it, including via a `gh-pages` branch,
which needs the same site to exist first.

So: yesterday's hypothesis was false and today's is true, and neither could have
been settled by thinking about it. I would rather report one of each than keep
guessing at both.

**Until you flip it, nothing is broken.** The Pages workflow does not fail — it
builds the site, runs every test, attaches the built site to the run as a
downloadable artifact, and writes the instruction above into the run summary. Open
`index.html` from that artifact and the calculator works offline. Once Pages is on,
the next push publishes to
`https://loganchu.github.io/Agent_Playground/` and so does every push after it.

**One judgement call you should know about.** Publishing a page under your GitHub
account that gives tax figures is more visible than the tarballs I have been
attaching to Releases since yesterday. I judged it the same class of act — a public
artifact of an already-public MIT repository, put somewhere reachable — and built it
without asking. It carries a "not tax advice" disclaimer and every state panel lists
what it does not model. If you would rather it did not exist, delete
`.github/workflows/pages.yml` and it never goes anywhere; the calculator still works
for anyone who runs it locally. Since publishing now needs your click anyway, the
decision is yours either way, which is a better outcome than I had planned for.

### What today added to the engines

**`us-federal-tax` v0.8.0 models § 86** — how much of a Social Security benefit is
taxable. This was the last large piece of an ordinary return that was missing, and
it is the one a retiree cannot avoid. Three things that came out of it:

- **The four thresholds have never been indexed.** $25,000 and $32,000 were set in
  1983, $34,000 and $44,000 in 1993, and the statute has no mechanism to move them.
  They are the only figures in this project that are the same in every tax year.
- **Married filing separately is not half of joint, it is zero.** A separate filer
  who lived with their spouse at any point in the year has a base amount of $0, so
  85% of the benefit is taxable from the first dollar. On $20,000 of benefit that
  one fact is the difference between $17,000 and $0 of taxable income.
- **A retired couple in the 22% bracket can face a 45.58% marginal rate**, above the
  37% top rate. § 86 puts 85 cents of benefit into taxable income behind each dollar
  earned, and the OBBBA senior deduction then withdraws 6% of the excess *for each
  spouse*. The same couple faced 40.70% in 2024 — the year before they were given
  the deduction that cut their bill by $3,897.96. **The relief and the rate increase
  are the same provision**, and only one of them was in the press release.

**`us-tax-mcp` v0.19.0** reports all of it, and its startup payload got 20% smaller
while gaining three fields — three of its tools had been telling models to read
another tool's documentation and then duplicating that documentation anyway.

### The npm ask, unchanged and still small

Still worth doing, still only buys **reach** — a searchable name, `npm i
us-state-tax` instead of a long URL. Three steps, unchanged:

1. npmjs.com → your avatar → Access Tokens → Generate New Token → **Automation**.
2. Paste it into this repo as a secret named `NPM_TOKEN`.
3. Actions → **Release** → Run workflow, dry run ticked the first time.

Both asks together are now: **one dropdown, and optionally one token.** That is the
smallest this list has ever been.

---

## 2026-09-14 (Day 20)

### The ask I have been making for fourteen days was based on something false

I said, every day since Day 6, that an unpublished package "cannot be installed by
anyone". **That is not true and never was.** This repository is public and MIT, all
three packages have zero runtime dependencies, and npm installs a tarball from an
https URL with no registry, no account and no token. So `npm pack` output was
always a complete, working distribution; the only thing missing was somewhere
public to put the file.

**It is fixed, and I did it myself.** There is a new `Distribute` workflow that packs
all three packages after their own tests pass and attaches each to a GitHub Release,
using only the token GitHub Actions mints for the run. **There is no secret to add
and nothing for you to press.** It has already run twice today. Anyone can now do
this, with nothing installed and no account anywhere:

```bash
npm i https://github.com/LoganChu/Agent_Playground/releases/download/us-state-tax-v0.16.0/us-state-tax-0.16.0.tgz
```

```jsonc
// Any MCP client — claude_desktop_config.json, .mcp.json, whatever yours is
{
  "mcpServers": {
    "us-tax": {
      "command": "npx",
      "args": [
        "-y",
        "https://github.com/LoganChu/Agent_Playground/releases/download/us-tax-mcp-v0.18.0/us-tax-mcp-0.18.0.tgz"
      ]
    }
  }
}
```

I installed both of those from the public URLs into a clean directory and ran them
before writing this, so they work rather than merely ought to.

I am sorry for the fourteen days. The lesson is recorded in the journal in the
general form: **an ask that goes unanswered for a week is a claim about a
constraint, and the right response is to test the claim, not to word it better.**

### The npm ask survives, and it is now much smaller

Publishing to npm is still worth doing, but it now buys exactly one thing: **reach**.
A name people can search for, and `npm i us-state-tax` instead of a 100-character
URL. It no longer decides whether nineteen days of work can be used at all.

If and when you want it, it is unchanged and still three steps:

1. Create an npm **automation** access token (npmjs.com -> your avatar -> Access
   Tokens -> Generate New Token -> Automation).
2. Paste it into this repo as a secret named `NPM_TOKEN`.
3. Actions -> **Release** -> Run workflow, dry run ticked the first time, then
   again unticked.

**Nothing is blocked either way, and now genuinely nothing.**

### What else changed today: Kentucky

`us-state-tax` v0.16.0 and `us-tax-mcp` v0.18.0. **769 tests**, all green, still zero
dependencies. Kentucky is the third state here whose retirement rules are properly
modelled, and it turns out to be the strangest of the three:

**Kentucky's published $31,110 pension exclusion is not its maximum.** Retired pay
from the federal government, the Commonwealth or a Kentucky local government —
military service included — is exempt **in full** to the extent it is attributable
to service performed before 1 January 1998, with no ceiling. And that exemption
does **not** consume the $31,110, which stays available against everything else.
A teacher who served 1975-2005 with a $70,000 pension and $40,000 of IRA
distributions excludes **$84,776.67**.

**And it has no age test at all**, which makes Kentucky the only one of the three
states an early retiree can use. The same couple, $70,000 of pension between them:

```text
                       Kentucky     Georgia     Maryland (Montgomery)
both aged 55            $157.85   $1,996.00                $4,471.05
both aged 65            $157.85       $0.00                    $0.00
```

Kentucky is flat at every age; the other two step past it from opposite sides. The
state that is twenty-eight times cheaper at 55 is the only one of the three
charging anything at 65.

One more, because it is the kind of thing that decides a real decision: the
1 January 1998 cutoff has never moved, so every further month of service dilutes
the exempt share. **Two Kentucky teachers with identical $70,000 pensions pay
$768.37 and $2,646.70** — $1,878.33 apart, on nothing but the decade they worked.

### One caution about today's sourcing, and one question still open

**Kentucky is sourced worse than Georgia was.** `revenue.ky.gov`,
`apps.legislature.ky.gov`, `trs.ky.gov` and `law.justia.com` are all blocked from
this sandbox, so I could not read Schedule P or KRS 141.019 directly. Every
operative figure rests on two independent secondary sources plus PolicyEngine-US's
encoding, and this package reproduces all five of that model's own Schedule P test
fixtures exactly. I believe it is right; I am telling you it is not first-party.

**Still open from Day 19, and neither is urgent:** whether Georgia HB 463's 2027
rate step was triggered, and whether Maryland HB 792 raised the $15,000
public-safety retirement subtraction to $20,000. Both are one number each and both
sit behind sites blocked from here.

---

## 2026-09-13 (Day 19)

### The ask is unchanged. Thirteen days, one token, one button

I have nothing to add to it and have not made it louder:

1. Create an npm **automation** access token (npmjs.com -> your avatar -> Access
   Tokens -> Generate New Token -> Automation). The one step I cannot do.
2. Paste it into this repo as a secret named `NPM_TOKEN`.
3. Actions -> **Release** -> Run workflow, dry run ticked the first time
   (it builds, typechecks, runs all **750** tests and packs all three without
   publishing), then again with dry run unticked.

Nothing is blocked either way.

### What changed: Georgia's retirement rules

`us-state-tax` v0.15.0 and `us-tax-mcp` v0.17.0. **750 tests**, all green, still
zero dependencies in all three packages. No new states — this closes the largest
remaining *correctness* hole inside coverage the package already claimed, and one
the package was advertising against itself: the Georgia definition literally said
"Not modelled: the Georgia retirement income exclusion, which is large and will
make a retiree return computed here far too high."

It was. A Georgia rate table — 4.99% and a $15,000 standard deduction, which is
the whole of what one has — charges these 2026 retirees this much:

```text
                                                rate table      here
single 66, $55,000 of pension                    $1,996.00     $0.00
couple both 67, $90,000 of IRA + $30,000 SS      $4,491.00     $0.00
couple both 65, $130,000 of capital gains        $4,990.00     $0.00
veteran 45, $45,000 military pay + $25,000 wages $2,744.50   $998.00
```

### Three things worth knowing

**Georgia and Maryland use the same words for opposite rules.** Both exempt
"retirement income" at 65 and both publish a number ($65,000 and $41,200). Georgia
counts taxable IRA distributions in full and charges nothing against the
exclusion; Maryland writes an IRA out of it by name and charges the whole Social
Security benefit against it. So on identical figures at 70, the rollover every
adviser recommends costs **$0.00 in Georgia and $3,378.83 a year in Maryland** —
and moving a third of a retirement into Social Security **saves $1,272.45 in
Georgia and costs $357.75 in Maryland**, in two states that both say, correctly,
that they do not tax the benefit.

**Georgia's exclusion is also a capital gains allowance, and nothing calls it
one.** Net capital gain qualifies, and the allowance is annual and per person, so
a couple both 65 with no other income can realise **$130,000 of gain every year
and owe Georgia nothing on it**, indefinitely.

**Georgia's real maximum is $70,000, not the $65,000 every table prints — and it
falls by half at 62.** The military exclusion ($17,500, plus $17,500 more for a
veteran whose earned income exceeds $17,500) is available only *below* 62, and
disability opens the ordinary exclusion at any age, so a disabled working veteran
under 62 claims both. Their exclusion runs $70,000 at 61, $35,000 at 62, $65,000
at 65 — so the sixty-second birthday, which every guide to Georgia calls the one
where the retirement exclusion begins, costs them **$1,746.50**.

### Two one-sentence questions, if you happen to know

Neither blocks anything and neither is urgent. Both are the kind of thing a person
can settle in a minute and I cannot settle from here:

1. **Georgia HB 463's 2027 rate.** The bill sets 4.99% for 2026 and directs cuts
   of 0.125 points a year to 3.99%, "subject to revenue conditions". The package
   refuses 2027 rather than guessing. If the Governor's office or DOR has since
   announced whether the 2027 step is triggered, that is one number.
2. **Maryland HB 792** (from Day 18, still open): whether the $15,000 public-safety
   retirement subtraction was actually raised to $20,000. `mgaleg.maryland.gov`
   would show a chapter number; the site is blocked from here.

---

## 2026-09-12 (Day 18)

### The ask is unchanged, and it is still one token and one button

Twelve days now. The shape of it has not changed since Day 17 and I have nothing
to add to it, so I have not made it louder:

1. Create an npm **automation** access token (npmjs.com -> your avatar -> Access
   Tokens -> Generate New Token -> Automation). The one step I cannot do.
2. Paste it into this repo as a secret named `NPM_TOKEN`.
3. Actions -> **Release** -> Run workflow, dry run ticked the first time
   (it builds, typechecks, runs all **721** tests and packs all three without
   publishing), then again with dry run unticked.

Nothing is blocked either way.

### One thing I could not verify, and deliberately did not guess

Maryland gives a **$15,000** subtraction to retired correctional officers, law
enforcement officers and fire, rescue or emergency services personnel aged 55 or
over — Form 502SU code letter `v`. **HB 792 of the 2025 session would raise it to
$20,000** for tax years after 2024. I found the bill, its fiscal note summary and
a tax-software practitioner reporting the change as already in their product, but
I could not establish from any source reachable here whether it was *enacted* —
Maryland was running a $2.7 billion deficit in that session, and revenue bills
died. So I committed **neither** figure and the package says so in its own notes
rather than returning a confident wrong number.

If you happen to know, or can check `mgaleg.maryland.gov` for HB 792's chapter
number, that is one sentence that unblocks a real subtraction. Same for the
Worksheet 13E ranger exclusion, which appears to be available at 55 but *not* to a
filer who is 65 or over — if that is right, a retired Maryland park ranger's
exclusion **falls** on their sixty-fifth birthday, which would be worth writing up.

### What changed: Maryland's retirement income

`us-state-tax` v0.14.0 and `us-tax-mcp` v0.16.0. **721 tests**, all green, still
zero dependencies in all three packages. No new states — this closes the largest
*correctness* gap inside coverage the package already claimed.

Before today a Maryland retiree's return came back with no pension exclusion at
all. For a couple both 70 with $100,000 of pension in Montgomery County that was
**$4,947.05 of tax against a true $80.00** — Day 17 estimated the gap at about
$3,300 and it was larger than that at every income I checked.

### Four things worth knowing

**Maryland taxes Social Security and exempts pensions**, which is the reverse of
every summary of the state. It does not tax the benefit — and then charges the
whole benefit, taxable or not, against the pension exclusion, dollar for dollar.
So across the band where the pension reaches the cap the two rules cancel exactly:

```text
$30,000 of benefits + $60,000 of pension    Maryland AGI $48,800, tax $2,226.88
$90,000 of pension, no benefits             Maryland AGI $48,800, tax $2,226.88
```

A dollar of benefit adds a **full** dollar to Maryland's base; a dollar of pension
adds nothing. Even the 15% of benefits the federal government never taxes is
clawed back.

**A Maryland couple's totals do not determine their tax.** The exclusion is per
person, capped per person, and offset by that person's own benefits. One couple
both 70 with $80,000 of pension and $40,000 of benefits between them:

```text
$40,000 and $20,000 each                    $720.00
the pension on one, the benefits on the other   $758.40
all of both on the same spouse             $3,261.65
```

$2,541.65 decided by nothing but whose name the income is in. Every other
computation in these packages can be done from a household total. This one cannot,
so there is now a `retirement: { filer, spouse }` input — and if you omit it the
result tells you which assumption it made.

**An IRA is not an employee retirement system.** § 10-209(a) excludes an IRA, a
Roth, a **rollover** IRA, a SEP and a § 457(f) plan. So rolling a 401(k) into an
IRA — the most routinely recommended move in retirement planning — costs a
Montgomery County retiree **$2,282.28 a year at $50,000 of income and $3,428.03 at
$150,000**, for life, at no federal cost and with nothing on the federal return to
show it happened. I have not seen this priced anywhere.

**And the maximum exclusion goes DOWN in 2026**, from $41,200 to $40,600, both
figures published by the Comptroller. It is the only parameter in any of these
packages that has ever decreased, and anything that indexes it upward will be
wrong for 2026 in the expensive direction.

### Two small repairs found on the way

- `totalTax` disagreed with the sum of the figures the result reports, by a cent,
  wherever a component landed on a half cent. It was rounding the sum of the
  unrounded parts. It now adds up the parts as reported, because "the numbers do
  not add up" is the one arithmetic complaint a tax library cannot survive.
- The MCP server never named the subtractions it computed itself — it printed one
  "Less state subtractions" total. It now lists them, which is also the only way
  the assumption warning above can reach anyone.

---

## 2026-09-11 (Day 17)

### The ask is smaller today, and you can do it from a phone

The ask has been the same eleven days running — publish three packages — and the
shape of it was the problem: three `npm publish` runs on a machine with the right
Node, the right checkout and a logged-in npm session. Day 17 added
`.github/workflows/release.yml`, so the whole thing is now:

1. Create an npm **automation** access token (npmjs.com -> your avatar -> Access
   Tokens -> Generate New Token -> Automation). This is the one step I cannot do:
   it is an account action on an outside service.
2. Paste it into this repo as a secret named `NPM_TOKEN` (Settings -> Secrets and
   variables -> Actions -> New repository secret).
3. Actions -> **Release** -> Run workflow. Leave "dry run" ticked the first time:
   it builds, typechecks, runs all 703 tests and packs all three packages without
   publishing anything. Then run it again with dry run **unticked**.

The workflow refuses to publish a package whose own suite did not just pass in
that same checkout, skips any version already on npm, and publishes with
**provenance** — so each tarball carries a signed attestation linking it to the
commit and the workflow run that built it, which is worth having for a tax
library specifically.

The old route still works and needs no token:

```bash
npm login
cd packages/us-tax-mcp    && npm test && npm publish   # 132 tests
cd ../us-federal-tax      && npm test && npm publish   # 283 tests
cd ../us-state-tax        && npm test && npm publish   # 288 tests
```

Nothing else is needed and nothing is blocked.

### What changed: Virginia

**28 states.** `us-state-tax` is v0.13.0 and `us-tax-mcp` is v0.15.0. **703 tests**,
all green, still zero dependencies in all three packages.

Virginia looked like the cheap quiet day — four brackets, and the only large state
in the package with **no local income tax at all**. It turned out to contain the
highest marginal rate anywhere in this package that is not a cliff, and a published
parameter that is arithmetically unreachable.

### Four things worth knowing

**Virginia's graduated rates are worth `$257.50`, to everybody, forever.** The four
brackets are real, and the thresholds are the same for every filing status and have
not moved since 1990: 5.75% begins at `$17,000` of taxable income for a single filer
*and* on a joint return. So the entire benefit of the graduation is
`5.75% x $17,000 - $720 = $257.50`, at every income, in every year since 1990.
Virginia is a 5.75% flat tax with a `$257.50` discount.

**The Commonwealth's published `$259` ceiling on the spouse tax adjustment cannot be
reached.** The adjustment exists because the brackets are not doubled, and it works
by splitting the return in two — so its output *is* the `$257.50` above. Virginia
Tax publishes it as "up to `$259`". The test searches the whole surface (every joint
taxable income against every split of it) and the maximum is `$257.50`. The ceiling
has been `$1.50` above anything that can reach it since 1990.

**A Virginia sixty-five-year-old faces 11.5%, twice the state's top rate.** The
`$12,000` age deduction is withdrawn **dollar for dollar** above `$50,000` of
adjusted federal AGI (`$75,000` joint), and it is per person:

```text
joint, both aged 70, 2025
  $75,000   $1,469.80
  $99,000   $4,229.80     $2,760 of tax on $24,000 of income - 11.50%, exactly
```

There is no 11.5% in any table of Virginia rates, because 11.5% is not a rate; it is
two rules meeting. And the income it is tested on is federal AGI **less taxable
Social Security**, while the deduction comes off Virginia AGI — two different
figures one line apart, worth `$2,572.80` to that couple on `$90,000`.

**Virginia has two poverty floors, set by two different governments, and which one
bites depends on family size.** The statutory filing threshold is `$11,950`
(`$23,900` joint) and has not moved since 2021; the Credit for Low Income
Individuals zeroes the tax up to the federal poverty guideline, which rises `$5,500`
a head. For a single filer the real cliff is `$168.55` and it is `$3,700` above
where the statute put it; for a childless couple it is `$106.23` at the threshold;
for a family of four it is `$416.55` — and it **vanishes entirely** for that same
family if they claim the federal earned income credit, because Virginia's 20% match
and its `$300`-a-head credit are alternatives and only one is refundable.

### The competitive read, and it is the sharpest yet

`statetakehome-mcp` is still v0.1.1 of 2026-07-13. Its Virginia record is the best
one of theirs I have read — the brackets are right, the standard deduction is right,
and they correctly show the joint schedule undoubled. It has no personal exemption,
no spouse tax adjustment, no age deduction and no Social Security subtraction:

```text
                                        theirs        ours      over by
single, $60,000                      $2,689.38   $2,635.90       $53.47    2.0%
joint, $120,000, two earners         $5,636.25   $5,271.80      $364.45    6.9%
single aged 70, $55,000              $2,401.88   $1,899.90      $501.97   26.4%
retired couple, 70, $90,000 with
  $30,000 of taxable Social Security $3,911.25     $622.00    $3,289.25  528.8%
```

**Six times the true tax for a retired Virginia couple.** Note the direction: their
Ohio and Michigan records were *short* because they omitted local taxes, and their
Virginia is *over* because Virginia's complexity is all subtractions. A rate table
is not conservative in one direction; it is wrong in whichever direction the state
happens to be complicated. Their Virginia also carries `verify_2026: true` — a
**fifth** state with their own published to-do flag on it — and has no 2025 schedule.


## 2026-09-10 (Day 16)

### The ask is unchanged: publish

Same three packages, same commands, new version numbers and new test counts:

```bash
# once, on your machine
npm login

cd packages/us-tax-mcp
npm test            # 131 tests; confirm green
npm publish

cd ../us-federal-tax && npm test && npm publish   # 283 tests
cd ../us-state-tax   && npm test && npm publish   # 269 tests
```

Nothing else is needed and nothing is blocked.

### What changed, and it is the largest change so far

**Ohio, all 679 of its municipal income taxes, and all 214 of its school district
income taxes.** Local coverage went from 140 jurisdictions to **1,033** in one day
— Ohio alone now has more taxing jurisdictions in this package than the rest of
the United States put together — and Ohio was the largest state the package was
missing. `us-state-tax` is v0.12.0 (27 states) and `us-tax-mcp` is v0.14.0.

### Five things worth knowing

**Ohio's printed rate schedule is discontinuous, and it is the law rather than a
typo.** O.R.C. § 5747.02(A)(3) charges 0% on the first `$26,050` of taxable
nonbusiness income and then `$342.00` **plus** 2.75% of the excess — with the
`$342.00` charged whole on the first dollar of the band. A filer at `$26,050`
owes nothing and a filer one cent later owes `$342.00`. It steps a second time by
`$18.69` at `$100,000`, because HB 96 lowered the lower constant for 2025 and left
the upper one at what the old lower one chained to. Five independent
transcriptions of the booklet agree. Every rate table that reports "Ohio: 0% /
2.75% / 3.125%" invites a reader to walk three marginal brackets, which
**understates every Ohio filer above the threshold by the whole `$342`**.

**For most Ohio filers the municipal tax is the larger of the two.** A Columbus
resident on `$60,000` owes Ohio `$1,216.50` and Columbus `$1,500.00`. The state
tax does not overtake a 2.5% municipal one until `$126,408.32` of income. The
municipal base is *qualifying wages* — box 5 of the W-2 — so a 401(k) deferral
does not reduce it (`$612.50` a year for a Columbus saver at the 2026 maximum),
while interest, dividends, capital gains and pensions are outside it entirely, so
an Ohio retiree owes their municipality nothing.

**Two Ohio credits turn out to be unclaimable, and I believe nobody else says so.**
The `$20` exemption credit needs modified AGI below `$30,000`; the zero band means
a filer needs taxable income above `$26,050` before there is any tax to credit. At
`$2,400` an exemption those overlap in a `$1,550` window, and a *second* exemption
closes it — so a per-exemption credit is claimable only by a filer with exactly
one exemption. The joint filing credit's top 20% row is unreachable for the same
reason; the highest rate it is ever actually paid at is 15%. Both are pinned by
tests.

**Ohio taxes one paycheck on three bases and they disagree about what a wage is.**
The state taxes federal AGI as adjusted. A municipality taxes "qualifying wages" —
box 5 of the W-2, so a 401(k) deferral does not reduce it. An earned-income school
district taxes wages as included in modified AGI — box 1, so the same deferral
*does* reduce it. A `$24,500` deferral is therefore worth `$612.50` to Columbus and
saves `$306.25` from the district, on the same paycheck. And a traditional school
district taxes modified AGI less exemptions, where "modified" means the business
income deduction is added back — the only base in this package that reaches income
the Ohio return itself does not.

**One deliberate guess, labelled.** Ohio grants no statutory resident credit for
tax paid to another municipality — each ordinance decides — and the table of
per-municipality figures is blocked at the proxy. Rather than make a large share
of working Ohio uncomputable, the engine assumes the common ordinance (100% of the
tax paid, capped at the home rate), **names the assumption inside the credit line
itself**, says in a note what a less generous ordinance would cost, and accepts
two overrides. If you would rather it refused, that is a one-line change and I
will make it.

### The competitive picture, since it bears on whether publishing is worth it

`statetakehome-mcp` (npm, v0.1.1, unchanged since July) now has an Ohio record. It
has two marginal brackets, **no base amount** and **no personal exemption**, so for
a single filer at `$60,000` in 2026 it answers `$933.63` against `$1,206.50` —
short by 22.6% of the state tax, and by **65.5% of the whole bill** once Columbus
is counted. Its own note says "Municipalités 1-3% en sus" and computes none of
them; the range is wrong at both ends (the real one is 0.45% to 3.00%). It carries
`verify_2026: true` — their own unchecked-figure flag — on a fourth state.

### Still open from earlier days

Everything below this entry still stands. Nothing has been added to the list and
nothing has been withdrawn.

---

## 2026-09-09 (Day 15)

### The ask is unchanged: publish

Same three packages, same commands, new version numbers and new test counts:

```bash
# once, on your machine
npm login

cd packages/us-tax-mcp
npm test            # 126 tests; confirm green
npm publish

cd ../us-federal-tax && npm test && npm publish   # 283 tests
cd ../us-state-tax   && npm test && npm publish   # 231 tests
```

Nothing else is needed and nothing is blocked.

### What changed

**All 24 Michigan city income taxes**, so there are now 140 local income taxes
where there were 116. `us-state-tax` is v0.10.0 and `us-tax-mcp` is v0.12.0,
taking four new fields — `city`, `cityIncome`, `workCity` and
`workCityEarnings`, all Michigan-only.

### Three things worth knowing

**A Michigan city taxes something the Michigan return does not compute.** Every
other local tax in this package charges a rate on a line of the state return.
Michigan's cities define their own base and exclude pensions, IRA
distributions, Social Security, unemployment compensation and military pay
**entirely** — so a retired Detroit filer owes the city nothing on their
pension, and a family whose Michigan tax is a refund from the state's earned
income credit still owes Detroit in full. A single filer at `$100,000` owes
Michigan `$4,003.50` and Detroit `$2,385.60`.

**The city exemption has been `$600` since 1964 and is worth `$14.40`.** MCL
141.631(1) set the floor and never indexed it; Michigan's own exemption is
`$5,800` and is indexed every year. That is also why the per-city variations in
which extra exemptions a city allows are not modelled: the whole class of
omission is bounded by that `$14.40`, and the result says so.

**The credit for tax paid to another city is capped at your own city's
nonresident rate**, which means it is complete for a Detroit resident commuting
to Grand Rapids and short for a Lansing resident commuting to Detroit — who pays
70% more city tax than one working at home. Pass `workCity` and
`workCityEarnings` and both taxes and the credit are computed.

### One competitive datum, if you are deciding whether this is worth publishing

`statetakehome-mcp`, the npm package that claims all fifty states, has **no
Michigan city income tax at all**. For a single Detroit filer at `$100,000` its
answer is `$3,999.25` against `$6,389.10` — short by 37.4% of the bill, in a
package whose entire subject is take-home pay. Separately, it files Michigan's
per-*person* `$5,900` exemption under `standard_deduction`, so a joint return
with two children gets `$11,800` of exemptions where the answer is `$23,200`:
`$484.50` too much tax, in the opposite direction, on the same state.

### One thing I could not verify, recorded so you can

Hudson's city personal exemption is `$1,000` here. Every other above-floor
exemption (Grayling `$3,000`, Portland `$1,000`, Ionia `$700`, Battle Creek,
Benton Harbor, Saginaw and Springfield `$750`) was confirmed from two
independent sources today; Hudson's rests on one. It is worth `$10` of tax per
exemption. `ci.hudson.mi.us` is blocked from here.

---

## 2026-09-08 (Day 14)

### The ask is unchanged: publish

Same three packages, same commands, new version numbers and new test counts:

```bash
# once, on your machine
npm login

cd packages/us-tax-mcp
npm test            # 123 tests; confirm green
npm publish

cd ../us-federal-tax && npm test && npm publish   # 283 tests
cd ../us-state-tax   && npm test && npm publish   # 214 tests
```

Nothing else is needed and nothing is blocked.

### What changed

**Maryland and all 92 Indiana counties — 116 local income taxes where there
were two.** `us-state-tax` is v0.9.0 and covers 26 states plus 24 Maryland
jurisdictions and 92 Indiana counties; `us-tax-mcp` is v0.11.0 and takes four
new fields — `county` (effectively required for both Maryland and Indiana),
`netCapitalGain`, `stateItemizedDeductions` and `federalItemized`.

### Three things worth knowing

**A Maryland answer without a county is missing about a third of the bill.**
Every Maryland resident owes a county income tax of 2.25% to 3.30% on the same
taxable income the state taxes. A single filer at `$100,000` owes the state
`$4,386.38` and Montgomery County `$2,990.40` — and that county half alone is
more than the entire state income tax of Arizona or Indiana at the same income.
No table of state income tax rates contains it.

**Frederick County's rate is not a bracket.** Anne Arundel and Frederick are the
only two Maryland counties with more than one rate, and they appear as
identical-looking multi-row entries in the same chart. Anne Arundel's rows are
marginal. Frederick's bracket picks **one rate that applies to the whole
income**, so crossing `$150,000` of taxable income costs `$360.03` of county tax
on one dollar where the same dollar in Anne Arundel costs three cents.

**Indiana's county tax is two fifths of the bill, and it was the cheapest state
in the package to make right.** Every one of the 92 counties charges its own rate
on the same line the state charges 3.00% (2.95% in 2026) — the average is 1.914%.
Porter County charges 0.5%; Randolph County charges 3.00%, the statutory maximum,
which means that from 2026 a Randolph County filer pays their county **more than
their state**. Six counties raised their rate for 2026 in the same year the state
cut its own, and a Union County filer's bill went up 14% in a tax-cut year.

**Maryland's new capital gains surtax is the sharpest cliff this package has ever
modelled.** From tax year 2025 a filer whose *federal* AGI exceeds `$350,000`
owes 2% of their whole net capital gain, and a filer one dollar below owes
nothing — `$6,933.08` of tax on one dollar for a single filer whose `$350,000` is
all gain. The threshold is per return and is not doubled for a joint return, so
two spouses with `$200,000` each pay it and two single filers with the same
incomes do not.


## 2026-09-07 (Day 13)

### The ask is unchanged: publish

Same three packages, same commands, new version numbers and new test counts:

```bash
# once, on your machine
npm login

cd packages/us-tax-mcp
npm test            # 118 tests; confirm green
npm publish

cd ../us-federal-tax && npm test && npm publish   # 283 tests
cd ../us-state-tax   && npm test && npm publish   # 177 tests
```

Nothing else is needed and nothing is blocked.

### What changed

**Massachusetts.** `us-state-tax` is v0.7.0 and covers 25 states; `us-tax-mcp` is
v0.9.0 and takes four new fields — `massachusettsFivePercentIncome` (required for
MA), `shortTermCapitalGains`, `collectiblesGains` and
`socialSecurityAndMedicarePaid`.

### Three things worth knowing

**Massachusetts is not a 5% flat tax state, and it is the only state here where
the rate depends on the kind of income rather than the amount.** Short-term
capital gains are taxed at **8.5%** and long-term gains on collectibles at **12%**
on half the gain. The same `$100,000` costs `$700` more when `$20,000` of it was
held eleven months rather than earned. No table of state income tax rates can
express that, because such a table has one row per state.

**Massachusetts avoids New Jersey's cliff by charging double the rate.** Just
above its No Tax Status threshold the Limited Income Credit limits the tax to 10%
of the income above it — twice the statutory 5% — and the 175%-of-threshold
eligibility ceiling the instructions print is never the operative limit for
anybody. `$8,000` of income costs nothing; `$8,001` costs ten cents; the marginal
rate is 10% until `$11,600` and 5% after it.

**The competitor that claims all fifty states gets Massachusetts wrong in four
ways at once.** `statetakehome-mcp` sells `capital-gains-tax` in its keywords and
has no short-term rate at all; it carries the **2025** surtax threshold under
`source_year: 2026` — and flags it in the shipped data with `"verify_2026":
true`; it has no No Tax Status, so a filer at `$8,000` is charged `$180` where the
answer is `$0`; and it has two filing statuses. That is the clearest evidence yet
for why this project's bet is depth rather than coverage.

---

## 2026-09-06 (Day 12)

### The ask is unchanged: publish

Same three packages, same commands, new version numbers and new test counts:

```bash
# once, on your machine
npm login

cd packages/us-tax-mcp
npm test            # 115 tests; confirm green
npm publish

cd ../us-federal-tax && npm test && npm publish   # 283 tests
cd ../us-state-tax   && npm test && npm publish   # 160 tests
```

Nothing else is needed and nothing is blocked.

### What changed

**New Jersey.** `us-state-tax` is v0.6.0 and covers 24 states; `us-tax-mcp` is
v0.8.0 and takes eight new fields — `newJerseyGrossIncome`, `filerAge`,
`spouseAge`, `blindOrDisabled`, `dependentsAttendingCollege`, `retirementIncome`,
`propertyTaxPaid` and `rentPaid`.

New Jersey is the ninth largest state and it was the largest one missing. It is
also the second state here with no federal starting line, which is the thing this
package exists to model: New Jersey does not tax Social Security or unemployment
compensation and it **does** tax 403(b) deferrals and traditional IRA
contributions, which never appear in federal AGI. So the engine demands New
Jersey's own figure rather than accepting an approximation of it.

### Three things worth knowing

**Below the filing threshold New Jersey charges nothing at all.** `$10,000` of
gross income single, `$20,000` joint — and one dollar more brings the whole first
bracket with it, `$126.01` and `$252.01`. The threshold is measured on gross
income and the tax it triggers on taxable income, so how far a filer falls
depends on their own exemptions.

**The retirement income exclusion ends in a wall.** A joint return with a
`$100,000` pension excludes `$25,000` of it at `$150,000` of total income and
**nothing** at `$150,001` — `$1,381.31` of tax on one dollar of income, and the
largest cliff this package measures as a marginal rate.

**A search of npm for `njeitc` returns zero packages**, the same result
`caleitc` gave on Day 11. Nothing in the JavaScript ecosystem computes New
Jersey's earned income credit — the largest state match in the country at 40% of
the federal one — or its child tax credit, which the 2026 budget raised 25% for
2026 through 2028.

### And one thing that is only a rounding note

The 2026 child tax credit amounts come from P.L. 2026, c.26, enacted 30 June
2026. Two independent sources agree on the 25% increase and on the 2029 reversion.
Nothing else in the New Jersey computation moved between 2025 and 2026, because
New Jersey indexes none of it — the `$20,000` bottom bracket has been `$20,000`
since 1991.

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
