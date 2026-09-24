-- =============================================================================
-- Order placement, stock, pricing, coupons, idempotency, cancellation, payments.
-- Executed as service_role (the only role allowed to call place_order).
-- =============================================================================
begin;

create schema test_helpers;

create function test_helpers.pid(p_slug text) returns uuid language sql as $$
  select id from public.products where tenant_id = '11111111-1111-4111-8111-111111111111' and slug = p_slug;
$$;
create function test_helpers.items(p_slug text, p_qty int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('product_id', test_helpers.pid(p_slug), 'quantity', p_qty));
$$;
create function test_helpers.customer() returns jsonb language sql as $$
  select '{"name":"Test Buyer","email":"Buyer@Test.Local","phone":"03001234567","address":"House 5, Block B","city":"Lahore","postal_code":"54000"}'::jsonb;
$$;
grant usage on schema test_helpers to service_role;
grant execute on all functions in schema test_helpers to service_role;

set local role service_role;

-- ---------------------------------------------------------------------------
-- Happy path: server prices, stock deduction, ledger, snapshots, totals
-- ---------------------------------------------------------------------------
do $$
declare
  v_before int;
  v_result jsonb;
  v_order public.orders;
  v_idem uuid := gen_random_uuid();
begin
  select stock_quantity into v_before from public.products where id = test_helpers.pid('sonora-buds-pro');

  v_result := public.place_order('11111111-1111-4111-8111-111111111111', test_helpers.items('sonora-buds-pro', 2),
    test_helpers.customer(), 'cod', 250, 23998, v_idem, null, null);

  select * into v_order from public.orders where id = (v_result ->> 'order_id')::uuid;
  assert v_order.subtotal = 23998, format('subtotal from DB sale price, got %s', v_order.subtotal);
  assert v_order.total_amount = 24248, 'total = subtotal + shipping - discount';
  assert v_order.customer_email = 'buyer@test.local', 'email normalised';
  assert v_order.order_number > 1000, 'per-tenant order number allocated';
  assert v_order.payment_status = 'pending' and v_order.order_status = 'pending', 'initial statuses';
  assert (select stock_quantity from public.products where id = test_helpers.pid('sonora-buds-pro')) = v_before - 2, 'stock decremented';
  assert exists (select 1 from public.inventory_movements where order_id = v_order.id and reason = 'sale' and quantity_change = -2), 'sale movement logged';
  assert (select product_name_snapshot from public.order_items where order_id = v_order.id) = 'Sonora Buds Pro ANC Earbuds', 'name snapshot';
  assert (select unit_price from public.order_items where order_id = v_order.id) = 11999, 'unit price snapshot';
  assert exists (select 1 from public.payment_transactions where order_id = v_order.id and status = 'pending'), 'pending transaction';
  assert exists (select 1 from public.order_status_history where order_id = v_order.id), 'status history row';

  -- Idempotent replay returns the same order and does not deduct stock again.
  v_result := public.place_order('11111111-1111-4111-8111-111111111111', test_helpers.items('sonora-buds-pro', 2),
    test_helpers.customer(), 'cod', 250, 23998, v_idem, null, null);
  assert (v_result ->> 'duplicate')::boolean, 'replay flagged as duplicate';
  assert (v_result ->> 'order_id')::uuid = v_order.id, 'replay returns same order';
  assert (select stock_quantity from public.products where id = test_helpers.pid('sonora-buds-pro')) = v_before - 2, 'no double deduction';

  -- Cancel restores stock and the ledger records it.
  perform public.cancel_order(v_order.id, 'customer changed mind');
  assert (select stock_quantity from public.products where id = test_helpers.pid('sonora-buds-pro')) = v_before, 'stock restored on cancel';
  assert (select order_status from public.orders where id = v_order.id) = 'cancelled', 'order cancelled';
  assert (select payment_status from public.orders where id = v_order.id) = 'cancelled', 'pending payment cancelled';
  assert exists (select 1 from public.inventory_movements where order_id = v_order.id and reason = 'cancellation'), 'cancellation logged';

  begin
    perform public.cancel_order(v_order.id, 'again');
    raise exception 'TEST FAILED: double cancel';
  exception when others then
    if sqlerrm not like '%INVALID_STATUS_TRANSITION%' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Rejections
