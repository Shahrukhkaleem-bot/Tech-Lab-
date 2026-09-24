-- =============================================================================
-- 0005 COMMERCE: coupons, orders, order_items, order_status_history,
--                payment_transactions, coupon_redemptions, wishlist_items, rate_limits
-- =============================================================================

-- ---------------------------------------------------------------------------
-- coupons
-- ---------------------------------------------------------------------------
create table public.coupons (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants (id) on delete cascade,
  code                      text not null check (code ~ '^[A-Z0-9_-]{3,32}$'),
  description               text check (description is null or char_length(description) <= 200),
  discount_type             public.discount_type not null,
  discount_value            numeric(12, 2) not null check (discount_value > 0),
  min_order_amount          numeric(12, 2) not null default 0 check (min_order_amount >= 0),
  max_discount_amount       numeric(12, 2) check (max_discount_amount is null or max_discount_amount > 0),
  starts_at                 timestamptz,
  ends_at                   timestamptz,
  usage_limit               int check (usage_limit is null or usage_limit > 0),
  usage_limit_per_customer  int check (usage_limit_per_customer is null or usage_limit_per_customer > 0),
  used_count                int not null default 0 check (used_count >= 0),
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  constraint coupons_percentage_range check (discount_type <> 'percentage' or discount_value <= 100),
  constraint coupons_schedule check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants (id) on delete restrict,
  order_number      bigint not null,
  customer_id       uuid references auth.users (id) on delete set null,

  -- Customer snapshot (guest checkout supported)
  customer_name     text not null check (char_length(customer_name) between 2 and 120),
  customer_email    text not null check (customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and customer_email = lower(customer_email)),
  customer_phone    text not null check (char_length(customer_phone) between 7 and 20),
  shipping_address  text not null check (char_length(shipping_address) between 5 and 500),
  city              text not null check (char_length(city) between 2 and 80),
  postal_code       text check (postal_code is null or char_length(postal_code) <= 12),
  country           char(2) not null default 'PK',
  order_notes       text check (order_notes is null or char_length(order_notes) <= 1000),

  -- Money (server-computed inside place_order; immutable afterwards)
  subtotal          numeric(12, 2) not null check (subtotal >= 0),
  shipping_fee      numeric(12, 2) not null default 0 check (shipping_fee >= 0),
  discount_amount   numeric(12, 2) not null default 0 check (discount_amount >= 0),
  total_amount      numeric(12, 2) not null check (total_amount >= 0),
  currency          char(3) not null,
  coupon_id         uuid,
  coupon_code       text,

  payment_method    public.payment_method not null,
  payment_status    public.payment_status not null default 'pending',
  order_status      public.order_status not null default 'pending',

  -- Shipment (single shipment per order; see docs/02-database.md)
  courier_name      text check (courier_name is null or char_length(courier_name) <= 80),
  tracking_number   text check (tracking_number is null or char_length(tracking_number) <= 80),
  tracking_url      text check (tracking_url is null or tracking_url ~ '^https://'),
  shipping_provider text not null default 'manual',
  shipped_at        timestamptz,
  delivered_at      timestamptz,
  cancelled_at      timestamptz,

  internal_notes    text check (internal_notes is null or char_length(internal_notes) <= 2000),

  -- Security / integrity
  idempotency_key   uuid not null,
  public_token      uuid not null default gen_random_uuid(),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (tenant_id, id),
  unique (tenant_id, order_number),
  unique (tenant_id, idempotency_key),
  constraint orders_total_consistent check (total_amount = subtotal + shipping_fee - discount_amount),
  constraint orders_discount_bounded check (discount_amount <= subtotal),
  constraint orders_coupon_fk foreign key (tenant_id, coupon_id)
    references public.coupons (tenant_id, id) on delete set null (coupon_id)
);

create index orders_tenant_created_idx on public.orders (tenant_id, created_at desc);
create index orders_tenant_status_idx on public.orders (tenant_id, order_status, created_at desc);
create index orders_tenant_payment_idx on public.orders (tenant_id, payment_status);
create index orders_customer_idx on public.orders (customer_id, created_at desc) where customer_id is not null;
create index orders_tenant_email_idx on public.orders (tenant_id, customer_email);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function app_private.set_updated_at();

