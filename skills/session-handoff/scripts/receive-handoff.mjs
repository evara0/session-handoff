import { run } from './lib/cli.mjs';
import { receiveHandoff } from './lib/handoff.mjs';
run('receive', ['project', 'file', 'source-name', 'topic', 'dry-run'], ['project', 'file'], receiveHandoff);
