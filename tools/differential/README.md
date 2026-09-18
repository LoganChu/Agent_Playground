# Differential test against PolicyEngine-US

Twenty-two days of this project used [PolicyEngine-US](https://github.com/PolicyEngine/policyengine-us)
as a **parameter** reference: clone it, read the YAML, check a figure against a
statute cite. This runs it as a **model** instead — the same households through
both engines, every answer compared to the dollar.

The difference is the whole point. A parameter check tells you the number you
stored is the number they stored. Running both models tells you whether the two
*computations* agree, which is where every interesting error lives: the ordering
of credits, which income a phase-out reads, what a state does with a figure it
inherits from a federal return. Nothing in a parameter file has an opinion about
any of that.

## What it is

Four pieces, deliberately separate so that a disagreement can never be a
disagreement about the question:

| file | what it does |
| --- | --- |
| `cases.mjs` | generates the households — the single source of the grid |
| `ours.mjs` | runs `us-federal-tax` and `us-state-tax` over them |
| `theirs.py` | runs PolicyEngine-US over the same JSON |
| `compare.mjs` | joins the two and reports every difference over a dollar |
| `known-divergences.json` | the differences that have a recorded reason |

Both runners read the **same** `out/cases.json`, so neither side can quietly
answer a different question from the one the other was asked.

A case may contain only facts that map onto a PolicyEngine variable without
interpretation — a wage, a pension distribution, a Social Security benefit, a
long-term gain, tax-exempt interest, and the ages of the people in the house.
Itemised deductions, businesses and localities are left out: a disagreement
about one of those would be a disagreement about this harness.

## Running it

```bash
# Build both engines first — the harness imports the compiled ESM.
(cd packages/us-federal-tax && npm ci && npm run build)
(cd packages/us-state-tax   && npm ci && npm run build)

python3 -m venv .pe && .pe/bin/pip install policyengine-us   # ~2 minutes, offline after

node   tools/differential/cases-to-json.mjs > tools/differential/out/cases.json
node   tools/differential/ours.mjs          > tools/differential/out/ours.json
.pe/bin/python tools/differential/theirs.py tools/differential/out/cases.json \
                                            > tools/differential/out/theirs.json
node   tools/differential/compare.mjs       > tools/differential/REPORT.md
```

The PolicyEngine pass is the slow one — about a second a household, so ten
minutes for the grid. It needs no network once installed: a `Simulation` built
from a situation dict downloads nothing.

`out/` holds the two models' raw answers and is committed, so a future run can
diff today's report against yesterday's without re-running either side.

## Reading the report

Every difference is either **explained** — matched by an entry in
`known-divergences.json`, which has to give a reason — or **unexplained**, and
unexplained differences are printed first and largest-first.

An unexplained difference is not a bug in this project. It is a question, and it
has three possible answers: this package is wrong, PolicyEngine is wrong, or the
statute is ambiguous and the two readings are both defensible. All three have
happened here. What the harness buys is that the question gets **asked**, on 437
households at a time, instead of waiting for someone to notice.

When one is resolved, it moves into `known-divergences.json` with the reason, so
the next run's report is about what is new rather than about what is known.

## A reason has to state its size

An entry may carry `maxAbs`, and from Day 24 most of them do. A difference
larger than that is reported as **unexplained** however well the rest of the
entry matches.

This is not tidiness. On the morning of Day 24 four entries here said, in
effect, "the caller has to supply the pension" — and the engine had started
supplying it itself the hour before, so what those entries were actually
matching was everything ELSE that disagreed in those four states. Behind one
sentence about pensions sat an Illinois child tax credit nobody on this project
had heard of, a Michigan exemption figure, a New York credit PolicyEngine does
not model, and a North Carolina child deduction. The report called all four
**explained**.

So a reason now claims a size as well as a cause, and the report fails loudly in
the one direction that matters: a known small gap growing into an unknown large
one. **A divergence entry matched on a state alone is a licence to be wrong
about that state in any way at all.**
