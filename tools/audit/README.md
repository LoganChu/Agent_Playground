# The verification audit, run by the buyer

```
node tools/audit/audit.mjs --demo                      # the sample, no data needed
node tools/audit/audit.mjs --in your-figures.csv
node tools/audit/audit.mjs --in your-figures.csv --out REPORT.md
node tools/audit/audit.mjs --in your-figures.csv --json
```

Give it a CSV or JSON of households **and your own figure for each one**. It runs
every household through this engine, and for each disagreement it names the
household, the two figures, the dollar size of the gap, what explains the gap,
and the documents behind the state-year. It needs the two packages built:

```
(cd packages/us-federal-tax && npm install && npm run build)
(cd packages/us-state-tax   && npm install && npm run build)
```

**Nothing is sent anywhere.** There is no network call in this tool or in either
package it imports; both are dependency-free. That is a property a security
review can check in about a minute, and it is the reason this is a CLI and not a
hosted form.

## Why the thing that was for sale is being given away

`OFFER.md` prices a verification audit at **$2,500** and describes a report
naming, for every disagreement, the household, the two figures, the dollar size
of the gap and the statute line that settles it. For seventy-three days that was
a description of work a human would do by hand, which makes it a promise rather
than a product.

**The audit was never the scarce part. The scarce part is being willing to
look.** A buyer who runs this and sees eleven disagreements in twelve households
has a reason to pay for the half a tool cannot do — reading the statute on the
ones it could not explain, and deciding which of the two engines is wrong. A
buyer who runs it and agrees everywhere was never going to buy anything, and
finding that out in one command is worth more to both sides than finding it out
in an engagement.

## The input schema

Sixteen columns. **Four are required** — `state`, `year`, `filingStatus`,
`theirTax` — and the rest default. `node tools/audit/audit.mjs` with no arguments
prints the list with each column's type.

```csv
id,state,year,filingStatus,wages,primaryAge,childAges,county,locality,theirTax
acme-001,KY,2025,single,45000,40,,,,1669.20
acme-002,MD,2025,marriedFilingJointly,120000,52,14;17,Howard,,8102.11
```

- `theirTax` is **your** figure: state income tax plus any local income tax on
  top of it, after credits. Accounting parentheses are read as a negative, which
  a refundable credit in New York really does produce.
- `childAges` is semicolon-separated: `3;7;15`.
- `county` is a Maryland or Indiana county where one taxes income; `locality` is
  `NYC` or `YONKERS`.
- `filingStatus` is one of the five this engine has, and a value outside them is
  **refused rather than guessed**. A product that stores `married` as a boolean
  has to decide between joint and separate before it can ask a question, and
  guessing on its behalf would put this harness's choice in the buyer's column
  and then report the difference as their defect.

**The schema is narrow on purpose, and the narrowness has a price that is paid
out loud.** A buyer who has to fill in `longTermCapitalGainAfter2011` before they
can run an audit will not run the audit. So a household whose income this schema
cannot express is answered on the income it can, and **every field this harness
defaulted is named on the row it affected** — the same contract
`StateIncomeTaxResult.notes` has with a caller, one level out. A default is not a
fact, and a report that hides which figures it invented blames the buyer for this
harness's silence.

The households are built by `householdInput` in `tools/differential/ours.mjs` —
**imported, not copied.** Every unobvious field that function passes is there
because withholding it made two engines answer different questions and the
difference got reported as a divergence about a state: Alabama's deduction for
the federal bill, Arizona's post-2011 gain vintage, Missouri's capital gain
subtraction, Virginia's combined-AGI age withdrawal. A second copy here would be
a second place for that list to be incomplete, and the incomplete one would blame
the buyer's engine for this harness's omission.

## What it can find, and how strong each kind of evidence is

**A diagnosis is worth what its evidence is worth, so every finding carries its
evidence class and they are not interchangeable.**

| class | what it means |
| --- | --- |
| `recomputed` | the engine was re-run with **one thing changed** and returned your figure. Not a theory about your bug: your number, produced on demand, from a stated change. |
| `arithmetic` | your figure equals a figure this result already reports, or this result's answer plus or minus **exactly one** named line item of it. Exact to the cent, and the line item is named out of the engine's own output. |

