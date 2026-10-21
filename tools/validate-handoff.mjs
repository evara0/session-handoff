// Compatibility entry point; the distributable skill owns the implementation.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { main } from '../skills/session-handoff/scripts/validate-handoff.mjs';
export { main, validateHandoff, validateRevision } from '../skills/session-handoff/scripts/validate-handoff.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
