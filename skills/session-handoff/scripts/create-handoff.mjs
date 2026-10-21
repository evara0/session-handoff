import { run } from './lib/cli.mjs';
import { createHandoff } from './lib/handoff.mjs';
run('create', ['project', 'title', 'topic', 'body-file', 'status', 'language',
  'source-name', 'source-agent', 'target', 'send', 'dry-run'],
['project', 'title', 'topic', 'body-file', 'status'], createHandoff);
