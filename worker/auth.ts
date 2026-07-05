import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Ctx } from './types';

// createRemoteJWKSet caches keys internally; we cache the set per team domain so we
// don't rebuild it on every request.
let cached: { domain: string; jwks: ReturnType<typeof createRemoteJWKSet> } | null = null;

function jwks(teamDomain: string) {
  if (!cached || cached.domain !== teamDomain) {
    cached = {
      domain: teamDomain,
      jwks: createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`)),
    };
  }
  return cached.jwks;
}

/**
 * Validates the Cloudflare Access application token on every /api request and
 * puts the caller's email on the context. In local dev (DEV_MODE=true, from
 * .dev.vars only) the JWT check is skipped and DEV_USER_EMAIL is used instead.
 */
export const accessAuth = createMiddleware<Ctx>(async (c, next) => {
  if (c.env.DEV_MODE === 'true') {
    c.set('userEmail', c.env.DEV_USER_EMAIL || 'dev@localhost');
    await next();
    return;
  }

  if (!c.env.TEAM_DOMAIN || !c.env.POLICY_AUD) {
    return c.json({ error: 'Cloudflare Access is not configured (TEAM_DOMAIN / POLICY_AUD).' }, 500);
  }

  const token = c.req.header('cf-access-jwt-assertion');
  if (!token) {
    return c.json({ error: 'Missing Cloudflare Access token.' }, 403);
  }

  try {
    const { payload } = await jwtVerify(token, jwks(c.env.TEAM_DOMAIN), {
      issuer: c.env.TEAM_DOMAIN,
      audience: c.env.POLICY_AUD,
    });
    const p = payload as JWTPayload & { email?: string };
    c.set('userEmail', p.email || (typeof p.sub === 'string' ? p.sub : 'unknown'));
    await next();
  } catch {
    return c.json({ error: 'Invalid Cloudflare Access token.' }, 403);
  }
});
