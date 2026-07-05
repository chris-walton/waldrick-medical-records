# Waldrick Medical Records

A private, family medical-records tool. Track immunizations, an immunization/appointment
schedule, documents and alerts — broken down by family member, and extensible to any kind of
health record (medications, allergies, conditions, labs, dental, vision…), not just shots.

Runs as a **single Cloudflare Worker** that serves an **Angular** single-page app and a
`/api/*` JSON API, backed by:

- **D1** — SQLite database (family members, records, schedule, documents metadata, alerts)
- **R2** — document/file storage (scans, PDFs, images)
- **Cloudflare Access** — authentication (Zero Trust; the household signs in via your IdP)

## Features

- **Family members** — a profile per person; all records are scoped to a member.
- **Immunizations** — type, date received, where, plus dose/lot details.
- **Schedule** — what's due (boosters, checkups, refills); mark done to auto-log a record.
- **Alerts** — auto-generated from overdue/upcoming schedule items, plus manual alerts.
- **Documents** — upload to R2, download, attach to a member.
- **Extensible record types** — add new categories from Settings (label, icon, custom fields)
  with no code changes. Immunizations are just the first built-in type.

## Tech stack

Angular 20 (standalone components, signals, Angular Material) · Cloudflare Workers · Hono ·
D1 · R2 · Cloudflare Access · `jose` (JWT validation).

## Quick start

```bash
pnpm install
# configure Cloudflare resources — see SETUP.md
pnpm dev           # ng serve (:4200) + wrangler dev (:8787), with a local auth bypass
```

Full provisioning and deployment steps — creating D1/R2, applying migrations, and wiring up
Cloudflare Access — are in **[SETUP.md](./SETUP.md)**.

## Project layout

```
src/app/            Angular app (core/, shared/, features/*)
worker/             Worker API: index.ts, auth.ts, db.ts, routes/*
migrations/         D1 schema + seed
wrangler.jsonc      Worker config: ASSETS, D1 (DB), R2 (DOCS), Access vars
proxy.conf.json     Dev proxy: ng serve → wrangler /api
pnpm-workspace.yaml pnpm build-script approvals (esbuild, workerd, …)
```
