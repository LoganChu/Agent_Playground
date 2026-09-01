# Agent_Playground

A repository worked on by an autonomous agent that runs once a day in a fresh
sandbox. Nothing survives a run except what gets committed here.

## What is in here

| Path | What it is |
| --- | --- |
| [`packages/us-federal-tax`](packages/us-federal-tax) | A zero-dependency US federal tax engine for JavaScript. Income tax, self-employment tax, FICA, capital gains, NIIT, the Section 199A QBI deduction, the SALT cap, the OBBBA Schedule 1-A deductions, quarterly estimated payments, and Publication 15-T paycheck withholding — every figure cited to the IRS release it came from. |
| [`packages/us-tax-mcp`](packages/us-tax-mcp) | The same engine as an MCP server, so an AI assistant can compute tax rather than recall it. Seven tools, zero dependencies, `npx -y us-tax-mcp`. |
| [`STRATEGY.md`](STRATEGY.md) | Why this work and not something else, what was rejected, and the conditions under which the current bet should be abandoned. |
| [`JOURNAL.md`](JOURNAL.md) | Daily log: what was done, what was learned, what to do next. |
| [`NOTES-FOR-HUMAN.md`](NOTES-FOR-HUMAN.md) | The short list of things the agent cannot do itself. |

## us-federal-tax

```bash
cd packages/us-federal-tax
npm install
npm test
```

```js
import { estimateFederalTax, quarterlyEstimatedPayments } from 'us-federal-tax';

const estimate = estimateFederalTax({
  filingStatus: 'single',
  year: 2026,
  selfEmploymentNetProfit: 120_000,
});

estimate.totalTax;             // 32660.36
estimate.selfEmployment.total; // 16955.46
quarterlyEstimatedPayments(estimate).installments;
```

```js
import { computePaycheck } from 'us-federal-tax';

const check = computePaycheck({
  wagesThisPeriod: 3_000,
  filingStatus: 'single',
  payPeriod: 'biweekly',
  year: 2026,
});

check.federalIncomeTax.withholding; // 320.38
check.takeHomeAfterFederal;         // 2450.12
```

See the [package README](packages/us-federal-tax/README.md) for the full API, the
correctness details it handles that most implementations miss, and an explicit list
of what it does *not* cover.

## us-tax-mcp

The same engine, exposed over the Model Context Protocol so an assistant can compute a
tax figure instead of recalling one. Add it to any MCP client:

```jsonc
{
  "mcpServers": {
    "us-tax": { "command": "npx", "args": ["-y", "us-tax-mcp"] }
  }
}
```

Seven tools: `estimate_federal_tax`, `compare_tax_years`, `effective_marginal_rate`,
`quarterly_estimated_payments`, `paycheck_withholding`, `get_tax_parameters` and
`list_supported_years`. Three of them answer questions a bracket table cannot — 2025 was
amended *retroactively* after the IRS had published it, the marginal rate on the next
dollar is routinely double the bracket once credit phase-outs are counted, and what an
employer withholds is a different number from what the return owes.

```bash
cd packages/us-tax-mcp
npm install
npm test
```

See the [package README](packages/us-tax-mcp/README.md) for the tool list, worked
examples, and the same explicit list of what is not covered.

## License

MIT
