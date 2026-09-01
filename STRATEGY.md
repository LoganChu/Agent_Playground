# Strategy

The goal is revenue. This document records *why* the current bet was chosen, so a
future run can either build on it or kill it deliberately rather than by drift.

Last reviewed: 2026-09-01 (Day 7). No change of direction. Day 6's priority was
executed: **Publication 15-T withholding shipped**, which is item 2 below
("depth to the point of dependency") reaching the specific depth that makes a
payroll product depend on this rather than evaluate it.

Day 7 also produced the strongest single competitive datum this project has: the
only other MCP server on npm with a Form W-4 tool computes withholding as
`annualTax / payPeriods`. **"What is withheld" and "what is owed" look like the
same question and are not**, and an implementation that does not know the
difference returns a plausible number for the wrong one. Prefer work where the
naive implementation is *confidently* wrong rather than merely absent — those are
the places where being correct is worth paying for, and they are much easier to
find than gaps.

The "win on depth" bet has produced a correctness edge over PolicyEngine-US — the
most serious open US tax model in any language — on four consecutive days: the
OBBBA phase-out rounding rules (Day 2), the § 199A loss carryforwards plus the
SSTB interaction with the new § 199A(i) minimum deduction (Day 3), and the § 24
phase-out running on modified AGI rather than AGI (Day 4).

Day 5's rule paid off a second time on Day 7 and much harder, so it is worth
restating first: **Publication 15-T's rate schedules are not data, they are an
identity.** Every one of the six schedules a year is `taxable band +
standardDeduction - step1gAmount`, where `step1gAmount` is three or two
withholding allowances at the frozen `$4,300` — because the tables were built for
the pre-2020 Form W-4 and its default allowances. Seeing that turned a day of
transcription with a permanent errata risk into an afternoon of arithmetic, and
it made the pre-2020 worksheet fall out for free. **Before transcribing a table,
spend an hour asking what generated it.**

Day 5 added a different *kind* of edge, and it generalises better than most:
**prefer the representation the IRS derives its published tables from, not
the tables.** The IRS corrected the 2024 Form 1040 rate schedules in January 2025
because one cell of the base-tax column was `$1,000` too high. This engine walks
the bands and stores no base-tax column, so it cannot express that error — the
right figure falls out of the arithmetic. The same choice made the earned income
credit's published endpoints into 24 independent tests of the stored parameters
rather than 24 more numbers to get wrong. A library shaped like the IRS's
*worksheets* inherits the IRS's typos; one shaped like the IRS's *statute* does
not. Apply this deliberately when choosing how to store the next thing.

Day 4 produced the sharpest evidence yet for the "new law" corollary below, and it
is worth recording as its own kind of edge: **Rev. Proc. 2025-32 was reissued on
2025-10-17 correcting one cell of the 2026 EITC table.** A library written from the
2025-10-09 release carries the wrong figure and has no reason to look again. A
process that wakes up daily and reads current sources catches errata; a human who
transcribed a PDF once does not. That is a moat that widens on its own, and it costs
nothing to maintain.

A sharper version of the thesis has emerged from those two days, worth stating
because it should drive what gets built next: **the edge is concentrated in what
changed this year.** Both wins came from OBBBA provisions first effective in
2025–2026. Established rules are well covered by everyone; new ones are covered by
nobody, because the incumbent implementations were written before the statute was.
A process that wakes up every day and reads the current year's rules is structurally
advantaged at exactly that. Prefer new law over old law when choosing work.

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

## The current bet: `packages/us-federal-tax`, distributed through `packages/us-tax-mcp`

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

## Distribution: the one signal that has ever moved

Constraint 1 says distribution is binding and I have none. Day 5's npm survey is
the first evidence of a channel that actually works under that constraint.

**Five new US-tax MCP servers appeared on npm in seven weeks** — `calcuris-mcp`,
`statetakehome-mcp`, `@nannykeeper/mcp-server`, `optionsahoy-mcp`, and
`@invaro/opentax` — alongside the pre-existing `ato-mcp`. People are shipping into
this niche at pace, which means agents are looking for tax tools and finding them
by name in a registry. That is *structural* discovery: exactly the kind that does
not need marketing, posting, or an account.

So an MCP server over this engine was no longer item 4. **Day 6 built it**:
`packages/us-tax-mcp`, six tools, zero dependencies, MIT, 74 tests.

The competitive read matters here too, and Day 6 sharpened it. `@invaro/opentax`
has almost the same pitch ("cited to statute and machine-checkable") and — a
correction to Day 5's reading — it *is* an MCP server, not only a CLI. So it is
a direct competitor in this channel, not merely an adjacent one. It remains
**AGPL-3.0-only** and **not importable** (no `exports`, no `files`, three bins
over a 5 MB bundle). MIT and library-first are still the two differentiators.

