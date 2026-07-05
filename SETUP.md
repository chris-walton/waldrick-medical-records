# Setup & Deployment Runbook

Waldrick Medical Records is a single Cloudflare Worker that serves an Angular SPA **and**
a `/api/*` JSON API, backed by **D1** (database), **R2** (documents) and **Cloudflare
Access** (authentication).

This runbook takes you from a fresh clone to a deployed, Access-protected app.

---

## Prerequisites

- **Node 20+** and **pnpm** (this project uses pnpm; a `pnpm-workspace.yaml` approves the
  native build scripts — esbuild, workerd, sharp — so `pnpm install` runs them without
  prompting. If you ever see an "ignored build scripts" notice, run `pnpm approve-builds`.)
- A **Cloudflare account** (Free tier works for D1/R2 at small scale — confirm current limits)
  with **Zero Trust** enabled for Cloudflare Access.
- The zone **`waldrickservices.com`** must be active in this same Cloudflare account (the app
  is served at **`medical.waldrickservices.com`** via a Workers Custom Domain — see step 5).
  There must be **no pre-existing CNAME** on `medical.waldrickservices.com`; Cloudflare creates
  the DNS record and TLS certificate automatically on deploy.
- Wrangler is installed as a dev dependency — run it with `pnpm exec wrangler …`.
- Authenticate wrangler once: `pnpm exec wrangler login`.

---

## 1. Install

```bash
pnpm install
```

## 2. Create the D1 database

```bash
pnpm exec wrangler d1 create waldrick-medical
```

Copy the printed `database_id` into **`wrangler.jsonc`**, replacing
`REPLACE_WITH_D1_DATABASE_ID`.

## 3. Create the R2 bucket

```bash
pnpm exec wrangler r2 bucket create waldrick-medical-docs
```

(The bucket name already matches `wrangler.jsonc`. Change both together if you rename it.)

## 4. Apply the database migrations

Local (for development) and remote (for production):

```bash
pnpm db:migrate:local     # applies to the local dev D1
pnpm db:migrate:remote    # applies to the real D1
```

Migrations live in `migrations/` and are applied in order. `0002_seed_record_types.sql`
seeds the seven built-in record types (immunization, medication, allergy, condition,
lab result, visit, vitals).

## 5. First deploy

Deploy once so the Worker and its Custom Domain exist (Access is attached to the domain in the
next step). Because `wrangler.jsonc` declares the `medical.waldrickservices.com` Custom Domain,
this deploy also creates the DNS record and provisions the TLS certificate automatically:

```bash
pnpm run deploy    # builds the Angular app, then `wrangler deploy`
# (use `pnpm run deploy`, not `pnpm deploy` — the latter is a built-in pnpm command)
```

The app will be reachable at **`https://medical.waldrickservices.com`** once the certificate
finishes provisioning (usually a minute or two; it can take longer on first issuance). A
`workers.dev` URL is also available unless you disable it.

## 6. Protect it with Cloudflare Access

1. In the **Zero Trust dashboard** → **Access → Applications → Add an application →
   Self-hosted**.
2. Set the application domain to **`medical.waldrickservices.com`** (the Custom Domain from
   step 5).
3. Add a **policy** allowing your household (e.g. an *Emails* rule listing each person's
   email, or an *Email domain* rule).
4. After creating it, open the application's **settings** and copy the **Application Audience
   (AUD) tag**.
5. In **`wrangler.jsonc`** set:
   - `POLICY_AUD` → the AUD tag
   - `TEAM_DOMAIN` → `https://<your-team-name>.cloudflareaccess.com`

   These are non-secret identifiers, so keeping them in `wrangler.jsonc` `vars` is fine.

## 7. Redeploy

```bash
pnpm run deploy
```

Visit the URL — you'll be redirected to your identity provider by Access, and after signing
in the app loads. The Worker independently validates the Access JWT on every `/api` request
(`worker/auth.ts`), so the API can't be reached without a valid Access session.

---

## Local development

Cloudflare Access only runs in front of the deployed Worker, so locally the Worker uses a
**dev bypass**: when `DEV_MODE=true` it skips JWT verification and treats the request as
authenticated by `DEV_USER_EMAIL`. This is configured in **`.dev.vars`** (gitignored) and is
never present on the deployed Worker.

```bash
# .dev.vars  (already created for you)
DEV_MODE=true
DEV_USER_EMAIL=you@example.com
```

Two ways to run locally:

```bash
# A) Full stack in one process — wrangler serves the built SPA + API on :8787
pnpm build
pnpm worker:dev            # http://localhost:8787

# B) Fast Angular iteration — ng serve on :4200 proxies /api to wrangler on :8787
pnpm dev                   # runs `ng serve` + `wrangler dev` together
#   → open http://localhost:4200  (see proxy.conf.json)
```

Handy database commands:

```bash
pnpm db:tables:local
pnpm exec wrangler d1 execute waldrick-medical --local --command "SELECT * FROM record_types"
```

---

## Verifying end-to-end

1. Add a **family member**.
2. On their detail page → **Immunizations** tab → add one (vaccine type, date received, where,
   dose/lot).
3. **Schedule** tab → add an item with a **past** due date and a type → it appears as an
   **urgent** alert on the Dashboard and Alerts page.
4. Use the alert's / schedule row's **✓** to mark it done — a completed record is logged and
   the alert clears.
5. **Documents** tab → upload a file, then open it (it streams back from R2).

---

## Extending: tracking more than shots

The data model is generic. To track a new kind of record (dental, vision, therapy,
insurance…), go to **Settings → Add a record type**: give it a label, a
[Material icon](https://fonts.google.com/icons) name, and optional extra fields. New records of
that type immediately get a dynamic form and their own view — no code or schema change.
"Immunization" is just the first built-in type (records with `record_type.key = 'immunization'`).

---

## Architecture at a glance

| Concern        | Where |
| -------------- | ----- |
| SPA + API host | One Worker. `wrangler.jsonc` `assets.run_worker_first: ["/api/*"]` sends only API calls to the Worker; everything else is static assets, with `not_found_handling: "single-page-application"` for deep links. |
| API            | Hono app in `worker/index.ts`, routes in `worker/routes/*.ts`. |
| Auth           | `worker/auth.ts` — validates the `Cf-Access-Jwt-Assertion` JWT with `jose` against `${TEAM_DOMAIN}/cdn-cgi/access/certs`, checking issuer + `POLICY_AUD`. Dev bypass guarded by `DEV_MODE`. |
| Database       | D1 (`DB` binding). Schema in `migrations/0001_init.sql`. |
| Documents      | R2 (`DOCS` binding). Bytes in R2, metadata rows in D1. |
| Frontend       | Angular 20 (standalone + signals) with Angular Material. `src/app/`. |

Visibility is **household-shared**: any Access-authorized user sees every family member's
records.
