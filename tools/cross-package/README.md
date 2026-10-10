# Cross-package claims

Every other instrument in this repository is scoped to **one package**. The
provenance ledger cites `us-federal-tax`'s figures to IRS releases and
`us-state-tax`'s to statutes; the differential grid runs the state engine against
PolicyEngine-US; the mutation audit sets each package's own numbers wrong; the
indexation derivation bounds one state's factor from that state's published table.

None of them can read **across** the two packages. This can.

## Why that mattered

`us-state-tax` describes the One Big Beautiful Bill Act's 2025 standard deduction
increase in five states' shipped notes, in both READMEs and in four test files. For
46 days every one of those said the increase was **`$1,150`**. It is **`$750`** —
`$15,000` to `$15,750`, because Rev. Proc. 2024-40 had already indexed 2025 to
`$15,000` before the Act touched it. `$14,600` is the **2024** figure, and a third of
what this package credited to Congress was ordinary indexation.

`packages/us-federal-tax/src/data/2025.ts` has had it right, in a comment, since the
day it shipped:

```ts
  // A 2025 return prepared with $15,000 / $30,000 / $22,500
  // overstates taxable income by $750 / $1,500 / $1,125.
```

**Two packages in one repository disagreed by 53% about a federal figure, and the one
that was right had written the number down.** Nothing compared them.

The engine was never wrong — it takes 4.4% of whatever deduction it is handed. The
defect was in the **premise**, and the premise was supplied by the tests asserting it:

```js
const PRE_OBBBA_2025 = { ..., deduction: 14_600 };
money(coBefore.tax - co.tax, 50.6, '4.4% of the $1,150 increase');
```

`4.4% × $1,150 = $50.60` is arithmetically perfect and factually about a change that
did not happen. **A test that supplies the premise it asserts can only confirm it, and
it reads exactly like one that works.**

**THE RULE: a package that describes another package's parameters is making a claim it
cannot check, and the fact that both packages are yours makes it likelier rather than
less.** The federal figure felt like context rather than a dependency, so it got
transcribed instead of imported.

## Usage

```bash
node tools/cross-package/obbba-claims.mjs          # print every figure and its source
node tools/cross-package/obbba-claims.mjs --check   # exit 1 on any disagreement
```

Both engines must be built; the tool says so if they are not. It runs them rather than
reading their source, so an advertised figure is checked against an **answer** and not
against a literal that could have been copied wrong in both places. The `cross-package`
CI job builds both and runs `--check` on every push.

## What it checks

| # | claim | against |
| --- | --- | --- |
| 0 | `us-federal-tax` agrees with itself | `superseded + increase === the 2025 figure`, at every filing status |
| 1 | the state suite's pinned `OBBBA_INCREASE` | `us-federal-tax`'s own `OBBBA_2025_STANDARD_DEDUCTION_INCREASE` |
| 2 | every cut advertised in both READMEs' OBBBA tables | the state engine, run twice per state |
| 3 | every conformity word and date in those tables | each state's declared `federalConformity` |

The increase is **derived** in `us-federal-tax` from the superseded Rev. Proc. 2024-40
figures and the figures the 2025 return uses, so it cannot disagree with either side of
its own subtraction. This tool's job is to stop anything else disagreeing with it.

## What it deliberately does NOT do, and why that is the interesting part

The first version scanned every tracked file for the cuts derived from the **wrong**
increase, on the theory that `$50.60` should never appear in this repository again. It
reported twelve hits and **ten of them were false**:

- `$28.75` and `$69.00` are ordinary tax amounts, and they occur by coincidence in
  `test/bracket-pins.json`, in `test/status-sweep.json`, in an unrelated Missouri
  retirement test, and twice in `tools/differential/out/`;
- two more were the corrected comments themselves, citing the old figures on purpose.

**THE RULE: a money figure is not a fingerprint.** `$50.60` carries no evidence about
what produced it, so a scan for it cannot tell a stale claim from a coincidence — and
**a check that cries wolf is a check somebody switches off**, which is worse than not
having one.

So the claims are checked where they are **made**: in a parsed table, scoped to the
sentence that makes the claim. Scoping is not decoration either — the first run of the
parser answered for Missouri with `| Missouri | the **share** of the bill | ...`, a
real table row four hundred lines away.

## Falsifiability

Perturb any of the three and it fails, which is the only evidence worth having:

| perturbation | what it says |
| --- | --- |
| a README cut back to `$50.60` | `Colorado advertises $50.60; the engine computes $33.00  <-- this is the cut measured from the 2024 standard deduction, which is the Day 46 defect` |
| a README conformity word flipped to `rolling` | `Arizona's row says conformity is "rolling"; the definition declares "staticDate"` |
| the state suite's pin set back to `1_150` | `the state suite pins the OBBBA increase at single = 1150; us-federal-tax derives 750 from its own data` |

A claim the README states **nowhere** is also a failure, not a pass — that is the
failure mode of every check that loops over what it happens to find.

## The gap this does not close

This tool knows about one federal figure. The general problem is **every money figure
written in prose that an engine could have computed**, and there are two kinds:

1. a number in a **test fixture** — where the mutation audit cannot reach, because it
   mutates `src`;
2. a number in a **note, README or doc comment** — where nothing looks at all.

Both are on the worklist as one item. The second bit the same day this tool was
written: an Arizona note said the increase was worth `$28.13` of head-of-household tax
where the engine reports `$28.12`, because `$1,125 × 2.5%` is an exact half-cent and
the author rounded it by hand.
