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

**As of Day 66 the four asks are unchanged and none of them blocks anything.** Three are
small and cosmetic — the repository description and topics, the GitHub Pages switch, the
optional npm publish — and the fourth is the one that would change what I can build: the
network policy. Day 61's entry below has the exact hosts and the exact settings page. No
Kansas primary document was opened today either: `ksrevenue.gov`, `kslegislature.gov` and
`ksrevisor.gov` all refuse to resolve from this sandbox, by `curl` and by the fetch tool
alike. What settled the state was the parameter files inside `policyengine-us`, downloaded
from PyPI, which the allowlist does permit — **plus, for the first time in a while, a
server-side search that reached three Kansas documents I could not fetch**: the 2025 tax
booklet, a Department of Revenue notice from November 2025 and the Department's own help
page for the pension schedule. Two of today's four findings came out of that search and
not out of the package, which is worth recording because the last fourteen days have made
it sound as though the package were the only route left.

`us-state-tax` is now **v0.57.0** and `us-tax-mcp` **v0.61.0**; `us-federal-tax` stays at
**v0.16.0**. **1,725 tests** across the four suites, all passing, up 96. **32 taxing states
and 41 in all**, up one; nine jurisdictions left.

**KANSAS IS IN, AND THE THING IT BROUGHT IS NOT A RATE. If you read two items, read A and
E.**

**A. A KANSAS WIDOW'S TAX BILL IS DECIDED BY A CHECKBOX, AND THE ANSWER IS NEITHER OF THE
TWO A COMPUTER WOULD GUESS.** Kansas's tax return has four boxes for marital status:
single, married filing jointly, married filing separately, head of household. It has **no
box for a widow** — the status the federal government calls a qualifying surviving spouse,
which a widow with a dependent child may use for two years after her husband dies.

Kansas's instructions say your Kansas status must match your federal one, and then give the
single exception: a widow **ticks the head-of-household box**, because that box is for
anyone who filed federally as head of household *or* as a qualifying widow.

That one sentence sets three numbers at once, and not one of them is what a program built
by analogy would pick:

| | what a Kansas widow gets | the married-couple column | the single column |
| --- | --- | --- | --- |
| standard deduction | `$6,180` | `$8,240` | `$3,605` |
| personal exemption | `$9,160` **+ `$2,320`** | `$18,320` | `$9,160` |
| the 5.58% rate starts at | `$23,000` | `$46,000` | `$23,000` |

A widow with one child and `$60,000` of income owes Kansas **`$2,145.72`**. Read against the
married-couple column — which is what nearly every program defaults to, because a widow's
federal return looks like a joint one — she owes **`$1,618.24`**, which is **`$527.48` too
little**. Read as a single person she owes `$2,418.86`, which is `$273.14` too much.

**The right answer is between the two wrong ones**, and it is the only one of the three that
includes a head-of-household allowance at all. So there is no cautious choice available:
you cannot get this right by picking whichever column looks safer, because the correct
figure is not at either end. This package now reads the instruction, and a test prices all
three columns so that the reading cannot quietly revert.

**B. AND THAT `$2,320` WAS ON THE TAX FORM A YEAR BEFORE IT WAS IN THE LAW.** Kansas
rewrote its personal exemption in a special legislative session in 2024: `$18,320` for a
married couple, `$9,160` for everybody else, plus `$2,320` for each dependent. The law said
nothing about an extra allowance for a single parent.

**The 2024 tax form gave one anyway.** The research model I compare against still carries a
comment in its source code saying, in so many words, that the legal code does not provide
for it and the tax form does. Then in 2025 the legislature passed a bill that wrote the
`$2,320` into the statute — **and backdated it to 2024, the year the form had already been
handing it out.**

So the Department of Revenue was ahead of the legislature by `$2,320` of tax-free income,
and the legislature caught up by agreeing with the form, retroactively. Anybody who built a
Kansas calculator from the 2024 statute alone was wrong about 2024 at the time and is still
wrong about it now. It is `$120.64` to `$129.46` of tax, for every Kansas single parent and
every Kansas widow, in both of the years this package covers.

**C. KANSAS GIVES A TAX EXEMPTION FOR A STILLBIRTH, AND NOTHING MODELS IT.** The same 2025
act added a provision allowing an additional `$2,320` personal exemption for an unborn child
that does not result in a live birth. A pregnancy that ends in a live birth during the year
produces a dependent, and a dependent is already worth `$2,320`; this provision reaches the
case where the year ends with no dependent.

I cannot compute it, and I have said so rather than leaving it out silently. **No tax return
and no figure on a federal form records that a pregnancy ended this way**, so there is no
input for it — the first provision I have met whose condition is not a number anybody
reports anywhere. A Kansas return computed here for such a household comes out `$120.64` or
`$129.46` too high, and the result says so and says how to supply it by hand.

**D. WHAT A KANSAS RETIREMENT COSTS DEPENDS ENTIRELY ON WHICH GOVERNMENT EMPLOYED YOU.**
Kansas exempts, completely, with no cap, no age limit and no income test: the Kansas public
employees', police and firemen's, judges' and highway patrol pensions; **federal civil
service pensions**, which by the Department's own wording covers a Thrift Savings Plan
withdrawal; and military retired pay. And
it exempts **nothing else** — not a company pension, not a 401(k), not an IRA, not an
annuity, at any age, below any ceiling.

```text
  a single Kansan of 67 with $50,000 of pension and nothing else
    a Kansas state, federal or military pension          $0.00
    the same $50,000 from a company plan or an IRA   $1,942.88
```

**And a retired Missouri teacher who moved to Kansas pays the full amount**, because the
exempt list is Kansas's own pensions plus the federal government's and nobody else's. The
federal half is there because a 1989 Supreme Court case requires a state that exempts its
own retirees to treat federal retirees the same way; nothing requires it to extend that to
any other state's retirees. So the boundary is drawn by constitutional doctrine rather than
by policy, and a guide that compresses it to "Kansas exempts government pensions" is wrong
about every retiree who earned one somewhere else.

The large research model I check against **cannot make this distinction** — its own source
comment says out-of-state public pensions are not exempt, and then it exempts them anyway,
because it has no field that tells the two apart. This package does, which is one of the few
places where it can be more correct than a much bigger model, and the note on the result
tells a caller which field to use.

**E. THE PART I WOULD WANT YOU TO SEE: I FOUND A PUBLISHED KANSAS RULE THAT CANNOT CHANGE
ANYBODY'S TAX, AND THEN WROTE A TEST FOR THE RULE I DID NOT BUILD.**

Kansas prints a "minimum filing requirement" in its instructions — the income below which
you need not file at all:

```text
  married filing jointly     $26,560    =  8,240 + 18,320
  head of household          $17,660    =  6,180 +  9,160 + 2,320
  single                     $12,765    =  3,605 +  9,160
  married filing separately  $13,280    =  4,120 +  9,160
```

**Every row is exactly that filer's standard deduction plus their personal exemption.** Which
means it can never do anything. A filer at or below the threshold already has no taxable
income, and every further allowance — a dependent, being over 65, being blind, itemising —
only widens the gap. The research model ships this as five parameters and a branch of code
that cannot fire, in any state of the world.

So I did not build it. **The interesting part is what I built instead.** The reason it is safe
to leave out is an *identity between three other numbers*, and identities between numbers
break: the day Kansas raises the standard deduction and forgets to raise the filing
requirement, the threshold starts to bite and becomes a cliff that nothing models. Nothing in
a suite of tax answers could notice that, because today the rule changes no answer at all.

So the test asserts the **four sums** rather than any tax figure. If Kansas ever moves one of
the three numbers without moving the other, it fails and says the rule now has to be built.

> A rule worth leaving out is worth a test, and the test has to be on the *reason* for
> leaving it out rather than on anything the program outputs.

That is a small thing with a general shape, and it is the second time in two days this
project has had to put a guard somewhere other than on a number. Yesterday's was a speed
optimisation deliberately designed not to change any answer — so no check on an answer could
ever tell when it stopped working.

**F. AND I REPLACED A HAND-WRITTEN LIST THAT HAD GONE STALE ON SIX CONSECUTIVE STATES.** The
MCP server refuses an argument for a state that does not read it — ask about Texas and pass a
pension figure and it tells you Texas has no income tax, rather than ignoring you. One of
those gates, the one for the Social Security figure, was a hand-typed list of state codes.

Louisiana, North Dakota, Oklahoma, Iowa, Arkansas and Kansas each needed a line added to that
list, and each time the file's own comment predicted the next one and argued that the list was
safe **because** the omission always got caught by a test. That is true. It is also an
argument for a cheaper way of being right:

> A list whose staleness is reliably caught is not a safe list. It is a list whose cost has
> moved from the bug to the chore — and the chore is paid by whoever adds the next state, in a
> file they never opened.

It is now computed from the engine: the union of the nine kinds of rule that actually read the
figure. All six of the states that drifted it used a mechanism the package already had, so not
one of them would have touched the new version at all.

**G. ONE THING THE TOOLS CAUGHT ME DOING, AND IT IS THE USEFUL KIND.** Kansas has no widow's
column of its own, so I wrote the correct schedule into that unused slot anyway, reasoning
that a stored table should be right on its own even where nothing reads it. A guard failed
immediately and reported that the status translation had stopped reaching one of the tables.

It had not. Passing the same schedule object to two filing statuses makes them **one object**,
so the guard's test — change the widow's cell and check that no widow's answer moves — was
changing the column she actually reads. And a hand-written figure in a slot nothing reads is
also a parameter the quality audit counts and no test can ever catch, which would have cost
six permanent black marks on the score in exchange for nothing at all.

> A value written into a slot nothing reads is not documentation. It is an uncheckable number
> and, where the slot holds a table, a hidden alias of a slot that *is* read.

**H. AND ONE CLAIM OF MINE THAT WAS WRONG, FOUND WHILE REMOVING KANSAS FROM A LIST.** The list
of jurisdictions this package does *not* cover carried a comment saying "largest first", with
three population figures I checked yesterday. The three were right. **The eight names after
them had never been checked and were not in order** — West Virginia, the third largest of
them, sat tenth out of eleven, below five jurisdictions smaller than it.

The sentence was not a lie when it was written, and yesterday's check did not make it true. It
made it *worse*: a measured claim with eight unmeasured entries inside its scope reads exactly
like a measured claim about all of them. The list now says which part of itself is measured,
and the top two — New Mexico, then Nebraska — are the only ones a plan should read. Putting the
other eight in order needs one lookup from a machine that can reach `census.gov`, and it is
worth having before the third state from here rather than the second.

---

**As of Day 64 the four asks are unchanged and none of them blocks anything.** Three are
small and cosmetic — the repository description and topics, the GitHub Pages switch, the
optional npm publish — and the fourth is the one that would change what I can build: the
network policy. Day 61's entry below has the exact hosts and the exact settings page.
**Day 64 added a fifth thing as a warning about a number this repository had been advertising
for thirteen days. Day 65 fixed the thing it warned about, and E now reports a measurement
rather than a caveat — including a real defect the measurement found.** See E.

Today's route to the figures was Day 63's and it worked again: `dfa.arkansas.gov` and
`arkleg.state.ar.us` both fail to resolve from here, so **no Arkansas primary document was
opened today**, and every citation in the new module says so in its own words. What settled
the state was the parameter files inside `policyengine-us`, downloaded from PyPI — which the
allowlist does permit — and read for the citations they name and for their own comments.

`us-state-tax` is now **v0.56.0** and `us-tax-mcp` **v0.60.0**; `us-federal-tax` stays at
**v0.16.0**. **1,629 tests** across the four suites, all passing, up 19. **31 taxing states
and 40 in all**, up one; eleven jurisdictions left.

**ARKANSAS IS IN, AND IT HAS THE BEST NUMBER THIS PROJECT HAS FOUND. If you read two items,
read A and E.**

**A. ARKANSAS CHARGES A 13.70% TAX RATE IN A BAND THAT APPEARS IN NO TABLE OF ARKANSAS TAX
RATES.** Arkansas's top rate is 3.7%. That is true, and it is not the highest rate an
Arkansan pays.

The law writes two separate rate schedules and picks between them by income. If your taxable
income is `$94,700` or less you are taxed on the ordinary graduated scale. One dollar more
and you are taxed under a different scale that charges 3.7% on *almost every dollar you
earn* rather than only on the top slice. That second scale charges a lot more, so the law
hands the difference back as a `$290` credit — and then takes `$10` of that credit away for
every `$100` you earn above `$94,700`.

**Losing `$10` of credit for every `$100` of income is a 10% tax, on top of the 3.7%.** So
between about `$94,700` and `$97,600` an Arkansan pays **13.70 cents on every extra dollar**,
and in 2025 it was **13.90 cents**. It lasts for about `$2,900` of income and then stops.
Nobody publishes this, because it is not a rate anybody wrote down — it is the *slope* of a
credit being withdrawn, and you can only see it by working out the tax at two incomes a
hundred dollars apart.

**And the credit that was meant to smooth the join is a staircase.** Its rows are `$100`
wide and the amounts are whole dollars, so the tax does not rise smoothly — it jumps. **`$10`
of tax arrives on one cent of extra income, twenty-nine times.** A provision written to stop
one cliff at `$94,700` is twenty-nine smaller cliffs instead.

**B. AND THE PRACTICAL CONSEQUENCE IS A SINGLE NUMBER THAT IS WRONG IN EVERY GUIDE TO THIS
STATE.** Every published account of Arkansas prints the graduated scale and stops there.
Anybody who builds a calculator from it — and that includes payroll software, financial
planning tools and tax estimators — is **too low by exactly `$287.30`** for every Arkansan
above the band. Not approximately: `$287.30` at `$100,000` of income and `$287.30` at
`$10,000,000`, because above the band both ways of computing the tax rise at the same rate
and the difference is the whole withdrawn credit. For 2025 it is `$330.70`, stepping to
`$329.00` above `$100,001`.

This is the easiest finding to sell that this project has produced. The previous two were
about errors that grow or shrink over time, which take a paragraph to explain. This one a
buyer can check against their own system in five minutes with one number.

**C. ARKANSAS TAXES ITS POOREST FILERS AT UP TO 12.40%, WHICH IS MORE THAN THREE TIMES ITS
TOP RATE.** Arkansas has seven "Low Income Tax Tables" — you look your tax up in a table
instead of using the rate scale, and you give up your standard deduction to do it. Below an
exempt amount you pay nothing. Above it, the tables rise steeply:

| who | the table's own rate | band |
| --- | --- | --- |
| single | 7.00% | $14,643 to $17,500 |
| single parent, one child | 9.40% | $20,820 to $25,300 |
| couple, no or one child | 10.40% | $24,695 to $29,000 |
| couple, two or more | 10.77% | $29,722 to $36,100 |
| **single parent, two or more** | **12.40%** | **$24,818 to $29,000** |

**The steepest tax rate in the whole Arkansas income tax is charged to a single parent of
two earning between about `$25,000` and `$29,000`.** This is not an accident or an oversight
— it is the price of not having a cliff at the exempt amount, and it is charged to exactly
the households the exemption exists for. Massachusetts does the same thing and this
repository already records it; Arkansas's version is bigger and covers five tables.

A married person filing separately is barred from all seven tables, so a separated Arkansan
at `$14,000` of income pays tax while a single filer at the same income pays nothing.

**D. AND ARKANSAS'S OWN PUBLISHED TAX CARD DISAGREES WITH ARKANSAS'S OWN LAW, BY A FEW
CENTS, ON EVERY RETURN.** The state publishes a card that computes the tax as a rate times
your income minus a fixed "adjustment". Those adjustments are `$111.98`, `$223.97`, `$287.97`
and `$419.96` — and each one is a few cents short of what the law's own brackets would give
(`$112.00`, `$224.00`, `$288.00`, `$420.00`). The shortfall is always exactly the rate
applied to **one dollar**, because the card is anchored a dollar below each bracket's floor.

So every Arkansan above `$5,600` pays two to four cents more than the statute's brackets
would charge. It is a trivial amount of money and a non-trivial fact: two state documents
that do not compute the same tax, with the instructions settling it in favour of the one
without the brackets in it. The independent reference model I compare against carried the
round numbers until recently and has since switched to the card's — somebody else read the
same two documents and reached the same conclusion.

**E. THE "99.6% MUTATION SCORE" IS NOW 99.8%, IT WAS MEASURED TODAY, AND THE RED CROSS I
WARNED YOU ABOUT EARLIER IS GONE.**

Earlier today I wrote here that the score was a measurement from yesterday, that one complete
pass would take about **fifteen hours**, and that the repository's CI would show a red cross
until a fresh measurement landed. **All three of those are now out of date, which is the
best outcome available and not the one I expected when I wrote them.**

The score is produced by deliberately corrupting one number at a time in the shipped code and
checking that the test suite notices. The problem was arithmetic: 2,436 numbers to corrupt
times a 26-second test suite is fifteen hours on the four processors this sandbox has. The fix
was to stop running all 66 test files against every corruption. A corrupted number in
Arkansas's module can only change an Arkansan's tax, so it now runs Arkansas's own tests
first — **2.3 seconds instead of 26** — and **anything that survives that short run is then
re-run against the whole suite before it counts**, so the published number is exactly what a
full fifteen-hour run would have produced. A complete pass now takes about half an hour.

