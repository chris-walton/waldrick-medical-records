/** Worker runtime bindings, configured in wrangler.jsonc. */
export interface Bindings {
  DB: D1Database;
  DOCS: R2Bucket;
  ASSETS: Fetcher;
  TEAM_DOMAIN: string;
  POLICY_AUD: string;
  // Local-dev-only (set in .dev.vars, never on a deployed Worker):
  DEV_MODE?: string;
  DEV_USER_EMAIL?: string;
}

/** Values set on the Hono context by middleware. */
export interface Variables {
  userEmail: string;
}

export type Ctx = { Bindings: Bindings; Variables: Variables };
