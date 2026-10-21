export const ROUTING_FIELDS = ['handoff_id', 'created_at', 'source_project', 'topic'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SLUG = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export function slug(value, limit) {
  if (typeof value !== 'string') throw new Error('name.invalid');
  const normalized = value.normalize('NFKC').trim().toLowerCase().replace(/[\s_]+/gu, '-');
  if (!SLUG.test(normalized) || [...normalized].length > limit) throw new Error('name.invalid');
  return normalized;
}

export function validInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const instant = new Date(value);
  return !Number.isNaN(instant.getTime()) && instant.toISOString() === value;
}

export function routingErrors(metadata) {
  if (!ROUTING_FIELDS.some(key => Object.hasOwn(metadata, key))) return [];
  const errors = [];
  if (typeof metadata.handoff_id !== 'string' || !UUID.test(metadata.handoff_id)) errors.push('routing.handoff_id');
  if (!validInstant(metadata.created_at)) errors.push('routing.created_at');
  for (const [key, limit] of [['source_project', 32], ['topic', 48]]) {
    try {
      if (slug(metadata[key], limit) !== metadata[key]) errors.push(`routing.${key}`);
    } catch { errors.push(`routing.${key}`); }
  }
  return errors;
}

export function filename(metadata) {
  if (ROUTING_FIELDS.some(key => !Object.hasOwn(metadata, key)) || routingErrors(metadata).length) {
    throw new Error('routing.invalid');
  }
  const timestamp = metadata.created_at.replace(/[-:.]/g, '');
  return `${timestamp}__${metadata.source_project}__${metadata.topic}__${metadata.handoff_id.slice(0, 8)}.md`;
}
