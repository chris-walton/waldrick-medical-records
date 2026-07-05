import { Hono } from 'hono';
import type { Ctx } from '../types';
import { nowIso, pick, setClause, todayIso, uuid } from '../db';

const CREATE_FIELDS = ['family_member_id', 'severity', 'title', 'message', 'due_date'] as const;
const UPDATE_FIELDS = ['severity', 'title', 'message', 'due_date', 'status'] as const;

const SEVERITY_RANK: Record<string, number> = { urgent: 0, warning: 1, info: 2 };

/** Days ahead of `due_date` that a pending schedule item begins to warn. */
const UPCOMING_WINDOW_DAYS = 30;

interface AlertOut {
  id: string;
  family_member_id: string | null;
  schedule_item_id: string | null;
  severity: 'info' | 'warning' | 'urgent';
  title: string;
  message: string | null;
  due_date: string | null;
  source: 'manual' | 'schedule';
  status: string;
  family_member_name: string | null;
  created_at?: string;
  updated_at?: string;
}

const app = new Hono<Ctx>();

app.get('/', async (c) => {
  const today = todayIso();
  const horizon = new Date(Date.now() + UPCOMING_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const manual = await c.env.DB.prepare(
    `SELECT a.*, fm.name AS family_member_name
     FROM alerts a
     LEFT JOIN family_members fm ON fm.id = a.family_member_id
     WHERE a.status = 'active'`,
  ).all<AlertOut & Record<string, unknown>>();

  const pending = await c.env.DB.prepare(
    `SELECT s.id, s.family_member_id, s.title, s.due_date, fm.name AS family_member_name
     FROM schedule_items s
     JOIN family_members fm ON fm.id = s.family_member_id
     WHERE s.status = 'pending' AND s.due_date IS NOT NULL AND s.due_date <= ?`,
  )
    .bind(horizon)
    .all<{
      id: string;
      family_member_id: string;
      title: string;
      due_date: string;
      family_member_name: string;
    }>();

  const derived: AlertOut[] = pending.results.map((s) => {
    const overdue = s.due_date < today;
    return {
      id: `schedule:${s.id}`,
      family_member_id: s.family_member_id,
      schedule_item_id: s.id,
      severity: overdue ? 'urgent' : 'warning',
      title: overdue ? `Overdue: ${s.title}` : `Due soon: ${s.title}`,
      message: overdue ? `Was due ${s.due_date}` : `Due ${s.due_date}`,
      due_date: s.due_date,
      source: 'schedule',
      status: 'active',
      family_member_name: s.family_member_name,
    };
  });

  const manualOut: AlertOut[] = manual.results.map((a) => ({
    id: a.id,
    family_member_id: a.family_member_id,
    schedule_item_id: null,
    severity: (a.severity as AlertOut['severity']) ?? 'info',
    title: a.title,
    message: a.message,
    due_date: a.due_date,
    source: 'manual',
    status: a.status,
    family_member_name: (a.family_member_name as string) ?? null,
    created_at: a.created_at as string,
    updated_at: a.updated_at as string,
  }));

  const all = [...derived, ...manualOut].sort((x, y) => {
    const s = SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity];
    if (s !== 0) return s;
    return (x.due_date ?? '9999').localeCompare(y.due_date ?? '9999');
  });
  return c.json(all);
});

app.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = pick<Record<string, unknown>>(body, CREATE_FIELDS);
  if (!data.title || typeof data.title !== 'string') return c.json({ error: 'title is required' }, 400);
  const id = uuid();
  const ts = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO alerts
       (id, family_member_id, severity, title, message, due_date, source, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'manual', 'active', ?, ?)`,
  )
    .bind(
      id,
      data.family_member_id ?? null,
      (data.severity as string) ?? 'info',
      data.title,
      data.message ?? null,
      data.due_date ?? null,
      ts,
      ts,
    )
    .run();
  const row = await c.env.DB.prepare('SELECT * FROM alerts WHERE id = ?').bind(id).first();
  return c.json(row, 201);
});

app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = pick<Record<string, unknown>>(body, UPDATE_FIELDS);
  if (Object.keys(data).length === 0) return c.json({ error: 'No updatable fields' }, 400);
  const { clause, values } = setClause({ ...data, updated_at: nowIso() });
  await c.env.DB.prepare(`UPDATE alerts SET ${clause} WHERE id = ?`)
    .bind(...values, id)
    .run();
  const row = await c.env.DB.prepare('SELECT * FROM alerts WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

app.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM alerts WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

export default app;
