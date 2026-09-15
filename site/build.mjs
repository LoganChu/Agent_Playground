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
