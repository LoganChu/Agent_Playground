#!/usr/bin/env node
/**
 * DOES ANYTHING EVER FETCH THIS — measured in a way the release pipeline cannot
 * reset, and cohort-matched so the comparison is between equal exposures.
 *
 *   node tools/reach.mjs              # the report, from the live API and the ledger
 *   node tools/reach.mjs --record     # the same, and bank today's observation
 *   node tools/reach.mjs --check      # one line, non-zero if the ledger is unreadable
 *
 * ## Why this exists, and it is a correction of two days' readings
 *
 * This repository's only question about money is whether anything reaches a
 * person, and since Day 80 the instrument has been release-asset download
 * counts, read by hand out of `gh api`. **The hand reading was wrong on two
 * consecutive days, in both directions.**
 *
 * `dist.yml` uploads the two single-file HTML pages with `--clobber`, which does
 * not overwrite an asset but REPLACES the asset object: new id, new
 * `created_at`, `download_count` back to zero. Day 80 found that and added a
 * sha256 guard so an UNCHANGED page keeps its counter. The guard works. It just
 * does not help, because both pages inline all sixty-eight engine modules, so
 * every day the engine changes both pages change and both counters are reset.
 *
 * What the three readings actually were:
 *
 * ```text
 *   Day 84   .tgz  110 assets  565 dl   .html 0 and 0     "not one of them of
 *                                                          the two things a
 *                                                          person would look at"
 *   Day 85   .tgz  112 assets  570 dl   .html 1 and 1     "both went from zero to
 *                                                          one after FOUR DAYS at
 *                                                          zero — that is a sweep"
 *   Day 86   .tgz  114 assets  578 dl   .html 0 and 0     the assets were replaced
 *                                                          at 2026-11-19T20:44:25Z
 * ```
 *
 * Neither conclusion was supported by its data. **Day 84 compared a lifetime
 * total against a counter hours old**: the oldest tarball has been accumulating
 * for 49 days and the pages for less than one, so `565 vs 0` is mostly a
 * comparison of two ages. **Day 85's "four days at zero" never happened** — the
 * asset objects it read were about twenty hours old, because Day 84's own push
 * had replaced them. Reading `0` off a counter that was created this morning and
 * calling it evidence about four days is the Day 80 defect again, one level up:
 * Day 80 stopped resetting the counter unnecessarily and nobody stopped reading
 * the counter as though it were cumulative.
 *
 * > **THE RULE: A COUNTER YOUR OWN PIPELINE RESETS IS A RATE, NOT A TOTAL, AND
 * > A RATE READ AS A TOTAL IS WRONG BY THE AGE OF THE THING YOU ARE READING.**
 *
 * ## The two fixes, because there are two different errors
 *
 * **1. COHORT MATCHING.** The pages and two of the tarballs are created by the
 * same job on the same push, minutes apart. Comparing those four is a controlled
 * comparison; comparing the pages against a tarball from October is not. The
 * report groups assets by the push that created them.
 *
 * **2. A LEDGER THE PIPELINE CANNOT RESET.** GitHub keeps no history for a
 * replaced asset, so a lifetime total cannot be recovered from the API — but it
 * can be accumulated here. Each run banks `{id, name, created_at, downloads}`.
 * When an id disappears its last observation stays banked, so the total for a
 * NAME is the sum over every generation of it this project has ever seen.
 *
 * **That total is a LOWER BOUND and the file says so.** A generation created and
 * replaced between two runs is never observed, and its downloads are lost for
 * good. With one run a day and pushes mostly on the same schedule the gap is
 * small, but it is a gap and not a rounding error, and a number in this
 * repository that is a lower bound has to be labelled as one.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = join(ROOT, 'tools', 'reach.json');
const REPO = process.env.REACH_REPO ?? 'LoganChu/Agent_Playground';

/** Assets created within this many minutes of each other came from one push. */
const COHORT_MINUTES = 10;

/**
 * The headline comparison's window, as a fraction of the youngest page's age.
 *
 * It is NOT the push cohort, and the difference is a reading taken today. Both
 * pages and two tarballs were made by Day 85's work, and they are not the same
 * cohort: the tarballs went up on the version-bump push and the pages were
 * re-uploaded about two hours later by a second push, because the cliff fix
 * moved the bytes the pages inline. Grouping by push puts them in different
 * groups and compares each against nothing.
 *
 * What makes the comparison fair is EQUAL EXPOSURE, not a shared push, so the
 * window is on age: every asset within +/-40% of the youngest page's age. Today
 * that is 0.82 days for the pages against 0.90 for the tarballs — a 10%
 * difference, where Day 84 compared against assets 60 times older.
 */
