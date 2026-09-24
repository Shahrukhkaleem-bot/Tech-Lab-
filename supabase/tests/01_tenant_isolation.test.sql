-- =============================================================================
-- Tenant isolation & RLS tests. Runs inside a transaction that is rolled back.
-- Requires seed.sql (demo tenants A = Electronics, B = Fashion).
-- =============================================================================
begin;

-- Fixtures ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'owner-a@test.local'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'staff-a@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'owner-b@test.local'),
  ('cccccccc-0000-4000-8000-000000000001', 'customer@test.local');

insert into public.tenant_members (tenant_id, user_id, role) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'owner'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', 'staff'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0000-4000-8000-000000000001', 'owner');

insert into public.product_costs (product_id, tenant_id, cost_price)
select id, tenant_id, round(price * 0.6, 2) from public.products;

-- An inactive product in tenant A (draft)
insert into public.products (tenant_id, name, slug, original_price, is_active)
values ('11111111-1111-4111-8111-111111111111', 'Secret Draft', 'secret-draft', 100, false);

-- One order per tenant, placed through the real function
select public.place_order('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'sonora-buds-lite'), 'quantity', 1)),
  '{"name":"Test Customer","email":"customer@test.local","phone":"03000000000","address":"House 1, Street 2","city":"Lahore"}',
  'cod', 250, null, gen_random_uuid(), null, 'cccccccc-0000-4000-8000-000000000001');

select public.place_order('22222222-2222-4222-8222-222222222222',
  jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'canvas-tote'), 'quantity', 1)),
  '{"name":"Other Customer","email":"other@test.local","phone":"03000000001","address":"House 9, Street 9","city":"Karachi"}',
  'cod', 250, null, gen_random_uuid(), null, null);

-- Helper: impersonate a JWT subject for the rest of the transaction
create function pg_temp.act_as(p_role text, p_sub uuid default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_sub is null then json_build_object('role', p_role)::text
         else json_build_object('role', p_role, 'sub', p_sub)::text end, true);
  execute format('set local role %I', p_role);
end $$;
grant execute on function pg_temp.act_as(text, uuid) to anon, authenticated;

-- =============================================================================
-- ANON
-- =============================================================================
select pg_temp.act_as('anon');
do $$
begin
  assert (select count(*) from public.products where slug = 'secret-draft') = 0, 'anon must not see inactive products';
  assert (select count(*) from public.orders) = 0, 'anon must not see orders';
  assert (select count(*) from public.product_costs) = 0, 'anon must not see costs';
  assert (select count(*) from public.coupons) = 0, 'anon must not see coupons';
  assert (select count(*) from public.tenant_members) = 0, 'anon must not see memberships';
  assert (select count(*) from public.reviews where not is_approved) = 0, 'anon must not see unapproved reviews';
  assert (select count(*) from public.products) > 0, 'anon must see active catalogue';

  begin
    insert into public.categories (tenant_id, name, slug) values ('11111111-1111-4111-8111-111111111111', 'x', 'x');
    raise exception 'TEST FAILED: anon inserted a category';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.place_order('11111111-1111-4111-8111-111111111111', '[]', '{}', 'cod', 0, null, gen_random_uuid(), null, null);
    raise exception 'TEST FAILED: anon executed place_order';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.consume_rate_limit('x', 1, 1);
    raise exception 'TEST FAILED: anon executed consume_rate_limit';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- =============================================================================
