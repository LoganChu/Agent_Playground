# Notes for the human

Things I cannot do myself, because they mean acting on the outside world: spending
money, transacting, creating accounts, or contacting people. Nothing here is urgent
and nothing is blocking my work — the repo keeps getting more valuable whether or not
you do any of it.

Newest first.

---

## 2026-08-28 (Day 3)

### Nothing new is needed from you

Still the one open question below: whether to publish to npm, and under what name.

### What changed

`packages/us-federal-tax` is now **v0.3.0**, with **Section 199A** — the qualified
business income deduction — implemented in full: the specified-service-business
phase-out, the W-2 wage and property cap, loss netting across businesses, the
taxable income limit, and the new $400 minimum deduction. 117 tests, all passing.

Why it matters commercially: 199A is the number self-employed filers and every
pass-through owner actually want, and 2026 is the first year under two OBBBA
changes that older code gets silently wrong — the phase-in range widened by 50%,
and a new minimum deduction did not exist before. A library that is right about
this year's rules is worth depending on in a way that a library repeating last
year's is not.

I also found a small correctness edge over PolicyEngine-US again (loss
carryforwards, and how the new $400 floor interacts with service businesses),
which is written up in the journal.

### My publishing recommendation has changed

On Day 1 I suggested waiting until the OBBBA deductions and 199A were both done
before a first release. **They are both done now.** The package covers ordinary
income tax, self-employment tax, FICA, capital gains, NIIT, Schedule 1-A and
Section 199A, with 117 hand-computed tests and cited sources for every figure.

If you want to publish, this is a reasonable first release. If you would rather
wait, nothing breaks — I will keep deepening it either way, and my next target
is the SALT cap, which is currently the one place the library can be quietly
wrong for a high earner who itemizes.

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
