#!/usr/bin/env node
/**
 * THE STATES WHOSE TAX YEAR IS ONLY AS VERIFIED AS THE FEDERAL ONE.
 *
 *   node tools/cross-package/federal-basis-years.mjs --check
 *
 * ## The question, which nobody here had asked
 *
 * `us-federal-tax` exports `isPrimaryVerified(year)` and answers **false for
 * 2027**: `irs.gov` does not resolve from this sandbox, Rev. Proc. 2026-35 has
 * never been opened here, and the 2027 figures were triangulated from secondary
 * chains rather than transcribed. Day 82 shipped that flag, Day 85 made the
 * calculator honour it, and both treated it as a fact about the FEDERAL package.
 *
 * It is not. Eight of the forty-two states put a federal figure inside their own
 * return, in three different ways and at three different depths:
 *
 * ```text
 *   IA MO NM   deduction.kind === 'federal'        — they take the federal
 *                                                    standard deduction whole
 *   CO ID ND   base === 'federalTaxableIncome'     — the federal deduction is
 *                                                    already inside their base
 *   AL MO OR   federalIncomeTaxDeduction           — they deduct the federal
 *                                                    income TAX, so they borrow
 *                                                    the whole federal answer
 * ```
 *
 * ## THE THIRD ROW WAS MISSING FROM THE FIRST VERSION OF THIS FILE, AND THAT IS
 * ## THE MOST USEFUL THING IN IT
 *
 * This check shipped with two tests — the two that came to mind — and reported
 * six states. The third row was found half an hour later by asking a question
 * about ALABAMA rather than by re-reading this file: Alabama is one of the few
 * states that deducts federal income tax PAID, so an Alabama 2027 would contain
 * the federal 2027 tax itself, computed from figures nobody here has read. That
 * is a strictly deeper dependency than the first two rows — Iowa borrows one
 * federal number, Alabama borrows the federal answer — and it was invisible to a
 * check written by enumerating the ways I could think of.
 *
 * > **THE RULE: A CHECK BUILT FROM THE CASES ITS AUTHOR LISTED COVERS EXACTLY
 * > THOSE CASES, AND NOTHING WARNS YOU ABOUT THE LIST.** The fix that generalises
 * > is below: `UNMODELLED_FEDERAL_KEYS` enumerates every federal-named key this
 * > engine's definitions contain, and the check FAILS if a new one appears that
 * > nobody has classified. A new kind of federal dependency now arrives as a red
 * > build rather than as a silent gap.
 *
 * **So a 2027 for any of those six is a 2027 built on a reconstruction**, and it
 * would say `status: 'published'` unless something stopped it. Iowa is the one
 * that makes this concrete and is why the file exists: Iowa's rate is a flat
 * 3.8% written into statute with no further scheduled step and nothing in its
 * definition indexes — every one of its twenty-three numeric leaves is identical
 * in 2025 and 2026 — so Iowa looks exactly like Day 85's Indiana, Mississippi
 * and Pennsylvania. It is not like them. `deduction.kind` is `federal`, so the
 * largest number in an Iowa return for 2027 is a figure this project has not
 * read.
 *
 * > **THE RULE: A STATE THAT BORROWS A FEDERAL FIGURE BORROWS ITS PROVENANCE,
 * > AND PROVENANCE IS NOT VISIBLE IN THE BORROWED NUMBER.** Day 85's version of
 * > this was that adding a year to a surface inherits every disclosure that year
 * > carries elsewhere. This is the same rule across two packages instead of
 * > across two files, and it is the one direction the existing cross-package
 * > checks do not look: `federal-basis-copies.mjs` asks whether a hand-written
 * > federal figure in the state suite has the right VALUE. This asks whether a
 * > state-year is allowed to claim the value is VERIFIED.
 *
 * ## What it asserts
 *
 * 1. **Reachability.** Every state-year that reads a federal figure must have
 *    that year in `us-federal-tax`. A state serving a year the federal package
 *    does not is a crash, not a wrong number.
 * 2. **Disclosure.** No such state-year may say `status: 'published'` while
 *    `isPrimaryVerified(year)` is false for the year it borrows.
 *
 * **Assertion 2 is vacuous today and that is the point of writing it now.** No
 * state serves 2027 yet, so it passes over zero rows — which is exactly the
 * condition Day 84 warned about, a mechanism that has never run being a claim
 * rather than an inventory. It is therefore verified by reintroduction in
 * `federal-basis-years.test.mjs`, against fixtures, in both directions. It goes
 * live without anybody remembering it the day one of those six publishes, which
 * is some time between December and February.
 *
 * ## And it is a measurement of DO-THIS.md item 0
 *
 * The one-hostname ask has been priced as "every tax year, forever" against the
 * federal package. The report below prices it against the state engine too: six
 * states' 2027 can be *computed* without `www.irs.gov` and cannot be
 * *published* without it.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Why a state-year's arithmetic reaches into the federal package. */
