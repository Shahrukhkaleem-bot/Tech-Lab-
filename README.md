# White-Label Commerce

A production-oriented, **multi-tenant e-commerce platform**: one Next.js 16 deployment + one Supabase
project serve any number of stores, each with its own domain, branding, catalogue, orders, customers,
policies, payments and shipping rules. Works for electronics, fashion, cosmetics, grocery or general retail.

The storefront layout follows modern accessory-store conventions: contact top bar, search-first header,
mega menu, hero slider, category carousel, trust badges, product rails, shop by price, brand grid,
review cards and a four-column footer. Every word, colour and image comes from tenant data.

**Live demo:** https://tech-lab-liard.vercel.app (serves the *Demo Electronics* store; per-store
subdomains become available once a custom domain with a wildcard is attached, see
[docs/08-deployment.md](docs/08-deployment.md)).

## Stack

Next.js 16 (App Router, `proxy.ts`, Server Components/Actions) · React 19 · TypeScript (strict) ·
Tailwind CSS 4 · shadcn/ui (Radix) · Zustand · React Hook Form · Zod 4 · Supabase (Postgres, RLS,
Auth, Storage) · Vitest · Playwright · GitHub Actions · Vercel

## Quick start

```bash
npm install
cp .env.example .env.local          # fill keys from `supabase status`
npx supabase start                  # Docker: migrations + demo seed
npm run dev
```

Open **http://demo-electronics.localhost:3000** (also `demo-fashion`, `demo-accessories`).
For admin access, register an account, then run in SQL: `select public.seed_grant_demo_owner('you@example.com');`
and open `/admin`.

| Command | What it does |
|---|---|
| `npm run check` | typecheck + lint + unit tests |
| `npm run test:db` | migrations + seed + RLS/isolation/order/concurrency tests on any Postgres ≥ 15 (`PGHOST`, `PGPORT`, `PGUSER`) |
| `npm run test:e2e` | Playwright (needs `supabase start`) |
| `npm run build` | production build |
| `npm run tenant:provision -- --name "Acme" --subdomain acme --owner a@acme.com` | create a store (service role) |
| `npm run db:types` | regenerate `src/types/database.ts` |

## Documentation (by phase)

| Doc | Phases |
|---|---|
| [01 Architecture overview](docs/01-architecture.md) | 0 — system, frontend, backend, tenancy, auth, storage, payments, orders, deployment, routing, security, caching, SEO |
| [02 Database](docs/02-database.md) | 2 — schema, every additional table, functions, ERD |
| [03 RLS & storage](docs/03-rls.md) | 2–3 — RLS model, policies, buckets |
| [04 Auth & roles](docs/04-auth.md) | 4 — authentication, role matrix, enforcement |
| [05 Tenancy & branding](docs/05-tenancy-and-branding.md) | 5–6 — host resolution, custom domains, theme system |
| [06 API, payments, shipping](docs/06-api-payments-shipping.md) | 10, 16–18 — actions vs routes vs functions, checkout, lifecycles, providers |
| [07 Security review](docs/07-security.md) | 15 |
| [08 Deployment](docs/08-deployment.md) | 19, 22–24 — env vars, CI/CD, Vercel, wildcard & custom domains, Supabase production |
| [09 Performance & testing](docs/09-performance-and-testing.md) | 14, 20, 21 |
| [10 Checklist & roadmap](docs/10-checklist-and-roadmap.md) | 25 — checklist, known gaps, scaling, future work |

## Project structure

```text
src/
├── proxy.ts                         # host → tenant key → internal rewrite; session refresh
├── app/
│   ├── [domain]/                    # tenant ROOT layout (theme vars, providers)
│   │   ├── (store)/                 # storefront: home, products, categories/[...path], brands,
│   │   │                            #   checkout, order-success, account, auth pages, pages/[slug], contact
│   │   ├── admin/                   # dashboard, products, categories, brands, orders, reviews, banners, settings
│   │   ├── api/search/suggest/      # typeahead (CDN-cacheable)
│   │   ├── auth/callback/           # email confirm / recovery / OAuth (PKCE)
│   │   ├── sitemap.xml/ robots.txt/ # per-tenant SEO
│   ├── platform/                    # apex-domain site
│   ├── api/{health,webhooks/stripe} # platform-level endpoints
│   ├── global-error.tsx · global-not-found.tsx · fonts.ts · globals.css
├── components/                      # presentation only
│   ├── ui/ (shadcn) · common/ · layout/ · navigation/ · home/ · products/ · cart/
│   ├── checkout/ · orders/ · reviews/ · auth/ · wishlist/ · providers/ · admin/
├── features/                        # business logic: queries, actions, schemas, services
│   ├── tenants/ · catalog/ · checkout/ · orders/ · auth/ · reviews/ · wishlist/ · seo/
│   └── admin/ (context, products, catalog, orders, reviews, settings, uploads, dashboard)
├── lib/
│   ├── supabase/ (server, public, service, browser, proxy-session)
│   ├── payments/ (types, registry, providers: cod, bank-transfer, stripe, local-gateway)
│   ├── shipping/ (types, registry, providers/manual)
│   ├── search/ (provider interface + Postgres implementation)
│   ├── tenant/ · cache/ · errors/ · security/ · storage/ · actions/ · utils/ · logger.ts
├── stores/ (cart, wishlist, ui, filter-draft)
├── hooks/ · config/ · types/database.ts
supabase/
├── migrations/ (0001–0009) · seed.sql (dev only) · config.toml
└── tests/ (*.test.sql, concurrency.sh, bootstrap/)
e2e/ · scripts/ · docs/ · .github/workflows/{ci,deploy}.yml
```

**Why this structure:** `app/` is routing only; `features/` owns business rules per domain (so
the same rule serves a page, an action and a route handler); `components/` is presentation;
`lib/` holds infrastructure behind interfaces (payments, shipping, search, Supabase clients),
so providers can be swapped without touching features or UI.

## Security posture (summary)

RLS on every table · composite tenant foreign keys · tenant always derived from the Host header ·
orders created only by a locked, idempotent SQL function (server re-prices everything) ·
service-role key confined to one server-only module · signed webhooks · rate limiting ·
no raw HTML rendering of tenant content · CSP/HSTS headers. Details: [docs/07-security.md](docs/07-security.md).