| finding | what it is |
| --- | --- |
| `stale-parameters` | your figure is this engine's answer for an **earlier tax year**. The most valuable thing here, and not because it is the largest: it is the one defect a buyer cannot fix by reading a statute, because the statute is right and the figure is last year's. |
| `filing-status` | your figure is this engine's answer under a **different filing status**. Both are correct computations; they answer different questions. |
| `supplied-figure-not-spent` | a column you filled in moved no money in your engine. Probed by zeroing that column and re-running the whole return, so a graduated schedule and any credit phase-out underneath it are already inside the comparison. |
| `local-tax-omitted` | the state return is right to the cent and the county, city or school district on top of it is missing. **1,033 of these ship in this package** and most tables of state tax rates have none of them. |
| `credits-not-applied` | your figure is the state tax **before credits**, exactly. |
| `credit-omitted` | your figure is this engine's answer plus exactly the amount of **one named credit**. |
| `surtax-omitted` | your figure is this engine's answer less exactly one named surtax — California's 1% over $1,000,000, Massachusetts's 4% over the indexed threshold. |
| `top-rate-on-whole-base` | your figure is the **top rate applied to all taxable income**. This is what a table with one row per state produces, and it overstates every graduated state at every income. |
| `no-income-tax-state` | a state that levies no individual income tax on wage income, charged anyway. |
| `rounding` | under a dollar. Not necessarily a defect in either engine — states differ on whether the filer rounds, at which line, and in which direction, and New Mexico's Department changed its own rule after 2023. Worth settling once and not worth settling per household. |

### And `unexplained`, which is the one that keeps the rest honest

**A tool that explains every disagreement has a catch-all in it.** This one
reports the residue instead of absorbing it, and the headline counts it on its
own line. An unexplained gap is where a human has to read the statute and decide
which of the two engines is wrong — which is the paid half, and the only half
that is not arithmetic.

### There was a third evidence class and it was deleted on the day it was written

`rate-estimate` reported a gap that equalled a named add-back or computed
subtraction times the return's marginal rate. It was labelled a candidate rather
than a finding, which was honest, and it was still wrong to ship:

- For the one add-back this schema can express — Illinois's addition for other
  states' municipal interest — **the gap does not need estimating**, because the
  figure driving it is a column the buyer filled in. Zero the column, re-run, and
  the engine either returns their number or does not. That is `recomputed`, and
  it strictly dominates the estimate.
- For the one computed subtraction in the package — New Jersey's pension and
  retirement income exclusion — the estimate is **unreachable**. The exclusion is
  all-or-nothing against a total-income test, so on every household it applies to
  the New Jersey tax is `0` and the marginal rate is `0`, and a rate of zero
  times anything explains no gap.

Its whole domain was either better served or empty, and **nothing in the demo
reached it** — which is how it was found. Mislabelling its evidence class as
`recomputed` on purpose failed not one test. An evidence class no input reaches
is a class nobody is checking.

## The demo, and why its rows are wrong

`demo-synthetic.csv` is **twelve invented households**, named so in the filename.
Each row is wrong in exactly one of the documented ways, so running
`--demo` demonstrates every finding class on figures that need no buyer's data —
and one row, `payroll-011`, is wrong in a way this tool **cannot** explain, which
is there so the honest line in the headline is never zero.

```
node tools/audit/audit.mjs --demo > tools/audit/out/REPORT.md
```

`out/REPORT.md` is a committed golden file, regenerated and diffed by
`tools/preflight.mjs` and by CI — the same pattern `tools/differential` and
`tools/anchors` use. **The report carries no timestamp**, because a date in a
committed artefact turns every CI run after midnight into a diff.

`audit.test.mjs` asserts the **exact set** of finding classes the demo
demonstrates, and the exact number of unexplained rows. Both are sets and
ceilings rather than floors, deliberately: Day 73 found three guards in this
repository that were all floors — `description.length > 200` against a
255-character cap, `keywords.length >= 100` against a 99th percentile of 25,
`covered > 2_000` against 7,009 — and the lesson was that a bound written without
measuring the consumer enforces the guess. The consumer here is a buyer reading a
report, and what they need is that the set of findings is exactly right: a class
that stopped firing has to fail, and so does a class that started firing where it
should not.

## What it says when pointed at an engine somebody else wrote

