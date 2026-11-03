# The preparer-anchor harness

**The only check in this repository whose right answers were produced outside
it.** Everything else here compares this engine against a statute somebody here
read, against a model this project chose, or against a deliberately broken copy
of itself. This one compares it against a figure read off a filled return.

```
# once, with network:
python3 -I tools/anchors/read.py --fetch        # -> out/anchors.json  (committed)

# every time, offline:
node tools/anchors/ours.mjs    > tools/anchors/out/ours.json
node tools/anchors/compare.mjs > tools/anchors/REPORT.md
```

`read.py` needs the network and is manual, exactly as `tools/differential`'s
`theirs.py` is. **It is deterministic and that was checked rather than assumed**:
running `--fetch` into an empty directory and re-deriving `out/anchors.json`
reproduces the committed file **byte for byte**, which is what makes the sha256
manifest inside it worth having — a hash of bytes nobody can fetch again is a
decoration. The other two are pure `node` over committed JSON, so CI
regenerates them on every push and requires that nothing changed — the golden
file pattern the differential harness already uses.

## Why it is a different kind of evidence

| instrument | what it compares | who produced the right answer |
| --- | --- | --- |
| the per-state test files | a figure here against a statute | a run of this project |
| `tools/differential` | this engine against `policyengine-us` | another model |
| `tools/mutation` | this engine against a broken copy of itself | this engine |
| the provenance ledger | a figure against the document it came from | a run of this project |
| **`tools/anchors`** | **this engine against a filled return** | **TaxAct, a state worksheet, TAXSIM** |

Two models can agree because they made the same reading of the same ambiguous
sentence, and a statute cite cannot catch that either, because the cite is to
the sentence both of them read. A figure off TaxAct's PIT-1 or Virginia's own
Form 760 Spouse Tax Adjustment worksheet is not an opinion about the statute;
it is what a filer would have been told to pay.

> **"WE AGREE WITH AN OPEN-SOURCE MICROSIMULATION MODEL" IS AN ARGUMENT FOR
> SOMEBODY WHO KNOWS WHAT ONE IS. "WE REPRODUCE TAXACT'S OWN FORM TO EIGHTEEN
> CENTS, AND HERE IS WHERE WE DISAGREE WITH IT" IS AN ARGUMENT FOR EVERYBODY
> ELSE.**

## Where the anchors come from, and what is NOT committed here

`policyengine-us` ships test fixtures under
`policyengine_us/tests/policy/baseline/gov/states` whose `output:` blocks were
filled in from commercial tax software. `tools/differential/PREPARER-ANCHORS.md`
surveyed them; `read.py` reads the fifteen files that survey found in states
this package ships, at a pinned commit.

**The fixtures themselves are never committed here.** They are AGPL-licensed
files from another project and this repository is MIT. What lands in
`out/anchors.json` is the derived facts — a household, an expected figure, a
margin, the fixture's own name — beside the sha256 of the bytes they were read
from and the commit they were read at, so the extraction is reproducible without
the sources being vendored. Day 68 paid 838 MB and a force-push for the
difference between reading a file and vendoring it.

The enumeration is the survey's list and not a directory walk, because
`api.github.com` answers `403` for repositories outside this session's own and
`codeload.github.com` refuses tarballs: only named files can be fetched from
here. A sixteenth fixture file that grows a preparer anchor upstream will not
appear on its own, and that is a known limit rather than a silent one.

## THE PROPERTY THAT MAKES THE REPORT WORTH READING: IT REFUSES

A PolicyEngine situation is a dict of variable names written for another model.
Translating one means mapping each name onto a field of `StateIncomeTaxInput`,
and the failure mode is not a crash — it is a case that silently loses a fact
and then reports the difference as a defect in the engine.

> **A DROPPED FIELD IS A WRONG ANSWER THAT LOOKS EXACTLY LIKE A DISAGREEMENT.**

So the reader refuses, under three rules:

1. **An unmapped variable with a non-zero value refuses the case.** The fact is
   in the household and the engine is not being told it.
2. **An unmapped variable set to zero or false is ignorable**, because zero of
   something is the absence of it. Most of the bulk of these fixtures is this:
   `ssi: 0`, `wic: 0`, `snap: 0` — benefits switched off so a TAXSIM comparison
   is like for like.
3. **Rule 2 has an exception, and it is the reason this file is careful.** A
   variable named for the case's OWN state, set to zero, is not an absence — it
   is an override of a component of the figure under comparison. The 2021 New
   Mexico fixture zeroes `nm_2021_income_rebate`; if this package computed one,
   the comparison would be between a tax with a rebate and a tax without. Every
   such override is declared in `BENIGN_STATE_OVERRIDES` **with a written
   reason**, or the case is refused.

`ours.mjs` holds the same property from the other side: `PASSED` is exhaustive,
and a translated fact it cannot pass throws by name rather than being dropped.
The two maps are in two languages in two files and the only thing keeping them
in step is that the gap between them is a crash.

**A refusal is a statement about this harness. A skip is a statement about the
engine's declared range** — a year outside 2025–2026, a state not shipped, an
asserted variable with no comparand here. They are counted separately and both
are printed, because a harness that reported only its agreements would be
measuring its own coverage and calling it correctness.

## The margin is the fixture's and never this harness's

The fifteen files carry margins from `0.01` to `5`. A case whose expected value
came off a form rounded to the dollar cannot be held to the cent; a case whose
expected value is an exact worksheet line must be. **A harness that imposed one
margin would either reject a correct answer or accept a wrong one.** A case with
no stated margin is held to the cent, which is the strictest reading of silence
rather than the most convenient one.

## An agreement can be about less than the whole return

`LIMITATIONS` in `compare.mjs` names households this harness cannot put
completely to the engine, and every one is printed whether its case agrees or
not. The first entry is Virginia's spouse tax adjustment, and it is there
because the first version of `ours.mjs` **invented** one: the engine documents
`lesserSpouseIncome` as line 5 of the Form 760 worksheet — the lesser spouse's
Virginia AGI *less that spouse's own exemptions* — and the harness passed her
gross interest instead, producing a `$9.58` adjustment where TaxAct, TAXSIM-35
and Virginia's own worksheet all produce zero.

> **A FIELD DOCUMENTED AS A WORKSHEET LINE TAKES THAT LINE OR NOTHING.** Passing
> a different figure into it is not an approximation of the rule, it is a
> different rule. Naming the shortcut in a comment — which the first version did
> — does not make the number right.

The honest fix was to pass neither field and declare the gap, because line 5 is
a Virginia computation and a harness that reimplements the state cannot check
it. With that, Virginia reproduces the worksheet **to the cent**.

## What to do with a disagreement

Each one is a defect here or a finding about the other side, and both are worth
more than an agreement. `REPORT.md` lists them with the fixture that produced
them. Do not add a tolerance to make one go away: the tolerance belongs to the
fixture's author.
