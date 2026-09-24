# Phase 15 — Security review

Status legend: ✅ implemented & tested · 🟡 implemented, verify in your environment · 🔧 configure before launch

| Area | Threat | Control | Where | Status |
|---|---|---|---|---|
| **RLS** | Data readable/writable across tenants | RLS on every table, deny-by-default, `anon` write privileges revoked | `…0007_rls.sql` | ✅ `01_tenant_isolation.test.sql` |
| **Tenant isolation** | Store A references/edits store B data | Composite `(tenant_id, id)` FKs; tenant from Host header only; all queries require `tenantId` | migrations, `features/tenants/current.ts` | ✅ |
| | URL path addressing another tenant | Proxy always prefixes the host's tenant key | `proxy.ts` | ✅ e2e `tenancy.spec.ts` |
| **Authentication** | Forged/stale sessions | `getUser()`/`getClaims()` (JWT verified), cookies per host, session refresh in proxy | `features/auth/session.ts` | ✅ |
| | Credential stuffing, enumeration | Rate limit per IP + per email; generic error messages; reset always "succeeds" | `features/auth/actions.ts` | ✅ |
| | Open redirect after login | `safeNextPath()` (same-origin paths only) | `lib/security/safe-redirect.ts` | ✅ unit tests |
| **Authorization** | Privilege escalation | Capability check in every admin action (`adminAction`) **and** RLS; owner-only owner management; last-owner guard; protected tenant columns | `features/admin/context.ts`, triggers | ✅ |
| | `SECURITY DEFINER` confusion | `is_service_caller()` (role setting) instead of `current_user`; `search_path = ''`; functions in non-exposed `app_private`; EXECUTE revoked from PUBLIC | `…0006_functions.sql` | ✅ regression test |
| **SQL injection** | Injected SQL / tsquery | Parameterised PostgREST; tsquery built from `[[:alnum:]]` tokens only; `ilike` input escaped; admin search strips `%_,()\` | `search_products`, admin queries | ✅ test |
| **XSS** | Stored XSS via tenant content | No `dangerouslySetInnerHTML` except JSON-LD (escaped `<>&` + line separators); plain-text rendering of pages/descriptions; no SVG uploads; CSP | `JsonLd`, `PlainText`, storage config, `next.config.ts` | ✅ unit test |
| **CSRF** | Cross-site form posts | Server Actions: Next checks `Origin` vs `Host`; cookies `SameSite=Lax`; no state-changing GET route | framework | ✅ |
| **Rate limiting** | Order spam, coupon brute force, auth abuse | Postgres fixed-window limiter (orders, quotes, sign-in/up, reset, reviews); Vercel DDoS protection outside | `lib/security/rate-limit.ts` | ✅ 🔧 add Vercel WAF rules for `/api/*` bursts |
| **Input validation** | Malformed input | Zod on every action/route + DB CHECK constraints (defence in depth) | `features/**/schemas.ts` | ✅ |
| **File uploads** | Malware, oversized files, path traversal, cross-tenant writes | Bucket MIME/size limits; server-generated names; path regex + tenant role in storage RLS; signed URLs | `…0008_storage.sql`, `features/admin/uploads` | ✅ |
| **API abuse** | Scraping / heavy queries | `max_rows = 1000`; page size capped at 60 in SQL; search suggestions CDN-cached | config, `search_products` | ✅ |
| **Secrets** | Service key / payment secret leaks | `server-only` modules; only `NEXT_PUBLIC_*` reach the client; CI greps the client bundle for secrets | `config/server-env.ts`, `ci.yml` | ✅ |
| **Service role** | Over-privileged server code | Single factory (`lib/supabase/service.ts`) with an allow-list of call sites; always passed a server-derived tenant id | | ✅ review on every PR |
| **Payments** | Forged payment confirmations | Hosted checkout only (PCI SAQ-A); HMAC webhook verification with 5-min tolerance; amount + currency re-checked in SQL; idempotent per reference | `providers/stripe.ts`, `record_payment` | ✅ unit + SQL tests |
| **Order manipulation** | Editing totals / status / someone else's order | Orders created only by `place_order` (service role); money columns immutable (trigger); state machine; guest access needs id **and** 122-bit token; `referrer: no-referrer` on confirmation page | | ✅ |
| **Price manipulation** | Client-sent prices | Client sends ids + quantities only; prices from DB inside the locked transaction; `PRICE_CHANGED` guard | | ✅ |
| **Stock manipulation** | Overselling, negative stock, races | `FOR UPDATE` row locks in id order; `CHECK (stock_quantity >= 0)`; ledger trigger; concurrency test | | ✅ `concurrency.sh` |
| **Headers** | Clickjacking, MIME sniffing, downgrade | CSP, HSTS (preload), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | `next.config.ts` | ✅ 🔧 submit to HSTS preload list once domains are final |
| **Logging** | PII / secrets in logs | Structured logger redacts password/token/cookie/card/IBAN keys; errors carry reference ids | `lib/logger.ts` | ✅ 🔧 attach a log drain + alerting |

## Known trade-offs / follow-ups

1. **CSP `script-src 'unsafe-inline'`**: required for ISR-cached pages (nonces force dynamic rendering).
   If you ever serve fully dynamic pages only, switch to nonce-based CSP in `proxy.ts`.
2. **Rate limiter fails open**: a DB outage disables limiting instead of blocking checkout.
   Move to Upstash/Redis (same function signature) for very high traffic.
3. **Customer accounts are platform-wide**: the same credentials work on every store. Acceptable for
   most SaaS; if a tenant needs fully separate customer bases, add a `tenant_customers` table and require it in customer policies.
4. **Enable Supabase leaked-password protection and MFA for staff** (Auth settings) before launch.
5. **Email**: no transactional email is sent yet. The confirmation page intentionally doesn't claim one was.
