// Mark `dist` as ESM (it already inherits "type": "module" from the package
// root, but being explicit means a consumer that vendors `dist` alone still
// gets it right), and make the CLI entry point executable so `npx us-tax-mcp`
// works without a shell shim.
import { chmodSync, writeFileSync } from 'node:fs';

writeFileSync('dist/package.json', JSON.stringify({ type: 'module' }, null, 2) + '\n');
chmodSync('dist/cli.js', 0o755);
console.log('wrote dist/package.json and made dist/cli.js executable');
