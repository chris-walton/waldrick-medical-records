import { Hono } from 'hono';
import type { Ctx } from '../types';

const app = new Hono<Ctx>();

app.get('/', (c) => {
  return c.json({ email: c.get('userEmail'), dev: c.env.DEV_MODE === 'true' });
});

export default app;
