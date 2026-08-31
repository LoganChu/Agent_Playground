# us-tax-mcp

**US federal tax as an MCP server.** Six tools that compute income tax, self-employment
tax, FICA, capital gains, NIIT, the child tax credit and EITC, the Section 199A deduction,
the SALT cap and quarterly estimated payments — for **tax years 2024, 2025 and 2026** —
entirely offline, with every figure cited to the IRS release it came from.

- **Zero dependencies.** Nothing to install but this package. An MCP server is spawned once
  per conversation; every dependency is latency the user pays each time.
- **MIT.** Usable in a commercial product.
- **Deterministic and offline.** No API key, no network call, no rate limit. The same inputs
  give the same answer forever.
- **Three tax years, not one** — which is what makes "what changed for me" answerable.

```jsonc
// claude_desktop_config.json, .mcp.json, or your client's equivalent
{
  "mcpServers": {
    "us-tax": {
      "command": "npx",
      "args": ["-y", "us-tax-mcp"]
    }
  }
}
```

That is the whole setup. `npx -y us-tax-mcp` needs Node 18 or later and nothing else.

---

## Why this rather than the model's own knowledge

A language model asked "what will I owe on $95,000 of 1099 income" will produce a number.
It will usually be wrong, and it will always be confident. Three reasons, all of which this
server fixes:

**1. 2025 was changed retroactively, and the training data is split.** The One Big Beautiful
Bill Act was signed on 4 July 2025 and amended tax year 2025 *after* the IRS had already
published that year's parameters in Rev. Proc. 2024-40. Four figures were superseded:

| | Rev. Proc. 2024-40 said | Actually true for 2025 |
| --- | --- | --- |
| Standard deduction | $15,000 / $30,000 / $22,500 | **$15,750 / $31,500 / $23,625** |
| SALT cap | $10,000 | **$40,000**, phasing down above $500,000 |
| Child tax credit | $2,000 | **$2,200** |
| Schedule 1-A deductions | did not exist | **all four live** |

And two OBBBA changes are explicitly *not* retroactive — the § 199A phase-in range and the
§ 199A(i) minimum deduction both start in 2026 — so copying 2026's rules backward is wrong
in the other direction. **There is no year adjacent to 2025 that you can safely edit into
it.**

**2. The tax bracket is usually not the marginal rate.** Ask "what does a $1,000 raise
cost me" and the honest answer is frequently double the bracket:

| Filer | Bracket | What another $1,000 actually costs |
| --- | --- | --- |
| Head of household, 2 children, $30,000 | 10% | **21.06%** |
| Head of household, 1 child, $45,000 | 12% | **27.98%** |
| Joint, $560,000, $60,000 of state tax | 35% | **45.5%** |

The first row is the striking one: the child tax credit absorbs the entire income tax at
both incomes, so the bracket is invisible and the whole marginal cost is earned income
credit withdrawal. `effective_marginal_rate` measures this by running the full estimate
twice and differencing it, so it cannot miss an interaction.

**3. The IRS issues errata, and a model trained on a cached PDF carries them.** Two of the
tables this server uses were corrected after first publication, and both corrections are
carried here:

- The **2024 Form 1040 rate schedules** were corrected on 8 January 2025. Married filing
  separately, taxable income over $365,600: the tax is **$98,334.75** + 37%, not the
  $99,334.75 that was printed. This engine cannot reproduce the error even in principle —
  it stores no base-tax column and walks the bands instead, so the corrected figure is
  *derived*.
- **Rev. Proc. 2025-32 was reissued on 17 October 2025**, correcting the 2026 EITC completed
  phase-out for a joint return with three or more children from $70,224 to **$70,244**.

---

## The tools

| Tool | What it answers |
| --- | --- |
| `estimate_federal_tax` | "What do I owe?" "What's my refund?" A complete Form 1040 picture for one household and one year. |
| `compare_tax_years` | "How does 2026 compare to 2025?" "What did OBBBA do to my return?" The same household run through every year, with the provisions that moved named. |
| `effective_marginal_rate` | "Should I take the raise?" "What will this bonus cost me?" The true cost of the next dollar, decomposed. |
| `quarterly_estimated_payments` | "What do I send the IRS each quarter?" The IRC § 6654 safe harbors and four dated installments. |
| `get_tax_parameters` | "What are the 2026 brackets?" Every published figure for a year, cited. |
| `list_supported_years` | What is covered, what is **not** covered, and where each year's numbers came from. |

Every tool is read-only, touches nothing outside the process, and returns both a
human-readable text block and machine-readable `structuredContent`.

### What it looks like

> **Head of household, two children, $30,000 of wages, 2026.**

```
Gross income                            $30,000.00
Deduction (standard)                    $24,150.00
Taxable income                           $5,850.00

Ordinary income tax                        $585.00

Child tax credit (§ 24)                  $4,400.00
  applied against income tax               $585.00
  refundable (ACTC)                      $3,400.00
  unused (neither offset nor paid)         $415.00
Earned income credit (§ 32)              $6,029.23

Total tax                                    $0.00
REFUND                                   $9,429.23

Marginal ordinary rate (bracket)               10%
```

