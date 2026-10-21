import { run } from './lib/cli.mjs';
import { initHandoff } from './lib/handoff.mjs';
run('init', ['project', 'dry-run'], ['project'], initHandoff);
