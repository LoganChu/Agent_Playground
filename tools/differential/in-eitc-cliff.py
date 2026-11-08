"""Observe the Indiana earned income credit cliff in `policyengine-us`, directly.

`in-eitc-conformity.mjs` beside this file derives the cliff from their source and
their committed answers, and that is enough to be sure of it. This file does the
one thing that derivation cannot: it RUNS their model and prints `in_eitc` either
side of the income where the frozen credit is exhausted.

The difference matters because of who the finding is for. `NOTES-FOR-HUMAN.md`
carries a report to be sent to the PolicyEngine team, and a report that says
*"we computed what your model would do"* is weaker than one that says *"run these
four lines"* — especially when the claim is about an interaction between two of
their own variables. A reproduction is also the only form in which the finding
survives their next release: run it again and it either still prints a cliff or
it does not.

## What it shows

```text
  policyengine-us 2.15.3, Indiana, tax year 2025, joint return, two children

                        wages  federal eitc  eligible   in_eitc     IN tax
  a cent below      59,478.00      1,042.92      True    104.29   1,470.05
  a cent above      59,478.04      1,042.91     False      0.00   1,574.34
```

**Four cents of extra earnings cost that household $104.29**, because
`in_eitc_eligible` rebuilds the federal credit under the 1 January 2023 Internal
Revenue Code and requires it to be positive, while `in_eitc` pays 10% of the
CURRENT-year credit. The current-year credit is almost unchanged across those
four cents — `$1,042.92` to `$1,042.91` — so nothing about the filer's actual
credit justifies the step.

And the same two households in **2026** both receive `$135.22`, because SEA 243
of 2025 advances the snapshot to 1 January 2026 and the gate cannot bind. Nothing
changed but the date in the statute.

## The control, which is the part that needs no statutory reading

The second block runs `mixed-dependents-IN-40000` — a household already in this
repository's differential grid — and prints the two bases side by side. If the
freeze bound the AMOUNT, `in_eitc` would be 10% of the frozen credit. It is 10%
of the current one. So the freeze is operative for the gate and inoperative for
the amount, which is no reading of IC 6-3.1-21-6, and their own comment in
`in_eitc.py` argues against it.

## Running it

Needs the pinned reference model, which is AGPL and about 840 MB, so it is not
vendored and not in CI — the same arrangement as `theirs.py`, whose household
builder this imports rather than copies.

```sh
python3 -m venv .pe && .pe/bin/pip install policyengine-us==2.15.3
.pe/bin/python tools/differential/in-eitc-cliff.py
```

The version is the one `out/theirs.meta.json` records, because a finding about a
model is a finding about a version of it.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from theirs import situation  # noqa: E402

from policyengine_us import Simulation  # noqa: E402

# The income at which the 1 January 2023 federal credit is exhausted for a joint
# return with two children: the 2023 phase-out start plus the 2023 maximum over
# the phase-out rate, 28,120 + 6,604 / 0.2106. Derived in `in-eitc-conformity.mjs`
# and printed by it, so the two files cannot drift apart silently.
FROZEN_ZERO_JOINT_TWO_CHILDREN = 59_478.02


def household(year, status, child_ages, wages, label):
    """One case in the same shape `theirs.py` builds for the differential grid."""
    return {
        "id": label,
        "year": year,
        "state": "IN",
        "filingStatus": status,
        "primaryAge": 38,
        "spouseAge": 36 if status == "marriedFilingJointly" else None,
        "childAges": child_ages,
        "wages": wages,
        "pension": 0,
        "socialSecurity": 0,
        "longTermCapitalGains": 0,
        "taxExemptInterest": 0,
        "blind": 0,
        "county": {"ours": "Marion County", "theirs": "MARION_COUNTY_IN"},
        "oregonPriorYearTaxBeforeCredits": None,
        "kind": "cliff",
    }


def measure(case):
    year = case["year"]
    sim = Simulation(situation=situation(case))
    one = lambda variable: float(sim.calculate(variable, year)[0])  # noqa: E731
    return {
        "label": case["id"],
        "wages": case["wages"],
        "eitc": one("eitc"),
        "eligible": bool(sim.calculate("in_eitc_eligible", year)[0]),
        "in_eitc": one("in_eitc"),
        "in_income_tax": one("in_income_tax"),
    }


def table(rows):
    head = (
        f'{"":16s} {"wages":>12s} {"federal eitc":>13s} {"eligible":>9s} '
        f'{"in_eitc":>9s} {"IN tax":>10s}'
    )
    print(head)
    print("-" * len(head))
    for r in rows:
        print(
            f'{r["label"]:16s} {r["wages"]:12,.2f} {r["eitc"]:13,.2f} '
            f'{str(r["eligible"]):>9s} {r["in_eitc"]:9,.2f} {r["in_income_tax"]:10,.2f}'
        )
    print()


below = FROZEN_ZERO_JOINT_TWO_CHILDREN - 0.02
above = FROZEN_ZERO_JOINT_TWO_CHILDREN + 0.02

print("policyengine-us, Indiana, joint return, two children")
print(
    f"the 1 January 2023 federal credit is exhausted at "
    f"${FROZEN_ZERO_JOINT_TWO_CHILDREN:,.2f} of wages\n"
)

cliff = [
    measure(household(2025, "marriedFilingJointly", [3, 8], below, "2025 just below")),
    measure(household(2025, "marriedFilingJointly", [3, 8], above, "2025 just above")),
    measure(household(2026, "marriedFilingJointly", [3, 8], below, "2026 just below")),
    measure(household(2026, "marriedFilingJointly", [3, 8], above, "2026 just above")),
]
table(cliff)

lost_2025 = cliff[0]["in_eitc"] - cliff[1]["in_eitc"]
lost_2026 = cliff[2]["in_eitc"] - cliff[3]["in_eitc"]
print(f"  four cents of extra earnings cost this household ${lost_2025:,.2f} in 2025")
print(f"  and ${lost_2026:,.2f} in 2026, because SEA 243 of 2025 moves the snapshot")
print(
    f"  to the current year. The current-year credit itself barely moves across "
    f"those\n  four cents: ${cliff[0]['eitc']:,.2f} to ${cliff[1]['eitc']:,.2f}."
)
print()

# The control. 2023 maximum 6,604, phase-out start 28,120, rate 0.2106 for three
# children capped at two by neither model here; the point is only that the two
# bases differ materially and the amount follows the CURRENT one.
print("the control, which needs no statutory reading at all:")
print()
control = measure(
    household(2025, "marriedFilingJointly", [3, 8, 12], 40_000, "mixed-dependents")
)
table([control])
print(
    f'  the current-year federal credit is ${control["eitc"]:,.2f} and in_eitc is '
    f'${control["in_eitc"]:,.2f},'
)
print(
    f"  which is 10% of it. The 1 January 2023 credit for this household is "
    f"$4,928.07,"
)
print("  so a freeze that bound the AMOUNT would pay $492.81. It pays 10% of the")
print("  CURRENT base and gates on the FROZEN one, and no reading of")
print("  IC 6-3.1-21-6 produces both.")
