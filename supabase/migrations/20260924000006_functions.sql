-- =============================================================================
-- 0006 FUNCTIONS: pricing, order placement, cancellation, payments, search,
--                 rate limiting, dashboard, tenant provisioning
-- =============================================================================
-- Conventions
--  * SECURITY DEFINER functions pin `search_path = ''` and fully qualify every name.
--  * Business errors are raised with a stable machine code in MESSAGE (e.g. INSUFFICIENT_STOCK)
--    and optional JSON in DETAIL. src/lib/errors/database.ts maps codes to user-facing text.
--  * EXECUTE is revoked from PUBLIC and granted explicitly at the bottom of this file.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Validates and aggregates the cart payload: [{ "product_id": uuid, "quantity": int }]
create or replace function app_private.normalize_items(p_items jsonb)
returns table (product_id uuid, quantity int)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_ITEMS' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
       or (e ->> 'product_id') !~ '^[0-9a-fA-F-]{36}$'
       or (e ->> 'quantity') !~ '^[0-9]{1,4}$'
       or (e ->> 'quantity')::int not between 1 and 100
  ) then
    raise exception 'INVALID_ITEMS' using errcode = 'P0001';
  end if;

  return query
    select (e ->> 'product_id')::uuid, sum((e ->> 'quantity')::int)::int
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1;
end;
$$;

