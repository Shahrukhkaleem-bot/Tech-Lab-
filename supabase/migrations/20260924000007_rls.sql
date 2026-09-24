-- =============================================================================
-- 0007 ROW LEVEL SECURITY
-- =============================================================================
-- Model (see docs/03-rls.md):
--   * Deny by default: RLS enabled on every table, access granted only by policies.
--   * PUBLIC CATALOG (anon + authenticated): active rows of ACTIVE tenants only.
--     Catalogue data is public by nature; which tenant is shown is decided by the
--     server (hostname → tenant_id), never by the client.
--   * PRIVATE DATA (orders, costs, coupons, drafts, payments): tenant members only,
--     by role rank owner(4) > admin(3) > manager(2) > staff(1).
--   * CUSTOMER DATA: a signed-in user sees only rows where customer_id/user_id = auth.uid().
--   * Money-moving writes (orders, payments, stock via checkout) have NO client policies;
--     they happen only inside SECURITY DEFINER functions granted to service_role.
--   * `tenant_id in (select app_private.member_tenant_ids(..))` is evaluated once per
--     statement (InitPlan), keeping policies O(1) per row.

-- ---------------------------------------------------------------------------
-- Baseline privileges: anon never writes anything directly.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

alter table public.tenants               enable row level security;
alter table public.profiles              enable row level security;
alter table public.tenant_members        enable row level security;
alter table public.categories            enable row level security;
alter table public.brands                enable row level security;
alter table public.products              enable row level security;
alter table public.product_costs         enable row level security;
alter table public.product_images        enable row level security;
alter table public.reviews               enable row level security;
alter table public.inventory_movements   enable row level security;
alter table public.store_settings        enable row level security;
alter table public.banners               enable row level security;
alter table public.store_pages           enable row level security;
alter table public.navigation_items      enable row level security;
alter table public.coupons               enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_status_history  enable row level security;
alter table public.payment_transactions  enable row level security;
alter table public.coupon_redemptions    enable row level security;
alter table public.wishlist_items        enable row level security;
alter table public.rate_limits           enable row level security; -- no policies: service role only

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
create policy "tenants: public reads active stores"
  on public.tenants for select to anon, authenticated
  using (status = 'active');

create policy "tenants: members read their store in any status"
  on public.tenants for select to authenticated
  using (id in (select app_private.member_tenant_ids('staff')));

create policy "tenants: admins update their store"
  on public.tenants for update to authenticated
  using (id in (select app_private.member_tenant_ids('admin')))
  with check (id in (select app_private.member_tenant_ids('admin')));

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles: users read own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: users update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- tenant_members (owner-specific rules enforced by tenant_members_guard trigger)
-- ---------------------------------------------------------------------------
create policy "members: users see their memberships"
  on public.tenant_members for select to authenticated
  using (user_id = (select auth.uid()) or tenant_id in (select app_private.member_tenant_ids('admin')));

create policy "members: admins add members"
  on public.tenant_members for insert to authenticated
  with check (tenant_id in (select app_private.member_tenant_ids('admin')));

create policy "members: admins change roles"
  on public.tenant_members for update to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('admin')))
  with check (tenant_id in (select app_private.member_tenant_ids('admin')));

create policy "members: admins remove members"
  on public.tenant_members for delete to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('admin')));

-- ---------------------------------------------------------------------------
-- Catalogue-style tables: public read of active rows, staff read all, manager write.
-- ---------------------------------------------------------------------------
-- categories
create policy "categories: public reads active"
  on public.categories for select to anon, authenticated
  using (is_active and app_private.is_tenant_active(tenant_id));
create policy "categories: staff read all"
  on public.categories for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('staff')));
create policy "categories: managers insert"
  on public.categories for insert to authenticated
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "categories: managers update"
  on public.categories for update to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')))
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "categories: managers delete"
  on public.categories for delete to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')));

-- brands
create policy "brands: public reads active"
  on public.brands for select to anon, authenticated
  using (is_active and app_private.is_tenant_active(tenant_id));
create policy "brands: staff read all"
  on public.brands for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('staff')));
create policy "brands: managers insert"
  on public.brands for insert to authenticated
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "brands: managers update"
  on public.brands for update to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')))
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "brands: managers delete"
  on public.brands for delete to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')));

-- products
create policy "products: public reads active"
  on public.products for select to anon, authenticated
  using (is_active and app_private.is_tenant_active(tenant_id));
create policy "products: staff read all"
  on public.products for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('staff')));
create policy "products: managers insert"
  on public.products for insert to authenticated
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "products: managers update"
  on public.products for update to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')))
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "products: managers delete"
  on public.products for delete to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')));

-- product_costs (never public)
create policy "product_costs: managers read"
  on public.product_costs for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "product_costs: managers insert"
  on public.product_costs for insert to authenticated
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "product_costs: managers update"
  on public.product_costs for update to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')))
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "product_costs: managers delete"
  on public.product_costs for delete to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')));

-- product_images (visible when the product is visible to the caller)
create policy "product_images: public reads images of visible products"
  on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_images.product_id));
create policy "product_images: managers insert"
  on public.product_images for insert to authenticated
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "product_images: managers update"
  on public.product_images for update to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')))
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "product_images: managers delete"
  on public.product_images for delete to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')));

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create policy "reviews: public reads approved"
  on public.reviews for select to anon, authenticated
  using (is_approved and app_private.is_tenant_active(tenant_id));
