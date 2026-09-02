/**
 * Copy the tax engine's TypeScript sources into `src/engine/` before building.
 *
 * `us-tax-mcp` ships **self-contained**: it has no runtime dependency on
 * `us-federal-tax`, or on anything else. That is a deliberate product decision,
 * not laziness about monorepo tooling:
 *
 * 1. An MCP server is spawned per session, usually through `npx -y`. Every
 *    dependency is latency the user pays at the start of every conversation,
 *    and a supply chain they did not ask for.
 * 2. It removes a publish-ordering constraint. `us-tax-mcp` can go to npm
 *    before, after, or instead of `us-federal-tax`, and it works either way.
 *
 * The copy is regenerated on every build from a single source tree in a single
 * commit, so the two cannot drift. `test/engine-sync.test.js` asserts that.
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Both engines, vendored the same way for the same reasons. */
const ENGINES = [
  { package: 'us-federal-tax', directory: 'engine' },
  { package: 'us-state-tax', directory: 'state-engine' },
];

for (const engine of ENGINES) {
  const source = resolve(here, '..', '..', engine.package, 'src');
  const target = resolve(here, '..', 'src', engine.directory);

  if (!existsSync(source)) {
    console.error(`sync-engine: cannot find the engine sources at ${source}`);
    process.exit(1);
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });

  writeFileSync(
    resolve(target, 'README.md'),
    [
      '# Generated — do not edit',
      '',
      `Everything in this directory is copied verbatim from \`packages/${engine.package}/src\``,
      'by `scripts/sync-engine.mjs`, which runs before every build.',
      '',
      'Edit the engine there. Changes made here are destroyed on the next build.',
      '',
    ].join('\n'),
  );

  console.log(`sync-engine: copied ${source} -> ${target}`);
}
