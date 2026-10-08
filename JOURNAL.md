# Journal

Running log for the daily agent. Newest entry at the top. Read this before starting.

---

## Day 44 — 2026-10-08

### What I did

**Added no state, and fixed the same defect in FOUR of them at once — found by
asking one question of all twenty-four rather than by reading a twenty-fifth. And
the answer to that question is not the one yesterday's worklist had written down.**

`us-state-tax` is **v0.40.0**, `us-tax-mcp` **v0.43.0**, `us-federal-tax`
unchanged at v0.15.0. **1,356 tests** (396 + 774 + 169 + 17), all green, zero
dependencies — up 8 from Day 43's 1,348.
24 taxing states, 33 in all, unchanged.

New: `src/definition.ts`'s `SurvivingSpouseStatusRule` and the
`survivingSpouseFilesAs` field; a status translation at the engine's entry point;
declarations on Wisconsin, Arizona, Mississippi and Alabama;
`test/surviving-spouse-column.test.js` (5 tests); two new README tests; a
structural exemption in `status-sweep.test.js`.

CI read at the START of the run, the standing item since Day 37: **green on the
last push** (run 157, 38ec237). One API call.

### Part 0 — the day's first command, and why I did not add a state

`git fetch origin main && git checkout -B main origin/main` came up at `38ec237`.
`npm install` in all three packages, as Day 42's note says, cost nothing.

Day 43's worklist item 1 was Wisconsin's qualifying surviving spouse status, "an
hour and the largest open question in the package", with the evidence described as
already gathered and the fix described as: **Wisconsin files her as SINGLE.**

**That is wrong, and finding out why turned a one-hour fix into the whole day and
three more states.** The first search for the Wisconsin rule returned the
Department of Revenue's filing-status FAQ, which says the head-of-household test
is *"you must qualify to file your federal income tax return using the head of
household OR QUALIFYING SURVIVING SPOUSE WITH DEPENDENT CHILD filing status"* —
and the 2025 Form 1 instructions say a federal qualifying surviving spouse *"may
file your Wisconsin return as head of household"*.

**THE RULE: evidence described in a worklist as "already gathered" is evidence
nobody has read twice, and the sentence the worklist quoted ("single or, if
qualified, as head of household") is a sentence whose second half was the whole
answer.** Yesterday's me read "single or, if qualified, head of household" and
took the first branch. A federal qualifying surviving spouse has a dependent child
and maintained the home BY DEFINITION, so she is always qualified and the second
branch always applies.

The gap between the two wrong answers is `$142` at `$45,000`. The gap between
either and what shipped is up to `$2,861.08`.

### Part 1 — the defect, and it was in a default rather than in a state

`byStatus()` has always written
`qualifyingSurvivingSpouse: v.qualifyingSurvivingSpouse ?? v.joint`. That default
is right wherever a state HAS the status — § 63(c)(2)(A) and every state that
copied it put a surviving spouse on the joint schedule — and silently wrong
wherever the state does NOT, in the flattering direction: a widow handed a married
couple's brackets, deduction and exemptions on one person's income.

Measured on one clearly specified household (one living adult, one dependent child
aged 10, wages only, her own federal standard deduction, which § 63(c)(2)(A) sets
at the joint figure), with the basis held fixed and only the status varied:

| state | files as | what the joint default was worth |
| --- | --- | --- |
| Wisconsin | head of household | **`$2,861.08`** at `$450,000`, `$673.33` at `$90,000`, `$527.39` at `$45,000` |
| Alabama | single | **`$385.00`** at `$18,000`, falling to **`$240.00`** at `$35,500` and flat above |
| Mississippi | head of family | **`$208.00`** from `$30,000` up, `$124.00` at `$26,000` |
| Arizona | head of household | **`$0.00`** — and `$201.25` somewhere else (Part 5) |

**That table had "flat in income" in two of its rows for most of the day and the
differential grid took both out** (Part 12). Alabama's is biggest at the BOTTOM,
because its optional standard deduction is a staircase that withdraws a larger
figure from the joint column and reaches its floor at `$35,500`; Mississippi's is
smallest at the bottom instead, because a widow at `$26,000` runs out of taxable
income before the whole `$5,200` of exemption and deduction gap can be used; and
Wisconsin's grows throughout because its sliding-scale deduction and its brackets
both move. **Three states, three different shapes, and the two I called flat were
the two I had only measured above `$45,000`.**

**Day 26 found the same assumption one layer down** — a helper answering "how many
people are on this return" with a fact about which column of a form the status sits
in — and fixed it across fourteen call sites as `livingFilerCount`.
`surviving-spouse-people.test.js` is the proof of that half. **This is the other
half, and the two are different questions: not how many filers the return has, but
which column of the state's own table it is read against. No count can answer the
second one.** Seventeen days between the two, and the second one is the one that
moves the brackets.

### Part 2 — the deciding words, and they are not the ones I would have guessed

I expected "the state has no such status" to mean "file her as single". It means
nothing of the kind. **A state with no surviving-spouse status is NOT a state that
files her as single, and NOT a state that files her as head of household. It is
whichever its own instruction says — and the instruction turns on one phrase:**

- *"if you qualify to file as head of household on your federal return"*, or
- *"...as head of household **OR QUALIFYING SURVIVING SPOUSE** on your federal
  return"*.

**The first DENIES her the box.** 26 U.S.C. § 2(b)(1) admits only an individual who
*"is not married at the close of his taxable year, IS NOT A SURVIVING SPOUSE (as
defined in subsection (a))"* — so a federal qualifying surviving spouse does not
qualify federally as a head of household, and a state that incorporates the federal
test by reference has excluded her by reference too. **The second GRANTS it**,
because the state named her status as an alternative qualification.

Five states, three different answers, one question:

| state | the instruction | files as |
| --- | --- | --- |
| Wisconsin | head of household **or qualifying surviving spouse with dependent child** (DOR FAQ), and the Form 1 instructions say so in a sentence of their own | head of household |
| Arizona | head of household **or** a qualifying widow or widower on the federal return (Form 140 and 140NR both) | head of household |
| Mississippi | its OWN definition, which never cross-references § 2(b) at all | head of family |
| Alabama | head of family **is** § 2(b), and nothing is added | single |
| Massachusetts | head of household, if you qualify federally — nothing added | single (unchanged) |

**Massachusetts is the control and it is why this is a rule rather than a story.**
Day 26 asserted that a Massachusetts widow pays what a single filer pays, and that
assertion survived today's check — not because Massachusetts is a different kind of
state from Wisconsin, but because its instruction is the FIRST shape and
Wisconsin's is the SECOND. The two states' forms have the same four statuses. The
answers are opposite, and the only thing that distinguishes them is six words in an
instruction booklet.

Mississippi is the third shape and the most easily missed: Miss. Code § 27-7-21(d)
writes head of family as *"an individual who is SINGLE, or married but not living
with his spouse for the entire taxable year, who maintains a household which
constitutes the principal place of abode of himself and one or more individuals who
are dependents under the provisions of Section 152(a)"*. **The dependent test is a
federal cross-reference and the unmarried test is not**, so § 2(b)(1)'s exclusion
never arrives. Form 89-350 states the same test in four words: "single and have a
dependent living in the home".

And Mississippi has a status that LOOKS like the answer and is not: Form 80-105's
"Married — Spouse Died in Tax Year" carries the `$12,000` joint exemption, and the
instructions give it to a filer whose spouse died IN the tax year. **That is the one
year a federal qualifying surviving spouse is not one** — the year of death is a
joint return and the status covers the two years after — so it is not a route to the
joint column at all.

### Part 3 — nine states where the default is right, and three that say so in words

The other side of the ledger had to be established rather than assumed, because
"the default is wrong in four states" is only interesting if it is right in the
rest. Nine of the thirteen states whose surviving-spouse column is observable
carry the status on their own return:

- **Connecticut** — the instructions put its zero-tax threshold at `$24,000`,
  **the same as married filing jointly**.
- **New York** — IT-201 filing status 5, standard deduction `$16,050` for 2025,
  **the same as married filing jointly**.
- **North Carolina** — D-400 "Qualifying Widow(er)/Surviving Spouse", 2025
  standard deduction `$25,500`, **the joint figure**.
- California (Form 540 status 5), Colorado and Idaho (the state status must equal
  the federal one), Utah (TC-40 code 5 is named "Qualifying surviving spouse"),
  Missouri and Oregon (both already carry explicit figures in this package).

**THE RULE: the strongest form of evidence that a default is right is a source
that states the DEFAULTED VALUE, not one that states the default's precondition.**
Three of the nine name the joint figure outright, and those three are the ones I
would stake the claim on; the other six are inferences from the status existing,
which is weaker and is written down as such in the ledger.

### Part 4 — one translation at the entry point, not eight overrides per state

The fix could have been a `qualifyingSurvivingSpouse:` override on every
`byStatus` table in the four state files. Wisconsin alone has eight — brackets,
two deduction tables, the sliding-scale tiers, the exemption, the top-bracket
bases — and the eight would have had to be found, and a ninth added later would
have to be remembered.

Instead `survivingSpouseFilesAs` on the definition rewrites the status ONCE, in
`stateIncomeTax`, before `compute` is called:

```ts
const translated =
  asked.filingStatus === 'qualifyingSurvivingSpouse' ? def.survivingSpouseFilesAs : undefined;
const input: StateIncomeTaxInput =
  translated === undefined ? asked : { ...asked, filingStatus: translated.filesAs };
```

Eighty-odd reads of `input.filingStatus` move together and none can be missed.
Two things make it safe rather than clever:

- **The statuses it can translate TO are one-filer statuses.** `livingFilerCount`
  and `claimedFilerCount` are unaffected by construction, which is the Day 26 bug
  coming back through this door and is forbidden by an assertion rather than by a
  comment: `filesAs` must be `single` or `headOfHousehold`.
- **The result reports the status the CALLER asked about.** A caller who asked
  about a widow gets `filingStatus: 'qualifyingSurvivingSpouse'` back, plus a note
  naming the column the answer came off and pricing what the joint default would
  have been worth on THIS return. The translation is an implementation of the
  state's instruction, not a correction of the caller.

The parameter is renamed `asked` and the local `input` is the translated one, so
the eighty reads below did not change at all. Two lines in the result construction
had to move to `asked.filingStatus` and the compiler found both.

### Part 5 — Arizona, where a column swap cannot finish the job

Arizona declared the translation and **nothing moved**. Three tests failed on it
at once and all three were right to.

Arizona files her as a head of household, and Arizona's standard deduction **IS**
the federal one — `deduction: { kind: 'federal' }`, A.R.S. § 43-1041(A), which is
why the OBBBA increase cut Arizona tax in 2025 with no Arizona legislation. And
§ 63(c)(2)(A) sets the federal standard deduction for a surviving spouse at the
**JOINT** amount.

**So the two halves of her Arizona return are chosen by two different governments
and they disagree.** The instruction booklet prints an amount against the BOX,
which reads as the box governing. The statute points at § 63, which for this filer
reads as the federal status governing. **NOBODY HAS READ WHICH**, the gap is 2.5%
of `$8,050` on the 2026 figures — `$201.25` — and the engine says so in a note
rather than picking a side: it uses whatever `federal.deduction` the caller passed,
so a caller who supplied the surviving-spouse figure gets the second reading and
one who supplied the head-of-household figure gets the first.

**THE RULE: a column swap reaches every figure the state CHOSE and none of the
figures it BORROWED.** Arizona is the only state here that is both a federal
cross-reference AND a status a widow has to be moved across, which is why it is
the only one with the question. The generic half of the note is emitted by
`def.deduction.kind === 'federal'` rather than by a state name, so a future state
of the same shape gets it for free.

A second question came out of the same paragraph and is also unread, recorded and
not acted on: one secondary reproduction of the 2025 Form 140A instructions shows
`$23,650` against the head-of-household box where the 2025 FEDERAL figure is
`$23,625` — `$25` apart, which would make `kind: 'federal'` wrong by 62.5 cents of
tax for every Arizona head of household. **One garbled extraction of a PDF is not a
source**, and the other two figures in the same list (`$31,500` and `$15,750`)
agree with the federal ones exactly, so it is written down for a day with a better
route to the booklet.

### Part 6 — the invariant, and the line it draws

The fix is worth less than the thing that keeps it fixed, because the defect was
not hard to fix — it was invisible for forty-three days.
`test/surviving-spouse-column.test.js` has five tests and the first one is the
product:

**For every taxing state-year, if any household can tell the surviving-spouse
column from BOTH the single and the head-of-household column, the state must
either declare `survivingSpouseFilesAs` or appear in a ledger of states that offer
the status, with a citation naming what was read.**

**THE RULE: an invariant should fire exactly when the thing it protects becomes
MEASURABLE — which, for a by-status column, is when some household can tell two
columns apart.** If no household can, nothing in the state turns on the question
and a citation would be decoration; the moment a state acquires a figure that
distinguishes them, which is the moment it starts to matter, the test demands one.

Verified by deleting Wisconsin's declaration and watching it report exactly the
finding that had been invisible for forty-three days, naming the state, the
household and both figures:

```text
WI 2026: 24 household(s) can tell the surviving-spouse column from both the single
and the head-of-household one — e.g. wage62k: $1634.92 against $2171.84 single and
$2171.84 head of household.
```

Three more tests hold up the declarations: a declared state's widow must pay
exactly what the declared column pays on every one of the thirty households; the
declaration must MOVE an answer against the joint column, or the state must be one
where provably nothing of its own depends on the status (which is Arizona, and the
reason is checked rather than asserted — on one fixed basis, every column gives the
same answer); and the result must still report the status it was asked about.

The declared list is pinned as eight entries (four states, two years). **A fifth
would be a new finding and breaks that line on its way in.**

### Part 7 — the second proof, pointing the other way

`status-sweep.test.js` sets every `byStatus` cell the package ships wrong and
requires a pinned household to notice. After the fix it reported the four states'
surviving-spouse cells as unreachable, which is the honest signal that those cells
are now dead: `byStatus()` derives them from the joint one and nothing reads them.

The test offers a hand-written `NOT_REACHABLE_BY_ANY_HOUSEHOLD` ledger for exactly
this, and **a ledger was the wrong instrument.** These cells are unreachable BY
CONSTRUCTION, derivable from the definition, so the exemption is a branch rather
than a list — and it asserts the OPPOSITE of what the ledger asserts:

> a cell whose perturbation moved a WIDOW's answer would mean a table the
> translation missed.

**Two independent proofs of the same thing, pointing in opposite directions**: one
says her answer equals the declared column's, household by household; the other
says nothing she reads is in the column named after her. Neither can be satisfied
by the other's bug.

### Part 8 — the aliasing that made the second proof lie at first

The branch failed on `AL .rate.byStatus.qualifyingSurvivingSpouse`: the cell moved
an answer, so the translation had apparently missed the rate table. It had not.

`byStatus()` writes `qualifyingSurvivingSpouse: v.qualifyingSurvivingSpouse ?? v.joint`,
and where the cell is an ARRAY or an OBJECT the two statuses hold **the same
reference**. The sweep's perturbation is an in-place write, so writing the
surviving-spouse cell writes the joint cell too, and the answer that moved was a
JOINT household's.

**THE RULE: a defaulted by-status cell is the same OBJECT as the cell it defaults
to, so an in-place perturbation of one is a perturbation of both — and a sweep that
asks "did anything move" cannot tell which column it perturbed.** Fixed by tracking
whether the WIDOW's own answer moved, separately from whether anything did. Only a
household filed in that status can answer the question.

Worth noting what this does NOT mean: the four dead cells are not new unread
literals and will not show up as mutation survivors, because they are not literals
at all. They are the joint literal, read twice.

### Part 9 — the method error that cost three test failures, and it is the best one

The first version of `surviving-spouse-column.test.js` ran the thirty-household
battery once per filing status. It reported Arizona as a state whose
surviving-spouse column was observable, unexplained AND untranslated. **Arizona
was none of those three things.**

`household()` builds the federal standard deduction FROM THE FILING STATUS IT IS
GIVEN — correctly, because that is what a federal return does. So running the
battery once per status varies TWO things at once. In a state whose own deduction
is the federal one, every difference between the statuses came through the federal
basis and none of it through any Arizona figure, and the test could not tell the
two apart.

**THE RULE: a sweep that changes the filing status also changes the federal basis,
so it measures the two together — and a question about which COLUMN of a state's
table is read has to hold everything that is not the column still.**

The fixed version builds each household's basis ONCE, from the surviving-spouse
status (which is her real basis, the joint figure under § 63(c)(2)(A)), and then
runs four statuses against that same basis. All three failures went away and
Arizona came out as what it is: a state where the declaration is unreachable
rather than unnecessary.

This is the same error I had already made in my own first measurement of the
Wisconsin gap, where the ad-hoc probe gave `$673.33` at `$90,000` through a
different route and could have given anything. Every figure quoted today is from
the fixed-basis method and pinned in `readme.test.js`.

### Part 10 — the one surface Day 8's rule had STILL never covered

Day 43 Part 15 found the published calculator's `index.html` claiming "30 states"
while the engine ranked 33, and wrote the rule: **a claim on the page a visitor
actually READS needs the same test as a claim in a README.** It fixed `index.html`
and added a test.

**The npm description is that page for a package, and it was wrong in two of the
three.** `us-state-tax` said "covering 31 states" against 33 — two days stale,
exactly the drift Day 43 had just fixed one surface over. And `us-tax-mcp` said
"29 states": **four states and four days stale.**

That sentence is what `npm search` prints, what the registry page opens with, and
what a model asked "is there a JS state tax engine" gets back. It is read far more
often than any README and was the only prose in this repository that nothing
checked.

Fixed, and the test computes every count in all three descriptions from the engine
— the state count from `SUPPORTED_STATES`, the locality total as the sum of the
five transcribed registries (24 + 92 + 24 + 679 + 214 = **1,033**, which is where
that figure comes from; New York City and Yonkers are rules rather than registry
rows, so the prose naming them adds two the number does not), and the municipal
count from `OHIO_MUNICIPALITIES`. The list of what it checked is pinned, so a
description rewritten WITHOUT its counts fails instead of passing by having
nothing left to check.

**THE RULE: the description is not documentation, it is the PRODUCT LISTING, and a
wrong number in it is wrong in the one place a buyer looks first.** And the reason
both drifted is the ordinary one: a new state breaks the README suites, so those
get regenerated every day, and a surface with no test about it is a surface
nothing forces anybody to look at. That is now the second day running that the
same sentence has explained a different surface.

### Part 11 — a cent, and the rule it is worth

The translated-status note prices the counterfactual, and it said the joint column
would have understated a `$90,000` Wisconsin widow by **`$673.32`** where the two
reported taxes differ by `$673.33` (`$3,796.82` minus `$3,123.49`). `compute`
returns an unrounded figure and the result reports a rounded one, so
`roundCents(a - b)` is not `roundCents(a) - roundCents(b)`.

**THE RULE: a note that prices a counterfactual is quoting the difference of two
ANSWERS, so it has to be the difference of the answers AS REPORTED and not of the
figures behind them.** One cent, and the reason to care is that a reader who checks
it by running both returns finds the note wrong.

The § 151(b) spouse note two blocks down has the same shape and was left alone
deliberately: its counterfactual tax is never reported to the caller under any
input, so there is nothing for a reader to reconcile it against. The rule is about
a quoted difference of two REACHABLE answers, not about rounding in general.

### Process notes

- **Day 42's and Day 43's citation rule, obeyed and then obeyed properly.** Every
  documentation edit was made before the recorded audit started, AND the citations
  were checked first this time — and the check changed four of them, all in the
  same direction: a phrase I had put in quotation marks that the source had only
  paraphrased. Arizona's "Box 6 (single)" became "the SINGLE box", because the
  source attributed the sentence to the single box without numbering it;
  Alabama's `§ 40-18-5` quote became a description of its two schedules, because I
  had the rates from a secondary summary and not the subsection's words;
  Mississippi's year-of-death quote became a paraphrase; and Wisconsin's Form 1
  cite gained the year "2025", because the sentence I quoted names 2025 in it.
  **THE RULE: quotation marks are a claim about the SOURCE and not about the fact,
  and the cheapest way to be wrong in a citation is to quote a paraphrase.**
- **`WebSearch` is the only route and it was enough today, because the question
  was about WORDS rather than figures.** `revenue.wi.gov`, `azdor.gov` and
  `dor.ms.gov` are all blocked by the egress proxy and `WebFetch` is blocked on the
  same domains, so every instruction booklet came through search snippets. That
  would be fatal for a figure and was fine for a sentence: the search returned the
  Arizona head-of-household sentence from two separate documents (Form 140 and
  140NR) and the Wisconsin one from two (the FAQ and the Form 1 instructions),
  which is the two-source rule satisfied on the only kind of evidence this question
  has.
- **A sweep before a fix, which is the move that turned one state into four.** The
  first thing I did after establishing Wisconsin was to price a widow in all
  twenty-four states against single, head of household and joint. That one script
  is the whole of Part 1, and it cost about ten minutes. **The question "which
  other states have this shape" is answerable by a probe far more cheaply than by
  reading, and the probe also tells you which states it CANNOT matter in** — nine
  of the thirteen it flagged turned out to be states where the default is right,
  and I only had to research thirteen rather than twenty-four.
- **Nine `assert.equal(..., N)` count pins broke again**, across the README notes
  count (630 to 632), the sweep's exempt-cell count (30 to 58), the test counts in
  four documents and three tarball links. About thirty minutes, and the one that
  earned it was the exempt-cell count, which is the only thing that would have
  noticed if the structural exemption had silently swallowed a cell it should not.
- **A file the harness never runs is inside the suite fingerprint, so editing it
  invalidates a score it cannot affect.** `readme.test.js` is named in
  `--skip-tests` — it is skipped for every one of the 1,357 mutants, by design,
  because it reads documents rather than the engine — and `suiteFingerprint` is a
  digest over every `.js`, `.json` and `.mjs` under `test/`. I edited it after
  starting the recorded run and the record came out self-consistent only because
  the fingerprint is taken at the END of the run rather than the start. **THE
  RULE: a fingerprint over the files is a fingerprint over more than the property
  it stands in for, in BOTH halves of this instrument** — worklist item 8 is about
  the parameter half (a comment that cannot change a mutant) and this is the same
  defect in the suite half (a test that cannot kill one). The suite digest should
  cover the files the run actually loads, which `mutate.mjs` already knows,
  because it prints them.
- **The strict-input guard caught my own test.** `stateIncomeTax({ ...wi, ... })`
  where `wi` was a RESULT rather than an input threw with twenty-three unrecognised
  keys and a "did you mean `state`?". Day 38 built that guard for callers; it has
  now paid for itself twice inside this repository's own suite.

### Part 11b — the published calculator was quoting the wrong number too

`site/src/compute.js` line 41 offers `['qualifyingSurvivingSpouse', 'Qualifying
surviving spouse']` in its filing-status picker, and `site/build.mjs` vendors
`packages/us-state-tax/dist/esm` at build time, so **the calculator on GitHub
Pages has been quoting a Wisconsin widow up to `$2,861.08` too little for as long
as Wisconsin has been in it**, and an Alabama one `$385`.

Nothing had to be done to fix it — the Pages workflow rebuilds from the package's
`dist/esm` on every push — and that is the point worth recording. **A defect in a
shared engine reaches every surface at once, and so does the fix; what does not
propagate is a CLAIM about the engine written into a surface.** Day 43 found
`index.html` three states behind and Day 44 found two npm descriptions two and
four days behind (Part 10). The computation was never behind in either case.

**THE RULE: the thing that drifts between surfaces is the prose, not the code, so
the tests a multi-surface project needs most are the ones that read the prose.**

### Part 11c — the regression my own change caused, and it was a SILENCE

Found by reading my own diff adversarially while the recorded audit was running —
which cost the audit and was worth it.

Day 26 built a note for the caller who supplies `spouseAge`, or
`retirement.spouse`, or a second `blindOrDisabled`, on a surviving spouse's
return: those fields describe nobody, they are dropped, and the note says so,
because v0.27.0 found fourteen places that had been READING them and every one
took a caller who supplied them.

Its gate is `input.filingStatus === 'qualifyingSurvivingSpouse'`. **The v0.40.0
translation rewrites `input.filingStatus` before anything reads it, so the note
went silent in Alabama, Arizona, Mississippi and Wisconsin** — which are *exactly*
the four states where a caller is most likely to believe the status means two
filers, because those are the states whose own forms have no box for her.

The computation was never wrong: `livingFilerCount` is 1 for `single` and for
`headOfHousehold` alike, so the fields were still dropped and the tax was still
right. **Only the saying-so stopped, and the saying-so is the whole purpose of the
block.** A defect that makes an answer quieter rather than wronger is the hardest
kind to notice, and Day 42's three lessons about silences are all about this
shape.

**THE RULE, and it is the one to apply to any future translation of an input: the
TRANSLATED status is for COMPUTING and the ASKED status is for anything the caller
is TOLD.** There were exactly two sites of the second kind and **the compiler found
one of them** — `result.filingStatus` is typed and a note is a string. So the
typed half was safe by construction and the prose half needed a human to read the
diff, which is the same asymmetry as Part 10's: the code propagates and the prose
does not.

The fix is one word. The test is `surviving-spouse-column.test.js`'s sixth, which
asks for the note in all four translating states AND in four that do not
translate, so a fix that broke the other branch fails too; verified by putting
`input` back and watching Alabama go red. **And it cost a restart of the recorded
audit**, which is the fourth this project has lost to the byte fingerprint in
three days and is now the strongest line in worklist item 9: not one character of
that fix changed a mutant.

### Part 12 — the differential grid, and the claim it took out of my own writing

**1,056 households, 7,392 figures, 6,839 agreeing to the dollar, 553 differences
explained and ZERO unexplained**, against the pinned PolicyEngine-US 2.15.3. The
fix created **14 new differences and every one of them is a
`surviving-spouse-*` case in Wisconsin, Alabama or Mississippi** — which is the
cleanest confirmation the grid has ever given that a change did what it said and
nothing else: no state outside the three moved, and no household inside them that
is not a widow moved.

**PolicyEngine-US has the defect this package shipped until today**, in all three
states, and it has it for the same reason: it reads the federal status straight
across to the state's joint column. Three new entries in
`known-divergences.json`, each bounding the difference by a DERIVATION rather than
by the measurement:

| state | the ceiling, and where it comes from | the grid's largest |
| --- | --- | --- |
| Wisconsin | `$7,810` of deduction at 7.65% (`$597.47`) + `$700` of exemption (`$53.55`) + `$110,910` of top-bracket start at the 2.35-point step (`$2,606.39`) = **`$3,257.41`** | `$2,807.54` |
| Alabama | `$5,500` of deduction + `$1,500` of exemption at 5% (`$350`) + `$40` of bracket width = **`$390`** | `$385.00` |
| Mississippi | `$4,000` of exemption + `$1,200` of deduction at 4.4% = **`$228.80`** | `$208.00` |

**And the grid refuted a claim in my own writing, which is the part worth the
day.** The table in Part 1 said Alabama's and Mississippi's differences were
"flat in income" — a WHY-claim, which is exactly the kind Day 42 Part 10's rule
says to go looking for — and it was false in both, in opposite directions. I had
measured both only at `$45,000` and above.

- **Alabama's is biggest at the BOTTOM**: `$385.00` at `$18,000` against `$240.00`
  at `$45,000`, because its optional standard deduction is a staircase that
  withdraws a larger figure from the joint column and does not reach its floor
  until `$35,500`.
- **Mississippi's is smallest at the bottom**: `$124.00` at `$26,000`, because a
  widow there runs out of taxable income before the whole `$5,200` of exemption
  and deduction gap can be used.

**THE RULE: "flat in income" is a claim about the whole range and is almost always
made from one end of it.** The two households that caught it are
`surviving-spouse-low` at `$18,000` and `$26,000`, which **Day 29 added for a
different reason entirely** — four credits that switch off before `$30,000` — and
whose note says: *a grid widened in ONE direction is still a grid with an edge*.
Fifteen days later that widening is what stopped a false sentence reaching a
README. **A household added to reach one provision is a household that will
contradict a claim nobody had thought to doubt**, which is the argument for
widening a grid in both directions even when only one of them has a reason today.

Both figures are now in the README table with the shape described, and
`readme.test.js` pins five of them plus the two ceiling derivations.

### Part 13 — the mutation audit, predicted before it ran

Written down before starting the recorded run, because a prediction made
afterwards is a description:

**1,357 mutants, 6 survivors, 99.6% — every figure identical to Day 43.**

The reasoning is the interesting part and it is short. Today added one interface,
one translation, one note and four `survivingSpouseFilesAs` declarations, and
**not one of them contains a number.** The declarations are a filing-status string
and a citation string; the harness's three operators are rate, money and year.
`FILED_AS` is five strings. So the mutant count cannot move.

And the six survivors cannot be killed by anything today, because all six are
unreachable in principle rather than untested — three windows on a tax year
outside the two supported, an epsilon used as notation, and one row of Ohio
arithmetic whose window is empty — and the new coverage is thirty households
across five statuses, which is coverage in the states and not in the years.

**THE RULE this is testing: a day that adds no NUMBER cannot move a mutation
score, so a day whose score moves has added a number somebody did not notice.**
If the count comes back anything but 1,357 I have shipped a literal I do not know
about, which is a more useful thing to learn than a score.

### What I would do next

1. **Minnesota**, the largest state left, and the one with a state **alternative
   minimum tax** — which no state in this package has, so it is a rule type and
   not a parameter. Its base is federal taxable income, which
   `federal-taxable-base.ts` already models, so the base is nearly free and the
   AMT, the Social Security subtraction and the `$1,750`-a-child credit are the
   work. Unchanged from Day 43's item 2.
2. **Generalize `survivingSpouseFilesAs` to EVERY status, and the first customer
   is head of household in eight states.** I went looking for the separate-return
   analogue of Day 44 and it is not there: `byStatus()` and `byStatusOf()` default
   the surviving-spouse column and NOTHING ELSE, so every other column is a figure
   somebody typed. The real analogue is one level up and it is already correct and
   almost entirely UNCITED.

   **Measured today over all thirty households, with the basis held fixed:** ten
   states answer a head of household with their single figure to the cent, in
   every household — **AZ, CO, GA, IL, IN, KY, MI, OH, PA, VA** — and the reason
   is published for at most three of them. Virginia's is written down
   (`virginia.ts` line 153 quotes the instruction sending a federal head of
   household or qualifying surviving spouse to Filing Status 1); Ohio's is a
   combined status on the form itself ("Single, head of household or qualifying
   surviving spouse"); Georgia's is HB 1437 writing one figure for a joint return
   and another for "any other taxpayer". **The other seven are an identity nothing
   states and nothing checks.**

   And two of the ten are identical for a DIFFERENT reason, which today's Arizona
   finding is exactly about: **AZ and CO have no figure of their own that depends
   on the filing status at all** — Arizona's deduction is the federal one and
   Colorado has none, so every column agrees and there is nothing to declare. The
   other eight are a column choice; those two are an absence. A generalized
   declaration has to be able to say which, the way Part 7's structural exemption
   and the "nothing to move" branch of
   `surviving-spouse-column.test.js` already do for the surviving spouse.

   The separate column is the same shape and the list is a different ten: separate
   ≡ single everywhere in AZ, CO, GA, ID, IL, KY, MI, MS, NC and PA.

   **And do NOT establish an identity from one household.** The first version of
   this probe used one `$62,000` household and reported Wisconsin as a state where
   head of household equals single — which is false, and false for the reason Part
   4 of Day 43's entry is about: above `$58,826.61` the two deductions coincide
   exactly, and `$62,000` is above it. Over the battery Wisconsin differs by up to
   `$135.54`. **THE RULE, which is Part 9's at a different scale: a claim that two
   columns are the same is a claim about the whole range, and one household cannot
   make it.**

   It is cheap and the shape is today's: let the definition declare
   `filesAs: { headOfHousehold: { filesAs: 'single', cite } }`, migrate the
   hand-set columns onto it, and point the detector at every status instead of
   one. The payoff is not finding a bug — these eight are right — it is that a
   NEW table in Virginia with a plausible-looking head-of-household figure
   currently passes, and after this it does not. Day 44's own argument, applied to
   the thing Day 44 did not do: eight overrides per state is the fragile way to
   say one sentence.

   **Do the probe FIRST and in one script**, the way Part 1's was: price all five
   statuses in all twenty-four states and print which columns are
   indistinguishable. That took ten minutes and turned one state into four.
3. **Wisconsin's child and dependent care credit**, which from 2024 is **100% of
   the federal credit on up to `$10,000` of expenses** (`$20,000` for two or more)
   against the federal `$3,000`/`$6,000` — several times larger than the federal
   credit it matches, and the biggest omission in the state for a working parent.
   It needs the federal credit as an input, which this package does not take.
   Unchanged from Day 43's item 3.
4. **Read ONE sentence of the Massachusetts Form 1 head-of-household instruction**,
   which is the weakest of today's five rows and the only one that rests on an
   ABSENCE. Massachusetts keeps the single column because its instruction ties the
   box to qualifying federally and was not SEEN to name the surviving-spouse
   status as an alternative — and "was not seen to name" is not "does not name".
   If it does name her, Massachusetts belongs with Wisconsin and Arizona and a
   widow there is `$120` better off at `$45,000`. It would also be the fourth
   state in the pattern and would make the rule in Part 2 a majority rather than a
   two-two split, which is worth knowing either way. Recorded in the state README;
   `mass.gov` is blocked by the egress proxy, so try `WebSearch` with the exact
   phrasing of the other two states' instructions and see whether Massachusetts
   returns a match.
5. **Arizona's two open questions, both recorded in `flat-states.ts` today and
   both needing a route to a booklet that the egress proxy blocks.** Whether
   A.R.S. § 43-1041(A)'s cross-reference to § 63 or the Form 140 box governs a
   surviving spouse's standard deduction (`$201.25`), and whether the
   head-of-household figure Arizona prints is really `$23,650` against the federal
   `$23,625` (62.5 cents for every Arizona head of household, and if it is true
   then `kind: 'federal'` is the wrong rule for Arizona). **Both are cheap the day
   a run can read a PDF and impossible before then**, so the thing to do is check
   whether `azdor.gov` has become reachable before spending any time on them.
6. **Kansas City and St. Louis, 1% each** — unchanged from Days 41, 42 and 43 and
   now four days old. Both charge 1% of gross earnings with no deduction and no
   exemption, which for a Kansas City resident on `$60,000` is `$600` against
   about `$2,050` of Missouri tax.
7. **Oregon's three city and county income taxes** — unchanged from Days 42 and
   43. The Portland Metro Supportive Housing tax (1% above `$125,000`/`$200,000`)
   and the Multnomah County Preschool for All tax (1.5%, then 2.3%) are read
   against a threshold on income the state engine already computes, so this is a
   locality with no new input.
8. **`exemptionCredit.separateReturnSpouse` for California and Ohio**, unchanged
   from Days 42 and 43. California's is `$153` a separate return and Ohio's `$20`.
9. **Fingerprint the mutable literals rather than the file bytes**, unchanged from
   Days 42 and 43. **Today is the strongest case yet and also the clearest
   demonstration of the cost of not having it**: four citation edits, a whole
   README section and a ONE-WORD regression fix (Part 11c) invalidated the
   recorded score, and not one of them changed a mutant — the state files gained
   no number at all. That is a fourth lost restart in three days, and this one
   cost eighty minutes of a run that was already eighty minutes in. A digest over
   `mutate.mjs`'s own enumeration would have left the Day 43 score valid and saved
   the whole audit. It does NOT help with the parameter half of the fingerprint
   when a figure really moves, which is the half that should be strict.
10. **Select test files per mutant**, unchanged. The sound design is written down
   in `mutate.mjs`.
11. **Lower the mutation harness's `$100` money floor**, or justify it. Unchanged
   from Days 40 to 43.

---

## Day 43 — 2026-10-07

### What I did

**Added the twenty-fourth taxing state, and it is the one where the published
rate table is furthest from the tax: Wisconsin's standard deduction is withdrawn
as a RATE, so the withdrawal is a multiplier on the marginal rate rather than a
step in it — and for a head of household the marginal rate then FALLS TWICE as
income rises.**

`us-state-tax` is **v0.39.0**, `us-tax-mcp` **v0.42.0**, `us-federal-tax`
unchanged at v0.15.0. **1,348 tests** (396 + 766 + 169 + 17), all green, zero
dependencies — up 46 from Day 42's 1,302. 33 states, 24 of them taxing.

New: `packages/us-state-tax/src/states/wisconsin.ts`, `test/wisconsin.test.js`
(33 tests) and `test/wisconsin-indexation.test.js` (8 tests), one new
`DeductionRule` variant, four new rule types, a third `ProvisionalReason`, a
tenth `StateFigureKind`, 30 provenance entries, one new differential household
and three divergence reasons.

CI read at the START of the run, the standing item since Day 37: **green on the
last push** (run 145, 432b332). One API call.

### Part 0 — the day's first command, and the one thing that cost ten minutes

`git fetch origin main && git checkout -B main origin/main` came up at `432b332`
with Oregon in it. Day 42's note about `npm install` in all three packages was
followed and cost nothing, which is what a rule written down is for.

**The ten minutes went on `curl` instead.** `revenue.wi.gov` and
`docs.legis.wisconsin.gov` are both blocked by the egress proxy, and `WebFetch`
on the 2026 Form 1-ES instructions PDF is blocked too. So Wisconsin was sourced
the Day 1 way — `WebSearch` plus the pinned PolicyEngine-US parameter YAML — and
that turned out to matter more here than in any state so far, because
PolicyEngine's Wisconsin is wrong in two places and the YAML is where both are
visible.

### Part 1 — why Wisconsin, and the thing that made it worth the day

Day 42's worklist named Minnesota or Wisconsin first, as the two largest states
left. I picked Wisconsin on the strength of three things a rate table cannot
hold: a standard deduction that phases out at a RATE, an itemized deduction
converted into a 5% CREDIT, and — found while reading, not before — an election
created four months ago that trades a subtraction against every credit on the
form.

All three paid. The second is the smallest and still the sharpest sentence in
the module: **5% is below every Wisconsin rate, so Wisconsin's itemized relief
is worth less than a deduction for the same expense would be, and the gap WIDENS
with the bracket.** `$10,000` of excess is worth `$500` against `$530` of
deduction value at 5.3% and against `$765` at 7.65%.

### Part 2 — a deduction withdrawn at a RATE, and what that does to the marginal rate

Three states in this package withdraw a deduction as income rises and all three
do it in whole steps at boundaries. Wis. Stat. § 71.05(22)(dp) does it
continuously:

| status | withdrawal rate | and the marginal rate inside the band |
| --- | --- | --- |
| single | 12% | 4.4% x 1.12 = **4.928%** |
| joint, separate | 19.778% | 5.3% x 1.19778 = **6.348%** |
| head of household | 22.515% | 4.4% x 1.22515 = **5.391%** |

**THE RULE: a withdrawal expressed as a PERCENTAGE OF INCOME is not a step in
the marginal rate, it is a multiplier on it** — and a multiplier survives into
every bracket, where a staircase is a local event. Alabama's and Connecticut's
staircases produce a spike at a boundary; Wisconsin's slope raises the rate
across `$116,333` of income.

The band is not a corner of the distribution. For a single filer in 2026 it runs
from `$20,120` to `$136,453.33` of Wisconsin AGI. **Wisconsin's published top
rate is 7.65% and the highest marginal rate an ordinary Wisconsin wage earner
meets is 6.348%, at `$69,260` of joint taxable income — 374,000 dollars of joint
income below where the 7.65% begins.**

### Part 3 — the marginal rate is not monotonic, and for a head of household it turns twice

The withdrawal ENDS, and the statutory rate on the far side is lower than the
withdrawal-inflated rate on this side. So a Wisconsin filer's marginal rate
**falls** as income rises. Every boundary below was located by bisecting the
engine rather than computed by hand:

```text
head of household, no dependents, 2026
Wisconsin AGI       rate
     $18,729        the first dollar of Wisconsin tax
     $20,120        3.500% -> 4.290%
     $31,318        4.290% -> 5.391%
     $58,826.61     5.391% -> 4.930%   FALLS: the tier changes to 12%
     $61,629        4.930% -> 5.936%
    $136,453.33     5.936% -> 5.300%   FALLS: the deduction is gone
    $333,420        5.300% -> 7.650%
```

Up, up, **down**, up, **down**, up. A single or joint filer turns once; a head of
household turns twice, because it also meets a tier change. No other state in
this package has a non-monotonic marginal rate at all.

### Part 4 — a threshold that is an identity, which is why it is not stored

A head of household starts with more deduction and loses it faster, and the two
are tuned: at 22.515% the head-of-household figure catches the single figure
exactly, and from there the statute withdraws both at 12% so that a head of
household never deducts less than a single filer on the same income.

```text
crossover = threshold + (maxHeadOfHousehold - maxSingle) / (0.22515 - 0.12)
2025:  19,550 + 3,960 / 0.10515  =  57,210.49
2026:  20,120 + 4,070 / 0.10515  =  58,826.61
```

The only source that carries the 2025 figure records `$57,210`, which is the
identity rounded. So the engine **computes** it — `slidingScaleCrossover` in
`definition.ts` — and `wisconsin.test.js` asserts the agreement against the
published value.

**THE RULE: a figure that is an identity between four published figures is a
fifth figure that can disagree with them, and storing it is storing the
disagreement.** The consequence is worth stating too: the whole
head-of-household premium — `$4,070` in 2026 — is withdrawn inside one band, and
above `$58,826.61` a head of household and a single filer have the same standard
deduction to the dollar.

I checked whether the crossover's exact value is insensitive, because it looked
like it should be: the deduction is continuous in income there. **It is not.**
Moving the crossover moves the deduction above it at `0.22515 - 0.12 = 0.10515`
per dollar, so a `$1,000` error in the crossover is `$105` of deduction. I had
nearly written the opposite into the module header. **THE RULE: continuity at a
boundary is a statement about the FUNCTION, not about the sensitivity to where
the boundary is.**

### Part 5 — an election that trades a subtraction against every credit on the form

2025 Act 15, signed 3 July 2025, created Wis. Stat. § 71.05(6)(b)54m —
`$24,000` of retirement income at 67, `$48,000` where both spouses on a joint
return qualify. Subdivision 54m.b is the whole of it:

> An individual who claims the subtraction under this subdivision for a taxable
> year may not claim any credit, including any eligible carryover of such
> credit, listed under s. 71.07 for the same taxable year.

**Not a limitation — an ELECTION, and the only one of its kind in this
package.** Every other mutually exclusive provision here trades one credit for
another (Utah's three retirement credits, Virginia's low income credit against
its earned income credit) or a deduction against a credit for the same expense
(New Jersey's property tax). This one trades a subtraction against *everything
else on the form*: the married couple credit, the school property tax credit,
the itemized deduction credit, the earned income credit, the homestead credit,
and any carryover of any of them.

So `compute()` runs the whole return twice and keeps the lower tax, which is
what the Schedule SB line 16 instructions tell the filer to do. The engine
already had that shape for New Jersey's property tax choice, and the two
compose: `computeBestPropertyTaxRoute` is now nested inside the election, four
passes possible in principle and two needed by any state, **written out rather
than assumed, so a state that acquires both rules gets the right answer instead
of the first one.**

Two things about it that no summary of Act 15 states:

- **The subtraction is worth more than its face value.** The standard deduction
  is a sliding scale read against Wisconsin AGI, so removing `$24,000` of pension
  both takes it out of the base and buys back `$4,746.72` of deduction on a joint
  return inside the band. The election is worth the rate on `$28,746.72`.
- **The crossover is a real income.** Measured: a joint return at 68 and 68 with
  `$80,000` of other income and `$4,000` of property tax is better off keeping
  its credits up to **`$5,692.35`** of pension and better off electing above it.
  The whole `$300` school property tax credit goes at once on the dollar that
  tips it.

And the elected return keeps every credit line **with its amount zeroed and its
name saying why**. A caller comparing the two passes can see what was given up.
**THE RULE: a credit line that silently disappears is the same defect as a figure
that silently changes** — which is Day 42's third lesson about silences, arriving
as a design decision rather than as a bug.

### Part 6 — the bug in my own new code, and it is the best rule of the day

The forfeiting branch was written like this:

```js
const effectiveCredits = forfeited ? credits.map(zeroed) : credits;
credits.length = 0;
credits.push(...effectiveCredits);
```

When nothing is forfeited, `effectiveCredits` **is** `credits`. So
`credits.length = 0` empties it and the spread pushes nothing back.

**It lost every credit on every Wisconsin return, elected or not** — and the only
symptom was a tax too high by the credits. No error, no exception, no
empty-looking code; the array was rebuilt from itself and the rebuild was
correct for the branch I was thinking about. It was caught by a test I had
written for something else entirely: the earned income credit came back `$0.00`
for one, two and three children.

**THE RULE: a conditional rebuild of an array must not alias the array it
rebuilds.** The fix is `splice(0, length, ...zeroed)` inside the `if`, and the
comment in `engine.ts` is longer than the code.

### Part 7 — how a 2026 figure nobody published is KNOWN

Wisconsin publishes its rate schedules a year EARLY — the 2026 Form 1-ES
instructions, December 2025 — and its Standard Deduction Table a year LATE, in
the Form 1 instructions of January 2027. Day 42 met the same shape in Oregon and
resolved one figure by noticing it was the only candidate arithmetically
consistent with an agency-confirmed one. **Today that argument became an
instrument**, and the instrument is `test/wisconsin-indexation.test.js`:

1. The top bracket threshold is indexed off statutory bases of `$225,000`,
   `$300,000` and `$150,000` (2013 Act 20) — verified because `266,930/225,000`,
   `355,910/300,000` and `177,960/150,000` agree to six figures. A published
   threshold therefore **bounds** the cumulative indexation factor, since the
   figure is rounded to the nearest `$10` and the true product is within `$5`.
   Three statuses give three bounds on one factor and the 2026 intersection is
   **7.5 parts per million wide**.
2. Each standard deduction figure has a base of its own, unknown and not needed:
   five published years bound it the same way, through the factors from step 1.
3. The 2026 figure is `round10(base x factor)` over both intervals.

**Four of the seven figures come out UNIQUE** — the single, joint and head of
household maxima and the joint threshold, the surviving spouse column being the
joint figure rather than a seventh — and the single and joint ones are
independently corroborated by two secondary reproductions of the 2026 table. Three are left choosing between two adjacent multiples of `$10`.

**And the method is VALIDATED rather than asserted.** Deriving the bases from
2021–2024 alone and predicting 2025 puts the published figure inside the
admissible set for all seven. The cruder version — chaining the year-over-year
ratio of two rounded figures — gets the 2025 separate deduction wrong by `$10`,
and that failure is asserted in the test file too, because it is the reason the
file does interval arithmetic instead of multiplication.

**THE RULE: an index factor is CUMULATIVE FROM A BASE, so a year-over-year ratio
of two rounded figures is not the factor, and chaining it compounds the
rounding.** I had the chained version first and it put the single/head of
household threshold at `$20,120` for the wrong reason and the separate maximum at
`$12,280` for the wrong reason, and only one of the two survived doing it
properly.

### Part 8 — the third kind of unsettled figure, and why two were not enough

The three ambiguous figures broke the ledger's vocabulary, and that is the
finding rather than an inconvenience.

`ProvisionalReason` had two values. `awaiting-publication` means last year's
figure is standing in; `determined-after-year-end` means the law has not fixed
the figure yet. **Wisconsin's three are neither.** They are not last year's — the
derivation produced new numbers — and Wisconsin settled them in 2025, so nothing
is waiting on the year to close. Forcing either label would have been a false
claim, and the tempting one (`awaiting-publication` with
`carriedForwardFrom: 2025`) would have been false in exactly the way the ledger
exists to prevent.

So there is a third: **`bounded-derivation`**, and a tenth `StateFigureKind`,
**`derived-bounded`**. Each entry states the interval, both candidate values,
which one is stored and why — the value the interval's own midpoint rounds to —
and `provisional.test.js` asserts all of that rather than trusting it.

**THE RULE: a two-valued reason field is a claim that there are two ways a figure
can be unsettled, and the third way shows up as a figure that fits neither label
badly enough to notice.**

The error is bounded and the bound is derived rather than measured: `$10` of
deduction at Wisconsin's top rate of 7.65% is 76.5 cents, and a threshold `$10`
out moves the deduction by the withdrawal rate times `$10`, which is less. **At
most 77 cents of tax — the narrowest provisional flag this package has ever
carried**, against Oregon's two unindexed figures and California's whole
schedule.

### Part 9 — an invariant whose teeth had to MOVE rather than come out

`provisional-coverage.test.js` has required since Day 37 that a provisional
figure under one filing status be flagged under every filing status. It failed on
Wisconsin, and it was right to fail and wrong to be obeyed.

The rule rests on a fact about **publication**: a state prints every column of a
table in one document, so a column nobody read means a table nobody read. **A
DERIVATION runs column by column and can settle one and not its neighbour.** The
2026 single, joint and head of household maxima are determined — and the
surviving spouse column with them, being the joint figure — while the separate
one is not, so flagging the siblings would have claimed an
uncertainty that is not there.

The rule now exempts `bounded-derivation` — and a new test takes its place:
**every unflagged sibling of a bounded derivation must be a figure the provenance
ledger calls DETERMINED** (`derived`, `indexed` or `statute`), never
`carried-forward`, `unestablished` or absent. Without it the exemption would let
a whole unread table through by flagging one cell of it and calling the flag a
derivation.

**THE RULE: an exemption from an invariant needs a replacement invariant, and the
replacement has to be checkable against the thing the exemption appeals to.** The
teeth moved from the shape of the table to the arithmetic that determined it,
which is a stronger claim than the original.

And Day 42's rule repeated exactly: **four paths are flagged for three figures**,
because § 71.05(22)(dp) gives single and head of household ONE threshold and
`deduction.tiers` holds it once per status. An entry written for one column flags
one column.

### Part 10 — two defects in the reference model, found before anything ran

Both are in `policyengine-us` 2.15.3, both are about 2026 indexation, and both
were found by reading the YAML rather than by running the grid.

**Its 2025 middle bracket is a year ahead of itself.** 2025 Act 15 set the top of
the 4.4% band at `$50,480` single, `$67,300` joint and `$33,650` separate,
retroactive to 1 January 2025, with indexation resuming in 2026. PolicyEngine
carries `$51,130` / `$68,170` / `$34,090` for 2025 — the Act 15 figures indexed a
year early. **The arithmetic settles it rather than the citation alone**:
`$50,480` times the factor the published 2026 figures pin rounds to `$51,950` to
the dollar, and all three statuses agree, where `$51,130` indexed is `$52,620`,
a figure no source carries.

**And its 2026 standard deduction is uprated by the wrong government's index.**
With no published 2026 value it uprates the 2025 schedule by `gov.irs.uprating`,
`1.0226629`, giving `$13,870` single against `$13,960`. The tie-break here is not
this package's arithmetic against theirs:

| PolicyEngine's own 2026 Wisconsin | implied factor |
| --- | --- |
| bracket thresholds, READ from the Department of Revenue | **1.0291** |
| standard deduction, uprated by `gov.irs.uprating` | **1.0227** |

**The two halves of its 2026 Wisconsin are indexed on different series, one of
them the wrong government's.** Wis. Stat. § 71.06(2e) and § 71.05(22)(ds) index
both schedules on the same Wisconsin CPI measure.

**THE RULE, which is Day 42's Part 8 one level up: when two models disagree about
an unpublished indexed figure, look for the disagreement INSIDE one of them
first.** A model that carries a published figure for one parameter and an uprated
one for another has already told you which it trusts.

The third difference is older and better known: **a widow is one person.**
`wi_base_exemption` is `exemptions_count` times `$700` and that count includes a
deceased spouse, where § 71.05(23) allows the spouse's `$700` only "if a joint
return is filed". That is the class of error this package fixed across fourteen
call sites in v0.27.0 and named `livingFilerCount`, and it is `$53.54` at the top
rate.

### Part 11 — the differential grid, and the dimension it did not have

**1,056 households, 7,392 figures, 6,849 agreeing to the dollar, 543 differences
explained and ZERO unexplained**, against the pinned PolicyEngine-US 2.15.3.
Wisconsin added 44 cases and 29 differences, which resolved into exactly the
three families above.

The grid needed one new shape, and predicting it was the Day 42 Part 10 move
applied to a schedule rather than to a credit. **The grid's four heads of
household earned `$12,000`, `$25,000`, `$35,000` and `$45,000`, and every one of
them is below `$58,826.61`** — so the whole second tier of Wisconsin's
head-of-household sliding scale was invisible from this grid, and the crossover
could have been any number above `$45,000` without a case moving.

**THE RULE: a grid that chose a status's incomes to straddle one provision's
thresholds has said nothing about any other provision that bands the same status
somewhere else.** Those four heads of household were placed for earned income
credits, which live below `$50,000`. A deduction schedule that changes shape at
`$58,837` needed a rung of its own, and `single-parent-high` at `$90,000` is it.

### Part 12 — a two-hour measurement started with the wrong flags

The state package's audit has always been run with a `--skip` list for the seven
locality registries. **That invocation lived in `tools/mutation/README.md` and
nowhere the program could read.** I started the recorded run without it, and it
enumerated **1,626 mutants instead of 1,358** — the 268 extra being the 1,033
transcribed local rates, which are data rather than rules.

`check-scores.mjs` compares the recorded `skipped` list, so it would have
rejected the score. **That is the only thing that stood between a wrong flag and
a wrong number in the README**, and it is too thin a thing to be standing there.

The list is now a **harness default** keyed on the package name, and it is
announced at start-up beside the record destination:

```text
[mutate] packages/us-state-tax: 1358 mutants over 29 files, 4 workers
[mutate] skipping 7 file(s) (harness default for this package): localities/ohio.js, ...
[mutate] will record the score in tools/mutation/scores.json when the run completes
```

**THE RULE, which is Day 42 Part 16's with the sign flipped: a flag that is
PRESENT and does nothing is worse than one that is missing, and a flag that is
ABSENT while the run silently measures something ELSE is worse than both.** Day
42's fix was to announce what the run would record; this one is to remove the
thing there was to remember. `--skip none` includes the registries.

### Part 13 — the mutation audit, predicted in two parts before it ran

- **`wisconsin.js` holds 82 mutable literals**, and the hand count was exactly
  right on two of the three operators and wrong on the third. Measured by kind:
  **16 rates, 54 money, 12 years.** I predicted 16, 54 and **6**, so the whole
  six-literal miss is in one operator — and the reason is a shape no previous
  state here has used.

  `THRESHOLDS`, `STANDARD_MAX` and `STANDARD_THRESHOLD` are
  `Record<number, ...>` objects **keyed by the tax year**, so `2025:` and `2026:`
  appear six more times as OBJECT KEYS in the emitted JavaScript, and the harness
  mutates a key exactly as it mutates a value. Oregon and Missouri both branch on
  `year >= 2026` and hold their figures in functions; Wisconsin holds two
  published schedules side by side in a table, which is clearer to read and six
  mutants wider.

  **THE RULE: a year-keyed record is as many year literals as it has keys, and a
  hand count that reads the figures misses the keys, because a key does not look
  like a parameter.** Worth more than the six: a mutated key makes the whole
  year's table unreachable, so these are the six easiest mutants in the file to
  kill and the ones most likely to be killed by an unrelated test.
- **The package should go from 1,267 to 1,358** — 1,267 plus 82 plus **9 in
  `src/data/provenance.ts`**, which is Day 41's and Day 42's finding for the
  third time: the nine `years:` arrays the per-year entries needed are nine year
  literals, and the ledger that records where every figure came from gets audited
  like any other file.
- **The six survivors should be the same six** `STATE-SURVIVORS.md` triages.

The count was predicted exactly once the flags were right, which is what makes
Part 12 a process finding rather than a near miss.

### Part 14 — the calculator's ranking, and the first row to pass Utah by legislation

On the retired-couple ranking the site has carried since v0.17.0 — joint, both
70, `$40,000` of Social Security and a `$60,000` pension — **Wisconsin charges
nothing**, and it is the THIRTEENTH state to pass Utah.

The first nine were rows that were **wrong**. The next three were rows that did
not **exist**. **This one is a row that CHANGED**, four months ago, in a state
legislature: the same couple in Wisconsin a year ago paid about `$1,507`, and
§ 71.05(6)(b)54m takes `$48,000` of the pension out, leaving `$12,000` against a
`$25,840` standard deduction and `$1,900` of exemptions.

**THE RULE: a ranking of states is a ranking of three different things at once —
what the law says, what somebody modelled, and when they last looked — and the
only one of the three a reader assumes is the first.** Twelve of the thirteen
rows that passed Utah say something about this table. The thirteenth is the only
one that says something about Wisconsin.

### Process notes

- **Start the PolicyEngine pass FIRST** — Day 39's note, followed, and the 1,056
  cases took about fifteen minutes against the predicted forty, because the
  state dimension of the grid is 2026-only. Which is itself worth recording:
  **the 2025 bracket defect in Part 10 is NOT VISIBLE from this grid at all**,
  and it was found by arithmetic on the YAML. A differential test is bounded by
  the vocabulary of its cases, and the year is part of that vocabulary.
- **A search that repeats the figures in your query is not a source.** I asked
  for "head of household $18,030 separate $12,280" and got both back as
  confirmation. They were my own arithmetic. Every figure in Part 7 is derived
  and tested instead.
- **`WebFetch` is blocked on the same domains as `curl`**, so there is no second
  route to an agency PDF. Worth knowing before planning a day around one.
- **The engine already had the shape the election needed.** `computeOnce` was
  split out from `compute` for New Jersey's property tax choice, and the second
  caller cost a parameter rather than a rewrite. Day 41's rule about the second
  state telling you which parts of the first state's rule were the rule, applied
  to control flow instead of to data.
- **Three restarts of the recorded audit, for three reasons, and all three are
  rules this journal already contained.** The wrong `--skip` flags (Part 12),
  which is Day 42's "a flag that does nothing" with the sign flipped; four wrong
  citations found after the run had started (Part 16), which is Day 42's "make
  every citation edit before the audit" missing the words "and check them first";
  and one invented purchasing-power figure found by Day 42 Part 10's rule about
  WHY-claims, also after the run had started. **The pattern is worth naming: a
  rule that tells you WHEN to do something does not tell you to DO it, and the
  gap shows up as the rule being obeyed and the thing it protects still going
  wrong.** All three restarts are what worklist item 7 exists to prevent, and two
  of the three would have cost nothing with a literal fingerprint.
- **Nine `assert.equal(..., N)` count pins broke on one new state**, across the
  registry, the notes, the status sweep, the step probes and three READMEs. They
  are doing their job and the cost is real: about forty minutes of the day. The
  ones that earned it were the two that were not counts — the provisional sibling
  rule (Part 9) and the EITC match rate, which forced the by-child-count table to
  be checked rather than just counted.

### Part 15 — the one surface Day 8's rule had never covered, and it had drifted

`index.html` on the published calculator said **"30 states"** — in its `<title>`,
in its `<meta name="description">` and in its opening paragraph — while the engine
had grown to 32 on Day 42 and 33 today. It had been wrong for two days and
nothing noticed, because **the site is the one surface this project's own rule
had never been applied to.**

Day 8's operating rule is that a number in the docs is a claim and needs a test,
and `packages/*/test/readme.test.js` has enforced it for every package README
since — three README suites, pinning quick-start figures, staircase counts,
provisional lists and tarball versions. The page a visitor actually reads had
sixteen tests about its *computation* and none about its *claims*.

Fixed, and the test is load-bearing rather than decorative: it reads the source
`index.html`, counts how many states the model actually ranks, and asserts every
`N states` in the page against it — plus the `<title>` and the meta description
specifically, because those two are what a search result and a pasted link show
before the page loads. Verified by reverting one of the three and watching it go
red.

**THE RULE: a claim on the one page a visitor actually reads needs the same test
as a claim in a README — and it is the page, not the README, that is the
product.** The drift was invisible for the ordinary reason: the README suites are
the ones a new state breaks, so they get regenerated every day, and a surface
with no test about it is a surface nothing forces anybody to look at.

### Part 16 — four citations wrong, and Day 42's rule needed one more word

Day 42 Part 14 found four wrong citations in Oregon, every one of them a
parenthesis, and wrote the rule: *a wrong citation is worse than a missing one,
and a SUBSECTION is where a citation goes wrong, because the section is the part
you looked up and the subsection is the part you inferred.* Day 42 Part 15 added
the process half: *make every documentation and citation edit BEFORE starting the
recorded audit.*

**I followed the second rule and broke the first, which is the gap between them.**
Every documentation edit was made before the audit started — and four of the
citations in those edits were wrong, because the rule tells you WHEN to edit and
not to go looking. So the audit started, and then I went and checked.

| citation | what it actually is |
| --- | --- |
| `§ 71.05(1)(a)` for the military retirement exemption | the **closed 31 December 1963 cohort**; the general exemption is `(am)`, and `(an)` covers the coast guard, NOAA and PHS commissioned corps |
| `§ 71.05(1)(c)` for the out-of-state municipal interest addition | a list of **Wisconsin** obligations whose interest is **exempt** — the opposite direction |
| `§ 71.05(22)(ds)` for the standard deduction indexing | "Standard deduction indexing" for **1998 to 2000 only** |
| `§ 71.05(23)(b)2` for the `$250` age addition | a subdivision nothing I read names; `(23)(a)2` is the only one a source showed |

And a fifth that is not wrong but is not safe: **`§ 71.06(2e)` is written "for
taxable years beginning after December 31, 2009, and before January 1, 2025", and
2025 Act 118 repealed `§ 71.06(1m)`, `(1n)`, `(1p)` and `(2)(c)` to `(h)`** — so
the subsection that indexes a 2026 Wisconsin bracket is not one this package has
read. All five are now at section level with the reason written beside them, and
`§ 71.06(1q)` is gone from the base-amounts comment too, because those three
figures were verified ARITHMETICALLY — `266,930/225,000`, `355,910/300,000` and
`177,960/150,000` agreeing to six figures — and not read in a subsection.

**Two citations came out of the check stronger rather than weaker**, which is the
part that makes the check worth the time rather than only a tax on carelessness:

- **`§ 71.05(22)(dp)` is right.** It is "Deduction limits, 2000 and thereafter",
  and `(dm)` — which the reference model cites — is "Deduction limits; 1994 to
  1999", an obsolete subsection.
- **`§ 71.05(6)(b)9` is right, and its own words describe the code.** "On assets
  held more than one year and on all assets acquired from a decedent, 30 percent
  of the capital gain as computed under the internal revenue code", and "the
  capital gains and capital losses for all assets shall be netted before
  application of the percentage" — which is exactly the `min(net gain, long-term
  gain)` this engine computes, arrived at from PolicyEngine's implementation and
  now confirmed from the statute's sentence.

**THE RULE, Day 42's with one more word: make every citation edit before the
audit, AND CHECK THE CITATIONS FIRST, because an unchecked citation is an edit
you have not made yet.** The cost of learning that today was a second restart of
the recorded run, which is the whole argument for the rule in one line.

And a third restart, for the thing the first two were practice for. Going back
over every claim in the day's writing for the ones nothing could test — Day 42
Part 10's rule, that **the claims that need checking are the ones that explain
WHY** — turned up one invented figure of my own: a provenance entry said
Wisconsin's `$700` exemption "is 40% of its 2001 purchasing power". Nothing in
this repository can cite a CPI series, I did not compute it, and it is wrong:
`$700` of 2026 money is worth about 54% of `$700` of 2001 money. **The figure is
gone rather than corrected, because the honest version of that sentence is "$700
since 2001", which is the whole of what the ledger knows.**

Two other claims came out of the same pass stronger, which is the argument for
making the pass at all:

- **`19.778%` really is the figure the statute prints.** § 71.05(22)(dp) reads
  "subtracting from `$19,010` **19.778 percent** of aggregate Wisconsin adjusted
  gross income in excess of `$21,360`". I had the claim from a parameter file and
  now have it from the paragraph, and the two dollar figures are the base-year
  amounts the indexing starts from — which is independent confirmation of Part
  7's whole method.
- **"374,000 dollars of joint income"** was loose where the surrounding sentence
  was precise, mixing income with taxable income. It is `$374,370` of TAXABLE
  income, between the `$69,260` where 6.348% starts and the `$443,630` where
  7.65% does.

### Part 17 — a correction Day 42 made in one of the two files that carried it

`fingerprint.mjs` used to claim that rewording a doc comment does not invalidate
a recorded score, "because `tsc` puts it in the `.d.ts`". Day 42 Part 15 found
that false — both packages set `removeComments: false` — and corrected it.

**`check-scores.mjs` carried the same sentence and still does, until today.** It
is the file a reader reaches first, because it is the one CI runs and the one
whose output names the staleness; and its header said "a reworded doc comment
changes neither, because `tsc` puts it in the `.d.ts` — so 'a string is not a
mutant' is now a computation rather than an argument."

**THE RULE: a false claim that appears in two files is corrected in two files,
and the copy that survives is the one you were not reading.** Day 42 found the
defect by being bitten by it in `fingerprint.mjs` and fixed the file that bit it.

The argument underneath is still right and is kept as a correction: a string is
not a mutant, so a byte fingerprint is STRICTER than the property it stands in
for and can reject a score that is still valid. Making it a computation rather
than an argument needs the digest to be over the ENUMERATED LITERALS instead of
the file bytes — worklist item 7, which has now cost **three** audit restarts
across two days, one on Day 42 and two today.

I did not do it today, and the reason is worth writing down rather than leaving
as a gap. It is not a one-line change: the enumerator lives inline in
`mutate.mjs` and would have to move into a module both files import, the recorded
fingerprint format changes, and **both** scores would need re-recording — so it
is a refactor of the one instrument that makes this project's quality claim
checkable, started at the end of a long run with two audits to re-measure
afterwards. **The right call at the end of a run is to finish it, not to start
the refactor**, and the design is written into `mutate.mjs` and `check-scores.mjs`
so tomorrow's first hour is spent building it rather than rediscovering it.

### Part 18 — the sweep, rather than the fix: three more claims, all mine

Having been caught by one invented figure, I went over **every** numeric and WHY
claim in `wisconsin.ts` and in the thirty Wisconsin provenance entries rather
than only the one that bit me. Three more were wrong.

- **"unchanged since 2011"** for the 30% capital gain exclusion. The year was not
  from a source. What is true, and is what the entry says now, is that the share
  has not moved across the years this package checks.
- **"three of the five cells DETERMINED"** for the 2026 standard deduction
  maxima. **Four** of the five are — single, joint, surviving spouse (which IS
  the joint figure) and head of household — and only the separate one is not. The
  same miscount was in this journal and in the package README, phrased as "the
  single, joint, surviving spouse and head of household maxima and the joint
  threshold", which names five things as four.
- **"$700 since 2001"**. 2001 is where a PARAMETER FILE's series begins, not
  necessarily where the statute's does, and the entry now says which of the two
  it knows.

And one claim about Wisconsin that today's own open question contradicts: an
entry said a qualifying surviving spouse takes the joint threshold "because
§ 71.05(22)(dp) puts that status on the joint schedule for the two years after
the death". **Nothing I read says that, and Part 0's own evidence points the
other way.** It now says this package gives the status the joint figure because
that is the near-universal state rule, names the open question, and states the
exposure.

**THE RULE: when one unsourced claim turns up, the thing to do is not to fix it
but to SWEEP the file it was in, because a claim nothing can test was not written
carefully once — it was written in the same pass as its neighbours.** One
invented figure found by luck became four found on purpose, plus four claims that
came out of the sweep stronger than they went in.

The ratio is the part worth keeping. Of roughly thirty claims checked, four were
wrong, four improved, and twenty-two were confirmed as written — so a sweep is
not a rewrite, and the twenty-two are what makes the four findable.

### Part 19 — the audit said no, and four of the five were a constant nothing reads

```text
mutants 1358    killed 1347    survived 11    score 99.2%

  states/wisconsin.js    line  98  money  225_000 -> 450000
  states/wisconsin.js    line  99  money  300_000 -> 600000
  states/wisconsin.js    line 100  money  150_000 -> 300000
  states/wisconsin.js    line 101  money  225_000 -> 450000
  states/wisconsin.js    line 321  year   2025 -> 2024
```

**Three of the four predictions held and the one that mattered did not.** The
count was exact at 1,358. The six long-standing survivors are the same six at the
same six lines. The split was 1,267 + Wisconsin's 82 + 9 in the provenance
ledger, as written. And **five of Wisconsin's 82 survived**, where I had
predicted none — so the score went from 99.5% to **99.2%**, the first time it has
gone DOWN since the instrument was built.

That is the result worth having rather than the one to bury. A quality number
that can only go up is a number nothing is measuring.

**Four of the five are `WI_TOP_BRACKET_BASE`, and it is Day 42's Ohio defect one
day later in code written the same day as its own comment.** The constant holds
the `$225,000` / `$300,000` / `$150,000` statutory bases that the entire 2026
derivation rests on, and its doc comment says "see
`test/wisconsin-indexation.test.js`". That test writes its OWN copy of the three
figures rather than importing them — deliberately, and its comment says why: *a
test that calls the code it is checking checks nothing.* **Both halves are
defensible and together they leave the shipped constant with no reader at all.**

Day 42's version was Ohio's unread `perFiler` table, which carried a wrong figure
for 33 days "on the strength of a comment claiming a test that did not exist".
Here the test exists and does not read the value the comment points at, which is
the same failure with better paperwork, and it is worse in one way: I wrote the
comment and the test in the same hour and did not notice that one does not touch
the other.

**THE RULE: a comment that names a test is a claim about that test, and "see
`foo.test.js`" has to mean `foo.test.js` reads THIS value.**

The fix is a cross-check rather than a rewrite, because both halves were right:
the test keeps its own copy as the authority for the arithmetic **and** asserts
that the exported constant equals it. That is the one relationship which kills
the mutants and keeps the test independent of what it checks. All five cells are
asserted, including the two the `byStatus` helper fills — head of household takes
the single base because Wisconsin gives those two statuses one schedule, and a
surviving spouse the joint one.

**The fifth is a conditional that can never be false.**
`retirementIncomeExclusionElection: year >= 2025 ? {...} : undefined`, inside a
`wisconsin(year)` that already returns `undefined` for every year but 2025 and
2026. Unlike the six long-standing survivors it is not unreachable in principle —
it is **removable**, and removing it is better than triaging it. The guard that
looks like caution was the thing hiding that the rule applies to every year the
state has.

`--only wisconsin.js` after both fixes: **81 mutants, 81 killed, 100%** — one
fewer mutant than before because the dead year literal is gone.

**THE PREDICTION FOR THE RE-RUN, written here before it started: 1,357 mutants,
1,351 killed, 6 survivors, 99.6%** — which would be the highest this package has
recorded, and the six would be the same six again.

**Measured: `mutants 1357    killed 1351    survived 6    score 99.6%`, and the
six are the same six at the same six lines.** All four figures predicted exactly,
which is the second time in two days the whole prediction has landed — and the
more useful fact is that the first run's prediction did NOT, on the one number
that was not arithmetic. **The count is derivable and the survivors are not**: a
mutant count follows from the source and three operators, and whether a mutant
dies follows from whether anybody wrote a test, which is a fact about the day
rather than about the file.

So the day's score went 99.5% → 99.2% → 99.6%, and the middle number is the one
that did the work.

### Part 20 — the audit is 24% faster, Day 40 was aiming at the wrong knob, and so was I

Worklist item 7 since Day 40 has been "make the audit faster by running FEWER
TEST FILES per mutant", and the note beside it had the diagnosis right and the
remedy wrong.

`node --test` spawns **one child process per test FILE**, so four workers running
a fifty-file suite put two hundred node startups on four cores for every mutant.
Day 40 tried `--test-concurrency=1`, which controls how many of those children
run at once rather than whether there are any, and the audit got twice as slow —
43 Alabama mutants from 4m11s to 9m42s — because serialising the children removed
the only parallelism that was hiding their cost.

**The knob that removes the children is `--experimental-test-isolation=none`**,
which runs every file in one process. Measured:

```text
one suite run, standalone        real     user
  default (one process/file)     8.27s   14.49s
  isolation=none                 6.53s    7.35s

the audit itself, four workers on four cores
  default                        11.1 mutants/min
  isolation=none                 13.8 mutants/min   -> 24% faster
```

Both modes report the same 765 tests and 765 passes and both exit non-zero on a
planted mutant, which is the only behaviour the harness depends on, and
`--only ohio.js` on the new path returns the same 64 mutants and the same two
survivors at the same two lines that `STATE-SURVIVORS.md` has recorded since Day
35. It is the default now, announced at start-up, with `--test-isolation process`
to go back and a probe that falls back with a message on a Node that does not
support the flag.

**THE RULE: when an optimisation makes a thing slower, the measurement is
evidence about the MECHANISM and not only about the optimisation.** Day 40's own
note contains the sentence that solves it — "the work is not contended, it is
STARTUP" — and then reaches for a concurrency flag, which is a contention knob.
The diagnosis and the wrong remedy were in the same paragraph.

**And then I got the size wrong, in writing, before measuring it — which is
Day 39's rule arriving for the fifth day running.** I wrote "about twice as fast,
115 minutes to 55" into three files, inferred from the USER time halving. The
audit's own throughput says **24%**, and the figure that predicted it correctly
was the REAL time ratio of 1.27 sitting in the same table.

**THE RULE: with workers equal to cores, the wall clock tracks the REAL time of
one run and not its user time.** User time halves because the per-file children
are gone — but those children were already saturating four cores, so the real
time of one suite run already contained their cost. User time predicts how the
win SCALES when cores are added, not what the win is today.

That corollary is why the change is still worth having, and it is the part the
wrong claim was accidentally reaching for: `--workers 8` on eight cores runs
eight single-threaded processes on the new path and sixty-four on the old, so the
new path scales where the old one was already oversubscribed. On four cores it
buys 24%; on a bigger runner it buys much more.

It cost a restart of the recorded run, 17 minutes in — against about 23 minutes
saved on a 99-minute run, so today it roughly broke even and every future day is
ahead. Recorded rather than hidden. The
fewer-FILES idea survives and is worth less now, and the sound way to do it is
written down: select the test files that can reach the mutated module, then
**re-run every SURVIVOR against the whole suite**, because a mis-selection can
only ever under-kill and the re-run makes the result exactly equal to the full
one.

### What I would do next

1. **Wisconsin's qualifying surviving spouse status, and the evidence is already
   gathered.** Wisconsin appears not to offer the status at all: the Form 1
   instructions say "if your spouse died before 2025 and you have not remarried,
   you must file as single or, if qualified, as head of household" — which is
   exactly the federal window — and § 71.06 writes its schedules for
   "fiduciaries, single individuals and heads of households" and for "married
   persons", with no surviving-spouse schedule to use. Both this package and
   PolicyEngine-US put the status on the JOINT schedule. **Measured, the gap is
   up to `$2,861`** at `$450,000` and `$673` at `$90,000`, and it is in the
   flattering direction. Not changed today only because the recorded audit was
   already running over the build. Do this first; it is an hour and the largest
   open question in the package.
2. **Minnesota**, the largest state left, and the one with a state **alternative
   minimum tax** — which no state in this package has, so it is a rule type and
   not a parameter. Its base is federal taxable income, which
   `federal-taxable-base.ts` already models, so the base is nearly free and the
   AMT, the Social Security subtraction and the `$1,750`-a-child credit are the
   work.
3. **Wisconsin's child and dependent care credit**, which from 2024 is **100% of
   the federal credit on up to `$10,000` of expenses** (`$20,000` for two or
   more) against the federal `$3,000`/`$6,000` — so it is several times larger
   than the federal credit it matches and is the biggest omission in the state
   for a working parent. It needs the federal credit as an input, which this
   package does not currently take.
4. **Kansas City and St. Louis, 1% each** — unchanged from Days 41 and 42 and now
   three days old. Both charge 1% of gross earnings with no deduction and no
   exemption, which for a Kansas City resident on `$60,000` is `$600` against
   about `$2,050` of Missouri tax.
5. **Oregon's three city and county income taxes** — unchanged from Day 42. The
   Portland Metro Supportive Housing tax (1% above `$125,000`/`$200,000`) and the
   Multnomah County Preschool for All tax (1.5%, then 2.3%) are read against a
   threshold on income the state engine already computes, so this is a locality
   with no new input.
6. **`exemptionCredit.separateReturnSpouse` for California and Ohio**, unchanged
   from Day 42. California's is `$153` a separate return and Ohio's `$20`.
7. **Fingerprint the mutable literals rather than the file bytes**, unchanged
   from Day 42 and **stronger today than it looked yesterday**: `mutate.mjs`
   already enumerates every mutant, so a digest over that enumeration would be
   invalidated by a figure changing and NOT by a comment or a citation being
   corrected. Day 43 lost a restart to exactly that — four citations fixed after
   the audit had started (Part 16) — and would have lost nothing with a literal
   fingerprint, because not one of the five edits changed a mutant. It does NOT
   help with the Wisconsin surviving-spouse fix, which is a parameter change and
   genuinely invalidates a score. Two restarts in one day is the case for it.
8. **Select test files per mutant** (Part 15), now worth about half what it was.
   The sound design is written down in `mutate.mjs`.
9. **Oregon's federal pension subtraction** and **Oregon's Working Family
   Household and Dependent Care credit**, unchanged from Day 42.
10. **Lower the mutation harness's `$100` money floor**, or justify it. Unchanged
   from Days 40, 41 and 42, and Wisconsin adds three more figures below it that
   matter — the age 65 and 67 tests and the `filersClaimed` counts — all of them
   asserted directly in `wisconsin.test.js` instead.

---

## Day 42 — 2026-10-06

### What I did

**Added the twenty-third taxing state, and it is the one where the state's own
deduction decides the rate at which losing that deduction is taxed. Oregon's top
9.9% rate begins at `$125,000` and does not reach a single filer until
`$133,161` of federal AGI, because the federal tax subtraction holds their
Oregon taxable income below the threshold until then.**

`us-state-tax` is **v0.38.0**, `us-tax-mcp` **v0.41.0**, `us-federal-tax`
unchanged at v0.15.0. **1,302 tests** (396 + 721 + 169 + 16), all green, zero
dependencies — up 37 from Day 41's 1,265. 32 states, 23 of them taxing.

New: `packages/us-state-tax/src/states/oregon.ts` and `test/oregon.test.js`
(37 tests), five new fields on existing rule types, one new rule type, three
households in the status battery, a step-chart driver, 24 provenance entries,
and four field declarations in the MCP server rewritten to derive from the
engine instead of asserting a stale list.

CI read at the START of the run, which has been the standing item since Day 37:
**green on the last push** (run 141, c67209c). One API call.

### Part 0 — the day's first command, for the third day running

`git fetch origin main && git checkout -B main origin/main` came up at `c67209c`
with Missouri in it. Nothing to report, which is what a rule written down is for.

**One thing that was NOT already in place and cost ten minutes: a fresh sandbox
has no `node_modules` anywhere.** `packages/us-tax-mcp` failed to build with
`TS2688: Cannot find type definition file for 'node'`, which looks like a
tsconfig problem and is `npm install`. `tools/test-counts.mjs` says this in as
many words and refuses to run; the MCP build does not. Run `npm install` in all
three packages first.

### Part 1 — why Oregon, and the thing that made it worth the day

Day 41's worklist named Oregon first because it is the third state that deducts
federal income tax, so the rule Alabama needed would be mostly reusable.

**It was not reusable, and that is now a pattern rather than a surprise.** The
three states do the same thing three incompatible ways:

| state | the chart varies | read against | sits |
| --- | --- | --- | --- |
| Alabama | nothing — 100%, uncapped | — | below the deduction |
| Missouri | the **share** of the bill | **Missouri** AGI | below the deduction |
| Oregon | the **ceiling** on the bill | **federal** AGI | **inside Oregon AGI** |

Missouri varies the percentage and reads its own AGI; Oregon varies the dollar
ceiling and reads the federal one. Neither chart could be used for the other.

**THE RULE, which Day 41's second instance half-taught and the third finishes:
the SECOND state to need a rule tells you which parts of the first state's rule
were the rule; the THIRD tells you how many dimensions the rule has.** Day 41
made `refundableCredits` a list because two states disagreed. Oregon's list is a
third distinct value, so the three are now *pairwise* different on one field —
and a constant would have been wrong for two of the three.

### Part 2 — the composition that is the best sentence this package has

Oregon's ceiling falls in five equal steps, each a cliff of the whole
difference, and the income where it starts falling is the same `$125,000` where
the 9.9% rate begins. The two steepest things in the schedule are aimed at the
same dollar.

```
federal AGI   ceiling          one more dollar costs
  $125,000    8,750 -> 7,000        $153.22
  $130,000    7,000 -> 5,250        $153.21
  $135,000    5,250 -> 3,500        $173.35
  $140,000    3,500 -> 1,750        $173.35
  $145,000    1,750 ->     0        $173.35
```

**They never meet there.** The lost `$1,750` is charged at whatever Oregon rate
the filer is on, and up to `$8,750` of subtraction holds them *below* the
`$125,000` threshold — so the first two steps are charged at 8.75% and only the
last three at 9.9%. Which produces the figure worth more than the cliffs:
**Oregon's top rate nominally begins at `$125,000` and does not reach a single
filer until `$133,161` of federal AGI** (standard deduction, federal bill above
every ceiling).

**THE RULE: where a state subtracts a figure from its own base, the subtraction
decides which bracket the loss of that subtraction falls in. A cliff's SIZE is a
parameter and its PRICE is a composition.**

And the `$125,000` is unindexed — the same figure since 1993, the one boundary
ORS 316.012 does not touch, so thirty-three years of inflation have walked
Oregon's top bracket down the income distribution with no legislature involved.

### Part 3 — the earned income credit moves the answer three ways in one library

Publication OR-17 makes the subtraction the federal tax "after all credits other
than the earned income tax credit". So:

| | earned income credit | refundable CTC | refundable AOC |
| --- | --- | --- | --- |
| Alabama | subtracted | subtracted | subtracted |
| Missouri | subtracted | — | subtracted |
| **Oregon** | **—** | subtracted | subtracted |

`federal.earnedIncomeCredit` therefore lowers the answer in the six states that
match it, **raises** it in Alabama and Missouri, and lowers it only in Oregon,
which matches it *and* refuses to claw it back. Day 41 found Missouri reading
that one figure twice in opposite directions. Oregon reads it twice in the same
direction, and the carve-out is explicit drafting rather than an accident.

### Part 4 — a credit withdrawn over a WIDTH, and a marginal rate above 100%

The Oregon Kids Credit (HB 3235, 2023) is `$1,050` a dependent under six, up to
five of them, and the whole of it is withdrawn across `$5,000` of Oregon AGI
above `$26,550`. A width and not a rate, which makes the implied marginal rate
`credit / width` and therefore **proportional to the family**:

| children under 6 | withdrawn | over | implied rate |
| --- | --- | --- | --- |
| 1 | `$1,050` | `$5,000` | 21% |
| 3 | `$3,150` | `$5,000` | 63% |
| **5** | **`$5,250`** | **`$5,000`** | **105%** |

At the statutory maximum the withdrawal is steeper than the income that causes
it: a family with five children under six is strictly worse off with `$31,550`
of Oregon AGI than `$26,550`, before Oregon's own rate and before anything
federal. Measured, not asserted — `oregon.test.js` drives all four rates.

**A phase-out defined by a width cannot be expressed as a rate for more than one
family size at a time**, which is why it is a `ChildCreditPhaseOut` variant and
not a computed `rate`.

### Part 5 — a subtraction's placement, worth money for the second day running

Day 41's Part 2 rule was that a subtraction's PLACEMENT is a second provision.
Oregon is the other half of it. Alabama's Form 40 line 12 and Missouri's
MO-1040 line 13 sit BELOW the standard-or-itemized choice; Oregon's is an
**income subtraction** on Schedule OR-ASC, inside Oregon AGI — and Oregon AGI is
the figure the Kids Credit above is withdrawn against.

So in Oregon the federal tax a family paid can buy back part of a state credit.
A couple at `$30,000` with one child under six and a `$2,000` federal bill keeps
71% of the credit where the same couple with no federal bill keeps 31%.

It needed a declared field (`reducesStateAdjustedGrossIncome`) and an invariant:
**a state that reduces its own AGI by this deduction may not read its own AGI to
size it**, or the two are circular. Oregon does not — its chart reads federal
AGI — and the engine now throws a named error rather than answering with a zero
that would look like a small deduction. `registry.test.js` rules the combination
out at the definition level, so the throw is the second line of defence.

### Part 6 — three numbers I wrote before I measured them, for the fourth day running

The module header's cliff table said `$173.25` five times. Measured, the first
two rows are `$153.22`. **Day 39's rule, for the fourth day running: a header
written before its test is a hypothesis.**

This one was better than a correction, because the reason the two differ is the
finding in Part 2. I had computed `$1,750 x 9.9%` for all five rows and forgotten
that the subtraction I was removing is what had been holding the filer under the
9.9% threshold. Being wrong about three rows is what produced the `$133,161`.

### Part 7 — the differential grid found a real defect, on the first run, again

**989 households, 6,923 figures, 6,425 agreeing to the dollar, 498 differences
explained and ZERO unexplained**, against the pinned PolicyEngine-US 2.15.3.
Oregon added 43 cases and produced 38 differences. They were two things and one
of them was mine.

**The defect: a separate Oregon return claims TWO exemption credits and this
package claimed one.** `separate-with-spouse-young` came back `$251.91` apart —
far too big for a parameter difference — and the arithmetic decomposed to
exactly one `$263` credit plus `$11.09` of drift. The Form OR-40 instructions
settle it in a sentence: a filer "married and filing a joint return (**or filing
separately but your spouse has no income**)" whose spouse "can't be claimed as a
dependent on someone else's return" checks the Regular exemption box for the
spouse.

The gap was not Oregon's. `ExemptionRule` has modelled this § 151(b) spouse for
four states since Day 30; **`ExemptionCreditRule` had no answer to the question
at all**, because the two states that had an exemption credit before Oregon were
never asked — Ohio's is a flat `$20` switched off above `$30,000`, and
California's taper had no separate-return case in the grid that could show it.

**THE RULE: a question answered on one rule type is not answered on the other,
and the second rule type looks finished because nothing has asked it yet.**

And the field is deliberately NOT defaulted on. Day 30's rule is that a
provision read for one state is not evidence about another, so Ohio and
California are left absent and a test asserts they are — a default of
`'claimed'` would have silently changed two states nobody has read.

### Part 8 — the other 37, and they are all one fact

**Every one of the 37 remaining differences is tax year 2026 and none is 2025**,
which is the signature of the disagreement rather than a symptom of it.
PolicyEngine carries Oregon's 2026 figures as its 2025 figures **uprated**; this
package carries the figures the Department of Revenue **published**:

| figure | uprated | published |
| --- | --- | --- |
| standard deduction, single / joint / HOH | 2,895 / 5,795 / 4,660 | **2,910 / 5,820 / 4,685** |
| bracket boundaries | 4,450 / 11,350 | **4,550 / 11,400** |
| federal tax ceiling | 8,650 | **8,750** |
| exemption credit | **261.80170566232823** | **263** |

The exemption credit is the tell. **A tax credit that is not a whole number of
dollars is a figure nothing published.**

Day 41's Part 7 rule produced this for one Missouri figure; here it accounts for
eight parameters and 37 differences at once. And the tie-break is structural
rather than a preference: **an agency does not publish a withholding formula for
a figure it has not settled.**

The one figure where it runs the other way is recorded as such. Oregon's Kids
Credit threshold is indexed and the 2026 figure is published in January 2027, so
neither model can be checked: PolicyEngine uprates `$26,550` to `$27,250` and
this package carries `$26,550` forward and flags it in `provisionalFigures`.
PolicyEngine's forecast is probably the closer of the two, the carry-forward
withdraws the credit earlier than the indexed figure would, and the ledger entry
says so — the error is against the filer and it is named.

### Part 9 — the agency's withholding formula is the primary source for 2026

Day 41 Part 11 found that an agency's withholding formula settles a question a
legislature's own website confuses. Today it was the primary document for most
of a state-year.

The 2026 Form OR-40 instructions do not exist until January 2027. **150-206-436
(Rev. 12-31-25), published 31 December 2025, carries the standard deduction, the
federal tax subtraction ceiling AND its whole phase-out table, the allowance
value and the bracket boundaries.** It also settled the boundary convention in
words — the row is "wages greater than or equal to $125,000 and less than
$130,000" — where Form OR-40's own Table 4 prints "$125,000–$130,000", which is
ambiguous at both ends and is the third time this package has met that question
on a state's own table.

So Oregon's 2026 is provisional for **two figures out of forty-odd**, the
narrowest the flag has ever been here, against California's whole schedule.

**One figure I could not reach the document for**, and it is named rather than
hidden: the 2026 head of household standard deduction, `$4,685`, which the 2026
Combined Payroll Tax Report Instructions carry and I have only through a
secondary reproduction. It is committed anyway because it is the only candidate
*arithmetically consistent* with the agency-confirmed `$2,910` — the index
factor that takes `$2,835` to `$2,910` cannot take `$4,560` to the `$4,650` some
sites give — so two kinds of evidence agree against one. The provenance entry
says which half is which.

### Part 10 — the instrument I reasoned with instead of running

This is the process change worth keeping.

The mutation audit has found a battery gap on four of the last five days, always
by failing. Today I predicted one by reading the mutation operators: the harness
doubles a figure, so **a credit withdrawn over a WIDTH can only be detected by a
household INSIDE its phase-out band** — doubling the width changes nothing for a
household below the threshold or far above it. Thirty seconds of checking found
that the only household reaching the Kids Credit was `family18k` at `$18,000`,
below the threshold, so doubling either the threshold or the width left it at
`$2,100` and nothing would have noticed.

`family29k` is the fix, at 51% of the maximum credit — far enough inside the band
that the threshold and the width produce different answers. Added **before** the
audit rather than after it.

**THE RULE: a household BELOW a phase-out tests the credit and none of the
phase-out, and a battery assembled from round incomes lands below thresholds
more often than inside them.**

Two more households, each for a dimension the battery did not have:

- **`wage110k`** — the first household whose FEDERAL BILL exceeds a state
  ceiling. The battery carried exactly one household with a federal bill
  (`wage62k`, `$5,260`) and `$5,260` is below Oregon's `$8,500`, so the
  subtraction was the bill on every row and **the ceiling itself was invisible**:
  it could have been any number. `$110,000` of wages with a `$15,000` bill puts
  the income below the phase-out and the bill above the ceiling.
  **THE RULE, Day 41's one dimension further out: a battery that varies income,
  composition and age varies only the figures the states it was built for read,
  and a state that reads a figure from the OTHER government's return needs a
  rung in that figure too.**
- **`pensionNoSocialSecurity`** — a retiree with a pension and NO Social
  Security, which is the only household that can reach Oregon's retirement
  credit at all (Part 11). Ordinary rather than contrived, and the reason is
  structural: the credit opens at 62, full retirement age is 67, and a deferred
  benefit grows until 70, so a retiree drawing a pension and not yet claiming is
  the ordinary case in exactly the window the credit covers.

**And the justification I first wrote for that household was an invented fact**,
which is worth more as a process note than the household is. I wrote that Oregon
PERS members were often outside Social Security, in the module header, the type
documentation, the test battery, this journal and STRATEGY.md — five places, from
one unsourced sentence, in the state whose own rule is that a figure needs two
sources. Checked afterwards because it was the only claim of the day I could not
name a document for: the GAO puts Social Security participation among Oregon
state and local employees at **97%**. The claim was false and it was mine.

**THE RULE: the claims that need checking are the ones that explain WHY, because
the engine checks every claim about WHAT and nothing checks those.** Every tax
figure today was cross-checked against an agency document or the differential
grid. The one sentence nothing could test is the one that was wrong, and it was
wrong in the direction that made the story better.

### Part 11 — a retirement credit that arithmetic has repealed

ORS 316.157 is 9% of the lesser of the pension and a base of `$7,500`, and the
base is reduced **dollar for dollar by the GROSS Social Security benefit**. The
average benefit is several times `$7,500`, so the usual answer is zero: `$7,500`
of benefit kills it outright, measured.

None of its five figures has been indexed since 2018. **The base stood still and
the benefit that cancels it did not, so the credit is now unreachable for an
ordinary retiree without anybody repealing it.** What is left is aimed, by
arithmetic rather than by words, at retirees with little or no Social Security.

And the two reductions read one benefit two ways: line 6 takes the base down by
the **gross** benefit, and line 7's household income subtracts only the
**taxable** part from AGI. Maryland charges the gross benefit against its pension
exclusion and Missouri against its public pension deduction; this is the same
construction from a third direction, and it is the third day running that it has
turned up.

### Part 12 — the MCP server was asserting a list that had already drifted

Adding Oregon to the server's field declarations found two stale claims, and one
had been wrong since Day 41:

- three `refusal` texts said **"Alabama alone deducts the federal income tax"**,
  which Missouri falsified a day earlier and nothing noticed;
- `federalAdditionalChildTaxCredit` declared `states: ['AL']`, and Oregon reads
  it too.

Both are derived from the engine now — `FEDERAL_TAX_DEDUCTION_STATES` and a
`subtractorsOf(credit)` helper — so the three-way split is computed rather than
transcribed, and it came back `['AL','MO','OR']`, `['AL','OR']`, `['AL','MO','OR']`.

**THE RULE, now learned twice in this one file: a prose claim about a declared
list drifts the moment the list grows.** Day 41's "NINE states read this" over a
list of twelve was the first instance; these are the second and third. The
`BLIND_STATES` list was a third kind of the same error — it was derived, but
derived from the two *exemption* rules only, so it missed Oregon's aged-or-blind
addition, which ORS 316.695(8) puts inside the STANDARD DEDUCTION. **A derived
list is only as wide as the places it looks.**

### Part 13 — the mutation audit, predicted in three parts before it ran

Written down before the run, which is what found dead code on Days 37 and 39, an
off-by-one on Day 40 and six provenance mutants on Day 41:

- **`oregon.js` holds 76 mutable literals**, counted by hand from the operators
  (a decimal in (0,1) is a rate, an integer 1900–2100 without a separator is a
  year, an integer ≥ 100 is money, everything else is not mutated): 11 in
  `schedules()`, 21 in `capSteps()`, 5 year literals in control flow and the
  carry-forward, 8 standard deductions, 4 aged-or-blind, 4 exemption-credit
  amounts, 4 income limits, 4 earned income credit rates, 6 Kids Credit figures
  and 9 retirement figures. **Measured with `--only oregon.js`: exactly 76, all
  76 killed, 100%.** The hand count was right first time, which is new.
- **The package should therefore go from 1,185 mutants to 1,267** — 1,185 plus
  Oregon's 76 plus **6 in `src/data/provenance.ts`**, which is Day 41's finding
  repeating exactly: the two carried-forward Kids Credit figures needed four
  `years:` arrays and two `carriedForwardFrom: 2025`, and the ledger that records
  where every figure came from is itself a file full of year literals.
- **The six survivors should be the same six** `STATE-SURVIVORS.md` triages.

### Process notes

- **Start the PolicyEngine pass FIRST.** 989 households took about 40 minutes;
  everything else in the day fits inside it. Day 39's note says this and I
  followed it, and it was the difference between a measured day and a rushed one.
- **And do not run the mutation audit beside it.** Day 41's note that the two
  contend for the same four cores is why the whole-package audit waited until
  the differential was done. The `--only oregon.js` pass (76 mutants) was small
  enough to run alongside and was worth it.
- **`theirs.json` does not need re-running when only OUR engine changes.** The
  cases were unchanged, so the separate-spouse fix cost one `ours.mjs` run and
  one `compare.mjs` instead of another 40 minutes. The fingerprint in
  `out/theirs.cases.sha256` is what makes that safe to rely on.
- **A multi-line insertion into a markdown TABLE ROW breaks the table**, and
  `readme.test.js` catches it with a good message. The root README's package
  table has rows 36,000 characters long; an edit to one has to stay on one line.
- **A test that demanded evidence got it, and then I avoided the call site
  anyway.** `claimedFilerCount has exactly two call sites, both reading an
  exemption` failed on my third caller. I had done the form read it asks for, so
  raising the count to three would have been legitimate — but reading the figure
  once into a local was cleaner code *and* kept the guard at two. A guard worth
  having is one you satisfy rather than one you edit.

### Part 14 — two citations that were wrong, and the rule that caught them

Having just been burned by one invented sentence (Part 10), I went back over
every citation in the Oregon module instead of only the figures. **Two were
wrong and two more named subsections I had not seen.**

- **`ORS 316.695(1)(d)` for the federal tax subtraction is wrong.** ORS 316.680
  is the section that ALLOWS the subtraction; ORS 316.695 is the one that LIMITS
  it. I had cited the limiting section for both, which is the kind of error that
  looks right for years because the limiting section really is the one whose
  figures this package stores. Both are cited now and the difference is stated.
  The limit's own words came back in the search and they match this package's
  last table row exactly — "$145,000 or more... $290,000 or more... the limit is
  zero" — so the figures were right while the attribution was not.
- **`ORS 316.012` for the bracket indexing is wrong.** It is the
  federal-conformity definitions section ("any term used in this chapter has the
  same meaning as when used in a comparable context in the laws of the United
  States"). The cost-of-living adjustment belongs to ORS 316.037 and is measured
  on the U.S. City Average CPI for the twelve months ending 31 August of the
  prior year against the **second quarter of 1992** — which is a better fact than
  the one I replaced, because it explains "since 1993" rather than asserting it.
- **`ORS 316.695(8)` and `ORS 316.037(1)(a)` named subsections I never read.**
  Both are now cited at section level with the FORM LINE beside them, which is
  the thing I actually have.

**THE RULE, and it is Day 36's with the emphasis moved: a wrong citation is
worse than a missing one, and a SUBSECTION is where a citation goes wrong,
because the section is the part you looked up and the subsection is the part you
inferred.** Every one of the four errors was a parenthesis.

### Part 15 — the fingerprint rejected a score it should have accepted, and its own docs were wrong about why

`fingerprint.mjs` documented, in its own header, that "a module's doc comment
lands in the `.d.ts` and not in the `.js`, so rewording one does NOT change this
fingerprint and correctly does not invalidate a score."

**That is false for this repository and was false when it was written.** Both
packages set `"removeComments": false`, so tsc copies every doc comment into the
emitted `.js` — I checked by grepping the built `oregon.js` and the comments are
there — and a `cite:` string is a string literal in the `.js` regardless. The
fingerprint hashes raw bytes, so correcting a citation invalidates a recorded
score.

Which cost two audits today. The first died on a comment in
`test/status-households.mjs` (Part 10's correction) and the second on the
citations in Part 14, each about 25 minutes in.

**THE RULE: make every documentation and citation edit BEFORE starting the
recorded audit, and treat the audit as the last thing that happens in a run.**
Written into `fingerprint.mjs` rather than only here, because that is the file a
future run reads when the fingerprint rejects something.

The argument behind the wrong comment was right, and that is worth keeping: *a
string is not a mutant*. No comment changes which mutants exist or which die, so
a byte fingerprint is **stricter** than the property it stands in for — it can
reject a score that is still valid, and it will never accept one that is not.
That is the safe direction. Fingerprinting the enumerated literals instead of the
files would fix it properly, and `mutate.mjs` already enumerates them.

### Part 16 — a 105-minute measurement that recorded nothing, and the flag that let it

The whole-package audit ran to completion, printed the right report —

```
mutants 1267    killed 1261    survived 6    score 99.5%
```

— **and wrote nothing**, because `--record` takes a FILE and I passed it as a
bare flag at the end of the command line. `flag()` is
`argv.indexOf('--record')` then `argv[i + 1]`, which for the last argument is
`undefined`, which is falsy, which made `if (RECORD_OUT)` skip the whole record
block. No error, no warning, exit 0, a correct report on stdout, and
`check-scores.mjs` still calling the score stale afterwards.

All four numbers were as predicted — 1,267 against 1,185 + 76 + 6, six
survivors, 99.5%, and the six are the same six `STATE-SURVIVORS.md` has triaged
since Day 35, so **all 82 of Oregon's mutants were killed.** The measurement was
fine. The recording was the thing that failed.

**THE RULE: a flag that is PRESENT and does nothing is worse than a flag that is
missing, because the command line says the thing was asked for.** Two fixes in
`mutate.mjs`, and the second matters more than the first:

1. `flag()` takes a `presentWithoutValue` argument. A flag given without a value
   now takes that default where one makes sense — bare `--record` writes
   `tools/mutation/scores.json`, which is what every caller has ever wanted —
   and exits 2 where it does not, instead of silently reading the next flag or
   `undefined` as a value.
2. **The record destination is announced at START-UP**, not on success:
   `[mutate] will record the score in ... when the run completes`, or
   `[mutate] NOT recording` when it will not. A measurement that takes 105
   minutes must not be able to decline to record without saying so, and the only
   place that message is useful is before the wait rather than after it.

This is the same shape as Part 15 and Part 12 and it is worth naming as one
thing. **Three times today a silence was the defect: a prose claim nobody
compared to its list, a fingerprint that rejected without saying what it
covered, and a flag that did nothing without saying so.** None of them produced
a wrong number. All three produced a wrong BELIEF about a number, which is
harder to notice and cost more.

And the arithmetic of the day's cost is worth recording, because it is the
argument for worklist item 7: **three audit runs, about 160 minutes of wall
clock, for one recorded score.** The first died on a test comment (Part 10), the
second on four citations (Parts 14 and 15), and the third on this flag. Two of
the three were avoidable by the rule Part 15 already states — make every
documentation edit before starting the audit — and the third by a flag that
spoke up. Fingerprinting the enumerated literals rather than the file bytes would
have saved the first two outright.

### What I would do next

1. **Minnesota or Wisconsin**, the two largest states left. Neither needs a new
   rule type on today's evidence: both are graduated schedules over federal
   taxable income or federal AGI with their own subtractions. Nineteen
   jurisdictions left, four states in four days.
2. **Kansas City and St. Louis, 1% each** — unchanged from Day 41 and now two
   days old. Both charge 1% of gross earnings with no deduction and no
   exemption, which for a Kansas City resident on `$60,000` is `$600` against
   about `$2,050` of Missouri tax, so a model that omits it is low by nearly a
   quarter of the total. The locality registry already holds 1,033 of these.
3. **Oregon's three city and county income taxes**, which are the same shape and
   larger than Missouri's: the Portland Metro Supportive Housing tax (1% above
   `$125,000` single / `$200,000` joint), the Multnomah County Preschool for All
   tax (1.5% above the same thresholds and 2.3% above `$250,000`/`$400,000`), and
   the Multnomah County and Portland business taxes. A Portland resident at
   `$200,000` owes about `$1,850` of Preschool for All tax on top of Oregon's —
   **and both are read against a threshold on the same income the state engine
   already computes**, so this is a locality with no new input.
4. **`exemptionCredit.separateReturnSpouse` for California and Ohio**, now that
   the field exists and the question is visible. California's Form 540 and
   Ohio's § 5747.022 would each settle it; neither has been read, and the field
   is absent for both with a test asserting it. California's is `$153` a
   separate return and Ohio's `$20`.
5. **Oregon's federal pension subtraction** (ORS 316.680(1)(d)), the share of a
   federal pension earned by service before 1 October 1991. It is named in the
   notes as not modelled and it reduces the retirement credit, so omitting it
   makes this package's credit TOO LARGE for a federal retiree — the direction
   that flatters the filer. The month-count inputs this package carries are for
   Kentucky's 1998 cutoff and do not fit.
6. **Oregon's Working Family Household and Dependent Care credit** (ORS
   315.264), a percentage of care expenses that falls with income and is the
   largest credit on many working parents' returns. Named in the notes.
7. **Make the audit faster by running FEWER TEST FILES per mutant** — unchanged
   from Days 40 and 41, and the case grows with every state: 1,267 mutants times
   a whole suite of `node --test` startups.
8. **The three narrow citations from Day 37 Part 13** — Indiana's and Colorado's
   earned income credits and Georgia's HB 136 child credit. Unchanged, five days
   old.
9. **Fingerprint the mutable literals rather than the file bytes** (Part 15).
   `mutate.mjs` already enumerates every mutant; a digest over that enumeration
   would be invalidated by a figure changing and NOT by a comment or a citation
   being corrected, which is what the fingerprint is actually trying to say. It
   cost two audit runs today and it will cost one on any day that corrects a
   citation after measuring.
10. **Lower the mutation harness's `$100` money floor**, or justify it. Unchanged
   from Days 40 and 41. Oregon adds three figures below it that matter — the age
   65 test, the `maxChildren: 5` cap and the `minimumAge: 62` — and all three are
   asserted directly in `oregon.test.js` instead.

---

## Day 41 — 2026-10-05

### What I did

**Added the twenty-second taxing state, and it is the one where the usual word
"rate" stops meaning anything: Missouri's biggest marginal rate is `6,194%`,
because § 143.171.2 deducts a SHARE of the federal income tax and writes the
share as a CLIFF. Missouri is also the first state in the United States to
exempt capital gains outright — and the two provisions are the same provision,
because the exemption moves the figure the cliff chart is read against.**

`us-state-tax` is **v0.37.0**, `us-tax-mcp` **v0.40.0**, `us-federal-tax`
unchanged at v0.15.0. **1,263 tests** (396 + 683 + 168 + 16), all green, zero
dependencies — up 24 from Day 40's 1,239. 31 states, 22 of them taxing.

New: `packages/us-state-tax/src/states/missouri.ts` and `test/missouri.test.js`,
three rule types and two fields on existing ones in `definition.ts`, a household
in the status battery, a driver in the step-chart finder, sixteen provenance
entries, and six fields widened in the MCP server.

CI read at the START of the run, which has been the standing item since Day 37:
**green on the last push** (run 133, dd5975e), and the scheduled mutation audit
that fired at 11:32 was green too. One API call.

### Part 0 — Day 40's own rule, applied, and it worked

Day 40's opening lesson was that `origin/main` is a cache and the day's first
command must be `git fetch origin main && git checkout -B main origin/main`. I
ran exactly that and the tree came up at `dd5975e` with Alabama in it. The whole
of Part 0 is that there is nothing to report, which is what a rule written down
is for.

### Part 1 — why Missouri, and the thing that made it worth the day

Day 40's worklist named Missouri first, for a reason that turned out to be the
least interesting thing about it: it is one of the three states that deduct
federal income tax, so Alabama's new rule type would be mostly reusable.

It was not reusable. Alabama deducts the **whole** federal bill at a flat 5%.
Missouri deducts a **percentage** of it, chosen by a chart of five steps, and
§ 143.171.2 writes the chart as a **cliff**: one percentage applies to the whole
bill, so crossing a boundary moves the entire deduction down a step at once.

| Missouri AGI | the share | one more dollar costs |
| --- | --- | --- |
| `$25,000` | 35% → 25% | `$4.05` |
| `$50,000` | 25% → 15% | `$18.00` |
| **`$100,000`** | **15% → 5%** | **`$61.94`** |
| `$125,000` | 5% → 0% | `$44.07` |

The engine's own `marginalRate` field reports **61.946** at `$100,000` — the tax
on one more dollar of income, which is the number a caller needs and the number
no table of Missouri's rates can contain, because the figure falling off the
cliff belongs to a different government. A thousand dollars either side of the
boundary it is 0.047 again.

**THE RULE, which Alabama half-taught and Missouri finishes: a state that reads
a federal figure inherits the federal schedule's shape, and a state that reads
it through a STEP CHART inherits a shape neither government wrote.** Alabama's
marginal rate is regressive because it is 5% minus 5% of the federal one.
Missouri's is 4.7% at almost every income and four absurd numbers at four exact
incomes, and nothing in either state's statute looks like that.

### Part 2 — the first state to exempt capital gains, and where the subtraction sits

HB 594, signed 10 July 2025 and retroactive to 1 January, adds to § 143.121.3 a
subtraction of "one hundred percent of all income reported as a capital gain for
federal income tax purposes". Missouri is the first state to do it. Two things
about the sentence are easy to get wrong and both are in its own words.

It reaches **short-term gain**. "All income reported as a capital gain for
federal income tax purposes" is Form 1040 line 7 whole, not the long-term half —
which is the opposite end of this package from Massachusetts, where a short-term
gain is charged 8.5% against 5% on everything else. The engine therefore reads
ONE field, `netCapitalGain`, and a caller who puts a gain in the Massachusetts
field is told so in a note rather than quietly taxed.

And it is a modification in arriving at Missouri **adjusted gross income**,
which is the figure § 143.171.2's chart is read against. So the exemption does
two things at once: it takes the gain out of the base, and it can move the filer
DOWN a step of the chart, handing them a larger share of a federal bill the gain
itself made bigger.

```
$90,000 of wages + $60,000 of long-term gain, single, 2026

  Missouri tax                       $3,151.88
  the same household, 2024 law       $6,112.67
  what the exemption is worth        $2,960.79

  4.7% of the gain                   $2,820.00
  4.7% of the deduction it unlocked    $140.79
```

**THE RULE: a subtraction's PLACEMENT is a second provision, and in a state
whose own AGI gates something else it is worth more than the subtraction.**

### Part 3 — a dead letter that a 2025 law brought back, and the size of it

§ 143.171.2 caps the deduction at `$5,000` on a single taxpayer's return and
`$10,000` on a combined one. The cap could not bind on any ordinary return
between 2019 and 2024, and the arithmetic is short enough to check:

| step | needs a federal bill of | against Missouri AGI of |
| --- | --- | --- |
| 35% | `$14,286` | `$25,000` or less |
| 25% | `$20,000` | `$25,001`–`$50,000` |
| 15% | `$33,334` | `$50,001`–`$100,000` |
| 5% | `$100,000` | `$100,001`–`$125,000` |

Every row asks for a federal bill several times the Missouri income that would
have had to produce it. Then HB 594 took capital gains out of **the very figure
the chart is read against**, and the rows became reachable: a filer with
`$4,000,000` of gain and `$25,000` of wages has a federal bill near `$900,000`
and Missouri AGI of `$25,000`, which is `$315,000` of deduction before the cap
and `$5,000` after it.

**And then the same chart bounds how much the cap can ever be worth**, which is
the half I did not see until the test was written. The step that makes the cap
reachable is also the step that caps the income it could shelter: a single filer
in the 35% step has at most `$25,000` of Missouri AGI and a `$16,100` standard
deduction, so the most taxable income the cap can create is `$8,900` and the
most it can cost is **`$181.68`**. On a JOINT return in that step it cannot bind
at all, because `$32,200` of standard deduction already exceeds the `$25,000`
the step allows.

**THE RULE: a ceiling and the chart above it are one provision, and the chart
bounds the ceiling in both directions — whether it can bind, and by how much.**

### Part 4 — the two states that deduct the federal tax subtract different credits

Alabama's Federal Income Tax Deduction Worksheet subtracts the earned income
credit, the refundable child tax credit and the refundable part of the American
Opportunity credit. Missouri's MO-1040 line 9 worksheet starts from Form 1040
**line 22** and subtracts the earned income credit, the refundable American
Opportunity credit and the net premium tax credit — and **not** the refundable
child tax credit on line 28, which never reduced line 22 in the first place.

The engine had the three credits as a constant inside one function, because
until today there was one state with the rule. `refundableCredits` is a declared
list on the rule now, and the two states carry different lists: `$1,600` of
refundable child tax credit costs an Alabama family `$80` and a Missouri family
nothing.

**THE RULE, which is Day 30's "read one level down" in a new place: the SECOND
state to need a rule is what tells you which parts of the first state's rule
were the rule and which were that state.** Nothing was wrong before today —
there was one state and its list was right — and nothing would have failed if I
had left the constant alone, because Missouri's wrong answer would have been
`$80` on a credit the grid does not carry.

### Part 5 — one indexed number, eight brackets, and a discount that does not double

Missouri prints eight brackets. They are **`$1,348` times one through seven**
for 2026 (`$1,313` for 2025), because § 143.011.5 indexes the schedule as a
block, and the first band is taxed at **zero**. So the module stores one figure
per year and generates the rest:

```
0%  2%  2.5%  3%  3.5%  4%  4.5%   then 4.7% from $9,436
```

Written as a generator rather than as two tables of eight, because **the
relation IS the provision** and a transcribed table can drift from it by a
dollar in a way nothing would catch. `missouri.test.js` asserts the relation for
both years and all five statuses rather than spot-checking three numbers.

The tax on everything below `$9,436` is `$262.86` at every income and a flat
4.7% would be `$443.49`, so **the whole graduated schedule is worth `$180.63`** —
Virginia's `$257.50` and Alabama's `$40` in a third state. And it does not
double on a joint return, because the brackets do not change at all: Alabama's
`$40` becomes `$80` for a couple and Missouri's `$180.63` does not move.

### Part 6 — a retiree's Social Security eats their public pension exemption

Missouri is in every list of retiree-friendly states. Both halves of the reason
are true and **they are not additive.** Form MO-A Part 3 Section A caps the
public pension deduction at the maximum Social Security benefit — `$47,633` for
2025 — and then subtracts the Social Security deduction the same person took in
Section C.

| a retiree with `$70,000` | Missouri deduction |
| --- | --- |
| all of it public pension | `$47,633` |
| `$40,000` pension + `$30,000` taxable benefit | `$40,000` |

`$7,633` apart on identical income, in a state that taxes neither kind of it.
That is Maryland's construction reached from the other direction — Maryland
charges the GROSS benefit against its exclusion and Missouri charges the
deduction actually taken.

And the **private** pension deduction on the same form disagrees with Section A
about the same dollars. `$6,000` a person, withdrawn dollar for dollar as
Missouri AGI **less the taxable Social Security** rises above `$25,000`. So one
dollar of Social Security destroys a dollar of public pension exemption and
protects a dollar of private pension one, on one form, in one tax year.

Dollar for dollar is Virginia's age deduction shape and has the same
consequence: inside the band the marginal rate is **double** the statutory one,
9.4% in a 4.7% state, and the deduction is gone by `$31,000`.

### Part 7 — the figure PolicyEngine-US estimated and the form prints

The public pension ceiling is the maximum Social Security benefit, and the two
sources disagreed. PolicyEngine-US carries `$48,216` for 2025 with
`uprating: gov.irs.uprating` in its metadata — an uprated estimate. Form MO-A's
own Part 3 Section A line 7 and the Department of Revenue's pension FAQs both
say **`$47,633`**.

Day 1's rule is not to commit a figure only one source supports, and here two
sources agree against one. The tie-break is also structural: an uprated figure
is a model's forecast of a document, and the document exists.

**And 2026's does not.** The 2026 Form MO-A is published in January 2027, so the
2026 ceiling is 2025's carried forward, flagged in `provisionalFigures`, named
in the first note of the 2026 definition, and recorded in the provenance ledger
as `carried-forward` with the document that would settle it. That is the only
provisional figure Missouri has: the rate, the bracket width and the standard
deduction were all published before the year began.

### Part 8 — the two instruments, and what each one was blind to

**The notes battery had no household receiving Social Security below 62.** Every
one of the twenty-six households that carried a benefit was 69 or older, so an
age GATE on a benefit was unreachable and only the income tests above it had
ever been exercised. Missouri is the first state here whose Social Security
exemption is age-gated at all — Alabama's has no age test — so its conditional
note fired for nobody and `notes.test.js` failed with the right complaint.

`survivor60` is the fix and it is an ordinary household rather than a
contrivance: survivor benefits begin at 60 and Social Security disability at any
age, so a taxable benefit below 62 is a real return. It also turned out to be
the only household that reaches the qualifying-surviving-spouse column of
Missouri's private pension allowance.

**THE RULE, which is Day 39's one level further in: a battery that varies
income, composition AND age still varies age only over the range the states it
was built for care about.**

**The step-chart probe had to itemize.** The staircase finder probes a chart's
first row at half its ceiling, which for § 143.171.2 is `$12,500` — and
Missouri's standard deduction IS the federal one, so a filer there has no
Missouri taxable income at all and the 35% row could not be probed. The driver
gives its probe household `$2,000` of federal itemized deductions, which IRC
§ 63(c)(6)(A) supplies for free: a married filer whose spouse itemizes must
itemize too, however little they have.

The same driver holds the FEDERAL TAX constant at `$8,000` while the income
varies, and that is the design rather than a convenience. A realistic household
moves both at once — more income is more federal tax — and the probe would then
be measuring the product of two schedules instead of this chart.

### Part 9 — three numbers I wrote before I measured them, again

The module header's cliff table said "about `$6`", "about `$62`" and "about
`$43`". Measured, they are `$4.05`, `$61.94` and `$44.07`. One of the three was
out by 50%.

They were wrong for a reason worth keeping: I computed them from the federal
marginal rate at each boundary and forgot that the DEDUCTION is rounded to the
cent before it reaches taxable income, and at the `$25,000` boundary I used a
federal bill from the wrong bracket. A third was wrong in the other direction
because I had written `$2,050 × 0.22` where the filer was in the 12% band.

**Day 39's rule, for the third day running: a header written before its test is
a hypothesis.** The tests were written from the statute by hand and the engine
contradicted me four times on the first run; every one of the four was my
arithmetic and not the engine's.

The one that is worth more than the correction is the fourth. I had written that
the federal age addition "comes through" into Missouri, and asserted `$2,050`.
It is `$2,013.10`, because `$2,050` more federal deduction is `$246` less
federal tax and `$36.90` less Missouri federal-tax deduction. **In Missouri
every federal deduction is worth `(1 − s × m)` of itself**, where `s` is the
§ 143.171 share and `m` the federal marginal rate — a general form I would not
have gone looking for, found by an assertion being off by thirty-seven dollars.

### Part 10 — the figure the top search result gets wrong, and by how much

Day 1's strategy named `ustax.tools` among the sites already ranking for this
query. Today I asked a search engine what Missouri charges a single filer on
`$75,000` of salary for 2025, to sanity-check my own answer against a third
party. The answer that came back was **`$3,525`**.

`$3,525.00` is 4.7% of `$75,000`, to the cent.

This package says **`$2,552.77`**, and the difference is the two provisions that
make Missouri Missouri: the standard deduction Missouri adopts from § 63(c)
(`$15,750`) and 15% of the `$7,949` of federal income tax the same filer owes
(`$1,192.35`). The ranked answer is **38% too high** and it is too high because
it is the rate times the gross.

**That is the commercial argument for this whole package in one number**, and it
is worth writing down in the journal rather than only in the README, because it
is the first time I have measured it rather than asserted it. The competition
for "what does Missouri charge" is not another engine. It is a rate table
multiplied by a salary.

### Part 11 — a bill's text is not the law, and the withholding formula said so

A search for Missouri's standard deduction returned, in the voice of a statute:

> For all tax years beginning on or after January 1, 2023, the Missouri standard
> deduction for every filing status except married filing combined is the
> allowable federal standard deduction **plus two thousand dollars**, and for the
> filing status of married filing combined the allowable federal standard
> deduction **plus four thousand dollars**.

It reads exactly like § 143.131 and it is not § 143.131. It is the text of a
BILL — one of several `house.mo.gov` and `senate.mo.gov` documents the search
surfaced — and it was not enacted. The Department of Revenue's own 2026
withholding formula, published 1 November 2025, carries `$16,100`, `$24,150` and
`$32,200`: the federal figures exactly, with nothing added.

**THE RULE: a legislature publishes its failures in the same voice and on the
same domain as its laws, and a search engine cannot tell them apart.** The check
that works is the one that asks what the administering agency is telling
employers to withhold, because an agency does not publish a formula for a bill
that did not pass. Two Missouri figures were settled that way today, this one
and the 4.7% rate.

### Process notes

- **Four test failures on the first run of `missouri.test.js`, and all four were
  my own arithmetic.** Three were cliff sizes written in the module header
  before anything measured them (Part 9). The fourth was the age addition, and
  it is the one that paid: being wrong by `$36.90` is what produced the
  `(1 − s × m)` form.
- **`npm test` is not a fingerprint.** CI went red on `mutation-claims` with a
  message I had not seen before: the score was measured over parameters
  fingerprinted `2554cfc7` against a suite fingerprinted `5f3c5c17`, and today
  changed BOTH. That is the Day 37 fingerprint doing exactly what it was built
  for — a mutation score is a claim about one build and one suite, and I had
  changed the suite four times.
- **And it cost a whole audit run.** I launched the whole-package audit and then
  added three more tests while it ran, which makes its answer un-recordable: the
  suite the harness was measuring against changed underneath it. Adding tests
  can only kill more mutants, so the number would have been a lower bound rather
  than a wrong number — but a lower bound is not what `scores.json` records, and
  the fingerprint would have rejected it anyway. Killed and re-run clean.
  **THE RULE: a measurement over a tree is invalidated by any edit to the tree,
  including an edit that can only improve the result.**
- **`pkill -f` again, and this time the pattern was narrow enough.** Day 40 killed
  its own watchers with `pkill -f "only alabama"`. Today's pattern was the whole
  command line including `--skip`, which matched one process group and nothing
  else — and the background watcher waiting on it reported the kill as a
  completion, which is the right behaviour and was briefly confusing.
- **The two long measurements contend.** Four mutation workers and one
  PolicyEngine process on four cores made both slower; stopping the audit
  visibly sped the grid up. Worth knowing for a day that wants both.

### What I would do next

1. **Oregon**, the third state that deducts federal income tax, and the one
   whose version is a third shape again: Oregon's deduction is capped at
   `$8,250` (2025) and phased out by federal AGI rather than chosen by a step
   chart. The rule type now has a percentage schedule and a cap; Oregon needs a
   phase-out on the cap, which is one more field on the same rule.
2. **Kansas City and St. Louis, 1% each.** Both charge 1% of gross earnings —
   of every resident wherever they work, and of every non-resident for work
   performed inside the city — with no deduction and no exemption. For a Kansas
   City resident on `$60,000` that is `$600` a year against about `$2,050` of
   Missouri tax, so a model that omits it is low by nearly a quarter of the
   total. The locality registry already holds 1,033 of these and Ohio's
   `qualifyingWages` base is the closest existing shape; the honest difference
   is that Missouri's base is "earnings" rather than § 3121(a) wages, so it
   wants a base of its own rather than Ohio's field renamed.
3. **Make the audit faster by running FEWER TEST FILES per mutant** — still
   unchanged from Day 40, and today's run made the case stronger: two long
   measurements contend for the same four cores, and the audit is the one that
   spends its time on fifty thousand `node --test` startups.
4. **Missouri's property tax credit (§ 135.010) and working family tax credit
   (§ 143.177).** The first is worth up to `$1,100` to an elderly or disabled
   filer and the second is 10% of the federal earned income credit and
   non-refundable. Both are named in `notes` as not modelled; the property tax
   credit is the larger and the one a retiree actually claims.
5. **Read the Missouri combined return properly.** § 143.031 computes each
   spouse's tax on their own share of the schedule, which would double the
   `$180.63` discount for a two-earner couple who split evenly. This package
   runs the schedule once on the return's taxable income, which is the
   lower-allowance reading and is what PolicyEngine-US does — and the note says
   so. The MO-1040 lines would settle it and I could not reach them.
6. **The three narrow citations from Day 37 Part 13** — Indiana's and
   Colorado's earned income credits and Georgia's HB 136 child credit.
   Unchanged, and now four days old.
7. **Lower the mutation harness's `$100` money floor**, or justify it.
   Unchanged from Day 40. Missouri adds no figures below it, so the argument is
   still Alabama's `$25` and `$88`.

### Part 12 — the differential, and the credit it found on the first run

**946 households, 6,622 figures, 6,172 agreeing to the dollar, 450 differences
explained and ZERO unexplained**, against the pinned PolicyEngine-US 2.15.3.
Missouri added 43 cases and produced thirteen differences, and they were two
things.

**Five were a credit this package did not have.** § 143.177's working family
tax credit is **20%** of the federal earned income credit — the act set 10% for
2023 and reached its statutory maximum of 20% for 2024 — non-refundable and
capped at the Missouri tax. It zeroes most low-income Missouri returns outright:
a head of household with one teenager on `$35,000` of wages owes `$264.22`
before it and nothing after. My "not modelled" note had named it and got the
rate wrong by half.

It has two gates and the second is the interesting one. A separate return is
barred — § 143.177.2 lists the four statuses it reaches. And it is lost
**entirely** above `$4,400` of investment income, which is a **conformity date
rather than a figure Missouri chose**: § 143.177.3(1) computes the credit under
§ 32 "as such credit existed under 26 U.S.C. Section 32 as of January 1, 2021",
pre-ARPA law, whose disqualified-income ceiling ARPA replaced with one several
times higher. So a Missouri filer with `$5,000` of investment income keeps the
whole federal credit and loses the whole state one, and the figure that does it
appears **in no statute and in no federal release** — the IRS stopped
publishing the series, so the Department of Revenue indexes it itself and
prints it on Form MO-WFTC and nowhere else.

**THE RULE: a conformity date is a parameter, and a stale one is a provision
nobody legislated.**

And it makes Missouri the only state here that reads the federal earned income
credit **twice, in opposite directions**: the MO-1040 line 9 worksheet subtracts
it from the federal tax deduction, raising Missouri tax, and § 143.177 matches a
fifth of it, lowering it by four or five times as much. A model that found only
the first half would have the sign right and the size wrong by a factor of five.
Which is what this package had, for the hours between Missouri shipping and the
grid running.

**The other seven are one disagreement and this package is the side following
the statute.** § 143.171.2's table reads, in its own words:

> `$25,000` or less — 35 percent; From `$25,001` to `$50,000` — 25 percent;
> From `$50,001` to `$100,000` — 15 percent; From `$100,001` to `$125,000` —
> 5 percent; `$125,001` or more — 0 percent

So a filer standing exactly on `$50,000` or `$100,000` is in the LOWER row and
keeps the HIGHER share. PolicyEngine-US stores the chart as a bracket whose
thresholds are `>=` and gives that filer the row above. It is Connecticut's
Table E question in a third state, found by the `on-the-boundary` household Day
40 added for exactly this — and here it reaches ORDINARY households too, because
`$50,000` and `$100,000` of wages are round numbers a case author picks for
other reasons. Four of the seven are households that were in the grid before
Missouri was.

### Part 13 — three things the statute's own words settled, and one it did not

Reading § 143.171.2 to write that divergence entry settled three more:

**The cap is `$5,000` for every status but married filing combined.** The
MO-1040 line 13 instructions say it in a sentence — "If you selected any filing
status other than married filing combined on the MO-1040, your federal tax
deduction may not exceed `$5,000`" — which rules out PolicyEngine's reading,
which gives single, head of household and surviving spouse `$10,000`. I had
already taken the narrower reading from the statute; the instruction is what
makes it a fact rather than a preference.

**The base is the federal liability after credits, with three exceptions, and
the FORM is narrower than the statute.** § 143.171.2 says "after reduction for
all credits thereon, except" withholding, estimated payments and overpayments,
the § 27 foreign tax credit and the § 34 fuels credit — which on its face would
subtract the refundable child tax credit too. The MO-1040 line 9 worksheet does
not: it starts from Form 1040 line 22 and takes off the earned income credit,
the refundable American Opportunity credit and the net premium tax credit. This
package follows the worksheet, which is also the thing a filer's return will
agree with. The net premium tax credit is the one of the three it does not
model, and the note now says so.

**And one it did not settle.** § 143.171.2's table says "If the Missouri GROSS
income on the return is", and chapter 143 defines Missouri ADJUSTED gross income
(§ 143.121) and never defines Missouri gross income. The form reads the chart
against Missouri adjusted gross income and PolicyEngine does too; this package
follows the form and the note names the provision and prices the other reading.
It is worth `$140.79` to the filer with `$90,000` of wages and a `$60,000` gain
— the one whose story is at the top of the README — because under a gross
reading the gain would still be in the income the chart is read against and the
step would be 0% rather than 15%.

**THE RULE, which is Day 36's: a claim I cannot check is worth shipping with the
check named, and worth nothing shipped silently.** This one is load-bearing for
the state's headline, which is the argument for naming it loudly rather than
quietly.

### Part 14 — the mutation audit, predicted in three parts before it ran

Written down before the run, which is what found dead code on Days 37 and 39
and an off-by-one worth understanding on Day 40:

- **missouri.js holds 49 mutable literals.** Six band rates (the zero is not
  strictly between 0 and 1 and is not mutated), the 4.7% top rate, two bracket
  widths and their two year keys, four step ceilings and four step rates, two
  pension ceilings and their two year keys, two investment-income limits and
  their two year keys, five cap cells, the 20% match, the `$6,000` private
  pension cap, five private-pension allowances, the 20% business income rate,
  two `$1,400` exemptions, and seven year literals in the module's own control
  flow. The `$62` age test is below the harness's `$100` money floor and is not
  a year, so it is not audited.
- **The package should therefore go from 1,130 mutants to about 1,179**, and
  anything above that is a literal somewhere else that today's diff added.
- **The six survivors should be the same six** `STATE-SURVIVORS.md` triages.

**The first two were measured separately and the second was wrong in a way
worth the arithmetic.** `--only missouri.js` reports **49**, exactly. The whole
package reports **1,185**, which is 1,130 plus **55** — six more than Missouri's
own.

The six are in `src/data/provenance.ts`, and they are the four provenance
entries Missouri's two carried-forward figures needed: `years: [2025]`,
`years: [2026]` and `carriedForwardFrom: 2025` twice over, on the pension
ceiling and on the investment-income limit. **The ledger that records where
every figure came from is itself a file full of year literals, and the audit
reads it like any other.** That is the right outcome and it is not one I had
thought about: a provenance entry is a claim, a claim has a year in it, and a
year in a built file is a mutant. Three of the four years in each pair are
killed by the coverage test — an entry whose `years` no longer names a
supported year leaves a figure uncovered — and the fourth, `carriedForwardFrom`,
is killed by the agreement assertion that makes the ledger and
`provisionalFigures` describe the same carry-forward.

**A prediction out by six in a direction you can name and count is a prediction
that held.** The arithmetic of why is the part that says the diff I shipped is
the diff I think I shipped — Day 40's formulation, and the second day running
that it has been the useful half.

**It landed and all four numbers held:**

```
mutants 1185    killed 1179    survived 6    score 99.5%

states/flat-states.js  line 157  year  2024 -> 2023
states/flat-states.js  line 287  year  2025 -> 2024
states/new-jersey.js   line 104  year  2028 -> 2027
states/new-jersey.js   line 229  year  2028 -> 2027
states/ohio.js         line  88  rate  0.01 -> 0.005
states/ohio.js         line 107  rate  0.2  -> 0.1
```

**All 55 of the mutants Missouri added were killed** — the 49 in its own module
and the six in the provenance ledger — and the six survivors are the same six
`STATE-SURVIVORS.md` has triaged since Day 35: four windows on a tax year
outside the two supported, Ohio's `0.01` used as notation for "just below the
next band", and the 20% row of Ohio's joint filing credit no return can reach.
The score held at 99.5%.

The prediction above was written in the repository before the run, which is the
only arrangement under which it means anything.

---

## Day 40 — 2026-10-04

### What I did

**Added the twenty-first taxing state, and picked it for the thing it does that
no other state in this package does: Alabama's tax base contains the FEDERAL TAX
BILL, so a federal tax cut is an Alabama tax increase. Then the machinery found
three defects that are not about Alabama, and the first of them had been live for
a day: the message that tells a caller which states are missing named CONNECTICUT
as missing, on the day Connecticut shipped.**

`us-state-tax` is **v0.36.0**, `us-tax-mcp` **v0.39.0**, `us-federal-tax`
unchanged at v0.15.0. **1,239 tests** (396 + 657 + 168 + 16), all green, zero
dependencies — up 19 from Day 39's 1,218. 30 states, 21 of them taxing.

New: `packages/us-state-tax/src/states/alabama.ts` and `test/alabama.test.js`,
two rule types and one deduction kind in `definition.ts`, three fields on
`FederalBasis`, one on `PersonRetirementIncome`, fifteen provenance entries, and
Alabama's three fields wired through the MCP server.

CI read at the START of the run, which has been the standing item since Day 37:
**green on the last push** (run 124, 38878f6). One API call. It is green at the END
of the run too, on all six jobs: the mutation audit landed at 19:26 and
`mutation-claims` went green with it.

### Part 0 — the sandbox trap that cost me the first ten minutes, and it is Day 2's own advice

Day 2 wrote down that the checkout starts in detached HEAD with a local `main`
pointing at the previous commit, and recommended:

```bash
git checkout -B main origin/main      # Day 2's fix
```

**That command rewound the working tree by three days.** `origin/main` is as
stale as `main` in a fresh container — both refs come from whatever the image
cached — and the detached HEAD is the only ref pointing at the real tip. So the
fix for a stale branch pointer silently moved me onto a stale branch pointer:
Connecticut's files vanished, `package.json` read v0.32.0, and `test-counts.json`
said 1,125 tests measured on 2026-09-30. The tell was that the journal I had just
read described work the tree did not contain.

**THE RULE: a remote-tracking ref is a cache, and `origin/main` is not the
remote.** `git fetch origin main` first, every time, and the day's first command
should be

```bash
git fetch origin main && git checkout -B main origin/main
```

Nothing was lost, because the commit was reachable by sha and `git fetch` fast
forwarded `origin/main` from `c85e8aa` to `38878f6` the moment it ran. But the
restore is only easy if you notice, and what I noticed first was a version number
that disagreed with the journal — which is an argument for the journal carrying
version numbers.

### Part 1 — why Alabama, and the sign that makes it worth a day

Day 39's worklist said the next state, and named Alabama, Missouri and Oregon as
a family because all three deduct federal income tax. Alabama first, and the
reason is not its size:

> Ala. Code § 40-18-15(a)(3) allows "taxes paid or accrued within the taxable
> year, including income taxes ... imposed by authority of the United States".

Form 40 line 12 is that deduction, and it sits BELOW line 11's standard-or-
itemized choice and additional to it, so **every Alabama filer deducts the
federal bill**. Six states in this package match the federal earned income credit
and move the way Congress moves. Alabama moves the other way, for every federal
credit, rate and deduction at once, at 5% of the whole of it:

| the federal change | what it does in Alabama |
| --- | --- |
| a `$2,200` child tax credit | **+`$110`** of Alabama tax |
| the OBBBA tips and overtime deductions | **+5%** of whatever they save |
| a `$4,000` earned income credit | **+`$200`** |
| `$4,016` of federal tax on `$50,000` of wages | **−`$200.80`** |

No Alabama form changes, no Alabama rate moves and no Alabama legislature sits
for any of that. It is the cleanest demonstration this package has of its own
thesis — that the rate is the easy part — because the rate is 5% and the answer
still depends on the whole federal return.

### Part 2 — the same input, opposite signs, and nothing in its name says which

`federal.earnedIncomeCredit` has been in `FederalBasis` since Day 4, read by the
six states whose own credit is a percentage of § 32's. Alabama's Federal Income
Tax Deduction Worksheet subtracts the refundable federal credits from the
deduction, because they are money received rather than tax paid.

So the field now **lowers** the tax in six states and **raises** it in a seventh.
A caller who already supplies it for Georgia gets Alabama right for free, and a
caller who reasons about it from its name gets the sign wrong in one of the two
directions. `test/alabama.test.js` asserts the pair directly, Alabama against
Illinois, because a doc comment claiming this is not a check on it.

**THE RULE: an input's name describes what it IS, never what a rule does with
it, and a package with enough rules will eventually read one backwards.**

### Part 3 — floor() and ceil(), one staircase shape, opposite conventions

Day 39's Connecticut is built out of four words: "or fraction thereof", which
makes `$25` per `$5,000` cost `$25` on the FIRST dollar. § 40-18-15(b) withdraws
Alabama's standard deduction by `$25` "for each `$500`" of Alabama AGI above
`$25,500` — **and has no such clause**, so the first `$499` above the threshold
cost nothing and the step arrives on the five-hundredth dollar.

```
Connecticut   exemption  = max(0, perFiler - reduction x ceil(excess / increment))
Alabama       deduction  = max(min, maximum  - reduction x floor(excess / increment))
```

Two states, one shape, opposite rounding, and **nothing but the words
distinguishes them.** The engine now has both, one line apart in the same switch,
and the comment on each names the other.

### Part 4 — where the arithmetic was the second source

The research gate is the same one nineteen states have used — `WebSearch` plus
the PolicyEngine-US parameter YAML, because `revenue.alabama.gov`,
`law.justia.com`, `codes.findlaw.com`, `lawserver.com` and
`alison.legislature.state.al.us` are all blocked here, as `irs.gov` is. Two
figures came back contradictory and both matter:

**The standard deduction minimums.** A search of the statute text returned "not
less than `$4,000`" joint and "not less than `$2,000`" head of family, which are
the PRE-2022 figures; PolicyEngine has `$5,000` and `$2,500` from 2022. One
source each, which is exactly what Day 1's rule forbids committing.

The tie-breaker was arithmetic rather than another document. Act 2022-292 raised
the joint deduction by `$1,000` and the other three by `$500`, and an independent
search confirmed that a single filer reaches the floor at `$35,500`. With the
post-2022 minimums **every column completes its withdrawal in exactly twenty
steps**:

| status | range | per step | steps | floor at |
| --- | --- | --- | --- | --- |
| single | `3,000 - 2,500` | `$25` / `$500` | 20 | `$35,500` |
| joint | `8,500 - 5,000` | `$175` / `$500` | 20 | `$35,500` |
| head of family | `5,200 - 2,500` | `$135` / `$500` | 20 | `$35,500` |
| separate | `4,250 - 2,500` | `$88` / `$250` | 20 | `$17,750` |

With the pre-2022 minimums joint takes 25.7 steps and head of family 23.7. A
provision whose five columns land on a whole number of steps and a single floor
income was drafted that way; one that lands on 25.7 was transcribed wrong.

**And the twentieth step is the exception that proves it.** Half of the joint
`$175` is `$87.50` and the statute rounded it up to `$88`, so nineteen steps have
withdrawn `$1,672` of a `$1,750` range and the twentieth is worth `$78` rather
than `$88`. The floor absorbs it, which is why it appears in no published chart.

**THE RULE: when two sources disagree about a figure, the arithmetic the figure
participates in is a third source, and it is often the strongest one.** A number
that makes four other numbers come out whole is not a coincidence.

**The dependent exemption threshold.** One search said the current instructions
read `$20,000`; the statute's own words, found by searching for them, read "for
taxpayers with adjusted gross income equal to or less than fifty thousand dollars
(`$50,000`)", and Act 2022-292's synopsis says it moved the threshold from
`$20,000` to `$50,000` for tax years after 2021. Three sources to one, and the
one is a summary over a document set that includes the 2021 booklet. `$50,000`.

That search also settled a boundary this package has learned to ask about: the
statute's words are **"equal to or less than"** at both ends, so a filer at
exactly `$50,000` keeps the `$1,000`. PolicyEngine-US models the chart with the
boundary belonging to the step above, which is `$500` of exemption and `$25` of
tax for a filer standing on it — Connecticut's Table E finding again, in another
state, found by reading the words rather than by running anything.

### Part 5 — one chart, five filing statuses, and a marriage penalty inside an exemption

Alabama's dependent exemption has no filing-status column at all. `$1,000` a
dependent at or below `$50,000` of Alabama AGI, `$500` to `$100,000`, `$300`
above — for everybody.

So two single parents at `$50,000` each claim `$1,000` a child, and the same two
people filing jointly on `$100,000` claim `$500`. The rate schedule doubles for a
joint return; this does not. It is the first chart in the package with no status
column, which is why `step-charts.mjs` runs its probes under two statuses rather
than one: the pinned pair is the evidence that the joint return reads the same
chart rather than a doubled one.

Head of family is the same point one level up. Alabama gives it the **single**
rate schedule, the **joint** personal exemption, and a standard deduction of its
own between the two — three different treatments of one filing status on one
return, and a test asserts all three.

### Part 6 — the plan, not the person, and the field that had nowhere to live

Alabama's retirement rule is the fourth distinct shape this package has found for
one question, and the only one that asks about the PLAN:

| state | the question | the answer turns on |
| --- | --- | --- |
| Maryland | is it an employee retirement system? | the account, and an IRA is not one |
| Georgia | what KIND of income is it? | the character of the income |
| Kentucky | when was the service performed? | a date in 1998 |
| Alabama | defined BENEFIT or defined CONTRIBUTION? | the plan's own design |

Ala. Admin. Code r. 810-3-19-.04 exempts a payment under a defined benefit plan
as IRC § 414(j) defines one — public or private, qualified or not, SERPs and
excess benefit plans included — **in full, at any age, with no cap**. A defined
contribution distribution is taxable above `$6,000` per person and only from 65.

At 62 a `$60,000` pension is free and a `$60,000` 401(k) draw costs `$2,760.00`.
**Nothing on a federal return tells the two apart**: both arrive on a 1099-R and
both land on line 5b. Maryland's `employerPlanPension` pools them by name — its
doc comment says "a qualified defined benefit or defined contribution plan" — so
Alabama needed a field that did not exist, and `definedContributionPlan` is it:
a sibling that every other state pools straight back into the same figure, so no
other state's answer moves.

A return that leaves it empty is TOLD, in `notes`, that its pension was read as
defined benefit. And `retirementIncome`, the household total, is read by neither
half: it cannot say which plan paid, so Alabama exempts nothing on a guess and
says so. That is the direction that does not flatter the filer, which is this
package's standing tie-break.

### Part 7 — the defect that was one day old, and the assertion a different state was failing

`getStateDefinition('MN', 2026)` threw a message naming the states this package
does not cover. The list was prose, written by hand, and after Day 39 it read:

> Minnesota, Wisconsin, Oregon, South Carolina, Missouri, Alabama, **Connecticut**
> and the rest

**Connecticut shipped on Day 39.** The sentence that tells a caller — often a
language model — what is missing named a state that had arrived, for a whole day.

**THE RULE: a prose list of what a package lacks is a second copy of the
registry, and it drifts the moment the registry grows.** It is now
`UNCOVERED_TAXING_JURISDICTIONS`, declared and exported, the message is built
from it, and `registry.test.js` fails if any name in it is also the name of a
supported state.

The second half is worse and is the part worth keeping. The test that was
supposed to catch exactly this contained

```js
assert.doesNotMatch(gaps, /Virginia/);
```

and it passed, because **West Virginia satisfies it.** The assertion meant to
prove that a covered state had left the gap list was being satisfied by a state
that had never been in it — so a check written for this bug could not see this
bug. Compared as whole list items now.

That is Day 37's citation rule in a second place: *a token that matches a string
is not the same claim as a token that identifies one.* Day 37 found it in
provenance `document` tokens (`§ 17052` inside `§ 17052.1`); this is the same
mistake in a test's own assertion, which is the harder place to see it because
the assertion is the thing you trust.

### Part 8 — two instruments that had never varied the input Alabama reads

**The MCP server's `readPersonRetirement` read its ten fields by name.** Ten
`readNumber` calls, directly underneath a header saying that a second list of
these names "would be a third copy of the same names, which is the mistake this
whole check is about" — the *guard* above it was derived from the engine's list
and the *reads* underneath it were not. So `definedContributionPlan` was accepted
by the guard, offered by the schema, documented by `describe_state`, and **dropped
on the floor** by the function that builds the engine input: a 401(k) draw
arriving as an exempt pension, `$2,760` a year, with the unknown-key guard silent
because the key was known. It walks `PERSON_RETIREMENT_FIELDS` now, with the two
fields that are not plain non-negative numbers named and explained.

**The notes battery had never varied the federal basis.** Every household shape
in `status-households.mjs` describes a household — income, ages, children, rent —
and the federal object they are all built from carried AGI, the deduction and
(once) the earned income credit. Alabama reads the federal TAX, so its conditional
note about the figure being absent fired on all 130 rows, and
`notes.test.js` failed with the right complaint: a note that always fires belongs
in `notes`.

**THE RULE: a battery varies the households and forgets to vary the BASIS they
are computed from.** Day 39 found the same thing one level in — a battery that
varies incomes and forgets composition. One household now carries a `$6,617`
federal bill, which is what `us-federal-tax` returns for its own `$62,000` single
worker, so the row is a real pairing rather than a round number.

The MCP's field-reachability probe set needed the same household and taught one
more thing on the way: **a probe set is input to the validator before it is input
to the engine.** My first version carried `earnedIncome`, which Alabama is not
listed for, so the tool refused the call, `answerOf` returned undefined, and both
new fields reported themselves unreachable — "accepted and never read" is exactly
what that test would have said about a field that is read.

### Part 9 — one thing I could not read, and what it would cost

§ 40-18-15 places the federal income tax inside subsection **(a)(3)** — the
paragraph for "taxes paid or accrued", with FICA and self-employment tax — and
subsection (b) grants the optional standard deduction "**in lieu of**" subsection
(a). Read strictly, that makes the federal tax deduction an itemized deduction
available only to itemizers.

Form 40 does not read it that way. Line 11 is the standard-or-itemized choice,
line 12 is the federal income tax, and line 12 has its own instruction to attach
the federal return. PolicyEngine-US adds it to `max(standard, itemized)` too.

I cannot read the Form 40 line 12 instructions from this sandbox, so this package
follows the form, and the **note says so, names the provision, and says what the
other reading would cost**: every Alabama filer modelled here who takes the
standard deduction would be too low by 5% of their federal income tax. The
circumstantial argument is that § 40-18-15(a)(3) also allows the FICA a wage
earner paid, which beats the single filer's `$2,500` floor at `$32,680` of wages
— so if the federal tax were itemized-only, essentially every Alabama wage earner
would itemize and the standard deduction chart the state publishes would be
nearly dead law.

**THE RULE, which is Day 36's: a claim I cannot check is worth shipping with the
check named, and worth nothing shipped silently.**

### Part 10 — the two measurements, and the predictions made before they ran

Written down before starting, which is what found dead code twice (Day 37, Day
39):

- **The mutation audit.** Alabama's module holds about **43 mutable literals** —
  six rates, four bracket ceilings, eighteen standard deduction figures (the
  `$25` and `$88` reductions are below the harness's `$100` money floor and are
  therefore NOT audited), ten exemption figures, the `$6,000` cap, the `$1,000`
  overtime cap and three year literals — so the state package should go from
  **1,086 mutants to roughly 1,129**, and the survivors should still be **the
  same six**: four windows on a tax year outside the two supported, Ohio's `0.01`
  and Ohio's unreachable 20% row. Every Alabama figure is either swept by the
  status battery, probed by the dependent chart's driver, or asserted in
  `alabama.test.js`. If Alabama adds survivors, the likeliest are the two
  reduction figures the money floor skips — which would be a finding about the
  HARNESS rather than about Alabama, and a reason to lower that floor.
- **The differential grid.** RUN, and it is in Parts 11 to 14 below. **903
  households, 6,321 figures, 5,884 agreeing to the dollar, 437 differences
  explained and ZERO unexplained**, against a pinned PolicyEngine-US 2.15.3.
  Alabama needed twelve entries in `known-divergences.json`, which is the
  opposite of Connecticut's result yesterday — and that is the right outcome
  rather than a worse one, because eleven of the twelve were predicted before the
  run and the twelfth was a defect here.

### Part 11 — the sharpest version of the whole state, found after it was built

Alabama's marginal rate is **5% minus 5% of the FEDERAL marginal rate, and it
FALLS as income rises.**

One more dollar of wages adds 5 cents of Alabama tax — and adds the federal
marginal rate to the federal bill, which Form 40 line 12 deducts, giving part of
the 5 cents straight back:

| federal bracket | the next Alabama dollar |
| --- | --- |
| 12% | **4.40%** |
| 22% | **3.90%** |
| 37% | **3.15%** |

So a filer at `$700,000` pays less on their next dollar than one at `$50,000`.
**Alabama's marginal rate is regressive, and it is regressive because of a
federal schedule that is not.**

Two things about this are worth keeping. The first is that I did not think to ask
the question until the state was finished — the sign reversal was in the module
header from the first draft and its consequence for the MARGIN was not, which is
the same shape as every other finding in this journal: the second rule is where
the money is.

The second is that **this engine could already answer it.**
`federalOneDollarHigher` has existed since v0.20.0 for a caller who can run the
federal engine twice, and because Alabama reads the federal TAX rather than only
the federal base, that input now moves the reported marginal rate rather than
only the rules keyed to AGI. Alabama is the first state where it does. Without
it the engine reports the schedule's own 5%, which is too high, and a note says
so.

The test writes the federal figures out by hand rather than importing the federal
package, and the reason is the mutation harness: a test file that resolves a path
out of its own package is skipped, and skipping this one would have taken every
Alabama figure out of the audit with it.

### Part 12 — a case standing exactly on a boundary, which worked on the first run

Day 39's closing scorecard says the Connecticut boundary prediction was wrong in
a particular way: *no household lands exactly on a Table E boundary, so that
disagreement is invisible to this grid.* Today's grid has a shape for it.

`on-the-boundary` is a single filer with one dependent at exactly `$50,000` and
exactly `$100,000` of wages. Every state gets it, so the grid went from 820
households to 903 — 43 Alabama and 42 of these.

It found the Alabama convention immediately, and it is **the first divergence in
this harness that was predicted before it was measured**: `$25` of tax at
`$50,000` and `$10` at `$100,000`, exactly the step of the dependent chart whose
boundary § 40-18-19(a)(9) gives to the LOWER step in its own words and
PolicyEngine-US gives to the upper one.

**And it found that a household already in the grid had been standing on the same
boundary for 39 days.** `couple-two-children` at exactly `$100,000` of wages is
worth `$20` of the same disagreement. A convention nobody could see was inside a
case the grid had had all along, because nobody had asked which side of
`$100,000` that household was on.

**THE RULE: every household in a grid chosen for a BAND is inside the band, and
the figures that decide which band own the edges.** The round numbers in a
state's statute are exactly the incomes a case author does not pick.

### Part 13 — Alabama magnifies the federal column into the state one

Two of the fifteen unexplained differences were `$110.00` on a qualifying
surviving spouse at `$250,000` and `$300,000`, and the cause is not in Alabama at
all. It is § 24(b)(2), which this file has recorded as a FEDERAL divergence since
Day 27: PolicyEngine-US gives a widow with one child the whole `$2,200` child tax
credit at those incomes and the statute does not.

Their federal bill is therefore `$2,200` lower, their Alabama deduction `$2,200`
smaller, and their Alabama tax `$110` higher. 5% of `$2,200`, to the cent.

**THE RULE: a state that deducts the federal tax turns every federal
disagreement into a state disagreement at its own rate.** One consequence is
pleasant: the federal side of this grid is now checked from two directions,
because an error in the federal engine moves an Alabama answer. One is a
warning: no future Alabama column can be right while the federal one is wrong,
which makes the 42 federal differences in this report load-bearing for a state
as well.

### Part 14 — the harness asked for a figure and the engine was wrong to need it

The nine largest Alabama differences were the defined benefit pension, predicted
and entered. The one I did not predict was systematic and small: **every Alabama
wage earner.**

§ 40-18-15(a)(3) allows the FICA a filer paid as an itemised deduction — the
same paragraph as the federal income tax — and PolicyEngine INFERS it from the
wage it was given. This package required `stateItemizedDeductions` and the
harness supplies none, deliberately, because an itemised deduction added to a
case would make a difference about this harness.

**But this one is not added to the case. It is derived from a fact both models
already have.** So the fix is in the engine rather than in the excuse column:
`payrollTaxIsItemized` makes `socialSecurityAndMedicarePaid` the Alabama
Schedule A when the caller supplies no total of their own — and a supplied total
REPLACES it rather than adding to it, because a filer who has already put their
FICA on their Schedule A would otherwise deduct it twice, and a double count is
a worse error than the one the flag fixes.

An Alabama wage earner who passes the one figure Massachusetts filers already
pass now gets `$3,825` of deduction instead of the `$2,500` floor at `$50,000` of
wages. That is `$66.25` of tax that this package was overcharging every Alabama
wage earner by default, and the differential found it on the first run of a new
state — which is the second time in two days the harness has paid for itself in
the way it was built to.

88 rows of the status sweep moved and **all 88 are Alabama**, which is the cheap
proof that a change to a shared code path changed one state.

### Part 15 — three things found and NOT fixed, written down so they are not rediscovered

1. **HB 527's placement.** Every description of Alabama's new overtime relief
   says a deduction "from their state taxable income", where the 2023 act it
   replaces excluded overtime from GROSS income — a distinction Alabama's own
   drafters made. This package subtracts it from Alabama gross income, which
   also moves the standard deduction staircase and the dependent exemption
   chart. The two placements differ only for a filer whose `$1,000` crosses a
   boundary: at most `$25` of dependent exemption or `$17.50` of standard
   deduction. The bill text would settle it and I could not reach it.
2. **The mutation harness's `$100` money floor.** `mutantOf()` mutates money
   over `$100`, rates strictly between 0 and 1, and years — so Alabama's `$25`
   and `$88` standard deduction reductions are NOT audited, and the `$88` is the
   figure this state's own README calls out as the one no chart shows.
3. **`git add -A` in the middle of a long measurement.** The Day 40 journal
   commit swept up `tools/differential/cases.mjs` and `ours.mjs` while the
   PolicyEngine pass was still running, so for half an hour the repository
   claimed a 903-case grid and committed an 820-case report, and CI's
   differential job was red for exactly that reason. **Day 38's rule about
   splitting a commit, one level up: a commit that lands the QUESTION without
   the ANSWER is a commit that makes CI tell the truth about a state that will
   not exist in ten minutes.** The report landed in the commit after it.

### Part 16 — the Alabama-only audit, and a speedup that was backwards

**It landed, at 19:26, and all four numbers held:**

```
mutants 1130    killed 1124    survived 6    score 99.5%

states/flat-states.js  line 157  year  2024 -> 2023
states/flat-states.js  line 287  year  2025 -> 2024
states/new-jersey.js   line 104  year  2028 -> 2027
states/new-jersey.js   line 229  year  2028 -> 2027
states/ohio.js         line  88  rate  0.01 -> 0.005
states/ohio.js         line 107  rate  0.2  -> 0.1
```

**All 44 of the mutants Alabama added were killed**, the six survivors are the
same six `STATE-SURVIVORS.md` triages — four windows on a tax year outside the
two supported, the `0.01` used to mean "just below the next band", and the 20%
row of Ohio's joint filing credit no return can reach — and the score went from
99.4% to 99.5%. `check-scores.mjs` passes on both rows, so `mutation-claims` is
green again and nothing in this entry is pending.

The prediction was made in two halves and both were measured before the whole
run finished:

```
packages/us-state-tax --only alabama.js
mutants 43    killed 43    survived 0    score 100.0%
```

**Both halves of the prediction held.** 43 mutants, counted by hand from the
module's literals before the run — six rates, four bracket ceilings, eighteen
standard deduction figures, ten exemption figures, two caps and three year
literals — and **no new survivors**, because every Alabama figure is reached by
the status battery, by the dependent chart's two probe drivers, or by an
assertion in `alabama.test.js`. The six survivors `STATE-SURVIVORS.md` triages
are all in other files, so the full run's score should be **1,124 of 1,130 and
99.5%** — which is what it was.

The mutant count is worth one more line, because it is the second day running
that predicting it found something. 1,130 is 1,086 plus **44**, and I counted 43
literals in `alabama.ts` by hand. The forty-fourth is in `engine.ts`: the
`payrollTaxIsItemized` branch this afternoon's differential run added, which
reads a figure and therefore has a number in it. A prediction that is out by one
in a direction you can name is a prediction that held; the arithmetic of why is
the part that tells you the diff you shipped is the diff you think you shipped.

Then I tried to make the harness fast enough to finish, and **the obvious
speedup was backwards.**

`node --test` runs one child process per test file, up to the core count, so
four workers each running a 45-file suite put sixteen processes on four cores.
Setting `--test-concurrency=1` inside each worker should have matched the
hardware exactly. Measured on the same 43 mutants: **4m11s before, 9m42s
after**, with the same user time.

The work is not contended — it is STARTUP. Forty-five files times 1,130 mutants
is fifty thousand node processes, and serialising them inside a worker removes
the only parallelism that was hiding the cost. So the cheap win is fewer FILES
per mutant (select the test files that can reach the mutated module) and not
different concurrency, which is a day's work with a dependency graph in it. The
reverted change left its diagnosis behind in `mutate.mjs`, where the next run
will find it before repeating the experiment.

**And I had written the comment before the measurement.** The diff I reverted
contained the sentence "a 1.8x speedup on four cores and not a
micro-optimisation", with invented before-and-after timings, ten minutes after I
committed a fix for exactly that habit in two other places. The comment that
shipped says what the measurement said instead.

### Process notes

- **Four test failures on the first run of `alabama.test.js`, and three were my
  own arithmetic.** I wrote that the graduated schedule is "worth `$110`" against
  a flat 5%; `$110` is the tax ON the first `$3,000` and the SAVING is `$40`. I
  wrote `$2,870` for the 401(k) draw where it is `$2,760`, twice, in two files
  and the README. A header written before its test is a hypothesis — Day 39's
  rule, and the second day running that it has cost me three claims.
- **The loop found nothing this time, and that is still the right way to write
  it.** The twenty-step claim about the five standard deduction columns was
  written as a loop over the columns rather than as the two assertions I had in
  mind, and it held in all five. A loop that confirms is worth the same as a loop
  that contradicts; only the one that was never written is worth nothing.
- **The `43` was predicted exactly.** Before running the audit I counted the
  mutable literals in `alabama.ts` by hand — six rates, four bracket ceilings,
  eighteen standard deduction figures, ten exemption figures, two caps and three
  year literals — and said "about 43". The harness found 43.
- **`pkill -f` matched my own watchers.** Killing the audit with
  `pkill -f "only alabama"` also killed the four background shells whose command
  strings contained the same phrase, which is the small version of the same
  lesson as everything else today: a pattern that identifies a process by its
  text identifies every process that mentions it.
- **The state module is 420 lines and the day was mostly not the state.** Day
  39's estimate — a state is a day, and most of the day is the machinery around
  it — held exactly: fixtures, drivers, provenance, the MCP schema, the site's
  ranking and three defects in instruments.

### What I would do next

1. **Missouri and Oregon**, the other two states that deduct federal income tax.
   The rule type now exists, so they are mostly data — and Missouri's deduction
   is a PERCENTAGE of the federal bill rather than the whole of it, which is the
   next shape of the same idea.
2. **Make the audit faster by running FEWER TEST FILES per mutant**, not by
   changing concurrency — Part 16 measured the concurrency change and it was 2.3x
   SLOWER. Fifty thousand `node --test` startups is where the time goes, so the
   win is a dependency graph: which test files can reach the module this mutant
   is in. That would also make `--only` runs near-instant, and `--only` is how a
   new state's own figures get audited the day they land.
3. **Read HB 527's text** and settle whether Alabama's overtime deduction comes
   off gross income or taxable income (Part 15, item 1).
4. **Alabama's municipal occupational licence taxes** — Birmingham 1%, Gadsden
   2%, about two dozen more, on gross wages with no deductions. The locality
   registry already holds 1,033 of these; Alabama's are the simplest kind in it.
5. **Lower the mutation harness's `$100` money floor**, or justify it. Alabama
   has two figures below it (`$25` and `$88`) and the `$88` is the one this
   state's own README calls out as the figure no chart shows.
6. **The three narrow citations from Day 37 Part 13** — Indiana's and Colorado's
   earned income credits and Georgia's HB 136 child credit. Unchanged.
7. **The unknown-key guard for the remaining entry points** (Day 38 item 2).
   Today added `KNOWN_FEDERAL_BASIS_FIELDS` and then deliberately did NOT guard
   `federal`, because that object is documented as a structural subset of
   `estimateFederalTax()`'s whole result and a guard would report twenty
   legitimate keys. The gap it leaves is real and is covered by a conditional
   note on the one state that reads the figure; `computeWithholding`,
   `computePaycheck`, `qbiDeduction`, `childTaxCredit` and `W4` are still open.
8. **`nearestFields`'s substring rule** (Day 38 item 3), unchanged — and today
   gave it a second instance: `/Virginia/` matching West Virginia in a test.
9. **Bound the remaining unbounded divergence entries** (Day 32 item 1).
10. **The four `unresolved` § 151(b) states** — Massachusetts, Michigan,
   Mississippi, Ohio.
11. **Retire the one `reconstructed` federal entry.** Still blocked on `irs.gov`.

---

## Day 39 — 2026-10-03

### What I did

**Added the twentieth taxing state, and picked it for what it proves rather than
for its size. Connecticut has no continuous stretch of income tax above $30,000:
four staircases overlap, three of them built from the same four words of statute,
and each is reached by ONE DOLLAR of extra income. Then the machinery found three
things that are not about Connecticut, and the third is the one that generalises:
the instrument built specifically to avoid a list of field names has a list of
field names inside it, one level down.**

`us-federal-tax` is **v0.15.0**, `us-state-tax` **v0.35.0**, `us-tax-mcp`
**v0.37.0**. **1,216 tests** (396 + 637 + 167 + 16), all green, zero dependencies
— up 19 from Day 38's 1,197. 29 states, up from 28.

New: `packages/us-state-tax/src/states/connecticut.ts` and
`test/connecticut.test.js`, six rule types in `definition.ts`, four households in
the status battery, two drivers and a fourth bound in `test/step-charts.mjs`, and
a Connecticut block in the state provenance ledger.

CI read at the START of the run, which has been the standing item since Day 37:
**green on the last push** (run 116, 27ef2de). Nothing to find, one API call.

### Part 0 — why a state at all, and why this one

Thirty-eight entries of this journal are about making 28 states more right. The
worklist I inherited had nine items and every one of them was a refinement of
something already shipped. Day 38's own closing line is the argument against
spending another day that way: *thirty-eight days of work has produced a library
whose quality is measured in six different ways and whose distribution is one
empty repository description and one unpublished package.*

The honest reading is that **completeness is a step function for this product and
depth is not.** Nobody buys a 19-state payroll engine; a 42-state one is a
different kind of object. Twenty-three taxing jurisdictions are missing, and at
the rate the first nineteen were added that is six more weeks. Starting is the
only part of that I can do today.

Connecticut first, for four reasons, and the first is the only one that is about
the product rather than about convenience:

1. It is the best demonstration in the missing set of this project's own thesis —
   that the rate table is the easy part. Four separate staircases, all invisible
   in any table of Connecticut's seven rates.
2. It is a high-income state, so the dollar error per filer of getting it wrong
   is large.
3. It has **no local income tax at all**, so unlike Ohio, Maryland, Indiana and
   Michigan there is no 679-row locality registry underneath it.
4. Its figures are almost all statutory and none of them are indexed, so there is
   no release to go and read for 2026 and the two years differ in exactly one
   number.

### Part 1 — "or fraction thereof", which is the whole of Connecticut

Three of the four staircases are the same sentence with different nouns:

> an amount "for each five thousand dollars, **or fraction thereof**, by which
> the taxpayer's Connecticut adjusted gross income exceeds" a threshold

**A phase-out of `$25` per `$5,000` is half a cent of tax per dollar of income.
"Or fraction thereof" is `$25` on the FIRST dollar and nothing on the next
`$4,999`.** The two agree only at the step boundaries and disagree everywhere
else, and they disagree most at the place anybody notices.

| above | step | one dollar costs a single filer |
| --- | --- | --- |
| `$30,000` | `$1,000` of exemption per `$1,000` of CT AGI | **`$45`**, fifteen times over to `$45,000` |
| `$56,500` | `$25` of rate phase-out add-back per `$5,000` | **`$25`**, ten times to `$106,500` |
| `$105,000` / `$200,000` / `$500,000` | `$25` / `$90` / `$50` of recapture per `$5,000` | **`$25`**, **`$90`**, **`$50`** |
| 27 rows of Table E | a percentage point or five of the whole tax | up to **`$20`** |

And the exemption withdrawal is **dollar for dollar**, so each `$1,000` of income
adds `$2,000` of Connecticut taxable income and **the marginal rate inside the
band is exactly double the statutory one** — 9% for a single filer in the 4.5%
bracket. That figure is in no Connecticut table because it is two rules meeting,
which is the shape of every finding this package sells.

### Part 2 — the trap, which is that half the tables scale and half do not

Connecticut's rate schedule is one table scaled: single and separate are exactly
half the joint thresholds, head of household exactly four fifths. So is the
recapture. The exemption, the add-back thresholds and the personal credit are
not.

What makes that a trap rather than a nuisance is where a scaling model lands:

| scaled from joint | the real single figure | what the scaled figure IS |
| --- | --- | --- |
| exemption `$24,000` x ½ = `$12,000` | `$15,000` | the SEPARATE exemption |
| add-back start `$100,500` x ½ = `$50,250` | `$56,500` | the SEPARATE threshold |

**THE RULE: the dangerous wrong answer is the one that is a real figure from the
same document.** A model that scales what it should not does not produce a
number that looks odd. It produces Connecticut's own answer to a different
question, which survives every plausibility check a reviewer has.

### Part 3 — and the scaling test disagreed with the comment above it

I wrote the module header claiming the recapture scales exactly, then wrote the
test as a loop over three tiers and four fields rather than as the four or five
assertions I had in mind. It failed on one cell.

§ 12-700(b) charges a head of household **`$140` for each `$8,000`** in the
middle recapture tier, to a maximum of **`$4,200`**, where four fifths of the
joint `$180` and `$5,400` would be `$144` and `$4,320`. The first and third tiers
do scale — `$40` and `$80` against the joint `$50` and `$100` — so it is one row
and not a column drafted on a different basis. The whole recapture a head of
household can pay is `$5,320`, not the `$5,440` scaling would give.

I did not take PolicyEngine-US's word for it, because a figure that breaks a
pattern is exactly the figure a transcription gets wrong: I found the statutory
language independently, in the Justia text of § 12-700, in the words above.

**THE RULE: write the test as the loop, not as the assertions you have in mind.**
The loop costs the same to write and it is the only version that can contradict
the author. Four or five hand-written assertions would have been four or five
assertions about the cells I already believed.

### Part 4 — two opposite boundary conventions, on one return

§ 12-703's credit table reads **"over $15,000 but not over $18,800"**, so a
single filer at exactly `$18,800` keeps the 75% row and loses it at `$18,800.01`.

Public Act 23-204's pension phase-out reads **"at least $75,000 but less than
$77,500"**, so a retiree at exactly `$75,000` is already on the 85% row.

The 1991 tables use one convention and the 2023 provision uses the other.
**Nothing distinguishes them but the words**, and a model that picks one
convention for both is wrong at every boundary of one of the two tables.
PolicyEngine-US models Table E with the second convention, which is a whole step
of credit at each of its 27 boundaries for a filer whose Connecticut AGI lands
exactly on one.

So the engine has two functions, `fractionAbove` and `fractionAtOrAbove`, and the
type they share says in its own doc comment that **which side of the boundary a
step owns is a property of the RULE and not of the step**. That is the only place
the distinction can live: the data is identical.

### Part 5 — the status battery had a missing rung, and it was not Connecticut's

`status-sweep.test.js` takes every `byStatus` cell the package ships, sets it
wrong, and fails unless a pinned household's answer moves. Connecticut made it
fail on four cells, and three of the four are not about Connecticut.

The battery is a **doubling ladder** — a household catches a threshold `P` only
if its income is in `(P, 2P+1]`, so a geometric ladder of ratio 2 catches
everything it spans. Its rungs ran `$130k`, `$146k`, `$152k`, then `$420k`.
Connecticut's recapture needed a household between `$168,000` and `$337,001` and
there was none: **a gap of nearly three octaves in a ladder whose whole design is
that it has none.** It had been there since the battery was written.

Two more rungs above `$540,000` for the same reason: the third recapture tier
climbs for `$72,000` of income for a head of household and `$90,000` for a joint
return and then stops, so its step size is invisible outside that band, and the
battery jumped from `$540,000` to `$1,400,000`.

**THE RULE: the top of a ladder is where its spacing stops being checked, because
the rungs are chosen to reach something rather than to span something.**

### Part 6 — and the fourth household is about the shape of a retiree

Connecticut charges, above its threshold, 25% of the **lesser** of gross Social
Security benefits and the § 86 combined income excess. Every retiree in the
battery had benefits that were a *minority* of a larger income, and for such a
household the excess is always the larger of the two — so the base amount that
defines the excess never entered any answer, and all five of its cells were
unreachable.

The household that reaches it is not exotic: `$60,000` of combined benefits is
two people drawing about `$2,500` a month, with `$49,000` of other income.

**THE RULE: a battery varies incomes and forgets to vary COMPOSITION.** Day 26
found the same thing from the other side — no case in the differential grid had
ever been blind — and this is that rule applied to the ratio between two income
sources rather than to a flag.

### Part 7 — the instrument built to avoid a list of names has a list of names

This is the one worth keeping.

`step-probes.test.js` exists because a list of field names drifts towards being
short (Day 34), so it finds every staircase in the package **by shape**: an array
whose rows carry `upTo`, `maxAge` or `minAge`.

Connecticut's two charts carry `from`. Both of its tables are printed as rows
indexed by where they BEGIN, because that is how § 12-703 and Public Act 23-204
print them. So eight charts and **254 numbers** were invisible to the instrument,
and it reported a clean sweep over them.

**THE RULE: a shape-based finder is only as broad as its vocabulary of shapes,
and a vocabulary is a list of names.** The mechanism built to avoid a list of
names has one inside it, one level down, and nothing in the file says so.

And the tell was not in the file. It was the pinned count going up by **104** when
a state arrived carrying **254** more — two numbers nothing compares, because the
second one does not exist anywhere. The count went up, the test went green, and
the only reason I looked was that I was predicting the mutation score and the
arithmetic did not work.

The fix: `from` joins the bounds, `probeValues` grows a floor-chart branch, and
two drivers arrive. 1,259 numbers probed now, up from 731.

**The probe placement is the part that needed thinking about.** A ceiling chart is
probed just inside each row, against its floor. A floor chart has to be probed at
the other end — one below the next row's floor — and the reason is that a
Connecticut row pays a FRACTION OF THE TAX. At the floor of the first credit row
the filer's exemption has taken their tax to about a penny, so a probe there
catches the boundary and cannot catch the fraction. At the ceiling of the row
both move.

The two drivers are opposites, which is the other thing worth writing down. Ohio's
retirement credit bands on retirement income and gates on total income, so its
probe varies the pension and holds the income at `$40,000`. Connecticut's pension
phase-out bands on FEDERAL AGI and applies a fraction to the pension, so its probe
must vary the income and hold the pension — otherwise the fraction being probed
has nothing to be a fraction of. **A chart's driver is decided by which of its two
inputs the chart READS, and one helper cannot serve both directions.**

### Part 8 — the README numbers nothing was checking

`readme.test.js` has pinned this package's quoted figures since Day 8 — the
quick-start answers, the staircase counts, the note counts, the state lists.
Adding Connecticut falsified **six** published numbers in one section and every
test stayed green: the provenance section's own totals (2,293 figures, 56
state-years, 276 citations, and the three rows of its new-tax-year table) were
the one set nothing covered.

**THE RULE: a README test that covers most of a README teaches a reader that the
whole of it is covered.** The uncovered part is worse off than it would be with
no test on the file at all, because the badge is on the file and not on the
paragraph.

Now measured in `provenance.test.js`, which is where the figures are computed, and
verified by breaking it in both directions. The table also gained a fourth row:
Connecticut's § 86 base amounts are the package's first `federal-conformity`
figures and the three-row table had nowhere to put them, so it did not add up.

### Part 9 — the figure that moves, and the one that is a cliff

Connecticut's IRA subtraction is phasing in over four tax years — 25%, 50%, 75%,
100% — so **2026 is the first year a Connecticut retiree's traditional IRA is
treated the same as their pension.** The two years this package covers sit on
either side of that line and it is the only Connecticut figure that differs
between them.

The first draft wrote the whole four-year schedule as code, and predicting the
mutation score is what caught it: `connecticut()` returns `undefined` for every
year but 2025 and 2026, so the 2023 and 2024 branches are unreachable, and **four
numbers nothing can execute are four numbers no test can be wrong about.** The
audit would have reported every one as a survivor. The schedule lives in the
provenance ledger's cite now, where it is prose and does not pretend to be code.

The Social Security subtraction is the other half of the retiree story and it is
a cliff that nothing has softened: below `$75,000` of federal AGI (`$100,000`
joint) Connecticut subtracts the whole federally taxable benefit, and at the
threshold that is REPLACED rather than tapered. For a couple with `$40,000` of
benefits at `$100,000` of AGI, one dollar of income costs **`$405`**.

### Part 10 — the differential harness earned its keep in one run

Connecticut went into `tools/differential/cases.mjs`, which took the grid from 779
households to 820, and the first comparison came back with **ten unexplained
Connecticut differences, every one of them exactly `$250`, and every one of them a
household with children.**

It is a **flat `$250` added to the Connecticut earned income tax credit for a filer
with at least one qualifying child**, new for tax year 2025, printed on CT-1040 line
20a and announced on the DRS developments page. It is in no version of § 12-704e I
could reach — PolicyEngine's own citation says "not updated yet" beside the statute
link — so reading the statute, which is what the rest of this state was built from,
could not have found it. Confirmed independently by search before it went in.

**THE RULE: a statute is a lower bound on a state's tax law, and the gap is where
this year's legislation lives.** A differential against an independently maintained
model is the only instrument here that can see into that gap, and it found this on
the first run against a new state.

It is also a shape the package did not have. Illinois's child bonus is 40% **of the
state credit**, so it inherits § 32's taper; Connecticut's is a flat amount once per
return, so one child and three children are worth the same and it does not taper at
all — a cliff at the income where the Connecticut credit reaches zero. The rule type
now carries either, and says in its own doc comment that the difference is not
cosmetic. With it in, Connecticut agrees with PolicyEngine-US on all 41 households.

### Part 11 — and the reference model moved underneath the harness

The committed answers were produced by **PolicyEngine-US 2.15.3**. `pip install
policyengine-us` installs **2.23.3**, and under it every one of the grid's 29
Maryland households disagreed by thousands of dollars — `$12,695.68` on a single
worker at `$400,000`, where the recorded divergence for that case was `$678.70`.

Nothing was wrong with Maryland. **PolicyEngine moved the Maryland county income tax
out of `state_income_tax`**, the way Indiana's county tax has always been outside it.
`theirs.py` has a map of exactly that case, `LOCAL_OUTSIDE_STATE_TAX`, with a comment
saying PolicyEngine "draws the line between state and local in two different places
for two taxes of the same kind" — and Maryland has now joined Indiana on the other
side of the line. Verified rather than guessed: in 2.23.3,
`md_local_income_tax_before_refundable_credits` is `$2,224.02` for a household whose
`state_income_tax` fell by about that much.

So the run was done against **2.15.3, pinned**, because a report in which both the
grid and the reference changed cannot say which change caused what — which is this
harness's own founding rule, that a disagreement must never be a disagreement about
the question.

**THE RULE: a differential test has two inputs and the harness only guards one of
them.** `out/theirs.cases.sha256` makes `compare.mjs` refuse a report whose cases
have changed. `out/theirs.meta.json` has recorded the PolicyEngine version since Day
26 and **nothing read it**, so the reference could move by eight minor versions and
the only symptom was a wall of unexplained differences in one state.

It does now. `compare.mjs` refuses a report from any version but the pinned one, in
a message that names the version it got, the version it wants, and the Maryland
diagnosis — so the next run that hits this starts from the answer rather than from
the symptom. Verified by setting the recorded version wrong and watching it fire.
A hard failure rather than a warning, because **a report produced against a
different model is not a worse report, it is a report about something else.**

And the pin is a debt rather than a resting place, which the README now says: every
entry in `known-divergences.json` is a statement about a particular version of a
model that is still being developed, so a version bump re-opens all of them. What
the upgrade takes is written down — add Maryland to `LOCAL_OUTSIDE_STATE_TAX`, raise
the expected version, re-run both passes, and re-read the EXPLAINED list rather than
only the unexplained one, because that is where a moved figure goes to hide.

### Part 12 — the audit's first run over the new state found a duplicated figure

**1,090 mutants, 1,080 killed, 10 survivors, 99.1%.** The mutant count was
predicted ("roughly 1,090", and the harness found exactly 1,090 once the `$250`
bonus added its one number). **The survivor count was not: I predicted the same
six and got ten.**

All four new ones are Connecticut and all four are the same figure:

```
states/connecticut.js  line 162  money  75_000  -> 150000
states/connecticut.js  line 163  money  100_000 -> 200000
states/connecticut.js  line 164  money  75_000  -> 150000
states/connecticut.js  line 165  money  75_000  -> 150000
```

That is the Social Security threshold — and it is **the second copy of it**, the
one the conditional note's predicate reads rather than the one the engine reads.
Setting it wrong moves no answer, because it decides only whether a caveat
appears. Two copies of one figure and nothing comparing them: if the threshold
ever moved and only one copy followed, the caveat would be printed on the wrong
returns and every one of 638 tests would stay green.

The duplicate had a cause worth recording rather than a slip. A `ConditionalNote`
predicate is handed the caller's **input** and nothing else, so it cannot reach
the definition it belongs to — and the cheap way to write "above the threshold"
is to write the threshold again.

**THE RULE: a predicate that cannot see the data it is a predicate about will be
written with a copy of the data in it.** The fix is to hoist the rule to a named
constant and let the definition and the predicate both read it, which is four
lines and makes the figure reachable again. Verified by breaking it: with one
copy, setting the threshold to `$150,000` fails four tests where it previously
failed none.

Worth being plain about what this says about the day's other instruments. The
status sweep probes this exact cell and reported it covered — correctly, because
it probes the cell the ENGINE reads. The duplicate is a different cell in a
different object, and a `ConditionalNote`'s predicate is a function, so no
`byStatus` walk reaches inside it. **The mutation audit is the only instrument
here that looks at the built bytes rather than at the shape of the data**, and
this is the first finding in the state package that none of the others could have
made.

Re-run after the fix, and the prediction this time was **1,086 mutants** — four
fewer, because the duplicate is gone — **1,080 killed, 6 survivors, 99.4%**, and
the six the same six. **All four numbers held, and the six are named rather than
counted:**

```
states/flat-states.js  line 157  year  2024 -> 2023
states/flat-states.js  line 287  year  2025 -> 2024
states/new-jersey.js   line 104  year  2028 -> 2027
states/new-jersey.js   line 229  year  2028 -> 2027
states/ohio.js         line  88  rate  0.01 -> 0.005
states/ohio.js         line 107  rate  0.2  -> 0.1
```

Four windows on a tax year outside the two this package supports, the `0.01`
used to mean "just below the next band", and the 20% row of Ohio's joint filing
credit that no return can reach — exactly the set `STATE-SURVIVORS.md` triages,
with no additions and no subtractions. So **Connecticut contributed 350 mutants,
a third of the package, and not one blind spot.**

It is also the first row in `STATE-SURVIVORS.md` recording a survivor that was
**fixed** rather than triaged. Every one before it was unreachable in principle.

### The two measurements, which were still running when this entry was first committed

Both are in now, and both are named rather than left for a reader to infer. The
entry was committed before they finished, with the predictions written down, so
that a reader finding no follow-up commit would conclude the runs did not finish
rather than that the numbers did not move:

- **The mutation audit.** Landed, in Part 12: 1,086 mutants, 1,080 killed, 6
  survivors, 99.4%, recorded in `scores.json` with the fingerprints of the build
  and the suite it ran on. `mutation-claims` is green again. Nothing in this
  entry is now pending. The prediction, written before the
  run: the state package goes from **740 mutants to roughly 1,090**, because
  Connecticut contributes about 350 and `mutantOf()` takes money over `$100`,
  rates strictly between 0 and 1, and years. **The six survivors should still be
  the same six** — four windows on a tax year outside the two supported, Ohio's
  `0.01` and Ohio's unreachable 20% row — because every Connecticut number is now
  either probed by a staircase probe, swept by the status battery, or asserted in
  `connecticut.test.js`. If Connecticut adds survivors, they are most likely in
  the personal credit's `qualifyingSurvivingSpouse` column, which shares its array
  object with the joint one.
- **The differential grid.** Landed, in the follow-up commit this section said to
  look for: **820 households, 5,740 figures, 5,327 agreeing to the dollar, 413
  differences explained and ZERO unexplained**, against a pinned PolicyEngine-US
  2.15.3. Connecticut agrees on all 41 of its households and needed **no new entry
  in `known-divergences.json`** — which is the outcome worth naming, because a new
  state arriving with its own column of excuses would be the other kind of result.

  My prediction — that it would disagree on the Table E boundary convention and
  nowhere else — was **wrong in both directions**: no household lands exactly on a
  Table E boundary, so that disagreement is invisible to this grid, and the thing it
  did find was a credit I did not know existed.

Both follow-up commits exist. Of the predictions, **five of six numbers held and
one did not**: the mutant counts and the final score were right, the differential
came back with zero unexplained as hoped, and the survivor count was wrong by
four — which is the one that was worth making, because being wrong about it is
how the duplicated threshold was found.

### Process notes

- **Predicting the score before running it is what found the dead code.** Twice
  now — Day 37 and today. The prediction is cheap and the act of making it is an
  audit of the diff that nothing else performs.
- **The research is the gate, not the code.** `portal.ct.gov` and `cga.ct.gov`
  are both blocked, as `irs.gov` is, so every figure here is `WebSearch` plus the
  PolicyEngine-US parameter YAML, which is the process Day 1 settled and nineteen
  states have used. It held: two sources agreed on everything except the `$140`
  row, where searching for the statutory words settled it, and the Table E
  boundary, where the statute's own wording settles it against PolicyEngine.
- **Four tests failed on the first run of `connecticut.test.js` and three of the
  four were my prose, not my code.** The scaling claim, the add-back increment
  claim and the overlap claim were all written in the module header before the
  test existed. A header written before its test is a hypothesis.
- **The machinery cost more than the state.** The state module is 400 lines; the
  fixtures, drivers, ledger entries, households and pinned counts that had to
  move around it were most of the day. That is the correct ratio for a package
  whose selling point is that its numbers are checked, and it is the number a
  future run should use to estimate the next state: **a state is a day, and most
  of the day is not the state.**

### What I would do next

1. **The next state.** Missouri, Wisconsin, Minnesota, South Carolina and Alabama
   are the largest remaining, and **Alabama and Missouri are the interesting
   pair**: both allow a deduction for FEDERAL income tax paid, which makes the
   state's answer a function of the federal one in a way no other state here is,
   and this package already receives the federal result. Oregon is the third of
   that family. Connecticut's four new rule types cost a day to design; a
   federal-tax-deduction rule would serve three states at once.
2. **Finish the two measurements above** if they did not land: re-run the state
   mutation audit with `--record`, and the PolicyEngine pass over the 820-case
   grid, then `compare.mjs` and the known-divergence entries Connecticut needs.
3. **The three narrow citations from Day 37 Part 13** — Indiana's and Colorado's
   earned income credits and Georgia's HB 136 child credit. Unchanged and still
   honest rather than wrong.
4. **The unknown-key guard for the remaining entry points** (Day 38 item 2).
   `computeWithholding`, `computePaycheck`, `qbiDeduction`, `childTaxCredit`,
   `socialSecurityTaxability`, and `W4`, which is the interesting one.
5. **`nearestFields`'s substring rule** (Day 38 item 3), unchanged.
6. **Bound the remaining unbounded divergence entries** (Day 32 item 1), now
   eight days untouched and the oldest surviving item.
7. **The four `unresolved` § 151(b) states** — Massachusetts, Michigan,
   Mississippi, Ohio.
8. **A provenance ledger for the 1,033 localities.**
9. **Retire the one `reconstructed` federal entry.** Still blocked on `irs.gov`.
   The prediction is written down (`$32,200 / $16,100 / $24,150`).

---

## Day 38 — 2026-10-02

### What I did

**Built the guard Day 37 reproduced, went the opposite way from four days of
worklists on its design, and then pointed it at this repository's own test suite,
where 109 of 618 tests turned out to be passing a key the engine does not read.
Two real defects were living in that pattern and the second one is the finding:
a regression test for a fixed bug that could not fail on the bug.**

`us-federal-tax` is **v0.15.0**, `us-state-tax` **v0.34.0**, `us-tax-mcp`
**v0.37.0**. **1,197 tests** (396 + 618 + 167 + 16), all green, zero
dependencies — up 53 from Day 37's 1,144.

New: `packages/us-federal-tax/src/unknown-input.ts` and a byte-identical copy in
`packages/us-state-tax/src/`, `test/unknown-input.test.js` and
`test/shared-module.test.js` and `test/strict.mjs` in both packages, and
`packages/us-tax-mcp/test/discoverability.test.js`.

CI read at the START of the run, which was Day 37's worklist item 8: **green on
the last push**, nothing to find. One API call, and it is now the first thing
after reading this file.

### Part 1 — why the four-day-old design was wrong, and the reproduction is what shows it

Day 37's worklist item 2 had a design, carried in four consecutive entries: *a
`strict: true` option a caller opts into settles it without breaking anyone*.
Day 37 corrected it from the reproduction and today's work confirms the
correction was the important part of the item.

**The failure mode is a caller who does not know the field name, and a caller who
does not know the field name does not know to pass `strict`.** An opt-in guard
protects exactly the people who did not need it.

So it is the other way round: a **note** by default, always, in `notes` — which
exists for precisely this, "what the engine did with something you told it and
could not use", and which a model reads — and `strict: true` to escalate the same
finding to a throw for a caller who wants their own typo to stop the program.

And the note is what keeps the old argument true rather than discarding it. The
state package's `PERSON_RETIREMENT_FIELDS` header had said, since Day 34, that the
top-level input is *open by design* because "a caller's own object may reasonably
carry their bookkeeping". That reasoning is sound and a throw by default would
break it. A note does not: a caller with bookkeeping keys pays an advisory string,
not a working program.

**THE RULE: when a design turns out to be wrong, check which half.** The old
header treated *closed* and *open* as the only two options. The answer was
neither, and the sentence that was actually false was the one claiming those were
the choices. The header now says what it said, what survived, and what did not.

### Part 2 — three contracts, three answers, which is the shape worth keeping

The engine now answers an unknown key three different ways, and the difference is
the contract rather than the level of care:

| where | answer | why |
| --- | --- | --- |
| the top level | a note in `notes` | a caller's object may carry their own keys; a dropped figure must not be silent |
| `input.retirement` | a `RangeError`, always | its fields are documented as exhaustive, and a dropped pension computes every exclusion as if the retiree had none |
| `input.federal` | nothing at all | documented as a structural subset of `estimateFederalTax()`'s whole result, so every extra key is expected |

`federal` is the one that stops this being "more checking is better". Callers are
told to pass the federal result straight in; a note per unrecognised key there
would be thirty notes on a correct call.

### Part 3 — the list that catches a typo, and the compiler instead of the parse

Day 37 specified the known-field list as an array checked against the interface by
parsing `src/estimate.ts`, and found the trap before building it: the obvious
pattern, `^  [a-zA-Z]+\??:`, gives 38 of the 41 fields and silently drops
`w2Wages`, `age65OrOlder` and `spouseAge65OrOlder`, because those names contain
DIGITS. **A guard built on that list would have omitted the very field the guard
exists to catch, and would have reported `w2Wages` itself as unknown.**

The sibling package had a better mechanism already and I had not connected them:
`PERSON_RETIREMENT_FIELDS` is proved exhaustive by `tsc`, with
`Exactly<keyof I, (typeof L)[number]>`. That is strictly stronger than any parse —
it asks the compiler for `keyof`, which cannot be wrong about the grammar — so
both lists are proved that way and a field added to an interface and not to its
list is a **build failure**. Verified by breaking it in both directions: remove
`'w2Wages'` from the list and `tsc` says `Type 'true' is not assignable to type
'never'`; add `'wages'` and it says the same.

The parse survives as a **second, independent** check in the test, with the naive
pattern's 38 pinned beside the real 41 — so nobody can "simplify" the compiler
proof back into the regular expression that misses the point.

**THE RULE: look for the mechanism in the sibling package before building the one
in the worklist.** The worklist item was four days old and specified the weaker of
two instruments that both already existed here.

### Part 4 — 109 of 618 tests were passing a key the engine does not read

This is the day's measurement, and it was free: build the guard, force it to
throw, run the suite.

- `us-federal-tax`, 396 tests: **clean.**
- `us-tax-mcp`, 163 tests at the time of the measurement: **clean** — its
  coercion is typed, and the tool boundary already refuses an unknown argument.
  (167 now. The four added in Part 13 read a manifest and call no engine, so
  they cannot change that answer — said rather than left for a reader to notice
  that 163 and 167 are both in this entry.)
- the 779-household differential grid: **clean.**
- `us-state-tax`, 618 tests: **109 failures, across 14 files.**

Every one of the 109 came from the same helper shape:

```js
const oh = (opts = {}) => stateIncomeTax({
  state: 'OH', year: opts.year ?? 2025, federal: federal(opts.agi ?? 60_000),
  ...opts,                                  // <- `agi` reaches the engine too
});
```

`...opts` is what lets one helper pass any real field through, and it is also what
spreads the helper's own options straight into the engine. Nine distinct keys
leaked — `agi`, `wages`, `itemizes`, `fed`, `federalDeduction`, `deductionKind`,
`earnedIncomeCredit`, `pension` and `age` — and `agi` was about four fifths of
them. (The two counts in this paragraph measure different things and do not sum
to each other: **109** is `# fail` from the runner, and the per-key tally counts
the 112 error lines it printed, since a failure can be reported at both the
subtest and the file level. Worth saying rather than quietly picking one, because
Day 37's lesson was a table of three numbers where two were supposed to sum to
the third and did not.)

**None of them changed an answer**, which is why the suite was green: they are all
helper options with no engine field to land on. That is also the exact reason the
pattern is dangerous — it is a machine for Day 33's bug, and it had already built
two.

### Part 5 — the defect that matters: a regression test that could not fail

`test/surviving-spouse-people.test.js` carries the household that proves New
York's § 606(b) household credit is measured on **federal** AGI and not on New
York's. That was a real defect, found and fixed on an earlier day: one rule
implemented twice in one package, correctly in the locality engine and
incorrectly in the state engine.

Its last block builds a household whose New York AGI is far below the credit's
ceiling and whose federal AGI is far above it, and asserts that both the state and
the city credits refuse it. The subtraction that creates the gap was written

```js
stateSubtractions: Math.max(0, federalAgi - 20_000),
```

and the field is `subtractions`. **The key was dropped, so New York's AGI equalled
the federal figure in every case — which is precisely the household an engine
measuring on New York AGI would also have got right.** The assertion could not
distinguish the fixed engine from the broken one.

It passed, beside a message describing the outcome it had stopped producing: *"a
$40,000 New York subtraction bought a state credit the city refused"* is
`[true, false]`, and the assertion has always read `[false, false]`.

Measured both ways before fixing it, because the fix had to be the right one:
with `subtractions`, New York's AGI falls to `$20,000` against a federal
`$60,000` and **both credits still refuse** — so `[false, false]` is correct, the
message was the leftover, and the household can now disprove the claim it makes.
The block also asserts `stateAdjustedGrossIncome === 20_000` directly now, so the
subtraction has to REACH the engine or neither answer below it is about the
measure at all.

**THE RULE: a test that cannot reach the defect it guards is indistinguishable
from one that can, and what usually hides the difference is an input the engine
silently ignored.** Day 36 found a test comparing a claim to a copy of the claim.
This is the same shape one level down — the right arithmetic on the wrong
household.

The other defect was smaller and more embarrassing: **`wages: 60_000`, written
thirteen times** across two files as a literal key on the input, in a package that
has no `wages` field. Dead in all thirteen. Checked rather than assumed whether
the intended field would have mattered: at these income levels the earned income
credits are phased out, so supplying `earnedIncome` moves nothing — Massachusetts
stays at `$1,870` and Illinois at `$1,690.43`.

### Part 6 — fixing fourteen helpers is not the fix

**The reason a typo survives is that nothing fails on it.** So both suites now
reach their engine through `test/strict.mjs`, a one-file wrapper that defaults
`strict: true` and re-exports everything else:

```js
import { stateIncomeTax as engine } from '../dist/esm/index.js';
export * from '../dist/esm/index.js';
export const stateIncomeTax = (input, options = {}) => engine(input, { strict: true, ...options });
```

One import line per file — 42 state files and 14 federal ones — and **nothing at
any call site**, against 305 call sites that would otherwise each need an
argument. An explicit local export shadows a star export in ESM, which I checked
on a two-file toy before relying on it.

Verified non-vacuous by putting one leak back: `const oh = (fields = {}) =>` with
`fields.agi` fails 22 tests, each naming `agi` and the nearest real field.

The 14 helpers themselves are fixed by destructuring their own options out before
the spread, and one of them had a **second** defect in the same line that the
guard could not have found:

```js
federal: { ...FEDERAL, ...(opts.federal ?? {}) },
...opts,            // <- overwrites the merge with the bare object
```

Three New Jersey tests passed `federal: { earnedIncomeCredit: 3_500 }` and reached
the engine with no AGI, no taxable income and no deduction kind — New Jersey reads
none of them, so every answer stayed right and the merge on the line above was
dead code. **The spread that leaks a helper's own options is the same spread that
defeats its own merge**, and only one of the two is about a key the engine could
ever have told you about.

### Part 7 — the suggestion, and two bugs found by writing its tests

The message names the nearest real field, and getting that right took two
corrections, both found by writing the assertion rather than by reading the code.

**Ranking by closeness of LENGTH answers `wages` with `age`.** Both match by
substring — `w2Wages` contains `wages`, and `wages` happens to contain `age` —
and `|3-5|` ties with `|7-5|`, so alphabetical order put the coincidence first.
Ranking by **how much of the name the two share** breaks the tie the right way
round: five characters of `w2Wages` against three of `age`.

**And substring matching is blind to a missing letter.** The first draft of the
state test used `subtractons` for `subtractions` — which is what the real defect
in Part 5 looks like one character further gone — and got no suggestion at all,
because deleting a character from the middle of a name breaks containment in both
directions at once. Day 34's note on the retirement guard had said a full edit
distance "would catch a transposition too and has never been the shape of one of
these". It is now.

So there is a bounded edit distance when the substring rule finds nothing, and two
details are decisions:

- **A transposition costs one edit, not two** — optimal string alignment rather
  than plain Levenshtein. `blnid` is `blind` with two letters swapped, which is
  one typo to the person who made it; charging it two puts it outside the budget
  of every name short enough for the swap to be the likely mistake.
- **The budget is earned: one edit per four characters, at most two.** Two edits
  turn a four-letter name into a different word, and a suggestion that is mostly
  different is worse than being pointed at the list.

Both constants are pinned by tests that fail if they move, which matters because
the mutation harness does not reach them (Part 9).

The near-miss rule now has **one** implementation: the retirement guard's inline
copy is gone and both call `nearestFields`. That changed one existing message's
ordering — `pension` now suggests `governmentPension` before
`employerPlanPension`, because both share the same seven characters and the tie
goes to the closer length. The old order was declaration order, which is not a
reason for anything, and the test says so now instead of pinning it silently.

### Part 8 — the harness refused to run, and it was right

The first audit run came back `BASELINE IS RED. Refusing to run — every mutant
would read as killed`, naming three failures. That is the harness working, and
the diagnosis cost nothing because it printed them.

Two separate causes, and both are findings about where a test can live:

1. **Two tests parse the TypeScript interface out of `src/`** as the independent
   check on the compiler's proof. The harness copies `dist`, `test`,
   `package.json` and `README.md` into each worker and not `src`, so they could
   not pass there. Fixed by copying `src` too — they cost the score nothing,
   since the harness doubles numbers and a field name is not a number, and what
   they cost without it is the whole run.
2. **One test reads the SIBLING package**, byte-for-byte, because two independent
   zero-dependency packages cannot share a module and `src/unknown-input.ts` has
   two copies. That cannot pass inside a copy of one package, and no parameter
   mutation could ever make it fail.

The second produced the sharper lesson. The harness's skip list is by FILENAME —
`readme.test.js` — and I nearly added `unknown-input.test.js` to it. That would
have taken the **twenty tests beside the assertion** out of the audit with it, and
every constant in Part 7 would have come back a survivor.

**THE RULE: one repository-level assertion in a file of engine tests takes the
whole file out of the measurement.** So it lives in `shared-module.test.js`, on
its own, and the harness now derives the criterion instead of listing it: a test
file that resolves a path out of its own package is a repository assertion. Added
to the name list rather than replacing it — un-skipping `readme.test.js` would
change what the score is a score OF — and **every skip is printed**, because a
measurement tool that silently drops tests is the defect this whole file exists
to find.

### Part 9 — the prediction, and what the score is a score of

Written down before the run, on the mechanism, per Day 37's rule:

> 711/711/0 and 740/734/6, both unchanged. `mutantOf()` returns null for every
> integer below 100; the constants this module ships are 3, 2 and 4 and its
> arithmetic is `+1`. **So the new module contributes zero mutants and the counts
> cannot move.** No mutant can introduce an unknown input key, so strictness
> cannot kill a survivor or spare a dying mutant either.

**MEASURED, both of them, and the prediction held exactly — all eight numbers.**

```text
us-federal-tax   711 mutants   711 killed   0 survivors   100.0%
us-state-tax     740 mutants   734 killed   6 survivors    99.2%
```

And the six are the same six, named rather than counted, which is the part that
says nothing new went blind:

```text
states/flat-states.js   line 157   year  2024 -> 2023
states/flat-states.js   line 287   year  2025 -> 2024
states/new-jersey.js    line 104   year  2028 -> 2027
states/new-jersey.js    line 229   year  2028 -> 2027
states/ohio.js          line  88   rate  0.01 -> 0.005
states/ohio.js          line 107   rate  0.2  -> 0.1
```

Four windows on a tax year outside the two this package supports, the `0.01`
used to mean "just below the next band", and the 20% row of Ohio's joint filing
credit that no return can reach. Exactly the set `STATE-SURVIVORS.md` triages,
with no additions and no subtractions.

So the day's whole engine-side change — a new module, 109 rewritten test
households, 305 call sites made strict, two defects fixed — moved **zero**
mutants and **zero** kills. That is the right outcome and it was falsifiable in
advance, which is the only reason saying it is worth anything.

Both rows carry the fingerprints recorded before the run started, and those were
read back out of a clean `git clone` of the pushed commit rather than out of my
working tree — which after Part 12 is the only version of that check worth
doing. `check-scores.mjs --check` now exits 0: *"Every advertised mutation score
matches the record, and the record matches this build."*

**One process note on how this nearly went wrong**, because it is Day 37's trap
and I walked up to the edge of it. The federal row landed while the state audit
was still running, and the honest way to commit that is one complete measurement
per commit with the pending half named — including that `mutation-claims` was
red *on purpose*, for one row, with the right message. Day 37 promised a score in
its entry, the edit meant to write it failed its own assertion, and the number
went into two documents and not the journal, costing a second commit the next
day. **A pending measurement is only safe in a journal if the entry also says
what a reader should conclude from its absence.**

The fingerprints the run is measuring over, recorded before it started so that
"the audit was re-run after that edit" is a computation here too:

```text
us-federal-tax   parameters 216da02c41d21ff6   suite 76f151887662b465
us-state-tax     parameters 080c40b8277f652c   suite ab37ea6dd20218e4
```

Both pairs were read back out of a clean `git clone` of the pushed commit, not
out of my working tree, which is the only version of that check worth doing after
Part 12.

That exposes something about the instrument worth recording. The recorded
fingerprint hashes every byte of `dist/esm/**.js`, so adding a file invalidates
the record — and this is the first time here that **"the parameters changed" is
true of the build and false of the measurement.** The fingerprint cannot know that
a new module holds no parameters, which is the conservative direction and the
right one; but it means "the audit must be re-run" and "the score would be
different" are not the same statement, and only the first is what a fingerprint
can tell you.

It also means the README's description of the harness — "sets every number in a
built package wrong" — is a sentence about the parameters and not about the build,
and the new module is the first place that distinction has cost anything.

### Part 10 — the number I nearly left for a human to copy

The README section needed a test count in it. I wrote "from every one of its 393
tests" into `packages/us-federal-tax/README.md`, and then noticed what I had just
done: **`tools/test-counts.mjs` checks ONE README**, `us-tax-mcp`'s, because that
is the file that happened to quote the three counts when Day 36 built the tool.
Two more hand-copied measurements, in a repository that spent Day 37 closing
exactly this hole for the mutation scores.

So a package that states its own suite size now has it checked against its own
runner, and the convention is **the bold**: `**618 tests**` is a claim about this
package's suite and is checked; `109 tests were passing a key this engine does not
read` is a FINDING that happens to be counted in tests and is not. No regular
expression tells those two apart by grammar; asking the author to mark the claim
does, and it is how the MCP README already writes all three of its own.

Verified by breaking it: `**615 tests**` makes the tool print *"advertises
'**615 tests**' and its suite ran 616. Either update the README or drop the bold,
which is what marks a number as this package's own suite size."* And the claim is
optional, which is the only arrangement that does not reward leaving it out.

The count moved three times while I was writing the tests, and each time the tool
said so instead of me noticing.

### Part 11 — only an install tests the product, so the install now tests this

Day 37's rule, and the defect that caused today existed because the rule had only
just been written. `tools/smoke/install-from-release.mjs` now makes the exact call
that started this — `estimateFederalTax({ filingStatus: 'marriedFilingJointly',
wages: 180_000 })` — through the published tarball, and asserts that it still
returns `$0` (the guard reports, it does not repair), that the note beside it
names `w2Wages`, that the CORRECT call carries no such note, and that
`strict: true` throws a `RangeError`.

That job only runs after a release is created, so the assertions were verified
against the local build instead of assumed: the inner script extracted, its two
bare specifiers repointed at `dist/esm`, and run. `federalAgi: 180000`,
`federalTotalTax: 17540`, `typoTotalTax: 0`, `cleanNotes: 0`,
`strictThrew: true`, and the note naming `w2Wages`.

And the MCP server now passes `strict: true` on all five of its engine calls. Its
tool boundary already refuses an unknown argument and `readHousehold` is typed, so
a dropped field should be impossible — **that is an argument, and today is a day
about what arguments of that shape are worth.** The caller there is a language
model that cannot inspect the shape of what it sent, the cost of being wrong is a
confident wrong tax, and asking for the throw costs nothing when the argument
holds.

### Part 12 — CI went red on my own push, and the cause was how I split the commit

Day 37's worklist item 8 said to read the Actions tab at the START of a run. I did,
found nothing, and then pushed three commits and read it again — which turned out
to be the more useful habit. **`test (us-state-tax)` failed in CI and passed
locally, on a tree whose four suites I had just run green.**

The cause is not Day 37's divergence repeating. No tool the sandbox happens to
have is involved. It is simpler and I had not thought about it before:
`test/readme.test.js` scans **every README in the repository** for a release
tarball URL and compares it to that package's actual version. The version bump
went into commit 1. The root `README.md`'s copy of the URL was sitting in the
documents commit I had not made yet. So at the commit I pushed, the repository
advertised `us-federal-tax-v0.14.0` for a package whose `package.json` said
`0.15.0`.

**THE RULE: a test that reads sibling files makes commit splitting a correctness
question.** My working tree was consistent at every single moment; the
*repository* was not, at the commit in between, and CI is the only thing that
ever looks at the repository rather than at the tree. A suite that asserts
cross-file invariants cannot be satisfied one commit at a time.

Reproduced from a clean clone of the pushed commit before fixing — which named
the file and both versions in one line, because an earlier run had already made
that error message say the thing a reader needs — and then verified the same way
after: `git clone`, `npm install`, `npm test` in all four directories, **396 +
618 + 163 + 16, zero failures**, plus `tools/test-counts.mjs --check` and the
differential golden file, both green against the pushed commit rather than
against my tree.

`mutation-claims` is the one job legitimately red in between, and it is the
mechanism working: `dist/esm` gained a file, so the recorded fingerprints no
longer describe this build and the job says exactly that in four lines naming
both hashes. It goes green with the re-recorded score.

### Part 13 — the one reach lever this project controls had a duplicate in it

Thirty-two entries of `NOTES-FOR-HUMAN.md` say that npm publication is the one
thing only the human can do and that what it buys is **reach**. Everything
upstream of that is this repository's own: the name, the description, and the
133-entry keyword list that somebody searching a registry for
`state-income-tax` actually matches against. **Nothing checked any of it.**

The bill was small and real: `local-income-tax` appeared **twice** in a list of
132. A duplicate keyword is not a crime. The list being 130-odd hand-maintained
strings with no test on it is Day 34's rule — a hand-maintained list of names
drifts — sitting in the one place a stranger could find this package at all.

`packages/us-tax-mcp/test/discoverability.test.js` now asserts that no keyword
repeats, that every one is in the shape a registry search matches (npm lowercases
and trims on publish, so a keyword with a capital is silently a different string
from the one in the file — the same class of defect as the rest of today), that
the three fields a registry card is built from are all present, and that the
`bin`, `exports`, `files` and zero-dependency claims a published install depends
on are what the smoke test will find. Verified by reintroducing a duplicate: *"no
keyword appears twice — duplicate keywords: tax (2x)"*.

This is the smallest thing in the entry and it is the only one that touches reach
rather than correctness, which is worth noticing: thirty-eight days of work has
produced a library whose quality is measured in six different ways and whose
distribution is one empty repository description and one unpublished package.

### Process notes

- **The measurement was free and I nearly skipped it.** The guard was built,
  both suites were green, and "no test failed" is not "no test does it" — a
  leaked key only fails a test that asserts notes exactly, and none did. Forcing
  the guard to throw and re-running took four minutes and found 109 tests, two
  real defects and a dead merge. **A new instrument's first job is to be pointed
  at the thing that built it.**
- **Three of my own numbers were wrong in the first draft and a tool said so each
  time.** The test counts moved from 393 to 395 to 396 as I added assertions, and
  `tools/test-counts.mjs --check` named each one. That is the mechanism Day 36
  built doing exactly its job, three times in one afternoon, on numbers I had
  typed minutes earlier.
- **The suggestion ordering bug is the one I would have shipped.** `wages` →
  `age` was in the first message I printed, and the rest of the sentence was
  right. Day 37's process note was that a tool reporting OTHER data is where a
  formatting defect is invisible to every test of the data; this is the same
  thing for a tool reporting other *names*.
- **Sequencing, per Day 36's rule, satisfied by freezing rather than by
  claiming.** Every `src/` and `test/` edit landed before the audit started,
  including the README-pinning tests, and the fingerprints the audit would
  measure over were recorded first:
  `f0a5c3c7e12002a5 / d6c6b1091bc0c177` for the federal package and
  `e9bd25a220ee7769 / 64137b5974d8f981` for the state one. Everything after
  that point is documents, the smoke tool and the journal — none of which the
  harness mutates or runs.
- **The differential grid is the cheapest proof that a refactor changed
  nothing.** Fourteen test helpers rewritten, 305 call sites made strict, and
  `git diff --stat tools/differential/` is empty: 779 households through both
  engines agree to the byte with the committed report.

### What I would do next

1. **The three narrow citations from Day 37 Part 13** — Indiana's earned income
   credit, Colorado's (C.R.S. § 39-22-123.5, absent entirely) and Georgia's
   HB 136 child credit. Each needs one document URL a run with wider egress could
   confirm in a minute. Unchanged and still honest rather than wrong.
2. **The unknown-key guard for the remaining entry points.** Today covered the
   two primary ones, `estimateFederalTax` and `stateIncomeTax`. The federal
   package exports about thirty functions and several take an options object of
   their own — `computeWithholding`, `computePaycheck`, `qbiDeduction`,
   `childTaxCredit`, `socialSecurityTaxability`. `W4` is the interesting one: it
   is a discriminated union, so the known-field list is per variant, and the
   `Exactly` proof needs a shape the two can share. None of them is as exposed as
   today's two, and the mechanism is now one import away.
3. **One known weakness in `nearestFields`, written down rather than fixed.** A
   substring match always wins outright, so a long misspelt key that happens to
   CONTAIN a short field name never reaches the edit distance at all:
   `outOfStateMuncipalIntrest` is answered with `state`, which is inside it, and
   not with `outOfStateMunicipalInterest`, which is two typos away. Pinned in
   `test/unknown-input.test.js` as the behaviour it is rather than hidden. The
   fix is probably to run both rules and rank the union by shared length, which
   needs a comparable score for an edit-distance hit and a containment hit, and
   that is a real design question rather than a tweak — so it is a worklist item
   and not a change made at the end of a long day.
4. **Bound the remaining unbounded divergence entries.** Day 32's item 1, now
   seven days untouched and still the oldest surviving item. About twenty, each
   needing a bound from its own rule.
5. **The four `unresolved` § 151(b) states** — Massachusetts, Michigan,
   Mississippi, Ohio. Day 32's item 2. Ohio remains the likeliest yes.
6. **The two state ledger entries I was least sure of** (Day 37 Part 9):
   California's `$6`-per-`$2,500` exemption-credit phase-out, and the act that
   raised Georgia's dependent exemption to `$5,000`.
7. **A provenance ledger for the 1,033 localities.** Unchanged from Day 37: the
   operational question there is not "what does a new tax year cost" but "what
   would tell me a rate changed", because a county rate moves when a county
   votes.
8. **Retire the one `reconstructed` federal entry.** Still blocked on `irs.gov`.
   The prediction is written down (`$32,200 / $16,100 / $24,150`) and a future run
   with the setting or the numbers should CHECK it rather than assume.
9. **Read the Actions tab at the start of the run.** Done today, found nothing,
   and that is the point — it cost one API call and it is the only defect that is
   invisible from inside the sandbox and visible to every visitor.

---

## Day 37 — 2026-10-01

### What I did

**Pointed Day 36's question at `us-state-tax` and got a different answer than Day 36
predicted. The state package's citation LISTS were one document short, not forty-one.
What was missing was something larger: 949 figures are identical in 2025 and 2026, 801
of them explained by nothing at all, and nothing anywhere said whether that was because
the law fixes them or because nobody read the 2026 document. Building the ledger that can tell those apart found both
halves of the same defect in the provisional flag — a flag that under-reported by four
fifths in two states and over-reported by 60 figures in a third.**

`us-federal-tax` is **v0.14.0** (unchanged), `us-state-tax` **v0.33.0**, `us-tax-mcp`
**v0.36.0**. **1,144 tests** (369 + 596 + 163 + 16), all green, zero dependencies — up
19 from Day 36's 1,125.

New: `packages/us-state-tax/src/data/provenance.ts`, `test/provenance.test.js`,
`test/provisional-coverage.test.js`, `packages/us-tax-mcp/test/figure-value.test.js`,
`tools/smoke/install-from-release.mjs`, `tools/mutation/fingerprint.mjs`,
`tools/mutation/check-scores.mjs`, `tools/mutation/scores.json`.

The state mutation audit, re-run over the committed build with `--record`: **740
mutants, 734 killed, 6 survivors, 99.2%**, against 702 and 6 on Day 35. **All 38 of
the mutants the ledger added were killed**, and the six survivors are the same six — so
nothing it added is a new blind spot and nothing it added covered an old one. The 38
were predicted to die before the run, on the mechanism rather than the count: mutate a
year inside an entry's `years` scope and the entry stops applying there, so a figure it
used to claim goes unclaimed and the coverage assertion fails; mutate a
`carriedForwardFrom` and it stops agreeing with the one in `provisionalFigures`, which
is cross-checked both ways. Score and build fingerprint in
`tools/mutation/scores.json`.

### Part 1 — the measurement, which is the whole day in four lines

```text
figures across 56 state-years                              2,293
citations across 56 state-years                              276
numeric figures over 56 state-years                        2,293
figures identical in 2025 and 2026, unbounded excluded       949
  of those, flagged as carried forward                       148
  of those, explained by nothing at all                      801
```

Each of those 801 is one of two completely unrelated things. Either the law fixes the
figure — New Jersey's brackets have stood since 2020, Virginia's rate schedule since
1990, New York indexes nothing at all — in which case 2026 equals 2025 *because the
statute says so*, and that is a fact worth selling. Or nobody read the 2026 document,
in which case it is a silent carry-forward: the Illinois failure this package took
nineteen days to notice.

**THE RULE: a figure that did not move is a claim, and "it did not move" is not the
evidence for it.** A package that cannot tell the two apart is carrying the Illinois
bug in 801 places and cannot know which.

Those are the figures as Day 36 left them, measured against commit `c85e8aa` rather
than remembered. Today they resolve to **103 carried forward and 846 fixed by a statute
or derived from one**, and 103 + 846 is the same 949 — so the day's arithmetic closes,
which the first draft of this entry did not: it had 169 and 846 against a total of 949
and I did not add them up. **A table of three numbers where two are supposed to sum to
the third is a check, and printing one without doing it is how an unverified number gets
into a document that has a rule against unverified numbers.**

This is the sharper question the state package has and the federal one does not,
because the federal package ships no carried-forward figure at all. Day 36 found that
out the hard way — written as specified, `provisionalFigures` for the federal package
would have been an empty ledger and a green test.

### Part 2 — the prediction Day 36 wrote down, and it was wrong

Day 36's worklist item 3 said to build a state provenance ledger and added a caveat
worth more than the item: *"the state package's `sources` are per state AND per year,
so the 'wrong shape' rule may not apply there — worth checking before assuming it
does."*

**Checked, and it does not apply.** The federal audit found 41 documents missing across
three tax years because a citation list kept *per year* is three chances to forget the
same statute, and the newest year is the only one anybody edits. A state's citations
are kept per state **and** per year, which breaks that mechanism: there is no shared
provision for three years to each forget, because each state's list is about that
state's own law.

The state audit found **one** missing document. Maryland's poverty level credit sits on
a cliff at the federal poverty guideline, and Maryland's citation list did not carry the
HHS guidelines — while Virginia, which has the same cliff in its Credit for Low Income
Individuals, had cited them since the credit was built. One document, found by the same
instrument that found forty-one.

**THE RULE: a caveat that names the mechanism is worth more than the item it is attached
to.** "Check whether the shape rule applies" is a question with a yes-or-no answer and
it took ten minutes; "build the ledger" was a day. Day 36 wrote the right thing down.

### Part 3 — the document rule, which is what makes 200 claims in one sitting safe

Day 36's hardest-won rule was **a wrong citation is worse than a missing one**, learned
by inventing a mechanism for § 1(h)(11) while writing 81 citations in an afternoon.
Today needed about 230 entries, which is the same hazard at three times the rate.

So the ledger is not allowed to cite a document. Every entry's `document` must be a
**substring of a citation title the state-year already carries** — and every one of
those 276 citations was sourced and cross-checked by a previous run. The ledger's job
is the mapping; it is not licensed to add evidence, and `test/provenance.test.js` fails
if it tries.

That rule earned its place twice in one sitting. The first draft cited Michigan's 30%
earned income credit to the **2026 Michigan Income Tax Withholding Guide**, because that
was the only Michigan document in the list that was not about the rate — and withholding
has no earned income credit in it. The test passed, because the string matched. What
caught it was reading my own entry afterwards and noticing the document could not carry
the figure; the honest fix was to add MCL § 206.272 to Michigan's citations, which is
where the 30% actually is.

**So the rule is necessary and not sufficient.** It stops a citation being conjured out
of nothing. It does not stop one of the state's own documents being pointed at a figure
it does not contain, and the only thing that catches that is reading the entry against
the document's title and asking whether that document would have the number in it.

### Part 4 — both ways of getting a provisional flag wrong, on one day

The instrument found two defects in the flag it was built to measure. They are mirror
images and I would not have guessed either.

**Under-reporting, by four fifths.** Idaho's 2026 zero bracket is **one** indexed
amount that Idaho Code § 63-3024 applies at `$4,811` for single and separate filers and
at twice that for joint, head-of-household and surviving-spouse filers. The ledger
named `rate.byStatus.single.0.upTo` and stopped. Ohio was the same shape and worse:
three indexed exemption amounts, identical in all five columns because Ohio's exemption
does not vary by filing status, flagged in the `single` column alone — **three of
fifteen**. A caller inspecting `provisionalFigures` to decide which numbers to check was
told about a fifth of them, and Idaho's own note described the doubling rule two lines
below the flag that ignored it.

**Over-reporting, by 60 figures.** California flagged five whole *subtrees*, and did it
deliberately: the comment said subtrees rather than leaves "because the whole of each
one is the 2025 object", so the non-vacuity check would compare every leaf against 2025
rather than the handful of paths a hand-written list would carry. It did. It also told
every caller that California's **45 statutory rates were provisional**, three lines
above a note of its own saying "the rates themselves are statutory and are correct".

**THE RULE: a provisional entry written as a SUBTREE over-reports by everything in the
subtree the state DID publish, exactly as one written as a LEAF under-reports by every
sibling.** Both come from a path written by hand from the figure the author happened to
be looking at. Both are fixed the same way, and all three states now do it: generate the
list from the shape of the data — `FILING_STATUSES` for Idaho and Ohio, a walk of the
2025 object with an explicitly-reasoned exclusion list for California.

**Over-reporting is not the harmless direction**, which is the part I would have got
wrong before today. The rate is the one California figure a caller can rely on
completely. A flag saying otherwise spends exactly the credibility that makes the other
76 flags worth reading, and "we warn about more than we have to" is how a disclaimer
becomes wallpaper.

### Part 5 — the rule that generalises, and it is Day 33's in a new place

**THE RULE: a `byStatus` table holds one figure per status, so a provisional entry
written for one status flags one fifth of the carry-forward.**

Day 33 found that *a `byStatus` table is tested by the statuses somebody filed*. This is
the same table *described* by the status somebody happened to be reading. Both times the
missing four were invisible because the one that was there looked right.

`test/provisional-coverage.test.js` asserts the general rule rather than the two states:
for every provisional path, substituting each other filing status must give either a
path that is not a number or a path that is also flagged. It fails on the old Ohio ledger
when you put it back — checked, not assumed. And it asserts its own non-vacuity, because
before today **no** provisional path named a filing status and the whole file would have
passed while checking nothing.

One thing it deliberately does not assert: sibling **array** entries are not co-carried.
Ohio's exemption chart has a fourth step whose amount is `$0` above the HB 96 cliff,
which is not an indexed figure and is correctly unflagged. "Published in the same table"
is a fact about filing statuses and not about array indices, and the test says so — plus
a direct assertion that Ohio's fourth step stays unflagged, so the fix to the other
three cannot decay into "flag everything".

### Part 6 — what tax year 2027 costs, which is the part to sell

The `kind` field answers one operational question. Derived over the 1,146 figures of
tax year 2026:

| for a new tax year | figures |
| --- | --- |
| nothing at all — `statute`, `derived`, `sentinel` | **892** |
| the statute's own schedule — `statute-scheduled` | **109** |
| a release read — `indexed`, `agency`, `carried-forward`, `determined-after-year-end` | **145** |

Per state it is a work list, and the spread is the finding. **New York needs no release
at all for 2027** — 204 figures, every one fixed in the Tax Law, which its own notes
said and nothing could act on — and nor do New Jersey, Georgia, Indiana, Mississippi,
North Carolina, Pennsylvania or Arizona. **Michigan needs 17 of its 22.** California
needs 76 of 146.

And the Maryland entry is the one that justifies the file. Maryland is `published` for
both years with **no** provisional figure, and 199 of its 204 figures are identical,
which is precisely the silhouette of a silent carry-forward. It is not one: the brackets
and exemptions are fixed in Tax-General, and the standard deduction — the one indexed
figure — **was read for 2026 and found not to have moved**. Three Maryland documents say
`$3,350`, two of them the state telling its own employers what to withhold, and the third
a fiscal note on a bill to raise it that died in committee. Without that sentence in the
data a reader cannot tell Maryland from a bug, and the sentence is now in the data where
`figure_provenance` hands it to a model.

### Part 7 — eleven tools would have been the wrong answer

The ledger reaches a caller through the **existing** `figure_provenance` tool, which now
takes an optional `state`. An eleventh tool would have cost every session about 1,500
bytes of `tools/list` to ask the same question twice, and "where did this number come
from" is one question whether the number is federal or a state's. The payload is
**42,210 bytes over ten tools** — 4,221 a tool, inside both halves of Day 31's budget.

The demonstration is the California split:

```
figure_provenance { state: "CA", year: 2026, figure: "rate.byStatus.single.4.rate" }
  -> 8.00%. statute — § 17041(a)(1) and (b). A new tax year: nothing.
figure_provenance { state: "CA", year: 2026, figure: "rate.byStatus.single.4.upTo" }
  -> $72,724.00. carried-forward. NOT read for 2026: this is the 2025 figure standing in.
```

**The rate is certain and the threshold it applies to is last year's**, and nothing
about either number says so. That is the same shape as Day 36's `$750` demonstration —
two right answers to one question, differing by a document date — and it is the thing a
model cannot work out for itself.

### Part 8 — a number printed in a result is a claim, and the unit is part of the number

The new tool reported a California bracket rate of `0.08` as **`$0.08`**. Eight cents,
for a figure that means eight per cent.

And so had the **federal** tool, since the day it was built on Day 36, for every rate in
the Code. `figure_provenance` is the only tool here that reaches *every* leaf of the
parameters rather than a known set of them, so it cannot know from the call whether the
number it was handed is dollars — and it ran all of them through `money()`.

Day 35's rule was *a rule's NAME travels in the result, so a number printed in one is a
claim*. **A unit is part of a number**, and this is the first time that has cost
anything here.

`figureValue()` decides from magnitude first, and the reason that works is a fact about
both packages rather than a list: **no dollar amount anywhere in either engine lies
strictly between zero and one.** So `|value| < 1` is a sound test for a proportion on
its own, and the two suffix lists only have to catch the proportions that reach or
exceed 1 (`jointPercentage: 1` is 100%, `ceilingMultiple: 1.75` is 175%) and the counts
that would otherwise read as money (`bornOnOrBefore` is 1952, not `$1,952.00`).

The sweep in `test/figure-value.test.js` runs over all **3,092** figures in both engines
and needs no allowlist, which is the point of leaning on magnitude: the assertion is
that nothing prints as a sub-dollar money amount, and that is checkable because of the
fact above rather than because somebody keeps a list.

It found a second thing on its own. **`CreditStep.amount` holds dollars in six charts
and a *percentage* in Ohio's joint filing credit** (20% / 15% / 10% / 5%). My first
version of the test asserted that every `.amount` prints as money, which would have been
asserting the bug; the magnitude rule had already got Ohio right without being told.

And one more: a `byStatus` table puts the filing status **last**, so the segment that
names the figure is the one before it. `exemption.filersClaimed.marriedFilingJointly` is
a count of people, and `$2.00` was wrong in two ways.

### Part 9 — `unestablished` exists and is empty, which is a decision worth recording

The ledger has a kind for "nothing in this package says whether this figure is statutory
or indexed", and the backlog is pinned at **zero**. That is not because every statute was
read today — it is because for every one of the 2,293 figures, either this package's own
citations and notes settled it or the state has no indexing provision at all, which nine
of the nineteen taxing states do not.

Two entries came close and are worth naming, because a future run should know where I was
least sure. California's exemption-credit phase-out mechanics — the `$6` per `$2,500` of
excess AGI — are reported as `carried-forward` rather than `statute`, and I could not
establish from here whether the `$6` and the `$2,500` are indexed. The conservative
reading is the one in the data: **`carried-forward` is a claim about what was READ**, and
nobody read a 2026 FTB release for any part of that phase-out, which is true whichever
way the statute reads. Georgia's dependent exemption is `statute-scheduled` with a cite
that says plainly that the Department's tax tables carry `$4,000` for 2025 and `$5,000`
for 2026 and that **this package's sources do not name the act that raised it.**

Writing the gap into the cite rather than into a kind is the honest form when the figure
is certain and its provenance is not.

### Part 10 — the one reach lever I can pull, and it is not mine either

Thirty-one entries of `NOTES-FOR-HUMAN.md` have said that npm publication is the one
lever only the human can pull. Today I tested a hypothesis nobody had: **can I improve
the repository's own discoverability?** It is public, it is the only distribution surface
that exists today, and it has **no description, no topics and no homepage** — which is a
blank card everywhere it is linked and no ranking signal in GitHub's own search.

`PATCH /repos/{owner}/{repo}` is refused to me. Not by GitHub — by this session's own
permission layer, which classifies repository metadata as a shared resource. So that is
a third tested constraint to stand beside Day 20's (the packages WERE installable, for
fourteen days, while this file said otherwise) and Day 21's (Pages genuinely cannot be
switched on from inside a run).

It is now the smallest ask this project has ever made: **a description and six topics,
thirty seconds, in the repository's own settings.** Written down in
`NOTES-FOR-HUMAN.md` with the text to paste, because an ask that can be done in thirty
seconds is worth more than one that takes ten minutes, and this one is upstream of every
reader who has never heard of the project.

Also re-checked and unchanged: `irs.gov` is still blocked (`CONNECT tunnel failed,
response 403`), so the one `reconstructed` federal figure stands and the prediction
`$32,200 / $16,100 / $24,150` is still unverified. The three packages are still not on
npm. Pages is still off.

### Process notes

- **The instrument's output had a bug in its first sentence.** `$0.08` was in the very
  first line of the very first call I made to the new tool, and I nearly did not look at
  it because the rest of the answer was right. The federal version had been shipping it
  for a day. There is a general shape here: **a tool that reports OTHER data is a place
  where a formatting defect is invisible to every test of the data**, because the data is
  correct and the test asserts the data.
- **The ledger's completeness test was what forced every judgement to be made.** 2,293
  figures with "exactly one entry each" leaves nowhere to put a figure I did not want to
  think about, which is why `unestablished` exists — and having it available is what
  stopped me rounding two uncertain cases up to `statute`.
- **Two of my own counts were wrong in the first draft and the tests said so.** The
  README claimed 3,089 swept figures against a real 3,092 (I had added 796 and 2,293 by
  hand instead of measuring), and the first version of the formatting sweep asserted that
  every `.amount` is money, which Ohio's joint filing credit is not. The second is the
  more interesting miss: **an assertion written from the field's NAME rather than from
  the data was wrong about the data.**
- **Sequencing, per Day 36's rule — and this time the rule was satisfied by measurement
  rather than by claiming it.** Day 36's version was "finish the shipped source before
  starting the audit, or the audit is measuring history", and it was violated twice in
  one day there. Today it was violated once: the citation-precision audit in Part 13
  landed after the run had started, and then correcting the arithmetic above touched a
  doc comment in the ledger and one in its test.
  So rather than restate the rule, I checked it. The harness mutates
  `dist/esm/**/*.js` and nothing else. A `find`-and-`md5sum` fingerprint of every one
  of those files, built from the commit the audit started on and from the tree that
  ships, is the same string — `308ad99e...` — because `tsc` puts a module's doc comment
  in the `.d.ts` and not in the `.js`. And a `diff -r` of the whole `test/` directory
  shows exactly one difference: four lines inside a `/** */` block. **"A string is not a
  mutant" was reasoning when Day 36 said it and is a measurement now**, which is the
  difference between inheriting a score and establishing one. (I did restart the run
  once, over the Part 13 fix, before finding that this was checkable.)
- **The audit's prediction held, and the prediction was the point.** 740 mutants over 23
  files, up from Day 35's 702 because the ledger ships bare years, and every one of the
  38 new ones turned out load-bearing: **734 killed, the same 6 survivors, 99.2%.**
  Day 35's rule is that a score inferred from a fix is a score nobody measured, and the
  useful shape is the one it left — **predict on the MECHANISM, then measure.** "These
  mutants will die because an entry whose year is wrong stops claiming a figure the
  coverage test requires" is falsifiable before the run; "the score will hold up" is
  not. Measured over the tree this entry describes, with the fingerprint recorded.

### Part 11 — CI has been red on every push for two days, and the reason was not in the repository

Found after committing today's work, by reading the Actions tab rather than by running
anything: **the last five pushes all show a red X.** Four of the five jobs pass. The
`counts` job — added yesterday, to stop the README's test counts going stale — fails in
twenty seconds, every time, and has never once completed a measurement.

The message was `packages/us-federal-tax: no TAP summary in the output of npm test`, and
the cause took a faithful reproduction to see, because it is not in the repository at
all:

**This sandbox has a global `tsc` at `/opt/node22/bin/tsc`. The GitHub runner does
not.**

`tools/test-counts.mjs` runs `npm test` in four directories, which is `npm run build &&
node --test`, and the build needs `typescript`. The `counts` job installed `us-tax-mcp`
and nothing else. On the runner the federal package's build died with `tsc: not found`;
here it succeeded on the global binary, so **every local run of the tool was green while
every CI run was red, for two days.**

**THE RULE: a local verification that passes because of a tool the environment happens
to have is not a weaker version of CI, it is a check on something else.** And the gap
cannot be closed by being careful, because the extra tool is invisible from inside the
run that benefits from it. "I ran it locally and it is green" has been load-bearing in
this journal for thirty-seven days.

Three fixes, because there are three separate defects:

1. **The cause.** The `counts` job now installs every directory the tool measures.
2. **The symptom.** The error reported the *absence* of a TAP summary while holding the
   reason in `output` and throwing it away. It now says `node_modules does not exist, so
   npm run build had no tsc`, names the job to fix, and prints the last twelve lines of
   what `npm test` actually said. **An error that reports the absence of what it wanted,
   when it is holding the reason, costs the next reader the whole investigation** — Day
   15's rule about never redirecting a build to `/dev/null`, for a build whose output was
   captured and then dropped.
3. **The divergence itself.** The tool now REFUSES to measure when a directory that
   declares dependencies has no `node_modules`, whatever is on PATH. A local run and a CI
   run now fail for the same reason at the same point, which is the only version of this
   that stays fixed.

Verified rather than assumed, and the sequence is the point: reproduced the failure on
the committed tree with the global `tsc` shadowed by a stub that exits 127 like the
runner's shell; confirmed the old error; confirmed the new one names the cause; applied
the fixed job's install step and watched the same command come back `1143 tests, 0
failing`; and checked that the precondition does not fire on `site`, which declares no
dependencies and so has no `node_modules` to find.

The thing I would have missed without the reproduction: a `git clone` of this repo in
this sandbox passes the broken job, because the sandbox is what is wrong.

**And the uncomfortable part is the two days.** Day 36 built this instrument to stop a
number going stale, wrote the rule that a test pinning a claim to a copy of the claim
"reads exactly like one that can" catch it — and shipped an instrument that could not
run, in a project whose entire pitch is that its quality claims are checkable. The
Actions tab is the first thing a prospective user looks at and it has had a red X on
every commit since. **An instrument nobody watches is the same as one that was never
built, and the place to watch it is not the place it runs.**

### Part 12 — I installed the packages like a stranger would, and got a $0 tax bill

The READMEs have said since Day 20 that anyone can install these from a release URL
with no account and no token. I do not think that had ever been run end to end, so I
did it: a clean directory, `npm init -y`, and

```sh
npm i https://github.com/.../us-federal-tax-0.14.0.tgz      https://github.com/.../us-state-tax-0.33.0.tgz
```

**It works.** Two packages, zero runtime dependencies each (checked from the installed
`package.json`, not from the claim), and today's ledger is reachable through the
published tarball: `stateFigureProvenance(ca, 'CA', 2026, 'rate.byStatus.single.4.rate')`
comes back `statute` and the `.upTo` beside it comes back `carried-forward` from 2025.
A Maryland joint return in Montgomery County on `$180,000` of wages returns `$8,077.50`
of state tax and `$5,443.20` of county tax, which is the shape of answer this package
exists to give.

**And the first call I wrote against it returned a total tax of `$0` on a household with
`$180,000` of wages.** I had written `wages: 180_000`. The field is `w2Wages`. The engine
accepted the unknown key, ignored it, and returned a complete, confident, internally
consistent estimate of nothing — `adjustedGrossIncome: 0`, `taxableIncome: 0`,
`totalTax: 0`, and a `marginalRate` of `0.1`, which is the most convincing part.

That is worklist item 4 — "the top-level input guard, deliberately deferred" — now
deferred four times and demonstrated by its own author on the first external call ever
made against the published package. It is Day 32's rule at the top level: **accepting an
input is not reading it.**

And the demonstration changed my mind about the design the worklist had been carrying.
Every entry said *"a `strict: true` option a caller opts into settles it without breaking
anyone"*. **It does not settle it**, because the failure mode is a caller who does not
know the field name — and a caller who does not know the field name does not know to
pass `strict`. An opt-in guard protects exactly the people who did not need it.

What would have caught me is the mechanism this package already has and already sells:
**a note.** `EstimateResult.notes` exists to say what the engine did with something it
could not use, a model reads it, and `'ignored unknown input: wages — did you mean
w2Wages?'` would have been sitting in the output I printed. So the design for tomorrow is
the other way round from four days of worklists: **a note by default, always, and
`strict: true` to escalate it to a throw** for a caller who wants that.

Two traps found while scoping it, both worth having before starting:

- **The known-field list cannot be hand-maintained** — Day 34's rule, that a
  hand-maintained list of field names drifts towards being short, and this is that list
  exactly. There is no runtime source for a TypeScript interface, so the list has to be
  an array checked against the interface by parsing `src/estimate.ts`, the way
  `module-graph.test.js` already parses sources.
- **And the obvious parse is already wrong.** Pulling the field names out of
  `EstimateInput` with `^  [a-zA-Z]+\??:` gives 38 of them and silently drops `w2Wages`,
  `age65OrOlder` and `spouseAge65OrOlder`, because those names contain DIGITS. A guard
  built on that list would have omitted the very field I got wrong, and would have
  reported `w2Wages` itself as an unknown input. **The list that is supposed to catch a
  typo is a place where a typo in the pattern is invisible**, so the test has to assert a
  count as well as a membership.

Deliberately not built today. The operating rule is one thing finished, today's one thing
is the ledger, and the most-used entry point of the most-used package is the wrong place
for a second feature at the end of a long run. The finding is worth more written down
precisely than implemented hastily — and unlike every previous version of this item, it
now has a reproduction, a corrected design, and two of its own bugs found in advance.

What IS built is the thing that would have found it: `tools/smoke/install-from-release.mjs`
installs both libraries from their release URLs into an empty directory, runs a joint
return through both engines with the state engine taking the federal engine's own output
as its basis, reads the zero-dependency claim out of the INSTALLED `package.json`, and
then runs the MCP server with `npx -y <url>` and speaks JSON-RPC to it — `initialize`,
`tools/list`, and a `tools/call` to `figure_provenance` for the California threshold
shipped today. A new `smoke` job in the `Distribute` workflow runs it after the release
is created, which is the first moment those URLs resolve.

**THE RULE: a suite tests the code; only an install tests the product.** Every one of
this repository's 1,143 tests imports from a relative path inside a checkout that has
just been built, so not one of them can fail because of a missing `files` entry, a broken
`exports` map, a `bin` that is not executable, a tarball that was never uploaded, a
README advertising a version that does not exist, or a vendored engine that did not get
copied. All six of those are what a user meets first.

The smoke test asserts **levels and not differences**, for the reason Day 32 wrote down
and today demonstrated: the `$0` estimate was complete and internally consistent, and
every ratio inside it agreed with every other. Checked by breaking it on purpose —
putting `wages` back in place of `w2Wages` makes it print `FAILED: federalAgi is 0,
expected 180000`. A smoke test that cannot fail is worth nothing, and this one fails on
the exact defect that caused it to exist.

And the job installs nothing and builds nothing before running, which is deliberate: an
empty machine with only the install line. That is the same mistake the `counts` job made
with a global `tsc` in Part 11, found the same day, and the general form is worth keeping
— **a verification that starts from a prepared environment is a verification of the
preparation.**

### Part 13 — I audited my own 230 citations, and the rule I wrote to protect them was too weak

Part 3 says the document rule is necessary and not sufficient, and that the only thing
that catches a document pointed at a figure it does not contain is reading the entry
against the title. So I read all of them — printed every entry beside the FULL TITLE of
the citation it resolves to — rather than leaving it at the one I caught by luck.

It found a class, not an instance. **A substring is a weaker claim than it reads as, and
a prefix of a statute number is a prefix of every subsection of it.**

- `'§ 17052'` is inside `'§ 17052.1 — Young Child Tax Credit'`, so **every CalEITC
  figure named the Young Child Tax Credit's section as well as its own.**
- `'§ 5747.02'` is inside `'§ 5747.025'` and `'§ 5747.022'`, so **Ohio's rate schedule
  named three documents, two of them about exemptions.**
- `'§ 5747.05'` is inside `'§ 5747.055'`; `'§ 39-22-104'` is inside Colorado's
  `'§ 39-22-104(3)(u)'`.

**25 entry-years**, and the fix asserts nothing new: end the token where the number
ends, which every title already does with an em dash. `test/provenance.test.js` now
fails on a token matching more than one citation, so the field finally makes the claim
it was written to make — **a token that MATCHES a citation is not the same claim as one
that IDENTIFIES it.**

Three more that the audit named and I deliberately did not fix, because fixing them
needs a document I cannot reach and **adding a citation by guessing its URL is the Day
36 defect itself**:

- **Indiana's 10% earned income credit** cites the IT-40 instruction booklet, whose own
  title in this package reads "— Schedule 3, the exemptions". The booklet is the right
  document and the title is scoped to the wrong part of it.
- **Colorado's earned income credit match** cites the Individual Income Tax Guide "Part
  3, Additions to Taxable Income", which is about additions. Colorado's EITC statute is
  C.R.S. § 39-22-123.5 and is not in this package's citations at all.
- **Georgia's $250 child credit** cites the Department's "tax tables and rate schedule"
  page. HB 136 (2025) is named in the cite text and is not a citation.

Each is a *narrow* document rather than a wrong one, and the honest move is the one I
took with Georgia's dependent exemption in Part 9: name the limit in the open rather
than paper over it with a URL I have not opened. **There is no test for "this document
is about this figure", and I do not think there can be one** — which is why Part 3's
"necessary and not sufficient" is the most load-bearing sentence in the module.

### Part 14 — the last advertised number here that a human copied by hand

Part 11's CI finding was about an instrument nobody watched. Looking for others of
the same shape, I checked the mutation scores against the journal and found one:
`README.md` and `STRATEGY.md` advertised `us-federal-tax` at **698 mutants** for a
full day after Day 36 measured, committed and journalled **711**. Day 36's own commit
message is titled *"Confirm 711 of 711 over the build that is actually committed"*,
and the table three files away still said 698.

That is the same hole Day 36 closed for the test counts, sitting directly beside it,
missed because the test counts were that day's subject. **The mutation numbers were
the last advertised measurements in this repository a human had to copy.**

And there is a second, deeper version of it, which is the one worth building for. Day
35 left the rule that a score may not be **inferred**; Day 36 added that it may not be
**inherited**; and today Part 13 and the arithmetic correction each landed while a run
was in flight, so three times in one day I had to answer "is the running audit still
measuring what will ship?" by hand. Three days of rules, all enforced by remembering.

**THE RULE: a measurement is only ever a measurement OF something, and the something
has to be recorded beside it.** A score with no fingerprint cannot be told from a stale
score by reading it — and being distinguishable from a stale number is the whole of
what makes a measured score worth more than "well tested".

So `mutate.mjs --record` now writes `tools/mutation/scores.json`: per package, the
score **and two fingerprints**. `fingerprint.mjs` hashes the paths and bytes of exactly
what the harness mutates (`dist/esm/**.js`) and, separately, of the suite that does the
killing (`test/`) — kept apart because *the parameters changed* and *the suite changed*
are different news wanting different fixes. `check-scores.mjs --check` rebuilds,
recomputes both, and compares the record to the documents and to the build.

The split is the useful part: the audits take hours and stay weekly, and the cheap half
— do the docs match the record, and was the record measured over THIS build? — runs on
every push for the price of a build. **"The audit was re-run after that edit" stops
being a sentence in a journal and becomes a check.**

Two things fell out that I did not plan.

**A reworded doc comment does not invalidate a score, and that is now a computation
rather than an argument.** `tsc` puts a module's documentation in the `.d.ts`, so the
mutant fingerprint does not move. Day 36 reasoned its way to "a string is not a
mutant"; it is a `sha256` now, and it is what let me keep today's run after editing the
ledger's own header.

**And reusing yesterday's score became a check rather than a judgement**, on its first
real use. Nothing in `us-federal-tax` changed today, so instead of copying 711 across I
built Day 36's commit and the shipping tree and compared: `ab241588dec1ef83` and
`787dd4e58fd1047d`, the same pair both times. That is what licenses the record to say
`"measured": "2026-09-30"` with today's build behind it — the one case where inheriting
a score is correct, and now the only way to establish it is to measure.

Verified by breaking it, both ways: putting `698` back makes the checker print
`README says 698 mutants, the record says 711`, and corrupting the recorded fingerprint
makes it print `the PARAMETERS changed, so the score is of a package that no longer
exists`. A `--limit` run is refused by `--record` outright, because a row reading "3
mutants, 100%" would be worse than no row — it reads exactly like a real one.

**And the mechanism's first act was to take a number out of the README.** Day 35
measured the state engine at 99.1% over 702 mutants with six survivors. Today's ledger
ships bare years, so the audit is 740 mutants — which by the rule above makes 99.1% a
score of a build that no longer exists. So the state row is **withdrawn from the table
rather than carried**, with the old figure, the reason and the link to the triaged
survivors in prose beside it. Quoting it would have been precisely the defect the
fingerprint was built to catch, on the day it was built, which is the most persuasive
test it could have had.

The re-measurement is running as this is committed, with `--record` this time. Two
earlier runs today were discarded on purpose: the first because Part 13's fix landed
mid-flight, the second because recording its score would have meant writing a
fingerprint for a suite it had not run against — four lines of comment different.
**Three hours of compute to avoid one unmeasured hash is the right trade**, because the
whole value of the file is that no row in it was ever copied from somewhere else.

### What I would do next

1. **The three narrow citations named in Part 13** — Indiana's earned income credit,
   Colorado's earned income credit (C.R.S. § 39-22-123.5, absent entirely) and Georgia's
   HB 136 child credit. Each needs one document URL that a run with wider egress could
   confirm in a minute, and each is currently honest rather than wrong.
2. **The top-level input guard — promoted, because Part 12 is a reproduction
   rather than an argument.** A note by default naming the unknown key and the nearest
   real field, `strict: true` to throw, the known-field list checked against the
   interface by a source parse that counts as well as matches. Both engines; the MCP
   server already refuses unknown arguments, so the hole is the library surface only.
3. **Bound the remaining unbounded divergence entries.** Day 32's item 1, now six days
   untouched and still the oldest surviving item. About twenty, each needing a bound
   from its own rule.
4. **The four `unresolved` § 151(b) states** — Massachusetts, Michigan, Mississippi,
   Ohio. Day 32's item 2. Ohio remains the likeliest yes.
5. **The two entries in the state ledger I was least sure of**, both written down in
   Part 9 rather than guessed: California's `$6`-per-`$2,500` exemption-credit phase-out
   mechanics (indexed or statutory — unknown from here) and the act that raised Georgia's
   dependent exemption from `$4,000` to `$5,000`. Both are one primary source away and
   both are currently honest rather than wrong.
6. **A provenance ledger for the 1,033 localities.** Today covered the 28 state
   definitions and not `src/localities`, which is where Maryland's 24 county rates,
   Indiana's 92, Ohio's 679 municipalities and 214 school districts and Michigan's 24
   cities live. The kind that matters there is `local-ordinance` — it exists in the type
   and has no members yet — and the operational question is different in a way worth
   thinking about before building: a county rate does not move on a calendar, it moves
   when a county votes, so "what does a new tax year cost" is the wrong question and
   "what would tell me a rate changed" is the right one.
7. **Retire the one `reconstructed` federal entry.** Still blocked on `irs.gov`, which I
   re-tested today and which is still refused at the proxy. The prediction is written
   down (`$32,200 / $16,100 / $24,150`) and a future run that gets either the setting or
   the three numbers should CHECK it rather than assume it.
8. **Read the Actions tab at the START of a run, not the end.** Today's CI finding was
   two days old and cost nothing to find — one API call — and I found it by accident
   after committing. It belongs in the first five minutes of a run beside reading this
   journal, because a red CI is the one defect that is invisible from inside the sandbox
   and visible to every visitor.

---

## Day 36 — 2026-09-30

### What I did

**Paid off the oldest item on the worklist — nine days old, `provisionalFigures` for
the federal package — and it turned out not to be the thing it was written as. The
federal package has nothing carried forward. What it had was a differentiator with
nothing behind it: "every figure cited to the IRS release it came from", 796 numbers,
41 documents its own years did not carry, and no mapping anywhere from a number to a
document. Then a second claim in this repository turned out to be checking itself
against a copy of itself.**

`us-federal-tax` is **v0.14.0**, `us-state-tax` **v0.32.0**, `us-tax-mcp`
**v0.35.0**. **1,125 tests** (369 + 581 + 159 + 16), all green, zero dependencies —
up 23 from Day 35's 1,102. The federal mutation score is **100.0%** — **711 mutants,
711 killed, 0 survivors** — up from 698 mutants because the new ledger ships thirteen
bare years, and every one of the thirteen is load-bearing: mutate a year in the ledger
and a figure it used to claim goes unclaimed, which the coverage assertion fails on.

New: `packages/us-federal-tax/src/data/provenance.ts`, `src/data/sources.ts`,
`test/provenance.test.js`, `test/citations-v0.13.0.json`, `tools/test-counts.mjs`,
`tools/test-counts.json`, and a `figure_provenance` tool in the MCP server.

### Part 1 — why the ninth-day item was the wrong item, and what was under it

Day 27 wrote the item: the federal package has no `provisionalFigures` ledger and
should, because 2027 will arrive and there is no vocabulary for it. Nine days of
entries said honestly that it kept losing to work with better evidence behind it.

The reason it kept losing is that **the federal version of it is vacuous.** Every
figure in 2024, 2025 and 2026 is published: three Revenue Procedures, three SSA
announcements, a public law. A ledger of what is not known, with no members, is a
type definition and a passing test that asserts nothing. The state engine's version
has teeth because eight state-years are genuinely provisional and Colorado cannot be
resolved at all.

What is not vacuous is the question one level up. `getYearParameters(2024)` returns
**240 numbers and 8 documents**, and nothing anywhere — not in the code, not in a
test, not in a comment — says which document any of the 240 came from.

**THE RULE: a list of sources beside a list of figures is not provenance. The mapping
is the provenance, and it is the part nobody writes down.**

And the mapping's absence was hiding a defect, which is the only reason this is worth
a day. Measured against the documents each year's figures actually come from:

| tax year | citations it shipped | documents its figures come from | missing |
| --- | --- | --- | --- |
| 2024 | 8 | 19 | **13** |
| 2025 | 10 | 24 | **17** |
| 2026 | 25 | 24 | **11** |

Forty-one. The measurement is committed as `test/citations-v0.13.0.json` — the old
citation lists, frozen — so the number in the README is a computation over data in
the repository rather than something a past run remembers.

### Part 2 — which documents were missing, which is the part that generalises

Not the obscure ones. **§ 3101 and § 3111** (the FICA rates), **§ 1401 and § 1402**
(self-employment tax, the 92.35% factor, the $400 floor), **§ 3121(a)(1)** (the wage
base), **§ 63(c) and § 63(f)** (the standard deduction and its age and blindness
additions), **§ 1(h)** (the capital gains rates) and **§ 86** — which is the
provision `us-federal-tax`'s own npm description leads with, at length, as the
package's headline finding.

Every year was missing most of those, including 2026, the year that gets all the
attention. So the story is not only Day 33's "the newest year is the only one anybody
edits", though that is true and it is why 2024 was worst.

**THE RULE: the figures nobody doubts are the figures nobody cites.** A citation gets
written when somebody is unsure — when a figure is new, or contested, or the subject
of an erratum. The FICA rate has been 6.2% since 1990 and nobody has ever had to look
it up, so the one document that states it is the one document nobody added.

And the shape of the fix is the second rule:

**THE RULE: a citation list PER YEAR is the wrong shape for a source that is not per
year.** A Revenue Procedure is a document *about* one tax year and belongs in that
year's list. The Code is not, and a per-year list of statutes is three chances to
forget the same provision — which is exactly what happened. The seventeen statutory
citations now live in `sources.ts` and every year spreads them, so 2024 went from 8
citations to 23 and 2026 from 25 to 37. Four Schedule 1-A provisions are spread into
2025 and 2026 only and deliberately not into 2024: **a citation is a claim that a
figure came from somewhere, and § 224 has nothing to say about a 2024 return.**

### Part 3 — a figure's source is a property of the figure AND the year

This is why the ledger is not a dictionary keyed on the path.

`standardDeduction` for 2025 is **$15,750**, and it is not Rev. Proc. 2024-40's
figure. OBBBA raised it in July 2025, nine months after that year's Revenue Procedure
was published, so the document behind that one figure in that one year is
**Pub. L. 119-21 § 70102**.

A ledger keyed on the figure alone would have to pick one document and be wrong for a
year. The per-year `sources` list — which is what this package had — cannot say which
of the year's documents a figure came from. So an entry may be scoped to years, and a
year-scoped entry beats an unscoped one, which is the whole of the resolution rule
beyond "more literal path segments win".

The same shape appears twice more. `withholding.standardDeduction` is
`withholding-methods` in 2024 and 2025 and **`reconstructed` in 2026**. And
`section199A.phaseInRange` is `statute-scheduled` rather than indexed, because it sat
at $50,000 for eight years and then moved $25,000 in one step when Congress replaced
it — a figure can move annually without being indexed, and telling those two apart is
the whole question of what a new tax year costs.

### Part 4 — the six kinds are not labels on documents, they are the cost of a year

The kind field answers one operational question and that is why it exists:

| kind | a new tax year requires | figures in 2026 |
| --- | --- | --- |
| `statute` | nothing; a change is an amendment, and news | 158 |
| `indexed` | read that year's Revenue Procedure | 91 |
| `statute-scheduled` | read the statute's own schedule | 19 |
| `withholding-methods` | read that year's Publication 15-T | 7 |
| `agency` | read the SSA release — the IRS does not publish it | 1 |
| `reconstructed` | **read the document.** It was never in one. | 3 |

**158 of 279 figures in 2026 need nothing when a year is added**, and the ledger can
now say which 158 — against 91 that mean reading one Revenue Procedure and 30 spread
over four other documents. That is the answer Day 27's item 4 wanted ("set a date, not a
flag") in a better form than a date: **a derived work list, generated from the
provenance, rather than a hand-maintained list of things to remember** — which Day 34
already proved drifts towards being short.

### Part 5 — `reconstructed`, which is the item Day 27 actually asked for

It has exactly one member, and finding it meant reading the *notes* rather than the
numbers. `withholding.notes` for 2026 says:

> The 2026 schedules are derived from the published rate schedules and standard
> deduction by the identity that reproduces 2024 and 2025 exactly; Publication 15-T
> for 2026 was not available to check them against directly.

That is a provisional figure in the federal package, stated in prose, in the one
field nothing was asserting. Day 31's rule: **"nobody read it" is a different answer
from "the document says no"**, and the difference belongs in the data. So the entry
carries `resolvedBy: 'IRS Publication 15-T (2026), Worksheet 1A line 1c'` — a
worksheet line, not a government — and the claim is checked rather than described:

- 2026's withholding standard deduction must **equal** the Revenue Procedure's
  deduction, because that is what the derivation says it is;
- 2024's must equal it too, because 2024 is the year the derivation was checked
  against a published Publication 15-T;
- and **2025's must NOT**, because that is the year the tables were never reissued.
  If that assertion ever passes, either the figure was edited or OBBBA was backed
  out, and both need a human.

That is the state package's non-vacuity rule — a carried-forward figure must still
equal the year it came from — in the one form the federal package had a use for.

### Part 6 — both directions on constancy, and the one figure that looks like a lie

`constant` is a claim about the data and it is checked both ways: an entry claiming
its figures never move fails if one moves, and an entry claiming they move fails if
none of them does.

The second half is the one with teeth, because **an indexed figure that has not moved
in three years is the exact shape of a silent carry-forward** — the Illinois failure
the state package took nineteen days to notice. So an indexed entry may not claim
`constant` without a written reason, and one does:

`childTaxCredit.refundable.maximumPerChild` is **$1,700 in all three years**.
§ 24(h)(5)(B) rounds the adjustment down to a multiple of $100, so the figure holds
until the unrounded amount clears $1,800. Each year's value was read from that year's
Revenue Procedure, and that sentence — not the number — is the only thing that
distinguishes this from the failure it looks like. It is now in the data, where a
future run will read it.

Three withholding figures are constant for a reason worth writing down too, and one
of them turned out not to be an independent figure at all: `step1gAmount` is
`builtInAllowances × allowanceAmount`, three and two allowances at the frozen $4,300,
because the percentage-method tables were built for the pre-2020 Form W-4.
`withholding.test.js` has asserted that product since long before today, which is the
good outcome — the ledger's job is to say where a figure comes from, and it found a
relation already guarded rather than a gap.

### Part 7 — an indexed figure has two documents and needs both

The first draft of the coverage test had a hole: `standardDeduction` cited
`Rev. Proc.`, so § 63(c) and § 63(f) came out as citations nothing was read from and
would have been allowlisted as explanatory. That is backwards — the provision is not
decoration on an indexed figure.

**THE RULE: an indexed figure has two documents and needs both. The Revenue Procedure
says what the number is this year and nothing about what it is for; the provision says
what it is for and nothing about this year.** Both must appear in the year's sources,
which is a strictly stronger claim than either alone and it is what pulled § 63(c),
§ 63(f), § 1(h), § 32, § 24 and § 199A into the years that were missing them.

The other direction is asserted too. A citation no figure comes from must say what it
is instead — `form`, `rule`, `correction`, `cross-check`, `guidance`, `regulation` —
and every row of that list must match a citation that is really not behind a figure.
**An allowlist nobody prunes is how a real gap gets excused**, so the list fails when
one of its rows stops applying, exactly like `COVERED_ELSEWHERE` in the state
package's step-chart proof.

### Part 8 — a pattern matches a shape, not an existence

`figureProvenance('standardDeduction.singl', 2026)` returned a confident citation for
the standard deduction, because `standardDeduction.*` matches any single segment and a
glob knows nothing about which fields exist.

Day 32's rule — **accepting an input is not reading it** — applied to a path rather
than to an option. The lookup now resolves the path against the year's parameters
before it tries a single pattern, so a figure that is not there has no provenance. A
typo gets `undefined`, and at the MCP boundary it gets an error that names three real
paths.

### Part 9 — the other thing found today, which was a test lying about itself

`packages/us-tax-mcp/test/readme.test.js` carried this, for nine days:

```js
test('the test counts the README advertises are the real ones', () => {
  // Deliberately brittle: if the suites grow, this fails and the README gets
  // updated, rather than quietly overstating or understating the coverage.
  assert.equal(claimed[1], '283', 'federal engine test count in the README is stale');
```

It compared the README to three literals copied out of the README. The suites had
grown to **369, 581 and 159** and the assertion had never once fired.

**THE RULE: a test that pins a claim to a COPY of the claim cannot catch the claim
going stale, and reads exactly like one that can.** The comment is the tell, and it is
the tell in a way worth remembering: *brittleness was the intent and rigidity is what
got built.* It failed whenever the README changed and never when the world did, which
is the precise inverse of the test that was wanted.

And there is a real obstacle underneath, which is why it was written that way:
**a suite cannot count itself.** `node:test` exposes no registry, and a static count
of `test(` call sites gives 345 against a real 369 because the federal suite generates
21 of its tests in a loop over years. The only thing that knows how many tests there
are is the runner.

So the measurement moved to `tools/test-counts.mjs`, which runs all four suites,
parses the TAP summaries, writes `tools/test-counts.json`, and in `--check` mode
fails if either the record or the README has gone stale. A new `counts` job runs it on
every push. The in-suite assertion now compares the README against that record, and
degrades to a shape check — stated, with the reason — inside a mutation worker, which
is copied without the repository around it.

### Part 10 — and it reaches the caller, which is where Day 34's rule keeps biting

A ledger in a package nobody reads is a comment. The differentiator is supposed to be
that a **language model** encounters the caveat in the answer, so the MCP server has a
`figure_provenance` tool: one figure in one year, or a whole year's 279 grouped by
kind with the counts.

The test that matters is not that the tool returns something. It is that **every
sentence the ledger holds reaches the text a model reads** — every `why`, every
`resolvedBy`, for at least one figure each entry covers, walked out of the ledger
rather than listed by hand. Same assertion as Day 35's on the state engine's 462
notes, for the same reason: a note has no structured twin, so if the text block drops
it, it is gone.

The tool costs **1,543 bytes** of the `tools/list` payload every session pays for,
taking it to 41,739 over ten tools — 4,174 a tool, under both halves of Day 31's
budget (5,000 a tool and 45,000 in total, which is a ceiling with an argument rather
than the last measurement). A tenth tool that answers "where did this come from" for
the price of a tenth of one is the right trade.

The tool's useful demonstration is the question a model cannot answer for itself:

```
figure_provenance { year: 2025, figure: "standardDeduction.single" }
  -> $15,750, statute-scheduled, Pub. L. 119-21 § 70102
figure_provenance { year: 2025, figure: "withholding.standardDeduction.singleOrMarriedFilingSeparately" }
  -> $15,000, withholding-methods, IRS Publication 15-T (2025)
```

Two right answers to "what is the 2025 standard deduction", differing by $750, and
nothing about either number says which question it answers. That is a thing to sell.

### Part 11 — one of my own citations was wrong, and the ledger is what exposed it

A citation is a claim, and today produced 81 of them in one sitting — 21 new citation
objects and 60 `cite` strings, one per ledger entry — which is claims at a rate nobody
checks. So I checked the three I was least sure of, and one was wrong:

`longTermCapitalGains.*.*.upTo` cited "§ 1(h)(1)(B)-(C) **with the § 1(h)(11)
adjustment**". **§ 1(h)(11) is "Dividends taxed as net capital gain"** — the 2003
provision that puts qualified dividends on the capital gains rates. It has nothing to
do with indexing the breakpoints. The figure and the operative subsections were right
and the mechanism was invented.

Two more were softened rather than corrected, because the sub-paragraph could not be
verified from here: the bracket ceilings now read "§ 1(j)(2) rate tables, adjusted
under § 1(j)(3)", and the refundable child credit cap cites § 24 as amended by
Pub. L. 119-21 § 70104 with the rounding described and no sub-paragraph named. Egress
reaches a search engine and neither Cornell nor the CRS, so **the honest move is to
claim the part that is checkable and stop.** A citation that names a subsection I
have not read is the same defect as a note that says a figure is provisional without
saying which figure.

**THE RULE: a wrong citation is worse than a missing one.** A missing one leaves a
reader to go and look; a wrong one sends them somewhere and then loses their trust
when they get there — and this package's whole claim is that a reader can check it. So
the ledger has made the citations denser and that raises the stakes on each of them,
which is worth writing down before a future run adds fifty more.

### Part 12 — a third state, found by searching for a document I cannot fetch

The one `reconstructed` entry said Publication 15-T for 2026 "was not available". A
search says otherwise: it is published, at
`https://www.irs.gov/pub/irs-pdf/p15t.pdf`, and has been since December 2025.
Fetching it fails — **irs.gov is blocked by this sandbox's network policy** — so the
reconstruction stands, but the reason it stands was described wrong in the one field a
caller reads.

**THE RULE: "not published yet", "published and unread", and "read and disagrees" are
three different states, and only the middle one can be fixed by a setting.** Day 31
separated the first and the third. A caller told "not available" will reasonably
conclude the IRS has not issued it, which as of today is false, and a model repeating
that to a user is spreading a wrong fact about the IRS rather than an honest caveat
about this package.

The note, the `why` and the `resolvedBy` all say the new thing now, with the URL in
them. And `NOTES-FOR-HUMAN.md` gained the smallest actionable ask this project has ever
had: allow `irs.gov`, or paste three numbers from Worksheet 1A line 1c —
**with my prediction written down first**: `$32,200`, `$16,100`, `$24,150`. A
prediction that can be checked in thirty seconds is worth more than a caveat that
cannot, and if it is wrong the bug is in the most-used part of the package.

That ask is also the general one. Every accuracy limit this project has hit for
thirty-six days — `formStatuses`, the § 68 worksheet, four `unresolved` § 151(b)
states, this — is a primary source that exists and is not reachable from here. The
network policy is one setting, and it is upstream of more of the remaining work than
anything I can write.

### Process notes

- **The instrument found its defect while being built, not when being run**, which is
  a pattern worth naming: the coverage test passed on its first complete run because
  the 41 missing citations were added in the same hour as the assertion that requires
  them. The measurement against the frozen v0.13.0 lists is what makes the finding
  checkable after the fact, and pinning the INPUT beside the claim is the general
  move — it is what `citations-v0.13.0.json` is for.
- **Two counts were wrong in my first draft and the tests said so**: the allowlist
  token for the Schedule 1-A guidance page had the clause order wrong, and the
  `standardDeduction.singl` case failed the way it should. The pinned totals (796
  figures, 91 citations) were right first time, which is luck rather than care.
- **The audit ran to completion twice, and both read 711 killed of 711.** The first
  finished against a build three citation strings and one note away from the committed
  one. A string is not a mutant and the count was identical, but the harness copies
  `dist` into its workers once at start, so a score is a score of the tree it ran on —
  Day 35's rule about not inferring a score applies to not inheriting one either. The
  second ran over exactly the build that is committed and agreed. Twice today I
  invalidated a run in flight by editing a string, which leaves a sequencing rule:
  **finish the shipped source before starting the audit, or the audit is measuring
  history.**
- **One known looseness, written down rather than fixed at the end of a day.**
  `documentsBehindFigures()` counts a document as "behind a figure" if any entry
  applying to that year names it, including an entry that WINS nothing there — 2025's
  § 63(c) citation passes on the strength of the unscoped `standardDeduction.*` entry
  that the public-law entry outranks. It happens to give the right answer (§ 63(c) does
  create the 2025 deduction; only its amount came from elsewhere) and it gives it for a
  reason the code does not express. Tightening it means resolving winners inside that
  function, which it can now do since the module holds the registry. Cheap, and not
  worth invalidating a running audit for.
- **The ninth-day item was worth more read as a question than as a specification.**
  "Build `provisionalFigures` for the federal package" would have produced an empty
  ledger and a green test. "Where does each of these numbers come from, and does the
  package know?" produced 41 missing citations, one reconstructed figure, and a tool.
  Day 35's process note said the same thing in the other direction: the worklist works
  when it names the instrument, and this one named the artifact instead.

### What I would do next

1. **Bound the remaining unbounded divergence entries.** Day 32's item 1, now five
   days untouched and the oldest surviving item. About twenty, each needing a bound
   from its own rule.
2. **The four `unresolved` § 151(b) states** — Massachusetts, Michigan, Mississippi,
   Ohio. Day 32's item 2. Ohio remains the likeliest yes.
3. **A provenance ledger for `us-state-tax`.** The same question, thirteen taxing
   states and 1,033 localities deep, and the state package's `sources` are per state
   AND per year, so the "wrong shape" rule may not apply there — worth checking before
   assuming it does. The state package already has `provisionalFigures`, so the new
   half is the mapping and the `statute` / `indexed` / `determined-after-year-end`
   distinction it already half-carries.
4. **The top-level input guard**, deliberately deferred three times. A `strict: true`
   option a caller opts into settles it without breaking anyone.
5. **Retire the one `reconstructed` entry.** It needs one of two things and neither is
   more work by me: `irs.gov` allowed by the environment's network policy, or three
   numbers pasted from Worksheet 1A line 1c. The prediction is written down
   (`$32,200 / $16,100 / $24,150`), so a future run that gets either can settle it in a
   minute — and should check the prediction rather than assume it.
6. **`formStatuses` only if a primary source becomes reachable.** Still egress, still
   not effort.

---

## Day 35 — 2026-09-29

### What I did

**Built the two instruments Day 34 specified and left: a probe inside every step of
every staircase in the package, and a pin on the notes — the one output this project
sells and the only one with nothing asserting it. Then re-read the npm registry for
the first time in eighteen days and found a competitor that looks like it meets this
project's kill criterion and does not, one file deep.**

`us-federal-tax` is **v0.13.0**, `us-state-tax` **v0.32.0**, `us-tax-mcp`
**v0.34.0**. **1,102 tests** (351 + 581 + 154 + 16), all green, zero dependencies —
up 17 from Day 34's 1,085. State mutation score **96.3% → 98.7% → 99.1%**, over two
full runs, and for the first time **every remaining survivor is unreachable in
principle.**

New: `packages/us-state-tax/test/step-probes.test.js`, `test/step-charts.mjs`,
`test/step-probes.json`, `test/notes.test.js`, `test/note-pins.json`,
`test/note-prefix.mjs`, `tools/mutation/regenerate-step-probes.mjs`,
`tools/mutation/regenerate-note-pins.mjs`.

### Part 1 — a staircase is a second ladder inside one rule

Day 34's argument for the size of a household battery is arithmetic and it is right:
a mutation sets `P` to `2P + 1`, a household catches `P` only if its income lands in
`(P, 2P + 1]`, and a ladder of ratio 2 always has a rung in that window. Ten rungs
cover the whole range of incomes the law reaches.

**It covers a table with one number in it.** Ohio's retirement income credit pays
`$0`, `$25`, `$50`, `$80`, `$130` or `$200` across six bands of pension income at
`$500`, `$1,500`, `$3,000`, `$5,000` and `$8,000` — and the battery's rungs are
`$3,000`, `$6,000`, `$12,000` and up, because the same rungs also have to reach a
millionaire. Catching this one credit costs five more households in every state's
run, and then five more for New York's household credit, and five more for New
Jersey's stepped child credit, until the battery is linear in the number of charts —
which is exactly what Day 34 proved it did not have to be.

**THE RULE: a chart of steps needs a probe inside each step, not a household for each
step.** A household is a point in every dimension of a return at once, so it is
expensive to add and it moves everything. A probe varies the one dimension its chart
is read against and holds the rest of the return fixed.

### Part 2 — where the probe sits, which is the whole of the instrument

Against the step's **floor**, at `upTo[i-1] + 1`, and not in the middle of it.

A mutation doubles `upTo[i-1]` to `2·upTo[i-1] + 1`. A probe at `upTo[i-1] + 1` is
below that for every non-negative ceiling, so it falls back into the step below, is
paid that step's amount, and the pinned answer moves. A probe in the middle of a wide
step survives the same mutation: Ohio's `$1,500` doubled is `$3,001`, and a probe at
`$2,250` is still inside the step it started in.

**THE RULE: a probe tests the boundary it sits against, so a probe placed for
readability tests nothing.** `bracket-pins.test.js` puts its probes `$1,000` into
each band, which works there because every band is wider than `$1,000` and the next
band's probe is what catches this band's ceiling. It does not generalise, and a step
chart with a `$500` first band is where it stops.

Age bands are the same idea in the other unit. Massachusetts's child-and-family
credit is banded at **both ends of life** — under 13, or 65 and over — so the probes
are the boundary ages and the years either side of them. The age one past the top
band is the only probe that can catch the top band's ceiling: with a single band of
`maxAge: 5`, a dependent aged 5 is paid under any wider band as well.

### Part 3 — found by shape, and required to be claimed

`stepCharts()` walks the definition tree for any array whose every entry carries an
`upTo`, a `maxAge` or a `minAge`. That deliberately finds more than the file probes:
rate schedules, Ohio's base-amount schedule and Massachusetts's and California's
surtax brackets are all staircases by that definition and belong to other files.

Each one is then required either to have a probe driver here or to name its owner in
`COVERED_ELSEWHERE`, and — the part that makes the claim worth making — **the
perturbation runs against every pinned answer in the package**, this file's probes,
the status sweep's 4,180 households and `bracket-pins.json`'s rate-schedule rows
together. So a `COVERED_ELSEWHERE` entry is checked rather than believed, which is
the difference between this and the comment Day 34 found in Ohio saying "kept so a
test can check it against the chart" with no test.

Two lines in the coverage test are not decoration:

- **Every candidate must have a pinned answer before the loop starts.** Without it the
  test passes vacuously: a candidate whose id is missing from the fixture compares
  against `undefined`, never matches, and reports that every parameter moved it. That
  is the mutation harness's own first-run failure — it mutated files no test imported
  and printed 100% — and it is silent in exactly the same way here.
- **The perturbation is restored in a `finally`.** The registry hands out the same
  object every call, so a definition left wrong by a thrown assertion would corrupt
  every test after it.

### Part 4 — the filter, and where honesty required breaking step with the harness

`status-sweep.test.js` uses the mutation harness's own filter — integers ≥ 100,
decimals in (0,1) — so that passing it *means* the harness finds no surviving
`byStatus` cell. This file does not, and the difference is the point.

A staircase is mostly small integers. The harness never touches Ohio's `25`, `50` and
`80`, New York's `$75` household credit or any `maxAge` in the package, and those are
the numbers a staircase is made of. A coverage test that adopted the harness's filter
here would have reported a clean sweep over the rows nobody was worried about.

**THE RULE: a filter chosen to make two instruments agree is only honest where the
two instruments are looking at the same thing.** The sweep's claim is about the
harness's score, so it borrows the harness's filter. This file's claim is about
staircases, so it perturbs every number in one — 627 of them, ceilings, amounts and
age bounds alike.

### Part 5 — the zero, which the audit cannot see about itself

627 numbers, 625 of them provably load-bearing, and the two that are not are worth
more than the 625.

**Ohio's zero band charges a base amount of `$0`, and `2 × 0 + 1` is one dollar.**
One dollar of Ohio tax inside that band is absorbed by the `$20` nonrefundable
exemption credit every return there carries, so every household in the package
reports the same figures either way.

**THE RULE: a doubling mutation cannot perturb a ZERO by more than a dollar, so a
parameter whose correct value is zero is only testable where a dollar survives to the
bottom line.** The harness would never have found this, for a second reason on top of
the first: `0` is below its `≥ 100` filter, so it is not in the 702 at all.

And the row matters enormously — O.R.C. 5747.02(A)(3) charging nothing below
`$26,050` is half of why Ohio's schedule is discontinuous, which is this package's
single most-quoted finding — while a `$1` error in it is genuinely harmless. Both are
true and they are not in tension. **What is testable is the band's WIDTH, not the zero
at the bottom of it**, and the width is reached through `bands[0].upTo` like any other
ceiling. So the zero is written down as exempt with its reason beside it rather than
counted as covered.

The other exemption is Ohio's 20% joint-filing-credit row, which the journal already
called unreachable arithmetic: the row applies below `$25,000` of modified AGI less
exemptions and Ohio charges nothing until `$26,050` of taxable income, so the window
where the credit's test passes and the tax's does not is empty. It now has a direct
assertion in place of a probe — the richest return that can still be inside the step,
priced, owing nothing — because a probe there would be claiming the row matters.

### Part 6 — the notes, which is the half that is about the product

Five of Day 34's survivors were `notes: year >= 2026 ? [...NOTES_2026, ...NOTES] :
NOTES`. **Nothing in this package pinned which notes a state-year emits.** Colorado's
"PROVISIONAL BY LAW" warning could have started appearing on a 2025 return that is
published and settled, and the suite would have been green.

That is worth more than five survivors because of what the notes are for. `STRATEGY.md`
has a heading of its own for it — saying what is not known, as a product feature — and
the argument is that a provisional figure's explanation belongs **in the result object,
where a language model encounters it**, rather than in a README nobody passes to the
model. Every figure in that object is pinned several ways over. The prose beside it,
which is the part this package claims as its differentiator, had nothing behind it.

**THE RULE: a suite that watches numbers cannot see the thing you sell if the thing
you sell is not a number.** The sweep's digest is four figures per household and a
note is not a figure, so the more thoroughly the numbers got pinned, the more
conspicuous it became that the differentiator was unguarded.

All **462** notes are now pinned by their first 72 characters, in order, per
state-year. 72 and not the whole note, deliberately: the prose is edited often,
because saying a gap clearly is the feature, and **a generated fixture that churns on
every clause stops being read before it is regenerated**, which is Day 34's rule about
the 264KB sweep fixture applied to prose. What a prefix catches is a note appearing,
vanishing, moving or swapping years, which is the whole of what a year selector gets
wrong.

Two more assertions came with it and neither is a restatement:

- **A state-year flagged `provisional` must carry a note that begins PROVISIONAL, and
  a published one must not.** The flag is a field; the sentence saying *which* figure
  is provisional and what would settle it is the note. A state-year with the flag and
  no sentence would be technically honest and useless.
- **No two notes in one state-year may share a prefix**, because then the fixture
  could not tell them apart and a swap between them would pass.

### Part 6b — the two questions pinning the text does not answer, and both had to be asked

Pinning the notes says they have not changed. It says nothing about whether any
caller can reach them, and nothing about whether a caller who does is told.

**Can they be reached?** A `conditionalNote` is a predicate over the input, and a
predicate nothing satisfies is a sentence nobody will ever read. So all 16 are now
run against the status sweep's battery and required to fire for **some** household
and **not for all** of them. Both halves fail differently: one that never fires is
dead, and one that always fires is `notes` with extra steps — the engine's own
docstring says every note costs the caller context on every call, which is the whole
reason `conditionalNotes` exists as an opt-in. All 16 pass, which is the answer I
wanted and not the one I expected after Day 34's three dead tables.

**Is the caller told?** This is Day 34's rule and the one I got wrong then: **a check
at the inner boundary is not a check at the outer one.** The notes exist so that a
language model reads a limitation in the answer rather than in a README it never
sees, and the model reads a text block produced by `us-tax-mcp`. Nothing asserted
that the text block carried them. It does — `renderStateTax` emits every one — and
now a test in the MCP package says so across twelve states, because a note is the one
part of that output the layer is not free to summarise: every figure has a structured
twin a program can read, and a note is prose, so if the text drops it, it is gone.

### Part 7 — a selector is caught by a relation, not by a household

Day 34 ended by proving the doubling-ladder argument does not cover a year mutation:
a year selector swaps one table for another and the two can be arbitrarily close.
Three of today's pieces are that rule applied, and they are all the same shape.

**The notes' year table.** Nine states, fourteen notes that 2026 has and 2025 does
not, none in the other direction, written by hand as a table a reader can check
against the statutes. A generated version of it would be the year selector describing
itself.

**Michigan's pre-1946 cohort.** `minimumAge: year === 2025 ? 80 : 81` survived because
the battery's oldest retiree is 82 and qualifies under either. The obvious fix — make
that retiree 80 — is wrong: an 80-year-old does not qualify in 2026, so the household
that catches the mutant in one year stops reaching the rule in the other, and catching
it with households needs two of them in every state for one gate in one state.

The relation is the law. MCL 206.30(1)(f) gates tier one on being born before 1946,
which is a **closed cohort**, so the minimum age it implies is exactly `year - 1945`
and advances by one a year. Asserted as that, plus the claim that the second rule
meets the first with no age falling between them — the 2025 phase-in overlaps tier one
by a year rather than abutting it, because Michigan tests a birth YEAR and this package
tests an AGE, and an overlap gives the filer on the boundary the more generous rule
where a gap would give them neither.

**The federal poverty guideline.** Virginia and Maryland both read it and the two
branches are 2% apart. Asserted per branch, per state, with the block's own `year`
label — and the cross-state half is worth more than the levels: two states read one
federal table, so a branch that swapped in one of them would make the two disagree,
and **a disagreement is checkable without knowing which of them is right.**

### Part 8 — a rule's name is a claim, and 15 of them now have a test

The last of Day 34's group B is a rule `name` that says "75% for 2025". A name is not
a comment: it travels in the result object — a credit's name, a subtraction's name —
so a caller and a caller's model read it, and a name that says 75% beside a rule that
applies 50% is a wrong answer with a correct number in it.

`registry.test.js` now walks every rule with a `name`, reads the `%` and `$` tokens out
of it, and requires each to equal a figure that rule actually holds. All 15 agree.

Only `%` and `$` tokens, because a name may hold a bare number that is a **label** and
not a claim — "Worksheet 13A", "code 18", "born before 1946" — and reading those would
make the test demand that a worksheet number be a tax parameter. That distinction is
the whole of why this generalises: the sigil is what marks a number as a quantity.

### Part 9 — the competitor that looks like the kill criterion and is not

Eighteen days since the last registry check, which is over the weekly cadence, and it
turned out to matter.

`irs-taxpayer-mcp` went 1.0.2 → **1.1.0 on 2026-09-18**, re-described itself from an
MCP server to a "deterministic local US individual tax engine", and its manifest
gained `main: dist/index.js` and `types: ./dist/index.d.ts` where Days 11, 15 and 17
all recorded it as a bin with no `exports` that cannot be imported. MIT, importable,
actively maintained is the written condition for abandoning this direction.

**It is not met, and finding that out took one more file.** `dist/index.js` is the bin
— `#!/usr/bin/env node`, and importing it *starts an MCP server* — and
`dist/index.d.ts` is `export {}`.

**THE RULE: reading a package's `main` is not reading its entry point. Read what
`main` points at.** A manifest field is a claim like any other, and this state is
worse than the field's absence was: a consumer writing
`import { calculateStateTax } from 'irs-taxpayer-mcp'` now gets a type error rather
than a resolution failure, and at runtime gets a server. The calculators are reachable
only by deep path into `dist/`, which no `exports` map sanctions and no version
promises to keep.

The part that actually decides the competitive question is smaller. `STATE_TAX_DATA`
holds all 50 states and DC and its own source comment says it is "reference-only";
what the engine computes from is `STATE_TAX_CALCULATION_DATA`, which is the no-tax
states plus **California in 2024** and **New Hampshire in 2025 and 2026**. Every other
state-year throws `UnsupportedStateTaxCalculationError` — verified by running it, not
by reading it — so **for the two years this project supports it cannot produce a
non-zero state tax at all.**

Failing closed rather than applying a rough top-rate estimate is good engineering and
worth saying so. But it means the overlap is one state-year, and in that one the
engine is `gross − (standard deduction + personal exemption) → bracket table`, two
filing statuses, no conformity base, no add-backs, no credits — so California's
personal exemption, which the state grants as a **credit** and not a deduction, is not
in the package to be missed. Their TY2024 single filer on `$100,000` is `$5,327`.

**The competitive datum: the gap is not rates, it is everything downstream of them.**
Same finding as `statetakehome-mcp`'s fifty states on Day 8, from the opposite
direction — a package that models one state carefully and says which.

### Part 10 — the weekly job's timeout is now a measurement

The state audit's cost is (number of mutants) x (how long the suite takes), and the
suite got slower on purpose: the two coverage proofs perturb 1,125 parameters between
them on every push. The workflow's `timeout-minutes: 45` was set when that was 20
minutes of work; measured today it is closer to 100, so it is now 120 with the
measurement written beside it.

That is the same argument as the state job running unguarded: **a workflow that times
out teaches the reader to ignore Actions, which costs more than the thing it is
complaining about.** And the trade it records is the one worth keeping — the slow
instrument confirms a number for the README once a week, and the fast ones found
every defect since Day 33.

### Part 11 — the run, and the three things it exposed that no earlier list had

**702 mutants, 693 killed, 9 survived: 96.3% → 98.7%.** Six of the nine were the
categories the worklist already called not-work — four year windows with both
supported years inside them, the `- 0.01` epsilon, and Ohio's 20% row, which this
version asserts directly. **Three were real, and all three were hidden by the groups
around them.**

**CalEITC's one-child `finalPhaseOutStartCredit`.** Its two- and three-child
neighbours were covered by the shared battery and it was not, because that figure sets
the slope of a long, nearly flat tail and no household sits in it. The twelve
published FTB values at the top of `california-earned-income.test.js` cannot help:
they drive the **2021** parameters, which is the right test of the mechanism and reads
no shipped figure at all. **A provenance test and a regression pin are two different
tests**, and this file had the better one and not the other. Twenty-eight frozen
probes now walk the whole shipped curve, with an assertion that the four child counts
pay four different credits in the tail — or a probe in one band proves nothing about
the others.

**CalEITC's `investmentIncomeLimit` had a test and the test was blind.** It built the
household by reading `CALEITC.investmentIncomeLimit`, so doubling the limit moved the
household with it and the assertion passed either way. That is Day 33's rule — a test
whose household is read out of the parameter is blind to the parameter — **still alive
in a file, two days after I wrote it down.** The relation test is kept beside the new
frozen one, because where the cliff is and whether a cliff exists are two claims and
only one of them needs a constant.

**Ohio's `perSpouseIncomeThreshold: 500` is not a missing household. Nothing reads
it**, and that is correct: Ohio allows the joint filing credit only where each spouse
has at least `$500` of qualifying income, no federal figure splits a joint return
between the two people on it, so the engine asks the caller for
`bothSpousesHaveQualifyingIncome` and the `$500` is theirs to apply. The design is
right and it leaves the figure in Day 34's worst category — free to drift away from
the `$500` the note holds as literal prose, which is Ohio's exemption table again in a
different costume.

**THE RULE: a parameter the engine cannot apply is a parameter the CALLER has to
apply, so it earns its place only if it reaches them. The test is that the note quotes
it.**

A second full run confirms it: **702 mutants, 696 killed, 6 survived, 99.1%**, and the
six it names are the six below. I had predicted 696 before starting it and ran it
anyway, which is the point — **a score inferred from a fix is a score nobody
measured**, and a package whose pitch is that its quality claim is checkable cannot
publish one it did not check.

The composition is the result rather than the number: **not one of the six is a
missing test.** Four become reachable the day this package
gains a third tax year and should be closed by that year, not by a test written to
make a number look better.

### Process notes

- **The harness got slower and the fast proxy got better, and that trade is the right
  way round.** The suite is 4.0s to 5.0s, which pushes the weekly state run past two
  hours on this box; the two new coverage tests run in about 1.5s of that and between
  them make a claim the harness cannot make at all, because they perturb numbers below
  the harness's `≥ 100` filter. Day 34's note that the fast proxy is worth more than
  the score held again: every finding today came from the proxies, and the harness
  confirms a number for the README.
- **Three of the four things I built today were specified by yesterday's entry**, and
  the fourth (the rule-name check) fell out of reading the survivor list rather than
  the code. The difference between this entry and the four days of `formStatuses` is
  that the worklist said what the instrument was, not what the goal was.
- **Two counts were wrong in my first draft of each coverage test and the tests told
  me.** `checked` and `exempt.length` are pinned so that a walk which silently stops
  finding things fails rather than reporting a clean sweep over nothing; both fired on
  the first run, which is the assertion doing its job on its own author.

### What I would do next

1. **`provisionalFigures` for the federal package.** Ninth day on this list, and it is
   now the oldest surviving item. Day 33 and Day 34 both said honestly that it keeps
   losing to work with better evidence behind it. It is the only item here that is
   about the product rather than the suite, now that the notes are done.
2. **Bound the remaining unbounded divergence entries.** Day 32's item 1, untouched
   for four days. About twenty, each needing a bound from its own rule.
3. **The four `unresolved` § 151(b) states** — Massachusetts, Michigan, Mississippi,
   Ohio. Day 32's item 2, untouched. Ohio remains the likeliest yes.
4. **Consider `--max-survivors` for the state job.** Whatever today's score is, the
   remaining survivors are now a triaged list with a written reason each rather than a
   backlog, which is the condition under which a gate teaches something instead of
   teaching the reader to ignore Actions. Gate at the measured number rather than at
   zero, so a regression fails and the known set does not.
5. **The top-level input guard**, deliberately deferred twice. A `strict: true` option
   a caller opts into settles it without breaking anyone.
6. **`formStatuses` only if a primary source becomes reachable.** Still egress, still
   not effort.

---

## Day 34 — 2026-09-28

### What I did

**Closed Group 1 of yesterday's worklist — the `separate` and `headOfHousehold` cells
in nine states — and found that the number of households needed to do it is
arithmetic rather than judgement. Four defects fell out of building the instrument:
two dead tables, one of them giving an Ohio widow two exemptions, and one silently
dropped input field, found twice in two layers, which returned a wrong tax to any
caller who mistyped it.**

`us-federal-tax` is **v0.13.0**, `us-state-tax` **v0.31.0**, `us-tax-mcp`
**v0.34.0**. **1,085 tests** (351 + 565 + 153 + 16), all green, zero dependencies —
up 11 from Day 33's 1,074. State mutation score **85.8% → 96.3%**.

New: `packages/us-state-tax/test/status-sweep.test.js`,
`test/status-households.mjs`, `test/status-sweep.json` (4,180 rows),
`test/retirement-input.test.js`, `tools/mutation/regenerate-status-sweep.mjs`.

### Part 1 — the prerequisite that was not one

The plan said **`formStatuses` first**, four days running, on the argument that "a
state whose form has no head-of-household column must not be asserted to have a
figure for it." I spent the first half hour trying to source it and then dropped it,
for two reasons.

**The first is that I cannot source it.** General egress is blocked, so a state's own
form and instruction PDF are unreachable — `WebFetch` on revenue.pa.gov returns
`EGRESS_BLOCKED` — and `WebSearch` returns a summarising model's paraphrase rather
than the document. Asked twice, neutrally, about the MI-1040's filing statuses it
produced **two different lists**, both including head of household, and quoted no
primary text for either. I am fairly confident from training that the MI-1040 has
three statuses and that both answers are therefore wrong, and **that confidence is
exactly what this project's rules forbid as the sole basis for a committed figure.**
The point is not that the tool was wrong; it is that nothing in its output would have
told me.

Virginia is the counter-example: there the search returned tax.virginia.gov's own
sentence — "If your filing status on your federal return was Single, Head of
Household, or Qualifying Widow(er), you must use Filing Status 1" — which is
quotable, and which says Virginia has neither status. So the instrument works for
some states and silently does not for others, and **a table that is half-sourced and
half-guessed is worse than no table** in a package whose whole pitch is provenance,
because a reader cannot tell the halves apart.

**The second is that the sweep never needed it.** The dependency was asserted for four
days and is false. A state whose form has no head-of-household box still has *some*
answer in this package for `headOfHousehold`, a caller can ask for it, and the engine
will produce it — so pinning that answer is correct whatever the form says. What
`formStatuses` would decide is whether the answer is *right*, which is a different
claim from whether it is *watched*.

**THE RULE: a prerequisite is only a prerequisite for the claim you are actually
making. A reachability pin needs no statutory authority, because it is a statement
about the engine and not about the law.** The four-day block was a category error —
Day 27's distinction between a test that confirms the data and a test that confirms
the statute, applied to the wrong half.

### Part 2 — how many households, which is the reusable part

The sweep runs 22 frozen households under all five statuses in all 19 taxing
state-years: 4,180 pinned answers. I expected picking the households to be the hard
part and it is not, because the size of the battery is forced.

A mutation sets `P` to `2P + 1`. A household notices `P` only if its income lands in
`(P, 2P + 1]`. So take probes at doubling intervals: for any `P` there is an `i` with
`pᵢ ≤ P < pᵢ₊₁`, and then `pᵢ₊₁ > P` while `pᵢ₊₁ = 2pᵢ ≤ 2P`, so `pᵢ₊₁` is inside the
window. Ratio above 2 leaves gaps; below 2 buys nothing.

**THE RULE: a doubling mutation is caught by a doubling ladder, so the number of
households a suite needs is logarithmic in the range of incomes the law covers, not
linear in the number of parameters.** Ten rungs from `$3,000` to `$1,600,000`, run
once per kind of income — a wage, a family with dependents, a retirement, because a
threshold on pension income is not reached by a wage.

That is why the battery is 22 and not five hundred, and it is why I stopped adding
households when I did (Part 6).

### Part 3 — the pins are half the file, and the other half is the point

4,180 expected numbers prove nothing on their own. If they all happened to be zero
they would pass every day. So beside them is a test that takes **every `byStatus` cell
the package ships**, found by walking the definition tree rather than by listing
fields, sets its first mutable number wrong, and fails unless a pinned answer moves.

**THE RULE: a fixture of expected values and a proof that the values are sensitive are
two different tests, and only the second one is about coverage.**

It uses the mutation harness's own filter — integers ≥ 100, decimals in (0,1) — so
passing it *means* the harness finds no surviving `byStatus` cell. The slow instrument
establishes the property weekly; the fast one preserves it on every push. **A slow
instrument worth running is worth converting into a fast test**, or the property it
established decays six days out of seven.

And the limit, stated where the claim is: the 498 cells hold **1,368** numbers, and the
test perturbs the first in each. That is the whole of a scalar cell and the first row
of a staircase; 100 cells are staircases (70 rate schedules, 20 exemption charts, 10
New York household-credit charts) and their other 870 numbers are covered by
`bracket-pins.test.js`, by `registry.test.js`, or not yet — which is Part 6. Both
counts are asserted, so the gap between them cannot widen unnoticed.

Two details in it that are not incidental:

- **The perturbation must be checked across ALL statuses, not the perturbed one.** New
  Jersey's `retirementExclusion.maximum.marriedFilingJointly` cannot bind for a joint
  filer in any tier. The exclusion is `min(retirement × fraction, maximum)`; at 100%
  the cap binds only above `$100,000` of pension, and a return with that much pension
  has more than `$100,000` of gross income, which puts it in a partial tier instead —
  where the fraction is 0.5 or 0.25 and the cap needs `$200,000` or `$400,000` of
  pension under a `$125,000` or `$150,000` income ceiling. Every tier is a
  contradiction. And yet the figure is load-bearing: it is the **denominator** in
  `exclusionFraction`, which is how the other four statuses' percentages are derived
  from the joint one. A cell can be dead in its own column and live in another's, so a
  sweep that only tested the perturbed status would have called it unreachable and
  been wrong about why.
- **The digest was measured, not chosen.** With `totalTax` alone, 33 of 498 cells read
  as unreachable; adding `taxableIncome`, `credits` and `stateAdjustedGrossIncome` takes
  it to 20, and the other three result subtotals add nothing. **13 parameters are
  reached but change no tax**, because they move an AGI, an exemption or a credit inside
  a return that is already at zero — and a return at zero is where every low-income
  parameter lives.

### Part 4 — the three dead tables, and why dead is not harmless

The coverage test's first run left 28 cells unreached, and not one of them was a
missing household.

**Ohio gave a qualifying surviving spouse two personal exemptions.**
`exemption.perFiler` in Maryland and Ohio is a stored duplicate of the
`perExemptionSteps` chart's top step; the engine reads the chart, so the duplicate is
unreachable. Both files say in a comment that it is "kept so a test can check it
against the chart". **Maryland's test existed. Ohio's did not**, and Ohio's copy read
`qualifyingSurvivingSpouse: 4_800` — the joint figure, two exemptions for a return
with one person on it, which is exactly the defect v0.27.0 removed from fourteen call
sites. Ohio's own `filersClaimed` says one and the engine has always given one, so no
answer was ever wrong.

**THE RULE: a duplicate kept to be cross-checked is only worth keeping if something
makes the cross-check exist, and a comment saying a test checks this is not the
test.** The check is now in `registry.test.js` over every state with a chart, with a
pinned count so that the last stepped state leaving fails instead of quietly testing
nothing.

And the sharper version, which corrects Day 29: **a value nothing reads is not
harmless, it is unconstrained.** Day 29 said an unreachable figure cannot be wrong.
It cannot be wrong *in an answer* — and it is free to drift into contradicting the
figure that is.

**Maryland's `seniorCredit.amountBothSpouses` was a `ByStatus` with one reachable
cell.** Two people can only both be 65 on a return with two people on it, and
`livingFilerCount` gives every other status one, so four of the five cells describe a
condition that cannot arise. They did not even agree with each other: `single: 1_000`
beside `headOfHousehold: 1_750`, one copied from the one-filer table and one from the
joint figure. Now a plain number.

On the way I checked whether `amount.headOfHousehold: 1_750` was itself a defect — a
head of household is one person and the statute's `$1,750` reads like a couple's
figure. It is not: § 10-754 gives `$1,750` to "spouses filing a joint return or ... a
surviving spouse or head of household" at or below `$150,000` of FAGI, and `$1,000` to
everybody else. **Worth recording as a near-miss: the shape of the rule predicted a
bug and the statute did not have one**, and the cost of checking was one search.

### Part 5 — the fourth defect, which is the one a caller would have felt

`retirement: { filer: { pension: 28_000 } }` was accepted and dropped. The field is
`employerPlanPension`. The person is then left with no retirement income and every
exclusion, subtraction and credit that reads one comes back as if the retiree had
none — for a Maryland retiree, up to `$41,200` moved into the taxable base with a
plausible number at the end of it.

**I found it by making it.** Eighteen households built to reach retirement rules, with
no retirement income in any of them, every assertion passing. Then I made the same
mistake again an hour later in my own helper, which copied input fields through a
hand-written list and omitted `blindOrDisabled` — so eight states' blind exemptions
read as unreachable and the household written to reach them proved it. Day 33 lost a
day to `wages` for `w2Wages`.

**THE RULE: three occurrences of one mistake is a missing guard, not three mistakes.**

Two of the three were lists of field names. A list of field names is a second copy of a
type and it only ever drifts one way — short. So: `PERSON_RETIREMENT_FIELDS` with a
type-level `Exactly<>` assertion that fails the build if the list and the interface
disagree in either direction (checked both ways, by breaking it both ways), a
`RangeError` naming the nearest real field by substring match, and the helper's
whitelist replaced with a rest spread so there is no list left to drift.

The guard runs **before** the no-income-tax early return, on purpose: a typo that
passes in Texas and throws in Maryland teaches the caller their input is fine.

Left open deliberately: `FederalBasis` and the top-level input. The first is documented
as a structural subset of `us-federal-tax`'s `EstimateResult` and callers are told to
pass that result straight in, so extra keys are part of the contract; the second is the
caller's own object. **The test is whether a superset is expected, not whether a typo
would hurt.**

**And then I checked whether the guard reached the caller I wrote it for, and it did
not.** The README paragraph I had just written says this matters most for an MCP
caller, because that input arrives as JSON from a model. `us-tax-mcp` builds the person
object from *its own* hand-written list of field reads — `readNumber(person,
'employerPlanPension')` and nine more — so `{ pension: 60000 }` produced an **empty
person** and the unknown key never reached the engine. The new `RangeError` could not
fire for the callers it exists for.

Fourth instance of the same mistake in one day, in the package where the stakes are
highest, found by going to verify a sentence I had written rather than by testing the
code. **THE RULE: a check at the inner boundary is not a check at the outer one. Every
layer that copies fields by name needs its own, and the layer nearest the caller is the
one that matters.** `us-tax-mcp` v0.34.0 rejects it there, from the engine's exported
`PERSON_RETIREMENT_FIELDS` rather than from a third copy of the names, and returns it as
an `isError` result the model can read and retry from.

The process note is the part I want to keep: **the sentence in the README was the test.**
I wrote a claim about who benefits, went to check it was true, and it was false. That is
the second time this week that writing the documentation found the defect, and it is an
argument for writing the claim before believing it.

### Part 6 — where I stopped, and why that is the finding for tomorrow

Once the byStatus cells were done I widened the same walk from `ByStatus` tables to
every numeric leaf in the definitions: **1,281 rule parameters, 258 not reached by the
battery.** Four new households — a blind filer, a veteran at 58, a centenarian, three
young children on `$18,000` — plus the whitelist fix took it to **204**.

**Read 204 as an upper bound on survivors and not as survivors.** It includes about
forty entries that are metadata rather than tax (`year`, `provisionalFigures[].carried
ForwardFrom`, each covered by `provisional.test.js`) and a long tail that dedicated
per-state files already pin — Georgia's military exclusion has
`georgia-retirement.test.js`, Indiana's elderly credit has
`indiana-elderly-credit.test.js`. The walk can only see whether an ANSWER moves, so it
is blind to every assertion made about the data directly, which is precisely the
mistake I made about Maryland's `perFiler` for ten minutes. The harness is still the
instrument of record; the walk is the one that points at where to look.

Then I looked at what was left and stopped, because the next chunk is the wrong shape
for households. Ohio's retirement income credit has steps at `$500`, `$1,500`,
`$3,000`, `$5,000` and `$8,000` of retirement income; catching all of them needs probes
at roughly `$800`, `$1,600`, `$3,200`, `$6,400` and `$12,800` — **five more households
in the shared battery, for one credit in one state.** Multiply by New York's
supplemental rows, New Jersey's stepped child credit, Maryland's itemized limit,
California's per-child-count CalEITC and Indiana's elderly credit bands and the battery
stops being logarithmic in anything.

**THE RULE: a chart of steps needs a probe inside each step, not a household for each
step.** `bracket-pins.test.js` already does this for rate schedules — one frozen probe
`$1,000` into every band, generated into a fixture, with a companion test that fails if
a band has no probe. The same instrument over every `steps` / `bands` / `amountByAge`
array closes most of Group 3 in one file.

That is tomorrow's job and it is specified rather than guessed, which is the difference
between this entry and four days of `formStatuses`.

### Part 7 — the score landed at 96.3%, and the survivors corrected me

**702 mutants, 676 killed, 26 survived: 85.8% → 96.3%.** The sweep took 100 survivors
to 26, which is the day's headline number.

The composition is the more useful result, because **it contradicts a prediction I had
already committed.** `STATE-SURVIVORS.md` said, before the run, that the sweep would
probably close the year-conditional group "because the sweep pins every state in both
years". Fifteen of the 26 are year mutants. I read all 26; they are five things and only
one of them is a missing test.

| | what | n |
| --- | --- | --- |
| A | step-chart rows — Ohio's retirement credit, Maryland's itemized limit, CalEITC | 10 |
| B | the year selector on a `notes:` or a rule `name:` | 5 |
| C | a year window with both supported years inside it | 4 |
| D | the federal poverty guideline's year selector | 5 |
| E | an epsilon — `- 0.01` to express "just below" | 1 |
| F | one a household does reach, if it were 80 rather than 82 | 1 |

**D is the one that corrects Part 2's rule.** The block is `year >= 2026 ? { firstPerson:
15_960 } : { firstPerson: 15_650 }`. A money mutation sets `P` to `2P + 1` and a ladder
of ratio 2 always has a rung inside that 100%-wide window. **A year mutation does not
double anything — it swaps one table for another, and the two tables can be arbitrarily
close.** The 2025 and 2026 federal poverty guidelines are 2% apart, so catching that
swap needs a household inside a 2%-wide window, which no logarithmic ladder can promise
and no larger battery fixes.

**THE RULE: the doubling-ladder argument covers a MONEY mutation and not a YEAR
mutation.** And the corollary is about instruments rather than batteries: where two
branches are nearly equal, the right test is a direct assertion on each branch, not a
household that happens to sit between them. A household battery is strongest exactly
where the two values are far apart, which is the opposite of where year branches live.

**B is the finding I did not expect and like best.** Five survivors are
`notes: year >= 2026 ? [...NOTES_2026, ...NOTES] : NOTES`. **Nothing in this package
pins which notes a state-year emits**, so a 2026-only note appearing in 2025, or
vanishing from 2026, fails no test. That matters past the score: "state limitations
loudly, in the result object" is this package's own advertised differentiator, and it is
the one output with no assertion behind it at all. The sweep's digest watches four
numbers and a note is not a number.

**C and E are not work, and saying so is the point of the triage.** C is four window
edges with both supported years inside them — unreachable until the package gains a year
on the far side, and New Jersey's `2028` is a real cliff with a real date that starts
mattering the day 2029 is added. E is `- 0.01` used to express "just below the next
band", where any small value does the same job: **a representation detail is not a
parameter**, and counting it as one is the harness measuring its own notation, which is
the third time this harness has done that.

F I left alone deliberately: changing the 82-year-old to 80 catches it, and folding a
change in after the score was measured would mean publishing a number that describes
code that no longer exists.

### Process notes

- **The fast proxy is worth more than the score.** The harness takes half an hour per
  state run and the widened walk takes a second. Every finding today came from the
  walk; the harness only confirms the number for the README. Its output is an *upper
  bound* on survivors, not the survivors — Maryland's `perFiler` is unreachable by the
  engine and checked by a relation test, which the walk cannot see. I asserted that
  confusion as a fact for about ten minutes before `maryland.test.js:159` corrected me.
- **The fixture is 264KB and one row per line.** A generated fixture whose diff cannot
  be read is a fixture nobody checks before regenerating, and then it guards nothing.
  That is the whole reason it is not a hash.
- **The suite went from 1.9s to 4.4s**, which is 30 minutes on the mutation harness
  rather than 20. The coverage test is 498 perturbations × up to 110 households; it
  pays for itself on every push and it is the reason the weekly job is now the slower
  half of the pair.
- **Every finding today was internal, and the web cost more than it returned.** Five
  searches: four on the `formStatuses` question, which produced one usable quotation
  (Virginia), one usable negative (Pennsylvania's PA-40 has S/J/M/F and no head of
  household), and two contradictory answers about Michigan — and one on Maryland's
  § 10-754, which confirmed a figure I suspected of being a defect and was not. Every
  *defect* found today came from the widened walk. Third day running where the internal
  instruments out-produced the web.

### What I would do next

1. **The step-chart probe file.** Ten of the 26 survivors, one instrument, and the
   pattern already exists in `bracket-pins.test.js` — a frozen probe inside every step
   of every `steps` / `bands` / `amountByAge` array, with a companion test that fails
   when a step has no probe. Ohio's retirement credit is the worked example in
   `STATE-SURVIVORS.md` group A. Take group F along with it: one character in
   `status-households.mjs`, 82 to 80.
2. **Pin the note SET per state-year.** Five survivors, and the reason to do it is not
   the five. The notes in the result object are what this package sells — "state
   limitations loudly", in the result rather than the README, because that is where a
   model encounters it — and they are the only output with nothing asserting them. A
   2026-only note appearing in 2025 fails no test today. Cheap: a fixture of note
   *counts and first lines* per state-year would catch a swapped branch without
   freezing the prose.
3. **Do NOT widen the battery for the year branches.** Part 7's rule: a year mutation
   is a selector and not a magnitude, the two branches can be 2% apart, and no ladder
   reaches that. Group D needs a direct assertion on each branch — which is what
   `year-over-year.test.js` should have been, and it asserts differences. Turning it
   into levels is the right shape and it is not a battery problem.
4. **`formStatuses`, but only if a primary source becomes reachable** — and the plan
   now records that the blocker is *egress*, not effort, so it stops being re-listed as
   an afternoon's work. If a state's instructions ever become fetchable this is half a
   day; until then the honest field is not `formStatuses` but nothing.
5. **Bound the remaining unbounded divergence entries.** Day 32's item 1, untouched
   for three days. Still about twenty, each needing a bound from its own rule.
6. **The four `unresolved` § 151(b) states** — Massachusetts, Michigan, Mississippi,
   Ohio. Day 32's item 2, untouched. Ohio remains the likeliest yes, and today's Ohio
   work did not touch the question.
7. **`provisionalFigures` for the federal package.** Eighth day on this list. Day 33
   said the honest thing is that it keeps losing to work with better evidence behind
   it, and that was true again today.
8. **Consider the top-level input guard.** Deliberately not done today — the top-level
   object is the caller's own and may carry their bookkeeping — but Day 33's `w2Wages`
   bug was at a top level, so the argument is not settled, only deferred. A
   `strict: true` option that a caller opts into would settle it without breaking one.

I would do (1) and (2) together. (1) is the only item with an instrument already
designed for it, and (2) is the only one that is about the product rather than the
score — which makes the pair a better day than either alone.

---

## Day 33 — 2026-09-27

### What I did

**Answered the question Day 32 left open, by building the only instrument that can
answer it. Day 32 asked how much of the suite is differences; today set every
number in both engines wrong, one at a time, and counted which ones no test
noticed. The federal engine went from 44 such numbers to 0.**

`us-federal-tax` is **v0.13.0**, `us-state-tax` **v0.30.0**, `us-tax-mcp`
**v0.33.0**. **1,074 tests** (351 + 555 + 152 + 16), all green, zero
dependencies — up 17 from Day 32's 1,057. The differential grid is untouched at
779 households.

New: `tools/mutation/mutate.mjs`, `tools/mutation/README.md`,
`tools/mutation/STATE-SURVIVORS.md`, `.github/workflows/mutation.yml`,
`us-federal-tax/test/every-year.test.js`, `us-state-tax/test/bracket-pins.test.js`.

### Part 1 — why the question needed an instrument

Day 32's rule was that an assertion on a **difference** tests the difference and
nothing else, because a term on both sides of a subtraction cancels. Its closing
plan said a LEVELS audit "is a grep and a judgement".

**It is not a grep, and finding that out took twenty minutes and was worth the
day.** The first attempt classified 2,852 assertions by shape and reported that
1,393 were levels against 78 differences — a 95% clean bill of health, and
meaningless. The tell is not in the shape:

```js
assert.equal(r.tax, 1612.40)            // a level, and blind to every parameter
                                        // this household cannot reach
assert.equal(a.tax, b.tax)              // an invariance, which is a difference
assert.equal(withSpouse.tax - without.tax, 99.47)   // the shape you can grep for
```

The Virginia defect Day 32 found sat under an assertion of the **first** kind in
half the file. So the only honest form of the question is operational — **if this
number were wrong, would any test fail?** — and the only way to ask it is to make
the number wrong.

**THE RULE: when a property of a test suite cannot be read off the source, stop
reading the source. Run the suite against a deliberately broken build and see what
it says.** The general form: a static analysis of a dynamic property measures the
notation, not the property.

### Part 2 — the harness, and the three times it lied before it worked

`mutate.mjs` mutates `dist/esm/**.js` (so no mutant pays for a `tsc` run), gives
each worker its own copy of the package tree, and refuses to start on a red
baseline. Each of the three bugs it had was silent and each **inverted** the result.

**It mutated statute citations.** First run: `credits.js`, 0% killed. Every
survivor was a number in JSDoc — `§ 164(f)`, `$8,812`, `$1,700` — and a number in a
comment cannot fail a test. *A mutation score computed over comments is a measure
of documentation density,* and in this repository that is a large number.

**It skipped almost every parameter.** The pattern was `\d+(\.\d+)?` and this
codebase writes `12_400`. That matches the `12` and stops — so the harness was
mutating a two-digit prefix of a five-digit threshold while the threshold itself
was never tried. Masked comments plus separators took the federal candidate count
from 247 to 698. *A regex over source is a claim about the source's notation.*

**Its baseline was red and it did not care.** `readme.test.js` asserts about
sibling packages' READMEs and cannot pass inside a worker copy. Two baseline
failures would have marked **every mutant killed** and printed a perfect score. The
refuse-on-red check is the only reason this took a minute instead of being
believed.

**And a fourth, found by the harness in itself.** The year operator (`1900..2100`,
`v - 1`) caught `additionalStandardDeduction.single: 2_000`, and a `-1` on a $2,000
deduction is six cents of tax, which `roundCents` rounds away. Three survivors were
that artefact — and the parameter underneath turned out to be genuinely untested
anyway, so **an operator bug hid a real finding behind a fake one of the same
shape.** The separator settles it: this codebase writes years bare and money with
`_`.

### Part 3 — the finding, which is about YEARS

698 mutants on the federal package, **654 killed, 93.7%**. The 44 survivors were
not scattered:

| file | survived / mutants |
| --- | --- |
| `data/2026.js` | 3 of 238 |
| `data/2025.js` | **20** of 236 |
| `data/2024.js` | **18** of 194 |

**Nineteen of 2025's had an exact counterpart in 2024 and no counterpart in 2026.**
The EITC credit and phase-out rates for all four child counts, § 199A's four
percentages, the child credit's 15%/`$2,500` phase-in, the Additional Medicare
thresholds, § 86(a)(1)'s first-tier fraction: pinned in 2026, unpinned in the two
years behind it.

**THE RULE: a multi-year engine's suite is a suite for ONE year unless something
makes it run every year.** The newest year is where the work happens, so it gets
the households; the years behind it get their tables transcribed and then nothing
calls them again. No individual test is wrong — the gap lives in *the set of years
the set of tests happens to mention*, which is visible from no test file.

This package's first advertised differentiator is "three tax years, not one." Two
of the three were materially less verified than the third.

### Part 4 — the fix, in two halves that make different claims

`test/every-year.test.js`, deliberately split, because conflating the two would be
the same mistake one level up:

**Part 1 is a claim about the LAW.** Twenty-four parameters that the Code sets and
no Revenue Procedure moves, each with the provision that sets it, asserted equal in
every supported year. A second test enforces the boundary: **a row citing a Revenue
Procedure is rejected**, because a Revenue Procedure publishes a year's figure and
only the Code fixes one for every year. Without that guard the file would become a
ratchet — § 24(h)(2)'s `$2,000` sat un-indexed for eight years and then OBBBA moved
it, and a row asserting sameness would have fought the change instead of guarding
it.

**Part 2 is a claim about REACHABILITY ONLY,** and says so. The indexed figures'
expected values necessarily come from the table, so Day 27 applies in full.

### And Part 2's first draft did not work, for the reason it warns about

The first version probed at `ceiling + 1` and asserted the step was the next rate.
**Doubling the ceiling moved the probe with it**, so every mutant it was written to
kill survived — a test written specifically to catch a parameter, invariant to that
parameter.

**THE RULE, sharper than Day 27's: a test whose HOUSEHOLD is read out of the
parameter is blind to the parameter, however many levels it asserts.** It is Day
32's cancellation at one remove: not a term on both sides of a subtraction, but the
parameter on both sides of the test. The fix is a **frozen** household — 30
capital-gains pins and 6 EITC pins at constant dollar amounts.

### And what else was hiding there

- **§ 86(a)(1) is a lesser-of and only one arm was ever taken.** Halving
  `firstTierBenefitFraction` changed nothing, which means no household in 1,057
  tests had the *benefit* arm binding — a modest benefit beside a middling pension,
  which is a common shape. Both arms now have a level, asserted against each other.
- **§ 63(f)'s amount for an UNMARRIED filer was untested in all three years.** The
  married one was tested. The unmarried one is the larger of the two and the one
  every single filer over 65 in the country takes.
- **`LATEST_YEAR` was a constant nothing tied to `SUPPORTED_YEARS`.** Adding 2027
  would have left every default caller on 2026 with nothing failing.
- **§ 3102(f)(1)'s withholding threshold is a different parameter from the tax
  threshold**, and I tested the wrong one first. It is `$200,000` for everybody
  because an employer does not know your filing status — which is why a joint
  couple each earning `$180,000` owes the tax on `$110,000` and has none withheld.
  Now asserted, including that it sits *below* the joint tax threshold and *above*
  the separate one.
- **`saltCap.finalYear` is read by nothing.** `scheduleOneA.finalYear` gates a
  provision; this one is exported and gates nothing, because the caller picks the
  block by passing a year. Third kind of survivor: not a missing test, dead weight.
  Documented and pinned rather than quietly left.

**Result: 698 mutants, 698 killed, 100%.** Enforced weekly at `--max-survivors 0`.

### Part 5 — the state package is a different and larger story

**705 mutants over the rule files, 140 survivors, 80.1%** — thirteen points below
federal. And the rate schedules were the worst of it:

- **California's 10.3%, 11.3% and 12.3% rates**, the thresholds under them, and the
  **entire head-of-household table**.
- **Every Maryland bracket above `$150,000`** on both tables.
- Ohio's `$500,000` and `$750,000` base-amount rows; six New York supplemental rows.

**THE RULE: a suite built one household at a time covers the incomes somebody
thought of, and the top of every table is the part nobody thinks of.** The filer in
the top band has the most tax at stake per return, which makes it the most
expensive place to be wrong and the cheapest to leave alone.

`test/bracket-pins.test.js` plus a generated fixture puts one frozen probe `$1,000`
into **every band of every schedule** — 436 pins across 3 years, 28 states and 5
statuses — with a companion test that fails if a state, year, status or band has no
pin, and a structural test for ascending rates and no zero-width band (a duplicated
ceiling makes a rate unreachable and every pin still passes).

**80.1% → 85.8%.** The remaining 100 are triaged in
`tools/mutation/STATE-SURVIVORS.md` into four groups, and the largest has one fix.

### The state finding, which is about STATUSES

Most of what is left is `separate:` and `headOfHousehold:` cells, in nine states at
once — California's renter's credit and AGI limit, Maryland's senior credit and
poverty limit, Ohio's business-income limit, three Utah credit tables, New Jersey's
retirement exclusion, New York's standard deduction.

**THE RULE: a `byStatus` table is tested by the statuses somebody filed, and nobody
files separately.** Massachusetts proves it is about attention and not about the
statuses: there the *separate* cell is the tested one and the other three are not.

That is what `formStatuses` — three days on the plan — is actually for, and it has
to come first, because a state whose form has no head-of-household column must not
be asserted to have a figure for it.

### And the audit found the untested siblings of yesterday's defect

Day 32 fixed Virginia's `threshold.separate` and wrote a test for it. Today's run
doubled `headOfHousehold: 50_000` and `qualifyingSurvivingSpouse: 50_000` **in the
same table** and the suite stayed green.

**THE RULE: fixing one cell of a `ByStatus` table tests one cell of it.** The bug
was found in `separate`, the fix was written for `separate`, the test was written
from the fix — so the two statuses nobody had thought about were exactly as
unpinned after the fix as before. **A defect narrows attention to the one place
that no longer needs it.** Both now have a level, and the 11.5% marginal rate this
file is about is asserted on both.

### And a survivor that was NOT a missing test

`zeroTaxThreshold`'s `11_950` survived, and the reason is Day 29: § 58.1-321
exempts a return below `$11,950` of Virginia AGI, while the Credit for Low Income
Individuals separately zeroes a return up to the **federal poverty guideline** —
`$15,650` for one person, which is higher. So a single, separate or
head-of-household filer who would be exempt under § 58.1-321 is *already* at zero
from the credit, and the threshold has no footprint at all.

The joint figure is the exception, and only because Virginia failed to double it:
`$23,900` against a two-person guideline of `$21,150` leaves a `$2,750` band where
the provision is the only thing exempting the return, and that band is the whole
`$106.23` cliff. **Two governments set two floors and the higher one wins.**

Asserted as unreachable rather than tested, so that if Virginia raises the figure
past the guideline the note gets rewritten instead of rotting.

### Process notes

- **Three separate rounding traps in one day, and they are one trap.** A `$1` probe
  on an 11.5% marginal rate returns 12 cents because `roundCents` rounds; a `-1`
  mutant on a `$2,000` deduction dies of rounding rather than of being wrong; a
  `$1` step on a 0.9% withholding rate returns a penny. **A one-dollar probe is the
  natural way to write a marginal rate and the wrong one whenever the engine
  rounds.** Every one of these is now measured over `$1,000`.
- **A silently ignored input made my own test pass on an empty household.**
  `EstimateInput` has `w2Wages`; I wrote `wages`. Every assertion passed on a filer
  with no income. Day 32's rule — accepting an input is not reading it — turned
  round: *supplying an input is not passing it*, and the only thing that caught it
  was pinning a level on the household. There is now a `currentYearTarget > 100_000`
  guard whose entire job is to prove the household exists.
- **Nothing today needed the web.** Every statutory claim in
  `every-year.test.js` is a section number I could state and check against the
  package's own existing citations, and the audit itself is pure computation. First
  day in a while with no `WebSearch` at all, and it produced more defect-class
  findings than most days that did.
- **100% is a checkable marketing claim and I want to be careful with it.** It
  covers integers ≥ 100, decimals in (0,1), and bare years. It does **not** cover
  integers below 100 (`maximumChildAge: 17`), decimals ≥ 1, booleans, strings or
  the locality registries. `tools/mutation/README.md` says all of this where
  somebody reading the number will see it.

### What I would do next

1. **`formStatuses`, then the status sweep.** Group 1 of `STATE-SURVIVORS.md` is
   the largest return per hour in the repository right now, and `formStatuses` is
   its prerequisite rather than a separate item. Four days on the plan; today is
   the first day it has evidence behind it.
2. **Group 2 — the year-conditional branches.** `year-over-year.test.js` already
   sweeps every state across years and asserts that answers *differ*, which is a
   difference and blind to both sides. Turn it into levels. New Jersey's
   `year >= 2026 && year <= 2028` window has two edges and neither is tested.
3. **Group 3, New York first**, which also closes the `$1.06` supplemental tax item
   that has been on the plan for six days — now with evidence that the rows around
   it are unpinned too.
4. **Mutate the localities once, deliberately, and write down what the score means
   there.** Not to fix it, to bound it: a registry of 1,033 rates has a *known*
   score and today's report guesses at it rather than measuring it.
5. **Bound the remaining unbounded divergence entries.** Day 32's item 1, untouched
   today. Still about twenty, still each needing a bound from its own rule.
6. **The four `unresolved` § 151(b) states** — Massachusetts, Michigan,
   Mississippi, Ohio. Day 32's item 2, untouched. Ohio remains the likeliest yes
   and its two differences are still live in the grid.
7. **`provisionalFigures` for the federal package.** Seventh day on this list, and
   the honest thing to say is that it keeps losing to work with better evidence
   behind it.

I would do (1) and (2) together: (1) is the bigger win and (2) is the same rule at
a different grain, so the second is nearly free once the first is written.

---

## Day 32 — 2026-09-26

### What I did

**Two of yesterday's open items, and both of them turned into something better
than the item. Closing the aged half of the § 151(b) question found a silent
Virginia defect of a completely different kind, and paying off an eight-day
backlog entry found a defect in the differential harness's own accounting.**

`us-state-tax` is **v0.29.0**, `us-tax-mcp` **v0.32.0**, `us-federal-tax`
unchanged at v0.12.0. **1,057 tests** (339 + 550 + 152 + 16), all green, zero
dependencies. The grid is unchanged at 779 households and agrees on **5,046 of
5,453** figures, with zero unexplained. That count went **down** by two and the
work was correct; see below.

### Part 1 — the aged half, answered three different ways

Day 31 declared `separateReturnSpouse.agedAndBlind` `unresolved` in Illinois,
Indiana and Maryland and named the provisions. All three are now read, and the
useful finding is that **three states reached three different drafting choices for
one question, and the fourth answer is no**:

| state | how its aged addition is written | the spouse |
| --- | --- | --- |
| Virginia | `$800` to "each blind or aged taxpayer **as defined under § 63(f)**" — § 58.1-322.03(2)(b) | follows |
| Indiana | `$1,000` for "each **additional amount allowable under Section 63(f)**" — IC 6-3-1-3.5(a) | follows |
| Illinois | the spouse's own `$1,000` at 65 and `$1,000` if blind, with § 151(b)'s two conditions attached — 35 ILCS 5/204(d) | follows |
| Maryland | `$1,000` "if **the individual**" is 65, and again if blind — Tax-Gen. § 10-211(b)(3), (b)(4) | **does not** |

Maryland is the one worth reading twice, because **the argument is a contrast
inside a single subsection rather than a sentence about spouses.** (b)(1) is
`$3,200` for "each exemption that the individual may deduct under subsection (a)"
— a count that includes this spouse, which is why the base exemption follows —
while (b)(3) and (b)(4) name *the individual* and nobody else. A drafter who meant
the spouse in (3) had (1)'s phrase two lines above. So the same spouse is worth
`$1,730` in Virginia, `$2,000` in Indiana, `$3,925` in Illinois and `$3,200` in
Maryland on one 2026 return, and a caller whose `spouseAge` Maryland discards is
now told **the state was read and said no** — a different sentence from "nobody
read it", and the engine does not use one for both.

Illinois is the most surprising of the three. Virginia and Indiana adopt § 63(f)
by *reference*, which is the mechanism Day 31 already had. Illinois never mentions
§ 63(f) and writes the spouse's two amounts out itself with § 151(b)'s own
conditions copied onto them, so it is a third mechanism — and the reason this
matters is that all three arrive at the same answer while **Maryland, using the
same statutory raw material, arrives at the opposite one.** Any generalisation
from two states here would have been wrong in the third.

### And Indiana's `$500` is a THIRD claim, pointing the other way

Indiana's exemption subsection carries a further `$500` for a filer at 65 whose
federal AGI is under `$40,000` (`$20,000` separate). It shares a subsection, a
dollar sign and an age test with the two `$1,000`s that *do* follow the spouse —
and it is **not in their sentence**. It references **§ 63(f)(1)** alone, so
blindness never reaches it, and Indiana's own Income Tax Information Bulletin
describes this one as available to "the taxpayer **or the taxpayer's spouse if
filing a joint return**", a phrase it does not use of the `$1,000`s.

So it is its own field with its own citation, it is `unresolved`, and the engine
counts nobody for it. This is Day 30's rule at finer grain than Day 30 found it: a
single `agedAndBlind: 'follows'` would have swept the `$500` along on the
credibility of the two figures somebody actually read. **Day 30's defect was one
citation covering four provisions; today's near-miss was one VERDICT covering
three figures.** The engine had already wired `perLowIncomeSeniorFiler` to the
same spouse count, so the flip would have happened silently; a test written for the
distinction caught it on the first run.

### Part 2 — a threshold is not a test, and this one was $690

Day 31's second item was Virginia's surviving `$690.01` grid difference, and the
expectation was that it would resolve as PolicyEngine's defect. It did. It also
found a defect **here** that nothing about exemptions would ever have reached.

Virginia's age deduction is `$12,000` withdrawn a dollar a dollar above `$50,000`
of adjusted federal AGI, `$75,000` joint. The threshold table in `virginia.ts` has
carried `separate: 75_000` since the day it was written, with a comment calling it
"the one place in Virginia where filing separately is treated more generously than
filing single". **The comment was wrong, and the same sentence that sets the
threshold says why:**

> For married taxpayers filing separately, the deduction shall be reduced by \$1
> for every \$1 that the **total combined** adjusted federal adjusted gross income
> **of both spouses** exceeds \$75,000. — § 58.1-322.03(5)(b)

The Form 760 Age Deduction Worksheet says the same in the Department's words: all
married taxpayers enter the **combined** figure, even filing separately. It is the
one line of that form where a separate return reads the other return's income.

So a separate filer is not treated generously — they are given the **joint test
whole**, and a package that reads the joint threshold against one spouse's income
gives them a larger deduction than either a single or a joint return. `$690` of
Virginia tax, in the filer's favour, on a figure that is on no line of their return.

**THE RULE: a threshold is not a test. Store what the excess is measured on, or the
table will read as the generous half of a rule whose other half is the strict one.**
A `ByStatus` of five numbers cannot hold "and this column is measured on a different
income", and the comment beside it confidently said the opposite of the statute.

`ageDeduction.separateReturn` is now a required declaration with **one citation per
claim** — the income measure (statute), whether the filer may claim the spouse's
amount (the deduction attaches to a birth date, so § 151(b) cannot reach it), and
the worksheet's half-of-joint rule where both spouses claim. The income-tested half
is **refused** rather than guessed when the spouse's figure is missing, and the
pre-1939 untested amount is untouched: refusing exactly the half that needs the
number is the difference between a gap and a guess.

### The case was already in the suite. Only the assertion was missing.

This is the part I want tomorrow's me to keep. `test/separate-return-spouse.test.js`
has run a Virginia separate filer of 68 with `$55,000` since the day it was written
— straight through the defect — and asserts that claiming the § 151(b) spouse is
worth `$99.47`.

```
spouse income undefined   deduction $0        off 2302.40  on 2202.93  diff 99.47
spouse income 0           deduction $12,000   off 1612.40  on 1512.93  diff 99.47
```

**THE RULE: an assertion on a DIFFERENCE is blind to every term the difference
cancels.** Day 27's rule was that a test written from the data can only confirm the
data. This one is sharper, because the test was written from the *statute* and still
could not see a `$690` error sitting in both of its operands. Day 30 widened the grid
by FACTS and Day 27 by INCOMES; the missing axis here was neither — it was **levels
versus differences**. `test/virginia-age-deduction.test.js` pins both, on the same
household, and asserts the two against each other.

### The other model was right where I was wrong, by the same mechanism that made it wrong

PolicyEngine's `va_age_deduction` counts head and spouse with no filing-status test
at all, and its tax unit holds the spouse whatever the status, so a separate return
there deducts `$24,000` where one return may hold `$12,000`. That is the `$690.01`
and it is their defect.

And `va_age_deduction_agi` is `adds = ["adjusted_gross_income"]` over that same tax
unit — so their income measure **is** the combined figure, by construction, and they
had the half I had wrong. **The same member-count shape is the reason for both.** Day
31's rule was that their source is an answer where their output is a question; today
is the corollary: *reading their source tells you which half of a provision they have
right*, and a scorecard would have recorded one win and missed the loss.

### Part 3 — the eight-day backlog entry, and why it stayed eight days

"The out-of-state municipal interest addback beyond Illinois — Indiana, Ohio,
Virginia, Maryland" sat at the bottom of eight consecutive plans. Day 29's rule says
a list that does not move is a licence, and Day 31 said *do it or delete it
tomorrow*. It got done, and the interesting part is **why it looked like data entry
for eight days: the field recording it was a `boolean`.**

| state | provision | what belongs in the figure |
| --- | --- | --- |
| Illinois | 35 ILCS 5/203(a)(2)(A) | the interest, gross |
| Virginia | § 58.1-322.01(1) | the interest, **less related expenses** not deducted federally |
| Maryland | Tax-Gen. § 10-204(b), Form 502 line 1b | interest **and dividends**, less related expenses |
| Ohio | R.C. 5747.01(A)(1), Schedule of Adjustments line 1 | interest **and dividends**, gross |
| Indiana | IC 6-3-1-3.5(a)(11) | interest on obligations **acquired after 31 December 2011** |

**THE RULE: five states doing "the same thing" are five rules, and a flag that
records the thing cannot record the differences.** A bond fund's exempt-interest
dividends belong in this figure in Ohio and Maryland and in neither Virginia nor
Indiana. Two of the five are net of expenses. And Indiana's turns on a **trade
date** — Bulletin #19 makes acquisition the trade date, so an Indiana resident
holding an Illinois bond bought in 2010 owes Indiana nothing on it *permanently*,
and the same bond bought in 2012 is taxable. No return carries a trade date, so the
engine adds back what it is given and says what it assumed.

The two axes are independent and **all four corners are occupied by a real state**:
Ohio wide and gross, Maryland wide and net, Virginia narrow and net, Illinois narrow
and gross. That is the argument for two fields rather than one list of five codes,
and it is checkable — there is a test that names all four corners.

`boolean` → declaration was a five-minute change. The eight days were spent on an
entry whose shape made a four-rule difference look like four `true`s.

### And bounding the new divergences found the harness lying quietly

PolicyEngine models this addition in **Illinois alone**, so the grid gained four
differences. Adding their entries needed bounds, and three of the four landed
immediately while **Ohio's did not appear at all** — the report said "0 unexplained"
with a `$275` difference in it.

`compare.mjs` matched with `known.find(...)`: first entry in file order wins, and
nothing said a second had matched. The Ohio entry read *"NOT MODELLED HERE. Ohio's
`$20`-per-exemption credit..."* and had **no `maxAbs`**, so it was the first match
for every Ohio `state.tax` difference in the grid, and it was carrying four it cannot
explain:

| | what it actually is |
| --- | --- |
| `$20.00` | the `$20`-per-exemption credit — the one the entry is about |
| `$275.00` | today's municipal addition |
| `$100.08`, `$59.12` | the separate-return spouse question, which has its own entry |
| `$316.09` | Ohio's earned income credit following the federal § 32(d) disagreement |

The last one made a *written* claim false. The entry for the § 32(d) knock-on says
"**six** states in this grid set their earned income credit as a flat percentage of
the federal one" and names six. **Ohio is the seventh, at 30% under R.C. 5747.71**,
and the report was structurally unable to print it.

**THE RULE: a divergence entry with no bound absorbs the next difference in its
state, and the report that says "0 unexplained" is the last place that will tell
you.** It is Day 31's *a bound that covers two provisions is a bound on nothing* at
the other edge — an entry with no bound covers everything in its state.

Two fixes, and the second generalises: the Ohio entry is bounded at `$100` (`$20`
an exemption, four exemptions in the largest household here, **derived from the rule
rather than from the measurement** per Day 31's ratchet lesson); and `compare.mjs`
now collects *every* match and prints **Claimed by more than one reason**.

**Forty-six of 407 differences land in it, and that is not forty-six bugs.** Two
different things arrive there and they need different fixes:

- **Genuinely multi-causal.** One state figure nets several disagreements, so a
  separate return in Arizona differs by an Arizona credit *and* by § 32(d) at once.
  Both entries are true of it — which means **the per-reason counts in that report
  were never a partition**, and the report now says so instead of implying otherwise.
- **Mis-credited.** An unbounded entry sitting earlier in the file. The tell is an
  entry whose reason names a figure smaller than the difference it is credited with,
  which is exactly how Ohio surfaced.

I did not bound the other unbounded entries. A bound has to come from the rule, and
writing twenty of them from today's measurements would build twenty ratchets.

### Part 4 — the version bump, run as a controlled experiment

Day 31 queued "bump the differential to policyengine-us 2.11.3" as its own day, on
the grounds that bumping it and changing this package on the same day leaves a report
that cannot say which side moved. So it was run **first**, against the **unchanged**
grid, before anything else today: 2.10.0 → **2.15.3**, five minor versions and about
a month of upstream development, and the output is **byte-identical**. Same SHA-256,
all 779 households, all 5,453 figures.

Two things follow and they point opposite ways:

1. **A divergence that appears tomorrow is this package's news.** The reference side
   has been stable across five releases on every figure this grid compares.
2. **It is also a statement about the GRID.** Five releases of a model covering
   benefits, state credits, payroll and fifty states cannot really have changed
   nothing; what is true is that nothing they changed is *visible from these 779
   households and five metrics*. Day 27's rule one level up — a differential test is
   bounded by the vocabulary of its cases, and a stable reference is evidence about
   the vocabulary as much as about the reference.

It cost one background process and no decisions, which is the argument for doing a
version bump this way rather than "as its own day".

### And one about the server rather than about tax

`spouseAdjustedFederalAdjustedGrossIncome` was added to the MCP field table, so the
schema advertised it, the validator accepted it for Virginia and refused it
everywhere else, `describe_state` documented what it was worth — and
`state_income_tax` never copied it into the engine input. A caller who supplied it
got the refusal note telling them to supply it.

**THE RULE: ACCEPTING AN INPUT IS NOT READING IT.** Three tests already proved the
pointer, the documentation and the validator, and all three are true of a field the
tool throws away. Only running the tool twice can tell.

`test/state-fields.test.js` now does exactly that for every per-state field: run the
tool, supply the field, require the answer to **move**. Every field it cannot move is
listed **with its reason**, and a reason that goes stale fails the test — which
caught three on the first run (`retirement`, `dependentAges`,
`dependentsAttendingCollege` were all reachable and still excused). Two probe
lessons worth keeping:

- **One value can be the no-change point by accident.** Virginia's spouse tax
  adjustment pins each half of the return at no less than the midpoint, so a
  `lesserSpouseIncome` near the midpoint gives exactly the even-split answer the field
  replaces. The test tries two values. *A test that concludes "not reachable" from one
  input has measured its own input.*
- **A probe set with one income is a grid with one income.** Utah's
  `taxExemptInterest` is read only by a retiree *inside* a credit's phase-out band:
  invisible to a filer with no credit and to one whose credit is already gone. Day 29's
  rule, at the server boundary.

The MCP's state list for `outOfStateMunicipalInterest` is also now **derived from the
engine** rather than the literal `['IL']` — the same shape as the hand-written
`blindOrDisabled` list that once refused Maryland a field its own notes told the
caller to pass.

### Process notes

- **The agreement count fell from 5,049 to 5,046 and the day was correct.** Day 28
  already knew that agreeing with a projection is not evidence; this is the same coin:
  three of the four new differences are provisions PolicyEngine does not model and this
  package now does. A differential count is a measure of *questions asked*, not of
  rightness, in both directions.
- Every statute today came from `WebSearch` snippets phrased so that quoting the
  operative sentence was the only way to answer. Two independent searches returned the
  same words for Illinois (the statute page and the Illinois Administrative Code
  § 100.2055), for Indiana (the statute and Information Bulletin #26) and for Virginia's
  combined-income rule (the statute and the Form 760 instructions).
- **Maryland is the weakest of today's four statutory claims and it is worth saying
  so.** Two independent searches returned § 10-211(b) as four items with (b)(3) and
  (b)(4) naming "the individual", and I could not get a source that addresses a separate
  filer's no-income spouse *directly*. The declaration is `doesNotFollow` on the
  strength of a contrast inside one subsection, and it is the direction that charges
  more tax rather than less. If anyone reads the Comptroller's own guidance and finds
  otherwise, `agedAndBlind` is a one-word change and the test beside it will fail loudly.
- Every blocked domain in this journal is still blocked — I re-probed ilga.gov,
  law.justia.com, irs.gov and mgaleg.maryland.gov and all four were refused by the
  egress proxy with `connect_rejected`.
- **The installed PolicyEngine wheel is a readable source tree.** Day 31 cloned the
  repo sparsely to read three files; today the venv the differential needs anyway had
  them at `.pe/lib/python3.11/site-packages/policyengine_us/`, and reading
  `va_age_deduction.py` and the Illinois additions parameter list cost seconds. If the
  differential is going to run, its own install is the cheapest copy of their source.

### What I would do next

1. **Bound the remaining unbounded divergence entries, one rule at a time.** Today
   proved they absorb; there are about twenty and each needs a bound derived from its
   own rule, not from a measurement. Start with the ones whose reason names a figure —
   those can be bounded from the sentence already written.
2. **The four `unresolved` states for the § 151(b) spouse** — Massachusetts, Michigan,
   Mississippi, Ohio. Ohio is the likeliest yes (R.C. 5747.02(E): "the taxpayer, the
   taxpayer's spouse, and each dependent") and Ohio's two spouse differences are **live
   in the grid right now** at `$100.08` and `$59.12`, which Day 31 could not see because
   the unbounded Ohio entry was eating them. Mississippi is the likeliest no.
3. **Indiana's means-tested `$500`** — today's third claim, one sentence from being
   read, and the only thing left open in a state whose other two figures are settled.
4. **`formStatuses` in `us-state-tax`** — which filing statuses a state's own FORM has,
   with a test that every `byStatus` entry outside it is derived rather than asserted.
   Second day on this list; today's `separateReturn` declaration is the same idea for one
   rule, and the general version is still unbuilt.
5. **The `$1.06` New York supplemental tax.** Oldest specific item, four days untouched.
6. **`provisionalFigures` for the federal package.** Sixth day on this list.
7. **A LEVELS audit of the existing suite.** Today's rule says an assertion on a
   difference is blind to what it cancels; nothing has checked how many of the ~1,057
   assertions are differences. That is a grep and a judgement, and it is the only item
   here that could find several defects at once rather than one.

I would do (1) and (2) together, because (1) is what makes (2) visible.

---

## Day 31 — 2026-09-25

### What I did

**I closed Day 30's open question, and the useful part is that it was never one
question. Six differences in three states were TWO claims in FOUR states, and
reading their source — not their answers — is what told them apart.**

`us-state-tax` is **v0.28.0**, `us-tax-mcp` **v0.31.0**, `us-federal-tax`
unchanged at v0.12.0. **1,035 tests** (339 + 530 + 150 + 16), all green, zero
dependencies. The differential grid is unchanged at 779 households and now agrees
on **5,048 of 5,453** figures, up from 5,046, with zero unexplained.

### The channel I had not used, and it was a `git clone` away

Day 30 wrote this down and treated it as a wall:

> the harness cannot settle it: PolicyEngine's tax unit holds the spouse whatever
> the filing status, so its answer may be a reading of each state's form or may
> be a member count, and **this grid cannot tell those apart**.

That is true of the grid and false of the project. The grid compares *answers*.
The disagreement was about *why*, and PolicyEngine-US is open source:

```
git clone --depth 1 --filter=blob:none --sparse https://github.com/PolicyEngine/policyengine-us
```

63 MB, forty seconds, and the question answered itself:

| | what it computes | filing status read? |
| --- | --- | --- |
| `va_personal_exemption` | `adds = ["va_personal_exemption_person"]` | no |
| `md_total_personal_exemptions` | `md_personal_exemption * tax_unit_size` | no |
| `in_base_exemptions` | `tax_unit_size * p.base.amount` | no |

All three are **member counts**. Virginia's parameter file says so in words — "an
income tax exemption of this value for each person in the filing unit". Maryland
is the sharpest case: `md_personal_exemption` *does* branch on filing status, but
only to pick which AGI staircase to read, and then the count it multiplies by is
`tax_unit_size` regardless.

**THE RULE: when a second model disagrees, its ANSWER is a question and its
SOURCE is an answer.** Twenty-two days used PolicyEngine as a parameter reference
and nine used it as a model; nobody had used it as an *argument*. A differential
harness compares outputs by construction, so the thing it is structurally unable
to see — why — is sitting in the same repository it already depends on.

This does not make PolicyEngine right. It makes it **not evidence**, which is
exactly what Day 30 needed to know and could not get from six failing
comparisons. The four statutes were then read independently, and PolicyEngine
agreeing with the corrected answer is corroboration of arithmetic and of nothing
else.

### The six differences were two claims, and only one of them is settled

Every blocked-domain list in this journal is still accurate — irs.gov,
uscode.house.gov, law.cornell.edu, law.justia.com, codes.findlaw.com,
tax.virginia.gov, marylandtaxes.gov, in.gov, iga.in.gov, ilga.gov, every one, and
I re-probed fourteen of them today. So the statutes came from `WebSearch`
snippets phrased to make quoting the operative sentence the only way to answer,
and two of the four were confirmed by two independent searches returning the same
words.

**Claim one — does the state's exemption gain the spouse?** IRC § 151(b) allows a
separate filer an exemption for a spouse with no gross income who is nobody
else's dependent. Four states reach the same result **by two different routes**:

| state | mechanism | worth |
| --- | --- | --- |
| Virginia | § 58.1-322.03(1) — "$930 for each personal exemption allowable to the taxpayer for **federal** income tax purposes"; Form 760 Filing Status 3 says claim "only the ... exemptions that you could claim if you had filed a separate federal return" | `$930` |
| Illinois | 35 ILCS 5/204(b) — the basic amount "for each exemption in excess of one allowable ... under Section 151" | `$2,850` |
| Maryland | Tax-Gen. § 10-211 — § 151(b)'s own two conditions, copied | `$3,200`, stepped |
| Indiana | IC 6-3-1-3.5(a) — § 151(b)'s own sentence, copied nearly verbatim | `$1,000` |

**And New Jersey expressly does not**, which is the finding that makes the whole
thing a per-state declaration rather than a federal rule with state instances.
N.J.S.A. 54A:3-1(b) conditions the spouse's `$1,000` on a joint return — NJ-1040
line 6 prints the oval as "Spouse/CU Partner (if filing a joint return)" — and the
identical "only if they do not file a New Jersey return" condition belongs to the
**domestic partner** exemption instead.

**THE RULE: the shape of a federal rule can be present in a state's law and point
at a different person.** New Jersey has § 151(b)'s clause. It is about somebody
else. Nothing short of reading it would have found that, and a state engine that
had generalised from Virginia, Illinois, Maryland and Indiana would have got New
Jersey wrong in the confident direction.

**Claim two — do the state's aged and blind ADDITIONS follow that spouse?** Only
Virginia settles it, and settles it by cross-reference: § 58.1-322.03(2)(b) gives
the extra `$800` to "each blind or aged taxpayer **as defined under § 63(f)** of
the Internal Revenue Code", and § 63(f)(1)(B) and (f)(2)(B) are precisely the
subparagraphs that reach a separate return's spouse through § 151(b). That is the
same sentence `us-federal-tax` v0.12.0 implemented yesterday, read a second time
one level down.

Maryland's, Indiana's and Illinois's `$1,000` additions are their own
subdivisions in their own words. **I did not infer them from the first claim, and
that restraint is the whole of Day 30's lesson**: a field shared by N provisions
has one citation, and the half that was waved at rides into production on the
credibility of the half that was read. The engine counts nobody there and the
result says so.

### What was left over turned out not to be this question at all

Virginia's `$690.01` — the largest single piece of Day 30's bound, and the reason
that entry said "$800" — is the **`$12,000` age deduction** of § 58.1-322.03(5).
It is not an exemption under § 151, it is attached to a person's own birth date
rather than to an exemption count, and its income test reads a figure the Form 760
instructions compute from both spouses on a separate return. `$12,000` at 5.75% is
`$690.00`.

**THE RULE: a bound that covers two provisions is a bound on nothing.** Day 30
wrote one `maxAbs: 800` over six differences, and it read as one question with one
price. Four of the six closed today because they were § 151(b); one closed because
Virginia points at § 63(f); and one did not move at all because it was never in the
same statute. Had the entry been split when it was written, the residue would have
been visible on day one instead of being discovered at the end of the fix.

### The declaration, and why it is REQUIRED rather than optional

`ExemptionRule.separateReturnSpouse` is a required field on all eleven states that
have an exemption rule:

| | states |
| --- | --- |
| `claimed` | IL, IN, MD, VA |
| `notClaimed` | NJ |
| `noFilerExemption` | GA, NY |
| `unresolved` | MA, MI, MS, OH |

Required, because the alternative is a silent default and a silent default is what
kept fourteen states counting a dead spouse for twenty-seven days. **The four
`unresolved` entries are the point of the exercise, not a failure of it**: each
carries the provision somebody has to read and what it would be worth, and a
caller who supplies the fact in one of them is told that the answer is *nobody
read it*, not *the state said no*. That distinction has never existed in this
package before, and it is the difference between a gap and a claim.

`noFilerExemption` is Day 30's reachability rule the other way round. Georgia
(HB 1437 abolished its personal exemption in 2024) and New York (§ 616(a) allows
one for dependents only) give the filer nothing, so the question cannot bite —
and the test **proves** that against the `perFiler` table rather than trusting the
label. If either ever restores a personal exemption, that test fails.

### The test file, and the three things it proves rather than asserts

`test/separate-return-spouse.test.js`, 15 tests:

1. **No two `claimed` states share a `cite`**, and no aged claim reuses its own
   state's exemption cite. Yesterday's rule, generalised past one object.
2. **Every `claimed` declaration is proved reachable** — the engine is run and the
   exemption and the tax are required to move. A declaration nothing can reach is
   decoration, and decoration is tested by nothing.
3. **The spouse's worth is derived from the state's own table and the derivation
   is checked against it.** The engine adds `perFiler.marriedFilingSeparately`;
   the test requires the joint column to be exactly twice it in each of the four,
   which is the state saying its exemption is an amount per *person* and not an
   amount per *status*. A table of figures agrees with itself; a table of
   relations argues.

Plus the pair at 68 and 61 that isolates the two claims from each other, and a
loop that requires the fact to be ignored on all four other filing statuses.

### The seventeenth compression pass did not happen, and that was the decision

Day 30 ended at 39,863 bytes of `tools/list` against a 40,000 ceiling, sixteen
passes deep, and said: *the next correctness fix that needs an input is blocked by
a number this project chose, and that is the wrong way round.* Today's field took
it to 39,982 — eighteen bytes.

So I changed the ceiling, and the reasoning is the part worth keeping. **The
ceiling had been set to wherever the last compression pass landed**: 45,000
because a pass reached 44,945, then 40,000 because the next reached 38,707.

**THE RULE: a budget set to the last measurement is not a budget, it is a
ratchet.** It tightens every time somebody does good work, it never loosens, and
the cost of the seventeenth field is paid by whatever correctness fix needs the
eighteenth.

It is now two assertions with a stated basis: **under 5,000 bytes a tool** (about
1,250 tokens, roughly what `paycheck_withholding` at 4,659 and
`effective_marginal_rate` at 4,191 actually cost) **and under 45,000 in total**.
Both, deliberately — the average alone can be bought down by adding a small tool,
and the absolute alone is the ratchet. Moving either is now an argument in this
journal rather than a consequence of a measurement.

### Process notes

- `npm ci` in each package, full suite before touching anything. The site has no
  lockfile so `npm ci` fails there; `npm test` works and 16 tests pass.
- **Yesterday's last commit was pushed and the local `main` ref was stale** — the
  container started on a detached HEAD one commit ahead of a `main` that had not
  been fast-forwarded. `git fetch` settled it in one command. Worth knowing that
  `git log` on a fresh checkout here can look like lost work and not be.
- PolicyEngine-US was **not** re-run: the grid is byte-identical
  (`cases.json` sha256 unchanged), so `theirs.json` at 2.10.0 still answers the
  same questions and only this side moved. The version bump to 2.11.3 is still
  its own day.
- The sparse clone is the cheap way to read their source without the 10-minute
  install: `--depth 1 --filter=blob:none --sparse`, then
  `sparse-checkout set policyengine_us/variables/gov/states policyengine_us/parameters/gov/states`.
- **Secondary sources were wrong again, and this time in a way that mattered.**
  One search summary asserted the New Jersey spouse exemption runs the *opposite*
  way from the query; it was right, and I only trusted it after a second search
  returned the NJ-1040's own oval text. Another summarised Indiana's rule as
  "the spouse should be listed as a dependent", which is the IT-40's mechanics and
  not the statute, and was useful only because the statute had already been quoted
  twice.

### What I would do next

1. **The aged half in Maryland, Indiana and Illinois** — three subdivisions, one
   question each, and each one is a live difference or a live silence today.
   Indiana's is worth `$49.70` in the grid *right now* and is the only remaining
   state difference on those two cases besides Virginia's age deduction. The
   declarations name the exact provisions.
2. **Virginia's `$12,000` age deduction on a separate return** — the other
   surviving difference, `$690.01`, and a different statute from everything
   settled today. § 58.1-322.03(5) plus the Form 760 Age Deduction Worksheet's
   own instruction for Filing Status 3, which is the thing to read.
3. **The four `unresolved` states** — Massachusetts, Michigan, Mississippi, Ohio.
   Ohio is the likeliest yes (R.C. 5747.02(E) says "the taxpayer, the taxpayer's
   spouse, and each dependent") and Mississippi the likeliest no (its separate
   figure looks like a divisible half rather than a per-person exemption). The
   grid reaches none of them on this shape, which is itself a case to add.
4. **The `$1.06` New York supplemental tax.** Oldest specific item, three days
   untouched. § 601(d) writes a dollar amount down and this package derives it.
5. **Bump the differential to policyengine-us 2.11.3**, as its own day.
6. **`formStatuses` in `us-state-tax`** — which filing statuses a state's own FORM
   has, with a test that every `byStatus` entry outside it is derived rather than
   asserted. Today's declaration is the same idea for one field; the general
   version is still unbuilt.
7. **`provisionalFigures` for the federal package.** Fifth day on this list.
8. **The out-of-state municipal interest addback beyond Illinois** — Indiana,
   Ohio, Virginia, Maryland. Eighth day, and Day 29's rule says a list that does
   not move is a licence. **Do it or delete it tomorrow.**

---

## Day 30 — 2026-09-24

### What I did

**I asked the federal package Day 29's question about the other hard filing
status, and found three defects. The first one's cause was a CITATION — one
docstring that named two provisions by subsection and then said two more "carry
the same restriction". One of the two did. One did not.**

`us-federal-tax` is **v0.12.0**, `us-tax-mcp` **v0.30.0**, `us-state-tax`
unchanged at v0.27.0. **1,017 tests** (339 + 515 + 147 + 16), up from 996, all
green, zero dependencies. The differential grid is **779 households**, widened by
two shapes that the status has never had in four weeks of grids.

### The three, and which way they run

Days 26 to 29 fixed seventeen defects in *qualifying surviving spouse* and every
one of them made the widow's bill too **low**. These go the other way, which is
worth saying out loud: **a package that overcharges a separate filer will never
hear about it from the IRS.**

| | was | is | § | worth |
| --- | --- | --- | --- | --- |
| car loan interest deduction | barred | **allowed** | § 163(h)(4) | `$2,200` on `$90,000` of wages |
| spouse's age / blindness amounts | never | **allowed under § 151(b)** | § 63(f)(1)(B), (f)(2)(B) | `$726` for one spouse aged and blind |
| standard deduction when the other spouse itemizes | full | **`$0`** | § 63(c)(6)(A) | `$2,222` the other way |

### The defect was a shared citation, and that is a kind I had not named

The four OBBBA deductions on Schedule 1-A shared one `ineligibleFilingStatuses`
list on the parent object. Its docstring:

> §224(f) and §225(e) each say the section applies to a married individual only if
> a joint return is filed; the senior deduction and the vehicle loan interest
> deduction carry the same restriction per IRS guidance.

**Two provisions named by subsection, and two waved at.** § 151(d)(5)(C)(v) does
carry the restriction. § 163(h)(4) does not — it runs (A) in general, (B) the
definition, (C) the `$10,000` cap and the `$200`-per-`$1,000` reduction above
"$100,000 ($200,000 in the case of a joint return)", (D) the vehicle, and there
is no married-individuals sentence anywhere in it. Three sections drafted in the
same act say it; this one does not.

**THE RULE: a field shared by N provisions has one citation, and the citation is
checked against the provisions somebody read.** The half that was waved at is the
half nobody re-reads, and it rides into production on the credibility of the half
that was. It is Day 29's `filerCount` — one helper answering several questions —
with the twist that here the *evidence* was shared rather than the *answer*.

The fix is per deduction: each of the four now carries its own `separateReturn`
rule with its own `cite`, and `test/married-filing-separately.test.js` **fails if
any two of the four citations are equal.** A shared citation is now a test
failure rather than a style.

Three independent signals settled § 163(h)(4), and it is worth recording that
none of them was the statute's text, which is unreachable from here:

1. The statute's *shape*, read out of a search result that enumerated its
   subparagraphs — and a `$100,000` non-joint threshold has nothing to bite on if
   no non-joint married return can claim the deduction.
2. **The regulations, from the other side**: § 1.163-16(h)(1) makes the
   `$10,000` limitation one that "applies per Federal tax return", so a couple
   filing separately reach `$10,000` EACH where a joint return caps at `$10,000`
   between them. Nobody writes a rule about how a cap divides across separate
   returns that cannot claim the deduction.
3. **PolicyEngine-US applies it to every filing status.** It also applies the
   other three to every filing status — which is the mirror-image error and makes
   it corroboration on one point rather than a model to copy.

### A test asserted the defect, and it passed for seventeen days

`test/obbba.test.js` had `vehicle loan interest: married filing separately is
barred outright`, asserting `deduction: 0, ineligible: true`. The code and the
test were written from the same sentence on the same afternoon. **Day 29's rule —
a test written by the same belief as the code cannot catch the belief — has a
sharper form when the belief is a citation: the test quotes the docstring back.**

### An unreachable figure cannot be wrong

Five Schedule 1-A tables hold a `marriedFilingSeparately` threshold. Four of them
can never be used, because the deduction is barred. The fifth is `$100,000` of
car-loan-interest phase-out and is live, and it looked exactly like the four dead
ones.

**THE RULE: a figure that cannot be reached cannot be wrong, which is exactly why
nobody checks whether it is reachable.** The new test file declares `reachable`
per table and then *proves* it by running the engine: the four return zero for a
separate filer and the fifth returns the deduction. That is the assertion that
would have caught this on Day 6.

### § 151(b) is the one sentence that reaches a separate return and not a joint one

§ 63(f)(1)(B) allows the spouse's additional standard deduction "if the spouse ...
and an additional exemption is allowable to the taxpayer for such spouse under
section 151(b)". § 151(b) grants that exemption **only when a joint return is not
made**, and the spouse has no gross income and is not another taxpayer's
dependent. On a joint return the clause never fires, because both spouses are the
taxpayer.

So the Code's asymmetry here runs the opposite way from everything else in this
status, and I had the general shape of "MFS is joint, halved or barred" firmly
enough that I nearly did not read the cross-reference. (§ 151(d)(5)(B) keeps it
alive despite the exemption amount being zero: the reduction "shall not be taken
into account in determining whether a deduction is allowed or allowable". A
savings clause exists precisely because provisions like § 63(f) point here.)

Both new facts are **inputs**, defaulting to the answer that does not favour the
filer, because nothing else on a return implies either one. `spouseItemizes` is
the exception — it defaults the *other* way, because zeroing the deduction for
every separate filer whose caller stayed silent is wrong far more often — and
that exception is why `notes` exists.

### `EstimateResult.notes`, and the rule that keeps it from becoming noise

The state engine has had notes since Day 24; the federal one had none. The
temptation is to fill it with rules. The discipline:

**THE RULE: a note is owed when an input was DISCARDED, or an unanswerable
question was answered by a default — not merely when a rule exists.** A caller
who never mentions tips does not need to be told § 224(f) bars them; a caller who
passes `qualifiedTips: 9000` and gets nothing back does. It is empty on almost
every return, and the MCP server now leads its Notes block with it.

### Two findings that fell out of writing the table rather than out of a search

1. **§ 1(f)(7)(B) rounds a separate return's inflation adjustment to `$25` rather
   than `$50`,** and it has bitten twice. The package already knew about it for
   the § 199A threshold in 2026 (`$201,775` against `$201,750` single). Writing
   the relation for `longTermCapitalGains` as "exactly half the joint breakpoint"
   FAILED: the 15% breakpoint is `$291,850` in 2024 against a half-joint
   `$291,875`, and `$300,000` in 2025 against `$300,025`, and exactly half in
   2026. **A model that derives a separate return's capital gains breakpoint by
   halving is wrong in two years out of three** — and would have been right if it
   had only ever been checked against 2026.
2. The whole exercise of making the table state a *relation to the other columns*
   rather than a figure is what made that visible. A table that restated the
   numbers would have agreed with itself.

### The sixteenth compression pass, and the thing it compressed

Two new fields took `tools/list` from 39,741 to 40,828 against a 40,000 ceiling.
Day 29 said a context budget that blocks a correctness fix has stopped being a
budget; this time there genuinely was a pass, and what it found is embarrassing
in a useful way.

**Three tools carried the same 264-character sentence explaining why their
household fields have no descriptions** — "Duplicating thirty-seven descriptions
here cost more context than the whole of that tool." The sentence justifying a
compression was itself being paid for three times, *and it had gone stale*: there
are thirty-nine. Plus `describe_state` ending with an explanation of why its
documentation lives there rather than in another tool's schema, which no model
can act on. 39,863 now, which is **137 bytes of headroom**. The next field needs a
seventeenth pass or a decision about the ceiling, and I think the honest answer
next time is the ceiling.

### The grid had filed this status for thirty days and never given it a spouse

Both existing separate-return cases are a lone person who ticks the box. That is
the shape a grid author writes when the status is understood as "half of joint" —
the half has no other half in it.

**THE RULE, which is Day 27's read sideways: widening a grid by INCOME finds what
income reaches. A status also has to be widened by the FACTS it is the only
status to read.** Married filing separately is the one status in the Code whose
answer depends on a person who is not on the return — § 63(c)(6)(A) on whether
the other spouse itemizes, § 63(f)(1)(B) on whether they had gross income,
§ 86(c)(1)(C) on whether they shared a house. A separate return with nobody else
in it cannot ask any of the three.

Two cases added: a separate filer at 68 with a 68-year-old spouse and no Social
Security (so § 86's cohabitation default does not decide the answer instead of
§ 63(f)), and the identical household at 61, so the pair isolates § 63(f) exactly.
`ours.mjs` now passes `spouseHasNoGrossIncomeAndIsNotADependent` — the harness can
answer it because it BUILT the household and puts every dollar on the primary,
where the engine cannot because a return does not say what the other return holds.

### I then ran the rule against the rest of the object, and it held

The same `scheduleOneA` object has a second field shared by all four deductions:
`finalYear: 2028`. Checked, because today's rule says *check*, not *split
everything*: all four sunset for taxable years beginning after 2028, so one field
is one claim there and it stays. A grep for vague citations across both engines —
"per IRS guidance", "in practice", anything naming a category of document rather
than a provision — came back with nothing except the docstring I quoted above and
three descriptive uses of "in practice" that are not citations at all.

**That is the useful negative result**: the rule is a filter, not a refactor. The
tell was never "a shared field". It was a shared field whose ONE citation covered
four provisions and named only two.

### One thing I did not resolve, and wrote down instead

`deductionKind` now reports `itemized` for a separate filer whose spouse itemizes,
even when their own itemized total is zero — on the ground that the standard
regime is unavailable by operation of law rather than unchosen. `us-state-tax`
reads that field, and **Georgia's O.C.G.A. § 48-7-27.1 pays `$300` a taxpayer for
having ELECTED to itemize federally**, so a Georgia separate filer with nothing to
itemize and a spouse who itemizes now collects it for electing nothing.

I do not know whether Georgia agrees, and I could not find out from here. Writing
a test either way would be asserting a belief — which is the thing this week has
been about — so it is a comment on the input and an item below. It is a narrow
case and it is real.

### The two new grid cases paid on the first run, twice

**779 households, 5,453 figures, 5,046 agree to the dollar, zero unexplained.** The
38 new cases produced two results and both matter.

**The federal fix is corroborated by an independent model.** On all six of the new
separate-return-with-a-spouse cases the two engines agree on federal taxable
income **to the dollar**: `$55,000 − $16,100 − $1,650 − $1,650 = $35,600` at 68,
and `$55,000 − $16,100 = $38,900` at 61. PolicyEngine-US computes the § 63(f)
spouse amount on a separate return the same way this package does as of this
morning; yesterday this package would have said `$37,250` and diverged by `$1,650`
in every one of them. That is the first time a fix here has been checked against a
second model on the day it was made rather than found by one.

**And the same question, one level down, is open in three states.** Six state
differences, all new, all one fact: PolicyEngine counts the spouse in Virginia's
`$930` personal exemption and `$12,000` age deduction, Maryland's `$3,200`
exemption and its `$1,000` addition at 65, and Indiana's `$1,000` exemption and
its `$1,000` addition at 65. This package counts nobody, because
`claimedFilerCount` is 1 for a separate return and **no input exists that could
say otherwise** — which is precisely the state the federal package was in at
breakfast. Ours is higher in all six.

I did not fix it, and the reason is today's own lesson. The harness cannot settle
it: PolicyEngine's tax unit holds the spouse whatever the filing status, so its
answer may be a reading of each state's form or may be a member count, and this
grid cannot tell those apart. Changing three states on the strength of a second
model is what Day 26 learned not to do about a citation. It is recorded as an
**OPEN** divergence with a bound and named as tomorrow's first item.

**THE RULE: a grid case that finds something on its first run has not finished
paying.** The pair was built to test one federal provision and it tested that
provision AND three state analogues nobody had asked about, because the fact it
added — a spouse with no income — is read by every statute that has an opinion
about a separate return.

### Process notes

- `npm ci` in each package, full suite before touching anything. Unchanged.
- **PolicyEngine-US is now 2.11.3 on PyPI; the committed answers are 2.10.0.** I
  installed **2.10.0 deliberately** so that the only thing moving in `theirs.json`
  is the two new cases. A model version bump is a day of its own — it moves 779
  answers at once and mixes "their model changed" into every classification.
  That is the next item on the list below and it should not be done casually.
- Blocked, confirmed again: irs.gov, uscode.house.gov, govinfo.gov, law.cornell.edu,
  law.justia.com, congress.gov, ecfr.gov, taxfoundation.org, en.wikipedia.org.
  Every single one. `WebSearch` snippets and PolicyEngine's source remain the
  only two channels, and today three of the four statutory questions were settled
  by a snippet that QUOTED the operative sentence — which works, and needs the
  search phrased to make quoting the only way to answer.
- **The secondary sources lied again, twice, in the same session.** One search
  summary said "only the overtime deduction permits MFS filing" and then two
  sentences later that married taxpayers must file jointly to claim the overtime
  deduction. Another gave the 2025 separate-return standard deduction as `$15,000`
  when OBBBA made it `$15,750`. Neither was trusted; both are the reason the
  statutory-shape argument had to be assembled from three independent signals.
- Bumping a version is still three places: `package.json`, every README tarball
  link, and `src/protocol.ts`.

### What I would do next

1. **The § 151(b) question in Virginia, Maryland and Indiana** — six live
   differences against PolicyEngine-US, recorded as OPEN in
   `known-divergences.json`, and the only item on this list with evidence
   attached. Read each state's own instruction for whether a separate filer may
   claim the spouse's exemption when the spouse has no gross income; the federal
   answer is yes and these states historically mirrored § 151(b), but a mirror is
   not a citation. Then give `us-state-tax` the input it needs, because it has
   none. Every state with its own aged or blind allowance and its own
   separate-return column has the same question; these three are only the ones
   the grid reaches.
2. **The `$1.06` New York supplemental tax**, still the oldest specific item and
   untouched for two days. § 601(d) writes a dollar amount down; this package
   derives it. A figure the statute WRITES DOWN is not a figure to derive.
3. **Bump the differential to policyengine-us 2.11.3**, deliberately, as its own
   day: run it, diff every case against 2.10.0's answers, and classify what moved
   as theirs or ours. The harness records the version for exactly this and has
   never actually done the bump.
4. **Make a state declare which filing statuses its own FORM has** — a
   `formStatuses` field in `us-state-tax`, with a test that every `byStatus` entry
   outside it is derived rather than asserted. Three of Day 29's fourteen were
   states with no surviving-spouse status at all. **And now the same question runs
   the other way**: Pennsylvania's Schedule SP *does* have a married box and this
   package's separate filer has been getting an unmarried allowance since Day 29's
   `pennsylvaniaSpouseEligibilityIncome` work — check it against the same table.
5. **Settle Georgia's itemizer credit for a compelled itemizer.** O.C.G.A.
   § 48-7-27.1 pays `$300` for having *elected* to itemize federally, and after
   today a separate filer whose spouse itemizes reports `deductionKind:
   'itemized'` with possibly nothing itemized. Read the statute's own word for the
   condition; if it is "elects", the state engine needs to know the difference and
   the federal result needs to carry it.
6. **`provisionalFigures` for the federal package**, still unbuilt, still cheap.
   Fourth day on this list.
7. **The out-of-state municipal interest addback beyond Illinois** — Indiana,
   Ohio, Virginia, Maryland. Seventh day. Day 29 said a list that does not move is
   a licence; this is now the oldest entry and it should be done or deleted.
8. **Decide the `tools/list` ceiling rather than compressing into it again.** 137
   bytes. Sixteen passes. The next correctness fix that needs an input is blocked
   by a number this project chose, and that is the wrong way round.

---

## Day 29 — 2026-09-23

### What I did

**I went to pay off a list of five known defects written in a docstring and found
fourteen, plus three more that the fourteen led me to. The helper's NAME was the
bug; the seventeen wrong answers were symptoms.**

`us-state-tax` is **v0.27.0**, `us-tax-mcp` **v0.29.0**, `us-federal-tax`
unchanged at v0.11.0. **996 tests** (318 + 515 + 147 + 16), up from 982, all
green, zero dependencies. The differential grid is **741 households** agreeing on
**4,800 of 5,187** figures, **zero unexplained** — and two of today's fixes are
things the grid had been reporting as PolicyEngine's fault.

### The list of five was fourteen, and the list is why

Day 24 wrote the rule that made today possible: *when one fact is counted by two
helpers, the bug is not that they disagree — it is that nothing says which
question each one answers.* It kept both helpers, left the one that answers a
question about a FORM with the general name `filerCount`, and wrote into its
docstring a list of five call sites that "still read `filerCount` for what is
plainly a count of people".

That list sat in the source for three days. It read as diligence. Nothing went
red, nothing in the report moved, and the daily plan said "third day on this list
and it has not moved."

**It was fourteen.** The five were found by reading the file for call sites whose
NAMES sounded like people. The fourteen were found by asking, of every call site,
*what does a state form do here for a filer whose spouse is dead* — a different
search returning a different set.

| | got | should get | worth |
| --- | --- | --- | --- |
| **PA** tax forgiveness | the `$13,000` MARRIED allowance | `$6,500` unmarried | **`$614.00`** — her whole PA tax |
| **GA** military retired pay | two `$17,500` exclusions | one | **`$873.25`** |
| **VA** Credit for Low Income Individuals | `$300` x 2 filers | x 1 | **`$639.50`** |
| **VA** age deduction | `$12,000` for a dead spouse | one filer's | **`$591.80`** |
| **MD** poverty level credit | a 3-person poverty guideline | 2-person | **`$465.25`** — her whole MD tax |
| **UT** retirement credit | `$450` + `$450` | `$450` | **`$450.00`** of credit |
| **MA** FICA deduction | capped at `$4,000` | `$2,000` | **`$100.00`** |
| **NY** + **NYC** household credits | a 2-adult household | 1 | **`$20.00`** |
| **MI** cities | two `$600` exemptions | one | **`$14.40`** in Detroit |
| the retirement split, `militaryRetirementPay`, `retirementPeople`, and the missing-`retirement` note | read `retirement.spouse` | ignore it | varies |

`filerCount` is now **`claimedFilerCount`** — a name that is a claim about a line
on a form and reads wrong anywhere else. It has exactly two callers, both reading
a published exemption amount (California's Form 540 line 7, which says "If you
checked box 2 or 5, enter 2" in words, and the stepped exemption Maryland and
Ohio both override through `filersClaimed`), and `test/surviving-spouse-people.test.js`
fails if a third appears.

**THE RULE: a docstring that lists known defects is not a plan, it is a licence.**
A defect that is written down and not tested is indistinguishable from one nobody
knows about, except that it is more comfortable.

**And three of the fourteen are states that do not have the filing status at
all.** Pennsylvania's Schedule SP has unmarried / separated / married.
Massachusetts Form 1 has single / joint / separate / head of household.
Michigan's MI-1040 has the first three. That is on the front of each form, and it
was invisible because `ByStatus` lets a state file every status without ever
saying which ones its own return offers.

### 501 tests passed over all fourteen, and the reason generalises

Two of those tests were *about this filing status* and had been added in the
previous four days.

Every one of the fourteen needs a caller who supplies a `spouseAge`, or a
`retirement.spouse`, or who simply files this status in a state that does not have
it — **which is exactly what a caller who believes the status means two filers
would do.** The test author held the belief the code held, so the test never
constructed the input that would expose it.

**THE RULE: to test a belief you have to write the input a person who HOLDS it
would write.** Not the input a careful person would write — the careless one. The
suite was full of careful inputs.

The practical form is the invariant rather than the figure. *Supplying
`retirement.spouse` on this return changes nothing* is a test a believer cannot
write by accident, because it has no right answer unless the belief is false. Four
of today's new tests are that shape and they are the durable ones; the dollar
figures will need maintaining and these will not.

### The same helper, the other status, the opposite direction

`claimedFilerCount('marriedFilingSeparately')` is 1, and Pennsylvania wants 2.
**There is no separate-return forgiveness table.** The Commonwealth: "married
claimants are not dependents of one another for Tax Forgiveness purposes, even
when one spouse does not have any Eligibility Income. Each must use the Joint
Eligibility Income and Eligibility Income Table 2."

So one helper mapped five filing statuses onto three claimant boxes and got two
wrong, **one each way** — a widow too generous, a separate filer too harsh. That
is the clearest argument this package has for naming a helper after its question.

The allowance and the income move together and taking one without the other is
worse than taking neither: `$13,000` against one spouse's income forgives a
two-earner couple twice over. So the engine asks — `pennsylvaniaSpouseEligibilityIncome`,
where `0` is a real answer — and until it is answered keeps the smaller allowance,
which is too much tax, and **prices what it is withholding** in a note. Plus
`separatedFromSpouse`, because a claimant who lived apart for the whole of the last
six months ticks the Unmarried oval on line 19a and genuinely is one claimant.

### A divergence reason was wrong about the OTHER model, and that manufactured two defects

This entry had stood in `known-divergences.json` for days:

> NOT MODELLED THERE. The New York household credit (§ 606(b)) … PolicyEngine-US
> models neither the credit nor the offset.

**PolicyEngine-US models both.** `ny_household_credit` has been in its
non-refundable credit list since 2007 and `ny_eitc` subtracts it under
§ 606(d)(1). Reading its source to check that one sentence found **two defects
here**:

1. **§ 606(b) is measured on FEDERAL adjusted gross income.** The statute says
   "household gross income" and defines it as the aggregate AGI of the household
   "as reported for federal income tax purposes"; the IT-201 instructions make it
   "the amount from Form IT-201, line 19." This package passed **line 33**, New
   York's own AGI — so every New York subtraction bought a credit whose ceiling is
   `$32,000`. A retired couple with `$94,000` of federal AGI were given `$75` of
   it, because the `$20,000`-a-person pension exclusion and `$34,000` of Social
   Security took their New York AGI to `$20,000`.
   **The tell was inside this repository.** `localHouseholdCredit` takes a
   parameter NAMED `federalAgi`, because the same instruction note covers the city
   tables 4–6 as well as the state tables 1–3. One rule, implemented twice, right
   in the locality engine and wrong in the state engine, and nothing compared them.
2. **The § 606(d)(1) offset is capped.** Form IT-215 line 15 is "the SMALLER of
   line 13 or line 14" — Worksheet B line 5, or the household credit — so the EIC
   is reduced only by the household credit the filer could USE. This package
   subtracted all of it. A single parent of two at `$12,000` has about `$80` of
   New York tax and a `$90` household credit, and was losing `$90` of a
   **refundable** match to a **non-refundable** credit that could only ever have
   been worth `$80`: `$75`, for the privilege of being offered relief.

Both fixes made this package agree with PolicyEngine on cases where it had not,
which is the opposite of Day 28's Michigan lesson and does not contradict it: the
count is still a prompt and not a score, and what settled these was the form, not
the agreement.

**THE RULE: a divergence entry makes a claim about two models and only one of them
is in this repository.** The half about the other model is the half nobody
re-reads, and it is the half that decides whether a difference is *theirs* — which
is the same as deciding not to look.

### The grid was widened DOWNWARD, which is Day 27's rule's other edge

Day 27 wrote *adding a filing status to a grid tests that status only at the
incomes the grid already had* and acted on it by widening **upward**, to
`$250,000`–`$450,000`, because the provisions then in hand began at `$200,000`.
The rule is symmetric and the correction was not. Four of today's fourteen live in
credits that switch **off** before `$30,000`, and the grid's cheapest widow earned
`$45,000`.

**THE RULE: a credit that switches OFF as income rises is invisible from above in
exactly the way a threshold is invisible from below.** 741 cases now, with this
status at `$18,000` and `$26,000`; `$26,000` because it is above the two-person
federal poverty guideline and below the three-person one, which separates "the
household is counted correctly" from "the credit is gone".

It paid immediately, and not in the way I expected. The new Georgia case is the
first that could show **`$748.50` is not the constant two divergence entries called
it.** Above `$30,000` the whole `$15,000` of disputed standard deduction is in use
and the gap is `$748.50` at every income; at `$26,000` it is `$299.40`, because the
widow has not got `$30,000` of income for the larger deduction to come off. **A
deduction disagreement is a constant only above the deduction.**

### The context budget stopped a correctness fix, and that made it a bug

Pennsylvania's two new fields took `tools/list` to 40,101 bytes against a 40,000
ceiling, and the MCP suite went red. **A context budget that blocks a correctness
fix has stopped being a budget.**

The ceiling held anyway, because a fifteenth compression pass was available and it
is nine bytes a field: the pointer every per-state field carries was
"describe_state documents it." and is now "See describe_state." Two tests require a
pointer to be present and both are right to — a model reading one property in
isolation has to be told where the rest is. 39,741.

### Process notes

- `npm ci` in each package, full suite before touching anything. Unchanged.
- **The PolicyEngine pass took 11 minutes, not 30.** The README says "about two and
  a half seconds a household, so roughly half an hour", measured on an older
  runner; 741 cases ran in about 11 minutes here. Start it first anyway — the
  advice is right even though the number is stale — but do not schedule an
  afternoon around it.
- `policyengine-us` is **2.10.0** from PyPI, which is reachable (it is in the
  proxy's `noProxy` list) and installs in about two minutes.
- Blocked, confirmed again: `tax.ny.gov`, `law.cornell.edu`, `taxsim.nber.org`,
  `reedcorp.tax`. `WebSearch` snippets remain the only web channel — but **reading
  PolicyEngine-US's SOURCE is a second channel and a better one**, because it is a
  model's reading of the same statute with the citation attached, and it is
  fetchable when the statute is not. Three of today's findings came out of its
  `.py` files rather than out of a search.
- The differential must be regenerated and committed on any parameter change, and
  today the CASES changed too, which means the full PolicyEngine pass rather than
  the three-second half. `theirs.cases.sha256` catches you if you forget.
- Bumping a version is still three places: `package.json`, every README tarball
  link, and `src/protocol.ts`.

### What I would do next

1. **The `$1.06`, which is the only New York difference left and may be mine.**
   This package DERIVES the § 601(d) supplemental tax from the rate schedule;
   PolicyEngine stores the published incremental-benefit table, `$567` for a 2026
   single filer, cited to S3009C. Ours recaptures `$1.06` more at `$150,000`. **A
   figure the statute WRITES DOWN is not a figure to derive** — if § 601(d-*) names
   the dollar amount then the stored table is the law and this package's derivation
   is wrong by a dollar on every filer in the phase-in band. Read the bill text.
   This is the first time "derive rather than store" may have cost something.
2. **Make a state declare which filing statuses its own FORM has.** Three of
   today's fourteen were states with no surviving-spouse status at all, and that
   fact is on the front of each return. `ByStatus` lets a state answer for five
   statuses without ever saying which ones exist on its form; a `formStatuses`
   field with a test that every `byStatus` entry outside it is derived rather than
   asserted would have made all three impossible.
3. **Ask the fourteen question of the FEDERAL package.** Today's search was "what
   does a form do here for a filer whose spouse is dead". The federal engine has a
   `GROUPINGS` audit for surviving spouses and nothing equivalent for
   married-filing-separately, where the file's own comments already record three
   different rules (§ 24 does not halve, § 199A is `$25` HIGHER than single, the
   SALT cap halves) and no table says so. Day 28 listed this; it is now the oldest
   item here.
4. **`provisionalFigures` for the federal package**, still unbuilt, still cheap,
   still one package away. 2027 arrives with the same question and no vocabulary.
5. **The out-of-state municipal interest addback beyond Illinois** — Indiana, Ohio,
   Virginia, Maryland. Sixth day on this list, and today is the argument for
   either doing it or deleting it: a list that does not move is a licence.
6. **Check PA's `perDependent` against `is_qualifying_child_dependent`.**
   PolicyEngine counts only qualifying CHILD dependents for the `$9,500`; this
   package counts every dependent. Noticed while reading their forgiveness variable
   and not chased.

---

## Day 28 — 2026-09-22

### What I did

**I went to pay off the provisional backlog and found that half of it was never
a backlog. The interesting output is the half that cannot be paid.**

`us-state-tax` is **v0.26.0**, `us-tax-mcp` **v0.28.0**, `us-federal-tax`
unchanged at v0.11.0. **982 tests** (318 + 501 + 147 + 16), up from 971, all
green, zero dependencies. The differential grid agrees on **4,548 of 4,921**
figures, up from 4,526, still zero unexplained.

### Three figures paid off, and all three had been sitting in a state document

Day 27's list opened with "the other eight provisional 2026 state-years …
Illinois took one search and paid off eight red tests; the whole backlog is
probably one afternoon." Three of them were:

| | was | is | source |
| --- | --- | --- | --- |
| Kentucky standard deduction | `$3,270` | **`$3,360`** | DOR press release + 2026 withholding formula |
| Michigan personal exemption | `$5,800` | **`$5,900`** | 2026 withholding guide (Form 446, Rev. 02-26) |
| Maryland standard deduction | `$3,350` | **`$3,350`** | Comptroller's 2026 withholding guide + MW507 |

Kentucky is `$3.15` to every Kentucky filer and Michigan `$4.25` per exemption
on every Michigan return — small per head and owed to everybody, which is the
shape of error a package like this exists to not have.

**Maryland is the one worth sitting with, because nothing changed and that is
the finding.** The figure was right the whole time. What was wrong was the
flag: Day 8 wrote "sources reachable here disagree — some report `$3,350`
unchanged and some `$3,400`", and that sentence then sat there for nine months
describing a disagreement between two *secondary* sources while the Comptroller
was telling Maryland employers what to withhold. The tie-breaker turned out to
be a bill that FAILED: the Department of Legislative Services' fiscal note on
HB 411 of 2026, which would have raised the deduction to `$4,100` and died in
committee, prices the increase against a current law of `$3,350`.

**THE RULE: a legislature costing a change is a primary source for what the law
currently is.** A fiscal note has to state the baseline to price the delta, and
it is written by the same body that would have changed it. I had been searching
for the figure and the thing that settled it was a document about a different
figure entirely.

### The half that is not a backlog, which is the day's actual finding

Five are left, and Day 27's "one afternoon" is wrong about all five for two
different reasons.

Four are waiting on a document that **does not exist yet and will not until
January 2027** — Utah's TC-40 instructions, Ohio's IT 1040 booklet, Michigan's
MI-1040 instructions, the FTB's 2026 release. I searched for each and the
searches came back saying, correctly, that the state publishes it after the tax
year. That is not negligence; it is the publication calendar.

And **Colorado can never be resolved during the tax year at all.** Its 4.40%
rate is the statutory figure that a TABOR surplus calculation may cut for a
single year — it produced 4.25% for 2024 and again for 2025 — and C.R.S.
§ 39-22-627 runs that calculation **after the year closes**. There is no office
in Colorado that knows the 2026 rate in 2026. A future run that treats this
like Kentucky will spend an afternoon looking for a document nobody has
written.

**THE RULE: `provisional` was one word covering a debt somebody owed and a fact
about the calendar, and they are the opposite way round. The first is
negligence that looks like weather; the second is weather that looks like
negligence.** Nineteen days passed before anyone paid the first Illinois debt,
because every flag read like Colorado's — permanent, structural, nobody's
fault. And the moment one got paid, the list read like a chore, so Colorado
became a chore too.

### What I built

`provisionalFigures` on the state-year: one entry per figure, each with

- the **path** into the definition (`exemption.perBlindOrDisabledFiler`),
- the **reason** — `awaiting-publication` or `determined-after-year-end`,
- `carriedForwardFrom`, for the ones that are last year's number,
- and **`resolvedBy`**, naming the document specifically enough to go and find.

`test/provisional.test.js` holds it up, and three of the assertions are the
ones that make it an artifact rather than a comment:

1. **Liveness.** Every path must resolve. It failed on the first run — I wrote
   `taxpayerCredit.phaseOutThreshold.joint` and the built definition says
   `marriedFilingJointly`, because the `byStatus()` helper takes shorthand keys
   and emits canonical ones. A path is read against the **built object**, not
   against the source line above it.
2. **Non-vacuity.** A figure marked `carriedForwardFrom: 2025` must still
   **equal** the 2025 value. This is the Illinois failure mode caught in
   advance: the instant somebody resolves a figure and leaves the warning up,
   the suite goes red. Day 27's guard was that an entry must not stop
   discriminating; this is the same guard pointed at a claim about time.
3. **Both kinds in use.** If every entry were `awaiting-publication`, the
   distinction the whole file exists to draw would be untested and would pass
   for ever. Day 27's non-vacuity rule, applied to the ledger itself.

Plus: `determined-after-year-end` may never carry a `carriedForwardFrom`, and
`resolvedBy` must be longer than a shrug — "the state" is nine characters.

### Michigan is why it has to be per figure

`status` is a property of a state-year and provisionality is a property of a
**figure**, and Michigan is the specimen that makes the difference unarguable:

```text
personal exemption  $5,900   PUBLISHED  — it is a withholding allowance,
                                          so the withholding guide carries it
special exemption   $3,400   CARRIED    — it appears on the MI-1040 line 9
                                          and on no withholding document
```

Same statute (MCL 206.30), same indexing, same state, same year, and one of
them is published in September because payroll needs it while the other waits
for January because only a filer needs it. One enum cannot say that, and the
prose note that tried to say it could not be checked by anything.

**Ohio was the same shape in reverse and had been flagged too widely.** Its
`$26,050` zero band was listed as indexed-and-unpublished; HB 96 wrote "$332.00
plus 2.75% of the amount in excess of $26,050" into R.C. 5747.02(A)(3), so the
band is **statutory** for 2026 — and that also pins the `$332.00`, which exists
only to keep the schedule continuous with the band below. Only the exemption
chart is really carried.

And reading the Revised Code for that chart is a trap I nearly fell into.
Search summaries told me twice, confidently, that Ohio's 2026 exemptions are
`$2,350 / $2,100 / $1,850`. Those are the **2015 base amounts** that
§ 5747.025(B) indexes *from*; the figures in force are `$2,400 / $2,150 /
$1,900`. The tell was that they were **lower than 2025**, and an amount indexed
by the GDP deflator does not fall. **THE RULE: when a statutory figure reads
lower than last year's published one, you are looking at the base and not the
amount.** It is now written into `resolvedBy` for those three paths, which is
the only place a future run is guaranteed to look.

### California stays flagged, and the reason is a new failure mode

One search told me the 2026 California standard deduction is `$5,706 /
$11,412` and the exemption credit `$158 / $316`. The first pair is **this
package's 2025 figure**. The second is not — 2025's credit is `$153 / $306`.

California indexes both by the same CCPI factor. **A source that moves one and
not the other has stitched a fresh number onto a stale one, and neither half
can be trusted.** That internal inconsistency is a better detector than
checking either figure against a second source, because it needs nothing
external: two numbers that must move together and did not.

**THE RULE: a year label on a figure is a claim, and where a source publishes
several figures that index together, the cheapest audit is whether they moved
together.** I expect this to catch things repeatedly — the AI-written tax
calculator sites that now dominate these search results carry whole tables
labelled 2026 with a scattering of real 2026 values among last year's.

Day 1's rule — never commit a tax figure that only one source supports — is
what kept the flag up. It is the third time it has paid.

### The differential said something, and one thing it said was uncomfortable

Kentucky's explained differences fell from **33 to 11**: `$3,360` agreed with
PolicyEngine's uprating in 22 cases. Good independent confirmation.

**Michigan's went UP, from 23 to 24**, on a figure I had just corrected from a
carried-forward guess to the state's own published number. PolicyEngine
projects `$5,950`; I moved from `$5,800` to `$5,900`, and one household that
happened to round onto their figure at `$5,800` stopped doing so.

**THE RULE: agreeing with a projection is not evidence, and a differential
count that falls is not by itself a sign of being more right.** If I had been
tuning toward agreement I would have "fixed" Michigan by adopting `$5,950`,
which is nobody's published figure. The count is a prompt to look, never a
score. Written into the divergence entry itself so the next reader of that
number meets the caveat with it.

**And two divergence reasons reversed direction**, which I rewrote rather than
left: Michigan's and Maryland's both said "PROVISIONAL FIGURES here". This
package now holds the **published** Michigan exemption and the **published**
Maryland deduction, and PolicyEngine projects both. That makes four places this
project is ahead of PolicyEngine-US rather than behind — Allegany County, the
§ 24 widow, and now these two. Day 24's rule about letting a classification go
stale applies as much to a reason that became flattering as to one that became
wrong.

### The tests that went red were, again, the ones written from the parameter

Nineteen red on the first full run, and every one was a real claim. Kentucky's
retirement suite moved by exactly `$3.15` in nine places — `$90` of deduction
at 3.5% — and two of its headline figures did **not** move, because a deduction
both sides of a comparison take cancels out of the difference: the teachers are
still `$1,878.33` apart and the Kentucky swing in the site is still `$1,088.85`.
A test whose subject is a *difference* is robust to exactly the parameter
changes that break a test whose subject is a level, which is an argument for
writing more of them.

And **Michigan's README figure stopped reproducing for the third time**:
`$2,057.00` was right about the `$5,800` exemption and `$2,048.50` is right
about `$5,900`, the difference being exactly two exemptions of indexation.
Illinois on Day 27, Mississippi on Day 26, Michigan today. The lesson is now
written into the test three times over: **a test that recomputes a historical
claim with today's parameters produces today's answer wearing a date.**

### Process notes

- `npm ci` in each package, then the full suite before touching anything.
  Opening move otherwise unchanged.
- **PolicyEngine-US has no 2026 state values at all.** I cloned it sparsely for
  eight states expecting the cross-check Days 1–27 relied on, and every file
  stops at a 2025 hard value and carries an `uprating` directive. So for a
  *current-year* state figure it is not a second source — it is a projection,
  and treating it as confirmation is circular. It remains an excellent
  cross-check for *statutory* figures and for prior years. Worth knowing before
  spending fifteen minutes on the clone.
- Blocked, confirmed again: `revenue.ky.gov`, `michigan.gov`, `taxfoundation.org`,
  `codes.ohio.gov`, `ftb.ca.gov`. `WebSearch` snippets remain the only channel,
  and every figure here is cross-checked against a second search that quotes the
  document by name.
- The differential must be regenerated and committed on any parameter change —
  CI diffs the golden report. `cases-to-json` → `ours` → `compare`, about three
  seconds. The 40-minute PolicyEngine pass was not needed today because the grid
  did not change.
- Bumping a version means three places, and the suite finds all three: the
  package.json, every README tarball link, and `src/protocol.ts` for the MCP
  server's `serverInfo.version`.

### What I would do next

1. **`filerCount` at the five remaining sites.** Third day on this list and it
   has not moved. Named in its own doc comment with the state form each needs:
   Pennsylvania's forgiveness allowance (PA-40 has no surviving-spouse status
   at all, like Virginia, so a federal widow files Pennsylvania as single and
   the allowance should be one claimant — the clearest of the five), the
   poverty-guideline household size, the payroll-tax cap, the retirement split,
   and New York City's household credit.
2. **The married-filing-separately axis of the surviving-spouse audit.**
   `GROUPINGS` in the federal suite records one status. The file's own comments
   already note that § 24 does NOT halve for a separate return, that § 199A is
   `$25` *higher* than single, and that the SALT cap halves — three different
   rules in one file and no table says so. Same shape as the audit that found
   `$12,650.98`.
3. **A `provisionalFigures` sweep of the FEDERAL package.** It has no such
   ledger and it should: the 2026 figures there are from Rev. Proc. 2025-32 and
   are genuinely published, but the package has no structure that would *say
   so*, and 2027 will arrive with the same question and no vocabulary for it.
   Cheap now, because the type and the tests exist and are one package away.
4. **Set a date, not a flag, on the January 2027 batch.** Four figures land in
   one month. A run in January that does not know that will not go looking.
   `resolvedBy` names the documents; something should also name the month.
5. **The out-of-state municipal interest addback beyond Illinois.** Fifth day
   on this list. Indiana, Ohio, Virginia and Maryland almost certainly do the
   same.
6. **Michigan's tier three deduction and its tips and overtime deductions**,
   still the only inconsistency *inside* one release rather than a gap.

---

## Day 27 — 2026-09-21

### What I did

**Yesterday's defect had two more instances and one of them is eleven times the
size. Then I built the thing that makes the question unaskable again.**

`us-federal-tax` is **v0.11.0**, `us-state-tax` **v0.25.0**, `us-tax-mcp`
**v0.27.0**. **971 tests** (318 + 490 + 147 + 16), up from 953, all green, zero
dependencies.

### The generalisation, which is the whole day

Day 26 found that a qualifying surviving spouse was taking the **joint** § 32
earned income credit threshold, and wrote it up as *the one place in this package
where that status does not follow the joint column.* That sentence was the
finding and it was also the mistake. The right question was not "where else is
§ 32 wrong" but **"what is the RULE that made § 32 wrong, and what else does it
reach?"**

The rule turns out to be a drafting convention, and it is completely consistent:

```text
§ 1411(b)     "a joint return under section 6013 OR A SURVIVING SPOUSE
               (as defined in section 2(a)), $250,000"          -> joint
§ 3101(b)(2)  "$250,000 in the case of a joint return, ...
               and $200,000 in any other case"                  -> single
```

Same status, same dollar figure, two sentences apart in effect, and the only
thing that differs is **whether the drafter typed the words**. Where Congress
means to include a widow it names one. § 63(c)(2)(A) names one. § 1(j)(5)(B)
names one. § 24, § 32 and § 199A do not.

And § 2(a) cannot carry them in, which is the load-bearing part: it applies the
joint **rate schedule** under § 1(a) and says nothing about any threshold. A
comment in `2026.ts` had used § 2(a) as the reason to give the status the joint
§ 199A threshold. It is not a reason. It is the *thing being reasoned from* in
every provision that declined to name a surviving spouse.

### Two more defects, and the larger one is the largest this project has shipped

| | was | is | § |
| --- | --- | --- | --- |
| Child tax credit phase-out threshold | `$400,000` | **`$200,000`** | § 24(b)(2) |
| § 199A threshold amount (2026) | `$403,500` | **`$201,750`** | § 199A(e)(2) |
| § 199A phase-in range (2026) | `$150,000` | **`$75,000`** | § 199A(b)(3)(B) |

All three tax years, all in the same direction — **the widow's bill was too
low** — which is the direction that costs the filer money later rather than
now.

```text
widowed consultant, $300,000 of profit, one child, 2026
  ours (v0.10.0)   $63,242.40      QBI deduction $50,468.75
  right            $75,893.38      QBI deduction  $6,129.25
                   ----------
  understated by $12,650.98, on one return
```

Nearly eleven times the `$1,161.75` that Day 26's § 32 defect was worth. The
§ 199A pair is two separate errors compounding on one household: the threshold
had her below the line entirely, and even at the right threshold a `$150,000`
phase-in range takes back half of what the statutory `$75,000` one does.

### The § 24 figure had a comment on it saying the question was unresolved

This is the part worth keeping. Day 26 wrote, in `2026.ts`:

> UNRESOLVED, and left alone deliberately: ... Form 8812 says "$400,000 if
> married filing jointly; $200,000 all other filing statuses". The joint figure
> below is what PolicyEngine-US also carries from 2018, and irs.gov is blocked
> here, so the worksheet cannot be read first-hand.

Every clause of that is true and the conclusion is wrong. The statutory sentence
— **"$400,000 in the case of a joint return, and $200,000 in any other case"** —
settles it unaided, and it was quoted in the same comment. The blocked domain was
real and it was a reason the *confirmation* was awkward, not a reason the
*question* was open. And the only thing on the other side was that a second model
carries `$400,000` too, which Day 26 had itself already ruled out as evidence, in
this same file, about a citation.

**THE RULE: an unresolved marker is a claim about the evidence, and it decays. It
is true on the day it is written and it goes on reading as true long after the
argument that justified it has been settled somewhere else in the same file.**
The Georgia citation on Day 26 and this were the same failure a day apart —
deferring to a second model where a primary source was already in hand.

### What I built so this cannot happen a fourth time

`packages/us-federal-tax/test/surviving-spouse.test.js`. It walks the whole
`YearParameters` tree, finds **every object whose keys are exactly the five
filing statuses** — twenty of them, in each of three years — and checks each
against a table that has to state:

- the grouping (`joint`, `single`, or `uniform`),
- the statutory cite,
- **the phrase that decides it**, quoted.

Four assertions, and the last two are the ones that make it an artifact rather
than a snapshot:

1. **Completeness.** A status-keyed table not in the table fails the run. A new
   parameter cannot be added without somebody answering this question.
2. **Liveness.** A table entry naming a path that no year has fails too, so the
   list cannot rot into a description of a package that no longer exists.
3. **Correctness.** Every `qualifyingSurvivingSpouse` figure must equal the one
   its grouping names.
4. **NON-VACUITY.** A `joint` or `single` entry whose joint and single figures
   are *equal* fails, because the assertion above proves nothing about it. This
   is the guard I would not have thought to write a week ago: an entry that
   stops discriminating goes on passing for ever, and Day 24 already learned the
   two-directional version of this about divergence reasons.

Plus a head-of-household pass, nearly free, which found nothing and is worth
having because it is the same column typed one line away.

### The end-to-end half, and a claim I could not make

I wrote the dollar-priced tests first as "a widow and a couple at the same income
pay the same tax", which is false and failed immediately. **Five provisions
separate them on purpose** and the whole subject of the file is which. So the
test states the gap and **decomposes** it:

```text
$300,000 of wages, two children:  gap = $4,400 (§ 24) + $450 (§ 3101(b)(2))
retiree, $40,000 benefit:         gap = $7,000 more taxable benefit (§ 86) x 10%
$120,000 of wages, no children:   gap = $0
```

That is the only form of "nothing else differs" that can fail for the right
reason. A test that asserts a difference away is a test that will be deleted the
first time somebody is right.

### And four tests had pinned the defect

The federal suite went red in four places on the fix. One of them was named
**`a qualifying surviving spouse uses the joint threshold`** and had passed every
day it existed.

**THE RULE: a test written from the same belief as the data can only confirm the
belief. In a package whose claim is that it is cited, a test that restates the
parameter is a spelling check; a test earns its place by restating the STATUTE.**
The four are now written that way, each carrying the sentence it turns on.

### The afternoon: the same bug on the state side, counted by a different helper

`filerCount()` calls a qualifying surviving spouse **two filers**. Day 26 fixed
`perPerson()` to give the status one person and did not touch `filerCount`, and
the two have been disagreeing about the same fact since.

For an **amount** `filerCount` is usually right — and here is the finding that
makes this a judgement rather than an oversight. **California really does give a
widow two personal exemption credits.** Form 540 line 7: *"If you checked box 2
or 5, enter 2"*, and box 5 is the qualifying surviving spouse. The FTB has
answered the question for that line, in the opposite direction to the one the
federal reasoning would predict.

For a **count of people** it is never right, and it was live:

```text
CA  blindOrDisabled: 2 on a widow's return  ->  two $153 exemption credits
MI                                          ->  two $3,400 exemptions ($144.50)
MS                                          ->  two $1,500 exemptions ($60)
IL, IN, NJ                                  ->  the same doubling
single filer, blindOrDisabled: 2            ->  correctly capped at one, always
```

It takes a caller who passes `2`, which is exactly what a caller reading "how
many filers are blind" would pass if they believed the status implied two
filers — that is, a caller who read `filerCount`. And a stray `spouseAge` on the
same return bought a second *senior* allowance through `seniorFilers`.

`livingFilerCount()` now caps every condition, and the two helpers are kept
**deliberately apart** rather than reconciled, because reconciling them means
overruling the FTB about line 7.

**THE RULE: when one fact is counted by two helpers, the bug is not that they
disagree — it is that nothing says which question each one answers.** Both
helpers now carry a doc comment that does, and `filerCount`'s names the five
call sites still reading it for what is plainly a count of people (Pennsylvania's
forgiveness allowance, the poverty-guideline household size, the payroll-tax cap,
the retirement split, New York City's household credit). Each needs that state's
form read before it moves. That is tomorrow's list, written where it will be
found.

### The strongest evidence for the audit came from CI, and it is a NON-event

I pushed the three federal fixes and the state fix, and **the differential job
went green with the golden report byte-identical.** All three defects, across
three tax years, moved **not one figure** in a 646-household grid checked
against an independent model.

That is the argument for the parameter-tree audit, made better than any
reasoning could make it. The grid's surviving spouse earns `$45,000`; § 24 does
not bite until `$200,000`. The grid contains **no businesses at all**, by
design — a business is a fact that needs interpretation to map onto a
PolicyEngine variable — so § 199A is unreachable from it in principle, not by
accident. And every blind case in it is a single filer, who was correctly capped
the whole time.

**THE RULE: a differential test is bounded by the vocabulary of its cases, and
that bound is invisible from inside the report.** Zero unexplained differences
across 4,522 figures said nothing whatever about the largest error this package
has ever shipped, and could not have. The audit that found it does not compare
answers at all — it compares the DATA against the STATUTE, which is the one
check a second model cannot perform for you, because the second model is reading
the same statute and may have read it the same way. PolicyEngine carries
`$400,000` for § 24 too.

### The differential grid, and why yesterday's widening could not have caught this

Day 26 put a surviving spouse in the grid for the first time and she found four
defects. She earns **`$45,000`**, and § 24 does not begin to bite until
`$200,000`. So the grid could not have found today's, however long it ran.

**THE RULE: adding a filing status to a grid tests that status only at the
incomes the grid already had. A case reaches a threshold or it does not; what the
case is CALLED decides nothing.** Three shapes added at `$250,000`, `$300,000`
and `$450,000` — inside the phase-out band, past its end, and past the *joint*
threshold as well, which is the one that distinguishes "this package now uses
`$200,000`" from "this package lost the credit for some other reason". 703 cases.

### What the widened grid came back with

**703 households, 4,921 figures, 4,526 agree to the dollar, ZERO unexplained.**
Two findings and one retirement.

**A fifth defect, and it is the morning's bug in a state statute.** Illinois
disallows its exemption allowance *entirely* above `$500,000` "for returns with
a federal filing status of married filing jointly, or **$250,000 for all other
returns**" (35 ILCS 5/204(g)). It is a cliff, not a taper. `byStatus()` defaults
a qualifying surviving spouse to joint, so a widow between `$250,001` and
`$500,000` kept an allowance Illinois had taken away — **`$289.58` a year**.
Exactly the same sentence shape as § 24, in a different sovereign's code, found
the same day, by a case that could not have existed on Day 26.

**The largest explained entry in the report is now a place where the reference
model is wrong.** 38 differences where PolicyEngine gives a widow with one child
the full `$2,200` § 24 credit and this package gives nothing. The second time
this project has been able to say it is ahead of PolicyEngine rather than behind
— after Allegany County — and the first time on a *federal* figure.

And the `$450,000` shape did exactly the job it was designed for: **it is absent
from that list**, because at `$450,000` both engines say `$0`. Without it the
report could not distinguish "this package now uses `$200,000`" from "this
package lost the credit for some other reason".

### A provisional figure paid off, and the dead-reason detector caught the rest

Chasing the Illinois cliff put the Department's own bulletin in front of me:
**Illinois's 2026 exemption allowance is `$2,925`**, published in Informational
Bulletin FY 2026-15 of December 2025 and confirmed by the Comptroller's 2026
payroll bulletin. This package was carrying the `$2,850` of 2025 forward and
flagging the year provisional — which is the feature working, and which had
never once been *resolved*.

Illinois is now `published`, the first of nine provisional 2026 state-years to
come off that list. **THE RULE: a provisional flag is a debt, not a
disclaimer.** Day 8 invented it as a way of being honest about a figure that did
not exist yet; twenty days later nothing in this project had ever gone back and
looked. Eight are still owed, and each is one search away.

Resolving it cost **eight red tests**, every one of them a real claim about a
number — including a README figure for a pre-v0.19.0 Illinois retiree that
stopped reproducing. That is Day 26's Mississippi lesson arriving a second time:
`$2,588.85` was right about v0.19.0 and `$2,581.43` is right about today, and
the difference is exactly two exemptions' worth of indexation. **A test that
recomputes a historical claim with today's parameters produces today's answer
wearing a date.**

Then `compare.mjs` printed the Illinois provisional divergence entry under
**"Reasons that matched nothing"** — Day 24's other guard, firing for the first
time on a reason that went stale because the thing it described was *fixed*
rather than mis-scoped. Retired it.

### Process notes

- Opening move unchanged: fetch, `npm ci`, full suite before touching anything.
- **`irs.gov`, `uscode.house.gov`, `law.cornell.edu`, `govinfo.gov`,
  `ftb.ca.gov` and `bloombergtax.com` are all blocked** by the egress proxy —
  `curl -sS "$HTTPS_PROXY/__agentproxy/status"` shows the 403s by host, which is
  quicker than guessing. Every statutory text today came from `WebSearch`
  snippets, each cross-checked against a second search for the same sentence.
  The snippets quoted the operative words verbatim in every case, which is
  enough when the words are the whole argument.
- **The MCP `tools/list` ceiling is a wall now: 39,896 bytes of 40,000.** I
  wrote a good filing-status description, the budget test went red at 40,561,
  and the fix was to split it — a tight sentence on the shared property, which
  three tools carry verbatim, and the long version on `HOUSEHOLD_PROPERTIES`
  where it is paid for once and trimmed elsewhere by `x-terse`. **104 bytes of
  headroom.** The next state or tool cannot be added without another structural
  cut, and that is the fifteenth pass talking.
- The root README's table is one giant row per package; appending to a cell with
  a naive string replace put the new text on its own line and silently broke the
  table. It renders as a stray paragraph and no test catches it. Worth a guard.
- The PolicyEngine pass is much slower than Day 26 recorded: **about 40 minutes
  for 703 cases**, not eleven. Start it before anything else and do the engine
  work while it runs.

### What I would do next

1. **The other eight provisional 2026 state-years.** California, Colorado,
   Idaho, Kentucky, Maryland, Michigan, Ohio and Utah. Illinois took one search
   and paid off eight red tests; the flag has existed since Day 8 and was never
   once resolved until today, which means the whole backlog is probably one
   afternoon. Michigan is the best lead — the note already says "one published
   dataset carries `$5,900`", which is a figure somebody has seen.
2. **`filerCount` at the five remaining sites.** Named in its own doc comment,
   with the state form each needs. Pennsylvania is the clearest: PA-40 has no
   surviving-spouse status at all, like Virginia, so a federal widow files
   Pennsylvania as single and the forgiveness allowance should be one claimant.
3. **The married-filing-separately axis of the same audit.** `GROUPINGS` records
   one status; the file's own comments already note that § 24 does NOT halve for
   a separate return, that § 199A is `$25` *higher* than single, and that the
   SALT cap halves. Three different rules in one file and no table says so.
4. **The out-of-state municipal interest addback beyond Illinois.** Fourth day on
   this list. Indiana, Ohio, Virginia and Maryland almost certainly do the same.
5. **Michigan's tier three deduction and its tips and overtime deductions**,
   still the only inconsistency *inside* one release rather than a gap.

---

## Day 26 — 2026-09-20

### What I did

**Two credits in the morning, and then the differential grid found five defects in
one afternoon because I gave it ten household shapes it had never had.**

`us-federal-tax` is **v0.10.0** — its first correction in six days — `us-state-tax`
**v0.23.0** and `us-tax-mcp` **v0.26.0**. **953 tests** (305 + 485 + 147 + 16), up
from 911, all green, zero dependencies. The differential grid went from **437
households to 646**, agreement from 2,836 of 3,059 figures to **4,173 of 4,522**,
and unexplained differences from 0 to 61 and back to **0**.

### The morning: two credits that turn on a fact no income figure carries

**Georgia's eligible itemizer tax credit** — `$300` a taxpayer, `$600` joint, for
having ticked the itemizing box on the FEDERAL return. No income test at any level.
It was the first item on Day 25's list and it is the only rule in this package whose
sole test is the standard-versus-itemized election.

The interesting part is *why it exists*. § 48-7-27(a)(1) ties the Georgia election
to the federal one in **both** directions — a federal itemiser must itemise in
Georgia even where the Georgia standard deduction is larger — and HB 1437 raised
that standard deduction to `$15,000`/`$30,000` while leaving the itemised figure
alone. So after 2024 the compulsion usually runs against the filer, and the credit
is what Georgia pays to offset it:

```text
$300 of credit / 4.99%  =  $6,012 of deduction
```

A Georgia itemiser whose itemised deductions fall as much as `$6,012` **short** of
the standard deduction still comes out ahead, and a joint couple `$12,024` short.
That inverts the rule every guide states about when to itemise, and nothing in a
rate table or a deduction table can show it, because the credit is not a deduction
and the election it turns on is made on another government's form.

Two things fell out of building it. `stateItemizedDeductions` had been **accepted
and silently ignored** for Georgia — the Day 23 bug class — so Georgia now has an
`itemizedDeduction` rule of Virginia's shape. And the MCP server refused
`federalItemized` for Georgia, which made the credit **unreachable through the
server entirely**. A refusal list is a claim about what is not there, and Day 24
already said a test suite full of positive cases cannot see a hole in one.

**Indiana's unified tax credit for the elderly** — IC 6-3-3-9, refundable,
`$100`/`$50`/`$40` for one filer at 65 and `$140`/`$90`/`$80` for two, banded on
**federal** AGI under `$1,000`, `$3,000` and `$10,000`. For a couple living on
Social Security it is the **entire return**: Indiana exempts the benefit, Day 25's
`$5,000` of exemptions takes Indiana AGI below zero, the tax is nothing, and the
`$140` is the only figure that moves.

Two facts the `$40`-to-`$140` headline hides. **None of Indiana's own generosity
buys a dollar of room under the ceiling**, because the ceiling is measured on the
federal figure before Indiana starts. And **the second aged filer is worth `$40`,
not `$100`** — the only per-person amount in this package worth less than half again
for the second person.

The bands are "less than", strictly, so `$1,000.00` exactly is in the band below.
This package's `stepAmount` helper compares with `<=`; reusing it would have been
wrong by `$50` for exactly one household. **THE RULE: a comparison operator is a
parameter. Reusing a step helper whose boundary semantics differ from the statute's
is the cheapest way to be wrong about one filer and right about everyone else** —
which is the kind of error no test written from the same helper will ever find.

### A citation that was wrong, in two places, and neither was mine originally

Day 25 recorded the Georgia credit as **O.C.G.A. § 48-7-29.23**. There is no such
section. The credit is **§ 48-7-27.1**, "Eligible itemizer defined; tax credits".

I got it from PolicyEngine-US, whose *variable* file carries a dead link to
§ 48-7-29.23 and whose *parameter* file for the same credit cites § 48-7-27.1
correctly. Two files in one repository disagreeing about which statute a figure
comes from, and the one I happened to read was the wrong one.

**THE RULE: a citation copied from a second model is a claim about the law that the
second model has not tested either.** The figure was right — `$300`, and it agreed
with two other sources — and the cite was decoration, which is exactly why nothing
caught it. `test/georgia-itemizer-credit.test.js` now asserts that the string
`48-7-29.23` appears nowhere in Georgia's notes or citations.

### The afternoon: the grid had stopped finding things, so I widened it

Day 25 ended with zero unexplained differences and a warning attached: **that means
the grid has stopped finding things, not that the two engines agree**. Twenty-three
household shapes across nineteen states is seven ideas.

I added ten shapes, each one a case an existing shape was a special case of:

```text
couple-no-children        the grid had a couple only WITH children
mixed-dependents          children at 2, 7 and 14 — every per-child credit
                          here bands on age and the only children were 3 and 8
single-parent-teen        too old for every young-child credit, inside § 24
separate-with-child       the separate return in the grid had none
surviving-spouse          the FIFTH FILING STATUS, never once filed
early-retiree             56, below every age test in the package
early-retired-couple      57 and 55
blind-worker              NO CASE IN THE GRID HAD EVER BEEN BLIND
blind-senior              because Indiana and Illinois stack the two
```

646 cases. **61 unexplained differences**, five real defects, and one fault in the
harness itself.

### The largest: a widow was getting the joint earned income credit

`us-federal-tax` gave a **qualifying surviving spouse** the JOINT phase-out
threshold for the § 32 earned income credit. § 32(b)(2)(B) increases the phaseout
amount "in the case of a joint return", and a surviving spouse does not file one —
§ 2(a) hands them the joint **rate schedule** and says nothing whatever about § 32.
The Revenue Procedure prints the grouping in its own row heading: *"Threshold
Phaseout Amount (Single, Surviving Spouse, or Head of Household)"*, against a
separate row for married filing jointly.

```text
surviving spouse, one child, $45,000 of wages, 2026
  ours     $2,215.37      (the joint threshold, $31,160)
  right    $1,053.62      (the single one,     $23,890)
                          ---------
  overstated by $1,161.75, every year
```

It runs in the expensive direction — it **overstates a refundable credit** for
someone who has just lost a spouse — and it is wrong in all three years the package
covers. And it did not stay federal: **six states set their own earned income credit
as a flat percentage of the federal one**, so one parameter wrong for one filing
status moved the state answer in New Jersey, New York, Illinois, Virginia, Indiana
and Maryland at the same time. Eight of the report's sixty-one rows were that one
fact arriving twice.

**THE RULE: a federal parameter is not a federal fact. In a package where states
inherit figures from the federal return, the blast radius of one wrong number is
every state that reads it** — and the differential is the only thing in this
repository that could have shown me that, because it compares the state answer and
the federal one side by side on the same household.

### The same status, again, and the default that was never written down

`perPerson()` — the helper that builds a per-head exemption table — gave a
qualifying surviving spouse the JOINT figure, because `byStatus()` defaults that
status to joint and `perPerson` is built on it.

For a **statutory** amount that default is right: § 63(c)(2)(A) gives a surviving
spouse the joint standard deduction by name, and most states follow. For a **count
of people** it is not. The spouse is dead. Illinois, Indiana and Michigan were each
giving a widow an exemption for a person who is not there — `$141.08`, `$49.70` and
`$246.50` a year.

**And Virginia has no surviving-spouse status at all.** Form 760 offers Single,
Married Filing Jointly and two separate statuses, and the instructions send a
federal head of household *or* qualifying surviving spouse to **Filing Status 1,
Single**. So a Virginia widow takes the `$8,750` standard deduction and one `$930`
exemption: `$556.60` a year.

The detail that makes it a lesson rather than a miss: **Virginia's age deduction and
filing thresholds in this package already said `qualifyingSurvivingSpouse: 50_000`
and `11_950`, the single figures.** Someone — me, on Day 17 — had worked the
question out for two figures in that state and left the other two on a default they
never had to type. **THE RULE: a default you never write is a decision you never
make. Two figures in one state disagreeing about one filing status is what that
looks like from the outside, and the only way to see it is to file a return in that
status.**

### Three states had a provision for blindness and no rule, and the grid was blind

No case in twenty-five days of grids had ever been blind, and the only 65-year-olds
in it were retirees in states that exempt retirement income — where the tax is zero
either way and an exemption cannot show. So:

| | | worth |
| --- | --- | --- |
| California | one more exemption **credit** at 65 and one for blindness, `$153` each | `$306` to a retired couple |
| Michigan | the `$3,400` special exemption, MCL 206.30(3)(a) | `$144.50` |
| Mississippi | `$1,500` at 65 and `$1,500` for blindness, § 27-7-21(f) and (g) | `$60` a box |

California's are **credits**, so the `$306` is the same at `$30,000` and at
`$250,000` — which is the whole reason California states its exemptions that way,
and the reason an engine that models them as deductions is wrong in both directions
at once. They are per person and § 17054(c) and (d) stack, so a blind Californian of
65 claims three personal exemptions.

Michigan's covers **deafness** and total disability under 66 as well as blindness,
and at `$3,400` it is three times the next largest here. Mississippi's two sit on the
**same line of Form 80-105 as the dependents**, which is why every summary that
reports "$1,500 per dependent" has described three of the four boxes on that line.

One more California fix, found by reading rather than by the grid: the AGI
limitation is subtracted from **each line of Form 540 and floored at zero there**,
not netted across the return. Above about `$315,000` a single filer's `$153`
personal credit is already dead and the `$475` dependent credit is not, and one
subtraction across both lets the dead credit eat the live one.

And the MCP server was refusing `blindOrDisabled` for every state outside a
hand-written `['NJ', 'IL', 'IN']` — **so a Maryland caller was refused a field
Maryland's own note tells them to pass**, and Massachusetts and Virginia the same.
That list had been wrong on the day it was written. It is derived from the engine
now, which is what the module's own header said to do: *two copies of a fact that
must agree is a bug with a waiting period.* The waiting period was five days.

### The reference model moved under me, and nothing said so

Six New York households disagreed by about `$1,100` each — differences that had not
existed on Day 25, in an engine I had not touched. An hour later:

**`taxable_pension_income` in PolicyEngine is a SUM of `taxable_public_pension_income`
and `taxable_private_pension_income`, and setting a sum as an input does not reach
the parts.** New York's pension exclusion reads the parts. So the harness had been
feeding New York a pension it could not see, and the two models were answering
different questions for six households.

Why it appeared *today*: `pip install policyengine-us` fetched **2.6.17**, and
whatever version wrote the committed `theirs.json` read the total. Nothing in this
harness recorded which model had answered.

**THE RULE, and it is the day's: a committed answer from an independent model has a
VERSION, and an answer whose provenance you cannot state is not a reference.** So
`theirs.py` now writes `out/theirs.meta.json` with the PolicyEngine version, the
case count, and the SHA-256 of the exact bytes it answered — and `compare.mjs`
**refuses to produce a report at all** when that fingerprint does not match the
cases file in front of it. That is the loose thread Day 25 named and did not pull:
widen `cases.mjs`, and every surviving id still resolves while every changed case is
silently compared against the answer to a different question.

### What the report says now

**646 households, 4,522 figures, 4,173 agree to the dollar (92.3%), ZERO
unexplained** — and four new reasons, two of which are new *kinds*:

- **§ 32(d) for a separate filer.** PolicyEngine turns one parameter true from 2021
  and gives every married-filing-separately return the earned income credit; this
  package requires the § 32(d)(2) facts — lived apart for the last six months, or
  legally separated — which are on no line either model was given. Neither is
  misreading the statute; one assumes the exception applies and the other assumes it
  does not. It reaches the state answer in six states, which is now its own entry.
- **Mississippi's 59½.** § 27-7-15(4)(l) leaves a premature distribution fully
  taxable and this package requires the age; PolicyEngine models the exemption with
  no age test and says so in its own parameter file. A 56-year-old with a `$50,000`
  pension is charged `$1,268` here and nothing there. **It is the one place in this
  package where being right costs the filer money**, and the grid could not see it
  until today because every retiree in it was 67.

### Process notes

- Opening move unchanged: `git fetch origin main && git checkout -B main origin/main`,
  `npm ci`, full suite before touching anything.
- **`cases.mjs` changed, so the PolicyEngine pass had to run — twice, eleven minutes
  each.** The second run was the price of the New York fix, and it was worth paying
  rather than shipping a report built on a question neither model had been asked.
  Run it in the background and do the engine work while it goes; the Node side is
  three seconds and can be re-run as often as you like against a finished
  `theirs.json`.
- Sequence that saved an hour: when the report came back with 61 rows, I re-ran
  **`ours.mjs` alone** against the previous run's `theirs` values scraped out of the
  report table. That prices a candidate fix in three seconds instead of eleven
  minutes, and it is how the surviving-spouse work was verified before either
  PolicyEngine pass finished.
- **A historical figure in a test stopped reproducing, and that was correct.**
  `retirement-by-source.test.js` pinned the README's claim that Mississippi charged
  a retired couple `$1,336.00` before v0.19.0. Today's engine says `$1,216.00` for
  the same household, because v0.18.0 was missing the aged exemptions *as well*.
  Both are right about their own version; the test now asserts the current figure
  and that the `$120` gap is two `$1,500` exemptions at 4.0%. **A test that
  recomputes a historical claim with today's code is not pinning history.**
- `law.justia.com`, `codes.findlaw.com`, `forms.in.gov`, `lawserver.com` and
  `iga.in.gov` are all blocked by the egress proxy. Every statutory text in this
  entry came from `WebSearch` snippets cross-checked against PolicyEngine's
  parameter tree, which carries statutory cites. It held up: the two sources
  disagreed about nothing today except the Georgia section number, where
  PolicyEngine disagrees with itself.
- **Notification sent.** A refundable federal credit overstated for widows, in three
  tax years, is the largest thing this repository has shipped wrong.

### What I would do next

1. **File more statuses and more conditions.** Today is the whole argument: ten
   shapes found five defects in an afternoon, and four of the five were in code that
   had been reviewed, tested and released. The shapes still missing are a dependent
   parent (Indiana's `$1,500` child exemption turns on it and no case has one), a
   filer with self-employment income, a household with a college-age dependent, and
   a state where the filer works in one locality and lives in another.
2. **The § 24 child tax credit threshold for a surviving spouse.** `$400,000` here
   and `$400,000` in PolicyEngine, and Form 8812 says "`$400,000` if married filing
   jointly; `$200,000` all other filing statuses". By the same reasoning that fixed
   the earned income credit it should be `$200,000`. I did NOT change it: irs.gov is
   blocked, the worksheet cannot be read first-hand, and no differential case
   reaches it — the grid's surviving spouse earns `$45,000`. It is written up in
   `src/data/2026.ts` as unresolved. **Raise the grid's surviving spouse above
   `$200,000` and the question answers itself.**
3. **The out-of-state municipal interest addback beyond Illinois.** Third day on
   this list. Indiana, Ohio, Virginia and Maryland almost certainly do the same
   thing and not one is turned on.
4. **Michigan's tier three deduction and its tips and overtime deductions**, still
   the only inconsistency *inside* one release rather than a gap in coverage.
5. **Michigan's special exemption for a disabled DEPENDENT**, and the disabled
   veteran exemption of MCL 206.30(3)(b). Today's rule reads `blindOrDisabled`,
   which counts the filer and spouse only.

---

## Day 25 — 2026-09-19

### What I did

**Closed the two largest clusters in the differential report, and they turned out to be
different kinds of thing.** Indiana's was four missing exemptions — a real defect, in the
engine, worth `$74.55` a child. Maryland's was not a defect at all: 19 of its 20
differences are one county rate this package has and the reference model does not, plus a
figure already flagged provisional. The Maryland case that survived both was a third
thing, a credit that forgives a low-wage Maryland bill entirely.

`us-state-tax` is **v0.21.0** and `us-tax-mcp` **v0.24.0**; `us-federal-tax` untouched at
v0.9.0. **911 tests** (303 + 445 + 147 + 16), up from 892, all green, zero dependencies.
Agreement with PolicyEngine-US went from **2,822 of 3,059 figures to 2,836** (92.3% →
92.7%), and **unexplained differences went from 36 to ZERO** — the first time.

### Indiana publishes the smallest of its four exemptions

Every table of state exemptions prints Indiana's as `$1,000` a person. Schedule 3 has four
lines and that is the first of them:

```text
$1,000  every person on the return          <- the published figure
$1,500  each dependent CHILD                   under 19, or under 24 and a student
$1,000  each filer at 65
$1,000  each blind filer
  $500  each filer at 65 under $40,000 of federal AGI
```

Only the first was computed here. So the published figure is correct for exactly one kind
of household — a working adult with no children — and wrong for every family and every
retiree in the state.

**And the note that admitted it was wrong about its own size.** It said an Indiana family
return "is too high by about `$44` per qualifying child". `$44` is `$1,500` at the **state**
rate, in the one state whose entry in this project's own README leads with the fact that
**two fifths of an Indiana bill is levied by a county**. The real figure in Marion County
is `$74.55`; in Randolph County, at the 3.00% statutory maximum, `$89.25`. **THE RULE: a
number inside a note is a claim like any other and nothing tests it.** Day 24's rule was
that a note telling the caller to do the engine's work is a bug with a docstring; this is
the commoner cousin — a note that admits the gap, prices it, and prices it low enough that
nobody prioritises it.

### The only means-tested exemption in the package, and it is a cliff

`$500` more at 65, if federal AGI is under `$40,000` (`$20,000` filing separately). Nothing
phases. A joint return with both spouses at 65 claims `$3,000` of age exemption at
`$39,999` and `$2,000` at `$40,000`:

```text
one dollar of income at $40,000, Marion County
  $1,000 of exemption lost x 4.97%   =  $49.70
  tax on the dollar itself           =   $0.05
                                        ------
                                        $49.75
```

And the test is on **federal** AGI, which is the figure before Indiana's own subtractions —
so an Indiana deduction that takes a retiree under the line does not buy it back.

### A dependent child and a dependent parent differ by $1,500, and a count cannot tell

The child exemption needs `dependentAges`. A caller who passes `dependents: 2` gets the
`$1,000` each and nothing else, silently, because the engine cannot tell a child from a
grandparent out of a count. That is the same shape as Day 23's silently-ignored field, so
it gets the treatment this package uses for New York's child credit: the result carries a
dynamic note that **prices the omission on this filer's own figures** — "$149.10 of state
and county tax — supply dependentAges."

The student band (19 to 23) is the one place a count is still needed, because a caller says
how many dependents study full time and not which. The engine spends the count on the
**oldest** dependents inside the band, which is the only assignment where the answer differs
at all.

### Maryland's cluster was twenty differences and no defect

Twenty unexplained Maryland differences, the largest cluster in the report, deferred on
Day 23's list and again on Day 24's. Every one of them is two facts:

```text
single-worker-MD   30,000   43.76      Allegany County, 2026
                   50,000   77.76        ours   3.20%
                   80,000  128.76        theirs 3.03%   <- the 2025 booklet
                  150,000  252.09
                  400,000  678.70      + $50 of standard deduction
```

Proved rather than argued: I set Allegany back to 3.03% and the deduction to
PolicyEngine's uprated `$3,400`/`$6,850`, re-ran, and **22 of the 23 Maryland cases agreed
to the cent**. Then reverted both, because this package's figures are the newer ones —
Allegany and Kent both raised their rates for 2026, and PolicyEngine's Maryland county
table cites the 2025 resident booklet and stops there.

**THE RULE: the largest cluster in a report is not necessarily the largest defect, and
finding out which costs about an hour.** Two days of next-steps lists said "start with
Maryland, it is the biggest". It was the biggest and it was not a bug. The Indiana cluster
sitting beside it, half the size, was four bugs.

### The first reason that could not state its size in dollars

Day 24 added `maxAbs` so that an entry in `known-divergences.json` bounds what it claims.
The Maryland entry broke it. One rate disagreement of **0.17 of a point** is `$43.76` on a
`$30,000` household and `$678.70` on a `$400,000` one — the same single fact, fifteen times
the size. A `maxAbs` of `$700` admits both and also admits any Maryland defect under `$700`
for as long as nobody looks, which is precisely the failure Day 24 built `maxAbs` to stop.

So `compare.mjs` now takes **`maxShareOfIncome`**, and the two bounds add: an entry is
allowed `maxAbs` dollars **plus** a share of the household's own income. Maryland's is
`$6` + 0.17%, which is the exact shape of "one rate differs and one fixed figure differs".

**THE RULE, and it is the day's: the shape of a bound has to match the shape of the cause.**
A missing credit is a dollar figure. A rate disagreement is a rate. A bound stated in the
wrong units is either useless or a licence, and `maxAbs` was becoming a licence within
twenty-four hours of being written to stop one.

### Maryland's poverty level credit is the whole bill

One Maryland case survived both corrections: a single worker at `$15,000`, charged
`$160.85` here and `$0` there. Md. Code, Tax-Gen. § 10-709, Form 502 line 23, documented in
this package's own notes as not modelled.

It is the only provision in a Maryland return that can forgive the **entire** bill, and it
does it in two halves at two different rates:

```text
§ 10-709(b)  5% of earned income          against the STATE tax
§ 10-709(d)  the COUNTY'S OWN rate x it   against the COUNTY tax
```

So the credit is worth 2.25% of earnings in Worcester and 3.30% in Dorchester, and there is
no per-county figure stored anywhere — the same economy as the local earned income credit,
which is ten times each county's rate. A rate change moves the tax and both credits in one
line of data.

Two details worth the space. **Both halves are capped at the tax they are claimed against**,
each after that government's own earned income credit, so neither can be paid out: between
them they take a bill to zero and never below it. And **eligibility tests two figures
against one guideline** — federal AGI as modified by §§ 10-204 to 10-206, which is the
*additions* and not the subtractions, and earned income under § 32(c)(2). A Maryland pension
exclusion therefore cannot buy a retiree into it, and a filer with a small wage and a large
pension fails the first test while passing the second.

The single worker at `$15,000` now owes **nothing**, in a state where the calculator had
been charging them `$160.85`.

### Two places where the other model is wrong, which is new

The report now has a class it has never had twice in one entry:

**PolicyEngine charges an Indiana county tax of minus `$101`.** `in_county_tax` is
`rate * in_agi` with no floor. A retired couple both 70 with `$40,000` of Social Security
and nothing else has federal AGI of zero, Indiana exempts the benefit, and the `$5,000` of
exemptions this day added takes Indiana AGI to **minus `$5,000`** — so Marion County pays
them 2.02% of it. The same model floors the *state* tax at zero on the same figure, which
is what makes it an oversight rather than a reading of the statute.

**And Allegany County's 2026 rate, above.** Not wrong so much as not updated; the
difference matters because a rate table with a stale row looks exactly like a rate table
with a fresh one.

### Georgia pays you $300 for itemising, and this package does not know

The last two unexplained differences were the `$400,000` single worker in Georgia and
Virginia, and both are one harness fact one level down. At `$400,000` PolicyEngine's
household **itemises federally** — its only itemised deduction being the state income tax it
is in the middle of computing — and two states follow the federal election:

- **Virginia** requires a federal itemiser to itemise on the state return and subtracts
  state income tax from the total, which in this harness leaves **zero**. `$8,750` of
  standard deduction at 5.75% is the `$503.13`.
- **Georgia** allows the itemised figure *and then pays `$300` a taxpayer for having
  itemised* — O.C.G.A. § 48-7-29.23, the eligible itemizer tax credit, with **no income
  test at any level**. `$347.55` of deduction plus `$300` of credit is the `$647.55` to the
  cent.

The Georgia credit is worth the same `$300` at `$50,000` and at `$5,000,000`, which makes it
the largest thing in this package that turns on the standard-versus-itemised election rather
than on income. It is now named in Georgia's notes and is not modelled; it is the first item
on tomorrow's list.

### Process notes

- Opening move unchanged and it paid again: `cases.mjs` was byte-identical after
  regeneration, so the committed `theirs.json` stayed valid and **the ten-minute
  PolicyEngine pass never had to run**. The Node side is three seconds.
- `pip install policyengine-us` still works behind the proxy and was still worth two
  minutes: every figure in this entry that belongs to Indiana or Maryland came out of its
  parameter tree with a statutory cite attached, and the two model *defects* above came out
  of reading its variable source, which a parameter check would never have reached.
- **`iga.in.gov` is blocked by the egress proxy**, so Indiana's subdivision numbers could
  not be read first-hand. The package cites § 6-3-1-3.5(a) at the subsection level and adds
  the IT-40 instruction booklet rather than claiming a subdivision it could not verify.
  PolicyEngine's own parameter files disagree with each other about whether the child
  exemption is (a)(4)(A) or (a)(5)(A), which is the argument for not copying one.
- The MCP refusal list caught me again, the way Day 24 said it would — but this time the
  *test* caught it rather than a call by hand. Adding Maryland to `federalPovertyGuideline`
  in `state-fields.ts` left the separate refusal in `tools.ts` saying "VA only", and test 69
  failed on the mismatch. **The guard Day 24 wrote is the reason today cost a minute instead
  of a release.**
- One self-inflicted wound: the first Indiana cliff test asserted `$49.70` and got `$49.75`,
  because the extra dollar is taxed as well as costing the exemption. The test was wrong and
  the engine was right, and the corrected figure is the better fact.

### What I would do next

1. **Georgia's eligible itemizer tax credit** — `$300` a taxpayer, `$600` joint, no income
   test, O.C.G.A. § 48-7-29.23. Documented today and not modelled, which is exactly the
   state Indiana's exemptions were in this morning. It needs the standard-versus-itemised
   election, which the package already carries as `federal.deductionKind`.
2. **Indiana's unified tax credit for the elderly** (IC 6-3-3-9) — `$40` to `$140`,
   refundable, for a filer at 65 with under `$10,000` of AGI. Small, but it is the last
   Indiana line this package does not compute, and it is refundable, so for the households
   it reaches it is the whole answer.
3. **The out-of-state municipal interest addback beyond Illinois.** Still the same argument
   as Day 24: PolicyEngine models it for Illinois and nobody else, Indiana and Ohio and
   Virginia almost certainly do the same thing, and the way to find out is one state at a
   time from a statute rather than from a list.
4. **Michigan's tier three deduction and its tips and overtime deductions**, both still on
   the list from Day 24 and both still the only inconsistency *inside* one release rather
   than a gap in coverage.
5. **Widen the differential grid now that it is clean.** Zero unexplained differences means
   the grid has stopped finding things, not that the engines agree — 437 households is
   seven shapes. A filer with dependents of different ages, a blind filer, a separate return
   with children and a household at the poverty guideline would each have found something
   today. When `cases.mjs` changes, `theirs.json` has to be regenerated, and the CI job does
   not notice a stale one: that is still the loose thread.

---

## Day 24 — 2026-09-18

### What I did

**Closed the `CALLER-SUPPLIED` class.** Four states that exempt most or all retirement
income were taxing it — Illinois, Mississippi, Michigan, New York — and a fifth that every
summary puts on the same list turned out not to belong on it. Also the **Illinois child tax
credit**, an Illinois **senior exemption**, and a guard on the differential harness that
exists because of what today found inside its own report.

`us-state-tax` is **v0.19.0**, `us-tax-mcp` **v0.22.0**, `us-federal-tax` untouched at
v0.9.0 — and by the end of the day **v0.20.0** and **v0.23.0**, for the afternoon's work
below. **892 tests** (303 + 426 + 147 + 16), up from 863, all green, zero dependencies
anywhere. Agreement with PolicyEngine-US went from **2,803 of 3,059 figures to 2,822**
(91.6% → 92.3%), and the four caller-supplied classes are gone from the report.

### The headline: the notes were right and the engine was wrong

Every one of the four states carried a note saying what it did:

```text
IL  "...are NOT detected and must be supplied through `subtractions`"
MS  "...are exempt too and are NOT detected — supply them through `subtractions`"
MI  "Not modelled; supply it through `subtractions`."
NY   nothing at all — the $20,000 exclusion was not mentioned on the state
```

**The package accepted a `retirement` split containing everything needed to compute all
four and taxed the pension anyway.** A retired couple with a `$60,000` pension and
`$40,000` of Social Security was charged `$2,588.85` in Illinois, `$2,057.00` in Michigan
and `$1,336.00` in Mississippi. All three charge **nothing at all**.

**THE RULE: a note that tells the caller to do the engine's work is a bug with a
docstring.** Day 23's failure was a field accepted and silently ignored; this is the same
failure *documented*, which is worse, because writing the note is what stopped anyone
asking why the engine could not do it. The data was there. Georgia's, Maryland's and
Kentucky's exclusions had been reading the same fields for ten days.

### Four states, four constructions, and every difference is worth money

| | age | cap | scope |
| --- | --- | --- | --- |
| Illinois, 35 ILCS 5/203(a)(2)(F) | **none** | none | each person |
| Mississippi, § 27-7-15(4)(k) | 59½ | none | each person |
| New York, Tax Law § 612(c)(3-a) | 59½ | `$20,000` | each person |
| Michigan, MCL 206.30(1)(f), (9) | none from 2026 | `$67,610`/`$135,220` | **the return** |

**Illinois has no age test at any point.** A 40-year-old drawing a `$200,000` pension pays
Illinois nothing on it. Every table that groups Illinois with Mississippi as "does not tax
retirement income" hides the only difference that matters to someone retiring at 52:
Mississippi's § 27-7-15(4)(l) leaves a premature distribution fully taxable.

**Michigan's cap is one figure for the RETURN and it is keyed to the OLDER spouse** — Form
4884 asks for one birth year and one only. So a 66-year-old married to a 58-year-old
qualifies the *younger* spouse's pension, which is the opposite of every other per-person
retirement rule in this package. And military retired pay is exempt in full **and comes off
the shared cap**, in that order: Worksheet 3.3 subtracts it on line 3 and applies the
phase-in percentage on line 4. Scaling first and subtracting after gives a military retiree
a larger deduction than the form does, **and only them** — the kind of error a grid of
households with no veteran in it never finds.

**New York's `$20,000` is per person and unused room is lost.** The same `$40,000` of
pension is excluded in full when a couple split it and half taxed when one of them holds
it: `$1,080` of New York tax decided by whose name is on the plan.

### The largest fact about a New York retirement, and no ranking shows it

§ 612(c)(3)(i) and (ii) exempt a federal, New York State or New York local government
pension **in full, at any age**, over and above the `$20,000`:

```text
single, 70, $90,000 pension, 2026
  retired New York City teacher     $0.00
  retired private-sector worker  $3,183.00
```

Same street, same income, same age. And because it asks who the employer was rather than
how old the retiree is, a police officer who left at 45 pays nothing **fourteen years
before** the `$20,000` is available to anybody else.

That is what broke the shape of the rule I had written. I had one `minimumAge` gating the
whole thing, which would have taxed a pension the state exempts outright — and would have
done it to the group most likely to be under 59½ in the first place. `cappedMinimumAge`
exists because of that officer. **THE RULE: when one rule has two age tests, the exemption
without one is usually the older and more generous provision, and gating it on the newer
one's age is the expensive direction of wrong.**

PolicyEngine-US does not model this exclusion at all, which is the first entry in a class
the report did not have: **NOT MODELLED THERE**.

### North Carolina is not a retirement state and that is the finding

Yesterday's list said "Illinois, Michigan, Mississippi and North Carolina exempt most or
all retirement income". **North Carolina taxes a pension, an IRA distribution and a 401(k)
distribution in full at 3.99%.** The only three things it lets go are Social Security, the
Bailey cohort (vested before 12 August 1989, unknowable from any figure on a return) and
military retired pay, which G.S. § 105-153.5(b)(11) deducts in full with no cap and no age
test.

So North Carolina got a `retirementIncomeSubtraction` with a cap of **zero** — a rule that
subtracts only what it exempts in full — and a note that says in its first sentence that
the state does not belong on the list. Against a state that taxes every other pension, that
military deduction is the largest such preference in the package: `$1,685.78` a year on a
`$55,000` pension, where Maryland's caps out at `$20,000` of income.

**THE RULE: "these four states do X" is a claim about four states, and the cheapest one to
check is the one you are least suspicious of.** I would have implemented a general North
Carolina retirement exclusion on yesterday's say-so if the parameter tree had not had
nothing to implement it from.

### The harness was lying, in the way harnesses lie

The four classes went away and agreement rose — and the *count* of unexplained differences
did not move at all, 36 before and 36 after. That is because `known-divergences.json`
matches on **state and metric**, so an entry saying "the caller must supply the pension"
was matching every Illinois difference of every kind. Behind those four sentences sat:

- **an Illinois child tax credit I had never heard of** — 35 ILCS 5/244, 40% of the
  Illinois earned income credit for a filer with a child under 12, worth `$600.13` on one
  household in the grid;
- **Michigan's 2026 personal exemption**, which PolicyEngine projects at `$5,950` and this
  package carries forward at `$5,800` and flags — `$6.38` an exemption;
- **the New York household credit**, which PolicyEngine does not model in either direction;
- **the North Carolina child deduction**, already a documented gap;
- **the Michigan home heating credit**, refundable, worth more than the entire Michigan
  income tax of the two households it reached.

Five different causes, all reported as **explained**, for weeks.

So `compare.mjs` now takes `maxAbs` on an entry and most entries carry one. A difference
larger than the size a reason claims is unexplained however well the rest of it matches.
**THE RULE: a divergence entry matched on a state alone is a licence to be wrong about that
state in any way at all. A reason has to state its size, so the report can fail in the one
direction that matters — a known small gap growing into an unknown large one.**

### Illinois's child tax credit is a credit made of a credit

40% of the Illinois earned income credit, which is 20% of the federal § 32 credit. Two
things follow that no table of state child credits carries.

**The child is a switch, not a multiplier.** One child under 12 and four children under 12
are worth exactly the same, because the amount is a function of the earned income credit
and not of the family.

**It is withdrawn faster than any credit here that has a phase-out of its own**, and it
does not have one:

```text
head of household, two children, 2026 — measured, not read off a table
  40% x 20% x 21.06%   =  1.68c per dollar   (the child credit)
         20% x 21.06%  =  4.21c per dollar   (the earned income credit)
         the flat rate =  4.95c per dollar
                         -----
                         10.85%   <- in a state whose whole tax policy is one rate
```

With **one** child the federal taper is 15.98% rather than 21.06% and Illinois's rate is
**9.42%**. So how flat Illinois is depends on how many children a household has, in a state
with no per-child anything.

### The ranking moved under Utah again, and Utah still has not moved

Day 22: Utah 24th → 16th, by being modelled. Day 23: 16th → 22nd, without its figure
changing, because ten states stopped taxing Social Security. Today: **22nd → 25th**, again
without moving, because three states stopped taxing pensions.

```text
retired couple, both 70, $40,000 benefit, $60,000 pension — 2026
  IL  2,588.85 -> 0.00      MI  2,057.00 -> 0.00
  MS  1,336.00 -> 0.00      NY  2,040.80 -> 79.05
```

**Nine states have passed Utah in three days and not one of them by changing its own law.**
The site's allocation finding grew with it: three states used to charge a different tax on
the same household totals depending on whose name the pension is in, and now there are
four, worth `$5,344.85` instead of `$4,264.85`. New York joined by being modelled — its
exclusion has been per person since 1981.

### And one place where this package is too LOW, which is new

`muni-retiree-IL` now returns `$0.00` where PolicyEngine returns `$106.43`, and PolicyEngine
is right. **Illinois adds back interest on the obligations of other states** — 35 ILCS
5/203(a)(2)(A) — while exempting its own, so a retiree holding out-of-state municipal bonds
owes Illinois tax on income the federal return never saw. This package takes
`taxExemptInterest` as one total and cannot tell an Illinois bond from an Indiana one.

Every previous difference this harness found had this package charging **too much**. This
is the first one the other way, and it appeared the moment a subtraction got big enough to
take the base to zero. **THE RULE: a correction that removes income can expose an addition
that was never there, because until the base reached zero nothing depended on it.**

### Afternoon: the guard, the addition, and the same bug twice

Three of the five things on this entry's own "what I would do next" list got done the same
day, and the third one found the second instance of the morning's bug.

**The differential now runs on every push.** PolicyEngine's answers are committed, so the
cheap half costs three seconds: CI regenerates `cases.json`, `ours.json` and `REPORT.md`
and fails if any of them changed. It is a golden file and it fails on a FIX as well as on a
regression, which is the point — Day 24's morning is what happens when a classification is
allowed to drift from the code that produced it. Proved it fires twice before trusting it:
once by editing the report, once by moving the Illinois rate a single basis point, which
took agreement from 2,822 to 2,821 and unexplained from 36 to 39.

**Illinois's municipal interest addition closed the understating gap.** `taxExemptInterest`
was the wrong figure and taking it would have taxed an Illinois resident on Illinois bonds,
so `outOfStateMunicipalInterest` is a new field and the harness passes the same dollars to
both sides under the name each model asks for. The Illinois case went from `-$106.43` to
`+$7.42`, which is exactly the provisional exemption gap.

**And a smoke test caught a bug the whole test suite had not.** The MCP server refuses a
field a state does not read, and its list said `filerAge` applies to seven states — none of
them the four whose retirement rules had just started needing an age. An Illinois caller
could not pass the age its senior exemption needs. 147 MCP tests passed with that in place,
because every one of them tested a state that was already on the list. **THE RULE: a
refusal list is a claim about what is NOT there, and a test suite full of positive cases
cannot see a hole in it. One call by hand found it in a minute.**

**Then the dead-reason detector found the morning's bug again, in my own afternoon work.**
`compare.mjs` now lists entries in `known-divergences.json` that matched nothing, and the
first run printed three. One was the Illinois muni reason, correctly retired. One was New
Jersey's, genuinely resolved. **And one was Michigan's provisional exemption reason, which
had stopped matching because the home-heating entry I added this morning sat in front of it
in the file and swallowed everything.** `find` takes the first match, so a wide reason
listed before a narrow one makes the narrow one dead — and the report said 201 explained
either way. Fixed by ordering narrow before wide, which is now a property of the file
rather than an accident of when an entry was appended.

**THE RULE, and it is the day's: a report that only lists what it FOUND cannot show you a
reason that stopped being true.** `maxAbs` catches a reason that explains too much. The
dead list catches one that explains nothing. Both failures are invisible in a count of
explained differences, and I shipped one of each within four hours of writing the rule.

`us-state-tax` is **v0.20.0** and `us-tax-mcp` **v0.23.0**. **892 tests.**

### Process notes

- Opening move unchanged: `git fetch origin main && git checkout -B main origin/main`,
  `npm ci` and the full suite in each package before touching anything.
- **`out/theirs.json` is committed, so the PolicyEngine pass did not have to run.**
  `cases.json` was byte-identical after regeneration, which is the precondition: the whole
  ten-minute half of the differential was free today, and the Node side is three seconds.
  That is the payoff Day 23 built and did not get to collect.
- `pip install policyengine-us` still takes about two minutes and works behind the proxy.
  It was worth it anyway — **every parameter in this entry came from its tree with a
  statutory cite attached**, and the two Michigan caps, the New York cap and age, the
  Illinois credit rate and the Michigan phase-in percentages were all read there.
- The venv is now in `.gitignore`. It was not, and `git add -A` staged 3,000 files of numpy.
- One self-inflicted wound worth recording: a `python3` string replacement put an
  unescaped apostrophe inside a single-quoted TypeScript note, `npm run build -s` had its
  output redirected to `/dev/null`, and the test run failed on a **stale `dist/`** with a
  syntax error from a file I had not looked at. **Never redirect a build's output away when
  the next thing you do is trust its artefact.**
- **Notification sent.** Four states of wrong retiree tax, shipped, is the same class of
  defect as yesterday's ten.

### What I would do next

1. ~~The out-of-state municipal interest addback.~~ **Done this afternoon, for Illinois
   only.** The mechanism is there and one state uses it. Indiana, Ohio, Virginia, Maryland
   and most of the other twenty-three almost certainly do the same thing, and not one of
   them is turned on, because the only source that survives the proxy — PolicyEngine's
   parameter tree — models this addition for Illinois and nobody else. **Verifying the
   other states one at a time is the next day's work, and today is the argument for doing
   it one at a time**: the morning of Day 24 is what a list copied without checking costs.
2. **The 20 Maryland and 14 Indiana unexplained differences**, still the largest cluster and
   still untouched. Indiana's is `$149.10` for a joint return with children and `$99.40` for
   a joint retired couple — `$3,000` and `$2,000` of exemption at the combined 4.97% rate.
   Yesterday's note said start there and it was right; today went somewhere else because
   the caller-supplied class was bigger.
3. ~~Put `compare.mjs` in CI.~~ **Done this afternoon.** The `differential` job regenerates
   all three artefacts and requires that nothing changed. What is still manual is the
   PolicyEngine pass itself, which only matters when `cases.mjs` changes — and the job does
   not notice a stale `theirs.json`, so a future run that widens the grid has to remember to
   re-run it. That is the next thing to make automatic.
4. **Michigan's tier three and its standard deduction** (MCL 206.30(9)) — `$20,000` single
   and `$40,000` joint against ALL income for filers born 1946-1952, and the variants for a
   filer with no Social Security coverage. Where one of those beats the deduction computed
   here, a Michigan return is still too high.
5. **The Michigan tips and overtime deductions** (Public Act 24 of 2025, 2026-2028).
   Georgia's equivalents are modelled and Michigan's are not, which is an inconsistency
   inside one release rather than a gap in coverage.

---

## Day 23 — 2026-09-17

### What I did

**Ran PolicyEngine-US as a model instead of reading it as a table**, and it found that
**ten states were taxing Social Security benefits they exempt by statute.** Also Utah's
child tax credit, Georgia's brand-new one, a federal deduction that two fields had to
agree about and did not, and a per-person pension that one credit could not see.

`us-federal-tax` is **v0.9.0**, `us-state-tax` **v0.18.0**, `us-tax-mcp` **v0.21.0**.
**863 tests** (303 + 397 + 147 + 16), up from 843, all green, zero dependencies anywhere.

The new thing in the repository is `tools/differential/`. Everything else today came out
of it.

### The headline: `taxableSocialSecurity` was accepted by nineteen states and applied by four

Thirty-seven of the forty-one states with an income tax do not tax Social Security.
This package subtracted the federally taxable benefit in **four** of them — Georgia,
Kentucky, Maryland, Virginia — and taxed it in **ten** that exempt it by statute:

```text
Arizona  A.R.S. § 43-1022(2)          Michigan        MCL 206.30(1)(f)
California  R&TC § 17087              Mississippi     § 27-7-15(4)(g)
Idaho    Idaho Code § 63-3022         North Carolina  G.S. § 105-153.5(b)(5)
Illinois 35 ILCS 5/203(a)(2)(F)       New York        Tax Law § 612(c)(3)(ii)
Indiana  IC 6-3-1-3.5(a)              Ohio            R.C. 5747.01(A)(5)
```

`taxableSocialSecurity` is an input those returns take. It was read by Utah's credits and
Virginia's age deduction and by nothing else. **A field the caller supplied, accepted
without complaint, and silently not applied** — the exact failure Day 22 named when
`county` turned out to be accepted by Alaska. Worth up to **`$1,517.40`** a year to one
household in the grid.

**And it survived the 377 state tests that had shipped — and the 14 more I had written that morning — because no test was aimed at it.** Nothing in the package
ever claimed "Arizona exempts Social Security", so no test asserted it, so nothing
noticed that it did not. **THE RULE: a suite organised by feature has a hole exactly
where no feature was claimed, and that hole is invisible from inside the suite.** You
cannot find it by writing more tests of the kind you already have; you need a second
opinion about the *subject*, not about the code.

### Which is what the day was actually about

PolicyEngine-US has been the reference here since Day 13 — as a **parameter** source.
Clone it sparsely, read the YAML, check a figure against its statutory cite. Ten days of
journal entries record it working.

Today it was `pip install policyengine-us` and **run**. It works offline, downloads no
data for a hand-built household, and costs about a second a simulation. 437 households
across 19 taxing states and 8 shapes, both engines over the same generated JSON, every
figure compared to the dollar:

```text
first run   2,581 of 3,059 figures agree (84.4%)
after today 2,803 of 3,059 figures agree (91.6%),  36 unexplained, largest $678.70
```

**THE RULE, and it is the one to keep: a parameter check tells you the number you stored
is the number they stored. Running both models tells you whether the two COMPUTATIONS
agree, and every interesting error lives there** — the ordering of credits, which income
a phase-out reads, what a state does with a figure it inherits. Nothing in a parameter
file has an opinion about any of that.

Day 22's version of this was "a second consumer is a code review you do not have to
write" — the site's Blob loader found four module cycles. **A second *implementation* is
stronger than a second consumer, because it disagrees about the subject rather than
about the packaging.**

### Three more defects, all of the same shape

1. **`age` and `age65OrOlder` are two fields for two statutes, and supplying one left the
   other false.** `age` is the § 32 earned income credit test; `age65OrOlder` drives the
   § 63(f) additional standard deduction and the `$6,000` Schedule 1-A senior deduction.
   A 67-year-old passed as `age: 67` lost **`$8,050`** of deduction in 2026 — `$966` of
   tax — with nothing in the result to say so. `age65OrOlder` now defaults to
   `age >= 65`.
2. **Ohio's retirement income credit read `retirementIncome` and the caller had supplied
   `retirement`** — the same fact at a finer resolution, because three states need it per
   person. A caller who gave the *more* detailed field got a zero credit. Showed up as a
   flat `$200` on every Ohio retiree in the grid.
3. **The harness's own metric was wrong twice**, and both are worth recording because
   they are how a differential test lies to you. PolicyEngine's `ctc` is the credit
   *before* the tax-liability and refundable limits — `ctc_value` is what the household
   gets — so 57 households looked like a disagreement about the federal child credit and
   were a disagreement about a variable name. And `state.tax` was compared against this
   package's `tax`, which excludes local tax, while PolicyEngine's `state_income_tax`
   includes Maryland's county tax. Every Maryland household looked like a `$700`–`$12,000`
   error.

**THE RULE: the first output of a differential test is a list of questions about the
harness. Three of the four largest clusters in the first run were mine.** That is not a
reason to distrust it — it is the cost of admission, and it is paid once.

### And the reference model has a boundary that moves

Fixing the Maryland comparison broke Indiana, in the opposite direction. PolicyEngine's
`state_income_tax` **includes** Maryland's county income tax and **excludes** Indiana's,
although both are universal, both are levied on every resident, and both are computed on
the state return's own bottom line. No household in either state can avoid either tax.

So "state income tax" is not a well-defined quantity across two models, and the only
honest fix was to state it: `theirs.py` now adds `in_county_tax` back, with the reason in
a comment. **A number that two careful models compute differently because they drew a
boundary differently is not a bug in either of them, and it is exactly what a
differential test exists to surface.**

### The ranking moved under Utah, and that is the real lesson about depth

Day 22 celebrated Utah moving eight places on the site's table, 24th to 16th of 28, and
drew from it: *a table of 28 with one wrong row is 28 wrong rows.* Today the claim got
tested rather than asserted.

**Utah's own figure did not move today. Utah fell from 16th to 22nd anyway.**

```text
retired couple, both 70, $40,000 benefit, $50,000 pension — state tax, 19 taxing states
          before      after        rank
ID      1,517.28       0.00      10 -> 2
NY      3,018.20   1,500.80      18 -> 16
IL      3,583.80   2,192.85      19 -> 19   (still last, and still missing its pension rule)
MS      2,060.00     936.00      14 -> 12
MI      2,826.25   1,632.00      17 -> 17
CA      1,089.38     244.18       8 -> 7
AZ      1,106.25     362.50       9 -> 8
MA      1,990.00   1,990.00      13 -> 18   (unchanged, and six places worse)
```

**Fifteen of the nineteen changed place. Massachusetts fell five places without its number
moving by a cent.** A ranking is a claim about every row *simultaneously*, so being right
about one row buys nothing on its own — and being wrong about ten makes the other nine
wrong too, in the only sense a reader cares about.

### Utah's child tax credit: 20% in a 4.45% state

On yesterday's list, and it is the fourth Utah rule that beats the state's headline rate.
`$1,000` for each child under 6, withdrawn at **ten cents on the dollar** — 2.2 times
Utah's own tax rate, so **the withdrawal is a bigger tax than the tax is.**

```text
joint, children aged 3 and 8, wages rising
   wages    UT tax   marginal
  55,000      0.00      0.00%
  61,000      0.00      0.00%   <- the band starts, and the credits still cover the tax
  64,200    281.09     20.00%   <- 4.45 + 10 + 1.3 + 4.21
  70,000  1,266.14     16.00%
  75,000  1,653.64      6.00%
```

**20.00%** is four rules with no bracket among them: the rate, this credit at ten cents,
the Taxpayer Tax Credit at 1.3 cents, and the Utah earned income credit at 20% of the
federal credit's 21.06% withdrawal. It is **higher than the 15.26%** Day 22 found for a
Utah retiree, and it lands on a household earning `$64,000`.

**And a family with MORE eligible children faces a LOWER rate.** Two children under 6 is
`$2,000` of credit, and at a fixed ten cents that takes `$20,000` of income to withdraw —
which carries the band's end *past* the earned income credit's own withdrawal instead of
through it, and leaves the peak at 16%. **The rule: when a credit is withdrawn at a fixed
RATE, its size sets the LENGTH of the band, so making a credit bigger moves where it
overlaps every other withdrawal.** Generosity and marginal rate are not monotone in each
other.

One structural note worth more than the rate: **§ 59-10-1047(4) withdraws this credit
against TC-40 line 9 — after every Utah subtraction — while §§ 59-10-1019 and 1042
withdraw the retirement credits against line 6, before them.** Same return, same year,
two different incomes. A `$5,000` Utah subtraction restores `$500` of child credit and
does nothing at all for a retiree's. A package with one "state income" figure cannot
express it and is wrong about one of the two.

### Georgia has a child tax credit for the first time, and it is three weeks old

HB 136 (2025): **`$250` for each child under 6, first available for tax year 2026, with
no phase-out and no cap on the number of children.** It showed up as a flat `$250` on
every Georgia family in the grid and I had never heard of it. It is worth the same at
`$40,000` and at `$400,000` — the only other credit in this package with no income test
at all is Massachusetts's.

**That is the second kind of value a differential test has**: not only "you are wrong
about this", but "a legislature did something and nobody told you". A parameter diff
would have shown it too, but only if I had thought to diff Georgia.

### What is left unexplained, which is the point of the report

`tools/differential/REPORT.md` is committed. 36 differences have no recorded reason:
**20 Maryland**, **14 Indiana**, one Georgia and one Virginia, all at high incomes or in
the two county states, none above `$678.70`. Every other difference is matched by an
entry in `known-divergences.json` that has to give a reason and a class — NOT MODELLED
HERE, CALLER-SUPPLIED, PROVISIONAL FIGURES, or HARNESS.

The four classes are the useful part. **CALLER-SUPPLIED is the uncomfortable one**: the
package documents that Illinois, Michigan, Mississippi, North Carolina and New York need
their pension exclusions passed in through `subtractions`, and the site does not pass
them, so **the site's own ranking is still too high for those five.** That is tomorrow's
first job and it is now a measured gap rather than a suspicion.

### And CI caught something the local suite could not, which is the right way round

The push went red. `us-state-tax`'s new Utah test imported
`../../us-federal-tax/dist/esm/index.js` to build the federal side of a family
return — convenient locally, where both packages are built, and broken in CI, where
each package's job builds only itself. 384 tests ran instead of 397: the file failed
to import and took its fourteen with it.

The fix is better than the import. The federal figures those households need are a
standard deduction and a § 32 credit, and both are now **computed in the test from
published 2026 parameters**, in the open, so the arithmetic behind the 20% marginal
rate can be checked by eye instead of taken from another engine. **The rule: a test
that reaches into a sibling package's build has quietly added a dependency the package
does not declare** — these two do not depend on each other in either direction, and
that is a property worth more than the convenience.

Day 22's rule was that a guard which can only fail in CI is a guard you will trip. This
is its complement: **a guard that can only fail in CI is sometimes the only guard
there is**, because the thing it tests — one package building alone — is a condition a
developer's machine never reproduces. The answer is not to move it; it is to make the
failure cheap, which a three-second job does.

### Process notes

- Opening move unchanged: `git fetch origin main && git checkout -B main origin/main`,
  `npm ci` and the full suite in each package before touching anything.
- `pip install policyengine-us` into a venv takes about two minutes and works behind the
  proxy. **It is not in the repository and must not be**: it pulls numpy, pandas and
  microdf. `tools/differential/README.md` has the four commands.
- The PolicyEngine pass is ~9 minutes for 437 households. Run it in the background and do
  something else; the Node side is 3 seconds.
- Primary sources — `le.utah.gov`, `legiscan.com` — still blocked at the proxy. Every
  figure today came from PolicyEngine's parameter tree with its statutory cite attached,
  which is the channel Day 17 opened and it has now paid twelve days running.
- **Notification sent.** Ten states of wrong retiree tax, shipped, is the largest
  correctness defect this project has found in itself.

### What I would do next

1. **Close the CALLER-SUPPLIED class for the site.** Illinois, Michigan, Mississippi and
   North Carolina exempt most or all retirement income and the site does not ask for it.
   Either the engine detects it from `retirement` (which it now has a helper for) or the
   site passes `subtractions`. **The site's headline ranking is wrong for five states
   until this is done**, and today's entry is the proof that a wrong row is a wrong
   table.
2. **The 20 Maryland and 14 Indiana unexplained differences.** Both are county states and
   both clusters are flat within a filing status, which smells like an exemption or a
   credit rather than a rate. Indiana's is `$149.10` for a joint return with children and
   `$99.40` for a joint retired couple — `$3,000` and `$2,000` of exemption at the
   combined 4.97% rate. Start there.
3. **Colorado's Social Security subtraction.** C.R.S. § 39-22-104(4)(f) — all of the
   federally taxable benefit at 65, and from 2025 at 55-64 under an AGI test. It is the
   one state here that taxes the benefit and has a subtraction rather than a credit, so
   it needs a rule and not a flag. `test/social-security.test.js` pins the current
   behaviour so the fix will announce itself.
4. **Put the differential in CI, or at least a subset.** The Node side is 3 seconds and
   `out/theirs.json` is committed, so `compare.mjs` could run on every push against the
   stored reference answers and fail if an unexplained difference appears that was not
   there before. That turns a day's work into a permanent guard. The PolicyEngine pass
   would stay manual until someone wants to pay ten minutes of CI for it.
5. **Widen the grid rather than deepen it.** 437 households found ten states in one run.
   The obvious next axes are itemising households (which needs the SALT circularity
   handled), self-employment, and 2025 as well as 2026 — the year axis is free and the
   package claims both.

---

## Day 22 — 2026-09-16

### What I did

**Utah's three retirement credits**, the **structural fix to the MCP payload** that four
previous days named and deferred, **the allocation finding on the site's face**, and **a
single-file build of the calculator that came out of proving yesterday's note wrong.**

`us-state-tax` is **v0.17.0** and `us-tax-mcp` is **v0.20.0**. **843 tests** (303 + 377 +
147 + 16), up from 801, all green, zero dependencies anywhere. `us-federal-tax` is
untouched at v0.8.0. (The last commit message of the day says 877; it is 843. The
message is immutable and this is the record that is not.)

Three of those four were on yesterday's list. The fourth was not, and it is the one
worth reading first.

### The note I wrote yesterday was false, and opening the thing proved it

`NOTES-FOR-HUMAN.md` said, of the Pages workflow's downloadable artifact: *"Open
`index.html` from that artifact and the calculator works offline."* I opened it in
Chromium this morning from a `file://` URL:

```text
Access to script at 'file:///.../app.js' from origin 'null' has been blocked by CORS
policy: Cross origin requests are only supported for protocol schemes: chrome,
chrome-extension, ..., http, https.
```

**Blank page.** A `<script type="module">` cannot be loaded from `file://` in any
Chromium browser, and the whole site is modules — that is the same zero-dependency
property Day 20 and Day 21 both cashed in.

What makes this worth a section rather than a line is *where* the mistake sits. Day 21's
rule was **a page you have not looked at is a guess**, and I wrote it after rendering the
hosted page at four viewport sizes. I then made a claim about the *download* without
opening the download. **The rule was applied to the artifact I was proud of and not to
the sentence I was writing.** Day 21 also caught itself announcing the site as live
before the run was green, and recorded it as a near miss; this is the same error,
committed, one sentence further on.

**The generalisation: a claim about how something behaves in a context you have not
entered is a guess no matter how well you know the thing.** I knew every module in that
artifact. I had never double-clicked it.

### And the fix is better than the thing it corrects

`site/dist/retirement-tax-calculator.html` is now the whole calculator in **one 622 KB
file** — markup, stylesheet, and all 46 modules — and `dist.yml` attaches it to a rolling
`calculator` release on every push. Download it, double-click it, it works: no server, no
install, no network, **and nothing switched on by anybody**.

That last clause is the point. Day 21 ended with an ask — one dropdown, *Settings → Pages
→ Source: GitHub Actions* — and the deploy job was still skipped on today's run, so the
dropdown has not been flipped. Day 21's own next-step note said that if the ask went
unanswered, *the response is not to ask louder; it is to ask whether the site needs Pages
at all.* **It does not.** A release asset is a distribution, the human does not have to
do anything, and the ask survives only as the nicer URL it always was.

**This is Day 20's rule reaching its natural end.** Day 20: an unanswered ask is a
hypothesis about a constraint, test it. Day 21: testing is worth it even when the
constraint is real, because you get an exact ask. **Day 22: when the constraint is real
AND the ask goes unanswered, stop asking and route around it.** Three days, three
different moves, one question — *what does this actually require?*

**There is no bundler, again.** Each module becomes a `Blob` URL with its relative import
specifiers rewritten to its dependencies' Blob URLs, dependencies first. Thirty lines.
The modules keep their own boundaries, so the code in the file is the code the test suites
ran, character for character apart from the specifiers.

### The test that says "the code is the same code" found that it wasn't, immediately

I wrote a test asserting byte equality between each embedded module and the file on disk.
**It failed on the first run**, and the bug is one I would not have found by reading:

```js
html.replace('<script type="module" src="app.js"></script>', `<script ...>${loader}</script>`)
```

A **string** replacement is scanned for `$$`, `$&`, `` $` `` and `$1`. The embedded
sources are full of `$$`, because `` `$${x}` `` is how a template literal prints a dollar
sign in front of an interpolation — and this codebase formats money everywhere. Every one
of them had been silently halved. `${singleTop}` became `` `$${singleTop}` `` → `$` in the
shipped file, so the calculator would have printed `110,000` where it meant `$110,000`,
and worse things wherever the sequence appeared in a regular expression.

**The rule: `String.prototype.replace` with a string second argument is not a literal
substitution, and the difference only shows on data you did not write.** A replacer
function is the same length and has no such reading. I have used the string form a
hundred times; it has never mattered before because the replacement was never *someone
else's source code*.

**The wider rule, and it is the one to keep: a test whose assertion is "X is unchanged"
pays for itself the first time, or it was not worth writing.** This one paid in under a
minute. The version I nearly wrote — "the file is large and contains `estimateFederalTax`"
— would have passed happily on corrupted output.

### A dependency cycle nobody could see, and the loader that had to

The first attempt at the single-file build recursed until the stack ran out. Not a bug in
the loader: **`us-state-tax` has four genuine ES module cycles.**

```text
localities/counties.js -> localities/indiana.js  -> localities/counties.js
                       -> localities/maryland.js -> ...
                       -> localities/michigan.js -> ...
                       -> localities/ohio.js     -> ...
```

`counties.js` held two things: the *dispatch* (which state's table to use), which needs
all four states, and the *registry lookup* (`resolveCounty`, `countyRegistry`,
`normaliseCounty`), which all four states need. So the four states imported it back.

Node did not complain. TypeScript did not complain. 373 tests passed over it for thirteen
days. **It works by luck** — every binding crossing the cycle is a hoisted `function`
declaration, so it is defined by the time anything calls it. Change one of them to a
`const` arrow and it becomes a `ReferenceError` at import time in whichever direction the
graph happens to be entered.

**THE RULE: a dependency cycle is invisible until something has to serialise your module
graph, and at that moment it stops being a style question.** A bundler, a Blob loader, a
CommonJS interop layer, a tree-shaker — every one of them has to produce a module before
anything can reference it, and a cycle cannot be produced in any order.

The lookup moved to `localities/county-registry.ts`, a leaf that imports nothing of ours;
`counties.ts` re-exports it so **no import path changed**. `test/module-graph.test.js`
now asserts three things about the compiled output: the graph is acyclic, every relative
specifier resolves to a file that exists (the `.js`-extension failure that would 404 in a
browser and pass in Node), and `index.js` reaches every module with anything in it. The
third has one documented exception: a types-only source compiles to `export {};` and is
49 bytes of nothing, so it is allowed to be unreachable.

**What actually happened here is that a new consumer audited the library.** The site's
bundler-free claim had been a *property* for twenty-one days; today it became a
*constraint*, and the constraint found a latent defect that no test aimed at tax
arithmetic ever could. **A second consumer with different requirements is a code review
you do not have to write.**

### Utah: the fourth mechanism, and the first that is a credit

Utah was the last state the README admitted returned a retiree figure that was too high.
It is the **fourth** way a state here exempts retirement income and the **first that is a
credit**. Georgia measures the *character* of the income; Maryland the *form of the
account*; Kentucky *when the service was performed*. **Utah does not measure the income at
all.** It charges the tax and hands it back, then withdraws the refund as income rises.

That difference is not cosmetic. **A subtraction is worth the filer's marginal rate; a
credit is worth its face value**, so the same provision is flat where a subtraction is
progressive — and, more importantly, **withdrawing a credit is a rate increase that lives
underneath the rate schedule**, where it compounds with everything above it.

```text
couple both 70, $70,000 benefit, other income rising
   other      federal AGI     Utah tax    UT marginal   federal marginal
 $40,000       $72,350.00      $117.01        10.64%             12%
 $50,000       $90,850.00      $823.76        15.26%             12%
 $70,000      $127,850.00    $3,119.76        15.26%             12%
 $80,000      $139,500.00    $4,007.46         8.25%             12%
 $90,000      $149,500.00    $4,832.46         8.25%             22%
```

**15.26% in a state that advertises 4.45%**, and it is `1.85 × (4.45 + 2.5 + 1.3)`: § 86
drags 85 cents of benefit into federal AGI behind each dollar of pension, Utah taxes all
`$1.85` of it, and *two* credits are withdrawn against the same `$1.85` at once — 2.5
cents of Social Security Benefits Credit and 1.3 cents of Taxpayer Tax Credit.

Three rules, no brackets, 3.4× the statutory rate. And the rate **falls** after
`$90,387.50` of AGI, so **the highest-taxed next dollar in Utah belongs to a household in
the 12% federal bracket, not the 22% one.** Day 21 found § 86 and the senior deduction
reversing direction four times federally; this is the same shape one level down, and the
two compose.

### Code 18 is dead law, and the arithmetic is what says so

Utah's Retirement Credit (code 18) is `$450` a head for a filer **born on or before 31
December 1952** — the third provision here that sunsets by attrition rather than by a
repeal date, after Virginia's 1939 and Kentucky's 1998. But the cohort is the *smaller*
of its two problems.

- Withdrawn at 2.5 cents from `$25,000` single / `$32,000` joint, thresholds that have
  never moved, so it is **gone by `$42,900`** for a single filer and **`$67,900`** for a
  couple.
- **Below about `$45,300` there is no tax left for it to offset**, because the Taxpayer
  Tax Credit has already reached zero.
- Its entire live band for a couple is therefore **`$45,300` to `$67,900`**, it is worth
  at most **`$395.00`** anywhere in it, and **any Social Security at all** makes code AH
  the larger side of the election.

A `$900` credit that can never be worth more than `$395`, in a `$22,600` window, to a
closed birth cohort, only for a retiree with no Social Security. **The rule: a headline
amount is an upper bound on a number that may be unreachable, and the way to find out is
to sweep the income and look at the envelope.** Day 16 found two Ohio credits that were
unclaimable once the zero band was set against their ceilings; this is the third, and the
first where the credit is defeated by *another credit of the same state* rather than by
its own limits.

**And the three credits are an ELECTION, not a list.** § 59-10-1019(5) bars code 18 to
anyone claiming AH or AJ and vice versa; AH and AJ combine. So the encoding is one rule
with a choice in it rather than three rules, and the engine takes the larger side. That
is *exactly* optimal rather than a heuristic, and the reason is one line: a non-refundable
credit is worth `min(potential, tax remaining)`, and `min` is monotone, so the larger
potential can never realise less.

### Two more Utah findings, one of which is about the reference model

**A municipal bond is taxed at 2.5% in Utah while appearing on no line of Utah income.**
Both credits are withdrawn against a modified AGI that adds tax-exempt interest back
(§ 59-10-1019(1)(b), § 59-10-1042(1)(b)). For a couple with `$40,000` of benefits and
`$60,000` of pension, `$10,000` of exempt interest costs exactly **`$250.00`** of Utah tax
and **`$0.00`** of federal tax. `taxExemptInterest` is a new input; the site's form has
asked for it since the site existed, for § 86.

**The military credit is *defined* as the rate, not equal to it.** § 59-10-1043(2)(a) says
the credit is the product of the pay and "the percentage listed in Subsection
59-10-104(2)". So this package reads it off the state's own rate rule and stores no second
copy. **PolicyEngine-US stores the copy, and its 2026 value is still 0.045 against its own
2026 rate of 0.0445.** That is Day 21's rule — *when a parameter is shared for a reason,
the sharing is the fact; copy it per year and the reason becomes invisible* — with a live
instance of the failure it predicts, in the model this project has used as a reference
five days running. It is the first time reading the *encoding* has found the reference
wrong about a number rather than merely differently organised.

One more, about sources: a web search told me Utah "expanded the Social Security benefits
credit in 2026 to $61,000 / $49,000 / $30,500". **Those are HB 290's CHILD tax credit
thresholds**, and the summariser had welded two Utah credits together. The parameter tree,
with its statutory cite per figure, is what separated them. **A summary that names no
statute cannot be checked, and an LLM summary of tax law is a hypothesis.**

### The payload ceiling stopped being a warning and became a wall

Adding Utah took `tools/list` to **44,945 bytes of a 45,000-byte ceiling**. Days 18, 19,
20 and 21 all named the same structural fix — `state_income_tax` carrying every state's
per-state fields for a caller who names one — and all four deferred it. **The fifth
deferral was not available: the next state could not have been added.**

`state_income_tax` went **16,500 → 8,710** and the payload **44,945 → 38,707**, while
*gaining* a tool. Every per-state field's **prose** moved into a ninth tool,
`describe_state`; the schema keeps the field, its type, and the states it belongs to,
which is everything a client needs to make a legal call.

**This is Day 21's pointer rule with the piece it was missing.** Day 21: *a pointer and a
copy do the same job and only one of them costs anything.* It explicitly could not reach
this tool, and said so — the three tools it fixed could point at `estimate_federal_tax`,
and `state_income_tax` had nothing to point at. **The step it did not take is that a tool
with nothing to point at can be GIVEN something.** The unavailability of a pointer was an
assumption that the set of tools was fixed. `describe_state` costs 1,561 bytes in the
payload and serves 26,000 bytes of documentation that nobody who does not ask pays for.

### The invariant caught two bugs on its first run, and one was already shipped

Moving the state lists into a table (`src/state-fields.ts`) made them *one* copy where
there had been two: the prose a model reads, and the validation that refuses the call.
`test/state-fields.test.js` offers every field to a state the table excludes and requires
a refusal, and to every state it includes and requires acceptance.

Both directions found something:

1. **`county` was ACCEPTED by Alaska and silently ignored.** The engine refuses a county
   for a non-county state — but a state with *no income tax* returns before it gets
   there, so nothing objected. A silently ignored field is a wrong answer with no
   symptom, which is the one failure mode this server exists to refuse. It had been
   shipped for twelve days.
2. **`earnedIncome` was documented for CA and GA and is REQUIRED by Ohio's 68
   earned-income school districts.** My table, wrong within an hour of being written,
   caught by the direction of the test I nearly did not write.

**The rule: when you deduplicate two copies of a fact, test both directions of the
survivor.** The over-restriction direction is the one that feels redundant and is the one
that caught the error I had just introduced.

### The site

Two changes. **The allocation finding is on the page's face** — yesterday's #4, and the
page's most actionable fact. Three states cap their retirement exclusion per person, so
the page now computes *both* allocations and says what the other one costs, before the
ranking table: for a couple with `$20,000` of benefits and `$120,000` of pension, filing
it all in one name costs **`$2,842.00`** more in Maryland, **`$1,247.50`** in Georgia,
**`$1,088.85`** in Kentucky. The federal return does not move by a cent — which the test
asserts rather than assumes, because it is the finding and not a detail. It also makes the
second pass free: `fed` is the same object both ways.

And **Utah moved eight places**, 24th to 16th of 28, on the standard retired couple:
`$2,801.46` → `$1,388.46`. **A ranking is only as good as its worst-modelled member**, and
that is the argument for finishing states rather than adding them — a table of 28 with one
wrong row is 28 wrong rows, because the reader cannot tell which one it is.

### The release guard worked, at the wrong end of the loop

`dist.yml` refused today's release: `packages/us-state-tax/README.md` still linked the
0.16.0 tarball. I had updated the root README and missed the package one. **The guard did
exactly what it was built for** — an install line that names a version is a promise, and a
promise in a README rots silently — and Day 20 built it for precisely this.

But it fired in CI, minutes after the push, and it is a check a local test can make in
milliseconds. So the same check now runs in `npm test`: all three package versions against
both README locations each. **The rule: a guard that can only fail in CI is a guard you
will trip, because the loop that produces the mistake is faster than the loop that catches
it.** Put the check where the mistake is made.

### Process notes

- Opening move unchanged: `git fetch origin main && git checkout -B main origin/main`,
  `npm ci` and the full suite in each package before touching anything.
- **Pages is still off** — today's run skipped the deploy job again. Not escalated, and
  routed around instead. See above.
- Rendered the site in Chromium at desktop and phone, light and dark, clean console, and
  then **also from `file://`**, which is the whole story of today's first section.
- **Notification sent.** The offline claim in `NOTES-FOR-HUMAN.md` was wrong and the human
  may have acted on it; the calculator now has a download that needs nothing from them.
- `policyengine-us` is **2.6.2** (2.3.0 yesterday). Utah's parameter tree gave every
  figure with a statutory cite. Primary sources — `le.utah.gov`, `tax.utah.gov` — are all
  blocked at the proxy, as always.

### What I would do next

1. **The Utah child tax credit.** `$1,000` a child withdrawn at **ten cents on the
   dollar** over `$49,000` / `$61,000` (HB 290, 2026) — about a 14% marginal rate in a
   4.45% state, and the same shape as the credits landed today. It is the last thing
   making a Utah *family* return too high, and it would let the README drop the
   "too high" admission entirely for the first time.
2. **A second state with a per-person retirement rule**, to test the site's allocation
   callout at n > 3. The callout is built for three states because three is what exists;
   the fourth will say whether the mechanism generalises or whether it was a coincidence
   of those three.
3. **`estimate_federal_tax` is now 10,359 of 38,707 bytes** and is the largest item. Do
   **not** split it the way `state_income_tax` was split: it is the entry point, its
   fields are not per-jurisdiction, and a model that has to look a field up before using
   it will guess instead. Recorded so a future run does not re-derive it as an obvious
   win.
4. **Finish the note migration** — owed since Day 19. Utah added five unconditional notes
   today and three conditional ones, which is the wrong ratio and I knew it while typing.
5. **Look at what a second consumer would find.** Today's cycle was found by the site
   becoming a real consumer of the library. Nothing else consumes it in an unusual way.
   A CommonJS `require()` smoke test, or a bundler, would be the next cheap audit of that
   kind.

---

## Day 21 — 2026-09-15

### What I did

**§ 86 — the taxation of Social Security benefits.** `us-federal-tax` is **v0.8.0**
and `us-tax-mcp` is **v0.19.0**. And **a website**, which is the first user-facing
surface this project has had in twenty-one days and is built, tested and committed
but not yet published, for a reason that is today's second finding.

**801 tests** (303 + 349 + 138 + 11), up from 769, all green, zero dependencies
anywhere. `us-state-tax` is untouched at v0.16.0.

### Yesterday's rule, applied twice, with opposite results

Day 20's rule was: **an ask that goes unanswered is a hypothesis about a constraint,
and the right response is to test the claim rather than word it better.** It named
the next hypothesis to test — that a static calculator on GitHub Pages "needs a
human" — and I tested it. The first version of `.github/workflows/pages.yml` asked
`actions/configure-pages@v5` to switch Pages on with `enablement: true`. Twenty
seconds later:

```text
Get Pages site failed.    Error: Not Found
Create Pages site failed. Error: Resource not accessible by integration
```

**This one is real, and the pair of errors says exactly how.** The token can *read*
the Pages configuration — the 404 means Pages is off, not that the token was
refused — and cannot *create* it. `POST /repos/{owner}/{repo}/pages` is closed to an
Actions token however much `pages: write` it holds, and `pages: write` is the most a
workflow can request. Serving from a `gh-pages` branch needs the same site to exist
first, so there is no way round it from inside a run.

**The refinement to Day 20's rule, and it is the part worth keeping: testing a
constraint is valuable when it holds, not only when it breaks.** Day 20 read as a
story about a false premise, and the obvious lesson to draw was "your constraints
are probably imaginary". That is the wrong generalisation. Two hypotheses, tested
the same way on consecutive days: one false, one true. What the testing bought today
was not access — it was **an exact ask**. The note to the human went from "a site
would need you to set something up, I think" to *Settings → Pages → Source: GitHub
Actions*, one dropdown, with the error text that proves nothing else will do. An ask
you have tested is smaller than an ask you have guessed at even when the answer is
no, because you now know its shape.

Corollary I acted on: **a workflow that cannot finish its job should not be
permanently red.** The Pages workflow now builds the site, runs both engines' suites
and the site's own, uploads the built site as a downloadable artifact that works
offline, writes the one-line instruction into the run summary, and *skips* the
deploy job. A red badge on every push teaches the reader to ignore Actions, which
costs more than the thing it is complaining about. The regression guard — does the
calculator still build, are its figures still right — runs either way, and that is
most of the value.

I also caught myself: the first draft of `NOTES-FOR-HUMAN.md` announced the site as
live before the run had finished. Writing that would have been the precise failure
Day 20 exists to record. **Do not write the note until the run is green.**

### § 86 is not a rate, and that is the whole provision

Everything interesting about § 86 follows from one structural fact that its
popular description hides. It does not tax a benefit at 50% or 85%. It **includes**
up to 85% of the benefit *in taxable income*, where the filer's own bracket then
applies. Three consequences, none of which is visible if you think of it as a rate:

**A dollar of other income costs more than a dollar.** Inside the phase-in band each
extra dollar drags 50 or 85 cents of previously untaxed benefit in behind it, so
taxable income rises by `$1.50` or `$1.85`. That is the "tax torpedo", and in this
package's own numbers it is a **40.70% marginal rate in the 22% bracket** — 1.85 ×
22%.

**And it compounds with the thing that was supposed to fix it.** The OBBBA senior
deduction phases out at 6% of the MAGI excess **per eligible person**, and § 86 is
what makes MAGI move. For a couple both 65, one dollar of ordinary income raises AGI
by `$1.85`, which destroys `$0.222` of senior deduction, so taxable income rises by
`$2.072`:

```text
couple both 65, $90,000 benefit, $80,000 of other income
                   total tax    next dollar    bracket
2024 (pre-OBBBA)  $17,067.00        40.70%         22%
2026              $13,169.04        45.58%         22%
```

**The senior deduction cuts this couple's bill by `$3,897.96` and raises their
marginal rate by 4.88 points, to a figure above the 37% top rate.** Both are true
and only the first was in the press release. **The rule: a deduction with a
phase-out is a rate increase wearing a rebate's clothes, and the two halves are
reported by different people.** Day 11 found a credit with no plateau and Day 19
found an exclusion whose headline was the least informative thing about it; this is
the same family and the sharpest instance, because here the relief and the increase
are *the same provision* rather than two rules meeting.

Sweeping that couple's other income from `$75,000` to `$175,000` — never leaving the
22% and 24% brackets — the marginal rate goes **22.2% → 45.58% → 24.64% → 26.88% →
24.0%**. It reverses direction four times, and the rate at `$78,000` is higher than
the rate at `$171,000` although the *bracket* at `$171,000` is higher. A bracket
table gets the ordering backwards.

### A threshold that never moves is a tax increase nobody votes for

`$25,000` and `$32,000` were set by the Social Security Amendments of 1983;
`$34,000` and `$44,000` by OBRA 1993. **§ 86 contains no cross-reference to § 1(f)**,
so there is no mechanism by which they could be indexed. Every other dollar figure
in this package is adjusted annually.

So I did something I have not done before in this project: **one shared object
across all three years**, in `data/social-security.ts`, with a test asserting
`YEAR_2024.socialSecurity === YEAR_2026.socialSecurity` by *identity*. The reasoning
is the point. Three copies of the same numbers imply three independently sourced
figures that happen to agree. There is one figure that stopped moving while
everything around it was indexed, and the encoding should say so. **The rule: when a
parameter is constant for a reason, the sharing is the fact — copy it per year and
the reason becomes invisible.** This is the inverse of Day 16's rule about reading
the encoding rather than the data: here I am choosing an encoding so that a future
reader reads the right thing.

It is the third provision in this package that sunsets or bites by the passage of
time rather than by legislation — after Virginia's 1939 age deduction and Kentucky's
1998 cutoff, both of which empty a cohort. This one fills one instead.

### Married filing separately is not half of joint. It is zero.

§ 86(c)(1)(C): a separate filer who lived with their spouse **at any time** during
the year gets a base amount of `$0`, and § 86(c)(2)(C) does the same to the adjusted
base. So 85% of the benefit is taxable from the first dollar. Living apart for the
*whole* year restores the single figures.

```text
$20,000 of benefit, $10,000 of other income, filing separately
  lived together at any point      $17,000 taxable
  lived apart all year                  $0 taxable
```

One fact, which appears nowhere else on the return and on no summary table, worth
`$17,000` of taxable income. `livedWithSpouse` defaults to `true` — the expensive
reading — because this package does not guess in the taxpayer's favour about
something it was not told. Every other filing status ignores the field entirely.

A smaller one in the same place: **head of household and qualifying surviving spouse
get the *single* figures**, not larger ones. § 86 knows only "a joint return", "a
separate return" and everything else, so the status that doubles the standard
deduction buys nothing at all here.

And: **tax-exempt municipal interest is added back in full** by § 86(b)(2)(B). For a
retiree inside the band, `$10,000` of exempt interest pulls `$8,500` of benefit into
taxable income — exactly what `$10,000` of taxable interest would have done. The
bond is tax-free on its own line and not on the return as a whole.

### A pointer and a copy do the same job, and only one costs anything

The MCP server's `tools/list` payload went from **54,431 bytes to 43,243** while
gaining three fields. Twelve previous compression passes had bought 1,000 bytes in
total. This is the thirteenth and it is not a better compression; **it is the first
one that stopped compressing.**

Every pass from the first to the twelfth asked "what in this payload is longer than
it needs to be". Nothing was. **14,771 bytes of it were a second and third copy of a
document the client already had.** `compare_tax_years`, `effective_marginal_rate` and
`quarterly_estimated_payments` take the same thirty-seven household fields as
`estimate_federal_tax`. Their own tool descriptions have said so in words for
several releases — *"household fields are the same as estimate_federal_tax, which
documents each one in full"* — and then described all thirty-seven again anyway.

**The rule: when a schema already tells the reader where the real documentation
lives, the duplicate beside it is not documentation. It is the cost of not believing
your own cross-reference.** Day 19's rule was that multiplicity lives in properties
repeated across tools; Day 20's was to look for the repeated constant before the
repeated sentence. Both were about making a repeated thing smaller. Neither asked
whether the repetition had to exist at all.

What is kept is everything a client needs to make a legal call — type, enum, nested
item shape — and what is dropped is only prose that exists in full one tool away.
Three new invariants are tested, because this is a change that could quietly become
"some fields are undocumented":

1. **All or nothing per tool.** A schema where some shared fields are described and
   others silently are not is the worst of both, because a model cannot tell an
   undocumented field from an unimportant one.
2. **A tool that drops the descriptions must name where they live** in its own
   description.
3. **Every shared field must be described in full on the primary tool**, since three
   tools now have nothing else to offer.

Ceiling cut 52,000 → 45,000. The structural fix Day 18, 19 and 20 all named is still
owed and is now the only thing left: `state_income_tax` is 15,380 bytes, 36% of the
payload, carrying twelve states' per-state fields for a caller who names one state.
**The pointer rule does not reach it — there is no second tool to point at** — so it
needs a different move: a `describe_state` lookup, or per-state fields folded into
one free-form object validated at runtime against the state actually given.

### The website, and the two judgements inside it

`site/` is a retirement tax calculator. You enter what a household **receives** —
box 5 of the SSA-1099, the pension, the IRA — and it derives the federal return from
that and ranks all 28 states, pricing every Maryland and Indiana county. It is the
answer to the question these engines have always been able to answer and have never
been able to answer to anybody who is not a programmer.

**There is no bundler, and that is not a shortcut.** Both engines compile to ES
modules with explicit `.js` extensions on every relative import, which is exactly
what a browser loads natively, and neither has a runtime dependency. So the build is
a copy that drops `.d.ts` and `.map` files — 43 modules, 552 KB raw — and the page a
visitor loads is the same code the test suites run. **The zero-dependency claim this
project has made for twenty-one days turns out to have a second payoff nobody had
cashed: it makes the library a browser bundle for free.** That is the same shape as
Day 20's finding, where zero dependencies turned out to make `npm pack` a complete
distribution. A property advertised for one reason paid twice.

Two judgements are the site's own rather than the engines', so both are stated in
the result and printed on the page rather than folded in silently:

**Three states need a starting point that exists on no federal form.** The engine
refuses to guess one, which is right for a library and useless for a calculator, so
`site/src/compute.js` derives Pennsylvania's, New Jersey's and Massachusetts's from
the income components and shows the derivation. For a retired couple with `$70,000`
of pension and `$10,000` of IRA, Pennsylvania's base is `$0` — it taxes neither — and
New Jersey's and Massachusetts's are both `$80,000`, from which New Jersey exempts
the lot and Massachusetts charges `$3,490`.

**A local income tax that every resident owes is not optional.** Maryland and Indiana
have no county-free jurisdiction, so the table shows the range across the state's own
counties and ranks on the cheapest achievable total. One test household's Maryland
**state** tax is `$0.00` and its **county** tax is `$758.25` to `$1,112.10`. A "state
tax" that leaves that out is not a smaller number, it is a wrong one.

### The site found something the library had not

The form asks whose name the retirement income is in, which I added for Maryland,
whose exclusion Day 18 established is per person. Writing the test I asserted that no
other state would move. **Three do.** Georgia and Kentucky claim theirs per person
too, and all three punish concentration:

```text
couple both 70, $20,000 Social Security, $120,000 of pension
                     split evenly   all in one name
  Georgia                   $0.00       $1,247.50
  Maryland                $273.25       $2,201.75
  Kentucky              $1,907.85       $2,996.70
                                        ---------
  swing on identical household totals   $4,264.85
```

**The federal return cannot see the difference at all**, so nothing warns you, and
the decision is normally made for reasons that have nothing to do with tax. Three
days of separate work on three states' exclusions did not surface this; building one
form that asked one question of all twenty-eight at once did. **The rule: a feature
built for one state is a hypothesis about the others, and the cheapest way to test it
is a surface that asks every state the same question.** Day 19's rule was to compare
two states' encodings of the same idea; this is that at n=28 and automatic.

### Process notes

- Opening move unchanged and still correct: `git fetch origin main && git checkout -B
  main origin/main`, then `npm ci` and the full suite in each package before touching
  anything.
- **Day 17's PyPI route paid a fourth time.** `policyengine-us` is **2.3.0** now (2.0.5
  yesterday — it moves fast). Its § 86 tree gave every parameter with the statutory
  cite, and **six of its own test fixtures are reproduced here exactly**, first run.
  No disagreement anywhere, which is the first time that has happened; § 86 is old,
  short and unamended, and it shows.
- `irc.bloombergtax.com`, like every other primary source, is blocked at the proxy.
  Two `WebSearch` results plus the reference model's cites carried the parameters.
- **Chromium is pre-installed at `/opt/pw-browsers/chromium`** and `npx playwright
  install` is not needed — launch with `executablePath`. I rendered the page at
  desktop and phone widths in light and dark and read the console; it is how I found
  that Maryland's twenty notes made the detail panel a wall nobody would read (now
  three notes plus a disclosure). **A page you have not looked at is a guess**, which
  is Day 20's rule about the unexecuted install line, one medium over.
- **Notification sent.** The site needs one click that only the human can make, and
  the § 86 result changes what the packages can answer. Both are things they would
  want to know today rather than on the next run.

### What I would do next

1. **Check whether Pages got switched on**, and if it did, look at the live page.
   If it did not after a few days, that is *not* a reason to ask again louder — it is
   a reason to ask whether the site needs Pages at all. It is a single directory of
   static files; a `dist` branch, a Release asset, or simply the artifact are all
   distributions of a kind, and one of them may not need a click.
2. **Split `state_income_tax`.** Now the only remaining context work, and the site
   has just demonstrated the shape of the fix: a caller names one state and needs
   that state's fields. 36% of the payload for a caller who uses a twelfth of it.
3. **Utah's retirement credit** — still the last state the README admits returns a
   retiree figure that is too high, and the fourth and last way a state can exempt
   retirement income (a credit with a phase-out rather than a subtraction). The site
   makes this more valuable than it was yesterday, because Utah is now visible in a
   ranked table next to states that are modelled properly.
4. **Put the three-state allocation finding on the site's face.** It currently
   requires the reader to change the dropdown and notice. Computing both allocations
   and saying "filing this the other way costs $4,264.85 in these three states" is
   cheap and is the single most actionable thing the page knows.
5. **Finish the note migration** — Day 19's and Day 20's first priority, still owed,
   and the site made the case for it visible: Maryland emits twenty notes and only
   about three of them apply to any given return.

---

## Day 20 — 2026-09-14

### What I did

Two things, and the first is the one that should have happened on Day 6.

**The packages are installable.** `us-state-tax` is **v0.16.0** and `us-tax-mcp` is
**v0.18.0**, and both of them — and `us-federal-tax` v0.7.0 — can be installed by anybody,
today, with one line and no account anywhere:

```bash
npm i https://github.com/LoganChu/Agent_Playground/releases/download/us-state-tax-v0.16.0/us-state-tax-0.16.0.tgz
npx -y https://github.com/LoganChu/Agent_Playground/releases/download/us-tax-mcp-v0.18.0/us-tax-mcp-0.18.0.tgz
```

**And Kentucky's pension income exclusion**, the third retirement construction in this
package and the one built on a third axis. **769 tests** (349 + 283 + 137), up from 750,
all green, zero dependencies anywhere. The federal engine is untouched at v0.7.0.

### The distribution ask was answering the wrong question for fourteen days

`NOTES-FOR-HUMAN.md` has said since Day 6 that "an MCP server that is not published cannot
be installed by anyone, and that is now the only distribution this project has." **That was
false, and it was false on the day it was written.** Three facts were all in the repository
the whole time and were never put next to each other:

1. This repository is **public** and MIT.
2. All three packages have **zero runtime dependencies** — a claim this project makes
   loudly, tests for, and had not noticed the consequence of.
3. npm installs a tarball **from an https URL**, with no registry, no account and no token.
   `npx` runs one too, exactly as it runs a package name.

So `npm pack` output is a complete, working distribution, and the only thing missing was
somewhere public to put the file. `.github/workflows/dist.yml` now packs all three after
their own suites pass and attaches each to a GitHub Release at an immutable per-version
tag, using **only the `GITHUB_TOKEN` that Actions mints for the run**. There is no secret
to add. I pushed it, it ran, it created three releases, and I then installed all three
tarballs from the public URLs into a clean directory in this sandbox and ran both the
library and the MCP server over stdio out of them.

**The rule, and it is the biggest thing I have learned on this project: an unanswered ask
is a hypothesis about a constraint, and after a week it should be tested rather than
repeated.** Day 18's rule was "make an unanswered ask smaller rather than louder", and it
was the right instinct pointed at the wrong object. Thirteen days went into making three
sentences shorter, and none into asking whether the sentences were true. The ask was
*"I cannot distribute this without you"*, and the correct response to a thirteen-day
silence was not a better-worded ask, it was to go and find out whether the premise held.
It did not.

What survives is a **smaller and more honest** ask: npm buys **reach** — a name people can
search for, `npm i us-state-tax` — and nothing else. Nineteen days of work is no longer
sitting behind a button nobody has pressed.

Two supporting notes:

- **The install line is a promise, and a version in a URL rots on the next bump.** So the
  Distribute workflow refuses to release if any README still links an older tarball, and
  the MCP package's README test asserts the config it prints matches its own
  `package.json`. The check fired on this very run, which is the only reason the four
  READMEs are right.
- The root README had been telling people to run `npx -y us-tax-mcp` for fourteen days.
  That resolves to nothing. **A published instruction that has never been executed is not
  documentation, it is a guess** — and this one was wrong in the one place a reader would
  find out the hard way.

### Kentucky asks a question about 1998, and the answer has no ceiling

Georgia measures its exclusion on the **character** of the income. Maryland measures it on
the **form of the account**. Kentucky measures it on **who the employer was and when the
service was performed** — the only one of the three that is a fact about the retiree's
working life rather than their portfolio, and so the only one no decision taken after
retirement can change. Two consequences, neither on any table of state pension exclusions:

**The `$31,110` is not Kentucky's maximum.** Retired pay from the federal government, the
Commonwealth or a Kentucky local government — military service included, since that is
federal service — is exempt **in full** to the extent it is attributable to service
performed before 1 January 1998, with no ceiling. And the exempt amount is **not charged
against** the `$31,110`, which stays available against everything else. Schedule P adds
them.

```text
teacher, service 1975-2005, $70,000 TRS pension + $40,000 of IRA distributions
  exempt (276/360 of the pension, uncapped)     $53,666.67
  the ordinary exclusion, undisturbed           $31,110.00
  total excluded                                $84,776.67      on a return whose
  Kentucky tax                                     $768.37      headline is $31,110
```

**There is no age test at any point.** Georgia's exclusion begins at 62 and Maryland's at
65; Kentucky's applies to a 45-year-old. So the state with the smallest published figure is
the only one of the three an early retiree can use at all — and the ranking of the three
**reverses** at 65:

```text
couple, $70,000 of 401(k) pension between them    Kentucky    Georgia   Maryland (Mont.)
both aged 55                                       $157.85  $1,996.00      $4,471.05
both aged 62                                       $157.85      $0.00      $4,471.05
both aged 65                                       $157.85      $0.00          $0.00
```

Kentucky is **flat across every age** and is 28 times cheaper than Georgia and Maryland's
combined answer at 55 — then it is the only one of the three charging anything at 65.
**The rule: when three states encode the same idea, compare them at the boundary NONE of
them advertises.** Every summary of these provisions is written for a 65-year-old, which is
the one age at which the ranking is least interesting.

### A cutoff that never moves is a cohort that empties

1 January 1998 has not changed in twenty-eight years. Two things follow, and the second is
the counter-intuitive one:

- It is the **second provision in this package that sunsets by attrition** rather than by a
  repeal date — Virginia's untested age deduction for filers born before 1939 was the
  first. Nobody has joined this cohort since 1998.
- **Every further month of service dilutes the exempt percentage**, because the numerator
  is fixed and the denominator grows. Two teachers with identical `$70,000` pensions and
  identical `$40,000` IRAs pay **`$768.37` and `$2,646.70`** — `$1,878.33` apart, decided
  entirely by the decade they happened to work.

But the **exempt dollars do not fall**, and this is the refinement worth keeping. A pension
earned over more months is larger, so `pension × (pre / total)` is roughly `constant × pre`
and holds as the career lengthens; it is the taxable remainder that grows. **The percentage
is what every summary of Schedule P reports and it is the misleading half of the ratio.**
There is a test pinning this at four career lengths.

### The $31,110 went DOWN, and it is not the only thing that has

Indexed from `$35,700` in 1999 to `$41,110` in 2005, **frozen there for thirteen years**,
cut **24%** to `$31,110` by the 2018 reform, and frozen again. Maryland's exclusion was
recorded on Day 18 as "the only figure in this package that has ever gone down"; Kentucky's
fell four times as far and twenty-one years ago. It is not indexed, so it has lost roughly
half its real value since it was last set — and the rate cut from 4.0% to 3.5% takes a
further 12.5% off what the exclusion is worth. **A frozen cap and a falling rate are the
same policy twice**, and only one of them makes the news.

### The twelfth compression pass CUT the ceiling, and the bytes were a constant

53,000 to **52,000**, at **51,625 bytes** with Kentucky's three new fields already inside
it. That is the first reduction in the project, after three consecutive passes that bought
no raise and one — Day 19's — that reported compression had "stopped being cheap".

Day 19 was right about the prose. I scanned the payload for any 45-character substring
occurring twice and got back schema punctuation and nothing else; there is no repeated
sentence left. **What was left was a CONSTANT.** `"minimum":0` appeared **164 times for
1,968 bytes** — 3.7% of everything every session pays for — attached to fields called
`wagesThisPeriod`, `employerPlanPension` and `dependents`, telling a model what their own
names already say. Removing it cost nothing real, for two reasons, and the second is the
better one:

- `readNumber` already rejects a negative, with a better message than a schema violation
  produces. The guarantee was never coming from the schema.
- **The schema was the LOOSER document, not the stricter one.** The server deliberately
  accepts `"85,000"` as a number because models send it; a client validating `minimum: 0`
  strictly would have rejected the string before the coercion ever ran.

**The rule: a schema constraint that restates the field's own name is paid once per field
per tool and informs nothing. Look for the repeated CONSTANT before the repeated
sentence** — it is invisible to a reader, it appears in no single description, and it is
the only kind of bloat that grows without anyone writing a word. Day 19's rule was that
multiplicity lives in nested properties repeated across tools; this is the same rule one
level down, at the property's own attributes.

This buys time for the structural fix Day 18 and Day 19 both named, and is not a reprieve
from it: `state_income_tax` is 15.9 KB and carries twelve states' per-state fields for a
caller who uses one.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main`, then `npm ci`
  in all three packages, then all three suites before touching anything.
- **Day 17's PyPI route paid a third time.** `policyengine-us` is 2.0.5; its Kentucky tree
  gave the threshold's whole history back to 1999, the months-of-service ratio, and — in
  five test fixtures — the decisive fact that the exempt amount is **added to** the cap
  rather than netted against it. This package reproduces all four of those fixtures
  exactly, and there is a test that says so.
- **Where this package is deliberately more correct than the reference model**: PolicyEngine
  applies the pre-1998 percentage to *all* `taxable_pension_income`, so a Kentucky
  government retiree with a second private pension gets part of the private one exempted
  too. `governmentPension` is a field of its own here, and the percentage reaches only it.
  That is the third time Day 16's rule — read the encoding, not only the data — has
  produced something, and the second defect.
- Corroboration: four `WebSearch` calls established the per-person cap, the absence of any
  age test, that Part I is federal/Commonwealth/local only, and that the exemption is in
  addition to the `$31,110`. **`revenue.ky.gov`, `apps.legislature.ky.gov`, `trs.ky.gov`
  and `law.justia.com` are all blocked at the proxy**, so no primary document was reachable
  and every operative figure rests on two independent secondary sources plus the reference
  model. That is worse sourcing than Georgia's and it is recorded rather than smoothed over.
- Day 14's rule caught me once, in the friendly direction: I expected the three-state table
  to cross somewhere in the middle and it does not cross at all — Kentucky is flat, and the
  other two step past it from opposite sides.
- **Notification sent**, for the first time in three days, and not about the tax work. The
  distribution finding changes what the human is being asked for, and the ask has been open
  and unanswered for fourteen days; leaving that correction only in a file they have not
  opened would repeat the exact mistake this entry is about.

### What I would do next

1. **Finish the note migration** — still Day 19's first priority, still the cheapest context
   win, and Maryland's seventeen unconditional notes are still the place to start. Kentucky
   just added six more notes to the pile, five of which should be conditional on
   `governmentPension` being supplied.
2. **Split `state_income_tax`.** The twelfth pass bought roughly two more states of
   headroom, not a solution. The per-state fields are twelve states' worth and a caller uses
   one.
3. **Utah's retirement credit**, now the last state the README admits returns a retiree
   figure that is too high — and the piece that completes the set, because Utah's is a
   *credit with a phase-out* rather than a subtraction, which is the fourth and last way a
   state can exempt retirement income.
4. **Maryland's two-income subtraction**, still worth it for the ordering finding.
5. **A second surface**, newly plausible. Item 4 of `STRATEGY.md` — a static client-side
   calculator on GitHub Pages — was parked behind "needs a human". Today's finding suggests
   checking that premise too: a Pages deploy runs from Actions on the same `GITHUB_TOKEN`.
   Worth **testing the constraint before planning around it**, which is this day's whole
   lesson.

---

## Day 19 — 2026-09-13

### What I did
Day 18's third priority, taken ahead of its first because it is worth more and because it
made the first unavoidable: **Georgia's retirement income exclusion**, its military
retirement exclusion, its Social Security subtraction, and HB 463's 2026-2028 tips and
overtime exclusions. `packages/us-state-tax` is **v0.15.0** and `packages/us-tax-mcp` is
**v0.17.0**. **750 tests** (332 + 135 + 283), up from 721, all green, zero dependencies
anywhere. The federal engine is untouched at v0.7.0.

Also, because Georgia's thirteen notes made it impossible to keep postponing: **the
mechanism for Day 18's first priority**, note relevance, built and used on five notes across
two states.

No new state. Second consecutive day of correctness inside coverage already claimed, and the
gap was the one the package had been advertising against itself: `flat-states.ts` carried the
line *"Not modelled: the Georgia retirement income exclusion, which is large and will make a
retiree return computed here far too high."* It was.

### Georgia and Maryland are the same words for opposite rules

The finding of the day, and it is the generalisation of Day 17's and Day 18's rather than a
repeat. Both states exempt "retirement income" at 65. Both publish a number: `$65,000` and
`$41,200`. **Nothing else about the two provisions matches, and the three things that differ
are the three things that decide what an exclusion is worth.**

- **What counts.** Georgia's O.C.G.A. § 48-7-27(a)(5) is written on the *character* of the
  income — interest, dividends, net capital gain, rents, royalties, alimony, pensions **and
  taxable IRA distributions**. Maryland's § 10-209(a) is written on the *form of the account*
  and puts an IRA outside it by name.
- **What is charged against it.** Georgia: nothing; it subtracts taxable Social Security
  separately and the benefit never touches the exclusion. Maryland: the whole benefit
  received, taxable or not, dollar for dollar.
- **What the cap is measured on.** Georgia caps the *earned* income that may enter the pool at
  `$5,000` a person. Maryland does not look at wages at all.

On identical figures at 70:

```text
                                        Georgia    Maryland (Montgomery)
$150,000 left in the 401(k)           $3,493.00                $8,246.00
$150,000 rolled into an IRA           $3,493.00               $11,624.83
$120,000 of pension                   $1,996.00                $5,786.78
$94,500 of pension + $30,000 SS         $723.55                $6,144.53
```

**The sign flips twice.** The rollover every adviser recommends costs `$0.00` in Georgia and
`$3,378.83` a year in Maryland. And moving a third of a retirement out of pension and into
Social Security **saves `$1,272.45` in Georgia and costs `$357.75` in Maryland** — in two
states that both say, correctly, that they do not tax the benefit.

**The rule: the headline number is the least informative thing about an exclusion.** What
decides its value is which income it counts and what is charged against it, and those two
facts are never printed next to the number. Day 17 derived the extreme value of a published
limit; Day 18 traced one dollar through two provisions of one state; today is the third move
in the same family — **compare two states' encodings of the same idea, and the differences
are the findings.** Two states in this package now model a retirement exclusion properly, and
it took the second one to show what the first one's shape actually was.

### An exclusion that is a test on the TYPE of income, not the amount

At most `$5,000` of a person's earned income may enter Georgia's pool and everything else
qualifying enters in full. So at 65, on a single 2026 return:

```text
$65,000 of dividends      excludes $65,000     tax     $0.00
$65,000 of wages          excludes  $5,000     tax $2,245.50
```

Identical income, identical age, identical state, and the second filer pays the whole bill.
Georgia counts partnership and S corporation income as *earned*, so an active owner's
distributive share is inside the `$5,000` cap and a passive investor's dividends are not.

And the `$5,000` is itself a small finding: it has applied since 2024, and the `$4,000` that
preceded it is still what most summaries print. **A sub-cap inside a headline figure is where
a stale parameter hides, because nobody's headline changes when it moves.**

### The retirement income exclusion is also a capital gains allowance

Net capital gain is in the qualifying pool. The allowance is annual, per person, and
use-it-or-lose-it. So **a couple both 65 with no other income may realise `$130,000` of gain
every year and owe Georgia nothing on it, indefinitely** — a standing state-level zero-rate
band of `$130,000` that no guide to the provision mentions.

**The rule: a provision's name constrains who reads it.** Nobody looking for a capital gains
answer searches "retirement income exclusion", so a rule filed under one heading is invisible
to every question filed under another. This is a *different* mechanism from Day 16's and
Day 17's dead provisions: nothing here is unreachable, it is merely unindexed.

### Georgia's largest exclusion is $70,000, and it falls by half at 62

Two exclusions, two worksheets, and a filer who qualifies for both claims both. The military
exclusion of § 48-7-27(a)(5.1) is `$17,500` — plus a second `$17,500` for a veteran whose
earned income *exceeds* `$17,500` — and it runs only **below** 62. The ordinary exclusion
starts **at** 62, and disability opens it at any age. Compose them, for a permanently disabled
veteran with `$35,000` of military retired pay, `$40,000` of IRA distributions and `$20,000`
of wages:

```text
age 61     excludes $70,000     tax   $499.00
age 62     excludes $35,000     tax $2,245.50
age 64     excludes $35,000     tax $2,245.50
age 65     excludes $65,000     tax   $748.50
```

`$70,000` is more than the `$65,000` every table prints as Georgia's maximum, it arrives
twenty-four years earlier — and **the sixty-second birthday, which every guide to Georgia
describes as the birthday the retirement exclusion begins, costs this filer `$1,746.50`**,
not recovered until 65. A 61-year-old pays less than a 65-year-old on the same income.

**The rule: where two provisions are separated by an age boundary, check the composition at
the boundary, not the provisions on either side of it.** The second-best version of the
Virginia and Maryland moves: each rule is correctly described everywhere, and the pair is
described nowhere.

The second `$17,500` is also a **cliff on employment** and the largest single-dollar step in
Georgia. A veteran of 55 with `$40,000` of military retired pay pays `$1,247.50` on `$17,500`
of wages and `$374.30` on `$17,501` — **`$873.20` of tax on one dollar.** And the test is
one a disabled veteran structurally cannot meet; what saves them is the ordinary exclusion,
which disability opens at any age. **Where a benefit is conditioned on a threshold of
earnings, ask who is structurally unable to cross it** — sometimes, as here, the statute has
already answered, in a different paragraph.

### A competitive datum from reading the reference model's encoding

PolicyEngine-US keeps `military_retirement_pay` out of Georgia's qualifying pool entirely —
it is a leaf variable, not part of `taxable_pension_income`, and Georgia's `sources` list does
not name it. **So in that model a 65-year-old Georgia military retiree gets no exclusion at
all on a pension the state plainly exempts.** This package counts military pay left over after
the military exclusion as ordinary pension income, which is what a 1099-R says it is, and
says so in a note. Day 16's rule — read the encoding, not only the data — has now produced a
parameter (Ohio's constants), a structure (Maryland's per-person shape) and a *defect*.

Two cautions I held to: the two exclusions stacking for a disabled under-62 veteran is
corroborated ("separate worksheets on different pages… which can be claimed in addition to
each other"), and the engine computes the military exclusion **first** so the same dollar can
never leave twice — a conservative ordering that agrees with PolicyEngine everywhere their
model has an answer and is more generous only where they have none.

### What a Georgia rate table charges a retiree

Georgia is a 4.99% flat tax with a `$15,000` standard deduction, and that is the whole of what
a rate table has. For 2026:

```text
                                                rate table      here    over by
single 66, $55,000 of pension                    $1,996.00     $0.00  $1,996.00
single 63, $40,000 of pension                    $1,247.50     $0.00  $1,247.50
couple both 67, $90,000 of IRA + $30,000 SS      $4,491.00     $0.00  $4,491.00
couple both 65, $130,000 of capital gains        $4,990.00     $0.00  $4,990.00
veteran 45, $45,000 military pay + $25,000 wages $2,744.50   $998.00  $1,746.50
single 66, $55,000 of wages                      $1,996.00 $1,746.50    $249.50
```

Four of six are a bill against a true zero. **Georgia is the cleanest case this project has of
a rate table being wrong by 100% of the tax**, and it is cleaner than Virginia's because there
is no rate schedule to get partial credit for: the state's entire complexity is the exclusion.

### HB 463, and a state exclusion the federal deduction created

HB 463 was signed on 11 May 2026 and does four things to 2026: the rate to 4.99%, the
standard deduction to `$15,000`/`$30,000`, the dependent exemption to `$5,000` — all three
already in the package and now corroborated — and **`$1,750` each of qualified overtime and
cash tips, excluded for 2026 through 2028 and self-repealing after.**

That fourth one is structurally interesting and the package now models it. **The federal § 224
and § 225 deductions are below the line, so the compensation they exempt is still inside every
conforming state's base**: the OBBBA's "no tax on tips" did not reach a single federal-AGI
state, and a state that wants to follow has to legislate its own subtraction. Georgia's is
about a fourteenth the size of the federal one. This is the inverse of Day 3's Arizona
finding, where conformity to a federal *below-AGI* figure made a federal change flow through
automatically. **Whether a federal cut reaches a state return is decided entirely by which
side of AGI it sits on, and the OBBBA put its four new deductions on the side that does not
travel.** Expect more states to legislate this; the shape is now here for them.

It also carries a forward warning worth keeping: HB 463 directs cuts of 0.125 points a year
from 2027 until the rate reaches 3.99%, subject to revenue conditions, and raises the 65+
exclusion to `$70,000` in 2027 *without* such a condition. Two scheduled changes in one bill
with different certainty is exactly the case Day 8's rule is about.

### Notes that are only carried by the returns they could change

Day 18 ranked this first and I had intended to do it second. Georgia settled the order: a
Georgia retiree's result came back with **thirteen notes and 6,535 characters**, three of them
about a veterans' exclusion the filer could not claim.

The mechanism is `conditionalNotes` on a definition — a note plus a `relevantWhen` predicate
over the raw input — and the engine appends only the ones that fire. It is **additive**:
`notes` still exists, still unconditional, and a state that declares no conditional notes is
byte-for-byte what it was. That mattered more than elegance, because `def.notes.join(' ')` is
asserted in four existing tests and a breaking change here would have cost the day.

Five notes moved, on the two states that carry the most:

```text
Georgia, no military pay      10 notes, 5,050 characters   (was 13 / 6,535)
Maryland, plain retiree       19 notes, 11,122 characters  (was 20 / 11,929)
```

Georgia loses **23% of its note payload** for the return that cannot use it. Maryland's is the
larger number and the smaller proportion, which is the honest state of it: **the mechanism is
proved and the migration is not done.** Seventeen Maryland notes are still unconditional and
most of them should not be.

**The rule the predicate shape encodes: relevance is a property of what the caller SUPPLIED,
not of what the engine computed.** A note about a missing field has to fire when the field is
missing, so a predicate over the result would have been the wrong object — which is why
`relevantWhen` takes the input.

### The eleventh `tools/list` compression pass, and what it cost to find the bytes

Georgia's schema cost **871 bytes gross** — three new per-person fields, a widened
`retirement` description, a `filerAge` clause, and a new `federalTipsDeduction` without which
the tips exclusion would have been unreachable through the server while working in the
library. All of it was recovered: the ceiling is Day 17's **53,000** unchanged, at **52,978**,
ten bytes under Day 18's 52,988. Three passes in a row with no raise.

But the *manner* of it is the finding, and it is a warning:

- **The last 300 bytes cost more effort than the first 600.** I recovered the obvious
  duplication quickly — clauses in the tool description that were repeated verbatim in the
  property they named — and then spent four rounds shaving single sentences: an "importantly",
  a "Zero when omitted.", one of five example questions, "taken federally" twice. Those are
  real savings and none of them improved anything.
- **A nested property repeated across tools is where the multiplicity actually lives.** Day
  18's correction said multiplicity applies to the emitted form. The corollary I missed then:
  the `qualifiedBusinesses` *item* schema is emitted whole in all four household tools, so its
  nested field descriptions are paid four times. Three small trims there recovered 112 bytes,
  more than any single sentence elsewhere.
- **A field that only one state reads still costs every caller of the tool.**
  `federalTipsDeduction` is ~200 bytes of every session's context for an `$87` exclusion in
  one state. I kept it, because a server that silently cannot do what its library does is
  worse than a large payload — but the trade is now explicit and it will not stay affordable.

**Day 18 said the next state should not buy another raise, and it did not. But the honest
report is that compression has stopped being cheap.** The structural fix Day 18 named is now
overdue rather than optional: `state_income_tax` is 15.4 KB, ~29% of the payload, and carries
the per-state fields of eleven states for callers who use one.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main`, then `npm ci` in
  all three packages.
- **Day 17's PyPI route paid again and faster**: `policyengine-us` is now 2.0.4, and the
  Georgia tree gave the exclusion caps, the age thresholds, the `$5,000` earned-income cap
  with its 2024 step, the qualifying-source list, the military parameters, HB 463's 2027 and
  2026-2028 provisions, and the confirmation that the aged/blind standard deduction stopped
  applying in 2024. Four `WebSearch` calls corroborated the operative figures; `dor.georgia.gov`
  is blocked at the proxy, so the DOR page was reachable only through search.
- **Day 14's rule caught me twice again.** I wrote `$2,994.00` for the dividends-versus-wages
  spread from `65,000 × 4.99%` and the true figure is `$2,245.50`, because I had forgotten the
  standard deduction; and I wrote `$3,243.50` into a test for the joint concentration case for
  the same reason, where the answer is `$1,746.50`. **Every figure in this package has a
  deduction under it, and reasoning from a rate is reasoning about the wrong base.**
- The `$873.25` I predicted for the military cliff is `$873.20`, because the extra dollar of
  wages is itself taxed. A cliff is worth the step *less the tax on the dollar that triggers
  it*, and that is not a rounding difference, it is the definition.
- The test that earned its keep asserted the healthy spouse of a disabled Georgian gets
  nothing — Maryland reads a spouse's disability across and Georgia does not, and I had
  written the flag as if they agreed.
- All three suites run before the push, per Day 13. One commit carries all three packages.
- **No notification.** The run succeeded, nothing is broken, and there is nothing here that
  needs a human tonight. The publishing ask is thirteen days old and unchanged in shape; Day
  17 already made it as small as it can be made, and Day 18's rule — make an unanswered ask
  smaller rather than louder — has no smaller left to offer. It is in `NOTES-FOR-HUMAN.md`
  with today's two new one-sentence questions, where they will be read together.

### What I would do next

1. **Finish the note migration.** The mechanism exists and has two users; the remaining work
   is one predicate per note across 28 states, and Maryland's seventeen are the place to
   start. It is the cheapest context win left, it improves every state at once, and today
   proved it does not need a new abstraction — only `whenMilitaryRetirement`,
   `whenAgedAtLeast(n)` and perhaps four more like them.
2. **Split `state_income_tax`.** No longer optional. The per-state fields are eleven states'
   worth and a caller uses one; either they move behind a second tool a model calls once it
   knows the state, or the tool takes an opaque `stateSpecific` object validated at the
   boundary. Today's pass found its bytes by shaving adverbs, which is the signal that the
   linear growth has to be addressed structurally.
3. **Kentucky's and Utah's retirement rules**, the last two the README admits make a retiree
   return too high. Kentucky's `$31,110` pension exclusion is a third shape again (a per-person
   cap with a pre-1998 service carve-out), and Utah's is a *credit* on Social Security with a
   phase-out rather than a subtraction — which would give this package all three of the ways a
   state can exempt retirement income, and the three-way comparison is the piece the Georgia
   and Maryland pair is one short of.
4. **Maryland's two-income subtraction**, still Day 18's second priority and still worth it
   for the ordering finding: it is capped at the lesser spouse's income *net of that spouse's
   own subtractions*, so the pension exclusion reduces it.
5. **State withholding**, Ohio's SD withholding first, because the rate table is already here.

---

## Day 18 — 2026-09-12

### What I did
Day 17's first priority: **Maryland's retirement income**, which was the largest thing this
package returned as zero. `packages/us-state-tax` is **v0.14.0** and `packages/us-tax-mcp`
is **v0.16.0**. **721 tests**, up from 703, all green, zero dependencies anywhere. The
federal engine is untouched at v0.7.0.

No new state. This is the first day spent entirely on **correctness inside coverage already
claimed**, and Day 17 was right to rank it above breadth: the gap was larger than the
`$3,300` Day 17 estimated. A couple both 70 with `$100,000` of pension in Montgomery County
came back at **`$4,947.05` against a true `$80.00`**.

Three rules landed — the pension exclusion of Md. Code, Tax-Gen. § 10-209(b), the military
retirement subtraction of § 10-207(q) and the centenarian subtraction of § 10-207(nn) — plus
`subtractsTaxableSocialSecurity` on Maryland, a new per-person input, and two repairs found
on the way.

### Maryland taxes Social Security and exempts pensions

The best finding this project has produced, and it is the same *shape* as Day 17's Virginia
result: two rules that are each quoted correctly everywhere and never quoted together.

Maryland does not tax Social Security. Maryland also excludes up to `$41,200` (2025) of
employee-retirement-system pension at 65 — and § 10-209(b) reduces that exclusion **dollar
for dollar by the total benefits received, taxable or not**. Worksheet 13A line 3 says so in
as many words: Social Security and railroad retirement, Tier I *and* Tier II, "whether or not
you included any portion of these amounts in your federal adjusted gross income". So across
the whole band where the pension reaches the cap, the exemption and the offset cancel:

```text
$30,000 of benefits + $60,000 of pension   Maryland AGI $48,800   tax $2,226.88
$90,000 of pension, no benefits            Maryland AGI $48,800   tax $2,226.88
```

Identical to the cent, and the test asserts it that way. Decompose a dollar of benefit: 85
cents of it arrive through federal AGI, the subtraction takes those same 85 cents back out,
and the lost exclusion puts a whole dollar in. **A dollar of benefit adds a full dollar to
Maryland's base and a dollar of pension adds nothing** — so in that band Maryland taxes the benefit it exempts at a
*higher* inclusion rate than the pension it taxes, and even the 15% of benefits the federal
government never reaches is clawed back.

**The rule, and it is the generalisation of Day 17's:** *a state's exemption of an income
class is worth nothing if the same class is charged against an allowance elsewhere on the
return. Follow the dollar through every line that mentions it, not only the line that
exempts it.* Day 17 derived the extreme value of a published limit; today's move is to trace
one dollar through two provisions. Both are one line of arithmetic that nobody does because
the two facts are printed on different pages.

### The return's totals do not determine the tax, and that is a first

Everything else in this package can be computed from a household total. The pension exclusion
cannot: it is claimed by a person, capped per person, and offset by *that person's* own
benefits. One couple both 70, `$80,000` of pension and `$40,000` of benefits between them:

```text
                                          excluded    state + county
$40,000 and $20,000 each                   $42,400           $720.00
the pension on one, the benefits on the
  other                                    $41,200           $758.40
all of both on the same spouse              $1,200         $3,261.65
```

`$41,200` of exclusion and **`$2,541.65` of tax**, on identical totals. And note the middle
row: separating the pension from the benefits is *worse* than splitting both evenly, because
the cap wastes the allowance of a spouse who has no pension behind it. I expected the middle
row to be the best one and it is not — the per-person cap makes the optimum an even split,
not a concentration.

This forced a new input shape, `retirement: { filer, spouse }`, and the shape is the finding:
**where a subtraction is capped per person, the household total is not merely imprecise, it
is insufficient.** When the caller leaves it out the engine puts everything on one spouse —
the worst of the three cases, so the error runs towards too much tax — and reports the
assumption *in the name of the subtraction*, which is Day 17's Virginia pattern reused.

### An IRA is not an employee retirement system

§ 10-209(a) excludes an individual retirement account or annuity under IRC § 408, a Roth
under § 408A, a **rollover** IRA, a SEP under § 408(k) and a § 457(f) plan. A 401(a), 401(k),
403(b) or 457(b) qualifies.

So **the single most routinely recommended move in retirement planning destroys the
exclusion**: roll the 401(k) into an IRA and up to `$41,200` a year of excluded income
becomes fully taxed, for the rest of the retiree's life, at no federal cost and with nothing
on the federal return to show it happened.

```text
$50,000 a year, left in the 401(k)          $40.00
$50,000 a year, rolled into an IRA       $2,322.28
$150,000 a year, left in the 401(k)      $8,196.80
$150,000 a year, rolled into an IRA     $11,624.83
```

**The rule: an eligibility test written on the *form* of an account rather than on the
character of the income is a trap, because the form is the thing a filer changes for
unrelated reasons.** Nobody rolls over for tax reasons; everybody rolls over.

### Three age tests on one return, and one of them is 100

The three subtractions disagree about who qualifies, which is why they are one engine
function over a list of people rather than three:

- **65**, or total disability at any age — *or a spouse's* total disability, which qualifies
  the healthy spouse too. `$3,361.78` on one birthday for a single filer with `$50,000` of
  pension, a larger step than any rate change in Maryland's schedule.
- **No age test at all** for military retired pay: `$12,500` under 55, `$20,000` at 55 or
  over. A 42-year-old military retiree has a subtraction twenty-five years before any other
  Maryland retiree, and the fifty-fifth birthday is worth `$596.25`. § 10-207(q) includes
  death benefits from military service, so a survivor's cap is set by the **survivor's** age,
  not the service member's — a 45-year-old widow takes `$12,500` of the same benefit a
  56-year-old widow takes `$20,000` of.
- **100**, for the first `$100,000` of income of any kind — § 10-207(nn), and the largest
  subtraction in this package by a factor of two. `$9,049.60` to `$1,064.48` on one birthday.

And the two routes are alternatives that **swap places at `$21,200` of benefits**:
`min(pay, 41,200 - benefits)` beats a flat `$20,000` exactly while benefits are below
`$21,200`. The package does not make the election — it says which field is worth more and
why, and a test brackets the break-even from both sides.

### The only parameter in this package that has ever gone down

`$41,200` for 2025, **`$40,600` for 2026**. Both published by the Comptroller; the Bloomberg
Tax headline is literally "Maryland Comptroller Publishes 2025, 2026 Pension Exclusion
Benefits", so it is not a projection. § 10-209(a) ties the maximum to the maximum annual
benefit under the Social Security Act — and PolicyEngine's own YAML carries a comment saying
the published figures have never matched the SSA's maxima, so **it cannot be derived and has
to be transcribed each year.**

**This breaks an assumption I did not know the package was making.** Day 8's rule was "a value
a reference dataset holds constant into the next year is not next year's value"; today adds
the other half: **a parameter can move DOWN, and every mechanism for carrying one forward —
indexation, uprating, `year >= 2026 ? x : x` — assumes it does not.** Anything that indexed
this upward is wrong for 2026 in the expensive direction. There is now a test asserting the
2026 maximum is *less* than the 2025 one, which is the only test in the package of that form.

### Two repairs found on the way, and the second is a real defect

- **`totalTax` did not equal the sum of the figures the result reports.** It was
  `roundCents(unrounded state + local)`, while `tax` and `localTaxes[].tax` were each rounded
  separately — so wherever a component landed on a half cent the two differed by a cent. The
  centenarian case found it: `$614.875` of state tax exactly. It now adds the parts as
  reported. They are separate lines on a real return, charged by different governments, and
  **"the numbers do not add up" is the one arithmetic complaint a tax library cannot
  survive.** Nothing else in 721 tests depended on the old behaviour, which is how I know the
  change is safe and also that nobody had checked.
- **The MCP server never named the subtractions it computed itself** — one "Less state
  subtractions" total, with New Jersey's exclusion and now Maryland's three invisible inside
  it. It lists them now. That is not cosmetic: it is the only path by which the
  assumption-bearing name above reaches the caller, and I had written the assumption into a
  string that nothing displayed.

### `stateAdjustedGrossIncome` is now in the result, for a reason worth keeping

The result reported `subtractions` and `taxableIncome` but not the AGI between them, and
Maryland's whole story is about that figure. It is also **not** the figure Maryland's own
limits read: § 10-211(c)'s exemption chart, the senior credit and the capital gains surtax are
all tested on **federal** AGI, so a `$41,200` exclusion moves Maryland AGI and none of them.
Having both in the result is what lets a caller see that a subtraction did not buy back an
exemption. I checked the engine was already doing this correctly before documenting it — it
was, via `stepsMeasuredOn`.

### The tenth `tools/list` compression pass, and it bought no raise

Day 17 said the next state should not buy another ceiling raise. This was not a state, but it
cost more than one: **1,918 bytes gross**, and `retirement` at 1,870 was the largest single
property in the payload — four times the next. All of it was recovered and the ceiling is
Day 17's 53,000 unchanged, at **52,988**. Three rules came out of the pass:

- **A duplicated sub-schema is pure cost.** `retirement.spouse` takes exactly the four fields
  `retirement.filer` does; a second copy of the property table said nothing new. 230 bytes.
- **Merging two sentences into one LENGTHENS the payload.** The derived terse form keeps the
  first sentence, so folding the § 199A SSTB description's opening sentence into its
  occupation list *added* 408 bytes across four tools. Restoring the short first sentence and
  trimming only the tail took 540 out. **When a property has a derived short form, the first
  full stop is a budget line.** I found this by making the change and watching the total go
  up, which is the only reason I know it.
- **A correction to Day 14's multiplicity rule: multiplicity applies to the form that is
  EMITTED.** Trimming a full description carried by one tool and three terse copies pays
  once, not four times — the `qualifiedBusinesses` trim recovered 16 bytes where it looked
  like 120.

The rest came out of illustrative arithmetic in six property descriptions and three clauses
of the tool description, none of it operative and all of it still in the state's own notes.

### The figure I refused to commit

Maryland gives **`$15,000`** to retired correctional officers, law enforcement officers and
fire, rescue or emergency services personnel aged 55 or over — Form 502SU code letter `v`,
which stacks with the pension exclusion but reduces the pension figure it is computed on.
**HB 792 of the 2025 session would raise it to `$20,000`** for tax years after 2024. I have
the bill, its fiscal-note summary, and a practitioner reporting the change as already in
their tax software. I could not establish that it was **enacted**: Maryland was running a
$2.7 billion deficit that session and revenue bills died.

Two sources for `$20,000` would have satisfied the letter of the operating rule. I did not
commit it, because the rule's *purpose* is to keep a wrong number out and both sources
describe the same bill rather than the same law. **A second source that is downstream of the
first is not a second source.** Neither figure is in the package; both are in its notes, and
in `NOTES-FOR-HUMAN.md` as a one-sentence ask.

Same for the Worksheet 13E ranger exclusion: available at 55 but apparently **not** to a
filer who is 65 or over, which would mean a retired Maryland park ranger's exclusion *falls*
on their sixty-fifth birthday — the 13E figure is not reduced by Social Security and the 13A
one is. That is a good finding if it is true and I could not confirm the age ceiling.

### Sourcing: the PyPI route paid immediately, and its limits showed too

Day 17's rule — when the web is blocked, look for the package registry that ships the data —
worked on the first try. The `policyengine-us` 2.0.1 wheel gave me Maryland's whole
retirement tree in one download: the exclusion maxima for five years, the minimum age, the
military caps and their `2023-01-01` step, the centenarian parameters, the two-income
subtraction, and — more useful than any of the numbers — **their `md_pension_subtraction_amount`
formula, which is where the per-person structure and the `has_disabled_spouse` clause came
from.** Reading the *encoding* beat reading the data, again, which is Day 16's rule.

Its limits also showed, and they are worth recording:

- **The wheel has no public-safety subtraction and no 13E at all.** So the reference model
  also omits them, which is a small competitive datum: this package's notes now describe two
  Maryland provisions PolicyEngine does not model.
- **Its 2026 exclusion figure needed corroborating and it was right.** The YAML carries
  `uprating: gov.ssa.uprating` *and* an explicit `2026-01-01: 40_600`, which reads like a
  projection until you find that the Comptroller published it. Search confirmed it. If I had
  trusted the `uprating` tag I would have gone up instead of down.
- **`WebSearch` remains the only way to read a blocked page** and returned the § 10-209(a)
  exclusion list and Worksheet 13A's line 3 wording verbatim. `law.justia.com` is blocked,
  which is new information — the existing Maryland citations point at it.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main`, then `npm ci` in
  all three packages.
- Every illustrative figure was computed from the built engine *before* it was written, per
  Day 14, and it caught me three times: the exclusion spread is `$2,541.65` of tax and not
  the `$3,240` I had reasoned from a 7.95% rate, because the good splits zero the state tax
  entirely; the rollover is `$3,428.03` at `$150,000` and not `41,200 × 7.95%`, because the
  filer's marginal rate spans three brackets; and I wrote `$1,064.47` into the README from
  the *pre-fix* rounding and had to correct it to `$1,064.48`. **A figure computed before the
  fix is not a figure computed.**
- The test that earned its keep was the "all three rules on one return" one: it asserted
  `$120,000` of exclusion for two spouses with `$60,000` of pension each and got `$82,400`,
  because the `$41,200` cap binds per person. My expectation was wrong, not the engine.
- Maryland now carries **17 notes**, the most of any state, and a retiree's result is
  dominated by them. Day 6's rule says every result costs the caller context. The notes are
  currently unconditional; they should be filtered by what the inputs actually contain — a
  return with no military pay does not need the military note. That is the next context
  saving worth making and it applies to all 28 states.
- All three suites run before the push, per Day 13. One commit carries all three packages.
- **No notification today**, and the reasoning is the same as Day 16's. The run succeeded,
  nothing is broken, and the only ask is the twelve-day-old publishing one, which Day 17
  already made as small as it can be made — repeating it on a phone would be noise, and Day
  17's own rule says make an unanswered ask smaller rather than louder. The one genuinely new
  human-only item, whether HB 792 was enacted, is a one-sentence question that blocks a
  `$15,000` supplementary subtraction and nothing else; it is written down in
  `NOTES-FOR-HUMAN.md` where it will be read alongside the rest. **A notification is for
  something that needs them now; a note is for something that needs them eventually, and
  confusing the two spends the only scarce resource this project has.**

### What I would do next

1. **Filter the per-state notes by relevance to the inputs.** Maryland's 17 notes are the
   proof that the current approach does not scale, and the fix is one predicate per note
   rather than a new mechanism. It is the cheapest context win left and it improves every
   state at once.
2. **Maryland's two-income subtraction**, which is `$1,200` and would ordinarily not be worth
   a day — except that it is capped at the lesser spouse's income **net of that spouse's own
   subtractions**, so the pension exclusion reduces it. That ordering is the finding, and it
   is the last piece of the Maryland return that moves a real number. PolicyEngine's
   `md_two_income_subtraction` has the whole computation, including their `head_frac`
   apportionment workaround, which is itself evidence about what the form leaves unsaid.
3. **The other states' retirement subtractions**, now that the per-person shape exists.
   Georgia's retirement income exclusion (`$65,000` at 65, and it is per person too),
   Kentucky's, and Utah's retirement and Social Security credits are all listed as absent in
   the README and all three make a retiree return too high. The second user of a shape is
   nearly free, per Day 14, and this shape now has one user.
4. **Kentucky's occupational taxes** — still blocked as of Day 17; the PyPI route has now
   proved itself, but PolicyEngine has no `gov/local/ky` tree, so this needs the KACo or KLC
   table and nothing else has worked. Do not re-spend the search budget.
5. **State withholding**, Ohio's SD withholding first, because the rate table is already here.

---

## Day 17 — 2026-09-11

### What I did
Day 16's third priority: **Virginia** — the state that was supposed to be the cheap quiet
day. `packages/us-state-tax` is **v0.13.0** (**28 states**, 1,033 local income taxes) and
`packages/us-tax-mcp` is **v0.15.0**. **703 tests**, up from 683, all green, zero
dependencies anywhere. The federal engine is untouched at v0.7.0.

Also, and separately: **`.github/workflows/release.yml`** — the publish ask, which has been
open and unchanged for eleven days, now takes one secret and one button instead of three
`npm publish` runs on a laptop. That is the first thing I have done about distribution that
is not "ask again".

### The sourcing channel changed, and this is the most reusable thing here

Day 15 and Day 16 both hit the same wall: every state's own site is blocked at the proxy and
only `raw.githubusercontent.com` answers. Today three more facts about this sandbox:

- **`WebSearch` works and returns synthesised page content**, not just links. It is the only
  way to read a blocked page, and it was enough to corroborate four parameters today.
- **`WebFetch` is blocked on everything `curl` is blocked on.** It is not a second egress
  path. Do not spend calls discovering this again.
- **`pypi.org` and `files.pythonhosted.org` are reachable.** This is the big one.
  `curl` the `policyengine-us` wheel — 14 MB — and you have **every parameter and every
  variable of a 50-state model on local disk**, each YAML carrying its own statutory
  citation and its own `reference:` URLs. Virginia's entire rate schedule, standard
  deduction, exemptions, age deduction, spouse tax adjustment, both earned income credits
  and the poverty-guideline table came out of that one download.

**The rule: when the web is blocked, look for the package registry that ships the data.**
npm was already known to work for reading a competitor's tarball; PyPI turns out to work for
reading a *reference implementation's* parameters, which is a much better thing to have.
Day 16 spent a search budget looking for Ohio's credit columns "on GitHub" and recorded the
negative result; the wheel is where that class of question should go first.

Two cautions that come with it. PolicyEngine is a model, not a statute, and it was wrong
about Ohio on Day 2 — so it is a *lead* to corroborate, not a source to transcribe. And its
encodings are evidence in their own right, which Day 16 already found: read the workaround,
not only the data.

### Virginia's graduated rates are worth $257.50, and that is a constant

Every table prints Virginia as 2% / 3% / 5% / 5.75%. All four rates are real. What the table
cannot show is that **the thresholds are identical for every filing status and have not
moved since 1990** — 5.75% begins at `$17,000` of taxable income for a single filer and at
`$17,000` on a joint return. So:

```text
tax on the first $17,000, graduated   $720.00
tax on the first $17,000, at 5.75%    $977.50
the entire benefit of four brackets   $257.50
```

`$257.50` is the most Virginia's rate schedule can save anybody, at any income, in any year
since 1990. **Virginia is a 5.75% flat tax with a `$257.50` discount** — and a joint couple
with two average incomes is in the top bracket on the return's third line.

### The published $259 ceiling is $1.50 above anything that can reach it

Because the brackets are not doubled, marrying costs a two-earner couple one trip up the low
bands, and Form 760 line 17 gives it back by computing the tax as though the return had been
split in two. Virginia Tax publishes the result as **"up to `$259`"**.

The worksheet's output *is* the difference above. Write it out: for both spouses above
`$17,000`, `T(x+y) - T(x) - T(y) = 5.75% x 17,000 - 720 = 257.50`, and the min/max on lines
8 and 9 pin the split at the midpoint, where the difference is maximised. `test/virginia.test.js`
searches the whole surface — every joint taxable income from `$0` to `$250,000` against
every split of it — and the maximum is `$257.50`. **The cap has never once bound, and it has
been unreachable since the 5.75% bracket was set at `$17,000` in 1990.**

This is the second instance in two days of the same shape, and the two together are now a
method rather than an anecdote. Ohio's `$20` exemption credit and 20% joint filing row are
dead because a credit's income ceiling sits under a tax's income floor. Virginia's `$259` is
dead because a cap sits above a maximum that the same statute fixes. **The rule generalises:
a published limit is a claim about the arithmetic, and the arithmetic is usually one line
long. Derive the extreme value of whatever the limit limits, and compare.** Nobody does this,
because the limit is printed as a fact rather than as a prediction.

### An 11.5% marginal rate that appears in no table, because it is not a rate

Va. Code § 58.1-322.03(5) gives a filer aged 65 or over a `$12,000` deduction and withdraws
it **dollar for dollar** above `$50,000` of adjusted federal AGI — `$75,000` joint. A 100%
withdrawal rate on top of a 5.75% tax is 11.5%, and it is **per person**:

```text
joint, both aged 70, 2025
  $75,000   $1,469.80
  $99,000   $4,229.80     $2,760.00 of tax on $24,000 of income — 11.50%, exactly
```

Every other income-tested amount in this package tapers at a few cents in the dollar. This
one takes the whole dollar. It is the highest marginal rate anywhere in the package that is
not a cliff, and **there is no 11.5% in any table of Virginia rates because 11.5% is not a
rate — it is two rules meeting.**

Three details a summary of "$12,000 for filers 65 and over" loses:

- **The test income is not the base income.** The withdrawal reads *adjusted* federal AGI —
  federal AGI **less taxable Social Security** — while the deduction comes off Virginia AGI.
  Two figures one line apart, and the gap is worth `$2,572.80` to a couple on `$90,000` with
  `$30,000` of taxable benefits. That is why `taxableSocialSecurity` is an input here rather
  than something the caller nets into `subtractions` the way Illinois and Kentucky ask.
- **The untested cohort is a birth date, not an age.** A filer born on or before 1 January
  1939 takes the whole `$12,000` at **any** income. The statute has never moved that date,
  so the group is closed and shrinking by mortality. **A tax provision that sunsets by
  attrition** — worth `$690` a year to an 88-year-old at `$300,000` of income and nothing to
  anyone born a year later.
- **It is claimed per person but tested on the couple.** Two spouses over 65 have `$24,000`
  of deduction withdrawn across one `$24,000` band, so the 11.5% stretch is twice as wide for
  a couple as for a single filer, not half.

### Two poverty floors set by two governments, and the cliff moves with family size

Virginia has a statutory filing threshold (§ 58.1-321: no tax at all below `$11,950`,
`$23,900` joint, unmoved since 2021) **and** a `$300`-per-exemption Credit for Low Income
Individuals that zeroes the tax up to the **federal poverty guideline**, which HHS
republishes every January and which rises `$5,500` a head. The threshold does not move with
family size and the guideline does, so they cross:

```text
2025, the dollar that crosses each line
  single, no dependents     filing threshold $11,950     $0.00   the credit already covers it
                            poverty guideline $15,650  $168.55
  joint, no dependents      poverty guideline $21,150     $0.00   below the joint threshold
                            filing threshold $23,900   $106.23
  joint, two dependents     filing threshold $23,900     $0.00
                            poverty guideline $32,150  $416.55   their whole Virginia tax
```

**The cliff the statute wrote does not exist for a single filer, and the one that does is
`$3,700` further up and nearly four times the size.** I did not expect this and only found it
because the test asserted a jump at `$11,950` and got zero.

And the last of those three cliffs **is created or abolished by a federal fact**. The
`$300`-a-head credit and Virginia's 20% earned income match are alternatives — § 58.1-339.8
allows exactly one — and only the match is refundable. The same family of four with a
`$4,000` federal earned income credit takes the `$800` match, is `$383.50` in refund on both
sides of the guideline, and never sees the discontinuity. **Two returns with identical
Virginia income, one with a cliff in it and one without.**

**The rule: where a state offers an election between credits, the cliff structure of the
return is a property of the election, not of the state.** Model the choice, not the larger
number: `$1,200` capped at a `$416` tax is worth less than an `$800` refund.

### Two more Virginia findings, smaller but load-bearing

- **Itemizing is not a choice.** § 58.1-322.03(1)(a) *compels* a filer who itemized federally
  to itemize here, even where the Virginia standard deduction is larger — and the Virginia
  itemized figure is the federal one **less the state and local income tax** inside it, which
  is the largest line on most schedules. Every other state in this package takes the larger
  of the two, so this needed a `forcedWhenFederalItemizing` flag rather than a parameter.
  The engine applies the compulsion only when `stateItemizedDeductions` is supplied, because
  a silent zero would be worse than a high answer.
- **Since tax year 2025 Virginia's non-refundable earned income credit is dead law too.** The
  refundable match rose from 15% to 20%, which is the non-refundable rate — so the
  non-refundable option is weakly dominated at every income and can never be the right
  election. It is still in § 58.1-339.8.B.2 and still on the return. Three dead provisions in
  two days, all found by comparing two numbers the statute itself fixes.

### The competitive read is the sharpest yet, and it points the other way

`statetakehome-mcp` is still v0.1.1 of 2026-07-13. **Their Virginia is the best record of
theirs I have read**: the brackets are right, the standard deduction is right, and they
correctly show the joint schedule undoubled with a note saying so. It has no personal
exemption, no spouse tax adjustment, no age deduction and no Social Security subtraction.

```text
                                        theirs        ours      over by
single, $60,000                      $2,689.38   $2,635.90       $53.47    2.0%
joint, $120,000, two earners         $5,636.25   $5,271.80      $364.45    6.9%
single aged 70, $55,000              $2,401.88   $1,899.90      $501.97   26.4%
retired couple both 70, $90,000 with
  $30,000 of taxable Social Security $3,911.25     $622.00    $3,289.25  528.8%
```

**Six times the true tax for a retired Virginia couple**, and note the direction. Their Ohio
and Michigan were *short*, because those states' complexity is local taxes they omit. Their
Virginia is *over*, because Virginia's complexity is all subtractions. **A rate table is not
conservative in one direction. It is wrong in whichever direction the state happens to be
complicated**, which is a better argument for this package than "they are too low" was.

`verify_2026: true` is on their Virginia as well — a **fifth** state carrying their own
published to-do flag — and there is no 2025 schedule at all.

No kill criterion is met. npm searches for `virginia tax`, `state income tax mcp`,
`us tax mcp` and `occupational license tax` return the same set as July; `irs-taxpayer-mcp`
moved to 1.0.2 on 2026-09-08 and is still a `bin` with no `exports`.

### The publish ask, made smaller instead of louder

Eleven days of the same note. The ask itself is right, but its *shape* was three `npm
publish` runs on a machine with the right Node, the right checkout and a logged-in npm
session, and I have no evidence about which part of that is the friction. So Day 17 added
`.github/workflows/release.yml`: `workflow_dispatch`, dry run **on by default**, refuses to
publish a package whose own suite did not just pass in that checkout, skips a version already
on the registry, and publishes with `--provenance` so each tarball carries a signed
attestation tying it to the commit that built it. The human's step is now: create an npm
automation token, paste it as `NPM_TOKEN`, press the button.

**The rule I want to keep: when an ask has gone unanswered for ten days, the next move is to
make the ask smaller, not to repeat it.** I cannot create the token — that is an account
action on an outside service — but I can remove everything else around it. If it is still
unanswered in a week, the friction is not the shape of the ask and something else is true.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main`, then `npm ci` in
  **all three** packages. Needed again in all three.
- **`'VA'` was the canonical *unsupported* state in four tests**, in `registry.test.js`,
  `readme.test.js` and `tools.test.js` — exactly as `'OH'` was on Day 16. Moved to `'MN'`,
  with a comment saying the example has now moved twice. *An example drawn from the gap list
  is a tripwire that fires when the gap closes, and it is working.*
- **Ninth `tools/list` compression pass, and the first to yield a number worth keeping.**
  Virginia cost **1,674 bytes** gross; the pass recovered **826** by trimming illustrative
  arithmetic out of fifteen property descriptions and the tool description, deleting nothing
  operative; the ceiling moved 51,400 -> 53,000 for the rest. **So a state now costs about
  850 bytes of every client's context, forever.** That is the third consecutive raise and it
  should be the last spent this way: `state_income_tax` is 14,054 bytes, **27% of the whole
  payload**, because it carries the per-state fields of nine states and a caller uses one.
  Compression cannot fix growth that is linear in states — the next state should split the
  tool or move the per-state fields behind an opaque object validated at the boundary. Said
  so in the test, next to the eight earlier passes.
- Every illustrative figure was computed before it was written, per Day 14 — and one was
  wrong on the first pass again: the uneven-split spouse adjustment at `$5,000` is `$167.50`,
  not the `$141.92` I hand-computed by subtracting an exemption the worksheet's line 5
  already nets. `test/virginia.test.js` (18 tests) and a new README test pin all of them,
  including all six cliff figures.
- The `zeroTaxThreshold` test caught the two-floors finding by failing in the *quiet*
  direction: it asserted a jump at `$11,950` and got `$0.00`. **An assertion that something
  happens is worth more than one that a number is right, because the zero is the interesting
  answer.**
- Three new definition rules (`ageDeduction`, `spouseTaxAdjustment`, `lowIncomeCredit`), one
  new flag (`forcedWhenFederalItemizing`) and three new inputs (`taxableSocialSecurity`,
  `lesserSpouseIncome`, `federalPovertyGuideline`). None of them is Virginia-shaped by
  accident: the age deduction is the shape any state with a 100% withdrawal needs, and the
  credit election is the shape any state offering "the greater of" needs.
- All three suites run before the push, per Day 13. One commit carries all three packages.

### What I would do next

1. **Maryland's pension exclusion**, which is the largest thing this package still returns as
   zero — roughly `$3,300` of state and county tax on a Maryland retiree, which is the same
   error Day 17 just caught a competitor making in Virginia. It is a *correctness* gap inside
   coverage we already claim, and that now ranks above breadth.
2. **Kentucky's occupational taxes.** I looked today and **the per-jurisdiction data is not
   reachable**: KACo's and KLC's rate tables, the NFC payroll bulletins and every county site
   are blocked, nothing on GitHub or npm carries the table, and PolicyEngine does not model
   Kentucky local tax at all (`gov/local/ky` is a 404 and the wheel has no such tree). What
   *is* known from corroborated search: 87 counties levy on payroll at 0.50%–2.50%, median
   1%; Louisville 2.2%, Lexington 2.25%, Covington 2.45%; and **Kenton County caps the tax at
   the OASDI wage base** — 0.6997% to `$176,100`, a maximum of `$1,232.17`, having dropped a
   two-tier 0.9097%/0.1097% structure in 2024. **A wage cap makes a local income tax
   regressive and no rate table can express it**, which is the finding Kentucky is worth doing
   for. Do not re-spend the search: go straight to whichever unblocked fetch of the KACo data
   brief or the KLC city table is reachable that day.
3. **State withholding** — Ohio's SD withholding is the cheapest, because the rate table is
   already here.
4. **Ohio's resident credit factors**, still blocked as of Day 16; the PyPI route above is
   worth one check before concluding again.
5. **Virginia's four remaining subtractions** (military benefits, disability income, the
   `$15,000` state/federal employee subtraction, National Guard pay), which also bar the
   Credit for Low Income Individuals — so they are worth more than their face value.

---

## Day 16 — 2026-09-10

### What I did
Yesterday's first priority: **Ohio** — the state, its **679 municipalities**, and then, in the
back half of the day, its **214 school districts** too. `packages/us-state-tax` is **v0.12.0**
— **27 states** and **1,033 local income taxes**, up from 26 and 140 — and
`packages/us-tax-mcp` is **v0.14.0**. **683 tests**, up from 640, all green, zero
dependencies anywhere. The federal engine is untouched at v0.7.0 with its 283 tests.

That is by a distance the largest single expansion this repo has had: **893 new Ohio
jurisdictions against 140 local income taxes in total before today**, and Ohio was the
largest state the package was missing.

The second half was cheap for exactly the reason Day 14 predicted — *the second user of a
shape is nearly free*. The municipalities needed a new base, a new credit policy and a day.
The school districts needed two more bases and about an hour, because everything else was
already there.

### Ohio's printed rate schedule is not a function

Every other state here charges a tax that rises continuously with income. O.R.C.
§ 5747.02(A)(3) prints three rows for 2025:

```text
$0 - $26,050         0.000%
$26,050 - $100,000   $342.00 plus 2.750% of the excess over $26,050
over $100,000        $2,394.32 plus 3.125% of the excess over $100,000
```

and **the constants are charged whole on the first dollar of the band**:

```text
$26,050.00 of Ohio taxable nonbusiness income     $0.00
$26,050.01                                      $342.00
```

A `$342` tax on one cent of income, at an income two thirds of the way down the
distribution rather than at the top of it. Net of the `$20` exemption credit — which the
poorer filer cannot use, because their tax is already zero — the step a real single filer
walks into is **`$322.00`**.

The `$342` is a fossil: before 2019 Ohio taxed the bottom of the schedule at 0.495% and up,
and when the legislature zeroed those bands it kept the constants they had accumulated.
`applyBrackets` cannot express this, which is why `baseAmountSchedule` is a new `RateRule`
rather than three rows in the old one. **A marginal walk of the same printed table
understates every Ohio filer above the threshold by the whole constant** — which is exactly
what "Ohio: 0% / 2.75% / 3.125%" invites a model to do.

### The second discontinuity was created by a rate cut three months ago

HB 96 (signed 30 June 2025) cut the top rate from 3.5% to 3.125% and lowered the `$26,050`
constant from `$360.69` to `$342.00`. It left the `$100,000` constant at `$2,394.32` —
which is precisely what `$360.69` chained to:

```text
$360.69 + 2.75% x $73,950 = $2,394.315   the old constant, chained
$342.00 + 2.75% x $73,950 = $2,375.63    the new one, chained
```

So the printed 2025 table steps a **second** time, by **`$18.69`**, at `$100,000`. Four
independent transcriptions of the booklet agree on both constants, so it is the law rather
than a typo in one of them, and this package implements it as printed.

**The rule: when a statute is amended by changing numbers inside a table, check whether the
numbers still agree with each other.** An amendment that re-bases one constant and not the
one derived from it leaves a discontinuity that no summary of the change will mention,
because every summary is about the rate.

### Two Ohio credits are dead law, and the arithmetic is checkable

This is the finding I did not expect and the one I am most confident nobody else publishes.

**The `$20` exemption credit.** § 5747.022 allows `$20` per exemption below `$30,000` of
modified AGI. § 5747.02 charges nothing on the first `$26,050` of taxable income — and for
a filer with no business income, taxable income **is** modified AGI less exemptions. So the
credit is worth something only where

```text
modified AGI - exemptions > $26,050    AND    modified AGI < $30,000
```

At `$2,400` an exemption, one exemption opens a window `$1,550` wide and a **second
exemption moves the lower bound to `$30,850` and closes it for good**. A per-exemption
credit that can only ever be claimed by a filer with exactly one exemption.

**The joint filing credit's 20% row.** § 5747.05(E) pays 20% of the remaining tax below
`$25,000` of modified AGI less exemptions — which for a couple with no business income is
their taxable nonbusiness income, below the `$26,050` band, so the tax it is a share of is
zero. Business income cannot rescue it either: the flat 3% only reaches income above the
`$250,000` deduction, so any couple with business tax has a modified AGI ten times the
row's ceiling. **The highest rate that credit is ever actually paid at is 15%.**

**The rule: a credit with an income ceiling and a tax with an income floor may not overlap.
Check the two against each other before modelling the credit as live.** It is one
subtraction, it is never in the instructions, and where it bites the published parameter is
fiction. I expect this to find things in other states — Ohio is simply the state with the
largest zero band.

### The base is a payroll figure, and the 401(k) deferral is the tell

Ohio's 679 municipalities do not tax an income measure. § 718.01(R) adopts "wages, as
defined in section 3121(a) of the Internal Revenue Code, without regard to any wage
limitations" — **box 5 of the W-2, not box 1**. Two consequences run in opposite directions:

- an elective deferral **does not** reduce it, so a Columbus resident deferring the
  `$24,500` 2026 maximum is charged 2.5% on all of it: **`$612.50` a year** that a model
  reading box 1 or federal AGI never sees;
- intangible income — interest, dividends, capital gains — is outside it **entirely** under
  § 718.01(S), as are pensions, IRA distributions, Social Security and unemployment. **An
  Ohio retiree with no wages owes their municipality nothing.**

That last is the mirror image of Michigan, and the pair is worth keeping. In Michigan the
*city* excludes the pension while the state taxes it through a four-tier birth-year
deduction. In Ohio the *municipality* excludes it and the state taxes it in full. Same
retiree, same two-layer system, opposite layer doing the exempting.

**The generalisation: when a local tax's base is defined by cross-reference to a payroll
statute rather than to an income tax statute, the elective deferral is where it diverges
from every income figure you have.** Ask what box the number comes off.


### Ohio taxes one paycheck on three bases, and they disagree about what a wage is

The school districts are the finding of the back half of the day, and it is a better one
than I expected. 214 of Ohio's 600-odd districts levy an income tax on a separate SD 100
return, at 0.25% to 2.00%, **on top of** the state and municipal taxes — and the base is one
of two, chosen by the district's own ballot language:

```text
traditional     modified AGI less exemptions                        146 districts
earned income   wages and net self-employment earnings only, with
                NO deductions and NO exemptions                      68 districts
```

Set the earned income base beside the municipal one and they contradict each other on the
same paycheck:

```text
$100,000 salary, $24,500 deferred to a 401(k)
  Columbus, 2.5%          box 5 of the W-2, § 718.01(R)     charged on $100,000
  Geneva Area CSD, 1.25%  wages "as included in MAGI"       charged on  $75,500
```

**The same deferred dollar is inside one local wage tax and outside the other**, and both
are levied on the same person by two governments whose boundaries overlap. It is worth
`$612.50` to Columbus and saves `$306.25` from the district. A model that treats "Ohio local
wage tax" as one thing gets one of the two wrong whichever way it guesses.

The traditional base is the mirror image. It is **modified** AGI less exemptions, and the
modification is the business income deduction **added back** — so a pass-through owner whose
`$250,000` deduction removed the income from Ohio AGI, and with it from every municipal base
in the state, is still taxed on it by their school district. **It is the only base in this
package that reaches income the state's own return does not.**

**The generalisation: when two governments tax "wages" over the same ground, do not assume
they mean the same wages. Find the statute each one cross-references and check what it does
to the commonest adjustment there is.** Ohio has three answers to one question and all three
are in force at once.

Two smaller things worth keeping:

- **§ 5748.02 requires a school district rate to be a multiple of one quarter of one per
  cent, and all 214 are.** That is the strongest check available on a transcription of a
  five-page PDF: 214 rates that are all exact multiples of `0.0025` is not what a mis-parse
  looks like. Together with the document's own printed totals — "Total number of districts
  are 214" and "Taxes based on earned income only; 68 districts", both independently
  confirmed from outside the dataset — it is three checks on a single source. **Look for the
  statutory shape a parameter has to have; it is a checksum the legislature wrote for you.**
- **The district's `$50` senior citizen credit has no income limit at all**, where the
  state's own `$50` senior credit stops at `$100,000`. Same amount, same age, same state,
  one of them means-tested and the other not.

Ohio's own Finder resolves an address to a district and this package cannot, so
`schoolDistrict` is the four-digit number the SD 100 uses. Two districts share a name — there
are two Northwestern LSDs and two Crestview LSDs — so a name resolves when it is unique and
is an error naming both numbers and both counties when it is not.

One more thing Ohio publishes that nobody models: **the terms of each levy, inside the
district's name**. `Danville LSD (1.25% expires 2034; 0.50% CPT)` is a 1.75% rate built from
a levy that ends in 2034 and one that runs until repealed, and **102 of the 214 districts
carry an expiry date**. The terms are kept as a per-district note rather than in the name a
result prints on every line, because a rate with an end date is a rate that will change and
a caller should be told which. This is also the one table in the package where the *newer*
year is the sourced one: Ohio published the 2026 list on 30 December 2025, so 2025 is the
carry-forward here and is flagged provisional — backwards from every other parameter in the
repo.

### Ohio's commuter is symmetric where Michigan's is not, and it is one word of statute

```text
$60,000 of wages, Westerville 2.0% and Columbus 2.5%

live Westerville, work Columbus    Columbus  $1,500.00 + Westerville     $0.00 = $1,500.00
live Columbus, work Westerville    Westerville $1,200.00 + Columbus   $300.00 = $1,500.00
```

**A commuter pays the higher of the two rates, whichever way they commute.** Day 15 found
the opposite in Michigan: a Lansing resident commuting into Detroit pays 70% more city tax
than one working at home, and reversing the commute costs nothing. The whole difference is
what the credit is capped at — Michigan caps it at the home city's **nonresident** rate,
which MCL 141.611 fixes at *half* the resident rate, and Ohio's ordinary ordinance caps it
at the home municipality's own full rate. One word.

What still differs in Ohio is **who is paid**: the workplace municipality collects first, by
withholding under § 718.03, and the home municipality gets only the difference.

### The one place I guessed, and why

Ohio grants **no statutory resident credit**. Chapter 718 leaves it to each municipality's
ordinance, and the two figures that describe it — the share of the other municipality's tax
credited, and the rate that share is capped at — are the "Credit Rate" and "Credit Factor"
columns of Ohio's own rate table, which I could not reach. Three options:

1. refuse the two-city case — which is a large share of working Ohio, uncomputable;
2. return the range — which the result shape cannot hold;
3. assume the modal ordinance, name it in the credit line, and say what it is worth.

I took the third, against this package's own "never guess" ethos, deliberately. The credit
is named `Credit for income tax paid to X (assumed: 100% of the tax, capped at Y's own rate
— Ohio has no statutory credit)`, a dynamic note says what a less generous ordinance would
cost, and `residentCreditRate` / `residentCreditLimitRate` override it.

**The rule: a guess is admissible when it is the modal case, it is labelled in the output a
model will read, its cost is quantified, and it is overridable. A guess that is none of
those four is the thing the ethos is about.**

### Sourcing: five transcriptions, and the one that disagreed was settled by its citation

Every Ohio source is blocked at the proxy — `tax.ohio.gov`, `dam.assets.ohio.gov`,
`codes.ohio.gov`, `ritaohio.com`, `ccatax.ci.cleveland.oh.us`, and every legal-reference
site I tried. Only `raw.githubusercontent.com` answers `curl` at all. So Day 15's method
again: **find who else had to read it.** Five independent codebases carry the 2025 schedule
and all five agree on `$342.00`, `$2,394.32` and 3.125%.

For **2026** they did not agree. Four sources plus the whole secondary literature on HB 96
say a flat 2.75% above `$26,050` with the constant re-based to `$332.00`; one parameter pack
said the 2026 table is unchanged from 2025, top bracket and all, and cited a "2026 Ohio
Estimated Income Tax Payment Worksheet" at a URL whose Cloudinary version id is the same one
the **2025** worksheet carries.

**The rule: when transcriptions disagree, audit the citation rather than counting the
votes.** A fabricated or mis-copied URL is visible from here in a way a wrong number is not,
and it settled the year in one look.

Two more sourcing notes worth keeping:

- **PolicyEngine-US stores Ohio's constants as an implied average rate** on the zero band —
  `0.0131287` for 2025, `0.0127448` for 2026 — because their marginal-bracket model has
  nowhere else to put them. Multiply by `26,050` and you get `$342.00` and `$332.00`. A
  model that cannot express a parameter will encode it as whatever it *can* express, and
  that encoding is still evidence: **read a source's workaround, not only its data.**
- **Prefer the dataset that records its own corrections.** The 679-municipality file I used
  is bulk-sourced from Ohio's Finder database and carries "STALE, CORRECTED 2026-09-02"
  notes on its own earlier claims, plus a "CHECKED — it isn't a bug" note about a degenerate
  row Ohio itself publishes. The cleaner curated table I checked it against gives Beavercreek
  1%, and **Beavercreek has never levied a municipal income tax**. One row I could verify
  independently decided between two sources that agreed everywhere I already knew the answer.

### Competitive re-check: their Ohio is short by two thirds of the bill

`statetakehome-mcp` is still v0.1.1 of 2026-07-13. Its Ohio record, read out of the
published tarball today:

```json
{"name":"Ohio","abbr":"OH","tax_type":"progressive","verify_2026":true,
 "brackets":{"single":[{"rate":0.0,"min":0,"max":26050},
                       {"rate":0.0275,"min":26050,"max":null}]},
 "notes":"Flat 2.75% au-dessus de $26,050 (2026, HB96). Municipalités 1-3% en sus.",
 "standard_deduction":{"single":0,"married_filing_jointly":0},"source_year":2026}
```

Two errors in opposite directions again, exactly as Michigan was:

1. **No base amount at all** — the `$332` constant is missing, so every Ohio filer above the
   band is `$332` light;
2. **no personal exemption** — Ohio has no standard deduction and they have correctly
   entered zero, but they have also dropped the `$2,400`/`$2,150`/`$1,900` exemption, which
   is `$59.13` of tax the other way.

```text
single, $60,000, 2026        theirs   $933.63
                             Ohio   $1,206.50   short by $272.88, 22.6% of the state tax
                             + Columbus $1,500.00
                             total  $2,706.50   short by $1,772.88, 65.5% of the bill
```

They also carry `verify_2026: true` on a **fourth** state, and their Ohio has no 2025 at all
— `source_year` is 2026 and there is no second schedule, so a 2025 Ohio return is
unavailable rather than wrong. Their note "Municipalités 1-3% en sus" is honest about the
gap; the range is also wrong at both ends (0.45% to 3.00%).

No kill criterion is met. Nothing new on npm for Ohio, municipal income tax or state tax
generally; the same eight unrelated packages that came back in July.

### One note on the human

**A notification today.** Not the publish ask, which is word for word the one open since Day
6. The new thing is that the product they last saw is not the product now: local coverage
went from 140 jurisdictions to **819** in one day, the largest state that was missing is in,
and a published competitor's Ohio answer is short by two thirds of the bill for a Columbus
resident. That changes what publishing is worth, which is a fact about their decision rather
than a repeat of the request.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main`, then `npm ci` in
  **all three** packages. Needed again in all three.
- **The registry test used `'OH'` as its canonical *unsupported* state**, in four places, and
  closing the gap broke all four. That is the test working: an example drawn from the gap
  list forces you to notice when the gap closes. Moved to `'VA'`, with a comment saying so.
- `withOneMoreEarnedDollar` had to bump `qualifyingWages` as well as `earnedIncome`.
  Otherwise Ohio's municipal marginal rate reports **zero** for a Columbus resident whose
  next dollar of wages costs 2.5 cents — and the municipal tax is the larger half of the
  return. *A new input that is a tax base has to be added to the one-dollar experiment, or
  the marginal rate silently omits it.*
- Every illustrative figure in the new docs was computed before it was written, per Day 14 —
  and two of them were wrong on the first pass. `$250,000` of wages costs `$7,022.45`, not
  the `$6,466.88` I had guessed, and Columbus at `$60,000` is `$1,216.50` of state tax, not
  `$1,014.13`. `test/ohio.test.js` (26 tests) and four new README cases pin all of them,
  including the crossover at `$126,408.32`.
- **Eighth `tools/list` compression pass, and the second consecutive raise.** Ohio's seven
  MCP fields cost 2,394 bytes; the pass recovered about 300 without deleting anything
  operative and the ceiling moved from 48,800 to 51,400. Day 15's finding holds and hardens: six passes ago the
  ceiling was covering prose, it is now covering content, and a ceiling that can only be met
  by deleting what a model needs is the wrong ceiling. Said so in the test, next to the seven
  earlier passes.
- `city` and `workCity` now dispatch on the state the way `county` already did
  (`cityDefinition`), so Michigan and Ohio share the field and share nothing behind it.
- All three suites run before the push, per Day 13. One commit carries both packages.

### What I would do next

1. **Ohio's resident credit factors**, which would turn today's labelled guess into data for
   all 679. **I looked today and the data is not on GitHub**: the Finder CSV's "Credit Rate"
   and "Credit Factor" columns appear in exactly one repository, in a *fetcher script that
   has never run* (its author's network blocks Ohio too), and nowhere else. So this needs
   either an unblocked fetch of `OHMuniRateTable.csv` or RITA's own member table, and a
   future run should not re-spend the search — go straight to whichever fetch is reachable
   that day. Recording the negative result is the point.
2. **Kentucky's occupational taxes**, on the machinery Ohio just built — Louisville 2.2%,
   Lexington 2.25%, and Kentucky is already in the package. Same wage base, no credit.
3. **Virginia.** Still the cheap quiet day: no local income tax, a federal-AGI base.
4. **State withholding** — California DE-44 Method B, New York NYS-50-T, and now Ohio's own,
   which Treasury administers alongside the school district one. Ohio's SD withholding is the
   cheapest of the three, because the rate table is already here.
5. **Maryland's pension exclusion**, the largest thing this package still returns as zero for
   a Maryland retiree.

---

## Day 15 — 2026-09-09

### What I did
Yesterday's first priority: **Michigan's 24 cities**. `packages/us-state-tax` is **v0.10.0**
— 26 states plus **140 local income taxes**, **231 tests**, up from 214 — and
`packages/us-tax-mcp` is **v0.12.0** with **126**, up from 123. The federal engine is
untouched at v0.7.0 and its 283 tests still pass. **640 tests**, all green, zero dependencies
anywhere.

### The first local tax here that is not a rate on a state figure

Every local tax this package had before today charges a rate on something the state return
already computed. New York City on New York taxable income, Yonkers on the New York *tax*,
Maryland's and Indiana's counties on the state's own taxable income. That is what made them
cheap: `LocalBase` picks a line and the engine applies a rate to it.

**A Michigan city has no line to pick.** The Uniform City Income Tax Ordinance (MCL 141.601
et seq.) defines its own base, and the divergences from federal AGI are large, uniform across
all 24 cities, and all in the same direction:

```text
pensions, annuities and IRA distributions   excluded ENTIRELY
Social Security and railroad retirement     excluded entirely
unemployment compensation                   excluded entirely
military pay                                excluded entirely
```

So a Michigan city taxes a retiree at **zero** while Michigan itself is still working out
which of the four birth-year tiers of MCL 206.30(9) they fall in. And it runs the other way
too: a family whose *Michigan* tax is a refund because of the state's 30% earned income
credit still owes Detroit in full — `$614.40` on `$28,000` of wages with two children,
against a state result that is negative. **The city is not downstream of the state return,
so nothing on the state return can reach it.**

That needed a new `LocalBase` — `cityIncome` — plus a `cityIncome` input, and the same
treatment Pennsylvania, New Jersey and Massachusetts get: ask for the figure, and when it is
missing derive it and **say which way the derivation errs**. Federal AGI less
`retirementIncome` is exact for a wage earner and too high for anyone with Social Security,
unemployment or military pay in AGI. The note says exactly that.

### Detroit is 60% of what Michigan itself charges

```text
single filer, $100,000                     Michigan   $4,003.50   at 4.25%
                                           Detroit    $2,385.60   at 2.4%
                                           total      $6,389.10   marginal 6.65%
```

Twenty of the 24 are at 1%, Highland Park at 2%, Grand Rapids and Saginaw at 1.5%. Detroit's
2.4% comes from Public Act 56 of 2011; the others above 1% have their own enabling acts.

### Three things derived rather than stored, and the third is the interesting one

**1. The nonresident rate is half the resident rate.** MCL 141.611 fixes the ratio and all
24 honour it exactly, the four above-1% cities included. So the file stores one rate per city
and halves it, and a test checks the halving against the four separately published
nonresident rates. Day 5's rule, in the cheapest form it has ever taken: 24 numbers that a
division already produces.

**2. The exemption is `$600` and it was `$600` in 1964.** MCL 141.631(1) set the floor and
never indexed it. Sixteen of the 24 are still on it. Michigan's *own* personal exemption is
`$5,800` for 2025 and **is** indexed annually, so the city one is 10.3% of it. At the highest
rate in the state it is worth this:

```text
Detroit, 2.4% x $600   =  $14.40   of tax, per person, per year
a 1% city, $600        =   $6.00
```

**A statutory minimum that is never indexed is a tax rise every year**, and this is the
cleanest instance of it I have found: sixty-two years of inflation have turned the deduction
the Legislature thought it was granting into fourteen dollars and forty cents. It is also
what made a scoping decision easy. The 24 cities differ, by ordinance, in *which* additional
exemptions they allow — age 65, blindness, deafness, paraplegia — and I could not source that
for all 24. I did not need to: **the whole class of omission is bounded by `$14.40`**, the
note says so, and being exactly right about it would have cost more bytes than the rest of
the file. That is a better answer than either guessing or refusing.

The corollary worth keeping: **when you cannot source a parameter, price it before deciding
whether you need it.** A missing figure that cannot move the answer by more than a rounding
error is a footnote, not a blocker.

**3. The credit for tax paid to another city fails in the direction people commute.** A
resident of one taxing city who works in another owes both, and the home city credits the tax
paid — capped at **the home city's own nonresident rate**. The cap is the whole story:

```text
Detroit resident working in Grand Rapids
  pays GR $445.50 (0.75%), Detroit credits all of it (cap 1.2%)
  total $1,425.60 — exactly what they would owe Detroit if they never left

Lansing resident working in Detroit
  pays Detroit $712.80 (1.2%), Lansing credits $297 of it (cap 0.5%)
  total $1,009.80 against $594.00 at home — 70% MORE city tax for the same wage
```

**The credit is complete for the filer who did not need it and short for the one who did**,
and which of the two you are is decided by the ratio of your own city's rate to the other's.
A rate table cannot express it because it is a fact about a *pair* of jurisdictions.

### The sourcing problem, and how it was solved

`michigan.gov`, `legislature.mi.gov`, `detroitmi.gov`, `grandrapidsmi.gov`,
`help.nfc.usda.gov` and every SEO tax site are blocked at the proxy — `WebFetch` has a
narrower allowlist than I assumed and returned `EGRESS_BLOCKED` for all of them. And
**PolicyEngine-US does not model Michigan city income tax at all**, so Day 14's rescue was
unavailable.

What worked was GitHub code search. Three independent repositories carry the table:

1. `openaccountants/openaccountants` — a payroll skill doc with all 24 cities, rates and the
   inter-city credit rule.
2. `mkyw/finance-app-public` — a curated `_MI_CITY_RATES` dict, same 24 cities, same four
   non-1% rates.
3. `capable78638974979473297813001-pixel/payroll-tax-engine-` — a `MI-cities-2026.json` with
   per-city rates **and exemptions**, each carrying a provenance note naming the city page or
   PDF it was read from, plus a recorded correction (a consolidated table's Saginaw entry was
   wrong and was fixed against Saginaw's own FAQ).

All three agree on the city list and on every rate. For the exemptions I then confirmed the
outliers independently through `WebSearch`: Grayling `$3,000` (its own GR W-4), Portland
`$1,000` (its P-1040 instructions), Ionia `$700` and Springfield `$750` (their own pages),
Detroit `$600`, Battle Creek and Saginaw `$750`. **Hudson's `$1,000` is the one I could not
confirm a second time from here**, and it is recorded as such.

Generalising Day 14: *when a source cannot be reached, find the events that would have
changed it.* Day 15 adds the sibling — **when a source cannot be reached, find who else had
to read it.** A rate table that three unrelated codebases transcribed independently, from
different documents, is better evidence than one fetch of the document would have been,
because three transcriptions agreeing rules out the transcription error a single fetch cannot.

I also checked the events, per Day 14: a Michigan city income tax rate changes only by
ordinance with voter approval, no such change is reported for 2026, and the only live
Michigan income tax story is the *state* "Invest in MI Kids" ballot measure — a 5% surcharge
over `$500,000`/`$1,000,000` that would take effect in **2027** if it makes the ballot. So
2026 is 2025 as a matter of ordinance rather than as a carry-forward, and neither year is
provisional. A test asserts every city's two years are identical and both `published`.

### The seventh compression pass corrected the sixth's rule, expensively

Day 14: *choose by multiplicity, not by length* — a property carried by four tools is worth
four times a longer one carried by one. True, and I applied it, and **the payload got 215
bytes bigger while I deleted words from it.**

The unit was wrong. Three of the four tools carry only the **first sentence** of each
description (`terseProperties` derives the short form that way). So what is paid four times
is the first sentence and what is paid once is everything after it. Rewriting
`isSpecifiedServiceTradeOrBusiness` from

```text
"True for a specified service trade or business under § 199A(d)(2). That covers health, ..."
```

to a tighter single sentence beginning `"A § 199A(d)(2) specified service trade or business:
health, law, ..."` shortened the description by 53 bytes and lengthened the *first sentence*
by 218 — which is 654 bytes across the three terse copies. Same for
`disqualifiedInvestmentIncome`.

**The rule, corrected: trim the tail to save once, trim the first sentence (or author an
`x-terse`) to save three times, and never move a clause forward in order to shorten a
sentence.** In any derived-short-form scheme, ask what the derivation keeps before deciding
what is expensive.

The redone pass recovered **448 bytes** against Michigan's **1,050**, all of it from tails
and authored short forms, none of it operative content. The remaining 602 was bought by
raising the ceiling from 48,000 to **48,800** — and that is the other half of the entry.
**Six passes in, the payload has no fat left; what is left is content.** The ceiling was
always an arbitrary round number, the payload it now holds describes 26 states, 140 local
income taxes and the whole federal return in 48,579 bytes, and the honest move was to say so
in the test rather than sand another 600 bytes off the descriptions that exist to teach a
model what the fields mean. The test comment records both the new figure and why.

### Competitive re-check: their Michigan record is wrong in both directions at once

`statetakehome-mcp` is still v0.1.1 of 2026-07-13. Its Michigan entry, read out of the
published tarball today:

```json
{"name":"Michigan","tax_type":"flat","rate":0.0425,"verify_2026":true,
 "notes":"Flat 4.25%. Exemption perso $5,900/pers.",
 "standard_deduction":{"single":5900,"married_filing_jointly":11800},
 "source_year":2026}
```

Three findings:

1. **No mention of a city income tax anywhere** — not even the `"County tax 2.25-3.20% en
   sus"` note their Maryland record carries. For a single Detroit filer at `$100,000` their
   answer is `$3,999.25` against `$6,389.10`: **short by `$2,389.85`, 37.4% of the bill**, in
   a package whose entire subject is take-home pay.
2. **The `$5,900` is a per-person exemption filed under `standard_deduction`, so it is not
   multiplied by anything.** A Michigan joint return with two children has `$23,200` of
   exemptions; their model gives `$11,800`. That is **`$484.50` too high** — the opposite
   direction to (1), from a different mechanism, on the same state.
3. `verify_2026: true` again, a third state carrying their own published to-do flag.

And (2) is a gift as well as a finding: their `$5,900` is a plausible 2026 Michigan
exemption, which I could not source from here. Michigan's 2026 stays `provisional` and its
note now **names both candidates and prices the difference at `$4.25` per exemption** — the
same treatment Maryland's 2026 standard deduction got on Day 14. Day 13's rule keeps paying:
read what the competition wrote in its data. Sometimes it is a to-do list; sometimes it is a
figure you could not otherwise reach, and the honest response to two plausible published
figures is still to say there are two.

No kill criterion is met. Nothing new on npm for Michigan, Detroit or city income tax;
`irs-taxpayer-mcp` moved 1.0.1 → 1.0.2 and still cannot be imported.

### One note on the human

**A notification today**, the second since Day 11 and for the same reason: something new is
at stake that they would want to know without opening the session. Not the publish ask —
that is word for word the one open since Day 6. The new thing is the competitive datum: a
published competitor's Michigan answer is short by 37% of the bill for a Detroit filer, and
their own data hands us a 2026 figure we could not otherwise source.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main`. Needed again.
- **`npm ci` in `packages/us-tax-mcp` was missing**, and `npm run build` failed silently with
  `error TS2688: Cannot find type definition file for 'node'` because I had piped the build
  to `/dev/null`. I then measured a **stale `dist/`** twice and drew a wrong conclusion from
  it. *Never redirect a build to `/dev/null` when the next command reads its output.* The
  215-byte mystery above cost twenty minutes for this reason.
- Every illustrative figure in the new docs was computed before it was written, per Day 14.
  `test/michigan-cities.test.js` (15 tests) and two new `readme.test.js` cases pin all of
  them, including the ones stated as ratios — "60% of what Michigan itself charges" and "70%
  more city tax" are both assertions, not prose.
- The shared name-lookup in `localities/counties.ts` grew a `suffix` and a `noun`. A city has
  no suffix to make optional, and the old message ended `The word "County" is optional` — a
  model reading it would try `"Detroit County"`. `suffix: null` suppresses it and a test
  asserts the word "County" does not appear in a Michigan error at all.
- `workCity` without `workCityEarnings` is **refused** rather than computed as zero, on the
  same reasoning as Maryland's `stateItemizedDeductions` without `federalItemized`: a model
  that named a work city meant to be charged for it, and a silent zero hides that.
- All three suites run before the push, per Day 13. One commit carries both packages.

### What I would do next

1. **Ohio**, and it is now the obvious one. It is the largest state missing, its 600-odd
   municipal income taxes are the *same shape* Michigan just built — a city base, a resident
   and a nonresident rate, a credit for tax paid to another municipality — and the honest
   first version is the state return plus the largest 30 or so municipalities and a loud
   note. The Finder's rate CSV is blocked at the proxy, but `mkyw/finance-app-public` carries
   a curated fallback table and today's method (three independent transcriptions) applies.
2. **Kentucky's occupational taxes**, on the same machinery. Louisville 2.2%, Lexington
   2.25%, and Kentucky is already in the package.
3. **Virginia.** Still the cheap quiet day: no local income tax, a federal-AGI base.
4. **State withholding** — California DE-44 Method B and New York NYS-50-T, the other half of
   `paycheck_withholding`. Michigan's own is now a candidate too, and Detroit's has a hook:
   Treasury administers it, so it is one portal with the state's.
5. **Maryland's pension exclusion**, the largest thing this package still returns as zero for
   a Maryland retiree.
6. **Maryland's poverty level credit**, which needs a federal poverty-guideline table by
   household size — a deliberate decision, not a passing one.
7. **§ 68**, still blocked on irs.gov.

Do (1). Ohio is the third state on the city-base machinery, it is the largest gap left, and
the `workCity`/`cityIncome` shape built today is exactly what it needs. Do (3) if a quiet
day is wanted instead.

---

## Day 14 — 2026-09-08

### What I did
Yesterday's first priority — **Maryland** — and then, because the machinery it needed was
exactly the machinery Indiana has been waiting for since Day 11, **all 92 Indiana counties**
as well. Two states' worth of local income tax in one day, and the second one cost about a
tenth of what the first did.

`packages/us-state-tax` is **v0.9.0** — 26 states plus **116 local income taxes** where
there were two, **214 tests**, up from 177 — and `packages/us-tax-mcp` is **v0.11.0** with
**123**, up from 118. The federal engine is untouched at v0.7.0 and its 283 tests still
pass. **620 tests**, all green, zero dependencies anywhere.

### The county design decided on Day 12, built

Day 12 settled the shape without building it: **a `county` field taking a name, keyed to the
state, validated against that state's list, with the rates in data rather than in the type**,
because `LocalityCode` is a published type and a type whose members change every October is
the wrong type. That is what Maryland got. Twenty-four jurisdictions, none of them in an
enum, matched case-insensitively with the word "County" optional — and one deliberate
refusal: **`'Baltimore'` alone is an error**, because Baltimore City and Baltimore County are
different jurisdictions that set their own rates, and resolving it to either would be a
guess dressed as an answer.

The result type widened from `LocalityCode` to `LocalityCode | (string & {})`, which keeps
`'NYC'` and `'YONKERS'` in an editor's autocomplete while accepting a county name. That is
the whole cost of the decision, and it is smaller than the 94-member union would have been.

### A rate schedule that is not a rate schedule

Anne Arundel and Frederick are the only two Maryland counties with more than one rate, and
they appear as identical-looking multi-row entries in the same chart in the state's
instructions. **They are not the same kind of object.**

```text
Anne Arundel   marginal brackets     2.70% on the first $50,000, 2.94% above
Frederick      one rate, by bracket  2.96% on ALL of $150,000, 3.20% on all of $150,001
```

So the dollar that takes a Frederick filer from `$150,000` of Maryland taxable income to
`$150,001` costs **`$360.03`**, and the same dollar in Anne Arundel costs three cents. That
needed a third `RateRule` kind — `rateByBracket`, where the bracket selects a rate and the
rate applies to the whole income — and it is the first genuinely new rate *shape* in this
package since Massachusetts's income classes.

**Generalising: a table of rates against income ranges does not tell you which of the two it
is.** Reading the chart and assuming brackets is the natural mistake, it is silent, and in
Frederick it is wrong at three thresholds by the whole rate step times the whole income.

### Three figures derived rather than stored, and the rule they share

1. **The local earned income credit is the county rate, times ten.** Md. Code, Tax-Gen.
   § 10-704(d) sets it at the lesser of the county tax and `10 x county rate x` the federal
   § 32 credit. So twenty-four counties have twenty-four different earned income credits and
   there is not one credit parameter in the county table: Worcester's 2.25% is a 22.5% match
   and Dorchester's 3.30% is 33%, and both follow the rate the next time a council moves it.
2. **The special nonresident tax rate is the lowest county rate.** § 10-106.1 names no
   figure; it points at the minimum, which is Worcester's 2.25% — and 2.25% is also the
   statutory floor a county may set. The test asserts `min(every rate in the table) ===
   2.25%` rather than storing the nonresident rate, which makes a typo'd county rate a
   failing test instead of a plausible number.
3. **The child credit's published `$24,001` ceiling is a derivation, and it is only right for
   a one-child family.** `$500` per child under 6, less `$50` per `$1,000` of AGI over
   `$15,000` *on the return* — so `15,000 + (500/50) x 1,000 = 25,000`, less a dollar for the
   "or fraction thereof" rounding. A family with two young children keeps some credit to
   `$34,001` and three to `$44,001`. The same shape as New York's Empire State child credit
   on Day 10 and Massachusetts's Limited Income Credit ceiling on Day 13: **a published
   ceiling is a claim about one filer, and the tables never say which one.**

### The cliff I got wrong, and the rule that came out of it

I wrote in the first draft that Maryland's new 2% capital gains surtax costs `$20,000` on one
dollar of income for a filer with a `$1,000,000` gain. The engine said `$6,933.08`, and the
engine was right.

The surtax applies when **federal AGI exceeds `$350,000`**, to the net capital gain in
taxable income. A filer standing exactly on the threshold has `$350,000` of AGI — so the
largest gain that can be standing there with them is `$350,000`, and 2% of the taxable income
left after the deduction is `$6,933.08`. The `$20,000` figure is real but it is not a cliff:
it is what a filer with `$1,050,000` of AGI pays, and they were over the threshold anyway.

**A cliff's size is bounded by the income that can stand on it.** A threshold measured on the
same figure the tax is charged on cannot produce a jump larger than the rate times the
threshold, however large the underlying amount could theoretically be. It is obvious once
written down and I got it wrong in prose first, which is the argument for computing every
figure that goes into a doc comment rather than reasoning about it — every illustrative
number in today's diff was produced by running the engine, and two of them changed as a
result.

`$6,933.08` is still the largest single-dollar step in this package: against `$4,528.82` for
CalEITC's investment-income cliff and `$1,381` for New Jersey's retirement wall.

### Indiana cost a tenth of what Maryland cost, and that was the point

The county design is a *shape*, and the second state to use it is nearly free. Indiana's 92
counties needed one new file of data, a shared lookup module, and nothing else: no new rate
kind, no new credit, no new input field. `county` already existed; the base
(`stateTaxableIncome`) already existed, because Schedule CT-40 line 1 is IT-40 line 7, the
same taxable income the state rate is applied to.

What that bought:

```text
state rate         3.00% (2025), 2.95% (2026)
average county     1.914%   — so 39% of an Indiana income tax bill is a county's
Porter County      0.5000%  the lowest
Randolph County    3.0000%  the statutory maximum under IC 6-3.6 — and MORE than
                            the state rate from 2026
```

**A Randolph County filer pays their county more than their state**, which is not a sentence
anyone writes about a state with a flat 3% income tax. And the spread is six to one on
identical income: `$295` against `$1,770` at `$60,000`.

The 2026 story is better still. The state rate stepped down 3.00% → 2.95%, and Carroll,
Grant, Greene, Howard, Shelby and Union raised their county rates on the same day, by 0.10 to
0.75 points. For a Union County filer with `$59,000` of Indiana taxable income the **state
cut is worth `$29.50` and the county rise costs `$442.50`**: their bill went up 14% in a
year every summary of Indiana tax called a cut. A model with only the state rate reports the
cut and nothing else.

Two rules a rate table cannot hold, both modelled:

- **The county is the one the filer lived in on 1 January**, for the whole year. Moving in
  February changes nothing until the next return.
- **A county rate can change on 1 October as well as 1 January** (IC 6-3.6-3), and the
  Department of Revenue reissues Departmental Notice #1 for withholding when it does — while
  the annual return keeps using the 1 January rate. So in a county that raised its rate in
  October, *the rate withheld and the rate owed are different numbers*, and only one of them
  is in this package.

And four counties have rates with more than four decimal places — Brown 2.5234%, Carroll
2.2733%, Jasper 2.8640%, Whitley 1.6829%. **A rate nobody would choose is a rate that was
computed**: IC 6-3.6 builds a county rate out of separate expenditure, public safety,
economic development and property tax relief components, and the chart prints the sum. That
is the same "the table is a rendering" rule as Day 5, arriving in the shape of a decimal
expansion rather than a formula.

### How 92 rates were verified without reaching the source

`in.gov` is blocked at the proxy, so Departmental Notice #1 was unreachable. The table came
from a fresh clone of PolicyEngine-US, and the check that made it shippable was this: **two
independent news reports of rate changes gave twelve rates, and all twelve matched.** Six
were counties that changed for 2025 (Floyd, Gibson, Jay, Monroe, Rush, Switzerland) and six
were the "from" values of counties changing for 2026 (Carroll, Grant, Greene, Howard, Shelby,
Union). Twelve of ninety-two is 13% of the table, sampled by an outside process rather than
by me, and both ends of it — the values that had just changed and the values about to.

That is a cheaper and better check than reading a PDF would have been, and it generalises:
**when a source cannot be reached, find the events that would have changed it.** A rate
change is reported by somebody; a rate that never changed is confirmed by the absence of a
report.

### The 2025 legislation is the largest change to a state return this package has seen

HB 352 (Chapter 604) did four things at once, all retroactive to 1 January 2025:

```text
two new top brackets  6.25% over $500,000 and 6.5% over $1,000,000 ($600k/$1.2M joint)
a capital gains       2% of net capital gain when FEDERAL AGI exceeds $350,000
  surtax
itemized deductions   reduced by 7.5% of federal AGI over $200,000
the standard          the 15%-of-AGI formula with a floor and a ceiling replaced by
  deduction           flat amounts, indexed from 2026
```

The third is **§ 68 — the federal "Pease" limitation — revived by a state seven years after
Congress suspended the federal one**, and it behaves exactly as the federal one did: 7.5
cents of deduction per dollar of income adds `7.5% x (state + county rate)` to the marginal
rate, `0.67` points in a 3.20% county, across a band `(itemized − standard)/0.075` dollars
wide — half a million dollars for a `$50,000` itemizer. The threshold is `$200,000` for a
joint return and `$200,000` for each of two single filers.

And it is gated: **Maryland allows itemizing only if the filer itemized federally**, so the
OBBBA's larger federal standard deduction took the Maryland itemized deduction away from
filers whose Maryland deductions never changed. That is this package's conformity thesis
arriving one level down — a federal change reaching a state through the *election* rather
than through the base.

### Two published credits that are one credit

Maryland is published everywhere as having a 50% non-refundable earned income credit and a
45% refundable one. They are one credit with a floor: the 50% is capped at the tax, and the
45% pays whatever the cap withheld.

```text
no tax            45% of the federal credit
tax >= 50% of it  50% of the federal credit
in between        the tax itself
```

So the effective match **rises** from 45% to 50% as the filer's tax rises, which is the
opposite of how anything else in this package behaves, and adding the two published
percentages to get 95% is wrong by roughly the whole state tax. The test measures the
effective match at six incomes and asserts it is monotonic, which is a better test of the
claim than any single number would be.

For an unmarried childless filer the match is **100%** and it is paid in full — the largest
state match of the federal childless credit in the country — and § 10-704(c)(3) computes it
on a federal credit the filer may never have received, because it disregards the federal
minimum age of 25. A 21-year-old with no federal credit has a Maryland one. That is the
fourth state in this package whose "percentage of the federal credit" is not that, after
Utah, New York and Indiana.

### Maryland is provisional for 2026, for exactly one figure

Every threshold in the rate schedule, the exemption chart, the surtax and the itemized limit
is a fixed dollar amount in statute — so Maryland's 2026 column is its 2025 column as a
matter of law, like Massachusetts's. The exception is the flat standard deduction, which
HB 352 directed be indexed by the chained CPI from 2026, and the sources reachable here
disagree: some report `$3,350` unchanged, some `$3,400` (with `$6,800` joint, since the joint
amount is exactly twice the single one). It is worth about `$4` of tax.

So the year is `provisional`, the note names both candidates and what the difference is
worth, and Maryland becomes the eighth provisional 2026 state. **Day 8's rule again: a value
held constant into the next year is not next year's value, it is the absence of one** — and
the honest response to two plausible published figures is to say there are two.

### The sixth compression pass, and how to choose what to cut

Maryland cost the MCP server about **1,146 bytes** of `tools/list` — three new fields, a
fourth for the federal itemizing flag, and a 26th state code — against **225 bytes** of
headroom. The pass that paid for it has a lesson the previous five did not:

**Choose by multiplicity, not by length.** The fattest single description in the payload is
383 bytes and appears once. `filingStatus` is 142 bytes and appears in three tools;
`unadjustedBasisOfQualifiedProperty` is 103 and appears in four. Cutting 130 bytes from the
short ones recovered 604; cutting 148 from the long one recovered 148. A sorted list of
description lengths points at exactly the wrong properties, and I sorted by length first and
had to redo the analysis.

The rest came from the fifth pass's rule — `filerAge`, `investmentIncome`,
`retirementIncome` and `massachusettsFivePercentIncome` were each spending 40–150 bytes
restating a figure the state's own notes carry on every call. The payload is now **47,977 bytes** — 202 more
than before Maryland, for one more state and 116 local income taxes, against the 1,146
Maryland cost outright. Indiana added almost nothing to it, because `county` was already
there: the whole cost of the second county state was widening two sentences from "MD only"
to "MD and IN". The ceiling is still 48,000 and the headroom is 23, which is the number that
decides what the next state can add.

One design decision worth recording: the MCP tool **refuses** `stateItemizedDeductions`
without `federalItemized: true` rather than ignoring it. A model that supplies Maryland
itemized deductions for a filer who took the federal standard deduction has either got the
federal return wrong or is about to get a Maryland answer that is too low, and silently
dropping the figure would hide both.

### Competitive re-check, and the sharpest datum yet

`statetakehome-mcp` is unchanged at 0.1.1 since July. Its Maryland entry, read out of the
published tarball today, now has the **correct** 2025 brackets including the two new HB 352
ones and the correct flat standard deduction. And its note says, in French:

```text
"2 nouveaux paliers 2026 (6.25%/6.50%). County tax 2.25-3.20% en sus."
```

Three things at once, and the first is the one that matters:

1. **It knows the county tax exists, states its range in a comment, and does not compute
   it.** For a single filer at `$100,000` in Montgomery County its answer is `$4,538.38`
   against `$7,376.78` — **short by `$2,838.40`, 38.5% of the bill** — in a package whose
   entire purpose is *take-home pay*, where the county tax comes out of the paycheck.
2. **The range in the comment is stale.** `2.25-3.20%` was right until Dorchester went to
   3.30% for 2025 and Kent for 2026, under a raised statutory ceiling.
3. **No personal exemption for any of the 51 jurisdictions**, and still two filing statuses
   for 29 of them — Day 9's finding holding for a sixteenth state.

`verify_2026: true` is still there, on Maryland as on Massachusetts. Day 13's corollary —
*read what the competition wrote in its data* — keeps paying.

No kill criterion is met.

### One note on the human

**No notification today.** Day 11's rule, followed rather than forgotten: send one only when
something genuinely new is at stake. Nothing broke, CI is green on both commits, no
competitor qualifies for the kill criterion, and the publish ask is word for word the one
that has been open since Day 6 — only the version numbers and test counts moved. Today was a
large day of building, which is not the same thing as a day with something to say.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main`. Needed again.
- **Every illustrative figure in the new docs was computed before it was written**, after the
  capital gains cliff caught me out. Two changed: the surtax cliff (`$20,000` → `$6,933.08`)
  and the Montgomery County comparison (`$2,825` → `$2,990.40`).
- Adding a state broke six tests, all counts and lists, and one of them usefully: the
  "unsupported state" message now names Maryland as a state this package **covers**, so the
  registry test's blunt `doesNotMatch(/Maryland/)` had to become an assertion about the list
  of *gaps* rather than about the whole sentence. A test that asserts the absence of a word
  breaks when the word acquires a second meaning.
- `mgaleg.maryland.gov`, `marylandcomptroller.gov`, `dls.maryland.gov`, `taxfoundation.org`
  and `help.nfc.usda.gov` are all blocked at the proxy. Every figure here came from
  `WebSearch` snippets cross-checked against a fresh clone of PolicyEngine-US's parameter
  files, which are reachable through the git proxy and were the primary source for the county
  rate table.
- Where PolicyEngine and I differ, it is recorded: the rate a *graduated* county uses for its
  local earned income credit is not recoverable from any reachable source, so this package
  follows their reading and says so in the locality's notes — bounded, in the same note, at
  five percentage points of the federal credit, because a Frederick filer with enough taxable
  income to leave the second band has no federal credit left.
- All three suites run before every push, per Day 13, and both commits went green on CI.
  Each commit carries both packages, because the MCP vendors the engine and a state or
  locality addition changes its `tools/list`.
- The shipped Indiana table was diffed back against the source it came from after the fact —
  92 rates for each of two years, zero mismatches, no county missing and none invented. A
  generated table deserves a generated check, and it took one command.

### What I would do next

1. **Virginia.** The next state on the list, no local income tax, a federal-AGI base — a
   cheap day that widens coverage after two days of depth.
2. **Michigan's 24 cities**, on the machinery that now serves two states. Detroit alone is
   2.4% resident / 1.2% non-resident, and Michigan is already in the package, so this is
   another Indiana: a data file and a note. It also needs the *first* non-resident local
   tax outside Yonkers, which is a real shape (a rate on wages earned in the city).
3. **Maryland's poverty level credit**, state and local — 5% of earned income below the
   federal poverty guideline. It needs a poverty-guideline table by household size, the
   first federal *benefits* parameter this package would carry, and that is a decision to
   make deliberately rather than in passing.
4. **Ohio**, still the largest state missing, and cheaper than it was: its 600+
   municipalities are the same shape, and the honest first version is the state return plus
   a loud note.
5. **State withholding** — California DE-44 Method B and New York NYS-50-T, the other half
   of `paycheck_withholding`, federal-only since Day 7. Indiana's own withholding is now a
   candidate too, and it has a hook the others do not: the county rate withheld can differ
   from the county rate owed.
6. **Maryland's pension exclusion**, the largest thing this package returns as zero for a
   Maryland retiree — up to `$41,200`, reduced by Social Security received.
7. **§ 68**, still blocked on irs.gov. Not deprioritised, and Maryland's 7.5% limitation is
   now a working model of the same arithmetic.

Do (2). Michigan is the third state on machinery that has now paid for itself twice, and it
brings a genuinely new shape — a city that taxes non-residents on what they earn inside it —
which is the pattern Ohio, Kentucky and Pennsylvania all need. Do (1) if a quiet day is
wanted instead.


---

## Day 13 — 2026-09-07

### What I did
Yesterday's first priority: **Massachusetts**.

`packages/us-state-tax` is **v0.7.0** — 25 states, **177 tests**, up from 160 — and
`packages/us-tax-mcp` is **v0.9.0** with **118**, up from 115. The federal engine is
untouched at v0.7.0 and its 283 tests still pass. **578 tests**, all green, zero
dependencies anywhere.

### The first state whose base is split by the kind of income

Every other state in this package splits its tax by **how much** income there is.
Massachusetts splits it by **what kind**, and that is a shape no table of state income tax
rates can hold, because such a table has one row per state and the Massachusetts row says
5%. M.G.L. c. 62 § 4(a) sets three rates:

```text
5.0%   Part B income, plus the Part A interest and dividends and Part C long-term
       gains taxed alongside it since 2020
8.5%   short-term capital gains — assets held one year or less
12%    long-term gains on collectibles, on half the gain (effective 6%)
+4%    on total taxable income over $1,083,150 (2025) / $1,107,750 (2026)
```

The headline that falls out: **the same `$100,000` costs `$700` more when `$20,000` of it
was held eleven months rather than earned.** A day trader's Massachusetts rate is 70% above
the one every summary reports.

The engine change is a `separatelyRatedIncome` rule — a list of classes, each with its own
input field, rate and optional deduction share. Three details make it right rather than
merely present:

- **Unused exemptions cascade into the classes.** A filer whose only income is a short-term
  gain still has a `$4,400` personal exemption, and an engine that applied exemptions only
  to the main schedule would tax their first `$4,400` at 8.5%. `$374` on a `$20,000` gain.
- **The 12% and the 50% are stored apart, not as a single effective 6%.** The surtax
  applies to *taxable* income, which is the figure after the deduction — folding the
  deduction into the rate would apply the surtax to twice the correct base.
- **The zero-tax threshold and the effective rate both see every class.** `$5,000` of wages
  beside a `$60,000` short-term gain is not No Tax Status, though the 5% schedule alone
  would say it was.

### The rule paid a seventh time, and this time on an eligibility table

Day 10: *a published tax table is a rendering; ask what the renderer was.* Massachusetts
publishes No Tax Status as `$8,000` single, `$16,400` joint, `$14,400` head of household,
plus `$1,000` per dependent. Two of the three rows and the per-dependent amount are
generated:

```text
7,600 + 8,800 (joint personal exemption)             = 16,400   published
7,600 + 6,800 (head of household exemption)          = 14,400   published
1,000 per dependent = the dependent exemption itself =  1,000   published
```

So the package stores `$7,600` and reuses the exemption schedule sitting beside it. The
single row is the exception and is stored whole — `$8,000` is not `$7,600 + $4,400`, and a
single filer adds nothing for dependents either — which is worth writing down because **the
exception is what a derivation gets wrong when it is applied too enthusiastically.**

That is the first time the rule has applied to an *eligibility* table rather than to a rate
schedule or a credit. Generalising a little further: the renderer is usually a rule already
written down somewhere else on the same form. New Jersey's subtraction constants are its
own rate schedule; New York City's rates are its own statute times 1.14; Massachusetts's No
Tax Status table is its own exemption schedule plus a constant.

### Buying the absence of a cliff, at twice the price

New Jersey's filing threshold is a wall: `$252` of tax arrives on one dollar of income.
Massachusetts had the same problem and solved it, and the solution is more interesting than
the problem. Immediately above No Tax Status the **Limited Income Credit** limits the tax to
**10% of the income above the threshold** — which is not a softening of the 5% rate, it is
**double** it.

```text
$8,000  ->  $0
$8,001  ->  $0.10        not $180
$10,000 ->  $200         marginal rate 10%
$11,600 ->  $360         marginal rate 5%
```

So Massachusetts avoids a cliff by charging the most expensive marginal rate in the return
across the band immediately above it — and that band is where the filers the threshold
exists for actually are. **A smooth phase-in is not a cheap phase-in; it is the same money
collected over a wider interval.**

And the eligibility ceiling the instructions print — 175% of the threshold, `$14,000` for a
single filer — is **never the operative limit, for anybody.** The credit is the excess of
the tax over that 10%, so it ends where the two lines cross:

```text
0.05 x (A - exemptions) = 0.10 x (A - threshold)   =>   A = 2T - E
```

`A = 2T − E` beats the `1.75T` ceiling exactly when `E < 0.25T`, and Massachusetts's
exemptions are never that small — `$4,400` against a quarter of `$8,000`, `$8,800` against a
quarter of `$16,400`. The test walks three filing statuses and zero to five dependents and
asserts the crossover comes first in all eighteen. **A published eligibility ceiling is a
claim about who may apply, not about who benefits, and the two are different numbers.**

### A cliff the legislature closed, and what closing it cost

The 4% surtax threshold is per **return** and is not doubled for a joint return, exactly
like California's Mental Health Services Tax. The difference is that Massachusetts noticed:
since tax year 2024, M.G.L. c. 62 § 4(d) requires a couple who filed a joint federal return
to file jointly here, which closes the split-return route two spouses used in 2023.

```text
two spouses at $700,000 each, filing separately   ->  no surtax at all
the same couple, filing jointly                    ->  $12,322
```

That `$12,322` is the price of the anti-avoidance rule, and it is computable only by a model
that knows both that the threshold is per return and that the return cannot be split. And
because the surtax base is **total** taxable income across all three rate classes, a
`$200,000` salary beside a `$1,000,000` short-term gain owes exactly the `$4,498` of surtax
that a `$1,200,000` salary does.

### Three sourcing findings

**The statute says 5.95%.** M.G.L. c. 62 § 4(b) still reads `5.95 per cent`, with a
mechanism stepping the rate down 0.05 points in any year the commonwealth's baseline revenue
growth clears a test. The steps ran out in tax year 2020 at exactly 5.00%. A model built
from the statutory text alone is 19% too high, and a model built from the rate table misses
why the number is what it is. **Day 5's rule — prefer the representation the tables are
derived from — has a limit: prefer it only where the derivation is still live.** A statutory
rate with a spent reduction mechanism is a historical artefact, not a source.

**Where a derivation and a transcription disagree, this time the reference implementation is
the one that is wrong.** PolicyEngine-US models the 50% collectibles deduction correctly and
then applies the Part A **short-term** rate of 8.5% to what is left, for an effective 4.25%.
The statute has one rate for short-term gains and another for collectibles — *"other Part A
taxable income consisting of capital gains shall be taxed at the rate of 12 per cent"* — and
the DOR's own rate table says 12% on half the gain, an effective 6%. Three sources to one.
I kept 12% and the test names both numbers rather than silently preferring either; the gap is
`$350` on a `$20,000` gain.

**The surtax threshold is indexed and the indexation is not reproducible.** Article XLIV
adjusts it "by the same method used for federal income tax brackets". The certified figures
are `$1,000,000` (2023), `$1,053,750`, `$1,083,150`, `$1,107,750`. Applying the federal
2025→2026 factor to the 2025 threshold gives `$1,107,795`, which is `$1,107,800` to the
nearest `$50` and `$1,107,750` rounded down — but rounding down does not reproduce 2025 from
2024. So the derivation is asserted as a **bound** (within one `$50` step) rather than as an
identity, and the doc comment says why. **When a derivation nearly works, saying "nearly" is
the honest test; a test that rounds until it passes is a test of the rounding.**

### Massachusetts is `published` for 2026, and almost nothing moved

Every figure in the Massachusetts computation but the surtax threshold is a fixed dollar
amount in statute — the 5% rate, the exemptions, the No Tax Status constants, the deduction
caps, both credits. So the 2026 column is the 2025 one as a matter of law rather than as a
carry-forward, and the one indexed figure has already been certified. **The entire
year-over-year change in Massachusetts income tax is `$984`** — 4% of the `$24,600` the
threshold moved — **and nobody below a million dollars owes any of it.**

That makes Massachusetts the cheapest state-year in this package to keep correct, which is
worth knowing when choosing the next state: a state whose parameters are legislated rather
than indexed costs one day and then nothing.

### Competitive re-check, and the sharpest datum since Day 9

`statetakehome-mcp` claims all 50 states plus DC and lists `capital-gains-tax` among its
keywords. Its Massachusetts entry, read out of the published tarball today:

```json
"MA": { "tax_type": "progressive", "source_year": 2026, "verify_2026": true,
        "notes": "Flat 5% + surtaxe 4% > $1,083,150 (millionaire tax). ...",
        "brackets": { "single": [ {"rate": 0.05, "max": 1083150},
                                  {"rate": 0.09, "max": null} ] },
        "standard_deduction": { "single": 4400, "married_filing_jointly": 8800 } }
```

Four things at once:

1. **No short-term capital gains rate at all**, in a package whose keywords sell capital
   gains. Every Massachusetts gain comes out at 5%; the answer is 8.5%.
2. **`source_year: 2026` beside the 2025 threshold.** `$1,083,150` is the 2025 figure;
   2026 is `$1,107,750`. Exactly Day 8's trap — a value held constant into the next year is
   not next year's value, it is the absence of one — and they flagged it themselves with
   `verify_2026: true` and shipped anyway.
3. **No No Tax Status and no Limited Income Credit**, so a single filer at `$8,000` is
   charged `$180` where the answer is `$0`, and the whole 10% band above it is reported at
   5%.
4. **Two filing statuses.** No head of household, which is Day 9's finding holding for a
   fifteenth state.

So the Day 9 corollary — *read what the competition wrote in its comments* — gains a
sibling: **read what the competition wrote in its data.** `verify_2026: true` is a field
that says, in the shipped artefact, "this number has not been checked". It is a to-do list
for a package that wakes up every day.

No kill criterion is met. `irs-taxpayer-mcp` and `@invaro/opentax` are unchanged since Day
12; neither has an `exports` map, so neither is importable.

### The fifth compression pass, and the rule that generalised out of it

Massachusetts needed four new fields on `state_income_tax` — about **900 bytes against 237
of headroom**. What paid for them was Day 11's rule applied to the *properties* rather than
to the tool description: `investmentIncome` was spending 90 bytes on "$4,528.82 at the worst
point" and `retirementIncome` 80 on "the largest cliff in this package", and both figures
are already in the notes every result carries.

**A property description is paid for on every session; a note is paid for once, by the
caller who asked.** Seven properties rewritten that way, plus the `year` and `filingStatus`
descriptions that three tools each carry, came to roughly 950 bytes — so the headroom after
adding a whole state is within a dozen bytes of what it was before.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main`. Needed again.
- Adding a state broke nine tests, all of them counts, lists and the "unsupported state"
  fixtures that used `MA` as the example of a state this package does not have. Those
  fixtures now use `OH`, and `registry.test.js` additionally asserts that the
  unsupported-state message **stops naming** a state that has been added — the failure mode
  is a package that supports Massachusetts and tells the caller it does not.
- The test helpers that pass every `stateDefined` field unconditionally now pass three.
  Day 12 generalised this from one to two; it was right to.
- `StateDefinedBaseField` is now a named exported type rather than an inline union in two
  places, because a third member made the duplication a liability.
- `effectiveRate` divided by the conformity amount, which for Massachusetts is the 5% income
  alone — so a filer with a `$1,000,000` gain and a `$200,000` salary got 50% instead of
  41%. Fixed with an `incomeBase` that spans every class. **A denominator is a claim too.**
- **The Massachusetts commit left `main` red for four minutes, and it should not
  have.** `us-tax-mcp` vendors both engines' sources at build time, so adding a
  state to `us-state-tax` changes the MCP package's `tools/list` payload, its
  state count and its "unsupported state" fixture — and the MCP job failed on
  exactly the three tests I then fixed in the *next* commit. Both packages passed
  locally at each point because I ran each package's suite after editing it,
  never the MCP suite after editing only the engine. **A vendored dependency
  makes two packages one commit.** Either land the engine and the server
  together, or run every package's suite before every push, not the one you
  touched. The tip is green; run 30 is a red mark in the history that a
  `for p in packages/*; do npm test; done` before the first push would have
  avoided, and that is now the last step before any push here.
- mass.gov and law.justia.com are both blocked at the proxy. Every figure here came from
  `WebSearch` snippets cross-checked against PolicyEngine-US's parameter files, except the
  collectibles rate, where the two disagree and the snippets won three to one.

### One note on the human

**No notification today**, and that is Day 11's rule being followed rather than
forgotten: send one only when something genuinely new is at stake. Nothing broke,
no competitor appeared that qualifies, and the publish ask is word for word the
one that has been open since Day 6. A notification that arrives every day is
noise within a week, and the thing worth waking someone for has not changed.

### What I would do next

1. **Ohio**, and it is now the largest state missing. It also needs the `county`-shaped
   design Day 12 settled, one level worse: 600+ municipalities with their own returns. The
   honest first version is the state return plus a loud note, which is what New York got on
   Day 9 before New York City landed on Day 10.
2. **Virginia or Maryland.** Maryland is the better day of the two because its county
   income tax is a share of the state tax — the same shape as the Yonkers surcharge, which
   is already built — and because the `county` field decided on Day 12 has still never been
   implemented. Twenty-three counties, one rate each.
3. **Indiana counties**, on that same field. A data-entry day, and the cheapest way to make
   the field real before Maryland or Ohio needs it.
4. **State withholding** — California DE-44 Method B and New York NYS-50-T. This is the
   other half of `paycheck_withholding`, which has been federal-only since Day 7, and it is
   the feature a payroll product actually needs.
5. **Massachusetts's senior circuit breaker credit** and the Schedule B/D loss netting, the
   two things left out today. The circuit breaker is refundable and worth up to about
   `$2,730`, which makes it the largest thing this package still returns as zero for a
   Massachusetts retiree.
6. **§ 68**, still blocked on irs.gov. Not deprioritised.

Do (2). Maryland is the state where the most already-built machinery gets reused — the local
tax shape, the `county` design, a federal-AGI conformity base — which makes it the day that
buys the most future days, and Day 13 is the second consecutive day where "the shape
generalises" was worth more than "one more state".

---

## Day 12 — 2026-09-06

### What I did
Yesterday's second priority, and the sizing decision behind the first: **New Jersey**.

`packages/us-state-tax` is **v0.6.0** — 24 states, **160 tests**, up from 137 — and
`packages/us-tax-mcp` is **v0.8.0** with **115**, up from 113. The federal engine is
untouched at v0.7.0 and its 283 tests still pass. **558 tests**, all green, zero
dependencies anywhere.

### The Indiana sizing question, answered without building it

Day 11 said to decide this before typing, so: **`LocalityCode` must not become a 94-member
union, and Indiana's counties do not belong in it.** Two reasons, and the second is the one
that settles it.

1. The MCP `locality` enum would cost roughly 1,100 of the 1,715 bytes of `tools/list`
   headroom, and the enum is repeated in a description that has to name what each value
   means. A locality enum is affordable while localities are *named things a filer knows
   they live in*; 92 counties are a lookup table.
2. `LocalityCode` is a **published type**. Every county added to it is a breaking change to
   anything that switches on it exhaustively, and county rates change annually — Indiana
   revises them every October. A type whose members change every year is the wrong type.

So the shape is a `county` field taking a name, keyed to the state, validated against that
state's list, with the rates in data rather than in the type. That also generalises to
Maryland's 23 counties and Michigan's 24 cities, which are the same problem. Recorded here
rather than built, because it is a design decision and the cost of getting it wrong is a
breaking change to a published type.

Which left New Jersey, and New Jersey turned out to be the better day anyway.

### New Jersey is the second state with no federal starting line, and much the larger one

Pennsylvania is the famous one. New Jersey is bigger, and its gross income tax differs from
the federal base in **both directions at once**:

- **In federal AGI, not taxed by New Jersey**: Social Security benefits, unemployment
  compensation, New Jersey municipal bond interest, state temporary disability benefits.
- **Taxed by New Jersey, not in federal AGI**: elective deferrals to a **403(b)** plan and
  contributions to a traditional IRA. A **401(k)** deferral is excluded and a 403(b) one is
  not — same paycheck, same box, opposite answers, and it is the most common New Jersey
  error there is.
- **Netted differently**: a loss in one category cannot offset another, and there is no
  capital loss carryforward.

So federal AGI is not an approximation of the New Jersey base. It is a different number, and
the engine asks rather than guesses — `newJerseyGrossIncome`, NJ-1040 line 27.

Generalising `stateDefined` to carry the field it needs, rather than hardcoding
`pennsylvaniaTaxableIncome` in the engine, was three lines and removes the last per-state
branch from `conformityAmount`.

### The rule paid a sixth time, and this time on the rate schedule itself

Day 10: *a published tax table is a rendering; ask what the renderer was.* New Jersey prints
its tax as **"multiply line 41 by .05525 and subtract $1,492.50"** — thirteen subtraction
constants across two schedules. Every one of them is

```text
constant = rate x threshold - the tax already collected below that threshold
```

which is just the marginal schedule written as a straight line per band. Thirteen for
thirteen, and the two I could reach independently through search — `$1,492.50` on Schedule I
and `$4,042.50` on Schedule II — both land exactly. So the package stores eight rates and
seven thresholds and generates the column.

That is the first time the rule has applied to a **rate schedule** rather than to a credit
or a locality table, and it is the cheapest instance yet: the derivation is four lines and
it removes thirteen numbers that could be re-keyed wrong.

### Three cliffs, and why they are the product

New Jersey has no phase-outs to speak of. What it has instead is walls, and each of them is
invisible to anything that reads a rate table.

**1. Below the filing threshold there is no tax at all.** Not a zero bracket — a statement
about the whole return. `$10,000` of New Jersey gross income single, `$20,000` joint, and one
dollar more brings the entire first bracket at once:

```text
single    $10,000 -> $0        $10,001 -> $126.01
joint     $20,000 -> $0        $20,001 -> $252.01
```

The subtle part: **the threshold is measured on gross income and the tax it triggers is
measured on taxable income**, so the size of the cliff is a property of the filer standing on
it. The joint couple falls twice as far because they have twice the exemptions. Nothing in
the statute says "$252"; it falls out of the two measures being different.

And it does **not** take the refundable credits with it. New Jersey tells filers under the
threshold to file anyway and claim the earned income credit, so the threshold zeroes the tax
and leaves the credits standing — which is why it is applied where the rate schedule is
rather than by returning early.

**2. The retirement income exclusion ends in a wall.** 100% of the pension below `$100,000`
of total income, 50% to `$125,000`, 25% to `$150,000`, and **nothing** at `$150,001`. For a
joint return with a `$100,000` pension:

```text
$150,000 of total income -> $3,965.50
$150,001                 -> $5,346.81      one dollar: $1,381.31
```

That is the largest cliff this package reports as a marginal rate. It only shows up because
`marginalRate` reruns the whole return a dollar higher — the filer is standing in the 5.525%
band, and 5.525% is what any rate schedule would tell them.

**3. The child tax credit is a staircase with five steps.** `$1,000` per child under 6 at
`$30,000` of New Jersey taxable income and `$800` at `$30,001`. Three young children means
`$600` on one dollar, and again at `$40,000`, `$50,000`, `$60,000` and `$80,000`. **The
opposite of a phase-out**: a bigger family loses more at each step rather than taking longer
to lose it. P.L. 2026, c.26 raised every amount by exactly 25% for 2026 through 2028, so the
first cliff is `$750` next year, and reverts in 2029.

### The percentages nobody prints as a rule

The retirement exclusion publishes ten percentages across five statuses and three tiers.
**Six are generated.** In each partial tier the percentage is the joint percentage scaled by
that status's share of the joint maximum:

```text
0.5  x (75,000/100,000) = 0.375     published 37.5%   (single, HoH, surviving spouse)
0.25 x (75,000/100,000) = 0.1875    published 18.75%
0.5  x (50,000/100,000) = 0.25      published 25%     (married filing separately)
0.25 x (50,000/100,000) = 0.125     published 12.5%
```

Four for four. In the *full* tier every status excludes 100% and the maximum enforces the
same ratio, which is why the scaling applies only below one — and that exception is the part
worth writing down, because a derivation that quietly gives a single filer 75% instead of
100% below `$100,000` would be a confident wrong answer in the most common case.

### A filing status mapped three different ways on one return

A New Jersey **qualifying surviving spouse** gets:

- the **joint** rate schedule (Schedule II),
- the **single** retirement exclusion maximum of `$75,000`,
- and **one** `$1,000` personal exemption, not two.

This package's `byStatus` helper defaults a surviving spouse to the joint amount, which is
right almost everywhere and wrong twice here. Both overrides are explicit and both have a
test. **A filing status is not a single fact about a return** — that is the generalisable
part, and New Jersey is the first state in this package to prove it.

New Jersey also gives a **head of household the joint schedule**, which almost no other
state does: in New York, California and every other bracketed state here a head of household
sits on a third schedule of its own. A rate table transcribed from another state's shape
overstates a New Jersey head of household across the whole 2.45% band.

### Computing the return twice, because the form says to

The property tax deduction (up to `$15,000`, or 18% of rent) and the `$50` refundable
property tax credit are alternatives, and the NJ-1040 instructs the filer to **compute the
tax both ways and use the lower**. That is not a shortcut for "deduct when the deduction is
bigger": the deduction is worth the filer's marginal rate times the property tax, and that
rate is itself a function of the deduction.

So `compute()` runs `computeOnce()` on both routes and keeps the cheaper. For a single filer
at `$25,000` the crossover is at **`$2,858`** of property tax — `$2,857` is worth `$49.99` at
1.75% and loses to the credit by a cent. A model that always deducts is wrong for exactly the
low-income filers the credit exists for.

### Where I disagreed with the reference implementation, and where I could not

**Part I of Worksheet D** — I had it wrong first. The tier percentage applies to the
**pension**, capped at the maximum, not to the maximum. Two limits, not one, and which binds
depends on the filer. PolicyEngine-US has this right and my first pass did not; caught by
computing the `$150,000` cliff and getting a number four times too large, which is the sort
of error a headline figure catches and a unit test does not.

**Part II** — the other retirement income exclusion, for a filer with `$3,000` or less of
earned income, who may apply the unused part of the exclusion to *other* income. The
worksheet's wording is genuinely ambiguous about whether the percentage applies to total
income or to the maximum, and the two readings differ only for a filer with total income
above the cap. I followed PolicyEngine's reading and said so in the code rather than
inventing a third. It is another cliff either way: `$3,001` of wages costs a 70-year-old
couple with `$60,000` of investment income **`$976.50`**.

### The fourth compression pass, and the rule it confirms

Eight new fields on `state_income_tax` cost 2,060 bytes against 1,715 of headroom. The pass
that paid for them applied Day 11's rule to the two fattest strings in the payload:

- `state_income_tax`'s own description, 1,333 bytes, most of it figures every result already
  carries in `notes` — `$2,399` of New York recapture, Utah's 4.45%-against-5.75%,
  California's minus 34%. Rewritten as *what to pass, per state*: 900 bytes.
- `dependentAges`, 695 bytes enumerating the Empire State child credit's `$16.50` per
  `$1,000` and CalEITC's `$303`/`$3,340`. Same treatment: 300 bytes.

Headroom is back to **242 bytes**, with three states' worth of instruction in the tool
description instead of two. **The rule generalises: a tool description earns its bytes by
changing what the model does, not by teaching it what the answer means.** The second thing
arrives free on every call.

### Competitive re-check

- **A registry search for `njeitc` returns zero packages** — the same answer `caleitc` gave
  on Day 11. A search for "new jersey income tax" returns two fonts, a Dutch calculator and
  six sales-tax packages.
- Nothing else has changed since Day 11. No kill criterion is met.

### Sourcing

Same channel as always: a sparse `--filter=blob:none` clone of PolicyEngine-US for
`gov/states/nj`, plus `WebSearch` for every figure. nj.gov, njleg.state.nj.us and
law.justia.com are all blocked at the proxy, so the two independent confirmations of the 2026
child credit (the 25% increase, the 2029 reversion) came from a legislative-tracking summary
and an accounting firm's budget write-up, and the two subtraction constants came out of
search snippets of the rate-schedule PDF itself.

`codeforamerica/vita-min` was worth a second look because Day 11 recorded that its state
support includes New Jersey — it does, but only for the parts a VITA volunteer needs, and it
has no retirement exclusion at all. So the cross-check on the exclusion is the derivation of
the six percentages plus the published dollar maxima, not a second codebase.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main`. Needed again —
  local `main` was two commits stale with `HEAD` detached at the right commit.
- Adding a state breaks every test that enumerates `SUPPORTED_STATES`, which is the point of
  those tests. Nine failures, all of them counts and lists, all of them correct to update.
- The test helpers that special-cased `state === 'PA'` for the Pennsylvania base now pass
  **both** state-defined fields unconditionally. A state that does not read a field ignores
  it, so the conditional was never buying anything.
- `us-tax-mcp/src/protocol.ts` carries the server version as a literal and there is a test
  that it matches `package.json`. Worth knowing before the next bump.
- **`us-state-tax` was never in the CI matrix.** It has been in the repo since Day 8 and CI
  has never run a single one of its tests — the matrix lists `us-federal-tax` and
  `us-tax-mcp` and was not updated when the package was added. Fixed. The MCP job was
  covering it by accident, because that build vendors both engines' sources, but it runs the
  MCP package's 115 tests and not the state package's 160. **A green badge on a repository
  that has grown a package is worth checking rather than trusting**: the failure mode is
  silent, and the only symptom is a job list one entry shorter than the package list.

### What I would do next

1. **Massachusetts.** 5% flat plus the 4% millionaires surtax, its own `$8,000`/`$16,400`
   exemptions, and the part that makes it interesting: **short-term capital gains at 8.5%**
   and long-term at 5%, so Massachusetts is the first state here whose base is split by the
   *kind* of income rather than by its size. The federal engine already computes the split.
2. **Ohio**, which needs its municipal taxes to be worth anything — 600+ of them, and the
   same `county`-shaped design decision recorded above, one level worse.
3. **Indiana counties**, on the `county` field decided above. Now a data-entry day rather
   than a design one, which is what yesterday wanted to know.
4. **New Jersey's medical expense deduction and child and dependent care credit.** The CDCC
   needs the federal credit as an input, which `FederalBasis` does not carry; it is one field
   and it would also unlock Colorado's, Kentucky's and New York's.
5. **State withholding** — California DE-44 Method B and New York NYS-50-T.
6. **§ 68**, still blocked on irs.gov. Not deprioritised.

Do (1). Massachusetts is the largest state left whose structure is genuinely different from
anything modelled here, and "the base is split by kind of income" is a shape the definition
file cannot currently express — which is exactly the sort of day that pays, because it makes
the next five states cheaper rather than only adding one.

---

## Day 11 — 2026-09-05

### What I did
Yesterday's first priority: **CalEITC and the Young Child Tax Credit**.

`packages/us-state-tax` is **v0.5.0** — 137 tests, up from 116 — and
`packages/us-tax-mcp` is **v0.7.0** with 113, up from 108. The federal engine is
untouched at v0.7.0 and its 283 tests still pass. **533 tests**, all green, zero
dependencies anywhere.

### The rule paid a fifth time, and this time it produced the shape rather than the numbers

Day 10: *a published tax table is a rendering; ask what the renderer was.* The Franchise
Tax Board publishes CalEITC as a lookup table running to `$30,000` in `$50` bands. It is
generated by five facts, four of them statutory:

1. **The phase-in rates are the federal § 32 credit percentages** — 7.65% / 34% / 40% /
   45%. R&TC § 17052(a) adopts § 32 by reference and then overrides the amounts, so
   California never restates the rates and every write-up treats them as California's own.
2. **The ceiling is half the federal 2015 ceiling.** The statutory table of `$3,290` /
   `$4,940` / `$6,935` is exactly half of the federal 2015 earned income amounts of
   `$6,580` / `$9,880` / `$13,870`, indexed by the California CPI ever since. One factor
   reproduces all three of any year's amounts, which is the same test the brackets and the
   standard deduction already get. California froze the federal *structure* at 2015 and the
   federal credit kept indexing, so the two have drifted a long way apart: the federal
   childless phase-in ends at `$8,490` in 2025 and California's at `$4,661`.
3. **The whole credit is multiplied by 85%** — the adjustment factor § 17052(a)(2)(B)
   leaves to the annual Budget Act, unchanged since 2015. That is the difference between
   the schedule and the form, and it means a one-child filer's first `$6,998` is subsidised
   at **28.9%**, not the 34% the schedule appears to say.
4. **The phase-out threshold *is* the phase-in ceiling**, and the phase-out rate is the
   phase-in rate. There is no plateau at all.
5. **And then it stops falling and crawls.** Once the credit reaches `$251` (no children) or
   `$635`, the remainder runs in a straight line to zero at the `$32,901` cap. That kink
   level is the one CalEITC figure no California release states in words.

### Testing the mechanism against a year the package does not ship

This package ships 2025 and 2026. The only externally published CalEITC values reachable
from this sandbox are **twelve entries of the 2021 Form 3514 lookup table**, recorded in
PolicyEngine-US's test fixtures as hand-checked against the form.

So the first test in `california-earned-income.test.js` builds the 2021 rule inline — 2021
ceilings, the `$200`/`$505` kink indexed by the CPI ratio 297.447/280.956 — and asserts the
derivation against all twelve. Worst deviation: **64 cents**, on a table published to the
dollar in income bands.

**Generalising: when a package ships year N and the only published figures you can reach are
for year N−4, test the mechanism against year N−4.** A transcription test checks this year's
numbers. That test checks the *shape*, and the shape is what every future year inherits.
It is also what pins the one figure that is not published: three of the twelve values sit on
the second phase-out, and moving the kink by a dollar moves them out of range.

### No plateau, and a 68-point swing on one dollar

The federal earned income credit holds its maximum across roughly `$10,000` of income.
CalEITC's peak is one dollar wide.

```text
Head of household, two children, 2025          California marginal rate
  $8,000 of wages                                    -34.00%
  $9,823 of wages          <- the peak
  $10,000 of wages                                   +34.00%
  $25,000 of wages                                    +4.20%
```

California pays 34 cents on the dollar below `$9,823` and takes 34 cents above it. Stacked
on the federal credit's own 40% phase-in, the two credits together add **74 cents to every
dollar** a California single parent of two earns up to that point, before payroll tax.

The end of it is the opposite: the tail is `$15,000` long and worth 4.2 cents on the dollar
for a two-child filer, 0.9 cents for a childless one. Three distinct marginal rates in one
credit, and the middle one is a sign change.

This only shows up because `marginalRate` is measured by rerunning the whole return a dollar
higher. That meant teaching `oneDollarMore` that a dollar of wages is a dollar of *earned
income* as well — holding earned income constant would have reported zero across the whole
of CalEITC.

### The Young Child Tax Credit's phase-out rate is not a parameter

`$21.71` per `$100` in 2025. It is `amount ÷ ((cap − threshold) ÷ $100)`, truncated to the
cent — the rate that runs the credit to exactly zero at the CalEITC income cap:

```text
2021   $1,000 / (($30,000 - $25,000) / 100) = $20.00     published $20.00
2022   $1,083 / (($30,000 - $25,000) / 100) = $21.66     published $21.66
2024   $1,154 / (($31,950 - $26,626) / 100) = $21.67     published $21.67
2025   $1,189 / (($32,901 - $27,425) / 100) = $21.71     published $21.71
```

Four for four. (2023 is the exception: the identity gives `$21.58` and the reference dataset
carries `$21.66` forward from 2022. The statute's explicit graduated computation begins in
2024, so both readings are defensible and the code says so.)

And § 17052.1(a)(2)(C)(i) reduces it per `$100` **"or fraction thereof"**, so it is a
staircase like New York's: 99 dollars in 100 cost nothing and the hundredth costs `$21.71`.
**PolicyEngine-US divides without rounding up**, which reads the credit off the straight line
instead of the staircase and overstates it by up to `$21.70` for every filer standing between
two steps — against the statutory text quoted in their own parameter file. Recorded in a
test rather than silently preferred, per Day 9's rule.

### Two more things nobody says about these credits

- **The Young Child Tax Credit is one credit per return, not one per child.** One child
  under 6 and three under 6 are both worth `$1,189`. Every other child credit in this
  package scales with the family, so there is a test asserting that this one does not.
- **It is gated on CalEITC**, which makes the `$4,814` investment-income limit a cliff worth
  `$4,528.82` — the CalEITC peak plus the whole young child credit — for a single parent of
  two young children with `$9,823` of earnings. One dollar of interest.

### Refusing to guess, again

A count cannot say whether a dependent is a qualifying child, and the childless CalEITC
schedule is worth `$303` where the two-child one is worth `$3,340`. So supplying `dependents`
without `dependentAges` computes CalEITC as **zero** with a note saying what it cost, rather
than quietly running the childless schedule — which would have been a confident wrong answer
instead of a loud missing one. Same shape as Day 10's decision for the Empire State child
credit, and the same reasoning.

The qualifying-child count itself is the honest limit: dependents aged 18 or under are
counted, and a full-time student under 24 or a permanently disabled dependent of any age also
qualifies and cannot be seen from an age list. Every California result says so.

### The third compression pass, and why the first two needed hand-edits

Two new fields on a `tools/list` payload with 429 bytes of headroom. The pass that paid for
them is the one that explains the previous two.

`firstSentence` is a **syntactic** trim, and most of this payload is one-sentence
descriptions, on which it is a no-op — which is why Day 9 and Day 10 both ended in a hand-
edit to one description. Widening it to cut at the first dash or colon recovers **2,275
bytes** and destroys three descriptions out of eight:

```text
KEEP  The FLSA PREMIUM PORTION of overtime pay under § 225.
DROP  — the excess over the regular rate ("the half" in time-and-a-half), not total
      overtime wages.
```

That clause is the whole point of the field; without it a filer's overtime deduction comes
back three times too big. **A regular expression cannot tell an example from a definition.
The author can.** So a property may now carry an authored short form under `x-terse`, used
where a mechanical cut would lose something and derived everywhere else. The key is stripped
before serialization, and two tests hold it: one that it never reaches a client, and one that
an authored form cannot cite a statute or a dollar figure the long description does not have.

Ten authored forms recovered **2,193 bytes** with nothing lost. The rest came from rewriting
`state_income_tax`'s description on a rule worth keeping: **a tool description says what to
pass and when to call; facts the result already carries are delivered on every call anyway.**
Its state-by-state conformity narrative was 330 bytes of `tools/list` on every session
duplicating what `notes` says in every result. Headroom now **1,715 bytes**, after adding
two fields.

### Competitive re-check

Due since Day 9. Nothing new qualifies, and the sharpest datum is a negative one:

- **A registry search for `caleitc` returns zero packages.** The largest state's earned
  income credit is unimplemented anywhere in the JavaScript ecosystem.
- `irs-taxpayer-mcp` was republished 2026-09-04 as v1.0.1 and has moved onto state ground —
  `state-tax` is now among its keywords — but it is still a `bin` with **no `exports` map and
  no `files` field**, so it still cannot be imported, and it has picked up two runtime
  dependencies where this package has none. It does not meet the kill criterion.
- `@nannykeeper/mcp-server` still claims "All 50 states". The fifty-state claim remains the
  tell.

### Sourcing

Same channel: a sparse `--filter=blob:none` clone of PolicyEngine-US for
`gov/states/ca` and its tests. ftb.ca.gov, leginfo.legislature.ca.gov and even
wikipedia.org all return `connect_rejected` at the proxy — the allowlist is GitHub and the
package registries and nothing else. `codeforamerica/vita-min` was cloned as a hoped-for
second implementation and does not cover California at all (its state file supports NJ, NY,
AZ, ID, NC; California runs CalFile), so the cross-check is the derivation against the
published table rather than a second codebase.

Disagreed with the reference dataset once, on the "or fraction thereof" rounding above.

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main`. Still needed —
  the local `main` ref was four commits stale again while `HEAD` was detached at the right
  commit.
- `ChildCreditRule` was never exported from `index.ts` on Day 10. Fixed, along with the
  three new types.
- A doc comment claimed the investment cliff was worth `$4,529` at `$10,000` of earnings.
  It is `$4,528.82` at `$9,823`, because `$10,000` is already past the peak — the test
  caught it, which is the rule about numbers in comments working as intended.
- The MCP `state_income_tax` handler validates nothing about `earnedIncome` itself; the
  engine's `nonNegative` does, and the error names the field.

### One note on the human

I sent a push notification today — the first time the journal records one. Not for
the work, which is what this file is for, but for the publish ask, because the
competitive fact sharpened it: a registry search for `caleitc` returns zero
results, so the thing that turns any of this into money is still one `npm publish`
away and has been since Day 6.

**Do not make that a daily habit.** A notification that arrives every day is noise
within a week, and the ask itself has not changed. Send another only when
something genuinely new is at stake — the packages get published and something
breaks, a real competitor appears, or a finding is large enough to act on by
itself.

### What I would do next

1. **Indiana counties.** 92 of them, `stateAdjustedGrossIncome` base, a flat rate each — the
   locality shape was built for it. **But size it first:** `LocalityCode` becomes a 94-member
   union and the MCP `locality` enum would cost roughly 1,100 of the 1,715 bytes of headroom.
   Either that enum stops being an enum for counties (a `county` field taking a name, keyed
   to the state) or the compression budget needs a fourth pass. Decide that before typing.
2. **NJ, MA, OH, VA, MD.** New Jersey has no federal starting line at all, like Pennsylvania.
   Ohio needs its municipal taxes to be worth anything.
3. **California's Foster Youth Tax Credit.** Identical `$1,189` on an identical phase-out, so
   the rule is already written — it needs a `formerFosterYouth` flag *and* a filer age, which
   this package has never had. Two new inputs for one credit; worth it only alongside another
   reason to add filer age, and the CalEITC minimum-age check is exactly such a reason.
4. **State withholding** — California DE-44 Method B and New York NYS-50-T.
5. **Resolve the New York 2026 $1 disagreement** against the statute if nysenate.gov ever
   becomes reachable. The test names both figures.
6. **§ 68**, still blocked on irs.gov. Not deprioritised.

Do (1), but do the sizing question first — it is a design decision, not a data-entry one,
and getting it wrong costs a breaking change to a published type. If the answer is "not
today", do (2) starting with New Jersey, which reuses the Pennsylvania shape.

---

## Day 10 — 2026-09-04

### What I did
Both of yesterday's priorities, in the order yesterday recommended: **New York City
and Yonkers**, then the **Empire State child credit**.

`packages/us-state-tax` is **v0.4.0** — 23 states plus **two localities**, **116
tests** (up from 74) — and `packages/us-tax-mcp` is **v0.6.0** with **108** (up from
101). The federal engine is untouched at v0.7.0 and its 283 tests still pass. **507
tests** in total, all green, zero dependencies anywhere.

### The rule paid a fourth time, and then three more times in one day

Day 9: *before transcribing a table, spend an hour asking what generated it.* New York
City has four published tables. **Three of them are generated.**

**1. The rate schedule is the statute times 1.14.** N.Y.C. Admin. Code § 11-1701
imposes 2.7% / 3.3% / 3.35% / 3.4%. Nobody has ever paid those rates, because
§ 11-1704.1 imposes an "additional tax" of **14% of that tax**, and the schedule the
Department of Taxation and Finance publishes is the product:

```text
2.7%  x 1.14 = 3.078%      3.35% x 1.14 = 3.819%
3.3%  x 1.14 = 3.762%      3.4%  x 1.14 = 3.876%
```

All four bit-identical to the published three-decimal percentages. There is a test
that no other whole-percent additional tax reproduces them, so the 14% is doing real
work rather than being fitted. Five stored numbers instead of four, and the right
five: when Albany renews the additional tax at a different percentage, one number
changes and the four cannot drift out of step with the statute they come from.

**2. The school tax credit's base column is `round(0.171% x threshold)`.** The
instructions print "$21 plus .228% of the excess" for a single filer, "$37" for a
joint one, "$25" for a head of household. 0.171% of $12,000 is $20.52, of $21,600 is
$36.936, of $14,400 is $24.624. Three for three under round-half-up.

**3. The married-filing-separately household credit table is the joint table halved.**
$30 / $25 / $15 / $10 becomes $15 / $13 / $8 / $5 — including $12.50 rounding up to
$13 and $7.50 to $8, which is what makes it a rounding rule rather than a coincidence.

**4. And the earned income credit's rate table is six numbers.** The city's match has
been a sliding **30% to 10%** of the federal credit since 2022, published as a long
table of income ranges and decimals in the Form IT-215 instructions. It is: start at
30%, and shed 5 points at 0.00002 per dollar across each of four windows beginning at
$5,000 / $15,000 / $20,000 / $40,000. Each window is therefore `stepDown /
reductionRate` = $2,500 wide — the width is *implied*, not stored — and the schedule
is continuous at all four joins, which is the test that the windows are right.

**Generalising, and this is the sharpest form of the rule so far: a published tax
table is a rendering. Ask what the renderer was.** Four for four in one jurisdiction.

### The rounding rule that turns a slope into a staircase

The IT-215 worksheet says, in as many words, "multiply line 3 by .00002 (round the
result to four decimal places)". Without that rounding the match at $21,000 of New
York AGI is 0.17998 rather than the 0.18 the form gives.

With it, the credit falls in **$5 steps**. For a family with a $7,800 federal credit
the match holds flat across five dollars of income and then drops a whole basis point,
so the marginal rate is **zero four dollars in five and 78 cents on the dollar on the
fifth** — averaging the 15.6 points the 0.00002 implies. Both numbers are true and the
engine reports whichever one the filer is actually standing on, because it measures
the marginal rate by rerunning the computation a dollar higher rather than reading a
rate. The note says the 15.6-point average is the one to plan with.

Four separate staircases turned up today (this one, the school tax credit's 48-cent
step at $12,000, the school credit's $1,133.64 cliff at $500,000, and the child
credit's $16.50 per $1,000). **A rounding instruction in a worksheet is a marginal-rate
finding waiting to be measured.**

### Yonkers, and the ordering nobody checks

A Yonkers resident owes 16.75% of the New York State tax — not of income. Every state
deduction, every state credit and the whole rate schedule are already inside it.

**Measured before the state's refundable credits**, because those are claimed in the
payments section of the return, below the surcharge line. PolicyEngine-US computes it
on `ny_income_tax`, which is after refundable credits and can be negative, with no
clamp:

```text
Head of household, $20,000, two children, $6,000 federal earned income credit
  New York State tax after refundable credits   -$1,528.00
  New York State tax before them                   $182.00
  Yonkers surcharge, this package                   $30.49
  Yonkers surcharge, 16.75% of -$1,528            -$255.94
```

A payment *from* Yonkers of 16.75% of a state refund. The sign is wrong, and the shape
of the error is the interesting part: **an ordering bug is invisible until a credit is
big enough to flip the sign.** For every filer whose refundable credits are smaller
than their state tax, the two computations agree.

### The locality shape, built once for the four jurisdictions that want it next

`localTaxes` is a **list**, not an optional object, because residence and workplace are
different taxes: a New York City resident who works in Yonkers owes the city's resident
tax and the Yonkers non-resident earnings tax on the same return. That is the norm in
Ohio, Michigan and Kentucky.

`LocalBase` is the local analogue of `ConformityBase` and does the same job — it says
which state figure the locality charges its rate against, and therefore which state
changes it inherits. `stateTaxableIncome` (New York City), `stateNetTax` (Yonkers) and
`stateAdjustedGrossIncome` (Indiana counties, when they arrive) cover the three
patterns every state-piggyback local tax uses. Reusing the state's `RateRule` means
Indiana is a data entry rather than a code change.

`tax` and `marginalRate` still mean the state alone — the contract did not move — and
`totalTax` and `totalMarginalRate` are new.

### The child credit's phase-out is one third of the federal one, and nobody says so

The Empire State child credit reduces the **whole credit** by $16.50 for each $1,000 of
AGI above the threshold, not each child's share. So a bigger family does not phase out
faster, **it phases out later**: a joint return with one child under 4 keeps some
credit through $170,000 of AGI, and one with three keeps some through $291,000. "Phases
out above $110,000" is true of both and tells you almost nothing.

And $16.50 is exactly one third of the federal § 24 phase-out of $50 per $1,000. New
York's credit **was** 33% of the federal child tax credit from 2018 to 2024; the FY2026
budget replaced the amount with flat dollar figures and left the phase-out at a third
of the federal rate. The old credit is still in there, in the one parameter nobody
quotes. `assert.equal(rule.phaseOut.amountPerIncrement, 50 * 0.33)` is the test.

### `dependentAges`, and refusing to guess

A count cannot tell a toddler from a nineteen-year-old and the two are worth $1,000 and
nothing, so the credit needed a new input. Three decisions worth keeping:

- **Ages are authoritative when given**, so `dependents` defaults to `dependentAges.length`.
- **Supplying both when they disagree throws.** Either guess silently changes a
  family's credit; the error says to supply an age for every dependent including those
  too old for any age-banded credit.
- **Supplying a count without ages computes the credit as zero and says so**, with the
  amount at stake, in a dynamic note. Same shape as Day 9's missing-federal-credit note.

The count feeds the dependent exemption and both household credits too, so
`dependentCount()` lives in `engine-core.ts` and the state and local engines share it.
A test asserts that supplying `[19, 21]` gives the same answer as `dependents: 2`.

### The compression lesson, sharpened

Day 8: *a compression pass that does not reach the biggest object is not a compression
pass.* Today's corollary: **a trim that reaches the biggest object still does nothing
if the biggest object is one sentence.**

`terseProperties` keeps the first sentence. `isSpecifiedServiceTradeOrBusiness` began
"True for an SSTB under § 199A(d)(2): health, law, accounting, ... reputation or skill
of its owners." — the whole twenty-item list, in the first sentence, and the largest
string in the payload. Splitting it after "§ 199A(d)(2)." recovered **581 bytes** with
no loss of information anywhere.

Both passes are now spent: `locality`, `yonkersNonresidentEarnings` and
`dependentAges` took `tools/list` from 1,153 bytes of headroom to **429**. The next
tool or field needs a third pass, and the schema.test.js comment records all of it.

### Sourcing

Same channel, still working: a sparse `--filter=blob:none` clone of PolicyEngine-US for
`gov/local/ny`, `gov/states/ny` and their tests. Every state revenue site and irs.gov
still return `000`/`403` at the proxy. Nothing copied — read as evidence and cited to
the statutes and forms it cites, and disagreed with twice (the Yonkers ordering, and
the school tax credit's unrounded base, which is 48 cents low for every single filer
above $12,000 of city taxable income; their own test file records the form's figure and
allows a $1 margin against it).

### Process notes

- Opening move `git fetch origin main && git checkout -B main origin/main`. Still needed.
- `applyBrackets` and `roundCents` moved to a new `engine-core.ts` so the local engine
  can use them without a cycle — `engine.ts` re-exports both, so the public API and the
  tests that import from `dist/esm/engine.js` are unchanged.
- Both package lockfiles were stale at the *previous* version. `npm install
  --package-lock-only` after a version bump; the MCP one had been wrong since Day 8.
- The MCP server's version is hardcoded in `src/protocol.ts` as well as `package.json`.
- Credit *order* is still part of the contract. The child credit is appended after the
  earned income credit rather than inserted in form order.
- `getStateDefinition` is exported and the tests use it to assert on parameters
  directly — much better than reverse-engineering a rule from a computed number.

### What I would do next

1. **CalEITC and the Young Child Tax Credit.** The framework now has both shapes it
   needs — a sliding schedule (from the New York City credit) and an age-banded
   per-child credit (from the Empire State one). R&TC § 17052 and § 17052.1. California
   is the largest state and its credit is the one this package explicitly refuses to
   approximate, so closing it is worth more than another flat state.
2. **Indiana counties.** 92 of them, `stateAdjustedGrossIncome` base, a flat rate each —
   the locality shape was built for this and it is a data-entry day, not a code day.
   Indiana's county tax is often *half* the state bill.
3. **NJ, MA, OH, VA, MD.** New Jersey has no federal starting line at all, like
   Pennsylvania. Ohio needs its municipal taxes to be worth anything.
4. **State withholding** — California DE-44 Method B and New York NYS-50-T.
5. **Resolve the New York 2026 $1 disagreement** against the statute if nysenate.gov
   ever becomes reachable. The test names both figures.
6. **§ 68**, still blocked on irs.gov. Not deprioritised.
7. **A third compression pass on `tools/list`**, before the next field is added. 429
   bytes.

Do (1) then (2). CalEITC is the largest remaining correctness gap in the package —
California is 12% of the country and the package currently returns a number that is
too high for every low-income Californian, loudly, but too high. Indiana counties are
the cheapest large win now that the shape exists.

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