**The measured record is 2,436 corruptions tried, 2,430 caught, 6 missed, 99.8%.**

**AND THE FIRST RUN OF IT FOUND A REAL DEFECT, which is the part I would read if I read only
one thing.** It came back with a seventh miss, in Arkansas — the state I had written down, in
advance, could not produce one. Not a tax figure: the year that selects which *law* the rate
schedule is named after. The tax came out right to the cent while a 2025 Arkansas return
reported that it had been taxed under **an act passed in 2026**, which is the citation a
caller — or a caller's AI model, through the MCP server — would quote. One new test closed it
and the whole class it belongs to, and the re-measurement came back at 6.

Nothing here needs you to do anything. The repository's CI should now be green on all seven
jobs for the first time since Day 63, and if it is not, the failure is a real one rather than
the deliberate one I described earlier.

**And one thing I got wrong today is worth telling you about, because it is the good kind.**
I wrote, in four places, that the audit was blind to all the amounts in Arkansas's low-income
tables — several hundred figures — and that this was the sharpest example of its limits. Then
I ran a small 240-corruption sample aimed at exactly those figures to illustrate the point,
and **it caught all 240**. The reason is a property of the tool I had not thought through: it
corrupts a number by doubling it, and doubling an income boundary in a sorted table does not
move that row slightly, it removes the row altogether — which every household above it
notices. So the tables are much better covered than I claimed, and the real limit is narrower
and more specific. I have corrected all four places and the test now pins the ten figures
that genuinely are out of reach, by name, so the claim cannot drift again.

**F. AND THE DIFFERENTIAL TEST FOUND FIVE REAL MISTAKES OF MINE TODAY, WHICH IS A RECORD.**
I run every household through an independent model maintained by people unconnected to this
project and compare to the dollar. Today it refused four things I had got wrong: a 50%
capital-gains exemption I had declared impossible to model (worth `$1,978` on one household
— a gap that size is a missing rule, not a gap), a missing addition for out-of-state
municipal bond interest (`$370` on `$10,000` of bonds), and two cells where a widow was
given a married couple's figure. A fifth, of the same shape, was caught by a hand-written
check. **2,728 households, and nothing about Arkansas is left unexplained.**

**As of Day 63 the four asks are unchanged and none of them blocks anything.** Three are
small and cosmetic — the repository description and topics, the GitHub Pages switch, the
optional npm publish — and the fourth is the one that would change what I can build: the
network policy. Day 61's entry below has the exact hosts and the exact settings page.
Day 62 added that `WebFetch` is not a way round it. Day 63 adds nothing new to the ask and
one thing to the workaround: **the strongest source available from here is not a web page
at all, it is the parameter files inside a published Python package.** I download
`policyengine-us` from PyPI — which the allowlist does permit — unzip it, and read its
`.yaml` parameter files for the citations they name and for their own comments. One of
those comments is what settled Iowa today: it says in so many words that *"the legal code
does not represent the current policy according to the 2023 IA1040 instructions"*. No
secondary web source said that, and it is the whole of the finding in B below.

`us-state-tax` is now **v0.55.0** and `us-tax-mcp` **v0.59.0**; `us-federal-tax` stays at
**v0.16.0**. **1,610 tests** across the four suites, all passing, up 17. **30 taxing states
and 39 in all**, up one; twelve jurisdictions left.

**IOWA IS IN, AND IT BROUGHT TWO THINGS WORTH YOUR TIME: a relief that is being taken away
from poor pensioners by arithmetic nobody voted for, and a demonstration of why this
repository runs two quality instruments instead of one.** If you read two items, read A and
D.

**A. IOWA HAS A TAX BREAK FOR LOW-INCOME HOUSEHOLDS THAT NO LONGER WORKS, AND IT IS BEING
SWITCHED OFF BY A NUMBER THAT IS NOT IOWA'S.** Iowa exempts a return from tax entirely if
the household's income is under a threshold: $9,000 for a single person, $13,500 for anyone
else, or $24,000 and $32,000 if someone on the return is 65 or over. Those four figures
have not changed since at least 2021 and nothing in Iowa law adjusts them for inflation.

The catch is **what the threshold is compared against**. The test happens *before* the
standard deduction comes off — and since 2023 Iowa's standard deduction has been the
**federal** one, which goes up every year. It is $15,750 for a single filer in 2025 and
$16,100 in 2026.

So a single Iowan earning under the $9,000 threshold already pays no tax, because $15,750
of deduction wiped it out before the exemption was reached. **The exemption exempts a tax
of nothing.** That is true of every one of the five filing statuses for anyone under 65,
in both years, and of married couples at any age.

Where it still does something is a single person, a single parent or a separated filer
aged 65 or over — and there it is shrinking:

| who | most it can save, 2025 | 2026 |
| --- | --- | --- |
| single filer at 65 | $237.50 | $222.30 |
| single parent at 65 | $242.25 | $220.40 |

**$15.20 and $21.85 taken away in a single year, from the poorest pensioners in the state,
with no Iowa figure amended by anybody.** The threshold stood still and the deduction it is
racing moved. On the recent rate of inflation adjustment the single-filer threshold is
overtaken completely around 2039 and the single-parent one around 2035, after which the
provision cannot change anybody's tax at all.

**This is the exact mirror of yesterday's Oklahoma finding and that is why I like it.** In
Oklahoma a frozen *base* makes anyone implementing the law pay a family too much, and the
error grows. In Iowa a frozen *threshold* quietly withdraws a relief, and the withdrawal
grows. Both are one side of a comparison being adjusted for inflation and the other being a
fixed number, and **neither is visible to anybody reading a single year's tax table.** A
check runs on every push that compares the two sides and fails if the gap ever stops
widening — which would mean either Congress cut the standard deduction or Iowa changed its
law, and both are things somebody would want to know.

**B. AND IOWA'S OWN LAW BOOK STILL PRINTS A RULE THE IOWA TAX FORM DOES NOT USE.** Iowa Code
§ 422.9 says the standard deduction is $2,210 for a single filer and $5,450 for a couple.
The Iowa tax form says: take the number from your federal return. The form has governed
since tax year 2023 and the statute has not been updated.

So anybody building a tax model from the Iowa Code gets $2,210 where the real figure is
$15,750 — **seven times too small, which is $514.52 of tax on a single return.** I only
found this because the reference model's own parameter file has a comment saying the legal
code no longer represents current policy. That is the kind of thing that is invisible to a
careful reading of the statute, because the statute is wrong rather than unclear.

A second date error rides along with it: **every secondary source I could find says Iowa
adopted the federal deduction in 2025**, along with its new flat tax. It was **2023**. The
flat rate and the deduction change are two separate reforms two years apart, and a model
that merges them gets tax years 2023 and 2024 wrong.

**C. IOWA EXEMPTS RETIREMENT INCOME COMPLETELY FROM AGE 55, WITH NO CEILING — AND IT IS THE
ONLY STATE OF ITS KIND.** A retired couple with $40,000 of Social Security and a $60,000
pension pays Iowa **nothing**. So does the same couple with a **$600,000** pension. Only
fourteen states charge that household nothing, nine of which have no income tax at all; the
other five are Alabama, Illinois, Iowa, Mississippi and Pennsylvania — and **Iowa is the
only one of the five with an age test.** The same $600,000 is free at 70 and taxed in full
at 54. If you ever care about this personally, 55 is the lowest retirement age in the thirty
states this package models; the next is Georgia at 62.

**D. THE PART I WOULD WANT YOU TO SEE, BECAUSE IT IS ABOUT WHETHER THE QUALITY NUMBERS MEAN
ANYTHING.** This repository publishes two independent quality measurements. One deliberately
breaks each number in the code and checks that a test notices (the "99.6%"). The other runs
thousands of households through this engine and through PolicyEngine-US, a microsimulation
model maintained by people with nothing to do with this project, and requires every
difference to be explained.

**Today the first one could not have found the day's only real defect, and the second one
found it in six households.**

Iowa's tax form gives a $40 credit per person. I gave a single parent one credit; Iowa gives
them **two** — the instructions say so in a sentence I had not read closely enough. It is
$40 of tax per single-parent return. The deliberate-error audit cannot see that figure at
all: it works by halving and doubling numbers, and it does not treat small whole numbers
like 40 as parameters. The comparison against the other model flagged it immediately —
**six Iowa households, every single one wrong by exactly $40.00** — and PolicyEngine's own
code even names the rule.

> Two instruments is not redundancy. The parameter one of them cannot see is where the
> defect was.

**So I spent the rest of the day measuring the gap rather than describing it**, which is
something this repository has owed its own quality claim for four days. The answer, and it
is now checked on every push:

| | figures |
| --- | ---: |
| numeric figures the package ships | 4,913 |
| the deliberate-error audit can test | 4,043 — **82.3%** |
| it cannot test | 870 |
| …of which are "infinity" placeholders that no document states | 277 |
| **leaving real parameters it cannot test** | **593 — 12.1%** |

(And the audit itself came back **1,654 wrong parameters tried, 1,648 caught, 99.6%** — up
from 1,640 because Iowa added 14, every one of them caught. The six it misses have now been
the same six, on the same six lines, for **thirteen days**, through six new states.)

**And three of those are more alarming than Iowa's $40.** New York's household credit is
$75/$60/$50/$45 — **88 figures, every one a dollar amount under $100, none of them
testable this way.** Ohio charges a flat $2,394.32 on entering a tax band, and the audit
cannot touch it **because it has cents**. South Carolina's earned income credit is 125% of
the federal one, and the audit only perturbs rates below 100%.

None of that is a defect. It is the honest footnote to "99.6%", and the check that now runs
on every push does not pin the numbers — it fails when somebody ships a parameter in one of
these classes **without writing down what it is**, which is precisely how the $40 got in.

I mention it because "99.6%" is the number anybody evaluating this would look at, and the
honest statement is that it measures the parameters the harness can perturb. Of the 25
parameters Iowa declares, **it can see 14.** The eleven it cannot are the $40 and $20
credits and the three age limits — and the two biggest numbers on an Iowa return are
invisible for reasons of their own: the standard deduction, because it is federal and so
not an Iowa parameter at all, and the retirement exclusion's ceiling, because there isn't
one.

**E. AND ONE THING I FOUND WRONG IN MY OWN PUBLISHED DOCUMENTATION, WHICH I THINK IS THE
MOST USEFUL ITEM HERE.** The front page of the `us-state-tax` README — the first paragraph
anybody reads — said *"New in 0.54.0: NORTH DAKOTA"*. North Dakota was released in 0.53.0.
Yesterday's release was **Oklahoma**, and the word "Oklahoma" appeared **nowhere in that
README at all**, despite being the entire release and carrying the best finding this project
has produced.

What happened is that yesterday's version bump was a find-and-replace of "0.53.0" with
"0.54.0", which renamed the *previous* release's paragraph instead of adding a new one. Every
one of the forty automated checks on that file passed, because every number in it was still
correct. The document was simply about the wrong thing.

It is fixed — North Dakota has its number back, Oklahoma has the paragraph it never got, and
Iowa has today's — and there is now a check that compares each release paragraph against a
declared list of what each release was *about*, so a renumbering fails instead of passing.
**Nothing here needs anything from you; I record it because "all the numbers are right" and
"the document is correct" turned out to be different claims, and a buyer reads the front
page.**

**Nothing in A to E needs anything from you.**

---

**As of Day 62 the four asks were unchanged and none of them blocked anything.** Three are
small and cosmetic — the repository description and topics, the GitHub Pages switch, the
optional npm publish — and the fourth is the one that would change what I can build: the
network policy. Day 61's entry below has the exact hosts and the exact settings page, and
today added one fact to it: **`WebFetch` is not a way round it either.** That tool reads a
URL and summarises it, which looks like it happens on a server; it does not. It resolves DNS
in this container, so it fails with `ENOTFOUND` on the same hosts `curl` fails on. I tested
it on the Oklahoma Tax Commission's own Form 511 packet. Server-side SEARCH still works, and
that is the whole of the route.

`us-state-tax` is now **v0.54.0** and `us-tax-mcp` **v0.58.0**; `us-federal-tax` stays at
**v0.16.0**. **1,593 tests** across the four suites, all passing, up 16. **29 taxing states
and 38 in all**, up one; thirteen jurisdictions left.

**OKLAHOMA IS IN, AND IT BROUGHT THE MOST USEFUL THING I HAVE FOUND FOR EXPLAINING WHAT THIS
PACKAGE IS FOR.** If you only read one item in this file, read A.

**A. OKLAHOMA'S EARNED INCOME CREDIT IS FIVE PER CENT OF A FEDERAL CREDIT FROZEN IN 2020,
AND THE MISTAKE GETS BIGGER EVERY YEAR.** The Oklahoma statute (68 O.S. § 2357.43) says the
state credit is 5% of the federal earned income credit — and then says *which* federal
credit: the one worked out under federal law **as it stood on 31 December 2020.** The federal
credit goes up with inflation every year. Oklahoma's starting point is a date in the past.

So anybody who implements "5% of the federal earned income credit" — which is what the
sentence plainly says, and what I would have done without reading the rest of it — pays an
Oklahoma family too much:

| children | Oklahoma owes | "5% of the federal credit" gives (2025) | and in 2026 |
| --- | --- | --- | --- |
| one | $179.20 | $216.40 | $221.35 |
| three or more | $333.00 | $402.30 | $411.55 |

That is **20.8% too much in 2025 and 23.6% too much in 2026**, and the gap widens every
single year without anybody changing a line of code, because one side of the comparison is
indexed and the other is a date. This is a **refundable** credit, so it is money going to the
households the credit exists for, and getting it wrong is a wrong refund rather than a wrong
bill.

**What I did about it is the part I would want you to see.** Writing the rule would have been
two lines and it would have fitted the package's existing machinery exactly. I did not write
it. Oklahoma ships with **no** earned income credit at all, an Oklahoma answer from this
package is too high by at most the whole $333.00, and the note on the result says so with the
table above in it. A check that runs on every push compares the frozen 2020 figures against
the real federal ones in the other half of this repository and **fails if the gap ever stops
growing** — which would mean either Congress cut the credit or Oklahoma amended the statute,
and both are things somebody would want to know.

And then something happened that I did not expect: **an independent model confirmed the
frozen figure to the cent.** PolicyEngine-US — a microsimulation model maintained by people
who have nothing to do with this project — gives one Oklahoma household in my comparison grid
a refund of $259.20, which is $179.20 of earned income credit plus $80.00 of sales tax
credit. $179.20 is exactly 5% of $3,584, the one-child federal maximum **for 2020**. It is
the same $259.20 in 2026, where 5% of that year's credit would be $221.35. A second group of
people read the same statute and got the same frozen number, and proved it was frozen by not
moving.

**B. THE SECOND FINDING IS BIGGER IN DOLLARS AND SIMPLER TO STATE: OKLAHOMA'S STANDARD
DEDUCTION HAS NOT MOVED SINCE 2017.** It is $6,350 for a single filer, $12,700 for a married
couple and $9,350 for a head of household. Those are the **federal** amounts from 2017 —
Oklahoma decided not to follow when the 2017 federal tax act nearly doubled them, and has
never adjusted them for inflation since.

The federal single-filer deduction is $15,750 for 2025 and $16,100 for 2026. So a published
tax guide that says "Oklahoma uses the federal standard deduction" — and at least one does,
printing those exact federal numbers — understates an Oklahoma filer's tax by **$446.50 for
2025 and $438.75 for 2026.** Yesterday's headline finding was worth 49 cents. This one is
worth nine hundred times that, and it is the same mistake: assuming a state figure still
tracks a federal one it used to track.

**C. AND THE STATE'S OWN 2026 RATE TABLE HAS FOUR ROWS WHERE EVERY SUMMARY OF THE LAW SAYS
THREE.** House Bill 2764, signed in 2025, is described everywhere — including by the Oklahoma
Senate's own press release — as cutting the top rate from 4.75% to 4.5% and "consolidating
six income tax brackets into three". Both halves are true. The published table has four rows,
and the fourth is a **0% band**: a single filer's first $3,750 of Oklahoma taxable income is
untaxed, and a married couple's or single parent's first $7,500. In 2025 that same $3,750
cost $35.63.

"Three brackets" counts the rows that charge something. A filer reads the row that charges
nothing. Anybody building from the press release puts 2.5% on the first dollar.

**D. TWO SMALLER THINGS THAT ARE WORTH KNOWING IF YOU EVER LIVE THERE.** Oklahoma's $10,000
retirement income exclusion has **no age test** — several published guides say it is for
retirees 65 and older and one says it is $25,000; it is $10,000, per person, and a 45-year-old
with a pension gets it. And military retired pay is **100% exempt and does not use up that
$10,000**, so a retired service member with a military pension and an IRA gets both, which is
worth $475 a year and is the opposite of how South Carolina does it.

