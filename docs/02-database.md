# Phase 2 — Database design

Migrations: [`supabase/migrations/`](../supabase/migrations) (apply in filename order).
Seed (development only): [`supabase/seed.sql`](../supabase/seed.sql).

| Migration | Contents |
|---|---|
| `…0001_foundation` | `pg_trgm`, private `app_private` schema, enums, generic helpers |
| `…0002_tenancy` | `tenants`, `profiles`, `tenant_members`, membership helpers, guard triggers |
| `…0003_catalog` | `categories`, `brands`, `products`, `product_costs`, `product_images`, `reviews`, `inventory_movements` + search/rating/stock triggers |
| `…0004_storefront_content` | `store_settings`, `banners`, `store_pages`, `navigation_items` |
| `…0005_commerce` | `coupons`, `orders`, `order_items`, `order_status_history`, `payment_transactions`, `coupon_redemptions`, `wishlist_items`, `rate_limits` |
| `…0006_functions` | `quote_order`, `place_order`, `cancel_order`, `return_order`, `record_payment`, `search_products`, `consume_rate_limit`, `get_dashboard_stats`, `provision_tenant` |
| `…0007_rls` | RLS on every table + all policies ([docs/03-rls.md](03-rls.md)) |
| `…0008_storage` | Buckets + storage policies |
| `…0009_admin_functions` | `admin_save_product` (atomic product + images + cost save) |

## Design rules

1. **`tenant_id` everywhere.** Every tenant-owned row carries `tenant_id`, including child rows
   (`product_images`, `order_items`, …), so every RLS policy is a single-table check.
2. **Composite foreign keys** `(tenant_id, parent_id) → parent(tenant_id, id)` make a cross-tenant
   reference *impossible at the constraint level* (tested in `01_tenant_isolation.test.sql`).
   `ON DELETE SET NULL (column)` (PG15+) nulls only the reference column, never `tenant_id`.
3. **Money:** `numeric(12,2)`. `orders.total_amount = subtotal + shipping_fee - discount_amount`
   is a CHECK constraint; `order_items.subtotal` and `products.price` are generated columns.
4. **Snapshots:** order items copy name, SKU, slug, image and unit price at purchase time.
5. **System-maintained aggregates** (`rating`, `review_count`, `sales_count`) are forced back to
   their old values by a trigger when a client role tries to write them.
6. **Every stock change is logged** by an `AFTER UPDATE OF stock_quantity` trigger into
   `inventory_movements` (reason: `sale`, `cancellation`, `return`, `adjustment`, …).
7. **Order lifecycle is a state machine in SQL** (`app_private.order_transition_allowed`), mirrored
   in `src/features/orders/status.ts` for the UI only.

## Required tables (from the brief)

`tenants`, `categories` (nested, max depth 3, cycle-proof), `brands`, `products`,
`product_images`, `reviews`, `orders`, `order_items`, with every field requested, plus the
extras noted below.

Deviations from the brief, and why:

| Brief | Implemented | Reason |
|---|---|---|
| `products.cost_price` | `product_costs` table | RLS is row-level: any visitor who can read a product row could read its cost. A separate manager-only table keeps margins private. |
| `products.is_on_sale` (writable) | generated column | Can never disagree with `sale_price`. |
| Contact info inside `brand_config` | `tenants.contact_email/phone/whatsapp/address` + `social_links` | Individually validated/queryable; `brand_config` stays purely visual. |
| Separate `shipments` table | shipment columns on `orders` | One shipment per order covers the target market; add a `shipments` table when split shipments are needed. |
| `order_status` + `delivery status` | single `order_status` enum incl. `shipped`, `out_for_delivery`, `delivered` | One source of truth; avoids contradictory status pairs. |
| `/order-success/[orderId]` | `/order-success/[orderId]?token=…` | Guest orders contain PII. A random `public_token` (122 bits) is required in addition to the id. |

## Additional tables — and why each exists

| Table | Why it's needed |
|---|---|
| `profiles` | 1:1 with `auth.users`; display name/phone without touching the auth schema. Created by trigger. |
| `tenant_members` | Who manages which store and with what role. Basis of every RLS policy. No `roles`/`permissions` tables: the role set is fixed, so a code-level capability map (`src/features/auth/roles.ts`) + SQL rank function is simpler and auditable. |
| `product_costs` | Private cost/margin data (see above). |
| `inventory_movements` | Append-only stock ledger for audits and stock disputes. |
| `store_settings` | Per-tenant storefront config (trust badges, homepage layout, shipping rules, payment config, location, SEO). **Public by design — never store secrets here.** |
| `banners` | Hero slides with schedules (`starts_at`/`ends_at` evaluated by RLS). |
| `store_pages` | Policies and content pages (plain text, never rendered as HTML). |
| `navigation_items` | Tenant-defined header links and the three footer link columns. |
| `coupons`, `coupon_redemptions` | Discounts with global and per-customer usage limits enforced under row locks. |
| `order_status_history` | Trigger-written audit trail of order/payment status changes. |
| `payment_transactions` | One row per payment attempt/refund; unique `(provider, provider_reference)` makes webhooks idempotent. |
| `wishlist_items` | Server-side wishlist for signed-in customers (guests keep a local one). |
| `rate_limits` | Fixed-window counters for checkout/sign-in/coupon abuse, service role only. Add a `pg_cron` job to purge old rows. |

