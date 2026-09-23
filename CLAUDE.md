# Waldrick Medical Records

Family medical-records app: one Cloudflare Worker serving an Angular 20 SPA (standalone components, signals, Angular Material) and a Hono `/api/*` JSON API, backed by D1, R2 and Cloudflare Access. Read `README.md` for the layout and `SETUP.md` for provisioning, deploy and the end-to-end verification flow.

## Commands

```
pnpm dev                                # ng serve :4200 + wrangler dev :8787 (auth bypassed via .dev.vars)
pnpm build                              # Angular build; does not typecheck worker/
pnpm exec tsc -p worker/tsconfig.json   # worker typecheck
pnpm db:migrate:local                   # apply migrations/ to local D1
pnpm run deploy                         # not `pnpm deploy`, which is a pnpm built-in
```

There is no test suite or linter; the two builds above are the checks.

## Constraints

- Schema changes go in a new `migrations/000N_*.sql`. Never edit a migration that has shipped.
- Every write route whitelists columns with `pick(body, FIELDS)` before `setClause`, which interpolates column names.
- `DEV_MODE` lives only in the gitignored `.dev.vars`. It disables JWT verification.
- All API routes mount under the `api` Hono app in `worker/index.ts` so `accessAuth` runs.
- Changes to `wrangler.jsonc`, `package.json` scripts or migrations must update `SETUP.md` in the same change.

## Skills

Checked in under `.agents/skills/<name>/`, symlinked from `.claude/skills/<name>`:

| Skill | Use for |
| --- | --- |
| `wrangler` | Any `wrangler` command: D1 migrations and queries, R2, deploy, `wrangler types`. |
| `workers-best-practices` | Writing or reviewing `worker/**` and `wrangler.jsonc`. |
| `impeccable` | UI and design work in `src/app/**` (bundle; use `impeccable craft` or `impeccable teach`). |

Both Cloudflare skills retrieve from the `cloudflare-docs` MCP server declared in `.mcp.json`.

Deliberately not copied, do not re-add:

- `cloudflare`: 2 MB reference tree covering ~60 products; this repo uses Workers, D1, R2 and static assets only, which `wrangler`, `workers-best-practices` and the `cloudflare-docs` MCP cover.
- `cloudflare-one`, `cloudflare-one-migrations`: Access is configured once in the dashboard (`SETUP.md` step 6); no Zero Trust work recurs here.
- `agents-sdk`, `durable-objects`, `sandbox-*`, `cloudflare-email-service`, `turnstile-spin`: products this app does not use.
- `web-perf`: private household app behind Access; load performance is not a recurring concern.
- `frontend-design`: superseded by `impeccable`.
- The loose impeccable sub-commands (`adapt`, `audit`, `polish`, `critique`, `typeset` and the rest): `impeccable` covers them.

## Agents

Repo-level agents in `.claude/agents/`, written against this codebase:

- `code-reviewer`: second-opinion diff review (migrations, `pick` whitelist, R2/D1 consistency, UTC dates).
- `security-engineer`: Access JWT, `DEV_MODE`, `run_worker_first`, inline document XSS.
- `accessibility-auditor`: WCAG pass over the Material dialogs, member colors and icon buttons.
- `evidence-collector`: runs `pnpm dev` and proves a change with screenshots via the `SETUP.md` flow.

The user-level `~/.claude/agents/` set is not required in this repo.