> **The same household, `effective_marginal_rate`.**

```
Ordinary tax bracket                           10%
TRUE MARGINAL RATE                          21.06%
Cost of the extra income                   $210.60
You keep                                   $789.40

Where it goes:
  Ordinary income tax                      $100.00
  Earned income credit withdrawn           $210.60
```

The components always sum exactly to the cost — there is a test for it. Here the income tax
rises by $100 and the child tax credit grows by $100 to absorb it, so the entire net cost is
EITC withdrawal at the § 32 phase-out rate.

---

## Correctness

The engine underneath is `packages/us-federal-tax` in the same repository: **238 tests**
against hand-computed figures, every parameter cross-checked against two independent
sources. This package adds **62 more** covering the protocol and the tool layer.

Some things it gets right that comparable implementations do not:

- **The four OBBBA phase-outs disagree with each other, and that is deliberate.** § 224
  (tips) and § 225 (overtime) reduce by $100 for each **full** $1,000 of excess — $999 over
  the threshold costs nothing. § 163(h)(4) (vehicle loan interest) says "or portion
  thereof", so **one dollar** over costs a full $200. The senior deduction is a continuous
  6%. PolicyEngine-US — the most serious open US tax model in any language — models the
  first two as a flat 10%, which is right on exact multiples of $1,000 and wrong everywhere
  else.
- **A non-refundable credit cannot reduce self-employment tax.** SE tax, NIIT and the
  Additional Medicare Tax are not chapter 1 subchapter A liabilities. A head-of-household
  filer with $30,000 of Schedule C profit and one child owes $373.06 of income tax and
  $4,238.87 of SE tax; the credit erases the first and none of the second. Netting credits
  against one "total tax" figure gets that wrong in the filer's favour.
- **The § 24 phase-out rounds up.** "$50 for each $1,000 **or fraction thereof**" — a joint
  filer at $400,001 loses $50, not five cents.
- **Earned income for both credits is net of half of self-employment tax** (§ 32(c)(2)(A)(ii),
  via § 164(f)). Using gross profit overstates the credit while it phases in and
  *understates* it once the phase-out starts — a bug that changes sign, which is very hard
  to catch by sampling.
- **The EITC joint-filer add-on is not a constant.** The IRS rounds the resulting sum to the
  nearest $10 rather than the addend, so for 2026 it is $7,280 with no children and $7,270
  with children. Storing one value misplaces one of the two tables by $10 of income.
- **The § 24 and § 164(b)(6) phase-outs run on *modified* AGI**, not AGI — AGI plus income
  excluded under § 911, § 931 and § 933.

## What is not modelled

Stated here and by `list_supported_years`, because a model that cannot see the gaps will
confidently fill them in.

- **Alternative minimum tax (§ 55).** A filer who owes AMT owes more than this reports.
- **State and local income tax** — only the federal deduction for it.
- **The new § 68 overall limitation on itemized deductions** (OBBBA § 70111, first effective
  2026). Its formula needs the § 199A deduction, and § 199A needs taxable income, which
  needs itemized deductions after § 68 — a genuine fixed point the statute does not resolve.
  Rather than invent an ordering the IRS has already chosen differently, it is left out and
  bounded: above $640,600 ($768,700 joint), an itemizer's deduction is overstated by at most
  2/37 — 5.4% — of it. Everyone below is unaffected.
- **The 0.5%-of-AGI charitable floor** (OBBBA § 70425) and the 7.5%-of-AGI medical floor.
  `otherItemizedDeductions` is taken as given.
- **Education credits, the § 21 dependent care credit, the saver's credit, the premium tax
  credit, energy credits, the foreign tax credit, and business credits.**
- Trust, estate and corporate returns; part-year and non-resident returns.

**This computes tax. It is not tax advice**, and it is not a substitute for a return
preparer. See the licence for the full disclaimer of warranty.

---

## Using it as a library

The tools are also importable, so they can be mounted inside a server you already run.
`handleMessage` is a pure function from a decoded JSON-RPC message to a response — no hidden
state, no I/O.

```js
import { handleMessage, TOOLS, estimateFederalTax } from 'us-tax-mcp';

// The MCP layer:
handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

// Or the engine directly — the whole of `us-federal-tax` is re-exported:
estimateFederalTax({ filingStatus: 'single', w2Wages: 95000, year: 2026 });
```

## Protocol notes

Speaks MCP over stdio, negotiating `2026-07-28`, `2025-11-25`, `2025-06-18`, `2025-03-26`,
`2024-11-05` and `2024-10-07`; an unrecognised version is answered with `2025-11-25` rather
than failing the handshake.

The server is **stateless**: `tools/list` and `tools/call` are answered whether or not
`initialize` was sent first. That is the direction the protocol moved — the 2026-07-28
revision removes the handshake and the session it established — while older clients still
perform it. One implementation serves both.

## Licence

MIT. Copyright (c) 2026 Logan Chu.
