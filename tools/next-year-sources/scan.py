"""Which refused state-years already have a published figure in a reachable source.

## Why this exists

`DO-THIS.md` item 0 asks for one hostname because `www.irs.gov` is refused by
this sandbox's egress policy. So is every state revenue department and every
state legislature this project has ever tried: `law.lis.virginia.gov`,
`tax.virginia.gov`, `budget.lis.virginia.gov`, `kslegislature.gov`,
`dor.georgia.gov`, `www.nysenate.gov` — all `403`.

Two hosts are NOT refused: `registry.npmjs.org` and `pypi.org`. Day 82 used that
to get the federal 2027 figures, whose provenance comment names the page of
`rp-26-35.pdf` behind each one — read out of `policyengine-us`'s parameter
metadata rather than out of the PDF. **Nobody had pointed the same trick at the
thirty states this engine refuses.**

Day 86 left the main line as *"the thirty, as each publishes, December to
February"*, with the instruction to ask *"is its 2027 already law?"* rather than
*"has it published?"* — and noted that costs one web search per state, that
twenty-seven of thirty answers are no, and that a `no` teaches nothing, so the
next run pays for it again. This makes that screen **local, free and repeatable**.

## What it does NOT do

It does not produce a figure this project may ship. Day 27's rule stands: *a
second model agreeing is not a source.* What is usable here is the **citation** —
the bill, the summary, the page — which turns "search thirty states" into "read
one named document for the four states where one exists". A figure still needs
two independent chains before it enters the engine.

It also separates the two things a future-dated value can be, which is the whole
reason this is a tool and not a `grep`:

  TRANSCRIBED  a literal date-keyed value somebody wrote down, with references
  UPRATED      a projection PolicyEngine's own inflation model will produce

An uprated 2027 is a forecast. Treating one as law would be the worst error
available here, so it is reported in a separate column and never in the first.

## Usage

    pip download --no-deps policyengine-us           # 25 MB, pypi.org is allowed
    unzip -q policyengine_us-*.whl -d /tmp/pe
    python3 -I tools/next-year-sources/scan.py \
        --parameters /tmp/pe/policyengine_us/parameters/gov/states \
        --year 2027 \
        --states AL,AR,AZ,CA,CO,CT,GA,IA,ID,IL,KS,KY,LA,MA,MD,MI,MN,MO,NC,ND,NJ,NM,NY,OH,OK,OR,SC,UT,VA,WI \
        --out tools/next-year-sources/out

`--states` is the list `node tools/next-year-sources/refused.mjs` prints, so the
question asked here is always the registry's own, never a list typed twice.
"""

import argparse
import json
import os
import re
import sys

import yaml

DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class NoDates(yaml.SafeLoader):
    """SafeLoader with the timestamp resolver removed.

    PolicyEngine writes an open-ended first value as `0000-01-01:`, and PyYAML
    raises `year 0 is out of range` trying to build a date from it — so
    `yaml.safe_load` fails on the whole FILE. The first version of this scanner
    caught that exception per file and carried on, and 19 files across 13 states
    were skipped in silence: California's five rate schedules, the Massachusetts
    surtax, Kansas's zero-tax threshold, Missouri's capital-gain rate. The states
    then came out of the summary as "only an uprated value", which is a sentence
    about a projection and not about a file nobody could open.

    > THE RULE: AN INSTRUMENT THAT CANNOT READ ITS INPUT REPORTS ABSENCE, AND
    > ABSENCE READS EXACTLY LIKE A FINDING.

    Keeping dates as strings also removes the earlier `isinstance(key, str)`
    trap, so one change fixes both halves of the same mistake.
    """


NoDates.yaml_implicit_resolvers = {
    first: [(tag, regexp) for tag, regexp in resolvers if tag != "tag:yaml.org,2002:timestamp"]
    for first, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}


def is_date_key(key):
    """PyYAML turns an unquoted `2027-01-01` into a datetime.date, not a str.

    The first version of this scanner tested `isinstance(key, str)` and so saw
    no date map anywhere in the tree. It reported "a transcribed 2027 value
    exists for: none" while `va/tax/income/deductions/standard.yaml` sat there
    with `2027-01-01: 18_400` in it, because every key had already been parsed
    into a date object. A scanner that cannot see its input reports absence, and
    absence reads exactly like a finding.
    """
    return bool(DATE.match(str(key)))


