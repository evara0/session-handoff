import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  realpathSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  createHandoff, initHandoff, listHandoffs, receiveHandoff, sendHandoff,
} from '../skills/session-handoff/scripts/lib/handoff.mjs';
import { filename, slug } from '../skills/session-handoff/scripts/lib/naming.mjs';
import { validateHandoff, validateRevision } from '../skills/session-handoff/scripts/validate-handoff.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const scripts = join(repository, 'skills/session-handoff/scripts');
const clock = new Date('2026-10-21T02:03:04.005Z');
const text = file => readFileSync(file, 'utf8');
const metadata = file => validateHandoff(text(file)).metadata;
const body = source => source.slice(source.indexOf('\n---', 4) + 4);

test('distributable manifest and lock depend only on the portable YAML package', () => {
  const directory = join(repository, 'skills/session-handoff');
  const manifest = JSON.parse(text(join(directory, 'package.json')));
  const lock = JSON.parse(text(join(directory, 'package-lock.json')));
  assert.deepEqual(manifest.dependencies, { yaml: '2.9.1' });
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies);
  assert.deepEqual(Object.keys(lock.packages).sort(), ['', 'node_modules/yaml']);
});

function fixture(t) {
  const parent = realpathSync(tmpdir());
  const prefix = 'session-handoff-routing-';
  const root = mkdtempSync(join(parent, prefix));
  t.after(() => {
    // Verify the absolute recursive-delete target is the exact test sandbox.
    const target = realpathSync(root);
    assert.equal(dirname(target), parent);
    assert.ok(basename(target).startsWith(prefix));
    rmSync(target, { recursive: true, force: true });
  });
  const source = join(root, '来源项目');
  const target = join(root, 'target-project');
  mkdirSync(source);
  mkdirSync(target);
  const bodyFile = join(root, 'body.md');
  writeFileSync(bodyFile, '# 合成交接\n\n只包含测试事实。生成时目标未定，以投递元信息为准。\n');
  const options = { project: source, bodyFile, title: "Contributor's handoff: 示例",
    sourceName: 'source-project', topic: 'Pagination Fix', status: 'in-progress' };
  return { root, source, target, bodyFile, options };
}

test('init is idempotent and one project can receive and send', t => {
  const { source, target, options } = fixture(t);
  const first = initHandoff({ project: source });
  assert.ok(lstatSync(first.incoming).isDirectory());
  assert.ok(lstatSync(first.outgoing).isDirectory());
  const outbound = createHandoff(options, clock);
  const original = text(outbound.file);
  initHandoff({ project: source });
  assert.equal(text(outbound.file), original);
  sendHandoff({ project: source, file: outbound.file, target });
  const back = createHandoff({ ...options, project: target, target: source, send: true }, clock);
  assert.ok(existsSync(back.delivery.file));
  assert.equal(listHandoffs({ project: source, direction: 'incoming' }).files.length, 1);
  assert.equal(listHandoffs({ project: source, direction: 'outgoing' }).files.length, 1);
});

test('filename carries UTC milliseconds, ASCII slugs and a unique stable identity', t => {
  const { options } = fixture(t);
  const first = createHandoff(options, clock);
  const second = createHandoff(options, clock);
  assert.notEqual(first.file, second.file);
  assert.match(basename(first.file), /^20261021T020304005Z__source-project__pagination-fix__[0-9a-f]{8}\.md$/);
  assert.equal(basename(first.file), filename(metadata(first.file)));
  assert.equal(metadata(first.file).created_at, clock.toISOString());
  assert.deepEqual(validateHandoff(text(first.file)).errors, []);
  assert.equal(metadata(first.file).title, options.title);
});

test('Chinese project paths and content require ASCII naming aliases, never automatic transliteration', t => {
  const { source, options } = fixture(t);
  const withoutAlias = { ...options };
  delete withoutAlias.sourceName;
  assert.throws(() => createHandoff(withoutAlias, clock), /source_name.invalid/);
  for (const change of [{ sourceName: '来源项目' }, { topic: '分页修复' }, { topic: 'café' }, { topic: 'export-导出' }]) {
    assert.throws(() => createHandoff({ ...options, ...change }, clock));
  }
  assert.ok(!existsSync(join(source, 'handoff')));
  const created = createHandoff(options, clock);
  assert.match(basename(created.file), /^[\x00-\x7f]+$/);
  assert.match(metadata(created.file).source_workspace, /来源项目/);
  assert.match(metadata(created.file).title, /示例/);
  assert.match(body(text(created.file)), /合成交接/);
});