**E. A SINGLE PARENT IN OKLAHOMA FILES ON THE MARRIED-COUPLE RATE TABLE.** The statute puts
joint filers, surviving spouses and heads of household in one subsection, so a single parent
gets the wide brackets — and then gets a smaller standard deduction ($9,350 against $12,700)
and a lower income limit for the age-65 exemption ($19,000 against $25,000). Three tables,
and that filing status is treated differently on each one. A model that decides what a head of
household is once, at the top, gets two of the three wrong.

**F. AND THE QUALITY NUMBERS HELD WHILE ALL OF THAT MOVED.** The deliberate-error audit is
**1,640 wrong parameters, 1,634 caught, 99.6%** — up from 1,585 because Oklahoma added 55
parameters, every one of which was caught. The six it misses have been the same six, on the
same six lines, for twelve days now, through five new states. That is the number I would put
in front of a buyer rather than the test count: 1,593 tests is a number I chose, and 99.6% is
a number the code had to earn.

One honest caveat I would rather you heard from me: **the audit cannot see a parameter whose
value is zero.** It tests each number by halving and doubling it, and zero has no half and no
double — so Oklahoma's 0% band, which is the single most important number in the state, is
checked by hand-written tests and not by the audit. The same is true of the zero brackets in
North Dakota, Mississippi and Idaho. The score is real; it does not cover that, and the
repository now says so in the place the score is published.

**Nothing in A to F needs anything from you.** They are the kind of thing I would want in
front of me if somebody asked what this repository is worth.

**As of Day 61 there is a FOURTH ask, and it is the first one on this list that would
change what I can build rather than who can see it.** The other three are unchanged and
none of them blocks anything: the repository description and topics, the GitHub Pages
switch, and the optional npm publish. Today's headline is that NORTH DAKOTA IS IN, taking
the package to 28 of the 42 jurisdictions that tax income, and that it brought a result
I have not been able to produce before: **a published government rate schedule that this
package can PROVE it cannot derive.**

**THE NEW ASK: LET THIS CONTAINER REACH STATE REVENUE AND LEGISLATURE WEBSITES.** Every
primary source today was refused — `tax.nd.gov`, `ndlegis.gov`, `law.justia.com`,
`codes.findlaw.com`, `law.cornell.edu`, and a mirror of the state's own forms at
`taxsim.nber.org`. This is the thirteenth consecutive run to record a blocked primary
source, and the first on which I established WHY: the network policy is an **allowlist**
and the only things on it are package registries (npm, PyPI, crates.io, the Go proxy) and
Anthropic's own API. It is not a per-site block I keep unluckily hitting; it is a short
list that no tax authority is on.

What it costs, concretely, is the strength of every figure I ship. North Dakota's 2026
rate schedule is in a form the Tax Commissioner publishes, Form ND-1ES — I know the URL,
I quote it in the citation, and I could not open it. What I shipped instead is three
independent second-hand readings that agree figure for figure, against two more that
disagree, plus an arithmetic cross-check. That is a good workaround and it is not the
document. Nine of the last ten states went in the same way.

**What to change:** the environment's **Network access** setting, in the cloud
environment menu in this session's title bar, then Edit. Either a broader access level,
or `tax.nd.gov`, `ndlegis.gov`, `law.justia.com`, `www.law.cornell.edu` and
`taxsim.nber.org` added under **Allowed domains** with the "Allow package managers" box
left ticked — the package registries are what the differential harness and the
PolicyEngine cross-check run on, so they have to stay. The steps are at
https://code.claude.com/docs/en/cloud-environments#network-access. It is read-only access
to public government websites; nothing I do with it writes anywhere.

Adding the whole of `*.gov` would cover almost every state at once. If that is too
broad, the five hosts above plus `*.state.??.us` would cover most of what the next ten
states need.

`us-state-tax` is now **v0.53.0** and `us-tax-mcp` **v0.57.0** — both released today;
`us-federal-tax` stays at **v0.16.0** because nothing federal changed. **1,577 tests**
across the four suites, all passing, up 19. **28 taxing states and 37 in all**, up one;
fourteen jurisdictions left.

**A. WHAT NORTH DAKOTA IS, IN ONE PARAGRAPH.** Three tax bands — **0%, 1.95% and 2.50%** —
and the first one is the half that decides most returns: a single filer's first $48,475 of
2025 taxable income is untaxed, a married couple's first $80,975. The top rate of 2.50%
ties Arizona's for the lowest in the country. It starts from your federal **taxable**
income rather than your adjusted gross income, which means your federal standard deduction
is already spent before North Dakota looks at anything, and the state adds no deduction and
no exemptions of its own. A dependent is worth nothing on a North Dakota return and so is
a sixty-fifth birthday.

**B. THE FINDING I AM MOST PLEASED WITH: THE STATE'S OWN 2026 TABLE CANNOT BE WORKED OUT
FROM ITS 2025 ONE.** North Dakota's eight thresholds (four filing statuses, two bands each)
go up with inflation every year, by the federal inflation factor, so the obvious way to
check a published table is to ask whether one multiplier produces it. **No multiplier
does** — not from 2025, not from 2024, not from the original 2023 figures, under any
rounding to $25 or $50 in any direction. I tried all eighteen combinations and the test
suite runs that search on every push rather than just asserting the conclusion.

Two things get in the way and both are worth knowing. The married-filing-separately column
is not independently adjusted at all: it is exactly the joint figure halved and rounded
down to $25, in all four published years. And the two head-of-household figures are each
exactly **$25 below** what the multiplier that fits the single and joint columns would give.

The practical meaning: **anybody who projects North Dakota's brackets instead of reading
them will be wrong**, by $25 of untaxed income and 49 cents of tax, on the filing status a
single parent uses. Small, systematic, and invisible to anything that does not compare
against the state's own table. So this package stores all eight published figures a year
and works out none of them.

**C. AND A THREE-YEAR COINCIDENCE THAT BROKE BECAUSE OF A FEDERAL LAW.** North Dakota's 0%
band for a single filer topped out at $44,725 in 2023, $47,150 in 2024 and $48,475 in
2025 — which are, to the dollar, the top of the **federal 12% bracket** in those three
years, because the state took the federal 2023 figure as its starting point and indexes it
the same way. For 2026 North Dakota's is $49,575 and the federal one is $50,400.

The reason is a federal act that says nothing about North Dakota: the One Big Beautiful
Bill Act gave the federal 10% and 12% brackets — and no others — an extra year of inflation
adjustment from 2026. **A model that learned the equality from three years of data is wrong
in the fourth**, by $825 of untaxed income and $16.09 of tax. This repository holds both the
federal and the state engine, so it can check both halves of that on every push; anybody
holding one of them cannot.

**D. ONE FORTY PERCENT, TWO DIFFERENT THINGS, AND THE SECOND NEEDED A NEW INPUT.** North
Dakota takes 40% off a long-term capital gain and 40% off **qualified dividends**. Those
look like one rule and are two, because a qualified dividend is ordinary income on a federal
return and is nowhere inside the capital-gains line — so a filer with dividends and no gains
gets a subtraction that no amount of arithmetic on the capital-gains figures can produce.
The package has a new input, `qualifiedDividends`, for exactly that. **It is Form 1040 line
3a, not line 3b**, and the larger figure is the wrong one: a 1099-DIV numbers the two the
opposite way round from the tax return.

**E. NORTH DAKOTA CHARGES A RETIRED COUPLE ON $100,000 NOTHING, AND NOT FOR THE REASON
PEOPLE SAY.** It is grouped with the retiree-friendly states, and for a retired civil
servant it is an ordinary taxing state: a government pension, a 401(k) draw and an IRA
distribution are all taxed in full. Only two things come out — Social Security, in full and
with no income test, and military retired pay, in full and at any age. The calculator page's
couple at 70 with $40,000 of Social Security and $60,000 of pension still pays **$0**, and
the reason is the shape of the brackets rather than any retirement provision: the federal
deduction is already spent, the benefit comes back out, and what is left is far inside an
$82,800 zero band.

**F. A WORD THIS PACKAGE USES, AND WHAT THE COMPILER TAUGHT ME ABOUT IT TODAY.** Each
state-year here is marked `published` or `provisional`. North Dakota's 2026 schedule
exists — the Tax Commissioner publishes it on Form ND-1ES — and I could not open the form.
My first instinct was to mark the year `provisional` and invent a reason called "primary
source unread". **The compiler refused the word, and it was right to.** Every existing
reason is a statement about the STATE: the figure is not out yet, the law cannot settle it
until the year ends, it was computed under a known bound. "I could not open the document"
is a statement about this container, and it belongs in the citation, which now says NOT
OPENED FROM THIS SANDBOX in those words. `provisional` is a claim about the publisher, not
about the reader.

**G. FIVE LISTS IN THIS REPOSITORY WENT STALE ON ONE NEW STATE, AND THE WORST ONE WENT
STALE SILENTLY.** Adding a state is also a test of this repository's own paperwork, and
today it found five hand-written lists that needed editing: two in the MCP server's
argument gates, one in the cross-package check that verifies the OBBBA table, one in the
package README's list of states cheaper than New York City — which Louisiana had already
made wrong yesterday, in the same release whose headline was that prose copies of a list
go stale — and one in the differential harness that compares every figure against
PolicyEngine.

**The last one is the one worth your attention, because it fails differently.** Every other
stale list announces itself: it refuses an input, or prints a wrong number, and something
notices. The differential's list of states just **stops asking** — North Dakota would
simply not have been compared against the reference model at all, with no error anywhere
and a grid the same size it was yesterday. I found it because I checked the case count
before trusting it. Three of the five lists are now derived from the engine rather than
written by hand, including that one.

**H. THE QUALITY NUMBERS.** 1,577 tests across the four suites, all green. The check that
changes one number at a time in the shipped code and requires some test to notice was
re-run over the state package because its code changed: **1,585 changes tried, 1,579
caught, 6 not, 99.6%** — and all 26 of North Dakota's were caught. The six that are not
caught have been **the same six, at the same six lines, for eleven days**, through four new
states and three new tools, which is worth more than the percentage: a score that holds
while the thing underneath it changes is a different claim from one that holds because
nothing moved. Every figure was written down before it ran, including the one that would have
appeared if the measuring tool were broken in the way it was broken on Day 56. The federal
package was not touched and its fingerprints are identical to yesterday's, so its
716-out-of-716 record still covers exactly what ships.

**I. ONE THING I BROKE AND CAUGHT.** While updating the package README's counts I ran a
find-and-replace driven by a failing test's expected number, over a 140,000-character
file, and it corrupted **thirteen unrelated figures** — a Missouri comparison, a Wisconsin
threshold, a Maryland table, a Virginia worked example. Nothing in the test suite would
have caught most of them, because they are prose. I found it by reading the diff before
committing, threw the whole edit away and redid it by naming each sentence. Worth telling
you because the repository's own rule is that a diff nobody reads is a diff nobody checks,
and this is the first time that rule has saved something large.

---

**As of Day 60 nothing was waiting on you except the three standing asks below — the
repository description and topics, the GitHub Pages switch, and the optional npm publish —
and today's headline is that LOUISIANA IS IN, which takes the package to 27 of the 42
jurisdictions that tax income, and that the reason I added a state today is that MY OWN
LIST OF NEXT JOBS HAD SEVEN ITEMS ON IT AND NOT ONE OF THEM MADE THE PACKAGE COVER MORE
STATES.**

`us-state-tax` is now **v0.52.0** and `us-tax-mcp` **v0.56.0** — both released today;
`us-federal-tax` stays at **v0.16.0** because nothing federal changed. **1,558 tests** across
the four suites, all passing, up 17. **27 taxing states and 36 in all**, up one; fifteen
jurisdictions left.

**A. WHY A STATE, AND WHY TODAY.** Each of these runs leaves a list of next jobs for the
next run. This morning's list had seven things on it: five were improvements to the tools I
use to check my own work, and two were open questions about particular states' 2025 rules.
Every one of them was worth doing. **But the package had covered 26 of the 42 taxing
jurisdictions for eleven days, and nothing on that list would ever have changed it.** The
tools suggest more tools; that supply never runs out; and meanwhile the first question
anybody evaluating this would ask — *do you do all the states?* — had the same answer it had
eleven days ago. So today went on coverage, and tomorrow's list starts with another state.

**B. WHAT LOUISIANA ACTUALLY DID IN 2025, WHICH IS NOT WHAT IS REPORTED.** Every summary
says Louisiana replaced its graduated tax with a flat 3% for 2025. True, and it is the less
important half. **The same act abolished every exemption the state had** — the $4,500
personal exemption ($9,000 joint), the $1,000 per dependent, the $1,000 for a filer aged 65
or over and the $1,000 for a blind filer — and put a standard deduction of $12,500
($25,000 joint) where they used to be. So a 2025 Louisiana return gives you **nothing at all
for a dependent**, and nothing for being 65 or blind. Any table still printing Louisiana's
$4,500 personal exemption is describing law that was repealed before the tax year started.

**C. AND A LOUISIANA HEAD OF HOUSEHOLD GETS THE WHOLE JOINT DEDUCTION, WHICH IS UNUSUAL.**
Most states give a single parent about one and a half times what they give a single person.
Louisiana's statute does not print a figure for a single parent at all — it says the joint,
single-parent and widowed amounts are **200% of the single amount**. Guess 1.5× instead and
you give a Louisiana single parent $18,750 where the law gives $25,000, and overstate their
tax by **$187.50**. The package stores one figure a year and doubles it, because doubling is
what the statute says.

**D. THE THING WORTH YOUR ATTENTION: LOUISIANA PUBLISHES TWO DIFFERENT 2026 STANDARD
DEDUCTIONS AND BOTH ARE CORRECT.** The figure your **tax return** uses is $12,838. The
figure the state's own **payroll withholding tables** use is $12,875. Both come from the
same law, which says the amount goes up by "the percentage increase in the Consumer Price
Index" — and both are honest, because they are measured over different twelve-month windows.

The return uses the 2.7% rise in the year to **December** 2025. A withholding table has to
exist before the year it withholds for, and on 1 December 2025 the December figure did not
exist yet; the most recent one that did was **September's**, 3.0%. And the reason September
was the most recent is worth knowing: **there is no October 2025 inflation figure at all,
because the government shutdown stopped the Bureau of Labor Statistics collecting prices
that month.**

The practical size is small — $37 of deduction, so about $1.11 of tax for a single filer. The
practical point is not: anyone building payroll software who tries to reconcile what was
withheld against what is owed in Louisiana will find a dollar or two per person that is not a
mistake in either system, and will spend a day looking for it. This package now says so, with
both figures and both windows, in the result you get back. **Nobody else does, because the
two numbers live in two different documents.**

**E. AND A FOURTH VERSION OF THE SAME NUMBER COMES FROM COMPUTERS RATHER THAN FROM LAW — MY
OWN TEST CAUGHT IT BY FAILING.** The 2026 figure is the 2025 one times 1.027. Written that
way in any programming language, the answer comes out $12,837 and not $12,838, because
computers cannot represent 1.027 exactly and `12,500 × 1.027` lands at 12837.4999999 instead
of exactly 12837.50 — and 12837.50 is precisely the point where rounding goes up rather than
down. **Of the three Louisiana figures for 2026, this is the only one sitting exactly on that
knife-edge, and so the only one where it matters.** I wrote the test the natural way first, it
disagreed with the published figure, and for a minute I thought the published figure was
wrong. The test now does the arithmetic the exact way and also records the wrong answer *as*
the wrong answer, so nobody re-derives it by accident. There are now **five** defensible
values for that one number and only one of them is the one a return is filed on.

**F. I BROKE THE NEW STATE SIXTEEN DIFFERENT WAYS ON PURPOSE AND EVERY ONE WAS CAUGHT.** That
is better than last time, when two of five sabotages went unnoticed — and the honest reason
is not that the tests got better overnight. Yesterday's changes were speed improvements that
*cannot* change an answer, so no test of the answers could ever see them being undone.
Today's were all actual numbers, and a number is the one thing a test case notices. Worth
being clear about, because "16 out of 16" invites the wrong conclusion.

**G. BUT TWO OF LOUISIANA'S RULES ARE INVISIBLE TO MY MAIN QUALITY CHECK, AND THEY ARE THE
TWO MOST DISTINCTIVE ONES.** The check that changes one number at a time in the shipped code
deliberately skips small numbers — otherwise it would spend hours changing array positions
and loop counters. Louisiana's "200% of the single amount" and its "aged 65 or over" are both
small numbers. **So the three-hour check that produces this project's headline quality score
cannot see either of them going wrong.** Both are covered, but only because the sixteen
sabotages went looking rather than reading the check's own list — and one of the two is caught
by exactly one test, which is thin. Measuring that blind spot properly, for every state, is
the second thing on tomorrow's list.

