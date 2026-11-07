# Indiana's earned income credit, and the three cases it accounts for

**Status: researched, bounded, and deliberately NOT yet entered in
`known-divergences.json`.** The bar for entering it is at the bottom. Written
Day 74.

## Where this came from

`tools/audit/against-policyengine.mjs` ran the buyer-facing audit over all 2,904
differential households with `policyengine-us`'s own figures in the buyer's
column. Three of the **sixteen** differences `tools/differential/REPORT.md` has
carried under "Unexplained" came back with the same account, and nothing else in
the sixteen did:

```text
  2025-couple-two-children-IN-60000    PolicyEngine $2,660.60   here $2,567.30   $93.30
  2025-couple-no-children-IN-25000     PolicyEngine $1,154.60   here $1,145.32    $9.28
  2025-on-the-boundary-IN-50000        PolicyEngine $2,334.30   here $2,327.37    $6.93
```

In each one PolicyEngine's Indiana figure is **exactly this engine's answer with
the Indiana earned income credit not applied.**

## What is settled, from evidence in this repository

**The two models agree on the FEDERAL credit, to the cent.** This is the fact
that decides what the divergence is about, and it is read straight out of the two
committed answer files rather than inferred:

```text
  case                                   PolicyEngine fed EIC   here      10% of it
  2025-couple-two-children-IN-60000              $932.98      $932.98      $93.30
  2025-couple-no-children-IN-25000                $92.85       $92.85       $9.29
  2025-on-the-boundary-IN-50000                   $69.33       $69.33       $6.93
```

So this is **not** a federal disagreement leaking into a state line, which is
what most of this file's existing entries are. Both sides have the same § 32
figure in hand. One of them then takes 10% of it for Indiana and the other takes
nothing.

**This package's Indiana credit is 10% of the federal credit passed to it**, and
`flat-states.ts` already says so, with the caveat that matters here written into
the shipped note:

> The Indiana earned income credit is 10% of a federal credit the filer never
> claimed. IC 6-3.1-21-6 computes it under the Internal Revenue Code as of a
> **FROZEN date** — 1 January 2023 for tax years 2023 to 2025, and 1 January 2026
> from tax year 2026 (SEA 243 of 2025) — and substitutes Indiana's own investment
> income limit of **$3,800**, which has not moved since 2022. **This package
> applies the 10% match to whatever federal credit you pass, so an Indiana filer
> near either limit is overstated.**

**And the $3,800 investment-income limit cannot be the cause here.** All three
cases carry `0` of interest, dividends and capital gains — the trailing
`-0-0-0-0` in the ids is the grid's own record of that. So of the two documented
mechanisms by which this package overstates the credit, only the **frozen Code
date** is available.

## What is NOT settled, and why the entry is not written yet

**Whether PolicyEngine models this credit at all, or models it and gets zero.**
Those are different facts and they want different `reason` text:

- If it models **no** Indiana earned income credit, this belongs with the
  `NOT MODELLED THERE` entries — the Virginia and Ohio municipal-interest
  additions — and this package is the better of the two.
- If it models the credit **under the frozen Code** and reaches zero at these
  incomes, then **this package is the wrong one**, by exactly the caveat its own
  note publishes, and the entry has to say so and point the other way. It would
  then be the same shape as the Oklahoma frozen-EITC divergence this repository
  already ships a cross-package check for.

**Nothing in the two committed answer files can distinguish them**, because a
credit modelled to zero and a credit not modelled produce the same number. The
grid records a state tax and a federal EIC and not a state credit breakdown for
the other side.

**What would settle it, in order of cost:**

1. `policyengine_us/parameters/gov/states/in/tax/income/credits/` in the pinned
   sdist. `tools/differential/theirs.py` already fetches that sdist from PyPI,
   and Day 73 recorded `pypi.org` as a host that answers from this sandbox. If a
   parameter for an Indiana earned income credit exists, read its rate and its
   federal base; if the directory has none, the question is answered.
2. IC 6-3.1-21-6 itself, for whether the frozen Code date reaches the
   **inflation adjustments** of § 32 or only its text. At $60,000 with two
   children a couple sits inside the 2025 phase-out and outside the 2023 one, so
   this is the whole question for the largest of the three cases.

## The bound, derived from the provision rather than from the data

Whichever way it resolves, the entry's `maxAbs` is **10% of the largest federal
earned income credit any Indiana case in this grid carries** — not 10% of the
largest difference currently observed, which is how a bound becomes a ratchet.
`requireEveryReasonBounded` in `compare.mjs` exists to refuse an entry without
one, and `maxAbs` is what stopped Ohio's $20-per-exemption entry from absorbing a
$275 municipal-interest addition on Day 32.

Compute it rather than copying `$93.30` from the table above: the grid's Indiana
cases may include a household with a larger federal credit whose state figures
happen to agree today.

## The bar for shipping this

**All three of these, and the entry does not go in until they are met:**

1. **The question above is answered** — PolicyEngine's Indiana parameters read,
   or the statute read, so the `reason` states which engine is wrong rather than
   describing a difference.
2. **`maxAbs` is computed from the provision** over the grid's Indiana cases, not
   from the three differences observed.
3. **If the answer is that this package is wrong**, the entry is the *second*
   thing written, not the first: the engine is fixed, a test pins the frozen-base
   behaviour, and the divergence entry then records the part that remains. An
   entry that makes a known defect stop being reported is a defect with a
   silencer on it.

> **AND ONE THING TO WATCH WHEN IT IS WRITTEN.** Entering it moves three cases
> from "the human could not explain this" to "the human explained this", which
> **changes the headline of `tools/audit/out/AGAINST-POLICYENGINE.md` and the
> three-of-sixteen figure quoted in `OFFER.md`, `JOURNAL.md` and
> `tools/audit/README.md`.** That is correct — the audit's score against the
> human verdict should fall when the human catches up — but it has to be done
> deliberately and in all four places, or the repository will publish a count
> nothing produces any more. This is why the entry was not written on the day the
> finding was made: Day 74's own measurement was the evidence for it, and
> restating the measurement in the same hour would have left no record of what
> the tool actually found.
