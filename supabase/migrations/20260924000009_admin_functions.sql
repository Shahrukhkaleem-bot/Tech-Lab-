-- =============================================================================
-- 0009 ADMIN FUNCTIONS: atomic multi-table writes for the admin dashboard.
-- SECURITY INVOKER: they run as the calling user, so RLS applies to every
-- statement; the explicit role check just gives a clearer error.
-- =============================================================================

create or replace function public.admin_save_product(
  p_tenant_id uuid,
  p_product_id uuid,
  p_data jsonb,
  p_images jsonb,
  p_cost_price numeric default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_removed text[];
  v_keep uuid[];
begin
  if not app_private.has_tenant_role(p_tenant_id, 'manager') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_images, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_images, '[]'::jsonb)) > 12 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001', detail = 'images';
  end if;

  if p_product_id is null then
    insert into public.products (
      tenant_id, name, slug, sku, short_description, description, category_id, brand_id,
      original_price, sale_price, track_inventory, stock_quantity, low_stock_threshold,
      is_featured, is_active, specifications, tags, seo_title, seo_description
    ) values (
      p_tenant_id, p_data ->> 'name', p_data ->> 'slug', nullif(p_data ->> 'sku', ''),
      nullif(p_data ->> 'short_description', ''), nullif(p_data ->> 'description', ''),
      nullif(p_data ->> 'category_id', '')::uuid, nullif(p_data ->> 'brand_id', '')::uuid,
      (p_data ->> 'original_price')::numeric, nullif(p_data ->> 'sale_price', '')::numeric,
      coalesce((p_data ->> 'track_inventory')::boolean, true), coalesce((p_data ->> 'stock_quantity')::int, 0),
      coalesce((p_data ->> 'low_stock_threshold')::int, 5),
      coalesce((p_data ->> 'is_featured')::boolean, false), coalesce((p_data ->> 'is_active')::boolean, true),
      coalesce(p_data -> 'specifications', '[]'::jsonb),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_data -> 'tags', '[]'::jsonb))), '{}'),
      nullif(p_data ->> 'seo_title', ''), nullif(p_data ->> 'seo_description', '')
    )
    returning id into v_id;
  else
    update public.products set
      name = p_data ->> 'name',
      slug = p_data ->> 'slug',
      sku = nullif(p_data ->> 'sku', ''),
      short_description = nullif(p_data ->> 'short_description', ''),
      description = nullif(p_data ->> 'description', ''),
      category_id = nullif(p_data ->> 'category_id', '')::uuid,
      brand_id = nullif(p_data ->> 'brand_id', '')::uuid,
      original_price = (p_data ->> 'original_price')::numeric,
      sale_price = nullif(p_data ->> 'sale_price', '')::numeric,
      track_inventory = coalesce((p_data ->> 'track_inventory')::boolean, true),
      stock_quantity = coalesce((p_data ->> 'stock_quantity')::int, 0),
      low_stock_threshold = coalesce((p_data ->> 'low_stock_threshold')::int, 5),
      is_featured = coalesce((p_data ->> 'is_featured')::boolean, false),
      is_active = coalesce((p_data ->> 'is_active')::boolean, true),
      specifications = coalesce(p_data -> 'specifications', '[]'::jsonb),
      tags = coalesce(array(select jsonb_array_elements_text(coalesce(p_data -> 'tags', '[]'::jsonb))), '{}'),
      seo_title = nullif(p_data ->> 'seo_title', ''),
      seo_description = nullif(p_data ->> 'seo_description', '')
    where id = p_product_id and tenant_id = p_tenant_id
    returning id into v_id;

    if v_id is null then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;

  -- Private cost data
  if p_cost_price is null then
    delete from public.product_costs where product_id = v_id;
  else
    insert into public.product_costs (product_id, tenant_id, cost_price)
    values (v_id, p_tenant_id, p_cost_price)
    on conflict (product_id) do update set cost_price = excluded.cost_price;
  end if;

  -- Images: remove rows no longer present (return their storage paths for cleanup)
  v_keep := coalesce(array(
    select (e ->> 'id')::uuid from jsonb_array_elements(p_images) e
    where nullif(e ->> 'id', '') is not null
  ), '{}');

  with removed as (
    delete from public.product_images
    where product_id = v_id and not (id = any (v_keep))
    returning storage_path
  )
  select coalesce(array_agg(storage_path) filter (where storage_path is not null), '{}') into v_removed from removed;

  update public.product_images set is_primary = false where product_id = v_id and is_primary;

  insert into public.product_images (id, tenant_id, product_id, image_url, storage_path, alt_text, is_primary, display_order)
  select
    coalesce(nullif(e ->> 'id', '')::uuid, gen_random_uuid()),
    p_tenant_id, v_id, e ->> 'url', nullif(e ->> 'storage_path', ''), nullif(e ->> 'alt', ''),
    false, (t.ord - 1)::int
  from jsonb_array_elements(p_images) with ordinality as t(e, ord)
  on conflict (id) do update
    set alt_text = excluded.alt_text, display_order = excluded.display_order
    where public.product_images.product_id = excluded.product_id;

  -- Exactly one primary: the flagged image, else the first.
  update public.product_images set is_primary = true
  where id = coalesce(
    (select nullif(e ->> 'id', '')::uuid from jsonb_array_elements(p_images) e
      where (e ->> 'is_primary')::boolean and nullif(e ->> 'id', '') is not null limit 1),
    (select pi.id from public.product_images pi where pi.product_id = v_id order by pi.display_order limit 1)
  ) and product_id = v_id;

  return jsonb_build_object('id', v_id, 'removed_paths', to_jsonb(v_removed));
end;
$$;

revoke execute on function public.admin_save_product(uuid, uuid, jsonb, jsonb, numeric) from public, anon;
grant execute on function public.admin_save_product(uuid, uuid, jsonb, jsonb, numeric) to authenticated, service_role;
