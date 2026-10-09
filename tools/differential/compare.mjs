/**
 * Join the two models' answers and report every disagreement.
 *
 * A disagreement is not a bug. Two models of the same statute can differ because
 * one is wrong, because they read an ambiguous provision differently, or because
 * one models something the other does not — and the whole value of this harness
 * is in *sorting* the differences, not in counting them. So every difference is
 * either matched by an entry in `known-divergences.json`, which has to give a
 * reason and a side, or it is unexplained and is printed at the top of the
 * report.
 *
 * ```
 * node tools/differential/compare.mjs            # markdown report on stdout
 * node tools/differential/compare.mjs --json     # the same thing as data
 * ```
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(here, name), 'utf8'));

/**
 * A dollar. Below it the two models agree: PolicyEngine computes in 32-bit
 * floats and several states round to whole dollars at different points, so
 * anything smaller is arithmetic noise rather than a reading of the law.
 */
const MATERIAL = 1;

const METRICS = [
  ['federal.adjustedGrossIncome', (r) => r.federal?.adjustedGrossIncome],
  ['federal.taxableIncome', (r) => r.federal?.taxableIncome],
  ['federal.incomeTaxBeforeCredits', (r) => r.federal?.incomeTaxBeforeCredits],
  ['federal.taxableSocialSecurity', (r) => r.federal?.taxableSocialSecurity],
  ['federal.childTaxCredit', (r) => r.federal?.childTaxCredit],
  ['federal.earnedIncomeCredit', (r) => r.federal?.earnedIncomeCredit],
  ['state.tax', (r) => r.state?.tax],
];

/**
 * `maxAbs` is the guard this file was missing, and Day 24 is what it cost.
 *
 * An entry matched on state and metric alone swallows EVERY difference in that
 * state. Four of the reasons in this file were stale on the morning of Day 24 —
 * they said "the caller must supply the pension", the engine had started
 * supplying it itself, and the differences left over in those states had four
 * entirely different causes: an Illinois child tax credit nobody here had heard
 * of, a Michigan exemption figure, a New York credit PolicyEngine does not
 * model, and a North Carolina child deduction. All four were hidden behind a
 * sentence about pensions, and the report called them explained.
 *
 * So a reason now states the size it claims. A difference larger than `maxAbs`
 * is reported as unexplained however well the rest of the entry matches, which
 * makes the report fail loudly in the one direction that matters: a known small
 * gap growing into an unknown large one.
 */
/**
 * Every dollar of income a case puts in front of either model.
 *
 * The denominator `maxShareOfIncome` is read against — see {@link match}. It is
 * the case's own figures rather than either model's answer, so the bound is a
 * property of the question and cannot move when an engine changes.
 */
function caseIncome(caseRow) {
  return (
    (caseRow.wages ?? 0) +
    (caseRow.pension ?? 0) +
    (caseRow.socialSecurity ?? 0) +
    (caseRow.longTermCapitalGains ?? 0) +
    (caseRow.taxExemptInterest ?? 0)
  );
}

/**
 * `maxAbs` is the guard this file was missing, and Day 24 is what it cost.
 *
 * An entry matched on state and metric alone swallows EVERY difference in that
 * state. Four of the reasons in this file were stale on the morning of Day 24 —
 * they said "the caller must supply the pension", the engine had started
 * supplying it itself, and the differences left over in those states had four
 * entirely different causes: an Illinois child tax credit nobody here had heard
 * of, a Michigan exemption figure, a New York credit PolicyEngine does not
 * model, and a North Carolina child deduction. All four were hidden behind a
 * sentence about pensions, and the report called them explained.
 *
 * So a reason states the size it claims. A difference larger than `maxAbs` is
 * reported as unexplained however well the rest of the entry matches, which
 * makes the report fail loudly in the one direction that matters: a known small
 * gap growing into an unknown large one.
 *
 * `maxShareOfIncome` is Day 25's addition, and it exists because **a reason
 * about a RATE cannot state its size in dollars.** The two models disagree
 * about one Maryland county's 2026 rate by 0.17 of a point, which is $43.76 on
 * a $30,000 household and $678.70 on a $400,000 one — the same single fact,
 * fifteen times the size. A `maxAbs` wide enough for the second is fifteen
 * times too wide for the first, and would quietly explain any Maryland defect
 * under $700. So a rate disagreement states its bound as a rate, and the two
 * fields add: the entry is allowed `maxAbs` dollars plus `maxShareOfIncome` of
 * the household's income, which is exactly the shape of "one rate differs, and
 * one fixed figure differs."
 *
 * `minAbs` is the mirror, and it exists because a bound in one direction only
 * lets a large reason swallow a small one. `direction` bounds the SIGN, which is
 * the one discriminator that is part of a reason's mechanism rather than of its
 * size. See the notes on both in `match`.
 */
