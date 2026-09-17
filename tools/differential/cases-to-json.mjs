/** Write the case grid as JSON, so both runners read the same bytes. */
import { cases } from './cases.mjs';

process.stdout.write(`${JSON.stringify(cases(), null, 1)}\n`);