create policy "reviews: authors read own"
  on public.reviews for select to authenticated
  using (user_id = (select auth.uid()));
create policy "reviews: staff read all"
  on public.reviews for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('staff')));
-- reviews_guard trigger forces user_id = auth.uid(), is_approved = false, derives is_verified.
create policy "reviews: signed-in customers write reviews"
  on public.reviews for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and app_private.is_tenant_active(tenant_id)
    and exists (select 1 from public.products p where p.id = reviews.product_id and p.is_active)
  );
create policy "reviews: authors and managers update"
  on public.reviews for update to authenticated
  using (user_id = (select auth.uid()) or tenant_id in (select app_private.member_tenant_ids('manager')))
  with check (user_id = (select auth.uid()) or tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "reviews: authors and managers delete"
  on public.reviews for delete to authenticated
  using (user_id = (select auth.uid()) or tenant_id in (select app_private.member_tenant_ids('manager')));

-- ---------------------------------------------------------------------------
-- inventory_movements (append-only; written by trigger only)
-- ---------------------------------------------------------------------------
create policy "inventory_movements: staff read"
  on public.inventory_movements for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('staff')));

-- ---------------------------------------------------------------------------
-- Store content
-- ---------------------------------------------------------------------------
create policy "store_settings: public reads active stores"
  on public.store_settings for select to anon, authenticated
  using (app_private.is_tenant_active(tenant_id));
create policy "store_settings: staff read"
  on public.store_settings for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('staff')));
create policy "store_settings: admins update"
  on public.store_settings for update to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('admin')))
  with check (tenant_id in (select app_private.member_tenant_ids('admin')));

create policy "banners: public reads live banners"
  on public.banners for select to anon, authenticated
  using (
    is_active and app_private.is_tenant_active(tenant_id)
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );
create policy "banners: staff read all"
  on public.banners for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('staff')));
create policy "banners: managers insert"
  on public.banners for insert to authenticated
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "banners: managers update"
  on public.banners for update to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')))
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "banners: managers delete"
  on public.banners for delete to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')));

create policy "store_pages: public reads published"
  on public.store_pages for select to anon, authenticated
  using (is_published and app_private.is_tenant_active(tenant_id));
create policy "store_pages: staff read all"
  on public.store_pages for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('staff')));
create policy "store_pages: admins insert"
  on public.store_pages for insert to authenticated
  with check (tenant_id in (select app_private.member_tenant_ids('admin')));
create policy "store_pages: admins update"
  on public.store_pages for update to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('admin')))
  with check (tenant_id in (select app_private.member_tenant_ids('admin')));
create policy "store_pages: admins delete"
  on public.store_pages for delete to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('admin')));

create policy "navigation_items: public reads active"
  on public.navigation_items for select to anon, authenticated
  using (is_active and app_private.is_tenant_active(tenant_id));
create policy "navigation_items: staff read all"
  on public.navigation_items for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('staff')));
create policy "navigation_items: admins insert"
  on public.navigation_items for insert to authenticated
  with check (tenant_id in (select app_private.member_tenant_ids('admin')));
create policy "navigation_items: admins update"
  on public.navigation_items for update to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('admin')))
  with check (tenant_id in (select app_private.member_tenant_ids('admin')));
create policy "navigation_items: admins delete"
  on public.navigation_items for delete to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('admin')));

-- ---------------------------------------------------------------------------
-- coupons (codes are secrets until shared by the store: never public)
-- ---------------------------------------------------------------------------
create policy "coupons: staff read"
  on public.coupons for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('staff')));
create policy "coupons: managers insert"
  on public.coupons for insert to authenticated
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "coupons: managers update"
  on public.coupons for update to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')))
  with check (tenant_id in (select app_private.member_tenant_ids('manager')));
create policy "coupons: managers delete"
  on public.coupons for delete to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')));

-- ---------------------------------------------------------------------------
-- orders & children. No INSERT/DELETE policies: orders are created by place_order()
-- and never deleted (cancelled instead).
-- ---------------------------------------------------------------------------
create policy "orders: customers read own"
  on public.orders for select to authenticated
  using (customer_id = (select auth.uid()));
create policy "orders: staff read store orders"
  on public.orders for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('staff')));
-- Column-level rules (immutable money, transitions, who may change payment status)
-- are enforced by the orders_guard trigger.
create policy "orders: staff update store orders"
  on public.orders for update to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('staff')))
  with check (tenant_id in (select app_private.member_tenant_ids('staff')));

create policy "order_items: visible with their order"
  on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id));

create policy "order_status_history: visible with their order"
  on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_status_history.order_id));

create policy "payment_transactions: managers read"
  on public.payment_transactions for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')));

create policy "coupon_redemptions: managers read"
  on public.coupon_redemptions for select to authenticated
  using (tenant_id in (select app_private.member_tenant_ids('manager')));

-- ---------------------------------------------------------------------------
-- wishlist_items
-- ---------------------------------------------------------------------------
create policy "wishlist: users read own"
  on public.wishlist_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy "wishlist: users add own"
  on public.wishlist_items for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.products p where p.id = wishlist_items.product_id and p.tenant_id = wishlist_items.tenant_id and p.is_active)
  );
create policy "wishlist: users remove own"
  on public.wishlist_items for delete to authenticated
  using (user_id = (select auth.uid()));