function match(rule, caseRow, metric, delta) {
  if (rule.metric !== metric) return false;
  if (rule.state && rule.state !== caseRow.state) return false;
  if (rule.kind && rule.kind !== caseRow.kind) return false;
  if (rule.idIncludes && !caseRow.id.includes(rule.idIncludes)) return false;
  // `notStates` exists because of what Minnesota's arrival did to three entries
  // scoped by `kind` alone, and it is Day 24's lesson one level further out.
  //
  // `maxAbs` stops an entry absorbing a BIGGER difference in a state it is about.
  // Nothing stopped these three absorbing a difference in a state they have never
  // heard of: the moment the grid gained Minnesota, the $400,000 federal-itemiser
  // entry and the § 32(d) earned-income-credit entry both started claiming
  // Minnesota differences, and NEITHER MECHANISM CAN REACH A MINNESOTA RETURN —
  // Minnesota starts from federal AGI, so a federal itemised deduction is outside
  // its base entirely, and this package models no Minnesota earned income credit
  // for a federal difference to be multiplied by.
  //
  // THE RULE: an entry scoped by `kind` claims every state the grid is ever given,
  // including the ones added after the reason was written. A whitelist frozen to
  // whatever matched on the day would be the ratchet this file warns about
  // elsewhere, so the exclusion is explicit and each one has to be argued.
  if (rule.notStates && rule.notStates.includes(caseRow.state)) return false;
  if (rule.maxAbs !== undefined || rule.maxShareOfIncome !== undefined) {
    const bound =
      (rule.maxAbs ?? 0) + (rule.maxShareOfIncome ?? 0) * caseIncome(caseRow);
    if (Math.abs(delta) > bound) return false;
  }
  // `minAbs` is `maxAbs`'s mirror, added on Day 45 for Minnesota, and the case
  // for it is the same case: a reason states the size it claims, and SOME
  // reasons have a floor as well as a ceiling. Minnesota's three classes of
  // divergence differ by two orders of magnitude and by nothing else a rule can
  // see — an unmodelled refundable credit worth thousands, an unmodelled
  // alternative minimum tax worth hundreds, and a stale 2026 parameter worth a
  // few dollars — and they land on overlapping sets of households, so `state`,
  // `kind` and `idIncludes` cannot separate them.
  //
  // Without a floor the credit entry absorbs the parameter differences, which is
  // exactly Day 24's defect pointed the other way: the broad reason swallows the
  // narrow one and the report says the right number of differences for the wrong
  // reasons. With it, each entry claims a BAND and a difference outside every
  // band is unexplained, which is what the report is for.
  if (rule.minAbs !== undefined && Math.abs(delta) < rule.minAbs) return false;
  // `direction` is the third bound and the only one that is not about size, and
  // Minnesota is why it exists. Two of its entries overlap in magnitude and
  // cannot be separated by any band: an unmodelled refundable CREDIT and an
  // unmodelled alternative minimum TAX, both worth several hundred dollars on
  // neighbouring households.
  //
  // They can be separated by sign, and the sign is not a detail of the data — it
  // is part of each claim. A credit this package does not model can only make
  // PolicyEngine's answer LOWER than ours; a tax it does not model can only make
  // it HIGHER. An entry that matches a difference pointing the wrong way is
  // wrong about its own mechanism, whatever its size, so this is a check on the
  // reason rather than a filter on the data.
  //
  // `delta` is ours minus theirs.
  if (rule.direction === 'oursHigher' && delta <= 0) return false;
  if (rule.direction === 'theirsHigher' && delta >= 0) return false;
  return true;
}

