/**
 * The audit harness, and the three things that could make it worthless.
 *
 * It could **miss** — a product wrong in one of the documented ways and the
 * report silent. It could **lie** — a `recomputed` diagnosis that does not
 * recompute, which is the one claim in the report a reader cannot check without
 * re-running the engine themselves. Or it could **flatter** — explain every gap
 * it is shown, which would make the headline's `disagreements it does NOT`
 * line a decoration.
 *
 * So the assertions here are **ceilings and sets, not floors**. Day 73 found
 * three guards in this repository that were all floors — `description.length >
 * 200` against a 255-character cap, `keywords.length >= 100` against a 99th
 * percentile of 25, `covered > 2_000` against 7,009 — and the lesson was that a
 * bound written without measuring the consumer enforces the guess. The consumer
 * here is a buyer reading a report, and what they need is that the set of
 * findings is EXACTLY right: a class that stopped firing has to fail, and so
 * does a class that started firing where it should not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stateIncomeTax } from '../../packages/us-state-tax/dist/esm/index.js';
import { normaliseRow, readMoney, parseCsv, readRows, engineInput, COLUMNS } from './household.mjs';
import { diagnose, equalToCent } from './diagnose.mjs';
import { auditFile, reportFor, summarise, DEMO } from './audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const demo = () => auditFile(DEMO);
const taxFor = (household) => stateIncomeTax(engineInput(household).base);

test('spreadsheet money is read the way a spreadsheet writes it', () => {
  assert.equal(readMoney('$1,234.56'), 1234.56);
  assert.equal(readMoney('1234.56'), 1234.56);
  assert.equal(readMoney(' $80,000 '), 80000);
  // Accounting parentheses. A buyer's export uses them for a refundable credit
  // that took the bill below zero, which is a real state answer in New York.
  assert.equal(readMoney('(13.94)'), -13.94);
  assert.equal(readMoney('-13.94'), -13.94);
  assert.equal(readMoney(''), 0);
  assert.equal(readMoney(null), 0);
  assert.throws(() => readMoney('about four hundred'), /not a number/);
  assert.throws(() => readMoney('1.2.3'), /not a number/);
});

test('a CSV with a comma inside a quoted field is one field', () => {
  const rows = parseCsv('id,note,theirTax\na,"Howard County, Maryland",5786.41\n');
  assert.deepEqual(rows, [{ id: 'a', note: 'Howard County, Maryland', theirTax: '5786.41' }]);
  // Doubled quotes, and \r\n, because a Windows export produces both.
  const quoted = parseCsv('id,note\r\nb,"she said ""no"""\r\n');
  assert.equal(quoted[0].note, 'she said "no"');
});

test('JSON input is accepted as an array or under a rows key', () => {
  const one = [{ state: 'VA', year: 2025, filingStatus: 'single', theirTax: 1 }];
  assert.equal(readRows(JSON.stringify(one), 'x.json').length, 1);
  assert.equal(readRows(JSON.stringify({ rows: one }), 'x.json').length, 1);
  assert.throws(() => readRows('{"households":[]}', 'x.json'), /array/);
});

test('a row missing one of the four required columns is refused by name', () => {
  assert.throws(
    () => normaliseRow({ state: 'VA', year: 2025, filingStatus: 'single' }, 0),
    /row 1 is missing theirTax/,
  );
  assert.throws(() => normaliseRow({ year: 2025, filingStatus: 'single', theirTax: 1 }, 4), /row 5/);
});

test('a filing status this engine does not have is refused, with the five listed', () => {
  // Refused rather than guessed. A product that stores `married` as a boolean
  // has to decide between joint and separate before it can ask a question, and
  // guessing on its behalf would put this harness's choice in the buyer's
  // column and then report the difference as their defect.
  assert.throws(
    () => normaliseRow({ state: 'VA', year: 2025, filingStatus: 'married', theirTax: 1 }, 0),
    /marriedFilingJointly/,
  );
});

test('every field this harness defaulted is named on the row it affected', () => {
  const { defaulted, unknownColumns } = normaliseRow(
    { state: 'VA', year: 2025, filingStatus: 'marriedFilingJointly', theirTax: 1, favourite: 'x' },
    0,
  );
  // The whole point of the list: a default is not a fact, and a report that
  // hides which figures it invented is a report that blames the buyer for this
  // harness's silence.
  assert.ok(defaulted.includes('wages treated as 0'));
  assert.ok(defaulted.includes('primaryAge treated as 40'));
  assert.ok(defaulted.includes('spouseAge absent on a married return'));
  assert.deepEqual(unknownColumns, ['favourite']);
});

test('a correct figure produces agreement and NO diagnoses at all', () => {
  // The flattery check at its simplest. A tool that finds something to say
  // about a figure that is right to the cent is worse than useless to a buyer,
  // because the one row they can verify by hand is the one that discredits it.
  const row = normaliseRow(
    { id: 'ok', state: 'VA', year: 2025, filingStatus: 'single', wages: 65000, primaryAge: 40, theirTax: 2923.4 },
    0,
  );
  const out = diagnose(row);
  assert.equal(out.agreement, true);
  assert.equal(out.diagnoses.length, 0);
  assert.ok(equalToCent(out.gap, 0));
});

test('a cent of disagreement is a disagreement, and it is the rounding class', () => {
  const row = normaliseRow(
    { id: 'cent', state: 'VA', year: 2025, filingStatus: 'single', wages: 65000, primaryAge: 40, theirTax: 2923.41 },
    0,
  );
  const out = diagnose(row);
  assert.equal(out.agreement, false);
  assert.deepEqual(
    out.diagnoses.map((d) => d.kind),
    ['rounding'],
  );
});

test('the demo exercises EXACTLY these finding classes, no more and no fewer', () => {
  // A SET, not a count, and not a floor.
  //
  // `demo-synthetic.csv` is built so that each row is wrong in one documented
  // way. If a rule parameter moves and a row stops demonstrating its class, the
  // report would still look plausible and the golden-file diff would show a
  // number changing — this names which demonstration was lost. And if a new
  // class starts firing on a row that was meant to show one thing, that is a
  // false positive on the only input a stranger runs first.
  const kinds = new Set(demo().flatMap((row) => row.diagnoses.map((d) => d.kind)));
  assert.deepEqual(
    [...kinds].sort(),
    [
      'credit-omitted',
      'credits-not-applied',
      'filing-status',
      'local-tax-omitted',
      'no-income-tax-state',
      'rounding',
      'stale-parameters',
      'supplied-figure-not-spent',
      'surtax-omitted',
      'top-rate-on-whole-base',
    ],
    'the demo no longer demonstrates one class, or demonstrates a new one',
  );
});

test('the demo leaves exactly one gap unexplained, and says so', () => {
  // The honesty line in the headline, pinned. A change that made this tool
  // explain `payroll-011` would be a change worth reading, and a change that
  // made it stop explaining one of the other nine would be a regression; both
  // fail here rather than being averaged into a percentage.
  const s = summarise(demo());
  assert.equal(s.scored.length, 12);
  assert.equal(s.agree.length, 1);
  assert.equal(s.differ.length, 11);
  assert.equal(s.unexplained.length, 1);
  assert.deepEqual(
    s.unexplained.map((row) => row.id),
    ['payroll-011'],
  );
});

test('every `recomputed` diagnosis really does recompute, checked outside the diagnoser', () => {
  // THE CLAIM A READER CANNOT CHECK, CHECKED.
  //
  // `recomputed` is the strongest thing the report says: "the engine was re-run
  // with one thing changed and returned your figure." A reader has to take that
  // on trust unless they re-run it. So this test re-runs it, from the row's own
  // household, through `stateIncomeTax` directly — not through `diagnose` — and
  // requires the buyer's figure back to the cent. A diagnoser that mislabelled a
  // guess as `recomputed` fails here even if every other test passes.
  let checked = 0;
  for (const row of demo()) {
    for (const d of row.diagnoses) {
      if (d.evidence !== 'recomputed') continue;
      const override =
        d.kind === 'stale-parameters'
          ? { year: Number(d.title.match(/tax year (\d{4})/)[1]) }
          : d.kind === 'supplied-figure-not-spent'
            ? { taxExemptInterest: 0 }
            : { filingStatus: d.title.match(/answer for (\w+),/)[1] };
      const again = taxFor({ ...row.household, ...override });
      assert.ok(
        equalToCent(again.totalTax, row.theirTax),
        `${row.id}: ${d.kind} claimed ${row.theirTax} but re-running gives ${again.totalTax}`,
      );
      checked += 1;
    }
  }
  assert.equal(checked, 3, `${checked} recomputed diagnoses were re-verified`);
});

test('every diagnosis carries one of the three evidence classes and a dollar amount', () => {
  for (const row of demo()) {
    for (const d of row.diagnoses) {
      assert.ok(
        ['recomputed', 'arithmetic'].includes(d.evidence),
        `${row.id}: unknown evidence class ${d.evidence}`,
      );
      assert.ok(typeof d.kind === 'string' && d.kind.length > 0, `${row.id}: no kind`);
      assert.ok(Number.isFinite(d.amount), `${row.id}: ${d.kind} has no dollar amount`);
      assert.ok(d.detail.length > 40, `${row.id}: ${d.kind} explains nothing`);
    }
  }
});

test('the arithmetic each class claims is the arithmetic that holds', () => {
  // Each branch of `arithmeticMatches` asserts an identity about the buyer's
  // figure. Here each identity is re-checked from the engine's result, so a
  // branch that fires on the wrong condition fails even where the headline
  // looks right.
  for (const row of demo()) {
    const r = row.result;
    for (const d of row.diagnoses) {
      if (d.kind === 'local-tax-omitted') {
        assert.ok(equalToCent(r.tax, row.theirTax), `${row.id}: not the state line`);
        assert.ok(r.localTaxes.length > 0, `${row.id}: no locality to omit`);
      }
      if (d.kind === 'credits-not-applied') {
        const local = r.localTaxes.reduce((sum, l) => sum + l.tax, 0);
        assert.ok(
          equalToCent(r.taxBeforeCredits, row.theirTax) ||
            equalToCent(r.taxBeforeCredits + local, row.theirTax),
          `${row.id}: not the before-credits figure`,
        );
      }
      if (d.kind === 'credit-omitted') {
        const amounts = r.credits.map((c) => c.amount);
        assert.ok(
          amounts.some((amount) => amount > 0 && equalToCent(r.totalTax + amount, row.theirTax)),
          `${row.id}: no single credit accounts for the gap`,
        );
      }
      if (d.kind === 'surtax-omitted') {
        assert.ok(
          r.surtaxes.some((s) => s.amount > 0 && equalToCent(r.totalTax - s.amount, row.theirTax)),
          `${row.id}: no surtax accounts for the gap`,
        );
      }
      if (d.kind === 'no-income-tax-state') {
        assert.equal(r.hasIncomeTax, false, `${row.id}: that state does tax income`);
      }
      if (d.kind === 'rounding') assert.ok(Math.abs(row.gap) < 1, `${row.id}: over a dollar`);
      if (d.kind === 'top-rate-on-whole-base') {
        const top = r.brackets.reduce((best, band) => Math.max(best, band.rate), 0);
        assert.ok(r.brackets.length > 1, `${row.id}: a flat state has no top band`);
        assert.ok(
          equalToCent(Math.round(top * r.taxableIncome * 100) / 100, row.theirTax),
          `${row.id}: not the top rate on the whole base`,
        );
      }
    }
  }
});

test('the report names every household, both figures and every gap', () => {
  const rows = demo();
  const report = reportFor(rows, 'demo');
  for (const row of rows) {
    assert.ok(report.includes(row.id), `${row.id} is missing from the report`);
  }
  // The four things `OFFER.md` promises a disagreement entry contains.
  assert.match(report, /## Every disagreement/);
  assert.match(report, /\*\*UNEXPLAINED\.\*\*/);
  assert.match(report, /disagreements it does NOT/);
  assert.match(report, /## What this tool cannot do/);
  // And the citations, which are the "statute line that settles it" half.
  assert.ok(report.includes('law.justia.com') || report.includes('http'), 'no documents cited');
});