const MATCH_TOLERANCE = 0.4;

const kind = (name) => (name.endsWith('.html') ? 'page' : name.endsWith('.tgz') ? 'tarball' : 'other');

function live() {
  const out = execFileSync(
    'gh',
    ['api', '--paginate', `repos/${REPO}/releases?per_page=100`, '--jq',
      '.[] | .tag_name as $t | .assets[] | [$t, .name, (.id|tostring), (.download_count|tostring), .created_at] | @tsv'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  return out
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const [tag, name, id, downloads, createdAt] = l.split('\t');
      return { tag, name, id, downloads: Number(downloads), createdAt };
    });
}

/**
 * The INBOUND half, added the same day the repository first had an inbound
 * channel to measure.
 *
 * Every journal entry since Day 78 opens by reading these fields by hand, and
 * the ritual is the problem: `has_issues` was `true` in every one of those
 * readings and no entry noticed, because nobody was reading the line for that.
 * A number a human copies each morning is a number nobody is watching.
 *
 * `open_issues_count` is the one that matters now. It has been 0 for eighty-six
 * days, and the day it is not is the most important day this repository has had
 * — somebody found it and wanted something. The report says so in those words,
 * because a 1 in a column of zeros is exactly the change an eye slides over.
 */
function repoFacts() {
  const out = execFileSync(
    'gh',
    ['api', `repos/${REPO}`, '--jq',
      '[.description // "null", (.topics|length|tostring), .homepage // "null", (.has_issues|tostring), ' +
      '(.has_pages|tostring), (.stargazers_count|tostring), (.forks_count|tostring), ' +
      '(.open_issues_count|tostring), (.subscribers_count|tostring)] | @tsv'],
    { encoding: 'utf8' },
  ).trim().split('\t');
  const [description, topics, homepage, hasIssues, hasPages, stars, forks, openIssues, watchers] = out;
  return {
    description,
    topics: Number(topics),
    homepage,
    hasIssues: hasIssues === 'true',
    hasPages: hasPages === 'true',
    stars: Number(stars),
    forks: Number(forks),
    openIssues: Number(openIssues),
    watchers: Number(watchers),
  };
}

/**
 * The fields whose movement is the whole point of the inbound series. A field
 * NOT on this list cannot create a row, so adding one here is how a future run
 * starts watching something new.
 */
export const WATCHED_REPO_FIELDS = [
  'stars',
  'forks',
  'openIssues',
  'watchers',
  'topics',
  'hasIssues',
  'hasPages',
  'description',
  'homepage',
];

/**
 * The two inbound conditions worth interrupting a run for, as text.
 *
 * Extracted from the report so they can be tested, and they are the two lines
 * in this file most likely to be WRONG ON THE DAY THEY FIRE, because neither
 * can be exercised against the live repository: this session's GitHub access is
 * scoped to one repo, and that repo has had issues enabled and zero of them for
 * every day of this project. A branch that has never run is a claim — Day 84 —
 * so these are driven from fixtures instead.
 */
export function inboundAlarms(facts) {
  const alarms = [];
  if (!facts.hasIssues) {
    alarms.push(
      'ISSUES ARE TURNED OFF. Every contact link in CONTACT.md, OFFER.md, the root ' +
        'README and all three package READMEs now points at a repository with no Issues ' +
        'tab. This is the one thing contact-address.mjs cannot see.',
    );
  } else if (facts.openIssues > 0) {
    alarms.push(
      `${facts.openIssues} OPEN ISSUE(S). This has been 0 for every day of this project. ` +
        'Somebody found this repository and wanted something. Read them before anything ' +
        'else in the run, and answer them: it is the first inbound contact there has ever ' +
        'been, and nothing else measured here comes close in value.',
    );
  }
  return alarms;
}

/** Two readings of the repository's own fields, same in every watched field. */
export function sameRepoState(a, b) {
  if (a === undefined || b === undefined) return false;
  return WATCHED_REPO_FIELDS.every((k) => a[k] === b[k]);
}

function loadLedger() {
  if (!existsSync(LEDGER)) {
    return {
      note:
        'Release-asset downloads, banked per asset GENERATION because `dist.yml --clobber` ' +
        'replaces an asset object and resets its counter. Totals per NAME are a LOWER BOUND: ' +
        'a generation created and replaced between two runs of tools/reach.mjs is never seen. ' +
        'Written by tools/reach.mjs --record.',
      firstRecorded: null,
      lastRecorded: null,
      runs: 0,
      generations: {},
      repo: [],
    };
  }
  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
  ledger.repo ??= [];
  return ledger;
}

