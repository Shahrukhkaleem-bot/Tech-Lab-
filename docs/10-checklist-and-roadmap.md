# Phase 25 — Production checklist, scaling & roadmap

## Checklist

### Security
- [x] RLS enabled on every table (migration 0007; verify in dashboard after `db push`)
- [x] Tenant isolation tested (`supabase/tests/01_tenant_isolation.test.sql`, `e2e/tenancy.spec.ts`)
- [x] Secrets protected (`server-only`, CI bundle grep)
- [x] Admin routes protected (proxy + layout + every action + RLS)
- [x] Input validation enabled (Zod + DB constraints)
- [x] Upload validation enabled (bucket MIME/size, path policy, signed URLs)
- [ ] Supabase: leaked-password protection, email confirmation, staff MFA
- [ ] Vercel WAF / rate-limit rules for `/api/*`

### Database
- [x] Indexes created (partial, GIN, trigram)
- [x] Foreign keys configured (composite tenant FKs)
- [x] Constraints configured (money, status, formats)
- [x] Migrations tested (plain Postgres suite; CI on real Supabase)
- [ ] Backup strategy configured (PITR + quarterly restore test)
- [ ] `pg_cron` cleanup for `rate_limits`

### Frontend
- [x] Responsive (mobile-first; mobile Playwright project)
- [x] SEO (metadata, canonical, OG/Twitter, sitemap, robots, JSON-LD)
- [x] Accessibility (semantic landmarks, skip link, labelled controls, focus states, reduced motion)
- [x] Image optimisation
- [x] Error states / loading states / empty states
- [ ] Lighthouse + axe pass on a real tenant with real images

### Deployment
- [ ] Vercel project configured (env vars per environment)
- [ ] Supabase production + staging projects
- [ ] DNS: Vercel nameservers for `example.com`; wildcard `*.example.com`
- [ ] SSL active (automatic after DNS)
- [ ] GitHub secrets + `production` environment reviewers
- [ ] CI/CD green on `main`

### E-commerce
- [x] Cart tested (unit)
- [x] Checkout tested (SQL + E2E spec)
- [x] Stock deduction tested (incl. concurrency)
- [x] Order creation tested (idempotency, price/stock/coupon rejections)
- [x] Payment status tested (webhook path, amount mismatch, idempotency)
- [x] Shipping tested (rate rules unit-tested; tracking via admin E2E)
- [x] Admin order management tested (state machine SQL tests + E2E)
- [ ] Stripe live webhook verified end-to-end (test mode first)

## Known gaps (not yet built)

| Gap | Current workaround | Effort |
|---|---|---|
| Coupons admin UI | Tables, validation and RLS are done; manage rows via SQL/dashboard | S |
| Team members admin UI | `tenant_members` + RLS + owner guards are done; use SQL or `tenant:provision` | S |
| Transactional email (order confirmation, shipping updates) | Confirmation page + account order history | M (Edge Function + Resend) |
| Signed-in wishlist merge on login | Local wishlist + per-toggle server mirror | S |
| Local payment gateway | Template + integration guide in `local-gateway.ts` | M per gateway |
| Custom-domain self-service | Operator adds the domain in Vercel and sets `custom_domain_verified_at` | M (Vercel Domains API) |

## Scaling strategy

1. **Reads:** the data cache + ISR absorb catalogue traffic; Supabase read replicas for heavy tenants;
   `use cache: remote` / Redis cache handler if serverless cache misses become significant.
2. **Search:** swap `postgresSearchProvider` for Typesense/Algolia behind `ProductSearchProvider`
   when a tenant passes ~100k products or needs typo tolerance and facets at scale.
3. **Checkout contention:** `place_order` serialises per tenant (order-number row). For flash sales,
   switch to a per-tenant sequence and keep product-row locks (the order is already deterministic).
4. **Connections:** use Supabase's pooler (transaction mode) for serverless bursts.
5. **Noisy neighbours:** per-tenant rate limits; move very large tenants to a dedicated Supabase
   project (the schema is identical; routing by tenant → project map).
6. **Media:** Supabase Storage + Next image optimisation; move to a dedicated image CDN if transforms dominate cost.

## Recommended future improvements

- Product variants (size/colour) with per-variant stock and SKU
- Multi-currency display + tax rules per region
- Abandoned-cart recovery, back-in-stock alerts
- Customer segments, loyalty points, gift cards
- Returns portal with RMA numbers
- Courier API integrations (booking + label printing + live tracking webhooks)
- Analytics events (GA4 / PostHog) per tenant with consent management
- Theme presets and a visual homepage builder on top of `homepage_sections`
- Audit log for admin actions (who changed what) beyond orders/inventory
- i18n (Urdu/RTL) — the layout already supports `lang` per tenant
