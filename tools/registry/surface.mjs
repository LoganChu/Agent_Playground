#!/usr/bin/env node
/**
 * The registry surface: the three fields a stranger sees before deciding whether
 * to click, checked against what the registry actually serves.
 *
 * ## Why this exists, and it is the sharpest version of a rule this repository
 * ## already wrote down
 *
 * `packages/us-state-tax/test/readme.test.js` has said since Day 38:
 *
 * > THE RULE: the description is not documentation, it is the product listing,
 * > and a wrong number in it is wrong in the one place a buyer looks first.
 *
 * That is exactly right, and the check written under it compared the COUNTS
 * INSIDE the listing against the engine. It never checked the length of the
 * listing. So the listing grew to 10,071 characters while every count in it
 * stayed correct, and on Day 73 all six guarded claims were measured to sit
 * past the point where the registry stops reading:
 *
 *   us-state-tax  "42 states" at character 9,713 of a field npm serves 255 of
 *
 * > **A TEST THAT CHECKS THE NUMBERS IN A SENTENCE NOBODY RECEIVES PASSES
 * > FOREVER AND PROTECTS NOTHING.** The counts were right. The sentence was
 * > thrown away 9,458 characters before reaching them.
 *
 * And `packages/us-tax-mcp/test/discoverability.test.js` — whose own header
 * calls this metadata "the only reach lever this project controls" — asserted
 * `description.length > 200` with NO CEILING and `keywords.length >= 100` as a
 * FLOOR. Both bounds point away from the registry. The guard did not merely
 * miss the defect; it required it.
 *
 * > **A BOUND WRITTEN WITHOUT MEASURING THE CONSUMER IS A GUESS, AND CI THEN
 * > ENFORCES THE GUESS.** Every other bound in this repository is measured
 * > against a document, a form or a statute. The one on the only field that
 * > reaches a stranger was the one nobody measured.
 *
 * ## Where the 255 comes from, and why it is not transcribed
 *
 * It is not documented by npm. One blog post reports it. So it is MEASURED,
 * from the registry's own search index, by `--measure`: 1,497 packages sampled
 * over six queries on Day 73, the longest description seen was exactly 255
 * characters, 43 packages sat exactly at 255, and every one of those 43 ended
 * MID-WORD ("ice, SEP IRA vs Solo", "ding (half-up/half-d"). A natural
 * distribution of hand-written sentences does not pile 43 packages onto one
 * exact length and cut all of them mid-word. That is a hard cap, not a habit.
 *
 * `--measure` re-derives it on demand rather than trusting this paragraph,
 * which is the rule `tools/preflight.mjs` learned about durations in prose.
 *
 * ## The chars-or-bytes question, settled by measurement rather than left open
 *
 * A cap of "255" could be 255 characters or 255 bytes, and the two differ for
 * any description with a non-ASCII character in it. `--measure` answers it by
 * looking for a sampled description at exactly the cap whose byte length is
 * LARGER than its character length: if one exists the cap is counted in
 * characters. Until that returns an answer this file requires BOTH to be within
 * the cap, which is correct under either reading and costs a few characters.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PACKAGES = ['us-federal-tax', 'us-state-tax', 'us-tax-mcp'];

/** The registry's description cap, in characters. Re-derive with `--measure`. */
export const DESCRIPTION_CAP = 255;

/**
 * A card needs enough to say what the thing is. This floor is the one bound
 * Day 38 got right, kept at its original value.
 */
export const DESCRIPTION_FLOOR = 200;

/**
 * The keyword ceiling, measured the same way: across the same 1,497 packages
 * the median was 4 keywords, the 90th percentile 11, the 99th 25, and the
 * single most keyword-stuffed package in the sample carried 55. 25 is the 99th
 * percentile — generous against observed practice and still 10x below the 266
 * this repository was carrying.
 */
export const KEYWORD_CAP = 25;
export const KEYWORD_FLOOR = 10;

const REPO = 'https://github.com/LoganChu/Agent_Playground';

