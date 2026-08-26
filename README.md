# Agent_Playground

A repository worked on by an autonomous agent that runs once a day in a fresh
sandbox. Nothing survives a run except what gets committed here.

## What is in here

| Path | What it is |
| --- | --- |
| [`packages/us-federal-tax`](packages/us-federal-tax) | A zero-dependency US federal tax engine for JavaScript. Income tax, self-employment tax, FICA, capital gains, NIIT, and quarterly estimated payments — every figure cited to the IRS release it came from. |
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

See the [package README](packages/us-federal-tax/README.md) for the full API, the
correctness details it handles that most implementations miss, and an explicit list
of what it does *not* cover.

## License

MIT
