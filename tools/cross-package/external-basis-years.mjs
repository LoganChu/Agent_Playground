#!/usr/bin/env node
/**
 * THE STATES WHOSE NEXT TAX YEAR WAITS ON SOMEBODY ELSE'S PUBLICATION — READ
 * FROM THE LEDGER THAT RECORDS SOURCES, NOT FROM VARIABLE NAMES.
 *
 *   node tools/cross-package/external-basis-years.mjs --check
 *
 * ## THE DEFECT THIS FILE EXISTS FOR, AND IT IS IN YESTERDAY'S CHECK
 *
 * Day 86 shipped `federal-basis-years.mjs` to answer "which states' next tax
 * year is only as verified as the federal one?" It reported **eight**: AL CO IA
 * ID MO ND NM OR. It found them by enumerating every key in every definition
 * whose NAME matches `/federal/i`, and it fails on a federal-named key nobody
 * has classified — a generalisation its own header calls the fix for "a check
 * built from the cases its author listed".
 *
 * The real number is **eleven**. Kentucky, Maryland and Virginia each read the
 * **HHS poverty guidelines** — a federal publication, republished every January
 * — and all three are invisible to a name-based scan, because the keys are
 * `familySizeTaxCredit.povertyGuideline`, `povertyLevelCredit.povertyGuideline`
 * and `lowIncomeCredit.povertyGuideline`. Not one of them contains the word
 * "federal".
 *
 * **And this project already knew.** `STATE_FIGURE_PROVENANCE` records all three
 * in plain English, and has since the day each was added:
 *
 * ```text
 *   state: 'VA'
 *   path:  'lowIncomeCredit.povertyGuideline.*'
 *   kind:  'agency'
 *   document: 'HHS poverty guidelines'
 *   cite: '... republished every January ...'
 *   constant: false
 * ```
 *
 * > **THE RULE: A CHECK THAT INFERS PROVENANCE FROM A VARIABLE NAME IGNORES THE
 * > LEDGER THAT RECORDS PROVENANCE.** Day 86's lesson was that a check built from
 * > its author's list covers exactly that list. The fix it reached for was a
 * > wider list. The fix that was available was to stop guessing and read the
 * > 478-record table whose entire job is to say where each figure came from.
 *
 * ## THE DISCOVERY RULE, WHICH NEEDS NO LIST AT ALL
 *
 * One structural fact separates an external publication from a state's own
 * document, and it needs no keyword and no maintenance:
 *
 * > **A document cited by two or more different states is not any one state's
 * > own document.**
 *
 * No state statute, form, or revenue-department release publishes figures for
 * another state. Across all 478 provenance records there is **exactly one**
 * document cited by more than one state, and it is `HHS poverty guidelines`
 * (KY, MD, VA). Zero false positives, and the day a fourth state adopts it, or
 * a second state adopts anything else shared, it arrives here automatically.
 *
 * That rule cannot catch a single state borrowing something alone, so
 * `EXTERNAL_PUBLICATIONS` below registers each known external publisher
 * explicitly — with the host that serves it and the month it appears, which are
 * the two facts that decide whether a state-year is blocked by a setting or by
 * the calendar. A moving figure whose document is multi-state but unregistered
 * is a **red build**.
 *
 * ## WHY THE PUBLISHER AND THE MONTH MATTER MORE THAN THE COUNT
 *
 * `DO-THIS.md` item 0 asks for one hostname, `www.irs.gov`, and Day 86 priced it
 * at "the gate on eight of forty-two states' next tax year". That price is
 * right, and it is **not** eleven:
 *
 * ```text
 *   8 states  IRS  Rev. Proc. 2026-35   PUBLISHED 2026-11-05, blocked by a host
 *   3 states  HHS  poverty guidelines   NOT PUBLISHED until January 2027
 * ```
 *
 * The eight are blocked by a network allowlist and could be read today. KY, MD
 * and VA are blocked by **the calendar**: the 2027 guidelines do not exist yet,
 * so no setting anybody changes in November 2026 unblocks them. Those are
 * different asks with different remedies, and before today they were one bucket
 * of "twenty states waiting on a department" — which named the wrong department
 * for three of them, and a department in the wrong government.
 *
 * ## WHAT IS ASSERTED
 *
 * Four things, and two of them can fire on today's tree rather than only on a
 * tree nobody has built yet:
 *
 *   A. DISCOVERY. Every document cited by 2+ states is registered below.
 *      List-free; red on a new shared document.
 *   B. DECLARATION MATCHES DATA. Each registered publication's `editionYears`
 *      is exactly the set of tax years whose definitions read it. A registry
 *      that drifts from the tree is a claim, which is Day 84's finding.
 *   C. NO SILENT CARRY-FORWARD. Where a definition declares which edition it
 *      read, that edition must be the tax year itself — unless the figure is in
 *      `provisionalFigures`. The HHS guidelines have risen every year for
 *      decades, so an unchanged figure in a new year is a carry-forward, and
 *      the `provisional` flag exists for exactly that. This is the Kansas
 *      question of Day 86 turned into a gate.
 *   D. VERIFICATION PARITY. A state-year may not claim `status: 'published'`
 *      while the edition it reads is one this project has never carried.
 *
 * ## THE ONE DECLARED EXCEPTION, AND IT IS A FINDING OF ITS OWN
 *
 * Maryland and Virginia store `povertyGuideline.year` — the engine saying, in
 * data, which January's guidelines this figure is. **Kentucky does not.** The
 * same federal figure is self-documenting in two states and anonymous in the
 * third, so assertion C is enforceable for MD and VA and merely reported for
 * KY. Closing that is a one-field change in `packages/us-state-tax/src`, which
 * costs a mutation re-audit, so it is recorded as an ask rather than taken
 * today — Day 84 lost fifty minutes of audit to exactly that kind of edit.
 */
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Publications by somebody other than the state whose figure they set.
 *
 * `host` and `publishedWhen` are the operative fields: together they say whether
 * a blocked state-year is waiting on a setting or on a date.
 */
