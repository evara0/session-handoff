import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseDocument } from 'yaml';
import { validateHandoff, validateRevision } from '../tools/validate-handoff.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const valid = read('evals/outputs/ordinary.md');
const cli = join(root, 'tools/validate-handoff.mjs');
const replace = (from, to) => {
  assert.ok(valid.includes(from), 'test setup must target an existing fixture value');
  return valid.replace(from, to);
};

test('all reference handoffs have valid metadata, including CRLF', () => {
  for (const name of ['ordinary', 'subtask', 'blocked', 'revised']) {
    const source = read(`evals/outputs/${name}.md`);
    assert.deepEqual(validateHandoff(source).errors, [], name);
    assert.deepEqual(validateHandoff(source.replace(/\r?\n/g, '\r\n')).errors, [], `${name} CRLF`);
  }
});

test('Windows paths and null values survive parsing without escapes or invented values', () => {
  const { metadata } = validateHandoff(valid);
  assert.equal(metadata.source_workspace, 'D:\\work\\sample-export');
  assert.equal(metadata.source_agent, null);
  assert.equal(metadata.target_workspace, null);
});

const invalidCases = [
  ['absent front matter', valid.slice(4), 'frontmatter.missing'],
  ['unclosed front matter', valid.replace('\n---\n\n#', '\n\n#'), 'frontmatter.unclosed'],
  ['sequence instead of mapping', '---\n- item\n---\nBody', 'metadata.mapping'],
  ['empty YAML', '---\n---\nBody', 'metadata.mapping'],
  ['empty body', valid.slice(0, valid.indexOf('\n---\n', 4) + 5), 'body.empty'],
  ['missing language', replace('language: zh-CN\n', ''), 'field.missing:language'],
  ['empty title', replace("title: 'CSV 导出修复交接'", "title: '   '"), 'field.string:title'],
  ['numeric status', replace('status: planning', 'status: 5'), 'field.string:status'],
  ['wrong document kind', replace('type: session-handoff', 'type: report'), 'field.type'],
  ['numeric version', replace("schema_version: '1.0'", 'schema_version: 1.0'), 'field.schema_version'],
  ['unsupported version', replace("schema_version: '1.0'", "schema_version: '2.0'"), 'field.schema_version'],
  ['unquoted date', replace("created: '2026-10-19'", 'created: 2026-10-19'), 'field.date:created'],
  ['calendar overflow', replace("created: '2026-10-19'", "created: '2026-02-30'"), 'field.date:created'],
  ['non leap day', replace("created: '2026-10-19'", "created: '2025-02-29'"), 'field.date:created'],
  ['malformed date', replace("created: '2026-10-19'", "created: '2026-1-1'"), 'field.date:created'],
  ['reverse dates', replace("updated: '2026-10-19'", "updated: '2026-10-18'"), 'date.order'],
  ['empty tags', replace("tags:\n  - 'session-handoff'\n  - 'csv'", 'tags: []'), 'field.tags'],
  ['numeric tag', replace("  - 'csv'", '  - 42'), 'field.tags'],
  ['blank tag', replace("  - 'csv'", "  - ' '"), 'field.tags'],
  ['empty workspace', replace('target_workspace: null', "target_workspace: ''"), 'field.nullable:target_workspace'],
  ['quoted null', replace('source_agent: null', "source_agent: 'null'"), 'field.nullable:source_agent'],
  ['malformed YAML', replace('source_agent: null', 'source_agent: [unclosed'), 'yaml.invalid'],
  ['duplicate key', replace('status: planning', 'status: planning\nstatus: completed'), 'yaml.invalid'],
  ['unsupported tag', replace('status: planning', 'status: !custom planning'), 'yaml.invalid'],
  ['alias reference', replace('status: planning', 'status: &state planning\nextra: *state'), 'yaml.invalid'],
];
for (const [name, text, expected] of invalidCases) {
  test(`reject ${name}`, () => assert.ok(validateHandoff(text).errors.includes(expected)));
}

test('accept leap dates, double quotes, extensible status and optional fields', () => {
  const source = replace("created: '2026-10-19'", 'created: "2024-02-29"')
    .replace('status: planning', 'status: waiting-for-review\nbranch: fix/example');
  assert.deepEqual(validateHandoff(source).errors, []);
});

