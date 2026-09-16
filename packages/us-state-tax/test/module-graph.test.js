// The compiled module graph, and the one property of it nothing else checks.
//
// This package ships ES modules that a browser loads natively — that is the
// whole reason the site needs no bundler — and for thirteen days it shipped a
// dependency CYCLE. `counties.js` imported all four county states for its
// dispatch and all four imported `counties.js` back for the registry lookup.
//
// Node tolerated it, TypeScript tolerated it, and 373 tests passed over it,
// because every binding across the cycle is a hoisted function declaration and
// so is defined by the time anyone calls it. It works by luck. What it cannot
// do is survive a loader that has to PRODUCE each module before anything can
// reference it, which is every loader that serialises a graph: the site's
// single-file build hit it and recursed until the stack ran out.
//
// So the guard is here rather than in the site, because the property belongs to
// this package: a consumer should be able to linearise these modules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'esm');

/** Every compiled module, keyed by its path relative to `dist/esm`. */
function modules() {
  const found = {};
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path, `${prefix}${entry}/`);
        continue;
      }
      if (extname(entry) !== '.js') continue;
      found[`${prefix}${entry}`] = readFileSync(path, 'utf8');
    }
  };
  walk(root, '');
  return found;
}

/** Resolve a relative specifier against the importing module's path. */
function against(from, specifier) {
  const parts = from.split('/').slice(0, -1);
  for (const piece of specifier.split('/')) {
    if (piece === '.' || piece === '') continue;
    if (piece === '..') parts.pop();
    else parts.push(piece);
  }
  return parts.join('/');
}

function graph() {
  const sources = modules();
  const edges = {};
  for (const [path, source] of Object.entries(sources)) {
    const targets = new Set();
    for (const match of source.matchAll(/(?:from|import|import\(\s*)\s*(['"])(\.[^'"]*)\1/g)) {
      targets.add(against(path, match[2]));
    }
    edges[path] = [...targets];
  }
  return { sources, edges };
}

test('every relative import resolves to a module that exists', () => {
  // A specifier without its `.js` extension compiles and then 404s in a browser,
  // which is the failure this package's whole no-bundler claim rests on avoiding.
  const { sources, edges } = graph();
  for (const [path, targets] of Object.entries(edges)) {
    for (const target of targets) {
      assert.ok(target in sources, `${path} imports ${target}, which does not exist`);
    }
  }
});

test('the module graph is acyclic', () => {
  const { edges } = graph();
  const state = new Map();
  const stack = [];
  const cycles = [];
  const visit = (node) => {
    if (state.get(node) === 'done') return;
    if (state.get(node) === 'open') {
      cycles.push([...stack.slice(stack.indexOf(node)), node].join(' -> '));
      return;
    }
    state.set(node, 'open');
    stack.push(node);
    for (const next of edges[node] ?? []) visit(next);
    stack.pop();
    state.set(node, 'done');
  };
  for (const node of Object.keys(edges)) visit(node);
  assert.deepEqual(cycles, [], `dependency cycles:\n  ${cycles.join('\n  ')}`);
});

test('index.js reaches every module with anything in it', () => {
  // A module nobody imports is either dead weight in the tarball or a missing
  // export, and both are worth knowing about — with one exception that is not
  // either. A types-only source compiles to the single statement `export {}`,
  // so it ships, is imported by nobody at runtime, and is 49 bytes of nothing.
  // `localities/definition.ts` is one; the test allows any module whose whole
  // body is that statement and no other.
  const { sources, edges } = graph();
  const empty = (source) => source.replace(/^\/\/#.*$/gm, '').trim() === 'export {};';
  const seen = new Set();
  const visit = (node) => {
    if (seen.has(node)) return;
    seen.add(node);
    for (const next of edges[node] ?? []) visit(next);
  };
  visit('index.js');
  const orphans = Object.keys(sources).filter(
    (path) => !seen.has(path) && !empty(sources[path]),
  );
  assert.deepEqual(orphans, [], `unreachable from index.js: ${orphans.join(', ')}`);
});
