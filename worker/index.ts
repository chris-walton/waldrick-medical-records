import { Hono } from 'hono';
import type { Ctx } from './types';
import { accessAuth } from './auth';
import me from './routes/me';
import family from './routes/family';
import recordTypes from './routes/record-types';
import records from './routes/records';
import schedule from './routes/schedule';
import documents from './routes/documents';
import alerts from './routes/alerts';

// Every /api request is authenticated by Cloudflare Access (see auth.ts).
const api = new Hono<Ctx>();
api.use('*', accessAuth);
api.route('/me', me);
api.route('/family', family);
api.route('/record-types', recordTypes);
api.route('/records', records);
api.route('/schedule', schedule);
api.route('/documents', documents);
api.route('/alerts', alerts);

const app = new Hono<Ctx>();
app.route('/api', api);

app.onError((err, c) => {
  console.error('API error:', err);
  return c.json({ error: 'Internal error' }, 500);
});

// Unknown /api/* paths return JSON 404; everything else falls back to the built SPA
// static assets. (wrangler only routes /api/* to the Worker via run_worker_first, so
// the asset fallback here is defensive.)
app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith('/api/')) {
    return c.json({ error: 'Unknown API route' }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