/** The nouns `readme.test.js` guards counts for; each must survive the cut. */
const GUARDED_NOUNS = ['states', 'local income taxes', 'municipalities'];

export function readManifest(name) {
  return JSON.parse(readFileSync(join(ROOT, 'packages', name, 'package.json'), 'utf8'));
}

/** Every problem with one manifest's registry surface, as a list of strings. */
export function checkManifest(name, pkg) {
  const bad = [];
  const d = pkg.description;

  if (typeof d !== 'string' || !d) {
    bad.push('no description at all: the registry card renders blank');
    return bad;
  }

  const chars = d.length;
  const bytes = Buffer.byteLength(d, 'utf8');
  if (chars > DESCRIPTION_CAP) {
    bad.push(
      `description is ${chars} characters and the registry serves ${DESCRIPTION_CAP}: ` +
        `${chars - DESCRIPTION_CAP} characters (${((100 * (chars - DESCRIPTION_CAP)) / chars).toFixed(1)}%) ` +
        `are discarded, cut mid-word after ${JSON.stringify(d.slice(DESCRIPTION_CAP - 20, DESCRIPTION_CAP))}`,
    );
  }
  if (bytes > DESCRIPTION_CAP) {
    bad.push(`description is ${bytes} UTF-8 bytes and the cap may be counted in bytes`);
  }
  if (chars < DESCRIPTION_FLOOR) {
    bad.push(`description is ${chars} characters, under the ${DESCRIPTION_FLOOR} a card needs`);
  }

  // The generalisation of the Day 73 defect: a count claim is only a claim if a
  // reader receives it. This keeps holding if the description grows again.
  const served = d.slice(0, DESCRIPTION_CAP);
  for (const noun of GUARDED_NOUNS) {
    const re = new RegExp(`([0-9][0-9,]*) ${noun}`, 'g');
    for (const m of d.matchAll(re)) {
      if (m.index >= DESCRIPTION_CAP) {
        bad.push(
          `the claim "${m[0]}" sits at character ${m.index}, past the ${DESCRIPTION_CAP} the ` +
            `registry serves: readme.test.js guards a number no reader receives`,
        );
      }
    }
    const inServed = [...served.matchAll(re)];
    if (inServed.length > 1) {
      bad.push(`"${noun}" is claimed ${inServed.length} times inside the served description`);
    }
  }

  const kw = pkg.keywords;
  if (!Array.isArray(kw) || kw.length === 0) {
    bad.push('no keywords: the package matches no registry search');
  } else {
    if (kw.length > KEYWORD_CAP) {
      bad.push(
        `${kw.length} keywords, above the ${KEYWORD_CAP} that is the 99th percentile of ` +
          `observed practice: a list this long dilutes every term in it`,
      );
    }
    if (kw.length < KEYWORD_FLOOR) bad.push(`${kw.length} keywords, under ${KEYWORD_FLOOR}`);
    const seen = new Map();
    for (const k of kw) seen.set(k, (seen.get(k) ?? 0) + 1);
    for (const [k, n] of seen) if (n > 1) bad.push(`keyword "${k}" appears ${n} times`);
    for (const k of kw) {
      if (typeof k !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(k)) {
        bad.push(`not a registry-shaped keyword: ${JSON.stringify(k)}`);
      } else if (k.length > 40) {
        bad.push(`keyword too long to be searched for: ${k}`);
      }
    }
  }

  // Without these the registry page has no link back here, which is the whole
  // path from "a stranger found the package" to "a stranger read the proof".
  if (pkg.homepage !== `${REPO}/tree/main/packages/${name}#readme`) {
    bad.push(`homepage is ${JSON.stringify(pkg.homepage)}: no link from the registry page to the docs`);
  }
  if (pkg.bugs !== `${REPO}/issues`) {
    bad.push(`bugs is ${JSON.stringify(pkg.bugs)}: the registry page offers nowhere to report`);
  }
  const r = pkg.repository;
  if (!r || r.type !== 'git' || r.url !== `git+${REPO}.git` || r.directory !== `packages/${name}`) {
    bad.push(`repository is ${JSON.stringify(r)}: no source link, and no "Repository" on the card`);
  }
  if (pkg.license !== 'MIT') bad.push(`license is ${JSON.stringify(pkg.license)}`);

  return bad;
}

