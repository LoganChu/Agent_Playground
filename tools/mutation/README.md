# A LEVELS audit that runs

`mutate.mjs` sets one number in a built package wrong, runs the suite, puts it
back, and does it again for every number. A **survivor** is a number this package
could be shipped with a wrong value for.

```sh
# The whole federal package.
node tools/mutation/mutate.mjs packages/us-federal-tax

# The state package's RULE parameters, leaving out the locality registries.
node tools/mutation/mutate.mjs packages/us-state-tax \
  --skip localities/ohio.js,localities/ohio-school-districts.js,localities/indiana.js,localities/michigan.js,localities/maryland.js,localities/new-york.js,localities/counties.js

# One file, while fixing it.
node tools/mutation/mutate.mjs packages/us-state-tax --only virginia.js
```

| flag | meaning |
| --- | --- |
| `--workers N` | parallel worker copies (default: CPU count, capped at 8) |
| `--skip a,b` | substrings of `dist/esm` paths to leave out |
| `--only s` | only files whose path contains `s` |
| `--limit N` | first N mutants — for checking the harness, not the package |
| `--shard i/n` | every nth mutant, for splitting a run |
| `--skip-tests f` | test files to leave out (default `readme.test.js`) |
| `--json f` | write every result, not just survivors |

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

## Three ways this harness lied before it worked

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