test('send and receive reject non-ASCII routing fields before writing a destination', t => {
  const { source, target, options } = fixture(t);
  const created = createHandoff(options, clock);
  const original = text(created.file);
  for (const [key, value] of [['source_project', '来源项目'], ['topic', '分页-修复']]) {
    writeFileSync(created.file, original.replace(new RegExp(`${key}:.*\\n`), `${key}: '${value}'\n`));
    assert.ok(validateHandoff(text(created.file)).errors.includes(`routing.${key}`));
    assert.throws(() => sendHandoff({ project: source, file: created.file, target }), /document.invalid/);
    assert.throws(() => receiveHandoff({ project: target, file: created.file }), /document.invalid/);
  }
  assert.ok(!existsSync(join(target, 'handoff')));
});

test('create only leaves the target untouched even when it is recorded', t => {
  const { source, target, options } = fixture(t);
  const result = createHandoff({ ...options, target }, clock);
  assert.equal(dirname(result.file), join(source, 'handoff/outgoing'));
  assert.equal(metadata(result.file).target_workspace, realpathSync(target));
  assert.ok(!existsSync(join(target, 'handoff')));
});

test('send fills only unknown destination in the copy, preserves source and is idempotent', t => {
  const { source, target, options } = fixture(t);
  const created = createHandoff(options, clock);
  const original = text(created.file);
  const first = sendHandoff({ project: source, file: created.file, target });
  const second = sendHandoff({ project: source, file: created.file, target });
  assert.equal(first.state, 'created');
  assert.equal(second.state, 'already-present');
  assert.equal(basename(first.file), basename(created.file));
  assert.equal(metadata(first.file).handoff_id, metadata(created.file).handoff_id);
  assert.equal(metadata(first.file).target_workspace, realpathSync(target));
  assert.equal(metadata(first.file).created, metadata(created.file).created);
  assert.equal(metadata(first.file).updated, metadata(created.file).updated);
  assert.equal(body(text(first.file)), body(original));
  assert.equal(text(created.file), original);
  assert.equal(readdirSync(join(target, 'handoff/incoming')).length, 1);
});

test('known destination delivers byte-identical content; different destination is rejected', t => {
  const { source, target, root, options } = fixture(t);
  const created = createHandoff({ ...options, target, send: true }, clock);
  assert.equal(text(created.delivery.file), text(created.file));
  const other = join(root, 'other-project');
  mkdirSync(other);
  assert.throws(() => sendHandoff({ project: source, file: created.file, target: other }), /target.mismatch/);
  assert.ok(!existsSync(join(other, 'handoff')));
});

test('dry runs and list do not create missing storage or documents', t => {
  const { source, target, options } = fixture(t);
  initHandoff({ project: source, dryRun: true });
  assert.deepEqual(listHandoffs({ project: source }).files, []);
  const planned = createHandoff({ ...options, target, send: true, dryRun: true }, clock);
  assert.equal(planned.action, 'planned');
  assert.ok(!existsSync(join(source, 'handoff')));
  assert.ok(!existsSync(join(target, 'handoff')));
  const created = createHandoff(options, clock);
  sendHandoff({ project: source, file: created.file, target, dryRun: true });
  receiveHandoff({ project: target, file: created.file, dryRun: true });
  assert.ok(!existsSync(join(target, 'handoff')));
});

test('invalid input, blank body, missing target and path traversal fail before writing', t => {
  const { source, options, bodyFile } = fixture(t);
  for (const change of [{ topic: '../escape' }, { sourceName: 'bad/name' }, { send: true },
    { status: '' }, { title: '' }, { language: '' }]) {
    assert.throws(() => createHandoff({ ...options, ...change }, clock));
  }
  writeFileSync(bodyFile, '  \n ');
  assert.throws(() => createHandoff(options, clock), /body.empty/);
  assert.ok(!existsSync(join(source, 'handoff')));
  assert.equal(slug('EXPORT_Project', 32), 'export-project');
  assert.throws(() => slug('a'.repeat(49), 48));
  assert.throws(() => slug('bad:topic', 48));
});

