/**
 * Assemble `site/dist/` — a static site with no build tooling in it.
 *
 * There is no bundler here and that is not a shortcut. Both engines are
 * dependency-free TypeScript compiled to ES modules with explicit `.js`
 * extensions on every relative import, which is exactly what a browser can
 * load natively. So "bundling" is a copy, and the site inherits the same
 * property the packages advertise: nothing in it came from anywhere else.
 *
 * What the copy does do is strip the two things a browser has no use for and
 * would pay for anyway: `.d.ts` declarations and `.map` files, which are most of
 * the compiled output by weight.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, 'dist');

const ENGINES = [
  { package: 'us-federal-tax', directory: 'us-federal-tax' },
  { package: 'us-state-tax', directory: 'us-state-tax' },
];

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'vendor'), { recursive: true });

let vendored = 0;
let bytes = 0;

/** Copy one engine's ESM build, JavaScript only. */
function vendor(engine) {
  const source = resolve(here, '..', 'packages', engine.package, 'dist', 'esm');
  if (!existsSync(source)) {
    console.error(
      `build: ${engine.package} has no dist/esm. Run \`npm run build\` in packages/${engine.package} first.`,
    );
    process.exit(1);
  }
  const target = join(out, 'vendor', engine.directory);

  const walk = (from, to) => {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from)) {
      const fromPath = join(from, entry);
      if (statSync(fromPath).isDirectory()) {
        walk(fromPath, join(to, entry));
        continue;
      }
      if (extname(entry) !== '.js') continue;
      // The sourcemap comment points at a file deliberately not shipped, and a
      // 404 per module in the console is the kind of detail that makes a page
      // look broken when it is not.
      const code = readFileSync(fromPath, 'utf8').replace(/^\/\/# sourceMappingURL=.*$/gm, '');
      writeFileSync(join(to, entry), code);
      vendored += 1;
      bytes += Buffer.byteLength(code);
    }
  };

  walk(source, target);
}

for (const engine of ENGINES) vendor(engine);

for (const file of ['index.html', 'style.css', 'app.js']) {
  cpSync(join(here, file), join(out, file));
}
cpSync(join(here, 'src'), join(out, 'src'), { recursive: true });

// GitHub Pages runs Jekyll over the published tree unless told not to, and
// Jekyll silently drops files and directories whose names begin with an
// underscore. Nothing here starts with one today; this costs a byte and removes
// a class of failure that presents as a blank page with a 404 in the console.
writeFileSync(join(out, '.nojekyll'), '');

console.log(
  `build: ${vendored} engine modules (${(bytes / 1024).toFixed(0)} KB) + page into site/dist`,
);

/**
 * One file that works when you double-click it.
 *
 * Day 21's note told the human that the Pages workflow's artifact "works
 * offline — open index.html". **That was false and this run proved it.** A
 * `<script type="module">` loaded from a `file://` URL is blocked by CORS in
 * every Chromium-based browser:
 *
 *   Access to script at 'file:///.../app.js' from origin 'null' has been
 *   blocked by CORS policy: Cross origin requests are only supported for
 *   protocol schemes: chrome, chrome-extension, ..., http, https.
 *
 * The page comes up blank. The claim was written without opening the artifact
 * that way, which is precisely the failure Day 20 and Day 21 exist to record,
 * made about the very thing those days were about.
 *
 * So: `retirement-tax-calculator.html` is the whole calculator in one file —
 * the markup, the stylesheet, and all 43 engine modules plus the page's own
 * three, inlined. It needs no server, no Pages, no network and no click from
 * anybody. `dist.yml` attaches it to a Release, which makes it the first
 * user-facing thing this project has ever shipped that does not wait on a
 * human.
 *
 * The modules keep their own boundaries rather than being concatenated. Each
 * one becomes a Blob URL, and its relative import specifiers are rewritten to
 * the Blob URLs of its dependencies before it is created — which is why the
 * dependencies are created first, depth-first, and why a module is created
 * exactly once. That is thirty lines instead of a bundler, and it means the
 * code in this file is the code the test suites ran, character for character,
 * with only the import specifiers rewritten.
 */
function singleFile() {
  const modules = {};
  const collect = (dir, prefix) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        collect(path, `${prefix}${entry}/`);
        continue;
      }
      if (extname(entry) !== '.js') continue;
      modules[`${prefix}${entry}`] = readFileSync(path, 'utf8');
    }
  };
  collect(join(out, 'vendor'), 'vendor/');
  collect(join(out, 'src'), 'src/');
  modules['app.js'] = readFileSync(join(out, 'app.js'), 'utf8');

  const html = readFileSync(join(out, 'index.html'), 'utf8');
  const css = readFileSync(join(out, 'style.css'), 'utf8');

  // A </script> inside a string literal would close the tag that carries it.
  const json = JSON.stringify(modules).replace(/<\/script/gi, '<\\/script');

  const loader = `
const SOURCES = ${json};
const urls = new Map();
const resolve = (from, specifier) => {
  const parts = from.split('/').slice(0, -1);
  for (const piece of specifier.split('/')) {
    if (piece === '.' || piece === '') continue;
    if (piece === '..') parts.pop();
    else parts.push(piece);
  }
  return parts.join('/');
};
function urlFor(path) {
  const existing = urls.get(path);
  if (existing) return existing;
  const source = SOURCES[path];
  if (source === undefined) throw new Error('missing module: ' + path);
  // Claimed before the dependencies are walked, so a cycle resolves to the
  // module that is already being built rather than recursing for ever.
  urls.set(path, null);
  const code = source.replace(/(from\\s*|import\\s*|import\\(\\s*)(['"])(\\.[^'"]*)\\2/g, (whole, keyword, quote, specifier) => {
    const target = resolve(path, specifier);
    return keyword + quote + urlFor(target) + quote;
  });
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  urls.set(path, url);
  return url;
}
import(urlFor('app.js'));
`;

  // Both replacements pass a FUNCTION rather than a string, and that is
  // load-bearing rather than style. A string replacement is scanned for `$$`,
  // `$&` and `$1`, and the embedded sources are full of `$$` — a template
  // literal that prints a dollar sign is written `$${...}`. Passing the
  // replacement as a string silently turned every one of them into a single
  // `$`, so the code in this file would not have been the code the suite ran.
  // `site/test/compute.test.js` asserts byte equality and caught it.
  const single = html
    .replace('<link rel="stylesheet" href="style.css" />', () => `<style>\n${css}\n</style>`)
    .replace(
      '<script type="module" src="app.js"></script>',
      () => `<script type="module">${loader}</script>`,
    );

  if (single.includes('src="app.js"') || single.includes('href="style.css"')) {
    console.error('build: the single-file page still references a file beside it');
    process.exit(1);
  }
  writeFileSync(join(out, 'retirement-tax-calculator.html'), single);
  return { count: Object.keys(modules).length, bytes: Buffer.byteLength(single) };
}

const single = singleFile();

console.log(
  `build: retirement-tax-calculator.html — ${single.count} modules inlined, ` +
    `${(single.bytes / 1024).toFixed(0)} KB, opens from file://`,
);