export const EXTERNAL_PUBLICATIONS = [
  {
    id: 'hhs-poverty-guidelines',
    document: 'HHS poverty guidelines',
    publisher: 'U.S. Department of Health and Human Services',
    host: 'aspe.hhs.gov',
    publishedWhen: 'every January, for that calendar year',
    // The editions this engine carries. Assertion B keeps this honest.
    editionYears: [2025, 2026],
    // Where a definition states which edition it read, relative to the group.
    editionYearField: 'year',
    // States that read it without declaring the edition. See the header.
    undeclaredEditionIn: {
      KY: 'familySizeTaxCredit.povertyGuideline carries firstPerson and additionalPerson and no `year`, so assertion C cannot be enforced for Kentucky. MD and VA both declare it. Adding the field is a source change in a mutation-audited package.',
    },
  },
];

/** A document cited by 2+ states is nobody's own document. The discovery rule. */
export function sharedDocuments(provenance) {
  const states = new Map();
  for (const r of provenance) {
    if (!r.document) continue;
    if (!states.has(r.document)) states.set(r.document, new Set());
    states.get(r.document).add(r.state);
  }
  const out = new Map();
  for (const [document, sts] of states) if (sts.size > 1) out.set(document, sts);
  return out;
}

/** The provenance records for a publication, and the states that read it. */
export function readersOf(provenance, document) {
  const rows = provenance.filter((r) => r.document === document);
  return {
    rows,
    states: [...new Set(rows.map((r) => r.state))].sort(),
    moves: rows.some((r) => r.constant === false),
  };
}

/** `a.b.c` against an object, undefined rather than a throw on a missing link. */
export function at(object, path) {
  return path.split('.').reduce((node, key) => (node === null || node === undefined ? undefined : node[key]), object);
}

/**
 * The group a `path` pattern names, without its trailing wildcard:
 * `lowIncomeCredit.povertyGuideline.*` -> `lowIncomeCredit.povertyGuideline`.
 */
export function groupOf(path) {
  return path
    .split('.')
    .filter((part) => part !== '*' && part !== '**')
    .join('.');
}

/**
 * The audit, as a pure function so the tests can drive it with fixtures rather
 * than only with the tree that happens to be checked out.
 */