function bank(ledger, assets, now) {
  for (const a of assets) {
    const prev = ledger.generations[a.id];
    ledger.generations[a.id] = {
      name: a.name,
      tag: a.tag,
      createdAt: a.createdAt,
      downloads: Math.max(a.downloads, prev?.downloads ?? 0),
      firstSeen: prev?.firstSeen ?? now,
      lastSeen: now,
    };
  }
  ledger.firstRecorded ??= now;
  ledger.lastRecorded = now;
  ledger.runs = (ledger.runs ?? 0) + 1;
  return ledger;
}

/** Per name: every generation ever banked, summed, and how many are gone. */
function cumulative(ledger, liveIds) {
  const byName = new Map();
  for (const [id, g] of Object.entries(ledger.generations)) {
    const e = byName.get(g.name) ?? { name: g.name, generations: 0, retired: 0, downloads: 0, live: 0 };
    e.generations += 1;
    e.downloads += g.downloads;
    if (liveIds.has(id)) e.live += g.downloads;
    else e.retired += 1;
    byName.set(g.name, e);
  }
  return [...byName.values()].sort((a, b) => b.downloads - a.downloads);
}

function cohorts(assets) {
  const sorted = [...assets].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const out = [];
  for (const a of sorted) {
    const last = out[out.length - 1];
    if (last !== undefined && Date.parse(a.createdAt) - Date.parse(last.at) <= COHORT_MINUTES * 60_000) {
      last.assets.push(a);
    } else out.push({ at: a.createdAt, assets: [a] });
  }
  return out;
}

const days = (from, to) => (Date.parse(to) - Date.parse(from)) / 86_400_000;
const rate = (dl, d) => (d > 0 ? dl / d : 0);