Not added (deliberately): `addresses` (orders snapshot the address; add when saved addresses
are a product requirement), `roles`/`permissions` (fixed role set), `shipments` (see above).

## Key functions

| Function | Security | Called by | Purpose |
|---|---|---|---|
| `place_order` | DEFINER, `service_role` only | checkout service | The only way to create an order. Tenant row lock → allocate order number → lock products `FOR UPDATE` in id order → validate stock + prices → `PRICE_CHANGED` guard → coupon (row-locked) → insert order + items → decrement stock → pending payment row. Idempotent per `(tenant, idempotency_key)`, including the concurrent-duplicate race. |
| `quote_order` | DEFINER, `service_role` only | checkout | Read-only priced cart + coupon evaluation (rate limited in the app). |
| `cancel_order` / `return_order` | DEFINER, checks `manager`, own pending order, or service caller | admin, webhooks | Restore stock and coupon usage atomically. |
| `record_payment` | DEFINER, `service_role` only | webhooks | Idempotent; verifies amount + currency before marking an order paid. |
| `search_products` | INVOKER (RLS applies) | search provider | FTS + trigram + filters + sort + total count in one query. |
| `admin_save_product` | INVOKER (RLS applies) | admin | Product + images + cost in one transaction. |
| `consume_rate_limit` | DEFINER, `service_role` only | app | Fixed-window limiter. |

> **Lesson recorded in code:** inside a `SECURITY DEFINER` function `current_user` is the owner,
> so role checks there use `app_private.is_service_caller()` (reads the PostgREST `role`
> setting), never `current_user`. A test exists for exactly this.

## ERD

```mermaid
erDiagram
  TENANTS ||--o{ TENANT_MEMBERS : has
  TENANTS ||--|| STORE_SETTINGS : configures
  TENANTS ||--o{ CATEGORIES : owns
  TENANTS ||--o{ BRANDS : owns
  TENANTS ||--o{ PRODUCTS : owns
  TENANTS ||--o{ BANNERS : owns
  TENANTS ||--o{ STORE_PAGES : owns
  TENANTS ||--o{ NAVIGATION_ITEMS : owns
  TENANTS ||--o{ COUPONS : owns
  TENANTS ||--o{ ORDERS : receives
  AUTH_USERS ||--|| PROFILES : has
  AUTH_USERS ||--o{ TENANT_MEMBERS : "is member"
  AUTH_USERS ||--o{ ORDERS : places
  AUTH_USERS ||--o{ WISHLIST_ITEMS : saves
  AUTH_USERS ||--o{ REVIEWS : writes
  CATEGORIES ||--o{ CATEGORIES : parent
  CATEGORIES ||--o{ PRODUCTS : groups
  BRANDS ||--o{ PRODUCTS : makes
  PRODUCTS ||--o| PRODUCT_COSTS : "private cost"
  PRODUCTS ||--o{ PRODUCT_IMAGES : has
  PRODUCTS ||--o{ REVIEWS : receives
  PRODUCTS ||--o{ INVENTORY_MOVEMENTS : logs
  PRODUCTS ||--o{ WISHLIST_ITEMS : "saved as"
  PRODUCTS ||--o{ ORDER_ITEMS : "sold as (nullable)"
  ORDERS ||--|{ ORDER_ITEMS : contains
  ORDERS ||--o{ ORDER_STATUS_HISTORY : audits
  ORDERS ||--o{ PAYMENT_TRANSACTIONS : "paid by"
  ORDERS ||--o| COUPON_REDEMPTIONS : uses
  COUPONS ||--o{ COUPON_REDEMPTIONS : redeemed
  COUPONS ||--o{ ORDERS : discounts

  TENANTS { uuid id PK; text subdomain UK; text custom_domain UK; tenant_status status; jsonb brand_config; bigint order_number_seq }
  PRODUCTS { uuid id PK; uuid tenant_id FK; text slug; numeric original_price; numeric sale_price; numeric price "generated"; int stock_quantity; tsvector search_vector }
  ORDERS { uuid id PK; uuid tenant_id FK; bigint order_number; numeric total_amount; order_status order_status; payment_status payment_status; uuid public_token; uuid idempotency_key }
  ORDER_ITEMS { uuid id PK; uuid order_id FK; uuid product_id "nullable"; text product_name_snapshot; numeric unit_price; int quantity }
```

## Running migrations

```bash
supabase start          # local stack; applies migrations + seed.sql
supabase db reset       # re-apply from scratch
npm run test:db         # plain-Postgres test run (no Docker needed; see scripts/test-db.sh)
supabase db push        # production (CI does this; seed.sql is never pushed)
npm run db:types        # regenerate src/types/database.ts after schema changes
```
