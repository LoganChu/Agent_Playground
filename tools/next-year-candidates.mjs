#!/usr/bin/env node
/**
 * WHICH OF THE STATES MISSING THE LATEST TAX YEAR COULD BE SETTLED WITHOUT A
 * DOCUMENT — screened by what moved last time, not by searching.
 *
 *   node tools/next-year-candidates.mjs
 *
 * ## Why screening beats searching, measured
 *
 * Thirty of the forty-two states do not serve 2027, and they publish between
 * December and February, one at a time. Day 85 found three of the twelve that do
 * serve it by asking a different question — not *"has it published?"* but
 * *"is its 2027 already LAW?"* — and bought Indiana, Mississippi and
 * Pennsylvania for one search each.
 *
 * **That question still costs one search per state, and twenty-seven of thirty
 * answers are no.** The expensive part is not the search; it is that a `no`
 * teaches nothing and the next run pays for it again. This tool makes the
 * screen mechanical and local:
 *
 * > **A STATE THAT INDEXES SOMETHING MOVED IT LAST YEAR.** So diff every numeric
 * > leaf of a state's two most recent definitions. A state where NOTHING moved
 * > has no indexing mechanism anywhere in what this engine models, and its next
 * > year is a rate question rather than a publication question. A state where
 * > forty-eight leaves moved is waiting on a department and no amount of reading
 * > statute will settle it.
 *
 * The screen is a filter on effort and not an answer. A state it clears still
 * needs the two independent sources Day 1 requires, and Day 85's Mississippi is
 * the reason: the first guess there carried 4.0% forward and the real figure was
 * 3.75%, wrong by 25 basis points.
 *
 * ## What it found on the day it was written, and the one that mattered
 *
 * ```text
 *   NOTHING MOVED   AL CA IA ID KS NM      6 states
 *   of those, already carrying provisional 2026 figures:  CA ID NM
 *   leaving                                AL IA KS
 * ```
 *
 * **All three that cleared the screen are still refused, each for a different
 * reason, and none of the three reasons is visible to the screen.**
 *
 * ```text
 *   IA   deduction.kind === 'federal'        the federal standard deduction is
 *                                            Iowa's largest subtraction, and
 *                                            federal 2027 is triangulated here
 *   AL   federalIncomeTaxDeduction           Alabama deducts the federal income
 *                                            TAX, so it borrows the whole
 *                                            federal answer, not one figure
 *   KS   two sources disagree                Tax Foundation says the standard
 *                                            deduction and exemption are
 *                                            indexed; two others say they are
 *                                            fixed by K.S.A. 79-32,119. Day 1's
 *                                            rule is two INDEPENDENT sources
 *                                            that AGREE, so Kansas is refused
 * ```
 *
 * Iowa's rate is a flat 3.8% in statute with no scheduled step after it and all
 * twenty-three of its numeric leaves are identical in 2025 and 2026 — it looks
 * exactly like Day 85's Pennsylvania, and it is not. Alabama's seventy-six
 * leaves are likewise all static, and it is one layer worse than Iowa. Both are
 * gated by `tools/cross-package/federal-basis-years.mjs`, which exists because
 * of these two rows.
 *
 * > **THE RULE: A STATE WITH NO INDEXING OF ITS OWN MAY STILL BE WAITING ON
 * > SOMEBODY ELSE'S INDEXING.** The screen cannot see that, because the figure
 * > it would have to look at is not in the state's definition at all.
 *
 * **AND KANSAS IS AN OPEN QUESTION ABOUT A SHIPPED FIGURE, NOT ONLY A FUTURE
 * ONE.** If the enacted 2024 law does carry the § 1(f)(3) cost-of-living
 * adjustment that the bill drafts contain, then this engine's identical 2025 and
 * 2026 Kansas standard deduction and personal exemption are a carry-forward that
 * is not marked `provisional` — which is the one thing the provisional flag
 * exists to prevent. The figures are NOT changed on that suspicion, because
 * changing a parameter on a guess is worse than leaving a question open; it is
 * recorded here, in `JOURNAL.md` and in `NOTES-FOR-HUMAN.md` with the statute to
 * read. `kslegislature.gov` answers `CONNECT tunnel failed, response 403` from
 * this sandbox, the same as `www.irs.gov`, so this is a second concrete instance
 * of `DO-THIS.md` item 0's class — and the first one that touches a figure
 * already shipped rather than a year not yet served.
 *
 * The three provisional ones are the other instructive group: CA, ID and NM show
 * `NOTHING MOVED` precisely BECAUSE their 2026 figures were carried forward from
 * 2025 and marked provisional. So "nothing moved" means two opposite things —
 * nothing indexes, or everything indexes and nothing has arrived — and the
 * provisional flag is what separates them. The report prints the flag beside the
 * count for that reason.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every numeric leaf by path. Prose, years and statuses are not parameters. */