/**
 * Refuse to report on answers that were given to a different grid.
 *
 * `out/theirs.json` is committed so CI can run the cheap half of this harness on
 * every push — this project's side regenerates in three seconds, PolicyEngine's
 * ten-minute pass does not. The price is that the committed answers can go stale
 * the moment `cases.mjs` changes, and nothing noticed: every id that survives a
 * widening still resolves, and every case whose FIGURES changed is then compared
 * against the answer to a different question, silently and in this project's
 * favour or against it at random.
 *
 * `theirs.py` now writes the SHA-256 of the exact cases file it read. If it does
 * not match the cases file in front of us, there is no report to write.
 */
function requireFreshTheirs() {
  const cases = readFileSync(join(here, 'out/cases.json'));
  const digest = createHash('sha256').update(cases).digest('hex');
  let recorded;
  try {
    recorded = readFileSync(join(here, 'out/theirs.cases.sha256'), 'utf8').trim();
  } catch {
    throw new Error(
      'out/theirs.cases.sha256 is missing. Re-run theirs.py — it writes the fingerprint ' +
        'of the cases file it answered, and without one there is no way to tell a fresh ' +
        'out/theirs.json from a stale one.',
    );
  }
  if (recorded !== digest) {
    throw new Error(
      `out/theirs.json answers a different grid. cases.json is ${digest.slice(0, 12)} and ` +
        `PolicyEngine last answered ${recorded.slice(0, 12)}. Re-run the PolicyEngine pass ` +
        '(tools/differential/README.md) and commit out/theirs.json with its sidecar.',
    );
  }
  requireExpectedReference();
}

/**
 * The second input, which went unguarded for thirteen days.
 *
 * A differential test has TWO inputs — the question and the model being compared
 * against — and the check above guards only the question. Day 39 ran
 * `pip install policyengine-us` and got **2.23.3** where every committed answer
 * had come from **2.15.3**, and all 29 Maryland households disagreed by thousands
 * of dollars: `$12,695.68` on a single worker at `$400,000`, where that case's
 * recorded divergence is `$678.70`.
 *
 * Nothing was wrong with Maryland. PolicyEngine had moved the Maryland county
 * income tax out of `state_income_tax`, the way Indiana's county tax has always
 * been outside it — `theirs.py`'s `LOCAL_OUTSIDE_STATE_TAX` is a map of exactly
 * that case and Maryland has now joined Indiana on the other side of the line.
 *
 * **THE RULE: a test whose reference is a dependency has a version in its
 * question, and a version nobody asserts is a question nobody fixed.** The
 * version has been recorded in `out/theirs.meta.json` since Day 26 and nothing
 * read it, so a reference that moved by eight minor versions presented as a wall
 * of unexplained differences in one state rather than as "the reference moved".
 *
 * Deliberately a hard failure and not a warning. A report produced against a
 * different model is not a worse report, it is a report about something else.
 */
const EXPECTED_POLICYENGINE = '2.15.3';

function requireExpectedReference() {
  let meta;
  try {
    meta = JSON.parse(readFileSync(join(here, 'out/theirs.meta.json'), 'utf8'));
  } catch {
    throw new Error(
      'out/theirs.meta.json is missing. theirs.py writes it, and without it there is no ' +
        'way to tell which PolicyEngine-US produced out/theirs.json.',
    );
  }
  if (meta.policyengine_us !== EXPECTED_POLICYENGINE) {
    throw new Error(
      `out/theirs.json came from policyengine-us ${meta.policyengine_us} and this harness ` +
        `expects ${EXPECTED_POLICYENGINE}. Upgrading the reference is a deliberate act: every ` +
        'entry in known-divergences.json is a statement about a particular version of a model ' +
        'that is still being developed, and a version bump re-opens all of them. Install ' +
        `\`policyengine-us==${EXPECTED_POLICYENGINE}\` and re-run, or change ` +
        'EXPECTED_POLICYENGINE here and re-read the whole report. Known at 2.23.3: Maryland\'s ' +
        'county income tax left `state_income_tax`, so theirs.py needs MD in ' +
        'LOCAL_OUTSIDE_STATE_TAX before that version can be compared like with like.',
    );
  }
}

