import { run } from './lib/cli.mjs';
import { listHandoffs } from './lib/handoff.mjs';
run('list', ['project', 'direction'], ['project'], listHandoffs);
