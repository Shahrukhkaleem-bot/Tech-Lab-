# Phases 19, 22–24 — Environment, CI/CD, Vercel & Supabase production

## Environment variables

See [`.env.example`](../.env.example).

| Variable | Scope | Where to set |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Vercel (all envs) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Public | Vercel: `example.com` in Production; the preview domain is irrelevant (previews use `DEV_TENANT`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** | Vercel (Production and Preview use **different** Supabase projects) |
| `DEV_TENANT` | Server | Vercel Preview + local |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | **Server-only** | Vercel (test keys in Preview, live keys in Production) |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | CI | GitHub → Settings → Secrets → Actions |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` | CI | GitHub secrets (environment: `production`) |
| `PRODUCTION_HEALTH_URL` | CI | e.g. `https://example.com/api/health` |

## CI/CD (`.github/workflows`)

- **`ci.yml`** (every PR + main): `npm ci` → typecheck → lint (0 warnings) → unit tests with coverage →
  production build → grep the client bundle for secrets → **real Supabase stack** (`supabase start`)
  → DB tests (RLS, isolation, orders, concurrency) → Playwright E2E.
- **`deploy.yml`**: PR → Vercel preview + PR comment. `main` after CI passes → `supabase db push`
  (migrations only, never seed) → `vercel build --prod` → `vercel deploy --prebuilt --prod` → health check.
  Protect the `production` GitHub environment with required reviewers for a manual gate.

**Migration discipline:** migrations must be backward compatible with the running app
(expand → deploy → contract), because the DB is migrated just before the new app goes live.

GitHub setup: create environments `preview` and `production`; add the secrets above; disable
Vercel's own Git auto-deploy if you use this workflow (Project → Settings → Git), or keep Vercel's Git
integration and delete the `preview`/`production` jobs (then run `supabase db push` in a separate job).

## Vercel

1. `vercel link` → creates the project; copy `orgId`/`projectId` into GitHub secrets.
2. Framework preset: Next.js. Node 22. Build command `next build`.
3. Environment variables as in the table above.
4. **Domains** (Project → Settings → Domains):
   - `example.com` and `www.example.com` → platform site.
   - **`*.example.com`** → tenant subdomains. Vercel requires the domain to use **Vercel nameservers**
     for wildcard certificates (DNS-01). At your registrar set NS to `ns1.vercel-dns.com` / `ns2.vercel-dns.com`.
     Every `store.example.com` then works with automatic SSL; no per-tenant DNS work.
   - **Custom domains** (`shop-a.com`): add to the project (dashboard or `POST /v10/projects/{id}/domains`
     with `VERCEL_API_TOKEN`). The tenant creates an `A @ 76.76.21.21` record (apex) or
     `CNAME www cname.vercel-dns.com`. After Vercel shows "Valid Configuration", set
     `tenants.custom_domain` + `custom_domain_verified_at` (service role / SQL). SSL is automatic.
   - **Canonical redirect:** add `tenant.example.com` as an explicit domain with
     "Redirect to `shop-a.com` (308)". An explicit domain overrides the wildcard.
5. **Image optimisation:** `next.config.ts` allows `NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/public/**` only.
6. **Caching:** tenant pages are ISR-cached per host path; admin/account/checkout are `force-dynamic`.
   Tag invalidation happens on admin saves. `/api/search/suggest` and `/sitemap.xml` set `s-maxage`.
7. **Proxy** runs on the Node runtime (Next 16 default); no config needed.
8. **Stripe webhook:** endpoint `https://example.com/api/webhooks/stripe` (platform domain; excluded
   from tenant rewrites).

## Supabase production

1. Create **separate projects** for production and preview/staging (never share the service key).
2. `supabase link --project-ref <ref>` → `supabase db push` (CI does this on main).
   The direct host `db.<ref>.supabase.co` is **IPv6-only**; from IPv4 networks use the session pooler:
   `supabase db push --db-url "postgresql://postgres.<ref>:<url-encoded-password>@aws-0-<region>.pooler.supabase.com:5432/postgres"`
   (URL-encode special characters in the password, e.g. `@` → `%40`).
3. **RLS:** verify in the dashboard that every table shows "RLS enabled"; run
   `TARGET=supabase ./scripts/test-db.sh` against a staging copy after schema changes.
4. **Storage:** buckets and policies come from migration 0008. Don't create buckets by hand.
5. **Auth → URL configuration:** Site URL `https://example.com`; Redirect URLs:
   `https://*.example.com/**` and `https://<each custom domain>/**` (add when a domain is verified).
   Enable **leaked password protection**, set minimum password length 8, require email confirmation.
6. **Email:** configure custom SMTP (Resend, Postmark, SES) under Auth → SMTP; the default sender is
   rate limited and not for production. Customise templates with the tenant-neutral platform name.
7. **Edge Functions:** none are required yet. Future: order e-mails (DB webhook on `orders` insert),
   courier tracking sync (`pg_cron` schedule), search-index sync.
8. **Backups:** enable **Point-in-Time Recovery** (Pro plan+); test a restore into a staging project quarterly.
9. **Monitoring:** Supabase → Reports (DB CPU, connections), Query Performance (slow queries), log drains;
   Vercel → Observability + a log drain; uptime monitor on `/api/health`; alert on 5xx rate and on
   `stripe.webhook.processing_failed` / `db.unexpected_error` log events.
10. **Housekeeping (`pg_cron`):** `delete from public.rate_limits where window_start < now() - interval '1 day';` hourly.

## Local development

```bash
cp .env.example .env.local        # fill anon + service keys from `supabase status`
supabase start                    # Docker; applies migrations + seed
npm run dev
# open http://demo-electronics.localhost:3000 (also demo-fashion / demo-accessories)
# Admin: register, then in SQL: select public.seed_grant_demo_owner('you@example.com');
```

No Docker? `PGHOST=… PGPORT=… PGUSER=postgres npm run test:db` runs the migrations and database
tests against any plain Postgres ≥ 15.
