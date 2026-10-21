import { run } from './lib/cli.mjs';
import { sendHandoff } from './lib/handoff.mjs';
run('send', ['project', 'file', 'target', 'dry-run'], ['project', 'file', 'target'], sendHandoff);