def date_maps(node, path, found):
    """Every dict in the tree whose keys are ISO dates, with where it was."""
    if isinstance(node, dict):
        keys = list(node.keys())
        if keys and all(is_date_key(k) for k in keys):
            found.append((path, {str(k): v for k, v in node.items()}))
            return
        for key, value in node.items():
            if key == "metadata":
                continue
            date_maps(value, f"{path}.{key}" if path else str(key), found)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            date_maps(value, f"{path}[{index}]", found)


def references(metadata):
    out = []
    reference = (metadata or {}).get("reference")
    if isinstance(reference, dict):
        reference = [reference]
    for entry in reference or []:
        if isinstance(entry, dict):
            out.append({"title": entry.get("title"), "href": entry.get("href")})
        elif isinstance(entry, str):
            out.append({"title": entry, "href": None})
    return out


def has_uprating(text):
    """`uprating` anywhere in the file means PolicyEngine projects the values.

    Read off the raw file rather than the parsed document: `json.dumps` cannot
    serialise a mapping whose keys PyYAML has turned into dates, and the point
    here is a yes/no about one word.
    """
    return re.search(r"^\s*uprating\s*:", text, re.M) is not None


def scan_state(root, state, year):
    base = os.path.join(root, state.lower(), "tax", "income")
    rows = []
    if not os.path.isdir(base):
        return rows
    for directory, _subdirs, files in os.walk(base):
        for name in sorted(files):
            if not name.endswith((".yaml", ".yml")):
                continue
            full = os.path.join(directory, name)
            try:
                with open(full, "r", encoding="utf-8") as handle:
                    text = handle.read()
                document = yaml.load(text, Loader=NoDates)
            except Exception as error:  # a parameter file this scan cannot read
                rows.append({"file": os.path.relpath(full, root), "error": str(error)})
                continue
            if not isinstance(document, dict):
                continue
            found = []
            date_maps(document, "", found)
            future = {}
            for where, mapping in found:
                for date, value in mapping.items():
                    if int(date[:4]) >= year:
                        future.setdefault(where or "values", {})[date] = value
            if not future:
                continue
            rows.append(
                {
                    "file": os.path.relpath(full, root),
                    "description": document.get("description"),
                    "uprated": has_uprating(text),
                    "future": future,
                    "references": references(document.get("metadata")),
                }
            )
    return rows