-- OWNER OF TENANT A
-- =============================================================================
select pg_temp.act_as('authenticated', 'aaaaaaaa-0000-4000-8000-000000000001');
do $$
declare v_count int;
begin
  assert (select count(*) from public.orders) = 1, 'owner A sees exactly their store order';
  assert (select bool_and(tenant_id = '11111111-1111-4111-8111-111111111111') from public.orders), 'owner A sees only tenant A orders';
  assert (select count(*) from public.product_costs where tenant_id = '22222222-2222-4222-8222-222222222222') = 0, 'owner A must not see tenant B costs';
  assert (select count(*) from public.product_costs where tenant_id = '11111111-1111-4111-8111-111111111111') > 0, 'owner A sees own costs';
  assert (select count(*) from public.products where slug = 'secret-draft') = 1, 'owner A sees own drafts';
  assert (select count(*) from public.coupons where tenant_id = '22222222-2222-4222-8222-222222222222') = 0, 'owner A must not see tenant B coupons';

  -- Writes into tenant B are silently filtered (update/delete) or rejected (insert).
  update public.products set original_price = 1 where tenant_id = '22222222-2222-4222-8222-222222222222';
  get diagnostics v_count = row_count;
  assert v_count = 0, 'owner A must not update tenant B products';

  delete from public.brands where tenant_id = '22222222-2222-4222-8222-222222222222';
  get diagnostics v_count = row_count;
  assert v_count = 0, 'owner A must not delete tenant B brands';

  begin
    insert into public.products (tenant_id, name, slug, original_price)
    values ('22222222-2222-4222-8222-222222222222', 'Injected', 'injected', 1);
    raise exception 'TEST FAILED: owner A inserted into tenant B';
  exception when insufficient_privilege then null;
  end;

  -- Cross-tenant reference: product in A pointing at a brand of B is rejected by composite FK.
  begin
    insert into public.products (tenant_id, name, slug, original_price, brand_id)
    values ('11111111-1111-4111-8111-111111111111', 'Cross', 'cross-ref', 1,
            (select id from public.brands where tenant_id = '22222222-2222-4222-8222-222222222222' limit 1));
    raise exception 'TEST FAILED: cross-tenant brand reference accepted';
  exception when foreign_key_violation then null;
  end;

  -- Platform-managed columns are protected.
  begin
    update public.tenants set subdomain = 'hijack' where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'TEST FAILED: admin changed subdomain';
  exception when insufficient_privilege then null;
  end;

  -- Aggregates cannot be forged.
  update public.products set rating = 5, review_count = 999, sales_count = 99999 where slug = 'nimbus-a5';
  assert (select review_count from public.products where slug = 'nimbus-a5') <> 999, 'review_count must not be client-writable';
  assert (select sales_count from public.products where slug = 'nimbus-a5') <> 99999, 'sales_count must not be client-writable';

  -- Legit write works and is logged in the inventory ledger.
  update public.products set stock_quantity = stock_quantity + 5 where slug = 'nimbus-a5';
  assert exists (select 1 from public.inventory_movements m join public.products p on p.id = m.product_id
                 where p.slug = 'nimbus-a5' and m.reason = 'adjustment' and m.quantity_change = 5),
         'stock adjustment must be logged';
end $$;
reset role;

-- =============================================================================
-- STAFF OF TENANT A (lowest member role)
-- =============================================================================
select pg_temp.act_as('authenticated', 'aaaaaaaa-0000-4000-8000-000000000002');
do $$
declare v_count int; v_order uuid;
begin
  select id into v_order from public.orders limit 1;
  assert v_order is not null, 'staff sees store orders';
  assert (select count(*) from public.product_costs) = 0, 'staff must not see cost prices';

  update public.products set original_price = 1 where tenant_id = '11111111-1111-4111-8111-111111111111';
  get diagnostics v_count = row_count;
  assert v_count = 0, 'staff must not edit products';

  -- Staff may progress fulfilment ...
  update public.orders set order_status = 'confirmed' where id = v_order;
  update public.orders set order_status = 'shipped', courier_name = 'TCS', tracking_number = 'TCS123' where id = v_order;
  assert (select shipped_at is not null from public.orders where id = v_order), 'shipped_at set automatically';

  -- ... but not change money, payment status, or skip the state machine.
  begin
    update public.orders set total_amount = 1, subtotal = 1 where id = v_order;
    raise exception 'TEST FAILED: staff changed order totals';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.orders set payment_status = 'paid' where id = v_order;
    raise exception 'TEST FAILED: staff changed payment status';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.orders set order_status = 'pending' where id = v_order;
    raise exception 'TEST FAILED: invalid transition accepted';
  exception when check_violation then null;
  end;

  begin
    update public.orders set order_status = 'cancelled' where id = v_order;
    raise exception 'TEST FAILED: direct cancel bypassed restock';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;

  begin
    perform public.cancel_order(v_order, 'staff attempt');
    raise exception 'TEST FAILED: staff cancelled an order';
  exception when others then
    if sqlerrm not like '%ORDER_NOT_FOUND%' then raise; end if;
  end;
