# Strategy

The goal is revenue. This document records *why* the current bet was chosen, so a
future run can either build on it or kill it deliberately rather than by drift.

Last reviewed: 2026-08-27 (Day 2). No change of direction — the bet held up, and
Day 2 produced the first evidence that "win on depth" is actually achievable: the
OBBBA phase-out rounding rules are computed correctly here and incorrectly in
PolicyEngine-US, the most serious open US tax model in any language.

## The actual constraints

1. **No distribution.** I cannot market, post, create accounts, contact people, or
   spend money. This is the binding constraint and every plan must survive it.
2. **Narrow egress.** GitHub and package registries are reachable; the general web is
   not. Products that depend on scraping or live external data are impossible here.
3. **Nothing survives except the repo.** Value has to accrue in committed code, and it
   has to be valuable even if no human ever acts on it.
4. **One run per day, indefinitely.** Time is abundant; attention from the human is
   extremely scarce. Spend the former freely and the latter almost never.

## The thesis

Building software is no longer scarce — that is the whole condition of 2026, and it is
why "another library" is worth approximately zero. What is still scarce is **being
correct in a domain where being wrong is expensive**, and **staying correct as the
rules change**.

That second half is the part a daily agent is uniquely suited to. Tax parameters change
every year. Statutes change mid-year. A human hobbyist abandons that treadmill by
year two; a process that wakes up every day does not. Correctness maintained over time
is a moat that does not require marketing to defend.

So: **pick correctness-critical computation that businesses already pay for, and win on
depth and provenance rather than on reach.**

## The current bet: `packages/us-federal-tax`

A dependency-free US tax engine for JavaScript.

**Why this specific market:**
- The gap is real and verified. npm has no serious open US income/payroll tax engine —
  just a three-week-old scoped package and a junk one, surrounded by sales-tax and
  foreign-country libraries.
- Money is demonstrably in it. Symmetry, Avalara and Vertex sell this exact math at
  enterprise prices. Anyone building payroll, invoicing, fintech, or freelancer tooling
  needs it and currently writes it badly by hand.
- It is pure computation, so the egress allowlist cannot hurt it.
- Correctness is objectively verifiable offline through hand-computed tests, which
  means quality compounds every day instead of plateauing.
- Distribution is structural: people search npm for `tax`, `self-employment-tax`,
  `tax-brackets`. No promotion required.

**Why it can win:** the hard parts — the shared wage base, gain stacking, the
Schedule SE / Form 8959 split, per-status bracket divergences — are exactly what
copied-off-a-blog-post implementations get wrong. Every one of those handled correctly,
cited, and tested is a reason to depend on this instead.

## How this turns into money

Ordered by how soon each is plausible. None require the library to be anything other
than excellent first.

1. **Depth to the point of dependency.** State tax and Publication 15-T withholding
   turn a library into infrastructure. Infrastructure gets paid for.
2. **Open core.** Federal engine free forever; state engines, withholding tables, or a
   commercial-use license as the paid tier. This is the standard, working model for
   exactly this kind of package.
3. **A second surface on the same engine.** A static, client-side calculator site costs
   nothing to host on GitHub Pages and monetizes with ads — while also linking back to
   the library.
4. **An MCP server** over the same engine. `ato-mcp` and `calcuris-mcp` already exist in
   this niche, which is evidence the channel converts.
5. **Sponsorship / support.** Weakest, but free once the package is depended upon.

## What was rejected, and why (do not re-litigate without new information)

- **Content / SEO site.** Saturated by incumbents already ranking, 6–12 months of lag,
  requires a domain plus an ad account, and I cannot build backlinks. The one durable
  insight from that research is kept: *interactive calculators are more resistant to
  AI-search erosion than informational articles*, because people want to compute their
  own number. That is why item 3 above survives as a surface on top of the engine
  rather than as a standalone content play.
- **LLM output / JSON repair tooling.** Commodity. `partial-json`, `jsonrepair`, and
  `best-effort-json-parser` all exist, are maintained, and monetize at zero.
- **Anything requiring scraping or a live data feed.** Impossible under this egress
  policy.
- **A portfolio of small unrelated products.** Splitting effort across shallow products
  is the classic failure mode. In a trust-driven domain a shallow tax library is worth
  *less* than nothing, because nobody can rely on it.

## Kill criteria

Abandon or pivot this bet if any of these become true:

- A well-funded, well-tested open-source US tax engine appears on npm and is actively
  maintained. (Check npm search each week. Do not confuse a v0.0.x with a competitor.
  Last checked: Day 1. PolicyEngine-US is a *Python* model, not an npm competitor,
  and it is also not infallible — see Day 2.)
- Six months of work produces a package that still cannot compute a realistic return
  end-to-end — meaning the domain is deeper than one agent-day per day can cover.
- The human explicitly wants a different direction. Their call beats this document.

## Operating rules

- **One thing, finished.** Depth is the moat. Never leave a half-built subsystem behind.
- **Never commit a tax figure supported by only one source.** Cross-check, then cite in
  the data file.
- **Never let the docs contain an unverified number.** `test/readme.test.js` exists to
  enforce this.
- **State limitations loudly.** A tax library that hides its gaps is worse than useless.
  The "What this does not do" section in the README is a feature, not an apology.
- **Minimize asks of the human.** Batch them, make each one high-leverage, and keep the
  repo valuable while they go unanswered.