**H. TWO MISTAKES IN THIS PROJECT'S OWN PAPERWORK, FOUND BY ADDING THE STATE.** The package's
README, in a section listing what it does *not* cover, named Minnesota, Wisconsin and South
Carolina — all three of which it has covered for weeks — and said "only 32 states" when it
had 36. The sentence directly after it explains, correctly, why a hand-written list of gaps
cannot be trusted and why the error message is built from a declared list instead. **The
identical mistake had been sitting four lines below its own explanation for eleven releases**,
because the check was pointed at the error message and not at the README. It is now checked
both ways. And separately, the MCP server refused two inputs that genuinely change Louisiana's
tax, telling the caller they did not apply — which is worse than ignoring them, because the
caller stops looking. That one was caught automatically by a test written in September for
exactly this, on the first new state since.

**I. THE CROSS-CHECK AGAINST THE BIG RESEARCH MODEL, AND A FREE RESULT.** Every figure is
compared against PolicyEngine-US, a funded fifty-state model, over 2,376 households — up from
2,288 with Louisiana's added. Louisiana produced five small disagreements and all five are
explained to the cent by two numbers where their copy is older than mine; their own current
release agrees with me on both. I also re-ran the other 2,288 households rather than only the
new ones, and **every single one came back identical** — which nothing had ever checked
before. The pinned version was a promise until today and is now a measurement.

**J. AND THE QUALITY NUMBERS HELD, EXACTLY WHERE I SAID THEY WOULD.** The check that changes
one number at a time in the shipped code and requires some test to notice, re-run over the
state package today because its code changed: **1,559 changes tried, 1,553 caught, 6 not,
99.6%** — the same six as the last ten days, at the same lines, and all sixteen of
Louisiana's new ones caught. Every figure was written down before the three-hour run started,
including the number that would have appeared if the measuring tool were broken in the way it
was broken on Day 56 (it would have been about 1,300 higher). The federal package was not
touched, and its fingerprints are identical to yesterday's, so its 716-out-of-716 record
still covers exactly what ships.

**One correction I made to my own figure rather than leaving it.** I measured the audit's
speed eighteen minutes in, wrote down that it was 1.62 times slower per change than
yesterday's and would take 188 minutes, and committed that. It took **149 minutes** and is
1.29 times slower. Eighteen minutes of a three-hour run is still the warm-up, and it felt
long enough not to be. The underlying point survives and is worth your knowing if the plan
is more states: **each state makes this check slower for every other state too**, because it
re-runs the whole test suite once per change and the suite walks every state. It is
manageable for a few more and worth re-measuring rather than projecting.

**K. NOTHING NEW IS WAITING ON YOU.** The same three things as every day, and none of them
blocks anything: the repository has no description and no topics (two minutes in the
repository settings), GitHub Pages is still switched off so the calculator page is built and
tested on every push but not served, and the npm publish remains optional — all three
packages install from a public URL today with no account and no token.

---

**Day 59's headline, kept for the record: MISSPELLING ONE FIELD NAME USED TO COST A
MILLISECOND.** The full entry follows.

**As of Day 59 nothing is waiting on you except the three standing asks below — the
repository description and topics, the GitHub Pages switch, and the optional npm publish —
and today's headline is that MISSPELLING ONE FIELD NAME USED TO COST A MILLISECOND AND NOW
COSTS THIRTY MICROSECONDS, and that my own plan for fixing it had the two halves the wrong
way round.**

`us-state-tax` is now **v0.51.0**, `us-federal-tax` **v0.16.0** and `us-tax-mcp` **v0.55.0**
— **all three released today**, which is unusual and deliberate: see point E. **1,541 tests**
across the four suites, all passing, up 15. No state figure moved; 26 taxing states and 35 in
all, unchanged.

**A. WHAT WAS WRONG.** If you hand either package a field name with a typo in it, it tries to
guess what you meant — `subtractions` for `subtractons` — and tells you in the result. That
guess was costing **about a millisecond for a single misspelled key, roughly two hundred
times what computing a whole state tax return costs.** Nothing was wrong with the answers,
and nobody had reported it; it only costs you anything on a call that already contains a
mistake. I found it yesterday by accident, chasing a benchmark that was measuring the wrong
thing.

**B. WHAT FIXED IT, AND THE PART WHERE I WAS WRONG.** Two changes. The first: the guess
compares your typo against every field name using an algorithm that counts how many
single-letter edits apart two words are, and **you can never get from a 6-letter word to a
20-letter word in two edits** — each edit changes the length by at most one. So most of the
field names can be skipped without looking at them, and skipping them cannot change the
answer, because they were never going to be close enough. The second: that algorithm builds a
scratch table, and it was building the whole table to read one corner of it.

Yesterday I wrote the plan down as "the first change is the fix, and here is a second small
one for what's left". **Measured separately, the second one is the bigger of the two in
`us-state-tax` and the smaller in `us-federal-tax` — from the same source file.** Which half
matters depends on how long your field names happen to be, so neither is "the fix". Together
they are 36 times faster.

**C. THE ANSWERS DO NOT CHANGE, AND THAT IS NOT A PROMISE, IT IS A TEST.** Both changes are
only worth making if they cannot alter a single suggestion. So there is now a test that takes
**every field name in both packages, makes every possible one-letter typo in it — deletions,
insertions, substitutions, swapped pairs, 20,596 keys in all — and requires the fast version
and a deliberately slow, obviously-correct version to give the same answer for every one of
them.** They do.

**D. AND THE THING WORTH YOUR ATTENTION: TWO OF MY FIVE SABOTAGE TESTS CHANGED NOTHING.** I
always break my own work on purpose to see whether the tests notice. I broke this five ways.
Three were caught. **The other two — deleting the skip-most-of-the-names rule entirely, and
putting the slow table-building back — produced identical answers to all 20,596 keys.** Of
course they did: the whole point of both changes is that they are invisible. They just make
the thing a thousand times slower again.

That is a category of mistake that no amount of testing the *behaviour* can ever find, and it
is worth knowing about: a future version of me could quietly undo this afternoon's work and
every test here would still pass. So there is now an assertion that reads the **compiled
output** and requires both changes to still be present in it. The two sabotage runs are what
earned it its place, rather than me arguing it was a good idea.

**E. WHY ALL THREE PACKAGES GOT A NEW VERSION, WHICH I NORMALLY AVOID.** My own rule is that
the version only moves when something you pass in or read out changes shape, and nothing did.
But people install these from a release file at a URL with the version number in it, and a
new release only gets built when the version changes. **A 36x speedup that only reaches
someone who builds from source has not actually shipped.** So all three moved — the MCP
server too, because it copies both engines in when it builds.

**F. AND I WROTE DOWN A SENTENCE THAT NOTHING COULD DISAGREE WITH.** One of the comments I
wrote today explains that the length comparison has to be done on the lower-cased words,
because converting to lower case can change a word's length. Then I broke it on purpose and
**not one answer changed in either package.** The reason is genuinely interesting: in the
whole of Unicode there is **exactly one character whose lower-case form is a different
length** — the Turkish capital İ, which becomes an `i` plus a separate dot — and it can never
line up against plain English field names. The sentence is true, but only reachable if *you*
supply your own list of field names, which this function does let you do. So I narrowed the
claim to say that, and wrote a test that reaches it. **Leaving a true-but-uncheckable sentence
in place is the thing I am trying hardest not to do.**

**G. TWO TEST COUNTS WERE WRITTEN DOWN ONE SHORT.** I counted the tests, then added one more
test to each package, then nearly published the earlier count. The counting tool caught it
because I ran it after the last change instead of before. That is the fourth day in a row
that this particular ordering mistake has shown up, and the fourth day it cost nothing
because the tool runs last. It is worth saying that the fix is the order, not me being more
careful.

**H. AND THE QUALITY NUMBERS HELD, EXACTLY WHERE I SAID THEY WOULD.** The check that
changes one number in the shipped code at a time and requires some test to notice, run over
both packages today: **1,543 changes tried in the state package, 1,537 caught, 6 not,
99.6%** — the same six as the last nine days, at the same lines — and **716 tried in the
federal one, all 716 caught, 100%**. Before starting I wrote down both counts, *and* wrote
down the two numbers in today's new writing that would have moved them if the measuring tool
were broken in the way it was broken on Day 56. Neither moved, which rules that out. Both
records carry fingerprints of exactly the code and tests they measured, and the build check
agrees they match what ships.

One thing I learned by running both on the same day, which is useful rather than
interesting: **the federal check takes 5 minutes and the state one takes 115.** I had been
treating re-running the federal one as a real cost — it is 4% of the other. Its record had
been sitting twelve days old for no good reason, and from now on it can simply be re-run any
day that code changes.

**I. NOTHING NEW IS WAITING ON YOU.** The same three things as every day, and none of them
blocks anything: the repository has no description and no topics (two minutes in the
repository settings), GitHub Pages is still switched off so the calculator page is built and
tested on every push but not served, and the npm publish remains optional — all three
packages install from a public URL today with no account and no token.

---

**Day 58's headline, kept for the record: A PRICE I PUBLISHED WAS MEASURED CORRECTLY AND
BLAMED ON THE WRONG THING, which I found by trying to reproduce my own number.**

`us-federal-tax` was v0.15.0 (unchanged), `us-state-tax` **v0.50.0** and `us-tax-mcp`
**v0.54.0** — no version moved today, because nothing a caller passes or reads changed
shape. **1,526 tests**, all passing, up 10. No state figure moved; 26 taxing states and 35
in all, unchanged.

**A. WHAT I SET OUT TO DO.** This package has a feature that tells you when you handed it a
number it had no use for — Pennsylvania's taxable income on a Texas return, say. It works by
computing your whole return a second time without that number and checking nothing changed,
so it costs real time, and I published what it costs: *"34 microseconds for a bare return
plus about 76 for each field you supplied."* **Nothing anywhere checked that sentence**, and
unlike most of my claims it is the kind that drifts on its own — any change to the engine
moves it. So the job was to make it checkable.

**B. THE FIX IS TO STOP PUBLISHING TIME AND PUBLISH WORK INSTEAD.** A test that asserts "this
took 34 microseconds" fails on a faster machine, a slower machine, or a busy one. It is not
a test, it is a weather report. So the engine now hands you a counter if you ask for one, and
it counts the things that do not change between machines: **how many times it computed your
return, and how many times it took a snapshot to compare.** A bare return: 1 and 0. Three
numbers supplied: 4 and 4. That is now asserted for every state and every year, and it
cannot go stale, because the test checks *differences* — add one number, require the count to
go up by exactly one — rather than any total.

**C. AND THEN I TRIED TO REPRODUCE MY OWN FIGURE, WHICH IS WHERE THE DAY ACTUALLY WENT.**
Three things were wrong with that sentence.

It said *"each field you supplied"*, and the engine does not charge you for all of them — not
for the four that identify the return, and not for a `0`, which is you answering no. The same
sentence then says a bare return is free, and a bare return supplies four fields. It
contradicted itself and I did not notice for a day.

**It named the wrong cause.** I said the cost was computing your return again. Re-measured: a
charged field costs about 35 microseconds, of which computing the return again is **4.5** and
turning the answer into text to compare it is **19.5**. The expensive half had no explanation
published anywhere. The number was roughly right and the reason was mostly wrong, which is a
worse failure than being wrong about the number — somebody reading it would optimise the
wrong thing.

**And the "23.8 times slower" figure, which looked like the solid one, is the softest number
of the three.** On one machine, changing nothing but how long the benchmark warmed up first,
it reads anywhere from 24 to 74. The expensive case is steady to within 5%; only the cheap
case moves, and it is the one on the bottom of the fraction. A ratio feels portable and is
not.

**D. TWO OF MY OWN BENCHMARKS MEASURED THE WRONG THING, AND THE SECOND ONE NEARLY FOOLED ME.**
The first used six field names the engine does not have, so it was timing the typo-detector
rather than the feature. The second one, properly written but warmed up too briefly, came
back at **24.1 times** against my published **23.8** — and I very nearly wrote that down as
confirmation. It was the same mistake arriving at the same wrong answer by the same route.
**Agreement between a new measurement and an old one is first evidence that they share a
method, and only then evidence that the figure is right.**

**E. THE BROKEN BENCHMARK FOUND A REAL PROBLEM, AND THIS IS THE ONE WORTH YOUR ATTENTION.**
Chasing the nonsense number from the first benchmark found something nobody had asked about:
**if you misspell a field name, that one call costs about 1,152 microseconds — 232 times a
normal return.** The package is trying to guess what you meant, and it compares your typo
against all 54 field names using an algorithm that rebuilds a scratch table for each one.

Both packages have it, identically. In the federal one, three of five realistic typos
(`dependnts`, `capitlGains`, `qualifedDividends`) spend **600 to 1,056 microseconds and then
return no suggestion at all**. `itemisedDeductions` — the British spelling of a real field —
costs 1.1 milliseconds.

**Nothing is wrong with the answers** and nobody has reported it; it only costs you anything
on a call that already contains a mistake. I did not fix it today because the three-hour
quality audit was already running and the rule here is that code stops changing once it
starts. It is written up with a measured diagnosis and a fix whose correctness I can prove
rather than argue — the first thing on tomorrow's list.

**F. AND MY TEST WAS WRONG ABOUT THREE STATES BEFORE THE ENGINE WAS.** I asserted that a bare
Massachusetts, New Jersey or Pennsylvania return computes itself twice. It does not:
all three REFUSE to run without their own income figure, so the second attempt fails and the
counter shows it. **The comment explaining exactly that was in a file I had read an hour
earlier and quoted into the new one.** The engine was right; I was wrong. That is the fourth
day running where the thing that was wrong was my description of my own work rather than the
tax arithmetic, which is either reassuring or alarming depending on how you look at it.

**G. THE TOOL THAT MEASURES MY TEST QUALITY NOW HAS TESTS OF ITS OWN, after six days of me
writing "do this" and not doing it.** This project's main quality claim is a "mutation
score": change one number in the shipped code, check that some test notices, repeat 1,543
times. On Day 56 that tool turned out to have been skipping real code, and the only reason I
caught it was that I had written down the expected number first and it came back one short.

The tool had never had a single test. The reason, found today, is almost funny: **the tool is
a script, so merely loading it into a test would start a three-hour audit.** Nothing was
blocking the tests but that. Split the measuring part into its own file and the tests write
themselves — there are now 15, including three that reproduce the Day 56 bug specifically.

**And one of those three originally passed against the bug it was named after**, because I
invented an example rather than checking which examples actually trigger it. A test that
passes against the thing it is testing for is worse than no test, because it reads as
reassurance. I measured three candidate examples against the broken tool side by side and
kept the one that fails.

**H. AND I CAUGHT MYSELF OVER-CORRECTING AN EARLIER CORRECTION.** A note in that same tool
said, since Day 42, that re-wording any comment invalidates a recorded quality score — so
all writing has to finish before the three-hour measurement starts. That note was itself a
correction of an earlier note that had claimed the opposite.

**Both are wrong.** Measured today, by changing one comment at a time: a comment attached to
a *type definition* vanishes when the code is compiled, so it cannot affect anything; a
comment attached to *running code* does. The real rule is the combination of the two claims,
and neither version had it. Today that let me fix two sentences of my own documentation
while the measurement was already running, at no cost — checked two different ways
afterwards rather than assumed.

There is a general lesson in it that I think is worth your time: **a wrong statement that
arrives labelled as a correction is harder to doubt than the original error.** It has already
been argued once, so it reads as settled. Three of the four things I got wrong today were
corrections or descriptions of my own work, not tax law.

**I. AND THE QUALITY NUMBER HELD, EXACTLY WHERE I SAID IT WOULD.** The check that changes one
number in the shipped code at a time and requires some test to notice: **1,543 changes tried,
1,537 caught, 6 not, 99.6%** — the same six as the last eight days, at the same lines. Before
starting I wrote down that the count would not move, *and* wrote down the one number in the
day's new writing that would have moved it if the tool were still broken. It came back 1,543,
which rules that out. The run took 133 minutes.

The record now also carries the fingerprints of exactly the code and tests it measured, and
the build check agrees they match what ships — so the 99.6% on the front page is a
measurement of today's package rather than a number inherited from an earlier one.

**J. NOTHING NEW IS WAITING ON YOU.** The same three things as every day, and none of them
blocks anything: the repository has no description and no topics (two minutes in the
repository settings), GitHub Pages is still switched off so the calculator page is built and
tested on every push but not served, and the npm publish remains optional — all three
packages install from a public URL today with no account and no token.

---

**Day 57's headline, kept for the record: I BUILT A BETTER FEATURE, MEASURED IT, AND DELETED
IT, because the measurement showed it would have told callers something false.**

`us-federal-tax` is v0.15.0 (unchanged), `us-state-tax` is **v0.50.0** and `us-tax-mcp`
**v0.54.0**. **1,516 tests**, all passing. No state was added; 26 taxing states and 35 in
all, unchanged.

**A. THE JOB, IN ONE SENTENCE.** If you hand this package a number it has no use for —
Pennsylvania's taxable income, say, on a Texas return — it used to accept it, throw it
away, and give you a confident answer that did not contain it. There is nothing to
notice: no error, no blank, every number in the answer agreeing with every other one.
There were **48 fields** that could do this and only four that said anything. Now every
one of them is reported.

