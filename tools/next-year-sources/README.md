# A published next year, in a source this sandbox can actually reach

Day 86 left the main line as *"the thirty, as each publishes, December to
February"*, and the instruction to ask **"is its 2027 already law?"** rather than
*"has it published?"*. It also priced the problem honestly: that is one web
search per state, twenty-seven of thirty answers are *no*, and **a `no` teaches
nothing**, so the next run pays for the same thirty searches again.

This makes the screen local, free and repeatable.

## The thing nobody had noticed about this sandbox's network

`DO-THIS.md` item 0 says *"the environment's network allowlist is empty, so every
outbound fetch fails."* The first half is true and **the second half is not**:

```text
  api.github.com        200
  registry.npmjs.org    200
  pypi.org              200
  www.irs.gov           403      law.lis.virginia.gov     403
  kslegislature.gov     403      budget.lis.virginia.gov  403
  dor.georgia.gov       403      www.nysenate.gov         403
  raw.githack.com       403      cdn.jsdelivr.net         403
  aspe.hhs.gov          403      www.federalregister.gov  403
```

Package registries are reachable because the environment allows package
managers, which is a different setting from the host allowlist. **Day 82 already
used this** — the federal 2027 figures in `packages/us-federal-tax/src/data/2027.ts`
cite the page of `rp-26-35.pdf` behind each one, read out of `policyengine-us`'s
parameter metadata rather than out of a PDF this sandbox cannot open. Nobody had
pointed the same trick at the **thirty states**.

## What this is not

**It produces no figure this project may ship.** Day 27's rule is not repealed:
*a second model agreeing is not a source.* What is usable is the **citation** —
the bill number, the appropriation act item, the booklet page — which converts
"search thirty states" into "read one named document", and a figure still needs
two independent chains before it enters the engine.

## The two distinctions that make this a tool and not a `grep`

**TRANSCRIBED against UPRATED.** PolicyEngine projects future values with its own
inflation model. An uprated 2027 is a **forecast**, and shipping one as law would
be the worst error available here, so it is reported in its own section and never
in the worklist.

**Dated exactly 2027 against dated later.** Most future-dated values in that tree
are sunsets — Virginia's standard deduction reverting in 2030, Oregon's child
credit lapsing in 2029. They say nothing about 2027. They are kept in a separate
section because a sunset inside the horizon is a fact a buyer of a multi-year
subscription should know.

## Running it

```sh
pip download --no-deps policyengine-us          # 25 MB; pypi.org is allowed
unzip -q policyengine_us-*.whl -d /tmp/pe
python3 -I tools/next-year-sources/scan.py \
    --parameters /tmp/pe/policyengine_us/parameters/gov/states \
    --year 2027 --version "$(ls /tmp/pe/*.dist-info -d | sed 's/.*-\([0-9.]*\)\.dist-info/\1/')" \
    --states "$(node tools/next-year-sources/refused.mjs)" \
    --out tools/next-year-sources/out
```

`--states` comes from `refused.mjs`, which reads the registry, so the question
asked here can never drift from the question the engine is actually facing. A
list typed twice is a list that disagrees with itself.

## What CI checks, and what it deliberately does not

Every other generated report in this repository is regenerated in CI and compared
byte for byte. **This one is not**, and that is a decision rather than an
omission: it needs a 25 MB download from `pypi.org`, and a CI job has no business
going red because another project cut a release.

What *is* checked on every push, by `refused.mjs --check`, is the **question** —
that the committed scan asks about exactly the states the registry refuses today,
for the engine's latest year. So the answers may go stale and **the subject
cannot**, which is the half that would mislead a reader. The day a state starts
serving 2027, this check goes red and says which state the scan is now wrong
about.

## Two bugs this scanner shipped with, both the same bug

Recorded because they are the day's own lesson arriving twice.

1. `isinstance(key, str)` — PyYAML had already parsed `2027-01-01` into a
   `datetime.date`, so **no date map was found anywhere**, and the first run
   reported *"a transcribed 2027 value exists for: none"* with Virginia's
   `2027-01-01: 18_400` sitting in the tree.
2. `yaml.safe_load` raising `year 0 is out of range` on PolicyEngine's
   open-ended `0000-01-01:` convention. The per-file `except` carried on in
   silence and **19 files across 13 states were skipped** — California's five
   rate schedules, the Massachusetts surtax, Kansas's zero-tax threshold,
   Missouri's capital-gain rate — and those states came out of the summary as
   *"only an uprated value"*, a sentence about a projection rather than about a
   file nobody could open.

> **THE RULE: AN INSTRUMENT THAT CANNOT READ ITS INPUT REPORTS ABSENCE, AND
> ABSENCE READS EXACTLY LIKE A FINDING.** Both were found by asking why a state
> I had read with my own eyes was missing from my own output. The fix for the
> second — a loader with the timestamp resolver removed — fixes the first as
> well, and the scanner now exits non-zero if any file is unreadable, because a
> gap must not be able to look like a `no`.
