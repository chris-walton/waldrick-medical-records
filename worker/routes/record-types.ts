import { Hono } from 'hono';
import type { Ctx } from '../types';
import { uuid } from '../db';

const app = new Hono<Ctx>();

app.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM record_types ORDER BY sort_order, label COLLATE NOCASE',
  ).all();
  return c.json(results);
});

app.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label) return c.json({ error: 'label is required' }, 400);

  // Derive a machine key from the label unless one was supplied.
  const rawKey = typeof body.key === 'string' && body.key ? body.key : label;
  const key = rawKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!key) return c.json({ error: 'Could not derive a key from the label' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM record_types WHERE key = ?')
    .bind(key)
    .first();
  if (existing) return c.json({ error: `A record type with key "${key}" already exists` }, 409);

  const icon = typeof body.icon === 'string' && body.icon ? body.icon : 'label';
  let schemaJson: string | null = null;
  if (body.schema_json !== undefined && body.schema_json !== null) {
    schemaJson =
      typeof body.schema_json === 'string' ? body.schema_json : JSON.stringify(body.schema_json);
  }
  const sortRow = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM record_types',
  ).first<{ next: number }>();

  const id = uuid();
  await c.env.DB.prepare(
    `INSERT INTO record_types (id, key, label, icon, schema_json, is_system, sort_order)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
  )
    .bind(id, key, label, icon, schemaJson, sortRow?.next ?? 99)
    .run();
  const row = await c.env.DB.prepare('SELECT * FROM record_types WHERE id = ?').bind(id).first();
  return c.json(row, 201);
});

export default app;