test('template can be instantiated as valid metadata with a quoted title and Windows path', () => {
  const template = read('skills/session-handoff/assets/handoff-template.md');
  const end = template.indexOf('\n---\n', 4);
  const doc = parseDocument(template.slice(4, end));
  const values = {
    title: "Contributor's example: work", created: '2026-10-19', updated: '2026-10-19',
    status: 'planning', language: 'en', source_workspace: 'D:\\work\\example',
  };
  for (const [key, value] of Object.entries(values)) doc.set(key, value);
  for (const key of ['title', 'schema_version', 'created', 'updated', 'source_workspace']) {
    doc.get(key, true).type = 'QUOTE_SINGLE';
  }
  const rendered = `---\n${doc.toString()}---\n\n# Example\nA synthetic handoff body.\n`;
  const result = validateHandoff(rendered);
  assert.deepEqual(result.errors, []);
  assert.equal(result.metadata.title, values.title);
  assert.equal(result.metadata.source_workspace, values.source_workspace);
});

test('revision preserves creation date and moves forward', () => {
  assert.deepEqual(validateRevision(read('evals/outputs/revised.md'), read('evals/outputs/blocked.md')).errors, []);
  const changed = read('evals/outputs/revised.md').replace("created: '2026-10-18'", "created: '2026-10-19'");
  assert.ok(validateRevision(changed, read('evals/outputs/blocked.md')).errors.includes('revision.created_changed'));
  assert.ok(validateRevision(read('evals/outputs/blocked.md'), read('evals/outputs/revised.md')).errors.includes('revision.updated_regressed'));
  assert.ok(validateRevision(valid, 'not a handoff').errors.includes('previous.invalid'));
});

test('CLI is read only and reports invalid YAML without echoing secret input', t => {
  const directory = mkdtempSync(join(tmpdir(), 'session-handoff-test-'));
  const invalidPath = join(directory, 'invalid.md');
  const validPath = join(directory, 'valid.md');
  t.after(() => { unlinkSync(invalidPath); unlinkSync(validPath); rmdirSync(directory); });
  const sentinel = 'SYNTHETIC_PRIVATE_VALUE_33x';
  const invalid = replace('source_agent: null', `source_agent: [${sentinel}`);
  writeFileSync(invalidPath, invalid);
  writeFileSync(validPath, valid);
  const result = spawnSync(process.execPath, [cli, validPath, invalidPath], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /yaml.invalid/);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(sentinel));
  assert.equal(readFileSync(invalidPath, 'utf8'), invalid);
  assert.equal(readFileSync(validPath, 'utf8'), valid);
});

test('CLI handles usage, missing files and revision checks', () => {
  const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd: root });
  assert.equal(run([]).status, 2);
  assert.equal(run(['--help']).status, 0);
  assert.equal(run(['--unknown']).status, 2);
  assert.equal(run(['--previous']).status, 2);
  assert.equal(run(['evals/outputs/revised.md', '--previous', 'evals/outputs/blocked.md']).status, 0);
  assert.equal(run(['evals/outputs/ordinary.md', '--previous', 'evals/outputs/blocked.md']).status, 1);
  assert.equal(run(['missing-file.md']).status, 1);
  assert.equal(run(['evals/outputs/ordinary.md', '--previous', 'missing-file.md']).status, 1);
  assert.equal(run(['evals/outputs/ordinary.md', 'evals/outputs/blocked.md', '--previous', 'evals/outputs/blocked.md']).status, 2);
  assert.equal(run(['evals/outputs/ordinary.md', '--previous', 'evals/outputs/blocked.md', '--previous', 'evals/outputs/blocked.md']).status, 2);
});

test('reference outputs do not carry the sensitive-input sentinel', () => {
  for (const name of ['ordinary', 'subtask', 'blocked', 'revised']) {
    assert.ok(!read(`evals/outputs/${name}.md`).includes('SYNTHETIC_SECRET_DO_NOT_EXPORT_9x7'));
  }
});

test('successful CLI clearly limits its claim to metadata', () => {
  const output = execFileSync(process.execPath, [cli, 'evals/outputs/ordinary.md'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /content not verified/);
});