export function numericLeaves(node, path = '', out = new Map()) {
  if (typeof node === 'number') {
    out.set(path, node);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => numericLeaves(v, `${path}[${i}]`, out));
    return out;
  }
  if (node !== null && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'year' || k === 'status' || k === 'notes' || k === 'citations') continue;
      numericLeaves(v, path === '' ? k : `${path}.${k}`, out);
    }
  }
  return out;
}

/** What moved, what arrived, and whether the movement was only a rate. */
export function screen(previous, latest) {
  const before = numericLeaves(previous);
  const after = numericLeaves(latest);
  const moved = [];
  for (const [path, value] of after) {
    const was = before.get(path);
    if (was !== undefined && was !== value) moved.push({ path, was, now: value });
  }
  const arrived = [...after.keys()].filter((p) => !before.has(p));
  return {
    moved,
    arrived,
    leaves: after.size,
    rateOnly: moved.length > 0 && moved.every(({ path }) => /rate/i.test(path)),
  };
}

async function main() {
  const state = await import(join(ROOT, 'packages/us-state-tax/dist/esm/index.js')).catch((err) => {
    console.error(`cannot import us-state-tax: ${err.message}`);
    console.error('  (cd packages/us-state-tax && npm install && npm run build)');
    process.exit(1);
  });

  const latestYear = state.SUPPORTED_YEARS.at(-1);
  const serving = new Set(state.statesForYear(latestYear));
  const missing = state.SUPPORTED_STATES.filter((s) => !serving.has(s));

  const rows = missing.map((code) => {
    const years = state.supportedYears(code);
    const [a, b] = [years.at(-2), years.at(-1)];
    const latest = state.getStateDefinition(code, b);
    const s = screen(state.getStateDefinition(code, a), latest);
    return { code, from: a, to: b, ...s, status: latest.status, provisional: (latest.provisionalFigures ?? []).length };
  });
  rows.sort((x, y) => x.moved.length - y.moved.length || x.code.localeCompare(y.code));

  console.log(
    `${missing.length} of ${state.SUPPORTED_STATES.length} states do not serve ${latestYear}. ` +
      `Numeric leaves that moved between each one's last two years:\n`,
  );
  for (const r of rows) {
    const verdict =
      r.moved.length === 0
        ? r.provisional > 0
          ? `nothing moved, but ${r.provisional} figure(s) are PROVISIONAL — waiting, not static`
          : 'NOTHING MOVED — no indexing in what this engine models'
        : r.rateOnly
          ? `${r.moved.length} moved, all rates — the amounts are static`
          : `${r.moved.length} of ${r.leaves} leaves moved`;
    console.log(`  ${r.code}  ${r.from}->${r.to}  ${String(r.leaves).padStart(3)} leaves  ${verdict}`);
    if (r.moved.length > 0 && r.moved.length <= 3) {
      for (const { path, was, now } of r.moved) console.log(`        ${path}: ${was} -> ${now}`);
    }
  }

  const clear = rows.filter((r) => r.moved.length === 0 && r.provisional === 0);
  const waiting = rows.filter((r) => r.moved.length === 0 && r.provisional > 0);
  console.log(
    `\n${clear.length} state(s) clear the screen: ${clear.map((r) => r.code).join(', ') || 'none'}` +
      `\n${waiting.length} show no movement only because they are already carrying provisional figures: ` +
      `${waiting.map((r) => r.code).join(', ') || 'none'}` +
      '\n\nClearing the screen is not an answer. It means the next year is a question about' +
      '\nstatute rather than about a department, so it can be settled from two independent' +
      '\nsources rather than from a publication. Check tools/cross-package/federal-basis-years.mjs' +
      '\nfirst: a state with no indexing of its own may still borrow a federal figure.',
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