**B. AND THE PART THAT IS ACTUALLY WORTH YOUR TIME, WHICH IS ABOUT WHAT I LET MYSELF
CLAIM.** The useful sentence to print is *"nothing in Texas reads this field"*. I built
that. The way to establish it is to try the field at many different values and see whether
any of them changes the answer — and over 35 states and two years, that test said **2,736
of 3,500 combinations were dead**, with seventeen fields apparently read by no state at
all.

One of the seventeen was `earnedIncome`. Ohio reads it: a Columbus resident earning
`$60,000` owes **`$1,499.97`** that a `$1` earner does not. My test could not see it,
because **Ohio only looks at earnings once you have also told it which city you live in**,
and a test that changes one thing at a time leaves everything else blank.

So I wrote a second test to find out how bad the first one was — and the second one made
the same mistake, in a way I would not have predicted: it threw away the cases where the
engine REFUSED to answer without the field, which is the strongest possible proof that the
field is being read. With that fixed, **8 of the 17 "dead" fields are alive.** Every time I
gave the instrument another dimension, more of its confident answers turned out to be
wrong.

**I deleted the stronger claim.** What ships says only what I can actually show: *"every
number in this answer is identical to the one you would have got without this field"* —
true, measured on your own return, re-measured on every call — and then says, in the same
sentence, why that is not the same as "nothing reads it". **A note that admits the limit of
its own method is the thing nobody else in this market ships**, and the reason it is worth
money is that a language model reading the answer repeats it.

**C. AND IT CAUGHT ME WRITING TOO CONFIDENTLY, WITHIN THE HOUR.** Explaining the design, I
wrote that a particular Pennsylvania field "changes no figure on any Pennsylvania return".
It is wrong by **`$1,842.00`** — under one condition I had not tested. I had made the
claim from a one-thing-at-a-time test and then written it down wider than the evidence,
which is precisely the mistake the whole day was about. Corrected, with the correction left
visible, and the `$1,842.00` case is now in the test suite so the sentence cannot drift
again.

**D. ONE HONEST COST, because you should not have to find it yourself.** Checking takes
real time: the engine computes your whole return once more for each number you gave it. A
bare return is unchanged at 34 microseconds; a return with ten numbers goes from 34 to 796
microseconds. That is still over a thousand full state returns a second, and it is **on by
default** — the person who needs the warning is the person who does not know to ask for it
— with a documented switch to turn it off for bulk work. Switched on everywhere it took my
own test suite from 18 seconds to **six minutes**; six internal sweeps that only look at
numbers now opt out, and the suite is back to 22 seconds.

**E. AND IT CAUGHT ME A SECOND TIME, ON THE DULLEST POSSIBLE THING.** Describing all of
the above I wrote that this engine's input has "56 fields, 52 of them optional". **It has
54 and 50.** I counted a list by eye, in a day where every other number came off a script,
and the wrong one went into two of the documents before anything looked at it. The whole
release is about not claiming more than you can show, and the only number in its paperwork
that nothing could check was the one that was wrong.

Fixed the way this repository fixes a count: one of the two copies is **deleted**, and the
survivor is now compared to the code on every push. Shown the wrong number it says *"the
root README says 56 and the code says 54"* and fails the build — and I checked that it
fails, because a check nobody has seen fail is not known to check anything.

**F. AND THE QUALITY NUMBER HELD, EXACTLY WHERE I SAID IT WOULD.** The check that changes
one number in the shipped code at a time and requires some test to notice: **1,543 changes
tried, 1,537 caught, 6 not, 99.6%** — the same six as the last seven days, at the same lines.
Before running it I wrote down that the count would not move and why, and it did not. That
took 3 hours of the machine's time, up from 90 minutes, because the new checking described
above roughly doubles how long the test suite takes — which is the honest price of it and is
written down next to the feature.

---

**Day 56's headline, kept for the record: I FOUND A DEFECT IN MY OWN QUALITY MEASUREMENT,
by predicting what it would say and being wrong by one.**

As of Day 56 it was: `us-federal-tax` v0.15.0, `us-state-tax` **v0.49.0**, `us-tax-mcp`
**v0.53.0**, **1,503 tests**, 26 taxing states and 35 in all.

**A. THE ONE THAT MATTERS, AND IT IS ABOUT TRUSTING THE NUMBERS I REPORT TO YOU.** This
project advertises a "mutation score": it changes one number in the shipped code at a time
and checks that some test fails. Yesterday's figure was 1,534 changes tried, 6 that no test
caught, 99.6%. Before re-running it today I wrote down what it would say — 1,534, unchanged,
because nothing I did today adds a number to the code. **It said 1,533.**

One missing. Chasing it found that the tool had been blanking out real code before it
measured: it has to ignore numbers that appear in comments and in printed text, and the way
it found those had no idea that a piece of text can have live code embedded in it. Worse,
**which code it blanked depended on the whole file**, so an edit in one function silently
stopped a number in a different function from ever being checked. That fails in the
flattering direction — a check that stops existing cannot fail — so the score goes UP while
the coverage goes DOWN.

Fixed. It now finds **ten** numbers in the state engine it had been blind to, and zero in
the federal engine. **Six of the ten were not checked by any test**, and all six are
percentages this package PRINTS to whoever is asking: Oregon's kicker at "9.863%",
Maryland's poverty credit at "5% of earned income", a state earned income credit at "50% of
the federal one", Ohio's municipal range at "0.45% to 3.00%". Doubling any of them would
have made the package state a percentage twice the one it actually used, in plain English,
to a language model that would then repeat it — and every test stayed green. Five new tests
close all six.

**You do not have to do anything about this.** I am telling you because the whole argument
for this project is that its quality claims are checked rather than asserted, and today the
checker was the thing that was wrong. It was found by the cheapest possible discipline:
write down what the measurement will say before you run it.

**B. NINE STATES WERE SWALLOWING AN INPUT IN SILENCE.** The engine tells a caller when it
accepted a figure and did not use it — send Oregon's kicker base to California and it says
so. Send it to Texas and, until today, it said nothing: the sentence lived in a part of the
code that runs only for states that HAVE an income tax, so the nine states where nothing at
all is read were the nine that could not say so. Alaska, Florida, New Hampshire, Nevada,
South Dakota, Tennessee, Texas, Washington, Wyoming. Fixed, and the test now asks every
state rather than naming one, because the test that should have caught it named California
and California has an income tax.

The part worth your time: **the behaviour was already documented.** The code's own
documentation promised exactly this, in writing, and the promise was false in nine states on
the day it was written. A promise in documentation turns out to be as checkable as anything
else, and nothing here was checking it.

**C. AND OREGON'S COLUMN IN THE TWO-MODEL COMPARISON IS GREEN.** Yesterday I modelled
Oregon's constitutional "kicker" credit and recorded that this package and PolicyEngine-US
disagreed on 43 of 44 Oregon households — not about the credit, but about where its base
comes from: I require the caller to supply the prior year's Oregon tax, and they substitute
the current year's. The write-up of that disagreement was the best-evidenced entry in the
file, and **being right is what made it a problem**: a reason that correctly explains a
$3,993.89 difference also quietly absorbs every smaller difference in the same state. Today
both models are given the SAME prior-year figure, so there is nothing left to explain and
anything still there is visible.

**D. NOTHING NEW IS WAITING ON YOU.** One small correction in this file, though: the
repository description I have been suggesting since Day 22 says "30 states". It is 35. That
number had nobody checking it, which is funny in a file that exists to be acted on by a
person — every number in the public READMEs is enforced automatically and this one was not.

**As of Day 55 nothing is waiting on you except the network ask below, the GitHub Pages
switch, and the optional report from Day 50 — and today's headline is that YESTERDAY'S
DEFECT IS FIXED: the Oregon constitutional credit this package did not model is modelled,
and the way it is modelled is the interesting part.**

`us-federal-tax` is v0.15.0 (unchanged), `us-state-tax` is now **v0.48.0** and `us-tax-mcp`
**v0.52.0**. **1,496 tests**, all passing. No state was added; 26 taxing states and 35 in
all, unchanged.

**A. WHAT WAS FIXED.** Oregon returns budget surpluses to taxpayers as the "kicker" —
Article IX, Section 14(4) of the state constitution — a refundable credit on the
odd-numbered year's return worth a certified percentage of the PRIOR year's Oregon tax.
For tax year 2025 that is **9.863%** of the 2024 liability. Yesterday this package modelled
none of it, so every Oregon 2025 answer it gave was too high — by `$3,993.89` on one
household I tested. It now computes the credit, and it is refundable, so it is paid even to
a filer who owes Oregon nothing this year.

**B. THE DESIGN DECISION, WHICH IS THE PART WORTH YOUR TIME.** The credit's base is a
number that is **not on the return being computed**: the prior year's Oregon tax before
credits, line 24 of the 2024 Form OR-40 less any credit for tax paid to another state. So
the rate is a parameter and the base is a new input, `oregonPriorYearTaxBeforeCredits` —
the first input in either engine whose value comes off a different return. **If a caller
does not supply it, the credit is ZERO and the result says so, rather than being estimated.**
That is a real answer and not a cop-out: the kicker requires a 2024 Oregon return that
showed a liability, so a non-filer, a first-year resident or a household with no 2024 tax is
owed nothing at all, and that case looks identical to a caller who simply did not pass the
figure. Guessing would pay a refundable credit to people not entitled to it.

**PolicyEngine-US — the independent model I check everything against — guesses.** Its own
code substitutes *the current year's* Oregon tax for the prior year's, and its own
documentation calls that "a proxy for the prior-year liability", because a population model
gets one year of data at a time. For a population study that is a reasonable choice. For one
household it is wrong by the whole credit in both directions: somebody who earned nothing in
2024 and `$400,000` in 2025 is handed `$3,705.71` they are not owed. **An average that is
right across a population is wrong on every household in it** — and this package is for
households.

**C. AND I COULD VERIFY THE WHOLE THING WITHOUT GUESSING.** Of the 44 Oregon 2025 households
in the two-model comparison grid, 43 differ by a dollar or more, and **41 of those 43 are
explained to within one cent** by 9.863% of this package's own Oregon tax-before-credits
figure — which is exactly what PolicyEngine's proxy computes. The two that are not are
separate returns that already disagree for a different, recorded reason. So the disagreement
is now completely accounted for, in writing, with the arithmetic that accounts for it.

**D. ONE THING TO KNOW IF YOU EVER FILE IN OREGON.** A major preparer's own help page still
publishes **44.28%** for the 2025 kicker. That is the 2023 rate. The figure an Oregon filer
is most likely to meet is four and a half times too large.

**E. NOTHING NEW IS WAITING ON YOU.** For the record of what the kicker will need in future:
the rate is certified by Oregon's Office of Economic Analysis after each biennium closes, so
tax year 2027's figure does not exist yet. The code is shaped for that — a year with no
certified rate declares no credit at all rather than a rate of zero — and reading the
certification when it appears is my job, not yours.

**As of Day 54 nothing is waiting on you except the network ask below, the GitHub Pages
switch, and the optional report from Day 50 — and today's headline is that I FOUND A
REFUNDABLE CREDIT IN THE OREGON CONSTITUTION THAT THIS PACKAGE DOES NOT MODEL AT ALL, so
every Oregon 2025 answer it gives is too high: by `$3,993.89` on one household I tested,
and by about 0.9% of income on a typical one.**

`us-federal-tax` is v0.15.0, `us-state-tax` v0.47.0 and `us-tax-mcp` v0.51.0, all three
unchanged today. **1,487 tests**, all passing. No state was added; 26 taxing states and
35 in all, unchanged.

**A. THE DEFECT, IN ONE PARAGRAPH.** Oregon returns budget surpluses to taxpayers as the
"kicker" — Article IX, Section 14(4) of the state constitution — as a credit on the
ODD-numbered year's return, worth a certified percentage of the PRIOR year's Oregon tax.
For tax year 2025 that percentage is **9.863%** of the 2024 liability, certified off a
`$1.41` billion surplus, and it is refundable. This package models no kicker, so it
overstates every Oregon 2025 return by that credit. Two independent sources agree on the
figure. **It is recorded but NOT fixed today** — the credit is computed from a number that
is not on the return being calculated (the prior year's Oregon liability), so modelling it
means adding an input a caller has to supply, which is a change to the package's public
interface and wants doing carefully rather than quickly. It is the first thing on
tomorrow's list.

Worth knowing as a user of tax software generally: a major preparer's own help page still
publishes **44.28%** for the 2025 kicker, which is the 2023 rate. The figure an Oregon
filer is most likely to meet is four and a half times too large.

**B. WHY IT TOOK FIFTY-THREE DAYS, WHICH IS THE PART I THINK IS ACTUALLY INTERESTING.** The
strongest check on this project is not its own tests: it is that the same households go
through these engines and through PolicyEngine-US, an independent model of the same
statutes maintained by other people, and every answer is compared to the cent. That check
had **one tax year in it**. The code that builds the households has always taken the year
as an argument and nothing ever passed one, so it used its default and every household was
a 2026 household. **2026 is an even year, and there is no kicker in an even year.** The
grid is now two years deep — 2,288 households instead of 1,144 — and the first thing it
produced was this.

**C. AND SIX RECORDED REASONS CLAIMED TO BE ABOUT A YEAR NOTHING COULD CHECK.** The file
that explains known differences lets an entry say which tax year it is about. Six entries
did. Nothing in the comparison code ever read that field. One of them argued its whole
case on the year — *"every one of these is tax year 2026 and none is 2025"* — a claim about
households the grid did not contain, made through a field nothing read, and **it is exactly
backwards**: the 2025 gap is thirty times the 2026 one, and it is the kicker. The comparison
now reads the field, and a field it does NOT read is now a hard error rather than a comment
nobody contradicted.

**D. THREE THINGS THE 2025 HALF LEFT OPEN, one of which looks like a second defect.**
Indiana's earned income credit is a percentage of the FEDERAL credit, and Indiana freezes
which year's federal law it reads — the snapshot is 1 January 2023 for tax years 2023
through 2025. This package uses the current year's federal credit, which gives an Indiana
family `$93.30` they may not be entitled to. The reading comes from PolicyEngine's citation
of an Indiana act, not from the statute, so I have NOT changed anything: it needs the law
read first. Georgia and Wisconsin have smaller open differences, also 2025-only, also
recorded rather than guessed at.

**E. NOTHING IN THE TAX ENGINES CHANGED TODAY**, for the second day running and
deliberately. Everything today is in the instruments and the layer between the engine and
the caller, so the sensitivity audit's number (1,531 deliberately-wrong figures, 1,525
caught, 99.6%) is still a measurement of exactly this code and did not need its
104-minute re-run.

**As of Day 53 nothing is waiting on you except the network ask below and the optional
report from Day 50, and today's headline is that THE MCP SERVER WAS REFUSING EIGHT MORE OF
ITS OWN ARGUMENTS for states whose tax they move — up to `$1,856.25` on one Arizona
return — and that TWO PENNSYLVANIA ARGUMENTS WERE ACCEPTED, DOCUMENTED, AND THEN THROWN
AWAY by the code underneath.**

`us-federal-tax` is v0.15.0 and `us-state-tax` **v0.47.0**, both unchanged today;
`us-tax-mcp` is **v0.51.0**. **1,483 tests**, all passing. No state was added; 26 taxing
states and 35 in all, unchanged.

**A. WHAT THE SERVER DOES, AND WHAT WAS WRONG WITH IT.** The MCP server takes about sixty
arguments, and most of them only mean something in a few states — an Arizona itemized
deduction total, a Connecticut child's age. Each one carries a list of the states it
applies to, and the server REFUSES the argument for any other state, on the principle that
quietly ignoring a figure somebody supplied is worse than saying no. Eight of those lists
were too short. The server was telling a caller "this does not apply to your state" about a
figure that changes their state's tax:

```text
  Arizona      itemized deductions          $1,856.25 on one return
  Missouri     the filer's age              $1,598.00
  Pennsylvania the spouse's forgiveness       $982.40   (a different bug -- see C)
  New Jersey   earned income                  $420.00
  Alabama      the filer's age                $300.00
  Oregon       a no-income spouse             $263.00
  Connecticut  the children's ages            $250.00   refundable
  S. Carolina  whether they itemized           $90.00
```

All eight are fixed. Every one of those figures was worked out from the statute on paper
BEFORE the code was asked, and all eight came back to the cent.

**B. THE SAME BUG IN THE OTHER DIRECTION, WHICH NOTHING HAD EVER LOOKED FOR.** A list can
also be too LONG: the server accepts a figure, says it applies, and nothing reads it.
Nobody had ever measured that. Three states came out of a list — Kentucky, Georgia and
Missouri — and in Kentucky's case the field's own documentation already said, in as many
words, that Kentucky has no age test at all, while the list beside it said Kentucky reads
ages. **Nothing needs doing about it; I mention it because the documentation and the code
had disagreed in writing for days and no test could see it.**

**C. THE ONE I WOULD WANT TO KNOW ABOUT: TWO PENNSYLVANIA ARGUMENTS WENT NOWHERE.** Two
arguments about Pennsylvania's tax forgiveness were listed in the server's published
schema, described in its documentation, and named in its own error messages — and the
function that does the work never read either of them. A married Pennsylvanian filing
separately who qualifies for forgiveness was charged their entire Pennsylvania tax:
`$276.30` on one household I tested, `$982.40` on a slightly larger one. Both now go
through. Then I asked the same question of all forty-seven arguments at once and the answer
was that exactly those two were affected.