-- Discount for a coupon row at a given subtotal (rounded to 2dp, never above subtotal).
create or replace function app_private.coupon_discount(p_coupon public.coupons, p_subtotal numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select least(
    p_subtotal,
    coalesce(p_coupon.max_discount_amount, 'infinity'::numeric),
    case p_coupon.discount_type
      when 'percentage' then round(p_subtotal * p_coupon.discount_value / 100, 2)
      else p_coupon.discount_value
    end
  );
$$;

-- Returns NULL when the coupon is usable, otherwise a machine-readable reason.
create or replace function app_private.coupon_rejection_reason(
  p_coupon public.coupons, p_subtotal numeric, p_email text
) returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_coupon.id is null or not p_coupon.is_active then 'COUPON_INVALID'
    when p_coupon.starts_at is not null and now() < p_coupon.starts_at then 'COUPON_NOT_STARTED'
    when p_coupon.ends_at is not null and now() >= p_coupon.ends_at then 'COUPON_EXPIRED'
    when p_coupon.usage_limit is not null and p_coupon.used_count >= p_coupon.usage_limit then 'COUPON_EXHAUSTED'
    when p_subtotal < p_coupon.min_order_amount then 'COUPON_MIN_ORDER'
    when p_coupon.usage_limit_per_customer is not null and p_email is not null and (
      select count(*) from public.coupon_redemptions r
      where r.coupon_id = p_coupon.id and r.customer_email = lower(p_email)
    ) >= p_coupon.usage_limit_per_customer then 'COUPON_CUSTOMER_LIMIT'
    else null
  end;
$$;

-- Cart lines priced from the database (never from the client).
create or replace function app_private.price_lines(p_tenant_id uuid, p_items jsonb)
returns table (
  product_id uuid,
  quantity int,
  name text,
  sku text,
  slug text,
  image_url text,
  unit_price numeric,
  line_total numeric,
  available_quantity int,
  problem text
)
language sql
stable
set search_path = ''
as $$
  select
    r.product_id,
    r.quantity,
    p.name,
    p.sku,
    p.slug,
    (select pi.image_url from public.product_images pi
      where pi.product_id = p.id
      order by pi.is_primary desc, pi.display_order, pi.created_at limit 1),
    p.price,
    p.price * r.quantity,
    case when p.id is null or not p.is_active then 0
         when p.track_inventory then p.stock_quantity
         else null end,
    case
      when p.id is null or not p.is_active then 'UNAVAILABLE'
      when p.track_inventory and p.stock_quantity < r.quantity then 'INSUFFICIENT_STOCK'
      else null
    end
  from app_private.normalize_items(p_items) r
  left join public.products p on p.id = r.product_id and p.tenant_id = p_tenant_id;
$$;

-- ---------------------------------------------------------------------------
-- quote_order: read-only server-side quote for the checkout summary
-- ---------------------------------------------------------------------------
create or replace function public.quote_order(
  p_tenant_id uuid,
  p_items jsonb,
  p_coupon_code text default null,
  p_customer_email text default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lines jsonb;
  v_subtotal numeric(12, 2);
  v_has_problem boolean;
  v_coupon public.coupons;
  v_reason text;
  v_discount numeric(12, 2) := 0;
begin
  if not app_private.is_tenant_active(p_tenant_id) then
    raise exception 'TENANT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select
    coalesce(jsonb_agg(to_jsonb(l) order by l.name), '[]'::jsonb),
    coalesce(sum(l.line_total) filter (where l.problem is null), 0),
    coalesce(bool_or(l.problem is not null), false)
  into v_lines, v_subtotal, v_has_problem
  from app_private.price_lines(p_tenant_id, p_items) l;

  if nullif(trim(p_coupon_code), '') is not null then
    select * into v_coupon from public.coupons c
    where c.tenant_id = p_tenant_id and c.code = upper(trim(p_coupon_code));
    v_reason := app_private.coupon_rejection_reason(v_coupon, v_subtotal, p_customer_email);
    if v_reason is null then
      v_discount := app_private.coupon_discount(v_coupon, v_subtotal);
    end if;
  end if;

  return jsonb_build_object(
    'lines', v_lines,
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'has_problems', v_has_problem,
    'coupon', case when p_coupon_code is null or trim(p_coupon_code) = '' then null
                   else jsonb_build_object('code', upper(trim(p_coupon_code)),
                                           'valid', v_reason is null,
                                           'reason', v_reason) end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- place_order: the ONLY way an order is created.
-- One transaction: allocate number → lock products → validate stock/prices →
-- insert order + items → decrement stock → redeem coupon → pending payment row.
-- Lock order is always tenant row → product rows (by id) → coupon row: deadlock-free.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_tenant_id uuid,
  p_items jsonb,
  p_customer jsonb,
  p_payment_method public.payment_method,
  p_shipping_fee numeric,
  p_expected_subtotal numeric,
  p_idempotency_key uuid,
  p_coupon_code text default null,
  p_customer_id uuid default null
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_existing public.orders;
  v_tenant public.tenants;
  v_settings public.store_settings;
  v_order public.orders;
  v_problems jsonb;
  v_lines jsonb;
  v_subtotal numeric(12, 2);
  v_coupon public.coupons;
  v_reason text;
  v_discount numeric(12, 2) := 0;
  v_email text := lower(trim(p_customer ->> 'email'));
  v_constraint text;
begin
  if p_idempotency_key is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  -- Fast idempotent replay (double-click, retry after timeout).
  select * into v_existing from public.orders
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number,
      'public_token', v_existing.public_token, 'total_amount', v_existing.total_amount,
      'currency', v_existing.currency, 'duplicate', true);
  end if;

  if p_shipping_fee is null or p_shipping_fee < 0 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001', detail = 'shipping_fee';
  end if;

  begin
    -- 1. Tenant row lock + order number allocation (serialises orders per tenant).
    update public.tenants t
    set order_number_seq = t.order_number_seq + 1
    where t.id = p_tenant_id and t.status = 'active'
    returning * into v_tenant;
    if not found then
      raise exception 'TENANT_NOT_FOUND' using errcode = 'P0001';
    end if;

    select * into v_settings from public.store_settings s where s.tenant_id = p_tenant_id;
    if not coalesce(v_settings.payment_config -> 'enabled_methods', '["cod"]'::jsonb) ? p_payment_method::text then
      raise exception 'PAYMENT_METHOD_UNAVAILABLE' using errcode = 'P0001';
    end if;

    -- 2. Lock the products in a deterministic order.
    perform 1 from public.products p
    where p.tenant_id = p_tenant_id
      and p.id in (select n.product_id from app_private.normalize_items(p_items) n)
    order by p.id
    for update;

    -- 3. Price + availability from locked rows.
    select
      jsonb_agg(to_jsonb(l)) filter (where l.problem is not null),
      jsonb_agg(to_jsonb(l)),
      coalesce(sum(l.line_total), 0)
    into v_problems, v_lines, v_subtotal
    from app_private.price_lines(p_tenant_id, p_items) l;

    if v_problems is not null then
      raise exception 'INSUFFICIENT_STOCK' using errcode = 'P0001',
        detail = (select jsonb_agg(jsonb_build_object(
                    'product_id', x ->> 'product_id', 'name', x ->> 'name',
                    'problem', x ->> 'problem', 'available_quantity', x -> 'available_quantity'))
                  from jsonb_array_elements(v_problems) x)::text;
    end if;

    -- 4. The client saw a quote; if prices moved since, make them re-confirm.
    if p_expected_subtotal is not null and p_expected_subtotal <> v_subtotal then
      raise exception 'PRICE_CHANGED' using errcode = 'P0001',
        detail = jsonb_build_object('subtotal', v_subtotal)::text;
    end if;

    -- 5. Coupon (row-locked so usage limits hold under concurrency).
    if nullif(trim(p_coupon_code), '') is not null then
      select * into v_coupon from public.coupons c
      where c.tenant_id = p_tenant_id and c.code = upper(trim(p_coupon_code))
      for update;
      v_reason := app_private.coupon_rejection_reason(v_coupon, v_subtotal, v_email);
      if v_reason is not null then
        raise exception '%', v_reason using errcode = 'P0001';
      end if;
      v_discount := app_private.coupon_discount(v_coupon, v_subtotal);
    end if;

    -- 6. Order
    insert into public.orders (
      tenant_id, order_number, customer_id,
      customer_name, customer_email, customer_phone, shipping_address, city, postal_code, order_notes,
      subtotal, shipping_fee, discount_amount, total_amount, currency,
      coupon_id, coupon_code, payment_method, idempotency_key
    ) values (
      p_tenant_id, v_tenant.order_number_seq, p_customer_id,
      trim(p_customer ->> 'name'), v_email, trim(p_customer ->> 'phone'),
      trim(p_customer ->> 'address'), trim(p_customer ->> 'city'),
      nullif(trim(p_customer ->> 'postal_code'), ''), nullif(trim(p_customer ->> 'notes'), ''),
      v_subtotal, round(p_shipping_fee, 2), v_discount, v_subtotal + round(p_shipping_fee, 2) - v_discount,
      v_tenant.currency, v_coupon.id, v_coupon.code, p_payment_method, p_idempotency_key
    )
    returning * into v_order;

    -- 7. Items (snapshots)
    insert into public.order_items (
      tenant_id, order_id, product_id, product_name_snapshot, product_sku_snapshot,
      product_slug_snapshot, product_image_snapshot, unit_price, quantity
    )
    select p_tenant_id, v_order.id, l.product_id, l.name, l.sku, l.slug, l.image_url, l.unit_price, l.quantity
    from jsonb_to_recordset(v_lines) as l(
      product_id uuid, name text, sku text, slug text, image_url text, unit_price numeric, quantity int
    );

    -- 8. Stock (the inventory trigger records a 'sale' movement per product)
    perform set_config('app.inventory_reason', 'sale', true);
    perform set_config('app.inventory_order_id', v_order.id::text, true);

    update public.products p
    set stock_quantity = case when p.track_inventory then p.stock_quantity - l.quantity else p.stock_quantity end,
        sales_count = p.sales_count + l.quantity
    from jsonb_to_recordset(v_lines) as l(product_id uuid, quantity int)
    where p.id = l.product_id and p.tenant_id = p_tenant_id;

    perform set_config('app.inventory_reason', '', true);
    perform set_config('app.inventory_order_id', '', true);

    -- 9. Coupon redemption
    if v_coupon.id is not null then
      insert into public.coupon_redemptions (tenant_id, coupon_id, order_id, customer_email, customer_id, discount_amount)
      values (p_tenant_id, v_coupon.id, v_order.id, v_email, p_customer_id, v_discount);
      update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
    end if;

    -- 10. Pending payment record (provider reference attached later for online methods)
    insert into public.payment_transactions (tenant_id, order_id, provider, type, status, amount, currency)
    values (p_tenant_id, v_order.id, p_payment_method::text, 'payment', 'pending', v_order.total_amount, v_order.currency);

  exception
    when unique_violation then
      -- A concurrent request with the same idempotency key won the race.
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'orders_tenant_id_idempotency_key_key' then
        select * into v_existing from public.orders
        where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
        return jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number,
          'public_token', v_existing.public_token, 'total_amount', v_existing.total_amount,
          'currency', v_existing.currency, 'duplicate', true);
      end if;
      raise;
  end;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'public_token', v_order.public_token,
    'total_amount', v_order.total_amount,
    'currency', v_order.currency,
    'duplicate', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Closing orders (cancel / return) with stock restoration
-- ---------------------------------------------------------------------------
create or replace function app_private.close_order(
  p_order_id uuid,
  p_target public.order_status,
  p_restock boolean,
  p_note text
) returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not app_private.order_transition_allowed(v_order.order_status, p_target)
     or v_order.order_status = p_target then
    raise exception 'INVALID_STATUS_TRANSITION' using errcode = 'P0001',
      detail = format('%s -> %s', v_order.order_status, p_target);
  end if;

  if p_restock then
    -- Lock products in id order (same order as place_order).
    perform 1 from public.products p
    where p.id in (select oi.product_id from public.order_items oi where oi.order_id = v_order.id)
    order by p.id
    for update;

    perform set_config('app.inventory_reason', case when p_target = 'returned' then 'return' else 'cancellation' end, true);
    perform set_config('app.inventory_order_id', v_order.id::text, true);

    update public.products p
    set stock_quantity = case when p.track_inventory then p.stock_quantity + i.qty else p.stock_quantity end,
        sales_count = greatest(p.sales_count - i.qty, 0)
    from (
      select oi.product_id, sum(oi.quantity)::int as qty
      from public.order_items oi
      where oi.order_id = v_order.id and oi.product_id is not null
      group by oi.product_id
    ) i
    where p.id = i.product_id and p.tenant_id = v_order.tenant_id;

    perform set_config('app.inventory_reason', '', true);
    perform set_config('app.inventory_order_id', '', true);
  end if;

  if p_target = 'cancelled' and v_order.coupon_id is not null then
    delete from public.coupon_redemptions where order_id = v_order.id;
    update public.coupons set used_count = greatest(used_count - 1, 0) where id = v_order.coupon_id;
  end if;

  perform set_config('app.order_closing', 'on', true);
  perform set_config('app.status_note', coalesce(left(p_note, 500), ''), true);

  update public.orders
  set order_status = p_target,
      payment_status = case when payment_status = 'pending' then 'cancelled'::public.payment_status
                            else payment_status end
  where id = v_order.id
  returning * into v_order;

  update public.payment_transactions
  set status = 'cancelled'
  where order_id = v_order.id and status = 'pending';

  perform set_config('app.order_closing', '', true);
  perform set_config('app.status_note', '', true);
  return v_order;
end;
$$;

-- Staff+ (manager) cancel any cancellable order; customers may cancel their own pending order.
create or replace function public.cancel_order(p_order_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or not (
       app_private.is_service_caller()
    or app_private.has_tenant_role(v_order.tenant_id, 'manager')
    or (v_order.customer_id = (select auth.uid()) and v_order.order_status = 'pending')
  ) then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_order := app_private.close_order(p_order_id, 'cancelled', true, p_note);
  return jsonb_build_object('order_status', v_order.order_status, 'payment_status', v_order.payment_status);
end;
$$;

create or replace function public.return_order(p_order_id uuid, p_restock boolean default true, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or not (app_private.is_service_caller() or app_private.has_tenant_role(v_order.tenant_id, 'manager')) then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_order := app_private.close_order(p_order_id, 'returned', p_restock, p_note);
  return jsonb_build_object('order_status', v_order.order_status, 'payment_status', v_order.payment_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- record_payment: called by verified webhooks / provider callbacks (service role only).
-- Idempotent per (provider, provider_reference).
-- ---------------------------------------------------------------------------
create or replace function public.record_payment(
  p_tenant_id uuid,
  p_order_id uuid,
  p_provider text,
  p_provider_reference text,
  p_status public.transaction_status,
  p_amount numeric,
  p_currency text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders
  where id = p_order_id and tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Attach the reference to the pending row created by place_order, or upsert by reference.
  update public.payment_transactions
  set provider = p_provider, provider_reference = p_provider_reference, status = p_status,
      amount = p_amount, currency = upper(p_currency), metadata = coalesce(p_metadata, '{}'::jsonb)
  where order_id = v_order.id
    and (provider_reference = p_provider_reference
         or (provider_reference is null and status = 'pending' and type = 'payment'));

  if not found then
    insert into public.payment_transactions
      (tenant_id, order_id, provider, provider_reference, type, status, amount, currency, metadata)
    values
      (p_tenant_id, v_order.id, p_provider, p_provider_reference, 'payment', p_status, p_amount,
       upper(p_currency), coalesce(p_metadata, '{}'::jsonb))
    on conflict (provider, provider_reference) where provider_reference is not null
    do update set status = excluded.status, metadata = excluded.metadata;
  end if;

  if p_status = 'succeeded' then
    if p_amount < v_order.total_amount or upper(p_currency) <> v_order.currency then
      raise exception 'PAYMENT_AMOUNT_MISMATCH' using errcode = 'P0001';
    end if;
    update public.orders
    set payment_status = 'paid',
        order_status = case when order_status = 'pending' then 'confirmed'::public.order_status else order_status end
    where id = v_order.id and payment_status <> 'paid'
    returning * into v_order;
  elsif p_status = 'failed' and v_order.payment_status = 'pending' then
    update public.orders set payment_status = 'failed' where id = v_order.id returning * into v_order;
  end if;

  select * into v_order from public.orders where id = p_order_id;
  return jsonb_build_object('order_status', v_order.order_status, 'payment_status', v_order.payment_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window). Returns true when the call is allowed.
-- ---------------------------------------------------------------------------
create or replace function public.consume_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits int;
begin
  insert into public.rate_limits as rl (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
  set window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds)
                          then now() else rl.window_start end,
      hits = case when rl.window_start < now() - make_interval(secs => p_window_seconds)
                  then 1 else rl.hits + 1 end
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Product search / listing (SECURITY INVOKER: RLS applies)
-- ---------------------------------------------------------------------------

-- Tokenises free text into a prefix tsquery ("usb c cab" → 'usb':* & 'c':* & 'cab':*).
-- Only [[:alnum:]] survives, so user input can never inject tsquery operators.
create or replace function app_private.to_prefix_tsquery(p_text text)
returns tsquery
language sql
immutable
set search_path = ''
as $$
  select case when count(*) = 0 then null
              else to_tsquery('simple', string_agg(tok || ':*', ' & '))
         end
  from (
    select lower(t) as tok
    from regexp_split_to_table(left(coalesce(p_text, ''), 100), '[^[:alnum:]]+') t
    where t <> ''
    limit 8
  ) s;
$$;

create or replace function public.search_products(
  p_tenant_id uuid,
  p_query text default null,
  p_category_ids uuid[] default null,
  p_brand_ids uuid[] default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_rating numeric default null,
  p_in_stock boolean default false,
  p_on_sale boolean default false,
  p_featured boolean default false,
  p_sort text default 'newest',
  p_limit int default 24,
  p_offset int default 0
) returns table (
  id uuid,
  name text,
  slug text,
  sku text,
  short_description text,
  original_price numeric,
  sale_price numeric,
  price numeric,
  is_on_sale boolean,
  track_inventory boolean,
  stock_quantity int,
  rating numeric,
  review_count int,
  is_featured boolean,
  created_at timestamptz,
  brand_id uuid,
  brand_name text,
  brand_slug text,
  category_id uuid,
  image_url text,
  image_alt text,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_tsq tsquery := app_private.to_prefix_tsquery(p_query);
  v_like text := case when nullif(trim(p_query), '') is null then null
                      else '%' || replace(replace(replace(trim(left(p_query, 100)), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
begin
  return query
  select
    p.id, p.name, p.slug, p.sku, p.short_description,
    p.original_price, p.sale_price, p.price, p.is_on_sale,
    p.track_inventory, p.stock_quantity, p.rating, p.review_count, p.is_featured, p.created_at,
    b.id, b.name, b.slug,
    p.category_id,
    img.image_url, img.alt_text,
    count(*) over ()
  from public.products p
  left join public.brands b on b.id = p.brand_id and b.is_active
  left join lateral (
    select pi.image_url, pi.alt_text from public.product_images pi
    where pi.product_id = p.id
    order by pi.is_primary desc, pi.display_order, pi.created_at
    limit 1
  ) img on true
  where p.tenant_id = p_tenant_id
    and p.is_active
    and (v_like is null or p.search_vector @@ v_tsq or p.name ilike v_like or p.sku ilike v_like)
    and (p_category_ids is null or p.category_id = any (p_category_ids))
    and (p_brand_ids is null or p.brand_id = any (p_brand_ids))
    and (p_min_price is null or p.price >= p_min_price)
    and (p_max_price is null or p.price <= p_max_price)
    and (p_min_rating is null or p.rating >= p_min_rating)
    and (not p_in_stock or not p.track_inventory or p.stock_quantity > 0)
    and (not p_on_sale or p.is_on_sale)
    and (not p_featured or p.is_featured)
  order by
    case when p_sort = 'relevance' and v_tsq is not null then ts_rank(p.search_vector, v_tsq) end desc nulls last,
    case when p_sort = 'price_asc' then p.price end asc,
    case when p_sort = 'price_desc' then p.price end desc,
    case when p_sort = 'rating' then p.rating end desc,
    case when p_sort = 'best_selling' then p.sales_count end desc,
    case when p_sort = 'name' then p.name end asc,
    p.created_at desc,
    p.id
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin dashboard (SECURITY INVOKER + explicit role check)
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard_stats(p_tenant_id uuid, p_days int default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_since timestamptz := date_trunc('day', now()) - make_interval(days => greatest(least(p_days, 365), 1) - 1);
  v_result jsonb;
begin
  if not app_private.has_tenant_role(p_tenant_id, 'manager') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'revenue', coalesce(sum(o.total_amount) filter (where o.order_status not in ('cancelled', 'returned')), 0),
    'orders', count(*),
    'average_order_value', coalesce(round(avg(o.total_amount) filter (where o.order_status not in ('cancelled', 'returned')), 2), 0),
    'pending_orders', count(*) filter (where o.order_status = 'pending')
  ) into v_result
  from public.orders o
  where o.tenant_id = p_tenant_id and o.created_at >= v_since;

  v_result := v_result || jsonb_build_object(
    'products', (select count(*) from public.products p where p.tenant_id = p_tenant_id),
    'low_stock', (select count(*) from public.products p
                  where p.tenant_id = p_tenant_id and p.is_active and p.track_inventory
                    and p.stock_quantity <= p.low_stock_threshold),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d.day::date, 'revenue', coalesce(s.revenue, 0), 'orders', coalesce(s.orders, 0)) order by d.day), '[]'::jsonb)
      from generate_series(v_since, date_trunc('day', now()), interval '1 day') d(day)
      left join (
        select date_trunc('day', o.created_at) as day,
               sum(o.total_amount) filter (where o.order_status not in ('cancelled', 'returned')) as revenue,
               count(*) as orders
        from public.orders o
        where o.tenant_id = p_tenant_id and o.created_at >= v_since
        group by 1
      ) s on s.day = d.day
    )
  );
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Platform: tenant provisioning (service role only; used by scripts/provision-tenant.ts)
-- ---------------------------------------------------------------------------
create or replace function public.provision_tenant(
  p_name text,
  p_subdomain text,
  p_owner_user_id uuid,
  p_currency text default 'PKR',
  p_locale text default 'en-PK'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.tenants (name, slug, subdomain, status, currency, locale)
  values (p_name, lower(p_subdomain), lower(p_subdomain), 'active', upper(p_currency), p_locale)
  returning id into v_id;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (v_id, p_owner_user_id, 'owner');

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.quote_order(uuid, jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.place_order(uuid, jsonb, jsonb, public.payment_method, numeric, numeric, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.record_payment(uuid, uuid, text, text, public.transaction_status, numeric, text, jsonb) from public, anon, authenticated;
revoke execute on function public.consume_rate_limit(text, int, int) from public, anon, authenticated;
revoke execute on function public.provision_tenant(text, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.cancel_order(uuid, text) from public, anon;
revoke execute on function public.return_order(uuid, boolean, text) from public, anon;
revoke execute on function public.get_dashboard_stats(uuid, int) from public, anon;

grant execute on function public.quote_order(uuid, jsonb, text, text) to service_role;
grant execute on function public.place_order(uuid, jsonb, jsonb, public.payment_method, numeric, numeric, uuid, text, uuid) to service_role;
grant execute on function public.record_payment(uuid, uuid, text, text, public.transaction_status, numeric, text, jsonb) to service_role;
grant execute on function public.consume_rate_limit(text, int, int) to service_role;
grant execute on function public.provision_tenant(text, text, uuid, text, text) to service_role;
grant execute on function public.cancel_order(uuid, text) to authenticated, service_role;
grant execute on function public.return_order(uuid, boolean, text) to authenticated, service_role;
grant execute on function public.get_dashboard_stats(uuid, int) to authenticated, service_role;
grant execute on function public.search_products(uuid, text, uuid[], uuid[], numeric, numeric, numeric, boolean, boolean, boolean, text, int, int) to anon, authenticated, service_role;

-- app_private.close_order must never be callable by API roles directly.
revoke execute on function app_private.close_order(uuid, public.order_status, boolean, text) from public, anon, authenticated;
grant execute on all functions in schema app_private to service_role;