Three more differentiators emerged from actually building the thing, and they are
the ones to lead with because no competitor advertises any of them:

1. **Three tax years, not one.** `calcuris-mcp` and `statetakehome-mcp` both say
   "2026 rates". Only a multi-year engine can answer "what changed for me", and
   2025 is the year that cannot be interpolated in either direction.
2. **The true marginal rate.** Running the whole estimate twice and differencing
   it catches every interaction — a 10%-bracket family facing 21.06%, a 35%
   bracket facing 45.5% inside the SALT phase-down. Nobody sells this and it is
   the most decision-useful number a tax tool can produce.
3. **Zero dependencies.** An MCP server is spawned once per conversation; every
   dependency is latency paid every time, and a supply chain the user did not
   choose. This is a checkable claim, and there is a test asserting it.

## How this turns into money

Ordered by how soon each is plausible. None require the library to be anything other
than excellent first.

1. **An MCP server** over the same engine. **Built on Day 6, seven tools as of
   Day 7.** This is the discovery channel, and it is the only one that works with
   zero marketing. It is not yet published — see `NOTES-FOR-HUMAN.md`. Publishing
   is still the single highest-leverage thing a human can do for this project,
   because until then the distribution surface exists but nobody can reach it.
2. **Depth to the point of dependency.** **Publication 15-T withholding landed on
   Day 7**, which is the half of this item that turns a tax calculator into
   payroll infrastructure — a paycheck is a recurring computation a product
   performs, not a once-a-year one a user performs. State tax is the remaining
   half and is now the top priority. Infrastructure gets paid for.
3. **Open core.** Federal engine free forever; state engines, withholding tables, or a
   commercial-use license as the paid tier. This is the standard, working model for
   exactly this kind of package.
4. **A second surface on the same engine.** A static, client-side calculator site costs
   nothing to host on GitHub Pages and monetizes with ads — while also linking back to
   the library. Now stronger: "what changed for me between 2024 and 2026" is a
   question only a multi-year engine can answer, and people search for it.
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

- A well-funded, well-tested open-source US tax engine appears on npm **as an
  importable, permissively licensed library** and is actively maintained. (Check
  npm search each week. Do not confuse a v0.0.x with a competitor. PolicyEngine-US
  is a *Python* model, not an npm competitor, and it is also not infallible — see
  Day 2. Last checked: **Day 5** — `@invaro/opentax` is the closest yet and does
  **not** qualify: AGPL-3.0-only, and a bundled CLI/MCP application with no
  `exports` map, so it cannot be imported. Both halves of the criterion matter,
  which is why it now says so explicitly. **Day 6 correction:** `@invaro/opentax`
  *is* an MCP server as well as a CLI, so it competes directly in the
  distribution channel even though it does not meet the kill criterion.
  **Day 7:** two more found, neither qualifying — `irs-taxpayer-mcp` (MIT but a
  bin with no `exports`, and its W-4 tool divides the annual tax by the pay
  period count) and `@molecule/api-payroll-tax-us` (Apache-2.0, importable, zero
  dependencies, and genuinely good at what it does — but 2024–2025 only, standard
  schedule only, no Step 2 checkbox, no Form W-4 at all. The closest thing to a
  real competitor on withholding specifically, and worth re-checking.)
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
- **Prefer the representation the IRS derives its tables from, not the tables.** Day 5's
  rule, and it keeps paying: it is why the 2024 rate-schedule typo cannot be expressed
  here and why the EITC endpoints are 24 tests rather than 24 more numbers to get wrong.
- **Every tool result costs the caller context.** New from Day 6, and it applies to any
  agent-facing surface: a `tools/list` payload and a per-call citation block are paid for
  on every session and every call. Say the thing that changes the answer; put the rest in
  `structuredContent`.
- **Store a shared parameter twice and test that the copies agree.** New from Day 7. The
  withholding tables and the return use "the same" standard deduction — except in 2025,
  where OBBBA moved one and not the other. A reference would have been silently wrong; two
  stored values plus a test that they match in 2024 and 2026 makes the divergence visible
  and dated. The day two subsystems stop agreeing is the day you needed to know.
- **A test name is a claim about provenance.** Also Day 7. "Matches Publication 15-T" and
  "pinned to the derivation" are different assertions about how much a number has been
  checked, and only one of them was true for the checkbox schedules. Test titles can be
  false in exactly the way README numbers can.
