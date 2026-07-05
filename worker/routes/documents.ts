import { Hono } from 'hono';
import type { Ctx } from '../types';
import { nowIso, uuid } from '../db';

interface DocRow {
  id: string;
  r2_key: string;
  filename: string;
  content_type: string | null;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

const app = new Hono<Ctx>();

app.get('/', async (c) => {
  const familyMemberId = c.req.query('familyMemberId');
  const recordId = c.req.query('recordId');
  const where: string[] = [];
  const binds: unknown[] = [];
  if (familyMemberId) {
    where.push('d.family_member_id = ?');
    binds.push(familyMemberId);
  }
  if (recordId) {
    where.push('d.record_id = ?');
    binds.push(recordId);
  }
  let sql = `
    SELECT d.*, fm.name AS family_member_name
    FROM documents d
    LEFT JOIN family_members fm ON fm.id = d.family_member_id`;
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY d.uploaded_at DESC';
  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds)
    .all();
  return c.json(results);
});

app.post('/', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) {
    return c.json({ error: 'Expected a multipart form field named "file".' }, 400);
  }
  const familyMemberId =
    typeof body['familyMemberId'] === 'string' && body['familyMemberId']
      ? (body['familyMemberId'] as string)
      : null;
  const recordId =
    typeof body['recordId'] === 'string' && body['recordId'] ? (body['recordId'] as string) : null;

  const id = uuid();
  const key = `docs/${familyMemberId ?? 'unfiled'}/${id}-${safeName(file.name)}`;
  await c.env.DOCS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });

  const ts = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO documents
       (id, family_member_id, record_id, r2_key, filename, content_type, size_bytes, uploaded_by, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      familyMemberId,
      recordId,
      key,
      file.name,
      file.type || null,
      file.size,
      c.get('userEmail'),
      ts,
    )
    .run();
  const row = await c.env.DB.prepare('SELECT * FROM documents WHERE id = ?').bind(id).first();
  return c.json(row, 201);
});

app.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(
    'SELECT id, r2_key, filename, content_type FROM documents WHERE id = ?',
  )
    .bind(c.req.param('id'))
    .first<DocRow>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  const obj = await c.env.DOCS.get(row.r2_key);
  if (!obj) return c.json({ error: 'File missing from storage' }, 404);
  return new Response(obj.body, {
    headers: {
      'Content-Type': row.content_type || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${safeName(row.filename)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
});

app.delete('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT r2_key FROM documents WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ r2_key: string }>();
  if (row) {
    await c.env.DOCS.delete(row.r2_key);
    await c.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(c.req.param('id')).run();
  }
  return c.json({ ok: true });
});

export default app;