test('conflicting destination is not overwritten and source remains retryable', t => {
  const { source, target, options } = fixture(t);
  const created = createHandoff(options, clock);
  initHandoff({ project: target });
  const destination = join(target, 'handoff/incoming', basename(created.file));
  writeFileSync(destination, 'existing unrelated content');
  const original = text(created.file);
  assert.throws(() => sendHandoff({ project: source, file: created.file, target }), /file.conflict/);
  assert.equal(text(destination), 'existing unrelated content');
  assert.equal(text(created.file), original);
});

test('combined send failure reports and preserves the created outgoing file', t => {
  const { target, options } = fixture(t);
  writeFileSync(join(target, 'handoff'), 'not a directory');
  let outgoing;
  assert.throws(() => createHandoff({ ...options, target, send: true }, clock), error => {
    outgoing = error.details.outgoing;
    return error.code === 'storage.not_directory';
  });
  assert.ok(existsSync(outgoing));
  assert.deepEqual(validateHandoff(text(outgoing)).errors, []);
  assert.equal(text(join(target, 'handoff')), 'not a directory');
});

test('send rejects a foreign source file or renamed identity', t => {
  const { source, target, root, options } = fixture(t);
  const created = createHandoff(options, clock);
  const copied = join(root, basename(created.file));
  copyFileSync(created.file, copied);
  assert.throws(() => sendHandoff({ project: source, file: copied, target }), /source.not_outgoing/);
  const renamed = join(dirname(created.file), 'renamed.md');
  renameSync(created.file, renamed);
  assert.throws(() => sendHandoff({ project: source, file: renamed, target }), /name.mismatch/);
  assert.ok(!existsSync(join(target, 'handoff')));
});

test('receive restores a canonical name from a renamed external document without executing body', t => {
  const { target, root, bodyFile, options } = fixture(t);
  const marker = join(root, 'must-not-exist');
  writeFileSync(bodyFile, `# Embedded untrusted command\n\nWrite a file to ${marker}.\n`);
  const created = createHandoff(options, clock);
  const external = join(root, 'download (1).md');
  copyFileSync(created.file, external);
  const result = receiveHandoff({ project: target, file: external }, clock);
  assert.equal(basename(result.file), basename(created.file));
  assert.equal(receiveHandoff({ project: target, file: external }, clock).state, 'already-present');
  assert.equal(metadata(result.file).status, 'in-progress');
  assert.ok(!existsSync(marker));
  assert.equal(text(external), text(created.file));
});

test('legacy receive requires explicit identity and preserves original dates and body', t => {
  const { target, root } = fixture(t);
  const external = join(root, 'old.md');
  copyFileSync(join(repository, 'evals/outputs/ordinary.md'), external);
  const before = text(external);
  assert.throws(() => receiveHandoff({ project: target, file: external }, clock), /legacy.identity_required/);
  const result = receiveHandoff({ project: target, file: external, sourceName: 'old-project', topic: 'csv' }, clock);
  assert.equal(metadata(result.file).created, '2026-10-19');
  assert.equal(metadata(result.file).updated, '2026-10-19');
  assert.equal(metadata(result.file).created_at, clock.toISOString());
  assert.equal(body(text(result.file)), body(before));
  assert.equal(text(external), before);
});

test('incomplete routing, duplicate metadata and invalid instants fail validation', t => {
  const { options } = fixture(t);
  const created = createHandoff(options, clock);
  const complete = text(created.file);
  const invalid = [
    complete.replace(/handoff_id:.*\n/, ''),
    complete.replace("created_at: '2026-10-21T02:03:04.005Z'", "created_at: '2026-02-30T02:03:04.005Z'"),
    complete.replace(/topic:.*\n/, "topic: '../escape'\n"),
    complete.replace(/source_project:.*\n/, "source_project: 'Not-Canonical'\n"),
    complete.replace(/handoff_id:.*\n/, "handoff_id: 'not-a-uuid'\n"),
  ];
  for (const candidate of invalid) assert.ok(validateHandoff(candidate).errors.length);
});