`demo-synthetic.csv` is twelve households **I invented**, each wrong in one way I
had already decided the tool would find — so the tool finding them proves the
wiring works and nothing about whether the classifier is any good.

```
node tools/audit/against-policyengine.mjs > out/AGAINST-POLICYENGINE.md
```

`tools/differential` holds 2,904 households and `policyengine-us`'s own figure
for each. That script runs the audit over all of them with PolicyEngine's state
tax in the buyer's column — and it is **gradeable**, because the differential
harness has hand-classified every difference: 73 written rules account for 1,194
of them and 3 it could not account for at all.

```text
  agree to the CENT                          1,789
  differ by under a dollar                     226    the differential calls these agreement
  differ by a dollar or more                   889
    the tool explains                           86
    it does not                                803

  scored against the human verdict, over the 889:
                            human explained it   human could not
    tool named something                    86                 0
    tool was silent                        800                 3
```

**THAT TOP-RIGHT ZERO WAS A THREE ON DAY 74, AND THE FALL IS THE TOOL WORKING.**
On three of the then-sixteen differences seventy-four days of hand analysis had
left unexplained — all Indiana — the tool said PolicyEngine's figure is this
engine's answer with **Indiana's earned income credit not applied**, exactly, to
the cent, at $93.30, $9.29 and $6.93. Day 75 took that account, read
PolicyEngine's source, and found why: **its Indiana credit evaluates its
eligibility gate at the frozen 1 January 2023 Internal Revenue Code and its
amount at the current year**, so a credit its own formula would pay in full is
refused by its own gate. The divergence is now entered, the three cases are
explained, and the count that advertised the finding is zero.

> **SO THIS COLUMN IS A QUEUE AND NOT A SCOREBOARD.** A tool whose queue of cases
> the human could not explain stays full is a tool nobody acted on. The number
> worth watching is how many open questions it has CLOSED — three — and
> `tools/differential/INDIANA-EARNED-INCOME-CREDIT.md` is what closing one costs.

The remaining 3 are not Indiana and the tool is silent on all of them, which is
the honest shape of the other column: most known divergences are about a
provision neither engine's OUTPUT mentions, and the audit only sees what a return
reports.

**That 13 was 16 yesterday morning.** Nine of the ten that closed today were
Wisconsin, and they closed without a tool at all: this repository's **own
provenance ledger** had carried the account since Day 43 — PolicyEngine indexes
Wisconsin's 2025 Act 15 bracket expansion a year early — and nothing had ever
copied it into `known-divergences.json`. Every one of the nine is `0.009 ×` the
threshold difference, to the cent. **A finding one instrument holds and another
cannot see is not a finding the repository has**, and it is worth more as a
lesson than the nine differences are as a count.

**And one real defect in the tool, found the same way.** `filing-status` fired 66
times, and on 63 the human account says something else and better: PolicyEngine
allows the § 32(d) earned income credit to **every** separate filer and this
package does not. On a state return whose only status-sensitive line is a
percentage of that credit, *"they used `single`"* and *"they allowed a separate
filer a single-filer credit"* are the same number — and a re-run cannot separate
them, because both re-runs are the same re-run. Every `filing-status` finding now
carries the discriminator: **44** of the findings move nothing but a credit and
say so in terms, **47** move a bracket, a deduction or an exemption and are
specific to the status.

> **A CLASS THAT FIRES OFTEN AND AGREES WITH A HUMAN'S DIFFERENT ACCOUNT IS NOT
> CORROBORATED, IT IS CONFUSABLE.** The counts looked like success until they were
> read against what the human had written about the same households.

`against-policyengine.mjs` is deliberately **not** in CI and pins nothing:
PolicyEngine's figures move when they release, and an assertion over somebody
else's model fails for their reasons. It is a measurement whose result goes in the
journal whichever way it comes out.

## What this tool cannot do

- **It cannot tell you which engine is right.** It names what explains a gap, not
  who is wrong. Several findings are statements about which of two correct
  computations answers the question you asked.
- **It explains a gap; it does not find every gap.** It looks for the ways a tax
  engine is wrong that leave an arithmetic trace. A product wrong in a way that
  lands on no line item of the return is reported as unexplained, which is the
  right answer and not a useful one.
- **Nine states levy no individual income tax on wage income** and are correct at
  zero. A row for one of them that agrees proves nothing about the other 42.
