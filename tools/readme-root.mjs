#!/usr/bin/env node
/**
 * Check the counts in the ROOT README against the code that produces them.
 *
 * ## Why this exists
 *
 * Day 36's rule is that a count a human copies by hand goes stale, and the answer
 * was to measure it in CI. That was applied to every package README, to the npm
 * descriptions and to the mutation scores — and **not to the file a reader of this
 * repository sees first**, which was the only document here with no test over it.
 *
 * Day 45 found three drifted counts in it by reading. Day 46 wrote this and it
 * immediately found a fourth that reading had missed, and the fourth is the
 * interesting one: the root README says the MCP server has **"Nine tools"** in its
 * product table and **"its ten tools"** five hundred lines further down. Both
 * sentences are in the same file, they disagree with each other, and the real
 * number is ten. `packages/us-tax-mcp/README.md` says nine too.
 *
 * Nothing could have caught it. `protocol.test.js` compares the served tool list
 * to `TOOLS.length`, which is the same number on both sides of the assertion, so
 * it is right and it is silent about the prose. **A count is only checked when
 * something compares it to the THING, and "nine" was being compared to nothing at
 * all.**
 *
 * ## Usage
 *
 *     node tools/readme-root.mjs           # print every claim and its source
 *     node tools/readme-root.mjs --check    # exit 1 if any claim is stale
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const README = join(ROOT, 'README.md');

/**
 * Both engines, built. A raw import failure here reads like a bug in this tool,
 * so it says what to run instead — the same courtesy `obbba-claims.mjs` pays.
 */
async function engine(rel, pkg) {
  try {
    return await import(join(ROOT, rel));
  } catch (err) {
    console.error(`cannot import ${pkg}: ${err.message}`);
    console.error('');
    console.error('This tool reads the engines rather than their source, so both must be built:');
    console.error(`  (cd packages/${pkg} && npm install && npm run build)`);
    process.exit(1);
  }
}

const state = await engine('packages/us-state-tax/dist/esm/index.js', 'us-state-tax');
const mcp = await engine('packages/us-tax-mcp/dist/index.js', 'us-tax-mcp');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));

const text = read('README.md');
const scores = json('tools/mutation/scores.json');

// The locality total is the sum of the five transcribed registries. New York City
// and Yonkers are rules rather than registry rows and are named in the prose, so
// the figure is 1,033 and not 1,035 — the same derivation `us-state-tax`'s own
// README suite uses, deliberately, because two derivations of one number is the
// defect this file is about.
const localities =
  state.MARYLAND_COUNTIES.length +
  state.INDIANA_COUNTIES.length +
  state.MICHIGAN_CITIES.length +
  state.OHIO_MUNICIPALITIES.length +
  state.OHIO_SCHOOL_DISTRICTS.length;

const WORDS = {
  1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five',
  6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten',
  11: 'Eleven', 12: 'Twelve',
};
const comma = (n) => n.toLocaleString('en-US');

/**
 * Every claim this file knows how to check: a label, a regex over the README that
 * must match at least once, and the value every match must equal.
 *
 * `find` returns the numbers the README states. A claim whose regex matches
 * NOTHING is a failure, not a pass — the failure mode of every check that loops
 * over what it happens to find.
 */
const CLAIMS = [
  {
    label: 'supported states',
    want: state.SUPPORTED_STATES.length,
    find: () => [...text.matchAll(/(?:engine for|all) ([0-9]+) states/g)].map((m) => Number(m[1])),
  },
  {
    label: 'local income taxes',
    want: localities,
    find: () => [...text.matchAll(/([0-9][0-9,]*) local income taxes/g)].map((m) => Number(m[1].replaceAll(',', ''))),
  },
  {
    label: 'Ohio municipalities',
    want: state.OHIO_MUNICIPALITIES.length,
    find: () => [...text.matchAll(/all ([0-9][0-9,]*) Ohio municipalities/g)].map((m) => Number(m[1].replaceAll(',', ''))),
  },
  {
    label: 'differential households',
    want: json('tools/differential/out/cases.json').length,
    find: () => [...text.matchAll(/([0-9][0-9,]*) households through both/g)].map((m) => Number(m[1].replaceAll(',', ''))),
  },
  {
    // The one that was wrong. Written as a WORD in the product table and as a
    // word again in the protocol section, which is why a numeric check saw
    // neither of them.
    label: 'MCP tools (spelled)',
    want: mcp.TOOLS.length,
    find: () =>
      [...text.matchAll(/\b(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve)\s+tools\b/gi)].map(
        (m) => Number(Object.entries(WORDS).find(([, w]) => w.toLowerCase() === m[1].toLowerCase())?.[0]),
      ),
    show: (n) => `${WORDS[n]} tools`,
  },
];

for (const [pkg, s] of Object.entries(scores.packages)) {
  CLAIMS.push({
    label: `${pkg} mutants`,
    want: s.mutants,
    find: () =>
      [...text.matchAll(new RegExp(`\\\`${pkg}\\\`[^|\\n]*\\|\\s*([0-9,]+)\\s*\\|`, 'g'))].map((m) =>
        Number(m[1].replaceAll(',', '')),
      ),
  });
  CLAIMS.push({
    label: `${pkg} survivors`,
    want: s.survivors,
    find: () =>
      [...text.matchAll(new RegExp(`\\\`${pkg}\\\`[^|\\n]*\\|[^|]*\\|\\s*\\**([0-9]+)\\**`, 'g'))].map((m) =>
        Number(m[1]),
      ),
  });
}

// The version the MCP server ANNOUNCES, quoted in prose. It said `0.37.0` against
// a package at 0.44.0 — seven releases stale, in a sentence describing what a
// reader would see if they ran the command.
CLAIMS.push({
  label: 'us-tax-mcp announced version',
  want: json('packages/us-tax-mcp/package.json').version,
  find: () => [...text.matchAll(/us-tax-mcp@([0-9.]+)/g)].map((m) => m[1]),
  eq: (a, b) => a === b,
});

for (const name of ['us-federal-tax', 'us-state-tax', 'us-tax-mcp']) {
  const { version } = json(`packages/${name}/package.json`);
  CLAIMS.push({
    label: `${name} release version in the install line`,
    want: version,
    find: () => [...text.matchAll(new RegExp(`${name}-v([0-9.]+)/`, 'g'))].map((m) => m[1]),
    eq: (a, b) => a === b,
  });
}

const problems = [];
const checked = [];
for (const c of CLAIMS) {
  const found = c.find();
  if (!found.length) {
    problems.push(`${c.label}: the README states it nowhere, so nothing was checked (expected ${c.want})`);
    continue;
  }
  for (const got of found) {
    const ok = c.eq ? c.eq(got, c.want) : got === c.want;
    checked.push(`${c.label}: ${c.show ? c.show(got) : got}`);
    if (!ok) {
      problems.push(
        `${c.label}: the root README says ${c.show ? c.show(got) : got} and the code says ${
          c.show ? c.show(c.want) : typeof c.want === 'number' ? comma(c.want) : c.want
        }`,
      );
    }
  }
}

for (const line of checked) console.log(line);

if (CHECK) {
  if (problems.length) {
    console.error('\nThe root README disagrees with the code:\n');
    for (const p of problems) console.error(`  ${p}`);
    console.error('\nThis is the front door of the repository. Fix the README.');
    process.exit(1);
  }
  console.log(`\nok — ${checked.length} claims in the root README all match the code`);
}