export function auditExternalBasis({ provenance, stateYears, getDef, publications = EXTERNAL_PUBLICATIONS }) {
  const failures = [];
  const dependents = [];
  const registered = new Map(publications.map((p) => [p.document, p]));

  // A. DISCOVERY — a shared document nobody has registered.
  for (const [document, sts] of sharedDocuments(provenance)) {
    if (!registered.has(document)) {
      failures.push(
        `"${document}" is cited by ${[...sts].sort().join(', ')} — a document cited by more than one ` +
          `state is not any one state's own document. Register it in EXTERNAL_PUBLICATIONS with the ` +
          `host that serves it and the month it appears, or correct the provenance record.`,
      );
    }
  }

  for (const publication of publications) {
    const { rows, states } = readersOf(provenance, publication.document);
    if (rows.length === 0) {
      failures.push(`"${publication.document}" is registered as external and no provenance record cites it.`);
      continue;
    }

    // Which tax years actually read this publication, from the tree.
    const observed = new Set();
    for (const [state, year] of stateYears) {
      if (!states.includes(state)) continue;
      const def = getDef(state, year);
      if (!def) continue;
      for (const row of rows.filter((r) => r.state === state)) {
        const group = at(def, groupOf(row.path));
        if (group === undefined || group === null) continue;

        dependents.push({ state, year, document: publication.document, group: groupOf(row.path) });

        const declared = publication.editionYearField ? group[publication.editionYearField] : undefined;
        const undeclaredReason = publication.undeclaredEditionIn?.[state];

        // `editionYears` is which EDITIONS this engine has incorporated, not
        // which tax years exist. A provisional 2027 carrying 2026's guidelines
        // has read the 2026 edition, so it must not make the registry claim a
        // 2027 edition was read. Where no edition is declared (Kentucky) the
        // tax year is the only thing available.
        observed.add(declared === undefined ? year : declared);

        // C. NO SILENT CARRY-FORWARD.
        if (declared === undefined) {
          if (!undeclaredReason) {
            failures.push(
              `${state} ${year} reads "${publication.document}" at ${groupOf(row.path)} and does not declare ` +
                `which edition (no \`${publication.editionYearField}\`), so a carry-forward cannot be detected. ` +
                `Declare it, or record the state in undeclaredEditionIn with the reason.`,
            );
          }
        } else if (declared !== year) {
          const provisional = (def.provisionalFigures ?? []).some((f) => f.path.startsWith(groupOf(row.path)));
          if (!provisional) {
            failures.push(
              `${state} ${year} reads the ${declared} edition of "${publication.document}" for tax year ${year} ` +
                `and is not marked provisional at ${groupOf(row.path)}. A figure that moves every year and did ` +
                `not move is a carry-forward, which is what the provisional flag is for.`,
            );
          }
        }

        // D. VERIFICATION PARITY.
        if (!publication.editionYears.includes(year) && def.status === 'published') {
          failures.push(
            `${state} ${year} claims status 'published' and reads "${publication.document}", whose ${year} ` +
              `edition this project has never carried (carried: ${publication.editionYears.join(', ')}).`,
          );
        }
      }
    }

    // B. DECLARATION MATCHES DATA.
    const declaredYears = [...publication.editionYears].sort().join(', ');
    const observedYears = [...observed].sort().join(', ');
    if (declaredYears !== observedYears) {
      failures.push(
        `"${publication.document}" declares editionYears ${declaredYears || '(none)'} and the tree reads ` +
          `edition(s) ${observedYears || '(none)'}. The registry is a claim unless it matches the definitions.`,
      );
    }
  }

  return { failures, dependents };
}

async function main() {
  const check = process.argv.includes('--check');
  const state = await import(join(ROOT, 'packages/us-state-tax/dist/esm/index.js')).catch((err) => {
    console.error(`cannot import us-state-tax: ${err.message}`);
    console.error('  (cd packages/us-state-tax && npm install && npm run build)');
    process.exit(1);
  });

  const provenance = state.STATE_FIGURE_PROVENANCE;
  const { failures, dependents } = auditExternalBasis({
    provenance,
    stateYears: state.SUPPORTED_STATE_YEARS,
    getDef: (s, y) => {
      try {
        return state.getStateDefinition(s, y);
      } catch {
        return null;
      }
    },
  });

  const byPublication = new Map();
  for (const publication of EXTERNAL_PUBLICATIONS) {
    byPublication.set(publication.document, readersOf(provenance, publication.document).states);
  }
  const latest = state.SUPPORTED_YEARS.at(-1);
  const serving = new Set(state.statesForYear(latest));

  if (!check) {
    const total = [...byPublication.values()].flat();
    console.log(`${new Set(total).size} of ${state.SUPPORTED_STATES.length} states read a figure published by somebody else:\n`);
    for (const publication of EXTERNAL_PUBLICATIONS) {
      const states = byPublication.get(publication.document);
      console.log(`  ${publication.document} — ${publication.publisher}`);
      console.log(`    host ${publication.host}, ${publication.publishedWhen}`);
      console.log(`    editions carried here: ${publication.editionYears.join(', ')}`);
      for (const s of states) {
        const declared = publication.undeclaredEditionIn?.[s] ? 'edition NOT declared' : 'edition declared';
        console.log(`    ${s}  ${serving.has(s) ? `serves ${latest}` : `no ${latest}`.padEnd(9)}  ${declared}`);
      }
      console.log('');
    }
    console.log(`${dependents.length} shipped state-year(s) read an external publication.`);
    console.log(
      `\nShared documents found by the discovery rule (cited by 2+ states): ` +
        `${[...sharedDocuments(provenance).keys()].map((d) => `"${d}"`).join(', ') || 'none'}`,
    );
  }

  if (failures.length > 0) {
    console.error('\nA state-year depends on a publication it does not account for.\n');
    for (const f of failures) console.error(`  ${f}`);
    console.error('\nSee the header of this file.');
    process.exit(1);
  }

  if (check) {
    const states = [...new Set([...byPublication.values()].flat())].sort();
    console.log(
      `ok — ${states.length} state(s) (${states.join(', ')}) read a figure published by somebody other than ` +
        `the state: ${EXTERNAL_PUBLICATIONS.map((p) => `"${p.document}" (${p.host}, ${p.publishedWhen})`).join('; ')}; ` +
        `${dependents.length} shipped state-year(s) do, every one reading the edition for its own tax year; ` +
        `${sharedDocuments(provenance).size} shared document(s), all registered`,
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