test('the report is deterministic — no clock, no ordering by chance', () => {
  // The golden-file pattern needs this, and the pattern is why there is no
  // timestamp in the report: a date in a committed artefact turns every CI run
  // after midnight into a diff.
  assert.equal(reportFor(demo(), 'demo'), reportFor(demo(), 'demo'));
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(reportFor(demo(), 'demo')), 'the report carries a timestamp');
});

test('the committed report is the one this code produces', () => {
  // The same check CI runs, run here too, so a local test pass means the commit
  // is clean rather than meaning the next push will go red.
  const committed = readFileSync(resolve(HERE, 'out/REPORT.md'), 'utf8');
  assert.equal(
    reportFor(demo(), 'tools/audit/demo-synthetic.csv'),
    committed,
    'tools/audit/out/REPORT.md is out of date — regenerate it (see tools/audit/README.md)',
  );
});

test('importing the audit modules audits nothing and prints nothing', () => {
  // Day 73's defect, which `tools/registry/surface.mjs` shipped: a module that
  // ran its whole report at import time, so the first test that imported one
  // function from it printed three packages into the TAP stream.
  for (const module of ['tools/audit/audit.mjs', 'tools/audit/household.mjs', 'tools/audit/diagnose.mjs']) {
    const out = execFileSync(
      process.execPath,
      ['-e', `import(${JSON.stringify(resolve(ROOT, module))}).then(() => {})`],
      { cwd: ROOT, encoding: 'utf8' },
    );
    assert.equal(out, '', `importing ${module} printed ${JSON.stringify(out.slice(0, 120))}`);
  }
});

test('the CLI with no input explains itself and exits non-zero', () => {
  let status = 0;
  let stdout = '';
  try {
    stdout = execFileSync(process.execPath, ['tools/audit/audit.mjs'], { cwd: ROOT, encoding: 'utf8' });
  } catch (error) {
    status = error.status;
    stdout = error.stdout;
  }
  assert.equal(status, 1);
  // Every column it reads is in the usage, because the commonest reason a
  // stranger abandons a CLI is not knowing what to put in the file.
  for (const column of Object.keys(COLUMNS)) {
    assert.ok(stdout.includes(column), `the usage does not mention ${column}`);
  }
});

test('a household the engine refuses is reported as that row, not as a crash', () => {
  // An audit of 10,000 households that dies on row 7 has audited nothing. The
  // row carries its error and the report has a section for them.
  const out = diagnose(
    normaliseRow({ id: 'bad', state: 'ZZ', year: 2025, filingStatus: 'single', theirTax: 1 }, 0),
  );
  assert.ok(out.error, 'an unsupported state produced no error');
  assert.deepEqual(out.diagnoses, []);
  assert.match(reportFor([out], 'x'), /Rows that could not be computed/);
});
