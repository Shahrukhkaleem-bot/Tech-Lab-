# Row Level Security & Storage (Phases 2–3)

## The model

RLS is enabled on **every** table; without a matching policy, access is denied.

| Audience | Can read | Can write |
|---|---|---|
| `anon` (any visitor) | Active rows of **active** tenants: tenants, categories, brands, products, images, approved reviews, live banners, published pages, nav, store settings | Nothing (INSERT/UPDATE/DELETE privileges are revoked from `anon`) |
| Signed-in customer | Everything anon can read, plus **their own** orders, order items, status history, wishlist, profile and reviews | Own wishlist, own profile, own reviews (forced to *pending*) |
| Tenant member (`staff` → `owner`) | Everything in **their** tenant(s), by role (costs, coupons and payments need manager+) | By role (see [04-auth.md](04-auth.md)) |
| `service_role` (server only) | All (bypasses RLS) | Only used for order placement, guest order lookup by token, webhooks and rate limiting |

### Why public catalogue data is not "scoped to the current tenant" by RLS

The anon key is shared by every store. For an anonymous request, RLS has no trustworthy way to know
which store the visitor is on: a header or claim would come from the client. So:

- **Public data** (products, categories and so on of active stores) is public by nature. **Which** store's
  data a page shows is decided by the server from the Host header, and every repository function
  requires a `tenantId` argument and filters on it.
- **Private data** (orders, customers, costs, coupons, drafts, payments, memberships) is
  isolated by RLS against `tenant_members`, so a bug in application code still cannot leak it.

### Policy pattern

```sql
using (tenant_id in (select app_private.member_tenant_ids('manager')))
```

`member_tenant_ids()` is a `SECURITY DEFINER STABLE` function in the non-exposed `app_private`
schema. Postgres evaluates the sub-select **once per statement** (InitPlan), so policies stay fast
on large tables. `auth.uid()` is always wrapped as `(select auth.uid())` for the same reason.

### Column-level rules (triggers)

RLS is row-level. These column rules are enforced by `BEFORE` triggers:

| Rule | Trigger |
|---|---|
| Admins cannot change `subdomain`, `custom_domain`, `status`, `order_number_seq` | `tenants_guard_protected_columns` |
| Only owners manage owners; never remove the last owner | `tenant_members_guard` |
| Clients cannot write `rating`, `review_count`, `sales_count` | `products_guard_aggregates` |
| Reviews: `user_id := auth.uid()`, `is_approved := false`, `is_verified` derived from a delivered order | `reviews_guard` |
| Order money/identity columns are immutable; valid transitions only; cancel/return only via functions (restock); payment status manager+ | `orders_guard` |

## Tests

`supabase/tests/01_tenant_isolation.test.sql` impersonates `anon`, an owner of store A, staff of
store A and a customer (`set local role` + `request.jwt.claims`), and asserts:

- anon sees no orders, costs, coupons, memberships, drafts or unapproved reviews; anon cannot write or call `place_order`
- owner A cannot read, update, delete or insert tenant B rows; cross-tenant FK references fail
- staff cannot edit products, see costs, change totals or payment status, skip states, or cancel orders
- customers see only their own orders; review/wishlist forging is blocked
- suspended tenants disappear from the public catalogue
- storage paths are tenant-scoped; malformed/SVG paths and staff uploads are rejected

## Storage (Phase 3)

| Bucket | Public read | Max size | MIME | Write role |
|---|---|---|---|---|
| `tenant-assets` (logo, favicon, banners) | yes | 2 MB | png, jpeg, webp, avif, ico | manager+ |
| `product-images` | yes | 5 MB | png, jpeg, webp, avif | manager+ |
| `category-images` | yes | 2 MB | png, jpeg, webp, avif | manager+ |
| `brand-images` | yes | 2 MB | png, jpeg, webp, avif | manager+ |

- **Why public buckets:** catalogue images must be served by the CDN with long cache lifetimes;
  they contain nothing private. Listing objects still requires membership (SELECT policy).
- **Tenant isolation:** object names must match `{tenant_uuid}/{name}.{ext}`
  (`app_private.storage_object_tenant()`); write policies check the caller's role **in that tenant**.
- **Upload flow:** `createSignedUploadAction` (authz, server-generated file name) → browser PUTs
  the file to the signed URL (XHR for progress) → Storage enforces size/MIME → the public URL is saved
  on the entity. The server never proxies file bytes.
- **No SVG:** SVG can contain script and would be served from the Supabase origin.
- **Deleting old images:** replaced/removed images are deleted after the DB commit
  (`admin_save_product` returns removed paths; category/brand/banner/branding actions compare old vs new URLs).
  Order images are snapshots of URLs, so deleting a product image never breaks order history
  rendering (the UI falls back to a placeholder).
- **Why managers can write `tenant-assets`:** uploading changes nothing visible. The logo or favicon
  only changes when an **admin** saves branding settings that reference the file.