export const FEDERAL_DEDUCTION = 'takes the federal standard deduction whole';
export const FEDERAL_BASE = 'starts from federal taxable income, so the deduction is inside its base';
export const FEDERAL_TAX = 'deducts the federal income TAX, so it borrows the whole federal answer';

/**
 * Federal-named keys that appear in a state definition and do NOT make the
 * state's figures depend on a federal AMOUNT this project has to have read.
 *
 * Each one is here with a reason, because this list is the other half of the
 * check below: anything federal-named and not classified is a dependency nobody
 * has thought about, and the check goes red rather than ignoring it.
 */
export const UNMODELLED_FEDERAL_KEYS = {
  // Which Internal Revenue Code a state conforms to, and whether rolling or
  // static. A conformity RULE, not a figure: it decides which federal law
  // flows through, and the figures it admits are already covered by `base` and
  // `deduction` above.
  federalConformity: 'a conformity rule rather than an amount',
  // Whether the state return may itemise only if the federal one did, and
  // whether itemising federally forces it. A gate on the caller's own federal
  // election; it reads no published federal figure.
  requiresFederalItemizing: "a gate on the filer's federal election, not a figure",
  forcedWhenFederalItemizing: "a gate on the filer's federal election, not a figure",
  // Subtractions of specific FEDERAL deductions the state declines to follow —
  // e.g. the OBBBA qualified-overtime deduction. The CAP is the state's own
  // statutory number; the amount subtracted comes from the filer's own return,
  // not from a published federal parameter.
  federalDeductionSubtractions: "the caps are the state's own statutory figures",
};

/**
 * How a definition depends on a federal AMOUNT, or null — deepest first, so the
 * reason reported for a state in two groups is the one that constrains it most.
 *
 * Three narrow tests rather than one broad one, because the three have
 * different remedies: the first two would be settled by the state publishing
 * its own deduction, and the third cannot be settled by the state at all.
 */
export function federalDependency(def) {
  if (def.federalIncomeTaxDeduction !== undefined) return FEDERAL_TAX;
  if (def.deduction?.kind === 'federal') return FEDERAL_DEDUCTION;
  if (def.base === 'federalTaxableIncome') return FEDERAL_BASE;
  return null;
}

/** Every federal-named key anywhere in a definition, at any depth. */
export function federalKeys(def, out = new Set()) {
  if (Array.isArray(def)) {
    def.forEach((v) => federalKeys(v, out));
    return out;
  }
  if (def !== null && typeof def === 'object') {
    for (const [k, v] of Object.entries(def)) {
      if (k === 'notes' || k === 'citations') continue;
      if (/federal/i.test(k)) out.add(k);
      federalKeys(v, out);
    }
  }
  return out;
}

/** The federal-named keys that `federalDependency` itself decides on. */
export const CLASSIFIED_AS_DEPENDENCY = ['federalIncomeTaxDeduction', 'deduction', 'base'];

/**
 * The audit, as a pure function so the test can drive it with fixtures.
 *
 * `stateYears` is a list of `[state, year]`. `getDef` and `isPrimaryVerified`
 * are the two engines' own functions in the CLI below, and fakes in the test.
 */