end $$;
reset role;

-- =============================================================================
-- CUSTOMER (not a member of any store)
-- =============================================================================
select pg_temp.act_as('authenticated', 'cccccccc-0000-4000-8000-000000000001');
do $$
declare v_count int;
begin
  assert (select count(*) from public.orders) = 1, 'customer sees only their own order';
  assert (select count(*) from public.order_items) = 1, 'customer sees only their own order items';
  assert (select count(*) from public.payment_transactions) = 0, 'customer must not see payment transactions';

  update public.orders set customer_name = 'Hacker';
  get diagnostics v_count = row_count;
  assert v_count = 0, 'customer must not update orders';

  -- Reviews: forced to pending + author identity, cannot self-approve.
  insert into public.reviews (tenant_id, product_id, customer_name, rating, comment, is_approved, is_verified, user_id)
  values ('11111111-1111-4111-8111-111111111111', (select id from public.products where slug = 'nimbus-a5'),
          'Me', 5, 'Great', true, true, 'aaaaaaaa-0000-4000-8000-000000000001');
  assert (select not is_approved and not is_verified and user_id = 'cccccccc-0000-4000-8000-000000000001'
          from public.reviews where comment = 'Great'), 'review guard must force pending/unverified/own user';

  -- Wishlist is private.
  insert into public.wishlist_items (user_id, tenant_id, product_id)
  values ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
          (select id from public.products where slug = 'nimbus-a5'));
  begin
    insert into public.wishlist_items (user_id, tenant_id, product_id)
    values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
            (select id from public.products where slug = 'nimbus-a5'));
    raise exception 'TEST FAILED: wrote another user''s wishlist';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- =============================================================================
-- SUSPENDED TENANT disappears from the public catalogue
-- =============================================================================
update public.tenants set status = 'suspended' where id = '22222222-2222-4222-8222-222222222222';
select pg_temp.act_as('anon');
do $$
begin
  assert (select count(*) from public.products where tenant_id = '22222222-2222-4222-8222-222222222222') = 0,
    'suspended tenant products must be hidden';
  assert (select count(*) from public.tenants where id = '22222222-2222-4222-8222-222222222222') = 0,
    'suspended tenant must be hidden';
end $$;
reset role;

-- =============================================================================
-- STORAGE: path-based tenant isolation
-- =============================================================================
select pg_temp.act_as('authenticated', 'aaaaaaaa-0000-4000-8000-000000000001');
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('product-images', '11111111-1111-4111-8111-111111111111/abc123.webp');

  begin
    insert into storage.objects (bucket_id, name)
    values ('product-images', '22222222-2222-4222-8222-222222222222/abc123.webp');
    raise exception 'TEST FAILED: uploaded into another tenant folder';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name)
    values ('product-images', '11111111-1111-4111-8111-111111111111/../x.webp');
    raise exception 'TEST FAILED: malformed path accepted';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name)
    values ('product-images', '11111111-1111-4111-8111-111111111111/evil.svg');
    raise exception 'TEST FAILED: svg path accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pg_temp.act_as('authenticated', 'aaaaaaaa-0000-4000-8000-000000000002');
do $$
begin
  begin
    insert into storage.objects (bucket_id, name)
    values ('product-images', '11111111-1111-4111-8111-111111111111/staff.webp');
    raise exception 'TEST FAILED: staff uploaded catalogue image';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
\echo '  ✔ tenant isolation'
