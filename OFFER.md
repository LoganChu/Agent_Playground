# What is for sale, what it costs, and how a dollar arrives

`STRATEGY.md`'s first sentence has said "the goal is revenue" since Day 1. Day 66
noticed the file had never described how a dollar would arrive, named the two
sellable things — **freshness** and **proof** — and still did not write a price.
This file is the price. It was written on Day 73 and it is the agent's proposal,
not a commitment: the human sets prices and signs things.

## The thing that is not for sale

**The code.** All three packages are MIT. Anybody may take every line today, for
nothing, and nothing here tries to stop them. Any plan that depends on charging
for the engine is dead on arrival, and seventy-two days of making the engine
better did not make the engine sellable — it made the two things below credible.

So what is sold is **work that perishes** and **assurance that cannot be
copied**: a tax engine is right for about eleven months, and the repository is
the machine that keeps one right.

---

## 1. The verification audit — $2,500, fixed scope, one-off

**For:** anyone shipping a number that claims to be somebody's state income tax —
payroll and HR software, financial planning tools, paycheck and take-home-pay
calculators, retirement planners, tax-adjacent SaaS.

**What they get.** Their figures run against this engine across their own
jurisdictions and household shapes, plus the 148-case anchor set whose right
answers come from **filled returns** — households entered into commercial tax
software, or computed on a state's own paper worksheet. The deliverable is a
written report that, for every disagreement, names:

- the household and the two figures,
- the dollar size of the gap,
- the statute or form line that settles it, and
- which of the two is wrong, or that the question is genuinely open.

### Half of it is free, runs on their laptop, and needs no conversation

**Day 74.** `tools/audit/audit.mjs` is the arithmetic half of this audit,
shipped. A buyer puts their households and their own figures in a CSV and runs
one command; for every disagreement the tool names the household, both figures,
the dollar gap, what explains the gap, and the documents behind the state-year.
Nothing is sent anywhere — no network call in the tool or in either package it
imports, which is a property their security review can check in a minute.

```text
  stale-parameters            their figure is this engine's answer for an EARLIER YEAR
  local-tax-omitted           the state line right to the cent, the county tax missing
  credits-not-applied         their figure is the tax before credits, exactly
  credit-omitted              ours plus exactly one named credit
  surtax-omitted              ours less exactly one named surtax
  top-rate-on-whole-base      the top rate applied to all taxable income
  filing-status               ours under a different one of the five
  supplied-figure-not-spent   a column they filled in moved no money
  no-income-tax-state         one of the nine, charged anyway
  rounding                    under a dollar, and not necessarily anybody's defect
```

**WHY GIVE AWAY THE THING THAT WAS FOR SALE.** Because the audit was never the
scarce part — **the scarce part is being willing to look.** A buyer who runs it
and sees eleven disagreements in twelve households has a reason to pay for the
half a tool cannot do, and a buyer who runs it and agrees everywhere was never
going to buy anything. Finding that out in one command is worth more to both
sides than finding it out in an engagement.

**So what the $2,500 buys is now a narrower and more defensible thing:** the 148
anchor households whose right answers come off filled returns and are not in the
free tool, their own jurisdictions and household shapes rather than a schema's
sixteen columns, and — the part that is not arithmetic at all — **reading the
statute on the gaps the tool reported as unexplained, and saying which of the two
engines is wrong.** The free tool's headline counts those on their own line,
which makes the paid scope something a buyer can see the size of before they
commit to it.

### And the whole two-part engagement has now been run end to end, on somebody else's engine

This is the one section to read, because it is no longer a description of the
product. It is the product, done, with the work visible.

**Day 74, the free half.** The tool was pointed at `policyengine-us` — an
open-source microsimulation model with a research team behind it — over the 2,904
households this repository already compares against it. Seventy-four days of hand
analysis had left sixteen of those differences unexplained. **The tool explained
three, all by the same cause, in seven seconds:** PolicyEngine's figure is this
engine's answer with Indiana's earned income credit not applied, exactly, to the
cent, at `$93.30`, `$9.29` and `$6.93`. It did not say which engine was right.
That is the free half's whole job — turn open questions into one specific one.

**Day 75, the paid half, which is an afternoon of reading and is what `$2,500`
buys.** The specific question was taken to the other model's source.

```text
  in_eitc.py           AMOUNT   10% of the CURRENT-YEAR federal credit
  in_eitc_eligible.py  GATE     the FROZEN 2023 federal credit must be positive
```

IC 6-3-1-11 freezes Indiana's base at the Internal Revenue Code as of 1 January
2023. PolicyEngine reads the **current** credit for the amount and rebuilds the
**2023** credit for the gate. Three households sit between the two: the 2023
credit is exhausted, the 2025 one is not, and a credit their own formula would
pay in full is refused by their own gate.

