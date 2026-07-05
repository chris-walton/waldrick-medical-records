import { Hono } from 'hono';
import type { Ctx } from '../types';
import { nowIso, pick, setClause, uuid } from '../db';

const FIELDS = [
  'name',
  'date_of_birth',
  'sex',
  'blood_type',
  'relationship',
  'notes',
  'photo_r2_key',
] as const;

const app = new Hono<Ctx>();

app.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM family_members ORDER BY name COLLATE NOCASE',
  ).all();
  return c.json(results);
});

app.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = pick(body, FIELDS);
  if (!data.name || typeof data.name !== 'string') {
    return c.json({ error: 'name is required' }, 400);
  }
  const id = uuid();
  const ts = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO family_members
       (id, name, date_of_birth, sex, blood_type, relationship, notes, photo_r2_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      data.name,
      data.date_of_birth ?? null,
      data.sex ?? null,
      data.blood_type ?? null,
      data.relationship ?? null,
      data.notes ?? null,
      data.photo_r2_key ?? null,
      ts,
      ts,
    )
    .run();
  const row = await c.env.DB.prepare('SELECT * FROM family_members WHERE id = ?').bind(id).first();
  return c.json(row, 201);
});

app.get('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM family_members WHERE id = ?')
    .bind(c.req.param('id'))
    .first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = pick(body, FIELDS);
  if (Object.keys(data).length === 0) return c.json({ error: 'No updatable fields' }, 400);
  const { clause, values } = setClause({ ...data, updated_at: nowIso() });
  await c.env.DB.prepare(`UPDATE family_members SET ${clause} WHERE id = ?`)
    .bind(...values, id)
    .run();
  const row = await c.env.DB.prepare('SELECT * FROM family_members WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  // Remove the member's document objects from R2 first (DB rows cascade-delete).
  const { results } = await c.env.DB.prepare(
    'SELECT r2_key FROM documents WHERE family_member_id = ?',
  )
    .bind(id)
    .all<{ r2_key: string }>();
  for (const doc of results) {
    await c.env.DOCS.delete(doc.r2_key);
  }
  await c.env.DB.prepare('DELETE FROM family_members WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

export default app;
