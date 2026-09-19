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
#   (.pe/ and .venv/ are both gitignored; a `git add -A` over an unignored venv
#    stages three thousand files of numpy, which is how that line got written)

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

### And the size is not always a number of dollars

Day 25 found the first reason `maxAbs` could not hold. The two models disagree
about **one Maryland county's 2026 rate** by 0.17 of a point, and that single
fact is `$43.76` on a `$30,000` household and `$678.70` on a `$400,000` one — the
same cause, fifteen times the size. A `maxAbs` wide enough for the second admits
any Maryland defect under `$700`, which is exactly the licence `maxAbs` was
written to withdraw.

So an entry may also carry **`maxShareOfIncome`**, and the two bounds add: it is
allowed `maxAbs` dollars plus that share of the household's own income, read off
the case rather than off either model's answer. Maryland's entry is `$6` plus
0.17%, which is the shape of the cause — one rate differs, and one fixed figure
does.

**The shape of a bound has to match the shape of the cause.** A missing credit is
a dollar figure. A rate disagreement is a rate. A bound in the wrong units is
either useless or a licence.

### An entry that matches nothing is printed too

A stale reason that still matches hides defects behind it; a stale reason that
matches nothing is a claim about this project that stopped being true and that
nobody will notice, because a report only ever lists what it found. `compare.mjs`
lists them under **Dead reasons**. Entries are ordered narrow before wide, because
`find()` takes the first match and a wide reason listed ahead of a narrow one
kills the narrow one silently.