**D. THE PART THAT WILL KEEP PAYING: FIVE REASONS A TEST FAILS TO SEE A BUG.** Last week's
test for this covered one direction and used one test value per argument, and it missed all
eight of A's findings. The reasons are not about tax and they generalise to anything
measured by comparison: a test value above the rule's own limit measures the rule switched
off against the rule switched off; comparing two supplied values cannot see what LEAVING
THE FIELD OUT costs, which is what the refusal actually forced on people; a value of the
wrong type is just another way of writing "not the thing being tested for"; a maximal value
is unsafe where a rule subtracts one of the things that value contains; and picking a pair
of cities by the wrong rate picks the direction where there is nothing to see. The new
test — run against last week's code — reports all eight findings by name and amount, which
is the only way to know a test is a test.

**E. NOTHING IN THE TAX ENGINES CHANGED TODAY**, which is unusual and deliberate. All of
today's work is in the layer between the engine and the caller. One useful consequence: the
sensitivity audit's number (1,531 deliberately-wrong figures, 1,525 caught, 99.6%) is still
a measurement of exactly this code, so it did not need re-running and the check that
verifies it passed first time — the first day in nine that has been true.

**As of Day 52 nothing was waiting on you except the network ask below and the optional
report from Day 50, and that day's headline was that THIS PACKAGE WAS OVERCHARGING EVERY
SOUTH CAROLINA FILER OF 65 OR OVER FOR 2025 — `$120` of tax for a single filer, `$192`
for a couple both 65 — and the thing that found it was the public calculator rather than
any of the 880 tests over the engine.**

`us-federal-tax` is v0.15.0, `us-state-tax` **v0.47.0**, `us-tax-mcp` **v0.50.0**.
**1,476 tests**, all passing. No state was added today; 26 taxing states and 35 in all,
unchanged.

**A. WHAT WENT WRONG, IN ONE SENTENCE.** South Carolina's tax law is frozen at 31
December 2024, so its 2025 return uses the older, smaller federal standard deduction and
adds the difference back. The add-back was written as "the filer's own federal deduction
minus the older amount", which looks right and quietly cancels out: it removed the whole
federal deduction and put back a fixed one, so the extra `$2,000` that federal law gives
a person who has turned 65 — which South Carolina's frozen law allows in full — was taken
away from every one of them. The fix is a cap: the add-back is `$750` for a single filer,
`$1,125` head of household, `$1,500` for a couple, which is what South Carolina's own
form prints and what three commercial tax preparers publish. Three days old; shipped in
v0.46.0 yesterday, fixed in v0.47.0 today.

**B. THE PART I THINK IS ACTUALLY INTERESTING: THE WEBSITE FOUND IT.** The engine takes
the federal figures from whoever calls it, and every test in this package builds them by
hand. Every one of those hand-built blocks gave a 65-year-old the standard deduction of a
40-year-old — eighteen households in the South Carolina file alone. Those households
cannot exist, so the engine's answers about them were answers about nobody, and the
package's own documentation quoted them as advice to real people. The calculator at
`site/` runs the real federal engine, so it cannot invent a federal return that nobody
could file, and the first South Carolina number it produced was `$30` away from the one I
had worked out on paper. That `$30` is the whole day. **Nothing needs doing about it — I
mention it because "the product found a bug the test suite could not" is the kind of
thing worth knowing about how this repository is built.**

**C. AND A SECOND BUG, IN THE OPPOSITE DIRECTION, ON THE SAME RETURN.** The calculator
was not telling the state engine about the new federal deductions that sit below the
line — in particular the `$6,000` senior deduction the One Big Beautiful Bill Act created
in 2025, which almost everyone this page is for is eligible for. South Carolina adds that
one back, so the page was computing some South Carolina filers up to `$360` too LOW while
the engine was computing them `$120` too high. On the one household I tested the two
nearly cancelled and left an error of `$30` on a `$4,000` bill, which is exactly why
neither looked wrong. Both fixed; the page and the engine now agree to the cent.

**D. THE FEATURE THAT WAS SUPPOSED TO BE TODAY'S WORK IS ALSO DONE.** The calculator now
has three inputs for income a widow or widower receives on a deceased spouse's behalf —
a survivor pension, a Survivor Benefit Plan annuity, and the age the deceased spouse
would have reached this year. A South Carolina widow using the page yesterday was charged
`$1,500` of tax she does not owe. It is behind a disclosure, because it applies to one
household in a hundred and is worth `$25,000` of deduction to that one.

**E. AND THE SAME QUESTION ASKED OF ALL TWENTY-SIX STATES FOUND NOTHING ELSE**, which
is the news I wanted. Nine state-years read the extra federal deduction a 65-year-old
gets, every one of them by its own tax rate times it, and no state swallows it the way
South Carolina was. There is a standing test over it now. Two of the nine were a
surprise and both are correct: Missouri sets its own standard deduction equal to the
federal one, and Utah pays a credit of 6% of the federal deduction — so both read a
figure their "starting point" says they are above.

**F. THE SENSITIVITY AUDIT WAS RE-RUN OVER TODAY'S BUILD AND THE SCORE HELD: 1,531
numbers set wrong one at a time, 1,525 of them caught by the tests, 99.6%.** The six
that are not caught are the same six as the last three days and all six are deliberate:
four are tax years that only matter after 2027 and two are Ohio rates no household in
the test battery can reach. Every figure of that was predicted in writing before the run.

**G. AND I HAD TO THROW THE AUDIT AWAY TWICE, the second time because I broke my own
rule.** The audit works by setting one number wrong, rebuilding nothing, and running the
tests — so nothing may rebuild while it runs. I ran a tool that counts tests, three
times, and that tool rebuilds. The run kept going and would have reported a score that
was too GOOD, because a test suite whose files have just been deleted fails everything
and the audit reads "failed" as "the wrong number was caught". Nothing is wrong in the
repository as a result — the third run was clean and is the one recorded — but it cost
about forty minutes and it is the kind of mistake worth telling you about, because the
same shape (a measurement that is wrong in the flattering direction and still looks
healthy) is the one I would want you to distrust in anything I report.

**H. If you ever want to check any of this against the real form**, the one document that
would settle it is SCDOR Information Letter #26-4 and the 2025 SC1040 instructions, both
at `dor.sc.gov`. **This sandbox cannot open that host and has not been able to for eleven
runs** — see the network ask below. Everything above is established from `WebSearch`
quoting SCDOR, three commercial preparers who all print the same four numbers, and
`policyengine-us`, and every one of those routes is named in the code's own provenance
ledger rather than only here.

**As of Day 51 nothing is waiting on you except the network ask below and the optional
report from Day 50, and today's headline is that THE MCP SERVER WAS REFUSING ELEVEN OF
ITS OWN ARGUMENTS for states whose tax they move — including a Social Security benefit
in fifteen states — and telling the caller the field did not apply to their state.**

`us-federal-tax` is v0.15.0, `us-state-tax` **v0.46.0**, `us-tax-mcp` **v0.49.0**.
**1,471 tests**, all passing. No state was added today; 26 taxing states and 35 in all,
unchanged.

**A. YESTERDAY'S WORK WAS SAFE, AND IT TOOK ONE COMMAND TO KNOW IT.** The run opened
with five commits dated 14 October on a detached HEAD and `main` five behind them,
which reads exactly like a day's work that never got pushed. It was pushed — the
remote already had all of it, and the local tracking ref was stale from the fresh
clone. Nothing was lost and nothing needs doing. I mention it because the first
minute of the run looked like a disaster and `git fetch` ended it.

**B. The `$25,000` widow from yesterday's item 4 is modelled, and every figure I
predicted came back exact.** A single filer of 65 whose husband would have been 70,
with her own `$20,000` pension, his `$30,000` of military retired pay and his `$15,000`
pension, now deducts `$55,000` where she deducted `$30,000`: `$1,500.00` of 2025 tax
and `$1,302.50` of 2026 tax. **It is the only South Carolina household this package has
ever been too HIGH for**, and that direction is the one nobody reports — there is no
letter, no notice and no support ticket for a filer who was overcharged.

**C. The detail that no plausible shortcut survives: THE DECEASED SPOUSE KEEPS
AGEING.** The cap on a widow's survivor deduction is `$3,000` or `$10,000` "based on
the age of the deceased", and South Carolina's own guidance puts the rise in "the year
the deceased spouse **would have been** 65" — not the year they died. So a widow of 55
can hold a `$10,000` cap and a widow of 70 a `$3,000` one, and using the claimant's own
age is wrong by `$7,000` of deduction in each direction. There is a new input for it,
`deceasedSpouseAge`, because no other figure on the return implies it.

**D. THE HEADLINE, AND IT IS ABOUT THE SERVER RATHER THAN ABOUT TAX.** `us-tax-mcp`
pairs every argument with the states that read it and REFUSES the argument for any
other state, on purpose: a silently ignored field is a wrong answer with no symptom.
Eleven of those lists were written by hand and had drifted —

```text
taxableSocialSecurity          15 states    up to $1,206.16 of Minnesota tax on one household
dependentAges                  10 states
retirementIncome                8 states
spouseAge                       6 states
filerAge                        5 states    including the state where age decides the answer
stateItemizedDeductions         3 states
netCapitalGain                  2 states
lesserSpouseIncome              2 states
socialSecurityAndMedicarePaid   1 state
propertyTaxPaid                 1 state
rentPaid                        1 state
```

— and a refusal is not a dropped field. **The message names the states that DO read
it, so a model asking about a Minnesota retiree was told that Minnesota does not read
a Social Security benefit, concluded its own input was wrong, and stopped looking.** It
subtracts the benefit, and withdraws the subtraction a tenth at a time, and the two
rules together are worth `$1,206.16` on that household.

All eleven are fixed. Every remaining hand-written list inside the handler now reads
the shared table, the retirement list is derived from the engine with a compile-time
proof, and a new test measures all 44 gates by running households in all 35 states, so
the next drift fails a build instead of answering a question wrongly.

**E. One of my own tests was asserting the defect, and that is the part I would most
want you to see.** A test required New York to REFUSE a Social Security figure, and New
York subtracts it in full — `$1,080.00` of tax on `$20,000` for a single filer of 70. It
passed every day since it was written, because it was a test of my code rather than of
the law. Two more guards in the same file had the same shape. **A green suite cannot
tell you which of its tests are pinning your bugs**, and the only defence I have found
is the one I already use for figures: derive the expectation from the statute, not from
the implementation.

**F. The three new fields changed no other state's answer, and that is measured rather
than claimed.** 8,400 comparisons across 35 states, 2 years, 5 filing statuses, 3
incomes and 4 ages: exactly one state answers differently, and it is the one with the
statute. **The sweep found two defects before shipping** — Ohio's retirement income
credit and Utah's military retirement credit read the caller's input rather than the
pooled household, so both were silently smaller (`$200` and `$1,335`) for a widow who
used the new fields than for the same widow who called the same dollars her own the day
before.


`us-federal-tax` is v0.15.0, `us-state-tax` **v0.45.0**, `us-tax-mcp` **v0.48.0**.
**1,454 tests**, all passing. No state was added today; 26 taxing states and 35 in all,
unchanged.

**1. Yesterday I found a wrong LABEL in the published package and wrote it down instead
of fixing it. Fixing it today found a wrong NUMBER under it.** The label said `$60,000`
of military retired pay came out under South Carolina's general retirement deduction,
which is capped at `$10,000`; it actually comes out under a different statute, which is
uncapped. The tax was right, so I called it cosmetic and queued it.

Writing the correct label meant reading the two statutes together, and the second one
has a subsection I had not read: **§ 12-6-1170(C)(1) reduces the general `$3,000`/`$10,000`
retirement deduction by whatever the military deduction takes.** I had modelled the
military deduction as sitting *beside* that cap rather than coming out of it. So a
65-year-old with `$60,000` of military retired pay and a `$20,000` civilian pension was
given `$70,000` of deduction where South Carolina allows `$60,000` — **`$600` of 2025 tax
and `$521` of 2026 tax, understated.**

**The direction is the thing I would most want you to notice.** Every correction in this
area so far has made somebody's bill too high. This one made a veteran's too LOW, which
is the error no customer reports and no support ticket describes. It bites every South
Carolina military retiree with any other retirement income, and it was in the package for
exactly one day.

**2. The defect has a sharp edge, and the edge is `$5,000`.** The two rules compose into a
floor rather than a sum: below `$5,000` of military retired pay the `$15,000` senior
deduction fills the hole and the answer does not move at all; at `$6,000` it is `$60` of
tax; from `$20,000` the whole `$10,000` is gone. That is a measured boundary in a test,
not an estimate.

**3. The same question, asked of every state with that shape, found the same label defect
in New York — and worse.** A retired New York City police officer who left at 45 on a
`$70,000` pension pays New York nothing, and this package reported their whole pension
under the name of a `$20,000` exclusion that does not begin until 59½. Both states now
print a line per statute. Michigan does not, and should not: there the two halves really
are one deduction on one form line.

**This is the part that is about the product rather than about tax.** The result object is
what a language model reads inside a tool call. A caller handed "Retirement deduction:
$60,000" against a cap this package's own notes put at `$10,000` has a contradiction it
cannot resolve, and the only way out is to doubt the answer. No README fixes that, because
nobody reads a README inside a tool call.

**4. I found a household where this package is now too GENEROUS to the state, and it is
the same statute read the other way.** The reduction above expressly does not apply to an
amount claimed as a **surviving spouse** — so a 65-year-old widow of a career soldier with
a pension of her own keeps the military deduction in full, the decedent's `$10,000`, her
own `$10,000` and `$5,000` of the senior deduction: **`$25,000` more of deduction than
this package gives her.** It is written into the state's notes with the arithmetic, so a
caller can supply it, and it is not modelled because there is no input anywhere in this
engine for income received *as a surviving spouse* — adding one obliges every state that
reads a pension pool to say what it does with it, or a Maryland military widow silently
loses a subtraction she has today. That is an audit, not a field, and it is first on
tomorrow's list.

**5. Four independent routes agreed before I wrote a line of it, and the fourth was a
competitor's own test.** The statute's words, the SC1040 worksheet instructions, a South
Carolina Revenue Ruling, and `policyengine-us` 2.41.3 — whose answer for the same
household is this package's three subtraction lines **to the dollar and in the same
decomposition**. It is pinned as a test, and it is only comparable at all because of the
label fix: before today this package answered with two lines where theirs has three.

**6. A NEW OPTIONAL ASK, and it is a finding about somebody else's software rather than a
favour.** The model this project checks itself against, `policyengine-us`, **leaves
military retired pay out of federal AGI entirely.** Measured, not inferred — a single
filer of 70 with `$60,000` of military retired pay and nothing else:

```text
military_retirement_pay = 60_000
  adjusted_gross_income            0.0
  taxable_income                   0.0
  sc_military_deduction_indv   60000.0
```

Military retired pay is ordinary taxable income federally; only VA disability
compensation is excluded. So their model computes a state answer on a base that never
contained the pay, and then subtracts it. **If you would like to report it, the
reproduction above is the whole bug report** — their repository is
`PolicyEngine/policyengine-us`, the variable is `military_retirement_pay`, and the fix is
one line in `gov/irs/gross_income/sources.yaml`. I cannot open an issue myself; I do not
contact people. Nothing here depends on it.

**And the sharpest part of it: their South Carolina model has had TODAY'S FIX RIGHT the
whole time.** Both the current 2.41.3 and the older 2.15.3 my own comparison harness is
pinned to compute the reduction correctly — and both leave military pay out of federal
AGI. So the model I check myself against held the right answer to today's question for
as long as I have been checking against it, and the only thing in the way was that the
question could not be put to it. **A reference that is right and unaskable is worth
exactly as much as one that is wrong**, which is the real reason this is worth
reporting.

**It also bounds one of my own instruments, which is why I chased it.** The 1,144-household
differential grid has no veteran in it and could not have — a grid row with military pay
would put the two models a whole pension apart on the federal column and the report would
be measuring my harness instead of either engine. **THE RULE: a differential grid's
coverage is bounded by the reference model's input surface, and that bound is invisible
until something falls through it.** Six of this package's states have military-specific
rules and none of them is reachable by that grid. It is now written down where the grid
is, with the three ways out ranked by cost.

**7. A check I queued two days ago found a defect that was already there when I queued
it.** Day 48's list ended with "assert that each lockfile's version matches its
package.json". Bumping the MCP server's version today meant editing its lockfile, and the
lockfile said **0.46.0** against a package at 0.47.0 — stale for the whole of Day 49, with
nothing to say so. The lockfile travels inside the published tarball, so `npm ci` against
a checkout resolves the version the lockfile names. There is now a check, it takes under a
second, and it is the seventh CI job.

---

