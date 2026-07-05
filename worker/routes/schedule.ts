import { Hono } from 'hono';
import type { Ctx } from '../types';
import { nowIso, pick, setClause, todayIso, uuid } from '../db';

const CREATE_FIELDS = [
  'family_member_id',
  'record_type_id',
  'title',
  'due_date',
  'status',
  'recurrence',
  'notes',
] as const;

const UPDATE_FIELDS = [
  'record_type_id',
  'title',
  'due_date',
  'status',
  'recurrence',
  'notes',
] as const;

const SELECT = `
  SELECT s.*,
         fm.name  AS family_member_name,
         rt.label AS record_type_label
  FROM schedule_items s
  JOIN family_members fm ON fm.id = s.family_member_id
  LEFT JOIN record_types rt ON rt.id = s.record_type_id`;

interface ScheduleRow {
  id: string;
  family_member_id: string;
  record_type_id: string | null;
  title: string;
  notes: string | null;
}

const app = new Hono<Ctx>();

app.get('/', async (c) => {
  const familyMemberId = c.req.query('familyMemberId');
  let sql = SELECT;
  const binds: unknown[] = [];
  if (familyMemberId) {
    sql += ' WHERE s.family_member_id = ?';
    binds.push(familyMemberId);
  }
  // Pending first, then by soonest due date.
  sql += ` ORDER BY CASE s.status WHEN 'pending' THEN 0 ELSE 1 END, s.due_date IS NULL, s.due_date ASC`;
  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds)
    .all();
  return c.json(results);
});

app.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = pick<Record<string, unknown>>(body, CREATE_FIELDS);
  if (!data.family_member_id) return c.json({ error: 'family_member_id is required' }, 400);
  if (!data.title || typeof data.title !== 'string') return c.json({ error: 'title is required' }, 400);
  const id = uuid();
  const ts = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO schedule_items
       (id, family_member_id, record_type_id, title, due_date, status, recurrence, completed_record_id, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
  )
    .bind(
      id,
      data.family_member_id,
      data.record_type_id ?? null,
      data.title,
      data.due_date ?? null,
      (data.status as string) ?? 'pending',
      data.recurrence ?? null,
      data.notes ?? null,
      ts,
      ts,
    )
    .run();
  const row = await c.env.DB.prepare(`${SELECT} WHERE s.id = ?`).bind(id).first();
  return c.json(row, 201);
});

app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = pick<Record<string, unknown>>(body, UPDATE_FIELDS);
  if (Object.keys(data).length === 0) return c.json({ error: 'No updatable fields' }, 400);
  const { clause, values } = setClause({ ...data, updated_at: nowIso() });
  await c.env.DB.prepare(`UPDATE schedule_items SET ${clause} WHERE id = ?`)
    .bind(...values, id)
    .run();
  const row = await c.env.DB.prepare(`${SELECT} WHERE s.id = ?`).bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

// Mark a schedule item done and create the corresponding health record.
app.post('/:id/complete', async (c) => {
  const id = c.req.param('id');
  const item = await c.env.DB.prepare('SELECT * FROM schedule_items WHERE id = ?')
    .bind(id)
    .first<ScheduleRow>();
  if (!item) return c.json({ error: 'Not found' }, 404);
  if (!item.record_type_id) {
    return c.json(
      { error: 'Set a record type on this schedule item before completing it.' },
      400,
    );
  }
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const recId = uuid();
  const ts = nowIso();
  const eventDate = (body.event_date as string) || todayIso();
  await c.env.DB.prepare(
    `INSERT INTO records
       (id, family_member_id, record_type_id, title, event_date, provider, location, status, data_json, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', NULL, ?, ?, ?)`,
  )
    .bind(
      recId,
      item.family_member_id,
      item.record_type_id,
      item.title,
      eventDate,
      (body.provider as string) ?? null,
      (body.location as string) ?? null,
      item.notes ?? null,
      ts,
      ts,
    )
    .run();
  await c.env.DB.prepare(
    'UPDATE schedule_items SET status = ?, completed_record_id = ?, updated_at = ? WHERE id = ?',
  )
    .bind('done', recId, ts, id)
    .run();
  const record = await c.env.DB.prepare('SELECT * FROM records WHERE id = ?').bind(recId).first();
  return c.json({ ok: true, record });
});

app.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM schedule_items WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

export default app;