export function compare() {
  requireFreshTheirs();
  const cases = read('out/cases.json');
  const ours = read('out/ours.json');
  const theirs = read('out/theirs.json');
  const known = read('known-divergences.json');
  const used = new Set();

  const diffs = [];
  const errors = [];
  let compared = 0;
  let agreed = 0;

  for (const c of cases) {
    const a = ours[c.id];
    const b = theirs[c.id];
    if (!a || !b) {
      errors.push({ id: c.id, error: !a ? 'missing from ours' : 'missing from theirs' });
      continue;
    }
    if (a.error || b.error) {
      errors.push({ id: c.id, error: a.error ?? b.error });
      continue;
    }
    for (const [metric, get] of METRICS) {
      const mine = get(a);
      const yours = get(b);
      if (mine === undefined || yours === undefined) continue;
      compared += 1;
      const delta = mine - yours;
      if (Math.abs(delta) < MATERIAL) {
        agreed += 1;
        continue;
      }
      // EVERY match, not the first one. `known.find` is what this was for a
      // month, and the first entry in file order won silently — so an entry with
      // no `maxAbs` absorbed every later difference in its state, including the
      // ones a MORE SPECIFIC entry further down the file was written for.
      //
      // It cost two real misstatements. Ohio's `$20`-per-exemption credit entry
      // was carrying four differences it cannot explain: a $275 municipal-interest
      // addition, two separate-return spouse differences that the
      // `separate-with-spouse` entry exists for, and a $316.09 earned income
      // credit difference belonging to an entry whose reason says "six states
      // set their earned income credit as a flat percentage of the federal one"
      // and names six. Ohio is the seventh, at 30%, and the report could not show
      // it because the Ohio entry matched first.
      //
      // THE RULE: a divergence entry with no bound absorbs the next difference in
      // its state, and the report that says "0 unexplained" is the last place that
      // will tell you. So a difference that matches TWO entries is now reported as
      // its own category — not unexplained, because a reason exists, but not
      // quietly explained either, because two reasons competed and file order
      // picked one.
      const matching = known.filter((k) => match(k, c, metric, delta));
      const rule = matching[0];
      diffs.push({
        id: c.id,
        state: c.state,
        kind: c.kind,
        metric,
        ours: mine,
        theirs: yours,
        delta,
        known: rule ? rule.reason : null,
        shadowed: matching.length > 1 ? matching.slice(1).map((k) => k.reason) : null,
      });
      for (const k of matching) used.add(k);
    }
  }

  // An entry that matches nothing is the other half of Day 24's lesson. A stale
  // reason that still matches hides defects behind it; a stale reason that
  // matches nothing is a claim about this project that stopped being true and
  // that nobody will notice, because a report only ever lists what it found.
  const dead = known.filter((k) => !used.has(k));
  return { compared, agreed, diffs, errors, dead, cases: cases.length };
}

