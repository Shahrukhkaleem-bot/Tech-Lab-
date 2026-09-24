-- =============================================================================
-- admin_save_product: atomic save, image sync, cost privacy, tenant isolation.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'mgr-a@test.local'),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'staff-a2@test.local');
insert into public.tenant_members (tenant_id, user_id, role) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4000-8000-000000000001', 'manager'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4000-8000-000000000002', 'staff');

create schema admin_test;
create function admin_test.act_as(p_sub uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', p_sub)::text, true);
  set local role authenticated;
end $$;

select admin_test.act_as('aaaaaaaa-1111-4000-8000-000000000001');
do $$
declare
  v_res jsonb;
  v_id uuid;
  v_img1 uuid := gen_random_uuid();
  v_img2 uuid := gen_random_uuid();
begin
  -- Create with two images; second flagged primary.
  v_res := public.admin_save_product('11111111-1111-4111-8111-111111111111', null,
    '{"name":"Admin Test Product","slug":"admin-test-product","original_price":1000,"sale_price":900,"stock_quantity":7,"specifications":[{"name":"Color","value":"Black"}],"tags":["new"]}',
    jsonb_build_array(
      jsonb_build_object('id', v_img1, 'url', 'https://example.com/1.webp', 'storage_path', '11111111-1111-4111-8111-111111111111/a.webp'),
      jsonb_build_object('id', v_img2, 'url', 'https://example.com/2.webp', 'is_primary', true)),
    600);
  v_id := (v_res ->> 'id')::uuid;

  assert (select price from public.products where id = v_id) = 900, 'price derived from sale price';
  assert (select count(*) from public.product_images where product_id = v_id) = 2, 'two images';
  assert (select is_primary from public.product_images where id = v_img2), 'flagged image is primary';
  assert (select cost_price from public.product_costs where product_id = v_id) = 600, 'cost saved privately';
  assert exists (select 1 from public.inventory_movements where product_id = v_id and reason = 'initial' and quantity_change = 7), 'initial stock logged';

  -- Update: drop image 1 → its storage path is returned for cleanup; stock change is logged.
  v_res := public.admin_save_product('11111111-1111-4111-8111-111111111111', v_id,
    '{"name":"Admin Test Product v2","slug":"admin-test-product","original_price":1000,"stock_quantity":10}',
    jsonb_build_array(jsonb_build_object('id', v_img2, 'url', 'https://example.com/2.webp')),
    null);
  assert (v_res -> 'removed_paths') ? '11111111-1111-4111-8111-111111111111/a.webp', 'removed storage path returned';
  assert (select count(*) from public.product_images where product_id = v_id) = 1, 'image removed';
  assert (select is_primary from public.product_images where id = v_img2), 'remaining image becomes primary';
  assert not exists (select 1 from public.product_costs where product_id = v_id), 'cost cleared';
  assert exists (select 1 from public.inventory_movements where product_id = v_id and reason = 'adjustment' and quantity_change = 3), 'adjustment logged';

  -- Cross-tenant attempts
  begin
    perform public.admin_save_product('22222222-2222-4222-8222-222222222222', null, '{"name":"X","slug":"x","original_price":1}', '[]', null);
    raise exception 'TEST FAILED: manager of A saved into B';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.admin_save_product('11111111-1111-4111-8111-111111111111',
      (select id from public.products where tenant_id = '22222222-2222-4222-8222-222222222222' limit 1),
      '{"name":"Hijack","slug":"hijack","original_price":1}', '[]', null);
    raise exception 'TEST FAILED: updated a product of another tenant';
  exception when others then
    if sqlerrm <> 'NOT_FOUND' then raise; end if;
  end;
end $$;
reset role;

select admin_test.act_as('aaaaaaaa-1111-4000-8000-000000000002');
do $$
begin
  begin
    perform public.admin_save_product('11111111-1111-4111-8111-111111111111', null, '{"name":"X","slug":"x2","original_price":1}', '[]', null);
    raise exception 'TEST FAILED: staff saved a product';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
\echo '  ✔ admin product save'