-- ---------------------------------------------------------------------------
do $$
declare v_stock int;
begin
  -- Insufficient stock (Pulse Band 2 has 0)
  begin
    perform public.place_order('11111111-1111-4111-8111-111111111111', test_helpers.items('pulse-band-2', 1),
      test_helpers.customer(), 'cod', 0, null, gen_random_uuid(), null, null);
    raise exception 'TEST FAILED: out-of-stock order accepted';
  exception when others then
    if sqlerrm <> 'INSUFFICIENT_STOCK' then raise; end if;
  end;

  -- Quantity above stock
  select stock_quantity into v_stock from public.products where id = test_helpers.pid('arcwave-boom-mini');
  begin
    perform public.place_order('11111111-1111-4111-8111-111111111111', test_helpers.items('arcwave-boom-mini', v_stock + 1),
      test_helpers.customer(), 'cod', 0, null, gen_random_uuid(), null, null);
    raise exception 'TEST FAILED: over-quantity order accepted';
  exception when others then
    if sqlerrm <> 'INSUFFICIENT_STOCK' then raise; end if;
  end;

  -- Product from another tenant is "unavailable" in this store
  begin
    perform public.place_order('11111111-1111-4111-8111-111111111111',
      jsonb_build_array(jsonb_build_object('product_id',
        (select id from public.products where tenant_id = '22222222-2222-4222-8222-222222222222' limit 1), 'quantity', 1)),
      test_helpers.customer(), 'cod', 0, null, gen_random_uuid(), null, null);
    raise exception 'TEST FAILED: cross-tenant product accepted';
  exception when others then
    if sqlerrm <> 'INSUFFICIENT_STOCK' then raise; end if;
  end;

  -- Client-side price tampering: expected subtotal differs from DB
  begin
    perform public.place_order('11111111-1111-4111-8111-111111111111', test_helpers.items('sonora-buds-lite', 1),
      test_helpers.customer(), 'cod', 0, 1, gen_random_uuid(), null, null);
    raise exception 'TEST FAILED: price mismatch accepted';
  exception when others then
    if sqlerrm <> 'PRICE_CHANGED' then raise; end if;
  end;

  -- Malformed payloads
  begin
    perform public.place_order('11111111-1111-4111-8111-111111111111',
      '[{"product_id":"not-a-uuid","quantity":1}]', test_helpers.customer(), 'cod', 0, null, gen_random_uuid(), null, null);
    raise exception 'TEST FAILED: malformed item accepted';
  exception when others then
    if sqlerrm <> 'INVALID_ITEMS' then raise; end if;
  end;

  begin
    perform public.place_order('11111111-1111-4111-8111-111111111111', test_helpers.items('sonora-buds-lite', -3),
      test_helpers.customer(), 'cod', 0, null, gen_random_uuid(), null, null);
    raise exception 'TEST FAILED: negative quantity accepted';
  exception when others then
    if sqlerrm <> 'INVALID_ITEMS' then raise; end if;
  end;

  -- Disabled payment method (card not enabled for demo tenant)
  begin
    perform public.place_order('11111111-1111-4111-8111-111111111111', test_helpers.items('sonora-buds-lite', 1),
      test_helpers.customer(), 'card', 0, null, gen_random_uuid(), null, null);
    raise exception 'TEST FAILED: disabled payment method accepted';
  exception when others then
    if sqlerrm <> 'PAYMENT_METHOD_UNAVAILABLE' then raise; end if;
  end;

  -- Invalid customer data is rejected by table constraints
  begin
    perform public.place_order('11111111-1111-4111-8111-111111111111', test_helpers.items('sonora-buds-lite', 1),
      '{"name":"X","email":"bad","phone":"1","address":"a","city":"b"}', 'cod', 0, null, gen_random_uuid(), null, null);
    raise exception 'TEST FAILED: invalid customer accepted';
  exception when check_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Coupons + quote
-- ---------------------------------------------------------------------------
do $$
declare v_quote jsonb; v_result jsonb; v_order public.orders;
begin
  v_quote := public.quote_order('11111111-1111-4111-8111-111111111111', test_helpers.items('voltix-20000-pd', 2), 'welcome10', 'buyer@test.local');
  assert (v_quote ->> 'subtotal')::numeric = 14998, 'quote subtotal';
  assert (v_quote -> 'coupon' ->> 'valid')::boolean, 'coupon valid in quote';
  assert (v_quote ->> 'discount_amount')::numeric = 1499.80, format('10%% discount, got %s', v_quote ->> 'discount_amount');

  insert into public.coupons (tenant_id, code, discount_type, discount_value, min_order_amount)
  values ('11111111-1111-4111-8111-111111111111', 'BIGSPEND', 'fixed', 500, 50000);
  v_quote := public.quote_order('11111111-1111-4111-8111-111111111111', test_helpers.items('kinetic-usb-c-cable-2m', 1), 'BIGSPEND', null);
  assert (v_quote -> 'coupon' ->> 'reason') = 'COUPON_MIN_ORDER', 'min order enforced';

  v_quote := public.quote_order('11111111-1111-4111-8111-111111111111', test_helpers.items('nimbus-x12-5g', 1), 'WELCOME10', null);
  assert (v_quote ->> 'discount_amount')::numeric = 1500, 'max discount cap applied';

  v_result := public.place_order('11111111-1111-4111-8111-111111111111', test_helpers.items('voltix-20000-pd', 2),
    test_helpers.customer(), 'cod', 0, 14998, gen_random_uuid(), 'WELCOME10', null);
  select * into v_order from public.orders where id = (v_result ->> 'order_id')::uuid;
  assert v_order.discount_amount = 1499.80 and v_order.total_amount = 13498.20, 'coupon applied to order';
  assert (select used_count from public.coupons where code = 'WELCOME10' and tenant_id = v_order.tenant_id) = 1, 'coupon usage counted';

  -- Coupons of another tenant are not valid here
  v_quote := public.quote_order('22222222-2222-4222-8222-222222222222', jsonb_build_array(jsonb_build_object('product_id',
      (select id from public.products where tenant_id = '22222222-2222-4222-8222-222222222222' and slug = 'wrap-midi-dress'), 'quantity', 1)),
    'NOPE-CODE', null);
  assert not (v_quote -> 'coupon' ->> 'valid')::boolean, 'unknown coupon invalid';