**It is a defect without reading a word of Indiana law, and the grid holds the
proof.** At `$40,000` with three dependents the frozen credit is `$4,928.07` and
the current one `$6,038.98`; ten percent of the frozen base would be `$492.81`
and of the current base `$603.90` — and the two engines agree there to the cent,
so PolicyEngine paid `$603.90`. The freeze decides *whether* and not *how much*,
which is no reading of the statute at all. Their own code comment argues against
it, and the same codebase handles the identical question correctly for Oklahoma
and deliberately for Washington.

**And a freeze that decides whether is a cliff.** For a joint return with three
children the 2023 credit runs out at `$63,400.15` of wages, where the current
credit is still worth `$1,110.91` — so **one cent of extra earnings costs that
filer `$111.09`.** A discontinuity is the defect class no household-by-household
comparison finds, because finding it needs two households a cent apart, and both
this grid and their own test suite sample incomes in round thousands.

**Then the check that could have killed the whole account.** SEA 243 of 2025
advances the snapshot to 1 January 2026, so for tax year 2026 the frozen table
*is* the current table and the divergence should vanish. It does, on all three
households, to the cent. Same households, same incomes, one year apart, nothing
changed but a date in a statute. **A finding that survives a test designed to
break it is the difference between a report and an opinion**, and it is the half
a tool cannot do.

> **AND IT IS BEING GIVEN TO THEM.** `NOTES-FOR-HUMAN.md` carries the report
> ready to send. A repository that finds a defect in another project and keeps it
> as a sales asset is not the kind of repository this page claims this is — and a
> buyer evaluating a `$2,500` audit should weigh what its author does with a
> finding they cannot invoice for.

**It also reported 226 differences under a dollar that the differential harness
calls agreement**, because that harness compares to the dollar and a buyer's
figure is a figure they printed on something.

And the measurement cut the other way too, which is recorded in
`tools/audit/README.md` rather than left out: the tool's `filing-status` class
fired 66 times and on 63 of those the human account says something else and
better, because a status and a credit only that status is barred from produce the
same number on a state return. Every such finding now carries a discriminator
saying whether anything but a credit moved. **A buyer who is going to trust a
report should see that its author measured where it was wrong.**

**Why it closes.** It leads with a finding rather than a promise, and now it
leads with a finding the buyer produced themselves. The product either agrees or
it does not, and they learn which before the first call. Four provisions found in
this engine in the last three days were each worth between `$40` and the filer's
**entire** state bill; a buyer's product has the same kind of hole and does not
know where.

**Why $2,500.** Below the threshold where a mid-size company needs procurement,
and above the point where it is worth doing. One overcharged customer cohort
costs more than this.

## 2. The freshness subscription — $6,000 a year

**What they get.** Every tax year, every parameter for all 42 states and 1,033
local jurisdictions re-read from the issuing document and re-verified, shipped
as a versioned pack with the provenance ledger — 7,009 figures mapped to the
document each came from, behind 632 citation entries, each saying which document,
which line, and what kind of authority it is. The ledger covers 311 further
numeric leaves and classifies them as sentinels — figures no document states,
such as a bracket with no ceiling — which is why the two counts differ. Plus the year's verification report and the differential grid.

**Why anyone pays for something they can clone.** They can clone it. What they
cannot clone is *next* year. Forty-two states publish new figures between
December and February, several of them only on a form and not in a statute, and
at least one a year contradicts itself — Kansas's form granted a `$2,320`
exemption a year before the legislature backdated it, Arkansas's card and
statute disagree by cents, New Mexico's Department changed its own rounding rule
after 2023. Reproducing that is roughly two months of a tax analyst's year, every
year, forever. $6,000 is a rounding error against it and the work is already
being done.

## 3. Priority support — $12,000 a year, add-on

Two-business-day answers on "why is this figure what it is", a named fix path for
anything they find, and their jurisdictions prioritised in the roadmap. This is
the only line that sells the human's attention rather than the agent's output,
and it should not be offered until the human wants to be on the hook.

---

## What has to be true before any of this can happen

Three of these are not possible for the agent and were each tested rather than
assumed. See `NOTES-FOR-HUMAN.md` for the ranked list with times attached.

```text
  a way to be contacted   there is no address anywhere in this repository, so
                          nobody can buy anything at any price
  somewhere to be found    the repo has no description, no topics and no
                          homepage; Pages has been off since Day 21
  something to install     the release workflow is one secret from publishing
                          to npm, which is reach rather than capability
```

> **A PRICE LIST WITH NO CONTACT ADDRESS IS A DOCUMENT ABOUT SELLING RATHER THAN
> AN ATTEMPT TO SELL.** That is the honest status of this file today, and naming
> it is better than letting it read as a storefront. The first ask in
> `NOTES-FOR-HUMAN.md` is one line of text: an address to put under each price.

**AND DAY 74 CHANGED WHAT THAT MISSING LINE COSTS.** Until today everything on
this page waited on a conversation that had nowhere to start. The audit's free
half does not: a buyer can run it, read a report naming their own disagreements
in dollars, and want to talk — and then find no address. **The missing line went
from blocking a sale to interrupting one**, which is worse, and it is still one
line of text.

