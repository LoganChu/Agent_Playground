# A LEVELS audit that runs

> **Day 44: the worker pool was a pool of ONE until today.** `runSuite` was
> `execFileSync`, and the pool starts `WORKERS` copies of an `async` worker over
> one event loop — so a synchronous child-process call in it meant the first
> worker held the loop until its suite returned and the other three never
> started. Four queues, one runner, three idle cores, and the start-up line has
> said "4 workers" since the pool was written. Promisified: **3.8 mutants/minute
> to 14.8**, validated on `--only alabama.js` (43 mutants, 43 killed, the figures
> Day 41 recorded) with `user/real = 3.26` on four cores — the ratio, not the wall
> clock, is what proves it. **A worker pool whose work is a SYNCHRONOUS call is a
> pool of one, and it reports the number of workers you asked for.** Nothing in
> this harness's own output could have caught it; `ps` did. Worth adding: print
> how many children are actually alive.


`mutate.mjs` sets one number in a built package wrong, runs the suite, puts it
back, and does it again for every number. A **survivor** is a number this package
could be shipped with a wrong value for.

```sh
# The whole federal package.
node tools/mutation/mutate.mjs packages/us-federal-tax

# The state package's RULE parameters. The locality registries are left out by
# DEFAULT now, because Day 43 started a two-hour recorded run without the flag
# that every run before it had used -- the invocation was in this README and
# nowhere the program could read. `mutate.mjs` carries the list and announces it
# at start-up; `--skip none` includes them.
node tools/mutation/mutate.mjs packages/us-state-tax

# One file, while fixing it.
node tools/mutation/mutate.mjs packages/us-state-tax --only virginia.js
```