/**
 * Re-derive the cap from the registry's own search index. Prints what it found
 * and does not write it anywhere: a figure this file carries as a constant is
 * one a reader can check rather than one a run can quietly move.
 */
async function measure() {
  const queries = ['tax', 'calculator', 'finance', 'payroll', 'mcp-server', 'typescript'];
  const rows = [];
  for (const q of queries) {
    const r = await fetch(`https://registry.npmjs.org/-/v1/search?text=${q}&size=250`);
    if (!r.ok) {
      console.log(`  ${q}: HTTP ${r.status} — skipped`);
      continue;
    }
    for (const o of (await r.json()).objects ?? []) {
      const p = o.package ?? {};
      if (typeof p.description === 'string') {
        rows.push({
          name: p.name,
          chars: p.description.length,
          bytes: Buffer.byteLength(p.description, 'utf8'),
          tail: p.description.slice(-22),
          keywords: Array.isArray(p.keywords) ? p.keywords.length : 0,
        });
      }
    }
  }
  if (!rows.length) {
    console.log('no packages sampled — the registry did not answer. Nothing re-derived.');
    process.exitCode = 1;
    return;
  }
  rows.sort((a, b) => b.chars - a.chars);
  const max = rows[0].chars;
  const atMax = rows.filter((x) => x.chars === max);
  console.log(`sampled ${rows.length} published packages over ${queries.length} queries`);
  console.log(`longest description: ${max} characters`);
  console.log(`packages sitting exactly at it: ${atMax.length}`);
  for (const x of atMax.slice(0, 6)) console.log(`    ${x.name}  ...${JSON.stringify(x.tail)}`);

  // chars or bytes: a description AT the cap whose byte length EXCEEDS it
  // settles that the cap is counted in characters.
  const wide = atMax.find((x) => x.bytes > x.chars);
  console.log(
    wide
      ? `\ncap is counted in CHARACTERS: ${wide.name} is ${wide.chars} chars / ${wide.bytes} bytes`
      : '\nchars-or-bytes UNSETTLED: no sampled description at the cap had a non-ASCII character',
  );

  const kw = rows.map((x) => x.keywords).sort((a, b) => a - b);
  const at = (p) => kw[Math.floor(kw.length * p)];
  console.log(
    `\nkeyword counts: median ${at(0.5)}  p90 ${at(0.9)}  p99 ${at(0.99)}  max ${kw[kw.length - 1]}`,
  );
  console.log(
    `\nthis file carries DESCRIPTION_CAP=${DESCRIPTION_CAP} and KEYWORD_CAP=${KEYWORD_CAP}.` +
      (max === DESCRIPTION_CAP ? ' The cap agrees.' : ` THE CAP DISAGREES: measured ${max}.`),
  );
}

async function main() {
  if (process.argv.includes('--measure')) return measure();
  let bad = 0;
  for (const name of PACKAGES) {
    const problems = checkManifest(name, readManifest(name));
    const pkg = readManifest(name);
    if (problems.length) {
      bad += problems.length;
      console.log(`FAIL ${name}`);
      for (const p of problems) console.log(`       ${p}`);
    } else {
      console.log(
        `ok   ${name.padEnd(15)} ${String(pkg.description.length).padStart(3)}/${DESCRIPTION_CAP} chars served whole, ` +
          `${pkg.keywords.length} keywords, homepage + bugs + repository present`,
      );
    }
  }
  if (bad) {
    console.log(`\n${bad} problem${bad === 1 ? '' : 's'} on the registry surface.`);
    process.exitCode = 1;
  } else {
    console.log(`\nok — ${PACKAGES.length} packages, every registry card served whole.`);
  }
}

// Only as a CLI. `discoverability.test.js` imports `checkManifest` and the four
// bounds from this file, and the first run of that test printed this tool's
// whole report into the TAP stream — a module that audits three packages the
// moment it is imported is a side effect no caller asked for.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
