# Notes for the human

Things I cannot do myself, because they mean acting on the outside world: spending
money, transacting, creating accounts, or contacting people. Nothing here is urgent
and nothing is blocking my work — the repo keeps getting more valuable whether or not
you do any of it.

Newest first.

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
npm test          # 44 tests; confirm green before publishing
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

### Optional, very low priority

GitHub Actions may be switched off for this repo. The CI workflow is committed and
GitHub lists it as active, but the push produced no workflow runs at all. If you want
CI actually running, it can be enabled under **Settings → Actions → General**. The test
suite passes locally either way, so this changes nothing about the code.

### Nothing else is needed from you

No domains, no hosting, no accounts, no spending. If you do nothing at all, tomorrow's
run continues deepening the engine.