| flag | meaning |
| --- | --- |
| `--workers N` | parallel worker copies (default: CPU count, capped at 8) |
| `--skip a,b` | substrings of `dist/esm` paths to leave out. OMITTED, it takes the harness default for the package (the state package's locality registries); `--skip none` leaves nothing out |
| `--only s` | only files whose path contains `s` |
| `--limit N` | first N mutants — for checking the harness, not the package |
| `--shard i/n` | every nth mutant, for splitting a run |
| `--skip-tests f` | test files to leave out (default `readme.test.js`) |
| `--test-isolation m` | `none` (default) runs the whole suite in ONE node process per mutant; `process` restores one process per test file, which is what every run before Day 43 did and is about 24% slower on four cores |
| `--json f` | write every result, not just survivors |

## How long it takes, and the one flag that halves it

`node --test` spawns a child process per test FILE, so four workers running a
fifty-file suite put two hundred node startups on four cores for every mutant.
Day 40 measured that and reached for `--test-concurrency=1`, which controls how
many of those children run at once rather than whether there are any, and the
audit got **twice as slow**: 43 Alabama mutants went from 4m11s to 9m42s.

`--experimental-test-isolation=none` removes the children. Measured on the state
suite on Day 43:

```text
one suite run, standalone        real     user
  default (one process/file)     8.27s   14.49s
  isolation=none                 6.53s    7.35s

the audit itself, four workers on four cores
  default                        11.1 mutants/min
  isolation=none                 13.8 mutants/min   -> 24% faster
```

**The honest figure is the 24%, and the first version of this note said "twice as
fast".** That was inferred from the user time halving, and it is the wrong
inference: with workers equal to cores the wall clock tracks the REAL time of one
run, because the per-file children were already saturating the cores and their
cost was inside that real time. User time predicts how the win scales when cores
are added — `--workers 8` on eight cores runs eight single-threaded processes
here and sixty-four on the old path — not what the win is on four.

Both modes report the same 765 tests and the same 765 passes, both exit non-zero
on a planted mutant, and `--only ohio.js` returns the same 64 mutants and the same
two survivors on both, which is what validated the change before it was trusted.

It is the default. `--test-isolation process` restores the old behaviour, the mode
in force is announced at start-up, and a Node that does not support the flag falls
back with a message rather than leaving a red baseline to be diagnosed.

## Per-mutant test selection, and why it cannot move the score

Day 64 shipped Arkansas and the audit stopped fitting in a day: 2,436 mutants
against a 1,018-test, 26-second suite on four cores is about **fifteen hours**.
The run was started, reached 100 mutants in 38 minutes, and was stopped. The
cause was the SUITE's growth and not the state count — every mutant ran all 66
test files.

Day 65's fix is the one this README's timing section had left on the worklist
since Day 40. **2,320 of the 2,436 mutants are in `states/*.js`, and a parameter
in one state's module can only change an answer for a household in that state.**
So each of those mutants runs, in this order:

1. the two state-sweep guards, narrowed with `--test-name-pattern` to that
   state's own tests;
2. every test file that names that state's code, plus every file that names no
   state code at all.

```text
whole suite                                        26.56s
the two sweeps, narrowed to one state               0.60s
the 9 other files that mention AR or no state       1.74s
                                                   ------
phase 1                                             2.34s    -> 11x
```

**A mutant that SURVIVES its selection is then re-run against the whole suite,
and only that verdict is recorded.** That is the entire soundness argument:

```text
killed by the selection  ->  killed, and a real test failure says so
survived the selection   ->  re-run on all 66 files, and that verdict stands
```

So the score is identical to a full run, mutant for mutant, **whatever the
selection does**. A bad selection costs time — one full re-run per mutant it
failed to kill — and cannot cost accuracy.

The re-run path is load-bearing rather than theoretical. On a 61-mutant sample
spread across every file, 44 were killed by a narrowed run, 8 had no selection
(they are outside `states/`) and **9 survived their selection and were killed by
the whole suite**. Those 9 are the measurement that matters, and they name a
real property of this suite: 18 test files sweep every shipped state while naming
only one or two codes in their text, so they can kill a mutant in a state they
never mention. Adding all 18 to every selection was measured and REJECTED —
`survivor-retirement.test.js` alone is 2.95s and `provenance.test.js` 1.87s, so
phase 1 would cost about 9s against the 6.9s that 83% at 2.34s and 17% at 29.3s
actually average. **The occasional whole-suite re-run is cheaper than making
every mutant pay for the sweeping files.** Splitting those 18 per state, the way
`status-sweep.test.js` and `step-probes.test.js` were split, is the next
reduction and is on the worklist.

Both halves of the selection are DERIVED, because a list of file names is a list
that goes stale:

- a test file is narrowable when its source builds a test name out of a
  `${state}`, so splitting a third sweep needs no edit in the harness;
- a module's state is its own `code:` field, and a module claiming more than one
  code selects nothing and takes the whole suite;
- which states a test file mentions is read out of its text.

`--no-select` restores the Day 64 behaviour.

### The guard, because a pattern that matches nothing is green

`--test-name-pattern` that matches no test produces a GREEN run of ZERO tests,
and this harness reads green as "the mutant survived". A renamed per-state test
would therefore send a whole state's mutants through a vacuous phase 1 and a full
re-run — slower than no selection at all, and silent. So every state code in the
run is probed once at start-up and a selection that matches nothing stops the
run, which is Day 47's rule applied to a second flag: an announcement at start-up
is not a guard, a guard is something that will not proceed.

## Why it exists

Day 32 found a Virginia defect that had had its own passing test for a month. The
test asserted a **difference** — what one exemption was worth — and the age
deduction sat on both sides of the subtraction, so the assertion was `$99.47` with
the deduction at `$12,000` and `$99.47` with it at `$0`.

The rule that left: *an assertion on a difference tests the difference and nothing
else.* The question it left: **how much of the suite is differences?**

That question cannot be answered by reading the tests, because the tell is not in
the assertion's shape. `assert.equal(r.tax, 1612.40)` is a level and it is still
blind to any parameter its household cannot reach. The only honest form is
operational — *if this number were wrong, would any test fail?* — and the only way
to answer it is to make the number wrong.

## What a survivor is, and what it is not

A survivor is **not automatically a bug.** It is a statement about what the suite
pins, and there are three kinds:

1. **A gap worth closing.** A rule parameter with no household behind it. Day 33's
   run found nineteen of these in each of 2024 and 2025 — EITC rates, § 199A
   rates, the child-credit phase-in — every one of them pinned in 2026 and in no
   other year.
2. **A registry row.** One of 1,033 municipal rates cannot have its own test, and
   pretending otherwise would be theatre. These are excluded with `--skip` so the
   report is about rules.
3. **Dead weight.** A parameter nothing reads at all. Worth deleting rather than
   testing.

The report does not distinguish them. A human does, and the distinction is the
work.

## Four ways this harness lied before it worked

Worth keeping, because each was silent and each inverted the result.

**It mutated statute citations.** The first run scored `credits.js` at 0% killed.
Every "survivor" was a number in JSDoc — `§ 164(f)`, `$8,812`, `$1,700` — and a
number in a comment cannot make a test fail. *A mutation score computed over
comments is a measure of documentation density.* Fixed by masking comments and
string literals before enumerating, preserving byte offsets.

**It skipped almost every parameter.** The pattern was `\d+(\.\d+)?`, and this
codebase writes `12_400`. That matches the `12` and stops, so the harness was
mutating a two-digit prefix of a five-digit threshold — mutations that are
frequently killed for the wrong reason, while the parameter itself was never
tried. *A regex over source is a claim about the source's notation.*

**Its baseline was red and it did not care.** `readme.test.js` asserts about
sibling packages' READMEs, so it cannot pass inside a worker copy. Two failures in
the baseline would have marked **every mutant killed** and reported a perfect
score. The harness now refuses to run on a red baseline, which is the only reason
this was found in a minute rather than believed.

**It masked real code, and which code depended on the whole file.** The fix for
the first lie above — blank comments and string literals before enumerating — had
no notion of a template literal's `${...}` interpolation. It saw a backtick,
scanned to the next unescaped backtick, and blanked everything between, so
`Math.round(rule.perFilerCap / 0.0765)` inside a note was invisible. Which
backtick the scan landed on depends on every quote, comment and escaped backtick
earlier in the file, so **editing one template literal in one function changed
whether a literal in a different function was mutated at all.**

Day 56 found it by predicting the count. The day's change added no numeric
literal, so the prediction was 1,534 unchanged; the run said **1,533**, and the
missing mutant was `0.0765`, six hundred lines from anything the day touched.

> **A MASK WITH A STATE MACHINE IS A GLOBAL PROPERTY OF THE FILE, SO A LOCAL EDIT
> CAN DELETE A CHECK SOMEWHERE ELSE** — and it fails in the direction that looks
> fine, because a mutant that stops existing cannot survive. The score goes up
> while the coverage goes down.

The old comment called over-masking "the safe direction" and treated that as the
end of the argument. It is the safe direction and it is not harmless: fewer
mutants is fewer checks, reported as a better number.

`maskNonCode` is now template-aware — it blanks a template's text and walks each
`${...}` as code, tracking brace depth and recursing into nested templates and
quotes. That recovered **ten** literals in `us-state-tax`'s `engine.js` and
**zero** in `us-federal-tax`, which has no interpolated literal at all. **Six of
the ten survived**, every one a percentage printed mid-sentence in a note, and
`packages/us-state-tax/test/dynamic-note-figures.test.js` is what closes them.

## How it works

- Mutates `dist/esm/**.js` and runs `node --test test/*.test.js` directly, so no
  mutant pays for a `tsc` run.
- Each worker gets its own copy of `dist` + `test` + `package.json`, because the
  tests import `../dist/esm/index.js` and would otherwise see each other's
  mutants.
- Refuses to run if the baseline suite is not green.

### The operators

A mutant has to be wrong while staying the same **kind** of thing, or it dies of a
type error rather than of being wrong:

| kind | test | mutation |
| --- | --- | --- |
| rate | `0 < v < 1` | `v / 2` |
| year | `1900 ≤ v ≤ 2100` | `v - 1` |
| money | `v ≥ 100` | `v * 2` |

Doubling rather than `+1` is deliberate: a `+1` on a `$12,000` deduction is six
cents of Virginia tax and can round away, and **a mutant that dies of rounding
teaches nothing.** Integers below 100 are left alone because most of them are
counts, ages and array indices rather than money — which means the score says
nothing about those, and a parameter like `maximumChildAge: 17` is outside what
this measures.

## Reading the score

The score is **not** a target. Driving it up by writing tests against the table
would satisfy the number and prove nothing, which is Day 27's rule: *a test
written from the data can only confirm the data.* What the score is good for is
**comparison** — between packages, between files, and between years of the same
file, which is how Day 33's finding surfaced. The three per-year data files had
nearly identical parameter counts and wildly different survival rates, and that
asymmetry was the whole finding.

## A score is a score OF something, and the something is recorded beside it

Day 35 left the rule that a score may not be **inferred**. Day 36 added that it
may not be **inherited** either, having twice invalidated a run in flight by
editing a string: the harness copies `dist` into its workers once at start, so a
score belongs to the tree it ran on.

All three days stated the rule and left the enforcement to a future run
remembering. Day 37 found what that costs. `README.md` advertised
`us-federal-tax` at **698 mutants** for a full day after the committed, measured
figure became **711** — the mutation numbers were the last advertised
measurements in this repository that a human had to copy by hand, which is
exactly the hole Day 36 closed for the test counts and missed sitting beside it.

**THE RULE: a measurement is only ever a measurement OF something, and the
something has to be recorded beside it.** A score with no fingerprint cannot be
told from a stale score by reading it — and being distinguishable from a stale
number is the only property that makes a measured score worth more than "well
tested".

So:

```sh
# the audits, weekly, write the record
node tools/mutation/mutate.mjs packages/us-federal-tax --record tools/mutation/scores.json

# the cheap half, on every push: do the docs match the record, and was the
# record measured over THIS build?
node tools/mutation/check-scores.mjs --check
```

`scores.json` carries, per package, the score **and two fingerprints** —
`fingerprint.mjs` hashes the paths and bytes of exactly what the harness mutates
(`dist/esm/**.js`) and, separately, of the suite that does the killing (`test/`).
They are kept apart because they fail for different reasons and want different
fixes: *the parameters changed* and *the suite changed* are not the same news.

Two consequences worth having.

**A reworded doc comment does not invalidate a score, and that is now a
computation.** `tsc` puts a module's documentation in the `.d.ts` and not in the
`.js`, so the mutant fingerprint does not move. Day 36's "a string is not a
mutant" was an argument; it is a `sha256` now.

**And reusing yesterday's score is a check rather than a judgement.** The first
real use of this was the federal entry in `scores.json`: Day 36 measured 711 of
711 and nothing in `us-federal-tax` changed on Day 37, so rather than copy the
number across, both fingerprints were computed from a build of Day 36's commit
and from the shipping tree — `ab241588dec1ef83` and `787dd4e58fd1047d`, the same
pair — which is what licenses the record to say `"measured": "2026-09-30"` with
today's build behind it.

`--limit` runs are **refused** by `--record`. The flag exists to check the
harness, not the package, and a row reading "3 mutants, 100%" would be worse
than no row because it reads exactly like a real one.

## The fast proxy, which is where Day 34's findings came from

This harness takes about half an hour per package: it runs the whole suite once per
mutant, and the suite got slower on Day 34 precisely because of the test described
below. Half an hour is fine for a weekly job and useless while you are working.

So `packages/us-state-tax/test/status-sweep.test.js` asks the same question over a
subset, inside the ordinary suite, in about a second. It walks the state definitions
for every `ByStatus` table, sets a cell wrong **with the same filter this harness
uses** — integers ≥ 100, decimals in (0, 1) — and fails unless one of 4,180 pinned
answers moves.

**THE RULE: a slow instrument that establishes a property is worth converting into a
fast test that preserves it**, or the property decays for six days out of seven. And
because the two use the same filter, passing the fast one *means* this one finds no
surviving `byStatus` cell, rather than merely suggesting it.

Two things to know before trusting the proxy, both learned by getting them wrong:

- **It reports an upper bound on survivors, not survivors.** The walk can only see
  whether an *answer* moves, so it is blind to every assertion made about the data
  directly. Maryland's `exemption.perFiler` is unreachable by the engine and pinned by
  a relation test in `registry.test.js`; the walk calls it unreached and it is not a
  survivor.
- **A parameter can be dead in its own column and live in another's.** New Jersey's
  `retirementExclusion.maximum.marriedFilingJointly` can never bind as a cap for a
  joint filer — every tier makes it a contradiction — and it is the denominator that
  derives the other four statuses' percentages. So the perturbation has to be checked
  against every status, not the one it belongs to.

Widening the same walk from `ByStatus` tables to every numeric leaf is a planning
tool rather than a test: it reports how many of the package's 1,281 rule parameters no
household reaches, which is what `STATE-SURVIVORS.md` uses to decide what to build
next.
