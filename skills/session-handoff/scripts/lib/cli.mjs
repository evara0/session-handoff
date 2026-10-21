import { HandoffError } from './handoff.mjs';

export function run(action, allowed, required, operation, args = process.argv.slice(2)) {
  const script = action === 'list' ? 'list-handoffs' : `${action}-handoff`;
  const usage = `Usage: node <skill>/scripts/${script}.mjs ${required.map(key => `--${key} <value>`).join(' ')} [options]\nOptions: ${allowed.map(key => `--${key}`).join(', ')}, --help`;
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
  try {
    const options = {};
    for (let i = 0; i < args.length; i++) {
      const key = args[i].startsWith('--') ? args[i].slice(2) : '';
      if (!allowed.includes(key)) throw new HandoffError('args.invalid');
      const normalized = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      if (Object.hasOwn(options, normalized)) throw new HandoffError('args.duplicate');
      if (['dry-run', 'send'].includes(key)) options[normalized] = true;
      else {
        if (!args[i + 1] || args[i + 1].startsWith('--')) throw new HandoffError('args.missing_value');
        options[normalized] = args[++i];
      }
    }
    for (const key of required) {
      const normalized = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      if (!options[normalized]) throw new HandoffError('args.required');
    }
    console.log(JSON.stringify(operation(options)));
  } catch (error) {
    const known = error instanceof HandoffError;
    const code = known ? error.code : 'operation.failed';
    console.error(JSON.stringify({ error: code, ...(known ? error.details : {}) }));
    if (code.startsWith('args.')) console.error(usage);
    process.exitCode = code.startsWith('args.') ? 2 : 1;
  }
}
