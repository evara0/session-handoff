import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMap, isScalar, parseDocument } from 'yaml';
import { ROUTING_FIELDS, routingErrors } from './lib/naming.mjs';

const REQUIRED = ['title', 'type', 'schema_version', 'created', 'updated',
  'status', 'tags', 'language', 'source_agent', 'source_workspace', 'target_workspace'];
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const quoted = node => isScalar(node) && ['QUOTE_SINGLE', 'QUOTE_DOUBLE'].includes(node.type);

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Check structure only. Errors contain fixed codes, never source values. */
export function validateHandoff(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return { errors: ['frontmatter.missing'] };
  const end = lines.indexOf('---', 1);
  if (end < 0) return { errors: ['frontmatter.unclosed'] };

  let document;
  let metadata;
  try {
    document = parseDocument(lines.slice(1, end).join('\n'), { version: '1.2', uniqueKeys: true });
    if (document.errors.length || document.warnings.length) return { errors: ['yaml.invalid'] };
    if (!isMap(document.contents)) return { errors: ['metadata.mapping'] };
    // Skill outputs use literal values, not alias expansion or custom YAML tags.
    metadata = document.toJS({ maxAliasCount: 0 });
  } catch {
    return { errors: ['yaml.invalid'] };
  }

  const errors = [];
  if (!lines.slice(end + 1).join('\n').trim()) errors.push('body.empty');
  for (const key of REQUIRED) {
    if (!Object.hasOwn(metadata, key)) errors.push(`field.missing:${key}`);
  }
  for (const key of ['title', 'status', 'language']) {
    if (!nonempty(metadata[key])) errors.push(`field.string:${key}`);
  }
  if (metadata.type !== 'session-handoff') errors.push('field.type');
  if (metadata.schema_version !== '1.0' || !quoted(document.get('schema_version', true))) {
    errors.push('field.schema_version');
  }
  for (const key of ['created', 'updated']) {
    if (!validDate(metadata[key]) || !quoted(document.get(key, true))) errors.push(`field.date:${key}`);
  }
  if (validDate(metadata.created) && validDate(metadata.updated) && metadata.updated < metadata.created) {
    errors.push('date.order');
  }
  if (!Array.isArray(metadata.tags) || !metadata.tags.length || !metadata.tags.every(nonempty)) {
    errors.push('field.tags');
  }
  for (const key of ['source_agent', 'source_workspace', 'target_workspace']) {
    if (metadata[key] !== null && (!nonempty(metadata[key]) || metadata[key] === 'null')) {
      errors.push(`field.nullable:${key}`);
    }
  }
  errors.push(...routingErrors(metadata));
  return { errors, metadata };
}

export function validateRevision(currentText, previousText) {
  const current = validateHandoff(currentText);
  const previous = validateHandoff(previousText);
  if (previous.errors.length) return { ...current, errors: [...current.errors, 'previous.invalid'] };
  if (current.errors.length) return current;
  if (current.metadata.created !== previous.metadata.created) current.errors.push('revision.created_changed');
  if (current.metadata.updated < previous.metadata.updated) current.errors.push('revision.updated_regressed');
  if (ROUTING_FIELDS.some(key => Object.hasOwn(previous.metadata, key) && previous.metadata[key] !== current.metadata[key])) {
    current.errors.push('revision.identity_changed');
  }
  return current;
}

export function main(args) {
  const usage = 'Usage: node <skill>/scripts/validate-handoff.mjs <file...> [--previous <file>]';
  if (args.length === 1 && args[0] === '--help') {
    console.log(usage);
    return 0;
  }
  let previousPath;
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--previous' && previousPath === undefined && args[i + 1] && !args[i + 1].startsWith('--')) {
      previousPath = args[++i];
    } else if (args[i].startsWith('--')) {
      console.error(usage);
      return 2;
    } else {
      files.push(args[i]);
    }
  }
  if (!files.length || (previousPath !== undefined && files.length !== 1)) {
    console.error(usage);
    return 2;
  }
  let previous;
  if (previousPath !== undefined) {
    try { previous = readFileSync(previousPath, 'utf8'); }
    catch { console.error(`${previousPath}: file.read_failed`); return 1; }
  }
  let failed = false;
  for (const file of files) {
    let result;
    try {
      const text = readFileSync(file, 'utf8');
      result = previous === undefined ? validateHandoff(text) : validateRevision(text, previous);
    } catch {
      result = { errors: ['file.read_failed'] };
    }
    if (result.errors.length) {
      failed = true;
      console.error(`${file}: ${result.errors.join(', ')}`);
    } else {
      console.log(`${file}: metadata valid (content not verified)`);
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