end $$;

-- ---------------------------------------------------------------------------
-- Payments (webhook path)
-- ---------------------------------------------------------------------------
do $$
declare v_result jsonb; v_order_id uuid; v_status jsonb;
begin
  update public.store_settings
  set payment_config = jsonb_set(payment_config, '{enabled_methods}', '["cod","bank_transfer","card"]')
  where tenant_id = '11111111-1111-4111-8111-111111111111';

  v_result := public.place_order('11111111-1111-4111-8111-111111111111', test_helpers.items('kinetic-gan-65w', 1),
    test_helpers.customer(), 'card', 250, null, gen_random_uuid(), null, null);
  v_order_id := (v_result ->> 'order_id')::uuid;

  begin
    perform public.record_payment('11111111-1111-4111-8111-111111111111', v_order_id, 'stripe', 'cs_test_1', 'succeeded', 1, 'PKR');
    raise exception 'TEST FAILED: underpayment accepted';
  exception when others then
    if sqlerrm <> 'PAYMENT_AMOUNT_MISMATCH' then raise; end if;
  end;

  v_status := public.record_payment('11111111-1111-4111-8111-111111111111', v_order_id, 'stripe', 'cs_test_1', 'succeeded', 6249, 'PKR');
  assert v_status ->> 'payment_status' = 'paid', 'order paid';
  assert v_status ->> 'order_status' = 'confirmed', 'paid order auto-confirmed';

  -- Webhook retry is idempotent
  v_status := public.record_payment('11111111-1111-4111-8111-111111111111', v_order_id, 'stripe', 'cs_test_1', 'succeeded', 6249, 'PKR');
  assert (select count(*) from public.payment_transactions where order_id = v_order_id) = 1, 'no duplicate transactions';

  -- Wrong tenant for the order
  begin
    perform public.record_payment('22222222-2222-4222-8222-222222222222', v_order_id, 'stripe', 'cs_test_2', 'succeeded', 6249, 'PKR');
    raise exception 'TEST FAILED: cross-tenant payment recorded';
  exception when others then
    if sqlerrm <> 'ORDER_NOT_FOUND' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Rate limiter
-- ---------------------------------------------------------------------------
do $$
begin
  assert public.consume_rate_limit('test:ip', 2, 60), 'hit 1 allowed';
  assert public.consume_rate_limit('test:ip', 2, 60), 'hit 2 allowed';
  assert not public.consume_rate_limit('test:ip', 2, 60), 'hit 3 blocked';
end $$;

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------
do $$
begin
  assert (select count(*) from public.search_products('11111111-1111-4111-8111-111111111111', 'sonora')) = 2, 'brand search';
  assert (select count(*) from public.search_products('11111111-1111-4111-8111-111111111111', 'earb')) >= 2, 'prefix search on category';
  assert (select count(*) from public.search_products('11111111-1111-4111-8111-111111111111', 'VLX-PB20K')) = 1, 'sku search';
  assert (select count(*) from public.search_products('11111111-1111-4111-8111-111111111111', 'x'' & !(:*')) >= 0, 'operator injection is harmless';
  assert (select count(*) from public.search_products('22222222-2222-4222-8222-222222222222', 'sonora')) = 0, 'search is tenant scoped';
  assert (select min(price) from public.search_products('11111111-1111-4111-8111-111111111111', null, p_min_price => 5000)) >= 5000, 'price filter';
  assert (select bool_and(is_on_sale) from public.search_products('11111111-1111-4111-8111-111111111111', null, p_on_sale => true)), 'sale filter';
  assert (select total_count from public.search_products('11111111-1111-4111-8111-111111111111', null, p_limit => 2) limit 1) > 2, 'total count independent of page size';
end $$;

reset role;
rollback;
\echo '  ✔ orders, payments, coupons, search'