function money(n) {
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function table(rows) {
  const lines = [
    '| case | metric | us-tax | PolicyEngine | difference |',
    '| --- | --- | ---: | ---: | ---: |',
  ];
  for (const d of rows) {
    lines.push(
      `| \`${d.id}\` | ${d.metric} | ${money(d.ours)} | ${money(d.theirs)} | ${money(d.delta)} |`,
    );
  }
  return lines.join('\n');
}

function report(result) {
  const unknown = result.diffs.filter((d) => d.known === null);
  const explained = result.diffs.filter((d) => d.known !== null);
  const byReason = new Map();
  for (const d of explained) {
    const list = byReason.get(d.known) ?? [];
    list.push(d);
    byReason.set(d.known, list);
  }

  const out = [];
  out.push('# Differential test against PolicyEngine-US');
  out.push('');
  out.push(
    `${result.cases} households, ${result.compared} figures compared, ` +
      `**${result.agreed} agree to the dollar** ` +
      `(${((result.agreed / result.compared) * 100).toFixed(1)}%).`,
  );
  out.push('');
  out.push(
    `${explained.length} differences are explained by \`known-divergences.json\`; ` +
      `**${unknown.length} are not.**`,
  );
  out.push('');
  if (result.errors.length) {
    out.push(`${result.errors.length} cases errored on one side and were not compared.`);
    out.push('');
  }

  out.push('## Unexplained');
  out.push('');
  if (unknown.length === 0) {
    out.push('None. Every difference has a recorded reason.');
  } else {
    out.push(table([...unknown].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))));
  }
  out.push('');

  // A difference two entries both claim. Not unexplained — a reason exists — and
  // not settled either, because file order chose between them and file order is
  // not an argument. Every one of these is either an entry that needs a bound or
  // two reasons for one fact.
  const contested = result.diffs.filter((d) => d.shadowed !== null);
  if (contested.length > 0) {
    out.push('## Claimed by more than one reason');
    out.push('');
    out.push(
      'Each of these differences matches two or more entries in ' +
        '`known-divergences.json`, and the first in file order is the one the ' +
        'counts below credit. **So those counts are not a partition, and file ' +
        'order is doing work no reason argues for.**',
    );
    out.push('');
    out.push(
      'Two different things end up here and they need different fixes. Most are ' +
        'genuinely multi-causal: one state figure nets several disagreements, so a ' +
        'separate return in Arizona differs by an Arizona credit **and** by ' +
        '§ 32(d) at once, and both entries are true of it. The rest are ' +
        'MIS-CREDITED — an entry with no `maxAbs` absorbs every later difference ' +
        'in its state, including ones a more specific entry was written for — and ' +
        'the tell is an entry whose reason names a figure smaller than the ' +
        'difference it is credited with. Ohio was the specimen: a ' +
        '`$20`-per-exemption credit entry was carrying a `$275` municipal-interest ' +
        'addition, two separate-return spouse differences, and a `$316.09` earned ' +
        'income credit difference whose own entry says "six states" and names six. ' +
        'Ohio is the seventh.',
    );
    out.push('');
    out.push(table([...contested].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))));
    out.push('');
    for (const d of contested) {
      out.push(`- \`${d.id}\` / ${d.metric} — credited to *${d.known.slice(0, 70)}…*`);
      for (const other of d.shadowed) out.push(`  - also matches *${other.slice(0, 70)}…*`);
    }
    out.push('');
  }

  if (result.dead.length > 0) {
    out.push('## Reasons that matched nothing');
    out.push('');
    out.push(
      'Each of these is an entry in `known-divergences.json` that no difference ' +
        'in this run matched. That is usually good news — the difference it ' +
        'described was fixed — and it is listed because a reason nobody can see ' +
        'go stale is how a report starts lying.',
    );
    out.push('');
    for (const k of result.dead) {
      const scope = [k.state, k.kind, k.idIncludes].filter(Boolean).join(' / ') || 'any';
      out.push(`- \`${k.metric}\` (${scope}) — ${k.reason}`);
    }
    out.push('');
  }

  out.push('## Explained');
  out.push('');
  for (const [reason, rows] of [...byReason].sort((a, b) => b[1].length - a[1].length)) {
    const worst = rows.reduce((m, r) => (Math.abs(r.delta) > Math.abs(m.delta) ? r : m));
    out.push(
      `- **${rows.length}** — ${reason} (largest: \`${worst.id}\`, ${money(worst.delta)})`,
    );
  }
  out.push('');
  return out.join('\n');
}

const result = compare();
if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(result, null, 1)}\n`);
} else {
  process.stdout.write(`${report(result)}\n`);
}