**As of Day 49 nothing is waiting on you except the network ask below, and today's
headline is that South Carolina rewrote its income tax in March 2026 — so this package's
two supported years for that state are two different laws, and its 5.21% top rate hides a
57.31% marginal rate on one dollar in every thirty-seven.**

`us-federal-tax` is v0.15.0, `us-state-tax` **v0.44.0**, `us-tax-mcp` **v0.47.0**.
**1,447 tests**, all passing. **South Carolina is the twenty-sixth taxing state** and the
thirty-fifth in all; sixteen jurisdictions that tax income are still uncovered.

**What Act 110 of 2026 did, and why it was worth a day.** South Carolina's governor signed
H.4216 on 30 March 2026. It changed four things at once for tax year 2026: the starting
point (from federal *taxable* income to federal *AGI*), the rate schedule (three brackets
to two, 1.99% and 5.21%), the deduction (a new state deduction, the SCIAD, where the
federal standard deduction had been), and the earned income credit (capped at **$200**,
where it had been 125% of the federal credit with no ceiling). A single filer on $50,000
pays **$1,458.30** for 2025 and **$999.21** for 2026.

**1. The 57.31%, which is the part no table of state rates can show.** The SCIAD phases
out as income rises — and the statute rounds the phase-out amount **down to the nearest
$10**. That turns a smooth withdrawal into a staircase: for most dollars of income the
marginal rate is the ordinary 5.21%, and at each step boundary one extra dollar of income
costs **$10 of deduction as well**, so eleven dollars become taxable and the rate on that
one dollar is **57.31%**. The steps are 37, 37 and 36 dollars of income wide, repeating —
a width that appears in no document, because it is a consequence of the statute's fraction
rather than something the statute says.

**2. One mistake of mine, caught by a document rather than by arithmetic, and worth $10 a
filer.** The natural way to store that phase-out is as a single rate: 15,000 ÷ 55,000. In
binary floating point that quotient is one *sixteenth-digit* step below the true 3/11 — and
the statute's rounding-down then turns that invisible error into a whole $10 step. A single
filer at $67,500 of income kept **$7,510** of deduction where South Carolina's own worked
example says **$7,500**, and $10 of deduction was still standing at the income where it
should have hit zero. It was caught because the test was written from the Department's
three published figures *before* the code was trusted. The fix stores the statute's two
numbers and divides last, and all nine published figures are now exact.

The general lesson, which I have written into the package: **rounding down after dividing
is where a harmless floating-point error becomes a real one.** Everywhere else in these
engines, that kind of error is fractions of a cent and nobody can see it.

**3. The $966 South Carolina prints on its own rate schedule is the state's marriage
penalty.** The Department publishes the upper band as "5.21% minus $966". That $966 is
$30,000 × (5.21% − 1.99%) — the number that makes the two-band schedule join up smoothly.
It is *also*, to the cent, what a married couple pay for South Carolina not widening its
brackets on a joint return: a couple at $120,000 pay **$965.99** more than two single
filers at $60,000 each. One number doing two jobs, for the same reason.

**4. South Carolina's "$15,000 retirement deduction" is not a retirement deduction.**
Every guide files it under retirement income. The statute gives a filer of 65 **$15,000 of
any income at all** — wages included — reduced by whatever retirement deduction they
already took. So it is a **floor**, not a bonus: at 66 a filer with $60,000 pays
**$1,158.30** whether that money is a pension or a paycheque. And **military retired pay
comes out in full at any age with no cap**, which means a military retiree gets no senior
deduction — the offset removes a deduction their own exemption had already made
unnecessary. $60,000 of military retired pay costs nothing; the same $60,000 of civilian
government pension costs $1,878.30 at 50.

**5. A conformity date that the project's own measuring instrument could not see, which is
the finding I would most want you to have.** South Carolina reads the federal tax code as
it stood on 31 December 2024, so it has not adopted the 2025 federal act — and its 2025
return adds back five federal deductions because of that. This project has a test that
decides which states depend on federal law by *moving a federal number and watching the
state tax*. It reported South Carolina as **indifferent**.

It is indifferent. The add-back cancels the movement exactly. **So the state's
non-conformity is the cause of the very indifference that looked like evidence of no
dependency at all — the most non-conforming state in the package is the one the test calls
unaffected.** The test was widened rather than relaxed, and the finding has a second half:
the indifference is a property of the *household*, not of the state. A dependent filer on a
small standard deduction moves with the federal figure like anyone else.

And then Act 110 made the whole question moot without touching the date: the 2026 return
starts at federal AGI, which sits *above* all of those deductions. **A state can cure a
conformity gap by moving its starting line instead of moving its date** — and the two are
indistinguishable in the answer, which is exactly why this package records the mechanism
and not just the number.

**6. The one thing three previous days kept putting off is now built, and building it
changed what it was.** For three days running my own notes ended with the same unfinished
item: *every dollar figure in the prose should be one the engine actually computes.* It is
now built for South Carolina. The first version checked figures against the parameters and
the answers, and flagged fifteen — **none of which was wrong.** They were the sentences'
own inputs ("a couple at $120,000") and figures *derived* from two parameters (the $966
above). A money figure in prose has **four** sources, not two, and the two I had missed are
the two nothing can work out automatically: somebody has to say which household a sentence
is about and where a derived number came from. That is the real cost of doing this for all
thirty-five states, and it is why today's is one state. It catches a **one-cent** error in
a shipped sentence, which is how I know it works.

**7. And the day's last instrument caught me, which is the best thing in this entry.** This
project has a nightly-style audit that sets every number in the built package wrong, one at
a time, and counts which ones no test notices. I wrote down a prediction before running it,
as I have for the last four days: **six survivors, 99.6%.** The answer was **fourteen,
99.1%** — and all eight of the new ones were figures I had written three hours earlier.

I had lifted South Carolina's phase-out thresholds out of the main declaration into two
tidy named tables and exported them "for the test to check". Then I wrote the test using
its own numbers — which is the *right* way to write a test, because a test that reads its
expectation out of the code it is testing proves nothing. The result: eight numbers sitting
in the shipped package that **nothing read at all**, and which could have been any value
whatsoever without a single test failing.

They are deleted. The real figures were in the declaration the whole time, where the engine
reads them and the tests kill every one, and the one useful thing those tables were for —
checking that the three phase-out widths are all exactly 11/3 of their own base — is now
checked against the declaration instead.

**The reason I am telling you this rather than just fixing it quietly:** the score went
*down* before it came back up, and that is the only kind of quality number worth quoting. A
number that can only improve is a number nothing is measuring. This is the third time in
the project's history that this audit has fallen on a new state, and all three times the
cause was the same shape — a figure duplicated out of the one place that matters.

**One thing I deliberately did NOT put in the package.** I measured the worst case of the
new $200 credit cap at about $170 for a working family, and left that number out of the
shipped notes, because it depends on my own reconstruction of the 2026 federal credit
tables rather than on anything this package computes. The notes state the mechanism and an
example the engine produces. That is the rule from point 6 applied before the instrument
could complain.

**As of Day 48 nothing was waiting on you except the network ask below, and that day's
headline was that Arizona charges a long-term capital gain 1.875% and a wage 2.5% — which
this package now knows, and did not yesterday.**

`us-federal-tax` is v0.15.0, `us-state-tax` **v0.43.0**, `us-tax-mcp` **v0.46.0**.
**1,426 tests**, all passing.

Yesterday's note said Arizona subtracts 25% of a long-term capital gain and this package
did not model it — **$625.00 of real money on a $100,000 gain**, the largest known gap in
the state, found by the comparison against a competitor's model rather than by reading a
form. It is modelled now, and three things about it were worth the day.

**1. The provision that looks identical to Wisconsin's is not identical to Wisconsin's,
and the difference is money.** Both states subtract a share of a long-term capital gain,
so the two rules look like one rule with two percentages. Take a filer with a **$10,000
short-term loss** behind a **$50,000 long-term gain**:

| | subtraction |
| --- | --- |
| Arizona, 25% | **$12,500** |
| Wisconsin, 30% | **$12,000** |

**The smaller percentage gives the bigger subtraction, and both states are right.**
Wisconsin's statute says to net all the gains and losses together *before* applying the
percentage, so a short-term loss eats the exclusion. Arizona's own worksheet says the
opposite in a sentence of its own: *"Do not include any short-term capital gains or
(losses) in this worksheet."* Getting this wrong by copying Wisconsin's rule and changing
the number would have cost $62.50 on that household — and is now impossible, because the
two rules are different *types* and the compiler refuses the mix-up.

**2. One claim about Arizona that is wrong on the open web, and the document that settles
it.** A 2025 bill (SB 1331) would have removed the rule that the asset must have been
bought after 2011, from this tax year. It passed the Senate, got through a House committee
5–4, and **died**. At least one tax-calculator site states the expansion as current law.
The thing that refutes it is not an argument but a date: a **2026-session** Arizona Senate
fact sheet, written for a different bill, still describes current law with the 2011 date
in it. **A bill that died leaves summaries of what it would have done lying around, and
they read exactly like summaries of law.**

**3. The gap did not close, and what was underneath it is the better news.** Fixing a
$616.25 disagreement with PolicyEngine-US on an Arizona investor left **$8.75** — and the
same $8.75 turned out to be sitting on *every* Arizona household in the comparison,
including ones with no capital gain at all, where it had been hidden behind the larger
number. It is **$350 of 2026 standard deduction**: the pinned version of PolicyEngine has
no 2026 Arizona figure and carries 2025's forward.

**And this package is on the right side of it by the only test that does not require you
to trust me: PolicyEngine's own current version now carries the same figures this package
does** — $16,100 / $24,150 / $32,200 — citing the same Arizona statute and the same IRS
revenue procedure. That is the sixth state where this package held a published figure
against a competitor's projection, and the first where the competitor has since agreed.

**Two gaps in my own tooling, found and closed, and they are the part I would want you to
see.**

- **The server did not expose the new field.** The engine gained it, the engine's own 839
  tests proved it worked, the MCP server copied the new engine in on the next build — and
  the field was not on the server's list, so **nobody using the MCP could have supplied
  it**. Every test passed, because every test in that file walks the list and a field
  missing *from* the list is invisible to all of them. There is now a test that the list is
  **complete**: every field the engine accepts is exposed, or named with a reason why not.
  It fails when I delete the new field, which is how I know it works.
- **A stale paragraph in the published README.** It described Arizona's surviving-spouse
  question — which yesterday's work *closed* — as live and unanswered. Every figure in it
  was still right; the mechanism it described had expired. Rewritten, and the rule it
  produced kept, because the rule outlived the question.

**I also made the same mistake twice while writing today's README and caught both.** Two
dollar figures I worked out by hand were wrong ($3,981.25 for $3,972.50, and $500 for
$62.50) and the engine was right both times. That is the fourth day running for this
class of error and the first where none of it shipped — because I read every figure off
the engine before committing instead of after. The standing instrument for it is still
unbuilt and still the second thing on tomorrow's list.

**As of Day 47 nothing is waiting on you except the network ask below, and today's
headline is that Arizona's standard deduction stopped being the federal one four months
ago and nothing here noticed, because the number did not change.**

`us-federal-tax` is v0.15.0, `us-state-tax` **v0.43.0**, `us-tax-mcp` **v0.46.0**.
**1,426 tests**, all passing.

A.R.S. § 43-1041(A) defined the Arizona standard deduction as *equal to* the federal one
until Arizona's HB 4168, signed **13 June 2026**, replaced that cross-reference with
Arizona's own amounts — $15,750 / $23,625 / $31,500 — **backdated to tax year 2025**.
Arizona's figures still match the federal ones, because the same statute says to index
them by the federal method. So this package kept giving the right answer with the wrong
reason behind it, and no test could tell.

**Two things about age were wrong in Arizona, in opposite directions, and a real filer
felt both.**

- The old cross-reference handed Arizona whatever deduction the filer *actually took*
  federally, which for anyone 65 or over or blind includes an extra federal allowance
  Arizona does not give. The package was **$50.00 too low** for a single Arizona filer
  aged 65 or over, **$80.00** for a couple both 65 or over, **$100.00** for a filer who is
  both 65 and blind.
- Arizona's senior subtraction (A.R.S. § 43-1022(35)) was not modelled at all, which made
  the package **too high** by up to **$150.00** for a single filer and **$300.00** for a
  couple — but only up to $75,000 of income, because it withdraws at 6 cents on the dollar
  and is worth nothing from $175,000.

**So "how wrong was Arizona" has no single answer: too high by $100.00 at low incomes,
exactly right at $141,664, and too low by $50.00 at the top.** Both are fixed, and
Arizona's four Schedule 1-A subtractions — tips, overtime, the senior deduction and
vehicle loan interest — are now modelled, read off the federal return rather than
recomputed. The vehicle loan one is **2025 only**, while the federal deduction it is
measured from runs to 2028.

**One new thing that is money, found by an instrument rather than by reading.** Arizona
subtracts **25% of net long-term capital gain** (A.R.S. § 43-1022(22)) and this package
does not model it, which makes an Arizona answer too high for anybody with long-term
gains — **$625.00 on $100,000** of gain. It is now a note on every Arizona result and the
first thing on tomorrow's list. It had been visible in the comparison against
PolicyEngine-US since that grid was built, and was being blamed on an Arizona credit worth
at most $100 on a household that had no dependents at all.

**Why nothing caught any of this, which is the part worth your attention.** Every quality
instrument here checks *figures*, and none of these was a wrong figure:

- The 7,750-row regression battery contains households aged 71, 72, 73, 74, 82 and 100 —
  and none of them could see the age defect, because the battery builds its own simplified
  federal return instead of using a real one.
- The comparison against PolicyEngine-US *did* see it, and one unexplained-difference
  entry with no size limit on it had been absorbing it. That entry named two Arizona
  credits worth at most $100 and was credited with a $305.00 disagreement. There is now a
  rule that every such entry must state the largest difference it could possibly explain,
  or argue in writing why it cannot — and the rule found the capital-gains gap above within
  minutes of being switched on.
- And one household **stopped agreeing** with PolicyEngine once Arizona was fixed. It had
  agreed at $0.00 because this package's too-generous deduction happened to produce the
  same zero as their correct deduction plus credits we do not model. **An agreement can be
  a mistake too.**

**Three questions this package had recorded as unanswered are now closed, and the statute
closed all three rather than anyone finally reading a form.** The largest was worth
**$201.25**: a widowed Arizona filer's deduction used to be chosen by two governments at
once that disagreed, and the cross-reference that caused the disagreement no longer
exists.

**I also corrected an explanation I wrote yesterday, and made the same kind of mistake
four times today while writing this up.** Each time it was a figure I worked out by hand
where the engine could have told me, and each time the engine was right — once by a single
cent, in the very test written to fix yesterday's single-cent error. Every derived figure
in today's new text is now read off the engine. Building the instrument that would enforce
that is the second thing on tomorrow's list.

**Where the mutation audit stands, honestly.** It re-measures how many of the package's
numbers can be set wrong without a test noticing, takes about two hours, and had to be
restarted **twice** today. The first restart was legitimate: it was begun after the code
was finished, and then one of the instruments produced a new finding worth shipping. **The
second was my own mistake, and it is the more interesting one** — I started it without the
flag that saves the result, after reading the warning about exactly that in the logs of two
earlier runs. The harness has printed that warning since Day 42, when the same mistake cost
105 minutes. It now **refuses to start** a full run that has not said whether it is
recording. An announcement at start-up is not a guard; a guard is something that will not
proceed. **It finished, and it came back
1,470 mutants, 1,464 killed, 6 survivors, 99.6% — identical to the prediction committed
beforehand in every figure**, including the identity of all six survivors. CI is green
again on all seven jobs.

**One part of that prediction was wrong and it is the part worth your attention**, because
it is the same mistake as the Arizona one in miniature. Each survivor is reported with a
line number, and I predicted two of them by *measuring* the built file rather than guessing
— which was the right idea and beat guessing by a factor of six. Then I added one more line
of code above them (the capital-gains note two paragraphs up), rebuilt, and quoted the
measurement anyway. Both were off by exactly one. **A measurement has a timestamp, and
quoting it after the thing it measured has changed is a guess again.** The score itself was
fine, because the re-measurement was correctly restarted against the new build; it was the
sentence beside it that nobody re-checked.

**As of Day 46 nothing is waiting on you, and today's headline is a mistake of mine
that had been shipping for 46 days.** `us-federal-tax` is v0.15.0, `us-state-tax`
v0.41.0, `us-tax-mcp` v0.44.0. **1,406 tests**, all passing.

Day 46 added no state. It took the IRC-conformity item off the worklist and the sweep
found that **this repository had been wrong about what the One Big Beautiful Bill Act
did** — in five states' shipped notes, in two READMEs and in four test files.

OBBBA raised the 2025 standard deduction for a single filer by **$750**, from $15,000
to $15,750. The state package said **$1,150** everywhere, because it measured the
increase from **$14,600** — which is the **2024** figure. Rev. Proc. 2024-40 had
already indexed 2025 to $15,000 before the Act touched it, so a third of what this
package credited to OBBBA was ordinary inflation indexation.

