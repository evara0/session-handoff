import { randomUUID } from 'node:crypto';
import {
  closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, realpathSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { Document, isScalar, parseDocument } from 'yaml';
import { validateHandoff } from '../validate-handoff.mjs';
import { filename, ROUTING_FIELDS, slug } from './naming.mjs';

export class HandoffError extends Error {
  constructor(code, details = {}) { super(code); this.code = code; this.details = details; }
}
const fail = code => { throw new HandoffError(code); };

export function projectRoot(project) {
  if (typeof project !== 'string' || !project.trim()) fail('project.required');
  let root;
  try { root = realpathSync(resolve(project)); }
  catch { fail('project.not_found'); }
  if (!lstatSync(root).isDirectory()) fail('project.not_directory');
  return root;
}

// Check every storage component, including dangling symlinks/junctions.
function checkDirectory(path) {
  let stat;
  try { stat = lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (stat.isSymbolicLink()) fail('storage.link');
  if (!stat.isDirectory()) fail('storage.not_directory');
}

export function layout(project, create = false) {
  const root = projectRoot(project);
  const storage = join(root, 'handoff');
  const incoming = join(storage, 'incoming');
  const outgoing = join(storage, 'outgoing');
  // Check all components before creating any directory.
  checkDirectory(storage);
  checkDirectory(incoming);
  checkDirectory(outgoing);
  if (create) {
    for (const path of [storage, incoming, outgoing]) {
      try { mkdirSync(path); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      checkDirectory(path);
    }
  }
  return { root, storage, incoming, outgoing };
}

export function readDocument(file) {
  const path = resolve(file);
  let stat;
  try { stat = lstatSync(path); }
  catch { fail('file.read_failed'); }
  if (!stat.isFile() || stat.isSymbolicLink()) fail('file.not_regular');
  let text;
  try { text = readFileSync(path, 'utf8'); }
  catch { fail('file.read_failed'); }
  const result = validateHandoff(text);
  if (result.errors.length) throw new HandoffError('document.invalid', { errors: result.errors });
  return { path: realpathSync(path), text, metadata: result.metadata };
}

function localDate(now) {
  const pad = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function identity(source, topic, now) {
  let sourceProject;
  let topicSlug;
  try { sourceProject = slug(source, 32); }
  catch { fail('source_name.invalid'); }
  try { topicSlug = slug(topic, 48); }
  catch { fail('topic.invalid'); }
  return { handoff_id: randomUUID(), created_at: now.toISOString(),
    source_project: sourceProject, topic: topicSlug };
}

function quoteStrings(document) {
  for (const item of document.contents.items) {
    if (isScalar(item.value) && typeof item.value.value === 'string') item.value.type = 'QUOTE_SINGLE';
  }
}

function render(metadata, body) {
  const doc = new Document(metadata);
  quoteStrings(doc);
  return `---\n${doc.toString()}---\n\n${body.trim()}\n`;
}

// Preserve the exact body (including CRLF); only routing metadata is rewritten.
function rewrite(text, updates) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/);
  if (!match) fail('document.invalid');
  const doc = parseDocument(match[1], { version: '1.2' });
  for (const [key, value] of Object.entries(updates)) doc.set(key, value);
  quoteStrings(doc);
  return `---\n${doc.toString()}---${text.slice(match[0].length)}`;
}

// Never overwrite: exclusive creation, or idempotent success for identical bytes.
function put(path, text, dryRun, attempt = 0) {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('file.not_regular');
    if (readFileSync(path, 'utf8') === text) return 'already-present';
    fail('file.conflict');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (dryRun) return 'planned';
  let fd;
  try { fd = openSync(path, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST' && attempt < 3) return put(path, text, dryRun, attempt + 1);
    if (error.code === 'EEXIST') fail('file.busy');
    throw error;
  }
  try { writeFileSync(fd, text, 'utf8'); }
  catch (error) {
    closeSync(fd);
    fd = undefined;
    unlinkSync(path); // Only the file exclusively created by this operation.
    throw error;
  } finally { if (fd !== undefined) closeSync(fd); }
  return 'created';
}

function routedText(document, destination) {
  const knownTarget = document.metadata.target_workspace;
  if (knownTarget !== null && projectRoot(knownTarget) !== destination) fail('target.mismatch');
  return knownTarget === null ? rewrite(document.text, { target_workspace: destination }) : document.text;
}

function deliver(document, target, dryRun) {
  const destination = layout(target);
  const text = routedText(document, destination.root);
  const file = join(destination.incoming, filename(document.metadata));
  // Validate everything and preflight conflicts before directory creation.
  const state = put(file, text, true);
  if (!dryRun && state !== 'already-present') layout(destination.root, true);
  return { file, state: dryRun ? state : put(file, text, false) };
}

export function initHandoff(options) {
  return { action: options.dryRun ? 'planned' : 'initialized', ...layout(options.project, !options.dryRun) };
}

export function createHandoff(options, now = new Date()) {
  const source = layout(options.project);
  if (options.send && !options.target) fail('target.required');
  if (typeof options.title !== 'string' || !options.title.trim()) fail('title.required');
  if (typeof options.status !== 'string' || !options.status.trim()) fail('status.required');
  let body;
  try { body = readFileSync(resolve(options.bodyFile), 'utf8'); }
  catch { fail('body.read_failed'); }
  if (!body.trim()) fail('body.empty');
  const target = options.target ? projectRoot(options.target) : null;
  const date = localDate(now);
  const metadata = {
    title: options.title, type: 'session-handoff', schema_version: '1.0', created: date, updated: date,
    status: options.status, tags: ['session-handoff'], language: options.language ?? 'zh-CN',
    source_agent: options.sourceAgent ?? null, source_workspace: source.root, target_workspace: target,
    ...identity(options.sourceName ?? basename(source.root), options.topic, now),
  };
  const text = render(metadata, body);
  const checked = validateHandoff(text);
  if (checked.errors.length) throw new HandoffError('document.invalid', { errors: checked.errors });
  const file = join(source.outgoing, filename(metadata));
  if (options.dryRun) {
    const delivery = options.send ? deliver({ text, metadata }, target, true) : undefined;
    return { action: 'planned', file, delivery };
  }
  layout(source.root, true);
  put(file, text, false);
  if (options.send) {
    try { return { action: 'created', file, delivery: deliver({ text, metadata }, target, false) }; }
    catch (error) {
      throw new HandoffError(error instanceof HandoffError ? error.code : 'delivery.failed',
        { ...(error.details ?? {}), outgoing: file });
    }
  }
  return { action: 'created', file };
}

export function sendHandoff(options) {
  const source = layout(options.project);
  const document = readDocument(options.file);
  if (dirname(document.path) !== source.outgoing) fail('source.not_outgoing');
  if (!ROUTING_FIELDS.every(key => Object.hasOwn(document.metadata, key))) fail('routing.required');
  if (basename(document.path) !== filename(document.metadata)) fail('name.mismatch');
  if (document.metadata.source_workspace === null || projectRoot(document.metadata.source_workspace) !== source.root) {
    fail('source.mismatch');
  }
  const delivery = deliver(document, options.target, options.dryRun);
  return { action: options.dryRun ? 'planned' : 'sent', outgoing: document.path, ...delivery };
}

export function receiveHandoff(options, now = new Date()) {
  const document = readDocument(options.file);
  if (!ROUTING_FIELDS.some(key => Object.hasOwn(document.metadata, key))) {
    if (!options.sourceName || !options.topic) fail('legacy.identity_required');
    const added = identity(options.sourceName, options.topic, now);
    document.text = rewrite(document.text, added);
    document.metadata = { ...document.metadata, ...added };
  }
  const delivery = deliver(document, options.project, options.dryRun);
  return { action: options.dryRun ? 'planned' : 'received', ...delivery };
}

export function listHandoffs(options) {
  const source = layout(options.project);
  const direction = options.direction ?? 'all';
  if (!['all', 'incoming', 'outgoing'].includes(direction)) fail('direction.invalid');
  const files = [];
  for (const key of direction === 'all' ? ['incoming', 'outgoing'] : [direction]) {
    if (!existsSync(source[key])) continue;
    for (const name of readdirSync(source[key]).filter(name => name.endsWith('.md')).sort()) {
      const file = join(source[key], name);
      try {
        const { metadata } = readDocument(file);
        const errors = ROUTING_FIELDS.some(field => Object.hasOwn(metadata, field)) && name !== filename(metadata)
          ? ['name.mismatch'] : [];
        files.push({ direction: key, file, handoff_id: metadata.handoff_id ?? null,
          title: metadata.title, status: metadata.status, errors });
      } catch (error) {
        files.push({ direction: key, file, errors: [error instanceof HandoffError ? error.code : 'file.read_failed'] });
      }
    }
  }
  return { action: 'listed', files };
}