def write_report(args, result):
    """A readable worklist. Not byte-for-byte pinned by CI, and that is deliberate.

    Every other generated report in this repository is regenerated in CI and
    compared byte for byte. This one cannot be: it needs a 25 MB download from
    `pypi.org`, and a CI job has no business depending on another project's
    release cadence. What IS checked on every push is the QUESTION — that the
    committed scan asks about exactly the states the registry refuses today —
    by `refused.mjs --check`. So the report can go stale in its answers and
    cannot go stale in its subject, which is the half that would mislead.
    """
    year = args.year
    lines = [
        f"# A published {year} in a source this sandbox can actually reach",
        "",
        f"Generated by `tools/next-year-sources/scan.py` against **{result['source']} "
        f"{result['version']}**, for the **{len(result['asked_about'])} states this engine "
        f"refuses for {year}**.",
        "",
        "**This file contains no figure this project may ship.** Day 27's rule stands: a",
        "second model agreeing is not a source. What is usable here is the **citation** in",
        "the right-hand column — it turns \"search thirty states\" into \"read one named",
        "document\", and a figure still needs two independent chains before it enters the",
        "engine.",
        "",
        "`TRANSCRIBED` is a literal date-keyed value somebody wrote down. `UPRATED` is a",
        f"projection PolicyEngine's own inflation model produces, and an uprated {year} is a",
        "**forecast**: it is listed separately and must never be read as law.",
        "",
    ]
    def dates_of(row):
        return sorted({d for m in row["future"].values() for d in m})

    def is_target(row):
        """A value dated exactly the target year — not a later sunset."""
        return any(int(d[:4]) == year for d in dates_of(row))

    on_year, later_only, uprated = {}, {}, {}
    for state, rows in sorted(result["states"].items()):
        lit = [r for r in rows if not r.get("uprated") and r.get("future")]
        up = [r for r in rows if r.get("uprated") and r.get("future")]
        hit = [r for r in lit if is_target(r)]
        if hit:
            on_year[state] = hit
        elif lit:
            later_only[state] = lit
        elif up:
            uprated[state] = up

    def table(rows_by_state):
        out = ["| state | parameter | dates | citation |", "| --- | --- | --- | --- |"]
        for state, rows in rows_by_state.items():
            for row in rows:
                path = row["file"].split("tax/income/")[-1]
                cites = row.get("references") or []
                cite = "; ".join(
                    f"[{(c.get('title') or '')[:70]}]({c['href']})" if c.get("href") else (c.get("title") or "")
                    for c in cites[-2:]
                ) or "_none given_"
                out.append(f"| {state} | `{path}` | {', '.join(d[:7] for d in dates_of(row))} | {cite} |")
        return out

    lines += [
        f"## {len(on_year)} of {len(result['asked_about'])} have a TRANSCRIBED value dated exactly {year}",
        "",
        "**This is the worklist.** Each row names a document and, usually, a page.",
        "",
    ] + table(on_year) + [
        "",
        f"## {len(later_only)} have a transcribed value dated AFTER {year} and none for {year} itself",
        "",
        f"Mostly sunsets and scheduled expiries. They say nothing about {year} and are kept",
        "because a sunset inside the horizon is a fact a buyer of a multi-year subscription",
        "should know about.",
        "",
    ] + table(later_only) + [
        "",
        f"## {len(uprated)} have only an UPRATED (projected) value — a FORECAST, not law",
        "",
        ", ".join(f"`{s}`" for s in uprated) or "_none_",
        "",
        f"## {len(result['asked_about']) - len(result['states'])} have nothing dated {year} or later",
        "",
        ", ".join(f"`{s}`" for s in sorted(set(result["asked_about"]) - set(result["states"]))) or "_none_",
        "",
    ]
    with open(os.path.join(args.out, "REPORT.md"), "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def jsonable(node):
    """Make the tree valid JSON that a JavaScript reader can parse.

    New York's top bracket threshold is `.inf` in the YAML, which Python loads as
    `float("inf")` and `json.dump` writes as the bare token `Infinity` — valid
    for Python's own loader and a syntax error for `JSON.parse`, which is what
    `refused.mjs --check` uses. The committed file is read by both, so the
    non-finite values become strings.
    """
    if isinstance(node, float):
        if node == float("inf"):
            return "Infinity"
        if node == float("-inf"):
            return "-Infinity"
        if node != node:
            return "NaN"
        return node
    if isinstance(node, dict):
        return {str(k): jsonable(v) for k, v in node.items()}
    if isinstance(node, list):
        return [jsonable(v) for v in node]
    return node


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parameters", required=True, help="extracted .../parameters/gov/states")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--states", required=True, help="comma-separated, from refused.mjs")
    parser.add_argument("--out", required=True)
    parser.add_argument("--version", default="unknown", help="the policyengine-us version scanned")
    args = parser.parse_args(argv)

    states = [s.strip().upper() for s in args.states.split(",") if s.strip()]
    result = {
        "source": "policyengine-us",
        "version": args.version,
        "year": args.year,
        "asked_about": states,
        "states": {},
    }
    for state in states:
        rows = scan_state(args.parameters, state, args.year)
        if rows:
            result["states"][state] = rows

    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "sources.json"), "w", encoding="utf-8") as handle:
        json.dump(jsonable(result), handle, indent=1, sort_keys=True, default=str, allow_nan=False)
        handle.write("\n")

    write_report(args, result)

    def has(state_rows, predicate):
        return any(predicate(r) for r in state_rows)

    on_year = sorted(
        s
        for s, rows in result["states"].items()
        if has(rows, lambda r: not r.get("uprated") and any(int(d[:4]) == args.year for m in r.get("future", {}).values() for d in m))
    )
    transcribed = sorted(s for s, rows in result["states"].items() if has(rows, lambda r: not r.get("uprated") and r.get("future")))
    uprated_only = sorted(
        s for s, rows in result["states"].items()
        if s not in transcribed and has(rows, lambda r: r.get("uprated") and r.get("future"))
    )
    unreadable = [(s, r["file"], r["error"]) for s, rows in result["states"].items() for r in rows if "error" in r]

    print(f"scanned {len(states)} refused state(s) against policyengine-us {args.version} for {args.year}")
    print(f"  a value dated exactly {args.year}, TRANSCRIBED: {', '.join(on_year) or 'none'}")
    print(f"  transcribed, but only dated after {args.year}: {', '.join(s for s in transcribed if s not in on_year) or 'none'}")
    print(f"  only an UPRATED (projected) value: {', '.join(uprated_only) or 'none'}")
    print(f"  nothing dated {args.year} or later: {len(states) - len(result['states'])} state(s)")
    if unreadable:
        print(f"\n  {len(unreadable)} FILE(S) COULD NOT BE READ — this is a gap, not an absence:")
        for state, path, error in unreadable:
            print(f"    {state}  {path}  ({error})")
        return 2
    print("\n  every parameter file in every state scanned was readable")
    return 0


if __name__ == "__main__":
    sys.exit(main())