**The engine was never wrong.** It takes 2.5% of whatever deduction it is handed. The
wrong figures were in prose and in test fixtures, and the per-state amounts are now:

| state | was | is |
| --- | --- | --- |
| Arizona | $28.75 | **$18.75** |
| Colorado | $50.60 | **$33.00** |
| Idaho | $60.95 | **$39.75** |
| Missouri | *missing from both tables* | **$35.25** |
| Utah | $69.00 | **$45.00** |

**Why nothing caught it, which is the part worth your attention.** The tests were not
weak — they were *circular*. Each built a "pre-OBBBA" federal basis with
`deduction: 14_600`, handed it to the engine and asserted the engine's answer. `4.4%
of $1,150 = $50.60` is arithmetically perfect and factually about a change Congress
did not make. A test that supplies the premise it is asserting can only ever confirm
it, and it reads exactly like a test that works.

**And the right answer was in this repository the whole time.** `us-federal-tax`'s own
data file has said "$750 / $1,500 / $1,125" in a comment since the day it shipped.
Every quality instrument here — the provenance ledger, the differential grid, the
mutation audit, the indexation derivation — is scoped to ONE package, and a claim the
state package makes about a *federal* figure is a cross-package claim. Nothing could
read across. **Two packages in one repository disagreed by 53% for 46 days.** There is
now a CI job that compares them, and it fails if either README advertises a figure the
two engines do not produce.

**The real product of the day is a new kind of checkable claim, and it is the one
nobody else in this space states at all: not what a state's rule is, but whether the
state is ENTITLED to the federal figure in the answer.** Five of the twenty-five
taxing states here pass a below-AGI federal figure straight through, and all three of
their mechanisms are different — which this package had been describing as one thing:

- **Colorado, Missouri and Utah** read the federal Code as it stands. The increase
  arrived automatically, with no state law, no form change and no announcement.
- **Idaho** was frozen at 1 January 2025 when OBBBA passed in July 2025. **For seven
  months the correct Idaho 2025 answer was the pre-OBBBA one.** It became the one this
  package ships on 10 February 2026, when HB 559 was signed and backdated.
- **Arizona is still frozen at 1 January 2025 for tax year 2025.** Two bills to move
  it — SB 1106 and HB 2785 — were **vetoed**. The OBBBA standard deduction is on
  Arizona's 2025 Form 140 because **Executive Order 2025-15** directed the Department
  of Revenue to put it there, and the Department has said a filer who claims these
  provisions may have to amend if the eventual statute differs, with penalties and
  interest waived if amended by **15 October 2027**.

This package ships the figure on Arizona's own form, which is right for anyone filing.
But the authority for Arizona's 2025 answer is an executive order rather than a
statute, and that is a materially different thing to rely on. **Every model in this
space produces Arizona's number; this one now says what the number rests on**, as a
declared field on the definition and on every result, not as a sentence in a document.
HB 4168, signed 13 June 2026, closes the question for 2026 only.

**One thing that is money for a real filer, and it is new.** The same Arizona
executive order created **four Arizona subtractions this package does not model** —
the federal Schedule 1-A senior deduction, qualified tips, qualified overtime and
qualified vehicle loan interest. None of them reduces federal adjusted gross income,
so none reaches an Arizona return through this package's starting point, and **an
Arizona 2025 answer computed here is too high for any filer who has one.** The senior
one can be priced with no new inputs: **$150.00 of Arizona tax for a filer aged 65 or
over, $300.00 for a couple both 65 or over.** It is now a note on every Arizona
result, and it is the top of tomorrow's list.

**Two smaller findings that are the kind of thing a buyer cannot get elsewhere.**
Utah's share of the OBBBA increase is a **band** — a 2025 single filer keeps the full
$45.00 to $87,444 of federal AGI and gets **exactly $0.00 from $90,906**, because
Utah's benefit arrives through a credit that withdraws at 1.3 cents on the dollar. It
is the only one of the five bounded above. And the head-of-household column lands on
an exact half-cent in three states and the engine does not round it the same way:
$1,125 × 2.5% = $28.125 reports as $28.12, while × 4.7% = $52.875 reports as $52.88.

**The root README now has a test over it**, which it never had — it was the only
document here without one. It checks 18 counts against the engines, and the first run
found four stale claims, two of which a careful reading of the same file yesterday
missed: the product table said **"Nine tools"** while a sentence 535 lines later said
**"its ten tools"**, and ten is correct. It also said "all 30 states" against 34 and
quoted a version seven releases old.

**Both quality audits were re-run, both were predicted in writing first, and every
predicted figure came back identical.** `us-federal-tax`: **716 mutants, 716 killed,
0 survivors, 100.0%**. `us-state-tax`: **1,458 mutants, 1,452 killed, 6 survivors,
99.6%** — the same six as Day 45, all six of them unreachable in principle rather than
untested. CI is fully green on all seven jobs.

Two honest footnotes, because they are the day's best evidence that the instruments
work rather than decorate:

- **My mutant count prediction was wrong by two, and the enumeration caught it before
  the audit ran.** I had reasoned the conformity work added only strings; `year === 2025`
  is code.
- **The prediction deliberately refused to guess two line numbers, and that refusal is
  the only part that could have been wrong.** Two survivors sit in a file I added 65
  lines to; they moved by 55, not 65, because ten of the lines I added are TypeScript
  that compiles to nothing. A derived guess would have been wrong by ten, twice. Four
  days of this project have quoted the rule that a line number is a weak way to name a
  survivor; today it stopped being a maxim and became a measurement.

**THE ASK, now with six runs of evidence and one thing that makes it cheaper to grant.**

Day 47 confirmed the denial against the proxy's own status endpoint rather than inferring
it: `recentRelayFailures` records *"gateway answered 403 to CONNECT (policy denial or
upstream failure)"* for `www.azleg.gov:443`. Every host was tested — `azleg.gov`,
`azdor.gov`, `azgovernor.gov` and four practitioner sites all refused; only package
registries answer.

**But two routes DO work and one of them is genuinely good.** `api.github.com` and
`raw.githubusercontent.com` answer, and **PyPI does** — so today I downloaded
`policyengine-us` 2.38.19 as a wheel and read its Arizona parameter files directly,
without installing or running anything. Its standard-deduction parameter cites *"A.R.S.
43-1041(A) and (H)"* and *"Laws 2026, ch. 140 (HB 4168), secs. 16 and 35(A)"* and carries
the same six amounts this package now ships; its subtractions list names § 43-1022(31)
through (36) and notes that the vehicle-loan one sunsets after 2025. **An actively
maintained competitor's parameter file is a secondary source that cites its primary one,
and it has already done the reading this sandbox forbids.** That is a durable route for
every future state and it cost one download.

So the ask is now smaller than it was: it would still settle things faster and more
authoritatively, but it is no longer the only way through.

**The original ask, for the record.** Every primary source this work needs was refused by the sandbox's network
policy: `azleg.gov`, `azdor.gov`, `le.utah.gov`, `legislature.idaho.gov`,
`revisor.mo.gov`, `law.justia.com` and `cost.org` all return 403. Everything in the
conformity table above is established from legislature bill summaries, a department
news release and practitioner write-ups cross-checked against each other — and every
one of the five entries carries a `primaryTextUnread` field saying exactly that, with
Utah's naming itself the weakest evidence of the five and the first to re-read.
**If the environment's network policy can be widened to state revenue and legislature
sites, it would settle all five directly** plus several older questions. Day 45's
PyPI workaround does not help here: PolicyEngine models parameters, not conformity
dates.

---

**As of Day 45 nothing is waiting on you.** `us-federal-tax` is v0.15.0,
`us-state-tax` v0.41.0, `us-tax-mcp` v0.44.0. 1,390 tests, all passing, and the
differential grid against PolicyEngine-US covers **1,100 households and 7,700
figures, 7,100 agreeing to the dollar, 600 differences explained and ZERO
unexplained**.

Day 45 added **Minnesota** — the twenty-fifth taxing state, thirty-fourth in all,
and the first one here whose **2026 figures are published rather than guessed**.
Minnesota requires its commissioner to announce the inflation-adjusted amounts by
1 December of the *preceding* year, so all 96 of its figures were read for both
years and neither year carries a provisional flag. That is a first in this
package, and it says something worth knowing: what makes most of this package's
2026 provisional is a publication calendar, not the difficulty of the figures.

**The honest headline of the day is that two of the things I wrote about
Minnesota were wrong, and the project's own instruments said so before anyone
else could read them.** Both were about the state's alternative minimum tax,
which this package does not model and now describes precisely.

- I first wrote that the Minnesota AMT "cannot bind a filer whose income is wages
  alone". A sweep of 2.16 million households found 82,698 where it does. The
  reason: Minnesota's dependent exemption cuts the ordinary tax and does not cut
  the AMT base, so **the Minnesota AMT is, for an ordinary wage-earning family, a
  clawback of the dependent exemption.**
- I then wrote that it cannot reach a filer with two dependents or fewer, having
  measured that over both years, all five filing statuses and every $500 of
  income to $1.2m. **The differential test against PolicyEngine-US refuted
  that too**, on a widow with one child at $300,000.

The cause is not in Minnesota law. § 290.091 sets no phase-out rate of its own:
it adopts **26 U.S.C. § 55(d)(2)** by reference, and the One Big Beautiful Bill
Act raised that rate from 25% to 50% for 2026. So Minnesota's AMT exemption
phases out twice as fast next year, by a federal amendment, and Minnesota's own
statute and published figures give no sign of it. At 50% the Minnesota AMT
reaches a filer **with no dependents at all** — a head of household from $202,224
of wages, a joint return from $290,580 — and the largest gap this package can be
asked for is **$4,735.91**.

**THE RULE, which is now worklist item 2 and applies well beyond Minnesota: a
rule incorporated BY REFERENCE has its parameters in somebody else's code.**
Reading the state's section tells you nothing about whether they moved, and OBBBA
amended a great deal of the Internal Revenue Code. Every IRC cross-reference in
this package is a figure Congress owns, and they have not been swept.

**And the second pointer OUTWARD, after Day 43's.** PolicyEngine-US — the funded
fifty-state model this package is checked against — has no 2026 Minnesota figures
and estimates them with the *federal* inflation factor. The result is a standard
deduction $50 low, thresholds $50 low and nine of twelve bracket cells $10–$30
low. **It can be shown wrong without trusting anything of mine**: the model read
exactly one 2026 Minnesota figure from the state's own table ($1,107,750, and its
parameter file cites the page), and that figure implies an inflation factor
between 1.0227115 and 1.0227577, while the twelve bracket thresholds the same
model estimated imply 1.0226382 to 1.0226855. **The two ranges do not overlap**,
so no single factor produces both halves of its own 2026 Minnesota. Day 43 found
the same shape in its Wisconsin. That is twice now, and it is the argument this
project is for: not "we worked harder", but *here is arithmetic you can check
without taking either side's word*.

**One thing you could do, and it is small.** Three Minnesota questions are
settled by one page each of a document this sandbox cannot open —
`revenue.state.mn.us` and `revisor.mn.gov` are both refused by the egress policy,
as `mass.gov` and `azdor.gov` have been for days. If the environment's network
policy can be widened to state revenue and legislature sites, it would close
those three and several older ones. Worth about $157 of tax per affected return
on the Minnesota question the grid priced today; worth more as a general matter,
because four runs in a row have now recorded a blocked state revenue site as the
reason a question stayed open.

**The quality audit was re-run and every figure of it was predicted first.**
1,456 mutants (1,357 before Minnesota, plus Minnesota's 99), 1,450 killed, 6
survivors, 99.6% — and the prediction, recorded before the run started, named
all of those plus the identity of each survivor down to its line number. It also
named, in advance, the one way it could have come back different, which did not
happen. Minnesota's own 99 mutants all die: every number in the new state moves
a test. CI is fully green again.

Nothing else is waiting on you, and nothing is blocked: today's run found a way
round the block for the figures that mattered, by reading a second party's
published reading of the same document off PyPI and checking it arithmetically
against the state's own published rate schedule.

A **qualifying surviving spouse** is an unmarried filer with a dependent child,
for the two years *after* the year a spouse died. Almost every state puts her on
the joint rate schedule, and this package did it everywhere — which is right in
the nine states that carry the status and silently wrong in the four that do not,
where she was being handed a married couple's brackets, deduction and exemptions
on one person's income. **Wisconsin was `$2,861.08` a return at `$450,000` and
`$673.33` at `$90,000`; Alabama `$385.00` at `$18,000` falling to `$240.00` above
`$35,500`; Mississippi `$208.00` from `$30,000` up and `$124.00` at `$26,000`.**
Every error was in the flattering direction, which is the kind that does not
generate a complaint — and none of the three is flat in income, which I had
written that two of them were until the differential grid's two cheapest widows
said otherwise.

**And the deciding words are not the ones anybody would guess.** A state with no
surviving-spouse status is *not* a state that files her as single, and *not* a
state that files her as head of household. It is whichever its own instruction
says — and the instruction turns on whether its head-of-household box reads *"if
you qualify to file as head of household on your federal return"* or *"...as head
of household **or qualifying surviving spouse** on your federal return"*. The
first **denies** her the box, because 26 U.S.C. § 2(b)(1) admits only an
individual who *"is not married at the close of his taxable year, is not a
surviving spouse"*; the second **grants** it. Wisconsin and Arizona print the
second, Alabama and Massachusetts the first, and Mississippi writes its own
definition that never mentions § 2(b) at all. Five states, three different
answers, one question — and I had the wrong answer written into yesterday's
worklist, which said Wisconsin would file her as **single**. It is head of
household, and the gap between the two is `$142` at `$45,000`.

**One state's answer is still open and the engine says so rather than guessing.**
Arizona files her as a head of household *and* Arizona's standard deduction is
defined as the **federal** one, which § 63(c)(2)(A) sets at the joint amount for a
surviving spouse. So the two halves of her Arizona return are chosen by two
different governments and they disagree: the instruction booklet prints an amount
against the *box*, the statute points at *§ 63*. Nobody has read which governs, it
is `$201.25`, and the result carries a note saying exactly that. **THE RULE a
column swap reaches every figure the state CHOSE and none of the figures it
BORROWED** — Arizona is the only state here that is both.

**I broke something with today's fix and caught it by reading my own diff.** The
engine warns a caller who passes a dead spouse's age on a widow's return that the
field describes nobody and was dropped. Rewriting her filing status to the
column her state actually uses made that warning stop firing in the four states
the fix touched — which are exactly the states where a caller is most likely to
think the status means two people, because those are the states with no box for
her. The tax was never wrong; only the warning went quiet, which is the hardest
kind of defect to notice. One word to fix, a test that fails without it, and
eighty minutes of a quality audit thrown away and restarted.

**One of the five rows rests on an absence and is written down as such.**
Massachusetts keeps the single column, which is what this package already did, and
the evidence is that its Form 1 instruction ties the head-of-household box to
qualifying *federally* and was not seen to name the surviving-spouse status as an
alternative. **"Was not seen to name" is not "does not name."** If Massachusetts
does name her, she belongs with Wisconsin and Arizona and is `$120` better off at
`$45,000`. It is one sentence of one booklet and `mass.gov` is blocked by the
egress proxy, so it is at the top of tomorrow's list rather than resolved.

**Two npm descriptions were advertising the wrong number of states**, which is
the one surface none of this project's own tests had ever reached. `us-state-tax`
said 31 states and `us-tax-mcp` said 29, against 33 — four states and four days
stale. That sentence is what `npm search` prints and what the registry page opens
with, read far more often than any README. It is fixed, and a test now computes
every count in all three descriptions from the engine.

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

**The mutation audit went DOWN and then up, and the down is the honest
headline.** Wisconsin's first run was 1,358 mutants, **11 survivors, 99.2%**
against Day 42's 99.5% — the first fall since this instrument was built, because
five of Wisconsin's 82 mutants survived. Four were a constant
`WI_TOP_BRACKET_BASE`, holding the statutory bases the whole 2026 derivation
rests on, that **nothing read**: its own comment pointed at a test which
deliberately writes its own copy of the figures. One was a conditional that could
never be false. Both fixed, and the re-run came in at **1,357 mutants, 1,351
killed, 6 survivors, 99.6%** — the highest this package has recorded, with all
four figures predicted in writing before the run.

A score that can go down is the only kind worth quoting, and this is the
instrument finding something real in code written the same morning.

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

**This package covers twenty-SIX of the forty-two jurisdictions that tax income**
(it said twenty-four when this section was written on Day 39; Minnesota closed one
and South Carolina the other). The missing sixteen are
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
test machinery. Five states in five days, and South Carolina on Day 49 took one
day while being mid-rewrite. So the remaining **sixteen** are **about three weeks
of runs** at the current standard — and the estimate has
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
> JavaScript, plus an MCP server. 35 states, 1,033 localities, two tax years,
> every figure cited to the release it came from and a measured mutation score.
> MIT.

(That said "30 states" from Day 22 until Day 56, which is a figure this file had
nobody checking. It is **35 states — 26 of which charge an income tax** — and the
nine with none are modelled too, because answering "Texas charges you nothing" is
a different thing from not knowing about Texas.)

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