function main() {
  const record = process.argv.includes('--record');
  const checkOnly = process.argv.includes('--check');
  const now = new Date().toISOString();

  let assets;
  try {
    assets = live();
  } catch (err) {
    console.error(`cannot read ${REPO}'s releases: ${String(err.message).split('\n')[0]}`);
    console.error('This tool needs `gh` authenticated against the repository. The ledger is');
    console.error(`unchanged. ${existsSync(LEDGER) ? 'Read tools/reach.json for the last recorded figures.' : ''}`);
    process.exit(1);
  }

  const ledger = loadLedger();

  // The inbound side. A failure here must not lose the asset reading, which is
  // the more expensive of the two to retake.
  let facts = null;
  try {
    facts = repoFacts();
  } catch (err) {
    console.error(`could not read ${REPO}'s own fields: ${String(err.message).split('\n')[0]}`);
  }

  const liveIds = new Set(assets.map((a) => a.id));
  // Generations the API no longer lists: replaced by --clobber, counter gone.
  const resetToday = assets.filter((a) => days(a.createdAt, now) < 1.5 && kind(a.name) === 'page');

  if (record) {
    bank(ledger, assets, now);
    if (facts !== null) {
      const last = ledger.repo.at(-1);
      // One row per CHANGE, not one per run. Eighty-six days of identical rows
      // would bury the day one of them moves, which is the only day this series
      // exists for.
      if (sameRepoState(last, facts)) last.lastSeen = now;
      else ledger.repo.push({ ...facts, firstSeen: now, lastSeen: now });
    }
    writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 1)}\n`);
  }

  const cum = cumulative(record ? ledger : bank(structuredClone(ledger), assets, now), liveIds);
  const pages = cum.filter((e) => kind(e.name) === 'page');
  const tarballs = cum.filter((e) => kind(e.name) === 'tarball');
  const sum = (xs, f) => xs.reduce((n, x) => n + f(x), 0);

  if (checkOnly) {
    console.log(
      `ok — ${assets.length} live assets, ${Object.keys(ledger.generations).length} generations banked ` +
        `over ${ledger.runs ?? 0} run(s); pages ${sum(pages, (p) => p.downloads)} downloads ` +
        `(lower bound), tarballs ${sum(tarballs, (t) => t.downloads)}`,
    );
    return;
  }

  console.log(`# Reach, ${now.slice(0, 10)}\n`);
  if (facts !== null) {
    console.log('## Has anybody found it — the inbound side\n');
    console.log(
      `  description ${facts.description}   topics ${facts.topics}   homepage ${facts.homepage}\n` +
        `  stars ${facts.stars}   forks ${facts.forks}   watchers ${facts.watchers}\n` +
        `  has_issues ${facts.hasIssues}   has_pages ${facts.hasPages}   OPEN ISSUES ${facts.openIssues}`,
    );
    for (const alarm of inboundAlarms(facts)) console.log(`\n  *** ${alarm} ***`);
    const first = ledger.repo[0];
    if (first !== undefined && record) {
      console.log(
        `\n  ${ledger.repo.length} distinct state(s) recorded since ${first.firstSeen.slice(0, 10)}` +
          `${ledger.repo.length === 1 ? ' — nothing on the inbound side has moved since' : ''}`,
      );
    }
    console.log('');
  }
  console.log('## The matched comparison: equal exposure, not equal lifetimes\n');
  const youngestPage = assets
    .filter((a) => kind(a.name) === 'page')
    .sort((x, y) => Date.parse(y.createdAt) - Date.parse(x.createdAt))[0];
  if (youngestPage === undefined) {
    console.log('  no page assets at all — the control group is missing, not zero.\n');
  } else {
    const target = days(youngestPage.createdAt, now);
    const matched = assets
      .filter((a) => Math.abs(days(a.createdAt, now) - target) <= target * MATCH_TOLERANCE)
      .sort((x, y) => y.downloads - x.downloads);
    console.log(
      `  Every asset aged ${(target * (1 - MATCH_TOLERANCE)).toFixed(2)}-` +
        `${(target * (1 + MATCH_TOLERANCE)).toFixed(2)} days, which is the youngest page's ` +
        `${target.toFixed(2)} +/- ${MATCH_TOLERANCE * 100}%:\n`,
    );
    for (const a of matched) {
      console.log(
        `  ${a.name.padEnd(36)} ${String(a.downloads).padStart(4)} dl  ` +
          `${days(a.createdAt, now).toFixed(2)} d  ${kind(a.name)}`,
      );
    }
    const p = matched.filter((a) => kind(a.name) === 'page');
    const t = matched.filter((a) => kind(a.name) === 'tarball');
    console.log(
      `\n  ${p.length} page(s): ${p.reduce((n, a) => n + a.downloads, 0)} downloads.  ` +
        `${t.length} tarball(s): ${t.reduce((n, a) => n + a.downloads, 0)} downloads.` +
        (t.length === 0
          ? '  No tarball shares the window, so this says nothing today.'
          : '  Same repository, same release mechanism, same exposure.'),
    );
  }
  console.log('\n## Every asset, by age, newest first — the rate, not the total\n');
  for (const a of [...assets].sort((x, y) => Date.parse(y.createdAt) - Date.parse(x.createdAt)).slice(0, 12)) {
    const d = days(a.createdAt, now);
    console.log(
      `  ${a.name.padEnd(36)} ${String(a.downloads).padStart(4)} dl  ${d.toFixed(2).padStart(7)} d  ` +
        `${rate(a.downloads, d).toFixed(2).padStart(6)}/day`,
    );
  }
  console.log('\n## Cumulative across generations — the number --clobber cannot reset\n');
  console.log(`  banked over ${ledger.runs ?? 0} recorded run(s), first ${ledger.firstRecorded ?? 'never'}\n`);
  for (const e of [...pages, ...tarballs.slice(0, 4)]) {
    console.log(
      `  ${e.name.padEnd(36)} ${String(e.downloads).padStart(4)} dl  ` +
        `${e.generations} generation(s), ${e.retired} retired`,
    );
  }
  console.log(
    `\n  pages    ${sum(pages, (p) => p.downloads)} downloads over ` +
      `${sum(pages, (p) => p.generations)} generations   LOWER BOUND`,
  );
  console.log(
    `  tarballs ${sum(tarballs, (t) => t.downloads)} downloads over ` +
      `${sum(tarballs, (t) => t.generations)} generations   (never replaced, so exact)`,
  );
  if (resetToday.length > 0) {
    console.log(
      `\n  WARNING: ${resetToday.length} page counter(s) were reset within the last 36 hours, so` +
        '\n  their live figure measures that window and nothing longer. Read the cumulative' +
        '\n  line above, or the matched cohort at the top. Do NOT compare a page total to a' +
        '\n  tarball total; Day 84 and Day 85 both did and both conclusions were unsupported.',
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { COHORT_MINUTES, MATCH_TOLERANCE, cohorts, cumulative, bank, kind, loadLedger };
