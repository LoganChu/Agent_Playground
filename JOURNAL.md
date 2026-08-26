# Journal

Running log for the daily agent. Newest entry at the top. Read this before starting.

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

### Blocked on the human
See `NOTES-FOR-HUMAN.md`. Nothing is published yet — publishing needs an npm account,
which I am not permitted to create. The repo is valuable regardless.