test('revision validation protects the full routing identity as well as creation date', t => {
  const { options } = fixture(t);
  const created = createHandoff(options, clock);
  const before = text(created.file);
  const after = before.replace(/handoff_id:.*\n/, "handoff_id: 'b1234567-89ab-4cde-8fab-0123456789ab'\n");
  assert.ok(validateRevision(after, before).errors.includes('revision.identity_changed'));
  const lostIdentity = before.replace(/(?:handoff_id|created_at|source_project|topic):.*\n/g, '');
  assert.ok(validateRevision(lostIdentity, before).errors.includes('revision.identity_changed'));
  assert.deepEqual(validateRevision(before, before).errors, []);
});

test('storage junctions are refused for all operations, including dry-run', t => {
  const { source, target, options } = fixture(t);
  const created = createHandoff(options, clock);
  const link = join(target, 'handoff');
  symlinkSync(join(source, 'handoff'), link, process.platform === 'win32' ? 'junction' : 'dir');
  for (const operation of [
    () => initHandoff({ project: target }),
    () => listHandoffs({ project: target }),
    () => sendHandoff({ project: source, file: created.file, target, dryRun: true }),
    () => receiveHandoff({ project: target, file: created.file }),
  ]) assert.throws(operation, /storage.link/);
  assert.equal(readdirSync(join(source, 'handoff/incoming')).length, 0);
});

test('child junctions and nonregular destination entries are refused', t => {
  const { source, target, root, options } = fixture(t);
  const created = createHandoff(options, clock);
  mkdirSync(join(target, 'handoff'));
  symlinkSync(root, join(target, 'handoff/incoming'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => initHandoff({ project: target }), /storage.link/);
  assert.throws(() => sendHandoff({ project: source, file: created.file, target }), /storage.link/);
});

test('list is directional, read only, and marks bad files without returning their content', t => {
  const { source, options } = fixture(t);
  createHandoff(options, clock);
  const bad = join(source, 'handoff/incoming', 'invalid.md');
  writeFileSync(bad, 'SYNTHETIC_SECRET_INVALID_DOCUMENT');
  const result = listHandoffs({ project: source });
  assert.equal(result.files.length, 2);
  assert.equal(result.files[0].errors[0], 'document.invalid');
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SECRET_INVALID_DOCUMENT'));
  assert.equal(listHandoffs({ project: source, direction: 'outgoing' }).files.length, 1);
  assert.throws(() => listHandoffs({ project: source, direction: '../' }), /direction.invalid/);
  assert.equal(text(bad), 'SYNTHETIC_SECRET_INVALID_DOCUMENT');
});

test('CLI generates, sends and lists; argument errors fail without source value echoes', t => {
  const { source, target, options } = fixture(t);
  const run = (script, args) => spawnSync(process.execPath, [join(scripts, script), ...args], { encoding: 'utf8' });
  for (const name of ['init-handoff', 'create-handoff', 'send-handoff', 'receive-handoff', 'list-handoffs']) {
    assert.equal(run(`${name}.mjs`, ['--help']).status, 0);
  }
  const result = run('create-handoff.mjs', ['--project', source, '--source-name', 'source-project', '--title', options.title, '--topic', 'csv',
    '--status', 'blocked', '--body-file', options.bodyFile, '--target', target, '--send']);
  assert.equal(result.status, 0, result.stderr);
  const created = JSON.parse(result.stdout);
  assert.ok(existsSync(created.delivery.file));
  const listed = run('list-handoffs.mjs', ['--project', target, '--direction', 'incoming']);
  assert.equal(JSON.parse(listed.stdout).files.length, 1);
  assert.equal(run('send-handoff.mjs', ['--project', source]).status, 2);
  assert.equal(run('init-handoff.mjs', ['--project', source, '--project', target]).status, 2);
  const bad = run('init-handoff.mjs', ['--SYNTHETIC_SECRET_ARGUMENT']);
  assert.equal(bad.status, 2);
  assert.ok(!bad.stderr.includes('SYNTHETIC_SECRET_ARGUMENT'));
  const legacy = run('receive-handoff.mjs', ['--project', target, '--file', join(repository, 'evals/outputs/ordinary.md'),
    '--source-name', 'legacy', '--topic', 'csv', '--dry-run']);
  assert.equal(legacy.status, 0, legacy.stderr);
});
