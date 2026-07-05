import { Hono } from 'hono';
import type { Ctx } from '../types';
import { nowIso, pick, setClause, uuid } from '../db';

const CREATE_FIELDS = [
  'family_member_id',
  'record_type_id',
  'title',
  'event_date',
  'date_precision',
  'provider',
  'location',
  'status',
  'data_json',
  'notes',
] as const;

const UPDATE_FIELDS = [
  'record_type_id',
  'title',
  'event_date',
  'date_precision',
  'provider',
  'location',
  'status',
  'data_json',
  'notes',
] as const;

type DatePrecision = 'day' | 'month' | 'year';
const PRECISIONS: readonly DatePrecision[] = ['day', 'month', 'year'];

function normalisePrecision(value: unknown): DatePrecision {
  return PRECISIONS.includes(value as DatePrecision) ? (value as DatePrecision) : 'day';
}

// Store event_date as a full ISO date, snapped to the start of the known period so
// month/year-only records don't imply a day they didn't specify. Leaves unparseable
// values untouched and null as null.
function normaliseEventDate(value: unknown, precision: DatePrecision): string | null {
  if (value === undefined || value === null || value === '') return null;
  const m = String(value).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return String(value);
  const [, y, mo = '01', d = '01'] = m;
  if (precision === 'year') return `${y}-01-01`;
  if (precision === 'month') return `${y}-${mo}-01`;
  return `${y}-${mo}-${d}`;
}

const SELECT = `
  SELECT r.*,
         rt.key   AS record_type_key,
         rt.label AS record_type_label,
         rt.icon  AS record_type_icon,
         fm.name  AS family_member_name
  FROM records r
  JOIN record_types rt ON rt.id = r.record_type_id
  JOIN family_members fm ON fm.id = r.family_member_id`;

// data_json may arrive as an object; store it as a JSON string.
function normaliseDataJson(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

const app = new Hono<Ctx>();

app.get('/', async (c) => {
  const familyMemberId = c.req.query('familyMemberId');
  const typeKey = c.req.query('typeKey');
  const where: string[] = [];
  const binds: unknown[] = [];
  if (familyMemberId) {
    where.push('r.family_member_id = ?');
    binds.push(familyMemberId);
  }
  if (typeKey) {
    where.push('rt.key = ?');
    binds.push(typeKey);
  }
  let sql = SELECT;
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY COALESCE(r.event_date, r.created_at) DESC';
  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds)
    .all();
  return c.json(results);
});

app.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = pick<Record<string, unknown>>(body, CREATE_FIELDS);
  if (!data.family_member_id) return c.json({ error: 'family_member_id is required' }, 400);
  if (!data.record_type_id) return c.json({ error: 'record_type_id is required' }, 400);
  if (!data.title || typeof data.title !== 'string')
    return c.json({ error: 'title is required' }, 400);

  const id = uuid();
  const ts = nowIso();
  const precision = normalisePrecision(data.date_precision);
  await c.env.DB.prepare(
    `INSERT INTO records
       (id, family_member_id, record_type_id, title, event_date, date_precision, provider, location, status, data_json, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      data.family_member_id,
      data.record_type_id,
      data.title,
      normaliseEventDate(data.event_date, precision),
      precision,
      data.provider ?? null,
      data.location ?? null,
      data.status ?? null,
      normaliseDataJson(data.data_json),
      data.notes ?? null,
      ts,
      ts,
    )
    .run();
  const row = await c.env.DB.prepare(`${SELECT} WHERE r.id = ?`).bind(id).first();
  return c.json(row, 201);
});

app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = pick<Record<string, unknown>>(body, UPDATE_FIELDS);
  if ('data_json' in data) data.data_json = normaliseDataJson(data.data_json);
  if ('date_precision' in data) data.date_precision = normalisePrecision(data.date_precision);
  if ('event_date' in data) {
    data.event_date = normaliseEventDate(data.event_date, normalisePrecision(data.date_precision));
  }
  if (Object.keys(data).length === 0) return c.json({ error: 'No updatable fields' }, 400);
  const { clause, values } = setClause({ ...data, updated_at: nowIso() });
  await c.env.DB.prepare(`UPDATE records SET ${clause} WHERE id = ?`)
    .bind(...values, id)
    .run();
  const row = await c.env.DB.prepare(`${SELECT} WHERE r.id = ?`).bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

app.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM records WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

export default app;