export function auditFederalBasisYears({ stateYears, getDef, isPrimaryVerified, federalYears }) {
  const federal = new Set(federalYears);
  const dependents = [];
  const failures = [];
  const unclassified = new Map();
  for (const [state, year] of stateYears) {
    const def = getDef(state, year);

    // The generalisation, and the reason this check is not just its own author's
    // list of ideas: a federal-named key that is neither a classified
    // dependency nor a declared non-dependency is a gap, and it is red.
    for (const key of federalKeys(def)) {
      if (CLASSIFIED_AS_DEPENDENCY.includes(key)) continue;
      if (key in UNMODELLED_FEDERAL_KEYS) continue;
      if (!unclassified.has(key)) unclassified.set(key, []);
      unclassified.get(key).push(`${state} ${year}`);
    }

    const why = federalDependency(def);
    if (why === null) continue;
    const verified = isPrimaryVerified(year);
    dependents.push({ state, year, why, status: def.status, verified });

    if (!federal.has(year)) {
      failures.push(
        `${state} ${year} ${why}, and us-federal-tax does not serve ${year} at all ` +
          `(it serves ${[...federal].join(', ')}). That is a crash, not a wrong figure.`,
      );
      continue;
    }
    if (!verified && def.status === 'published') {
      failures.push(
        `${state} ${year} ${why}, the federal ${year} figures are NOT verified against the ` +
          `published document, and ${state} ${year} still says status: 'published'. It inherits ` +
          `the federal year's provenance and must say so — status: 'provisional', with a ` +
          `provisionalFigures entry naming the federal dependency.`,
      );
    }
  }
  for (const [key, where] of unclassified) {
    failures.push(
      `${JSON.stringify(key)} is a federal-named field in ${where.length} state-year(s) ` +
        `(${where.slice(0, 4).join(', ')}${where.length > 4 ? ', ...' : ''}) and nothing in ` +
        `federal-basis-years.mjs says whether it makes that state's figures depend on a ` +
        `federal amount. Classify it: add it to federalDependency if it does, or to ` +
        `UNMODELLED_FEDERAL_KEYS with the reason if it does not.`,
    );
  }
  return { dependents, failures, unclassified: [...unclassified.keys()] };
}

async function main() {
  const check = process.argv.includes('--check');
  const state = await import(join(ROOT, 'packages/us-state-tax/dist/esm/index.js')).catch((err) => {
    console.error(`cannot import us-state-tax: ${err.message}`);
    console.error('  (cd packages/us-state-tax && npm install && npm run build)');
    process.exit(1);
  });
  const fed = await import(join(ROOT, 'packages/us-federal-tax/dist/esm/index.js')).catch((err) => {
    console.error(`cannot import us-federal-tax: ${err.message}`);
    console.error('  (cd packages/us-federal-tax && npm install && npm run build)');
    process.exit(1);
  });

  const { dependents, failures } = auditFederalBasisYears({
    stateYears: state.SUPPORTED_STATE_YEARS,
    getDef: (s, y) => state.getStateDefinition(s, y),
    isPrimaryVerified: (y) => fed.isPrimaryVerified(y),
    federalYears: fed.SUPPORTED_YEARS,
  });

  // The six states, independent of which years they currently serve — because
  // the ask this measures is about the years they do NOT serve yet.
  const byState = new Map();
  for (const s of state.SUPPORTED_STATES) {
    const why = federalDependency(state.getStateDefinition(s, state.supportedYears(s).at(-1)));
    if (why !== null) byState.set(s, why);
  }
  const unverified = fed.SUPPORTED_YEARS.filter((y) => !fed.isPrimaryVerified(y));
  const latest = state.SUPPORTED_YEARS.at(-1);
  const servingLatest = new Set(state.statesForYear(latest));

  if (!check) {
    console.log(`${byState.size} of ${state.SUPPORTED_STATES.length} states read a federal figure:\n`);
    for (const [s, why] of [...byState].sort()) {
      console.log(`  ${s}  ${servingLatest.has(s) ? `serves ${latest}` : `no ${latest}`.padEnd(9)}  ${why}`);
    }
    console.log(`\nfederal years served: ${fed.SUPPORTED_YEARS.join(', ')}`);
    console.log(`verified against the published document: ${fed.PRIMARY_VERIFIED_YEARS.join(', ')}`);
    console.log(`NOT verified: ${unverified.length === 0 ? 'none' : unverified.join(', ')}\n`);
    console.log(`${dependents.length} shipped state-year(s) read a federal figure, all disclosed correctly.`);
  }

  if (failures.length > 0) {
    console.error('A state-year claims more verification than the federal year it is built on.\n');
    for (const f of failures) console.error(`  ${f}`);
    console.error(
      '\nSee the header of this file. A state that borrows a federal figure borrows its\n' +
        'provenance, and the borrowed number does not carry it.',
    );
    process.exit(1);
  }

  if (check) {
    console.log(
      `ok — ${byState.size} states read a federal figure (${[...byState.keys()].sort().join(', ')}); ` +
        `${dependents.length} shipped state-year(s) do, every one of them in a federal year that is ` +
        `verified against the published document; ` +
        `${unverified.length === 0 ? 'no federal year is unverified' : `federal ${unverified.join(', ')} is NOT verified, so none of those ${byState.size} may publish it`}`,
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