-- Allowed lifecycle transitions. Mirrored in src/features/orders/status.ts for the UI.
create or replace function app_private.order_transition_allowed(
  p_from public.order_status, p_to public.order_status
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_from = p_to or (p_from, p_to) in (
    ('pending', 'confirmed'), ('pending', 'cancelled'),
    ('confirmed', 'processing'), ('confirmed', 'shipped'), ('confirmed', 'cancelled'),
    ('processing', 'shipped'), ('processing', 'cancelled'),
    ('shipped', 'out_for_delivery'), ('shipped', 'delivered'), ('shipped', 'returned'),
    ('out_for_delivery', 'delivered'), ('out_for_delivery', 'returned'),
    ('delivered', 'returned')
  );
$$;

create or replace function app_private.orders_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Financial and identity columns never change after creation (even for staff).
  if not app_private.is_privileged() and (
       new.tenant_id is distinct from old.tenant_id
    or new.order_number is distinct from old.order_number
    or new.customer_id is distinct from old.customer_id
    or new.subtotal is distinct from old.subtotal
    or new.shipping_fee is distinct from old.shipping_fee
    or new.discount_amount is distinct from old.discount_amount
    or new.total_amount is distinct from old.total_amount
    or new.currency is distinct from old.currency
    or new.coupon_id is distinct from old.coupon_id
    or new.coupon_code is distinct from old.coupon_code
    or new.payment_method is distinct from old.payment_method
    or new.idempotency_key is distinct from old.idempotency_key
    or new.public_token is distinct from old.public_token
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'ORDER_IMMUTABLE_FIELD' using errcode = '42501';
  end if;

  if not app_private.order_transition_allowed(old.order_status, new.order_status) then
    raise exception 'INVALID_STATUS_TRANSITION' using errcode = '23514',
      detail = format('%s -> %s', old.order_status, new.order_status);
  end if;

  -- Cancel/return must go through cancel_order()/return_order() so stock is restored.
  if new.order_status in ('cancelled', 'returned') and new.order_status <> old.order_status
     and coalesce(current_setting('app.order_closing', true), '') <> 'on' then
    raise exception 'USE_CANCEL_FUNCTION' using errcode = '42501';
  end if;

  -- Payment status is a finance decision: manager+ (or webhooks via service role).
  if new.payment_status is distinct from old.payment_status
     and not app_private.is_privileged()
     and not app_private.has_tenant_role(new.tenant_id, 'manager') then
    raise exception 'PAYMENT_STATUS_FORBIDDEN' using errcode = '42501';
  end if;

  -- Customer contact corrections (typo in address) are manager+.
  if (new.customer_name, new.customer_email, new.customer_phone, new.shipping_address, new.city, new.postal_code)
     is distinct from
     (old.customer_name, old.customer_email, old.customer_phone, old.shipping_address, old.city, old.postal_code)
     and not app_private.is_privileged()
     and not app_private.has_tenant_role(new.tenant_id, 'manager') then
    raise exception 'CUSTOMER_EDIT_FORBIDDEN' using errcode = '42501';
  end if;

  -- Lifecycle timestamps.
  if new.order_status <> old.order_status then
    if new.order_status = 'shipped' and new.shipped_at is null then new.shipped_at := now(); end if;
    if new.order_status = 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
      new.shipped_at := coalesce(new.shipped_at, new.delivered_at);
    end if;
    if new.order_status = 'cancelled' then new.cancelled_at := now(); end if;
  end if;

  return new;
end;
$$;

create trigger orders_guard
  before update on public.orders
  for each row execute function app_private.orders_guard();

-- ---------------------------------------------------------------------------
-- order_items (snapshots)
-- ---------------------------------------------------------------------------
create table public.order_items (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null,
  order_id               uuid not null,
  product_id             uuid,
  product_name_snapshot  text not null,
  product_sku_snapshot   text,
  product_slug_snapshot  text,
  product_image_snapshot text,
  unit_price             numeric(12, 2) not null check (unit_price >= 0),
  quantity               int not null check (quantity between 1 and 1000),
  subtotal               numeric(12, 2) generated always as (unit_price * quantity) stored,
  created_at             timestamptz not null default now(),
  constraint order_items_order_fk foreign key (tenant_id, order_id)
    references public.orders (tenant_id, id) on delete cascade,
  constraint order_items_product_fk foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete set null (product_id)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id) where product_id is not null;

-- ---------------------------------------------------------------------------
-- order_status_history (audit trail, trigger-written)
-- ---------------------------------------------------------------------------
create table public.order_status_history (
  id              bigint generated always as identity primary key,
  tenant_id       uuid not null,
  order_id        uuid not null,
  order_status    public.order_status not null,
  payment_status  public.payment_status not null,
  note            text,
  changed_by      uuid,
  created_at      timestamptz not null default now(),
  constraint order_status_history_order_fk foreign key (tenant_id, order_id)
    references public.orders (tenant_id, id) on delete cascade
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create or replace function app_private.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.order_status is distinct from old.order_status
     or new.payment_status is distinct from old.payment_status then
    insert into public.order_status_history (tenant_id, order_id, order_status, payment_status, note, changed_by)
    values (new.tenant_id, new.id, new.order_status, new.payment_status,
            nullif(current_setting('app.status_note', true), ''), (select auth.uid()));
  end if;
  return null;
end;
$$;

create trigger orders_log_status
  after insert or update of order_status, payment_status on public.orders
  for each row execute function app_private.log_order_status();

-- ---------------------------------------------------------------------------
-- payment_transactions
-- ---------------------------------------------------------------------------
create table public.payment_transactions (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  order_id            uuid not null,
  provider            text not null check (provider ~ '^[a-z0-9_]{2,40}$'),
  provider_reference  text,
  type                public.transaction_type not null default 'payment',
  status              public.transaction_status not null default 'pending',
  amount              numeric(12, 2) not null check (amount >= 0),
  currency            char(3) not null,
  -- Sanitised provider payload (never card data; providers are redirect/hosted).
  metadata            jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint payment_transactions_order_fk foreign key (tenant_id, order_id)
    references public.orders (tenant_id, id) on delete cascade
);

-- Webhook idempotency: one row per provider reference.
create unique index payment_transactions_provider_ref_key
  on public.payment_transactions (provider, provider_reference) where provider_reference is not null;
create index payment_transactions_order_idx on public.payment_transactions (order_id);

create trigger payment_transactions_set_updated_at
  before update on public.payment_transactions
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- coupon_redemptions
-- ---------------------------------------------------------------------------
create table public.coupon_redemptions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  coupon_id        uuid not null,
  order_id         uuid not null unique,
  customer_email   text not null,
  customer_id      uuid,
  discount_amount  numeric(12, 2) not null check (discount_amount >= 0),
  created_at       timestamptz not null default now(),
  constraint coupon_redemptions_coupon_fk foreign key (tenant_id, coupon_id)
    references public.coupons (tenant_id, id) on delete cascade,
  constraint coupon_redemptions_order_fk foreign key (tenant_id, order_id)
    references public.orders (tenant_id, id) on delete cascade
);

create index coupon_redemptions_coupon_email_idx on public.coupon_redemptions (coupon_id, customer_email);

-- ---------------------------------------------------------------------------
-- wishlist_items (signed-in customers; guests keep a local wishlist)
-- ---------------------------------------------------------------------------
create table public.wishlist_items (
  user_id     uuid not null references auth.users (id) on delete cascade,
  tenant_id   uuid not null,
  product_id  uuid not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id),
  constraint wishlist_items_product_fk foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete cascade
);

create index wishlist_items_user_tenant_idx on public.wishlist_items (user_id, tenant_id);

-- ---------------------------------------------------------------------------
-- rate_limits: fixed-window counters (service role only)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key           text primary key check (char_length(key) <= 200),
  window_start  timestamptz not null,
  hits          int not null
);

grant execute on all functions in schema app_private to anon, authenticated, service_role;
