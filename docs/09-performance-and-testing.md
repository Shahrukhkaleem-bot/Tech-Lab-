# Phases 14, 20, 21 — Performance, error handling, testing

## Static vs cached vs revalidated vs dynamic

| Class | What | How |
|---|---|---|
| **Static** | JS/CSS/fonts, `public/`, platform landing page | Built once, immutable CDN caching |
| **Cached (data cache, tag-invalidated)** | Tenant config/theme, settings, navigation, categories, brands, banners, pages | `unstable_cache`, tags `tenant-key:*` / `tenant:{id}:*`, TTL 1 h safety net, **invalidated immediately** by admin saves |
| **Revalidated (short TTL + tags)** | Product lists, product detail, reviews, homepage rails | TTL 5–10 min + tag invalidation on catalogue/review changes. Stock shown is informational; checkout re-checks. |
| **ISR pages** | Storefront pages without per-user data (`/`, `/products`, brands, contact…) | Empty `generateStaticParams` on the tenant root layout: rendered on first request per host path, then cached |
| **Dynamic** | Admin, account, checkout, login, order confirmation, cart refresh, quote, webhooks | `force-dynamic` / per-request; never cached |

## Optimisations in place

- **Server Components by default**; client islands only for interactivity (cart, carousels, forms).
- **Database:** partial indexes matching every storefront filter (`where is_active`), GIN FTS + trigram,
  `(tenant_id, …)` leading columns; one-round-trip search with `count(*) over ()`; InitPlan-friendly RLS.
- **Images:** `next/image` (AVIF/WebP, 30-day cache), explicit `sizes`, `priority` only above the fold,
  art-directed hero via `<picture>`; branded placeholder instead of broken images.
- **Streaming:** each homepage rail and related products stream behind `Suspense` with skeletons.
- **Bundle:** no carousel/chart/icon-font libraries (hand-rolled carousel and SVG chart); lucide icons are tree-shaken;
  fonts `display: swap`, `preload: false` (only the tenant's font downloads).
- **Proxy is DB-free** and skips session refresh on catalogue routes → catalogue responses stay cacheable.
- **Lazy work:** quick view loads product data only when opened; the Google Maps iframe is `loading="lazy"`.

## Error handling

| Layer | Behaviour |
|---|---|
| SQL business errors | Stable codes (`INSUFFICIENT_STOCK`, `PRICE_CHANGED`, …) → `toAppError()` → friendly message |
| Unknown DB errors | Logged (`db.unexpected_error`), user sees a generic message |
| Server Actions | `runAction()` → `ActionResult` with `fieldErrors` for Zod; reference id for unexpected errors |
| Route handlers | `{ error: { code, message } }` + HTTP status |
| Rendering | `(store)/error.tsx` (retry), `global-error.tsx`, branded `not-found.tsx`, `global-not-found.tsx` for unknown hosts |
| Loading | In-page `Suspense` skeletons (homepage rails, related products), `aria-busy`. No route-level `loading.tsx` in the storefront on purpose: it would stream a 200 before `notFound()` runs, turning real 404s into soft 404s. |
| Empty states | `EmptyState` component for cart, wishlist, listings, orders, admin tables |
| Logging | JSON lines with redaction (`lib/logger.ts`); swap `emit` for Sentry/Datadog without touching call sites |

## Testing strategy

| Level | Tooling | Covers | Command |
|---|---|---|---|
| Unit | Vitest | host resolution, pricing, formatting, contrast, URL filters, category tree, cart store (limits, server refresh, tampered persistence), Stripe signatures, safe redirects, JSON-LD escaping, checkout schema | `npm test` |
| Database / integration | SQL tests + `psql` | RLS per role, tenant isolation, storage paths, order placement, stock deduction, idempotency, coupons, payments, search, admin save, **real concurrency race** | `npm run test:db` |
| E2E | Playwright | browse → add to cart → checkout → confirmation; filters; out-of-stock; 404; tenant branding/catalogue/cart isolation; sitemap per host; admin redirect; admin product create, order fulfilment, branding (with credentials) | `supabase start && npm run test:e2e` |

Verified: typecheck, lint (0 warnings), 46 unit tests, 4 database suites (including the
concurrency race) on plain Postgres, the 3 rollback-only database suites on the hosted Supabase
project, and 12 Playwright E2E tests (desktop) against `next dev` + the hosted project. The 3
signed-in admin E2E tests need `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`.
