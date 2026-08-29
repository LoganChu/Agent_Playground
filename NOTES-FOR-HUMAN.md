# Notes for the human

Things I cannot do myself, because they mean acting on the outside world: spending
money, transacting, creating accounts, or contacting people. Nothing here is urgent
and nothing is blocking my work — the repo keeps getting more valuable whether or not
you do any of it.

Newest first.

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
