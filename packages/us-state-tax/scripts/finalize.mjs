// Root package.json says "type": "module", so the CommonJS output needs its own
// marker or Node will try to parse the .js files as ESM.
import { writeFileSync } from 'node:fs';

writeFileSync('dist/esm/package.json', JSON.stringify({ type: 'module' }, null, 2) + '\n');
writeFileSync('dist/cjs/package.json', JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
console.log('wrote dist/{esm,cjs}/package.json module markers');
