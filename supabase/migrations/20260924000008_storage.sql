-- =============================================================================
-- 0008 STORAGE: buckets + policies
-- =============================================================================
-- Object path convention (enforced by policies):  {tenant_id}/{uuid}.{ext}
--   e.g. product-images/7c0e…/3f2a….webp
--
-- * All four buckets are PUBLIC-READ: catalogue images are served via CDN URLs
--   (/storage/v1/object/public/...). Public buckets serve files without RLS, but
--   LISTING still requires a SELECT policy, which only store members have.
-- * Size + MIME limits are enforced by Storage itself (bucket config), not the client.
-- * SVG is deliberately excluded: it can carry script and would be served from our origin.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tenant-assets',   'tenant-assets',   true, 2 * 1024 * 1024,
     array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/x-icon', 'image/vnd.microsoft.icon']),
  ('product-images',  'product-images',  true, 5 * 1024 * 1024,
     array['image/png', 'image/jpeg', 'image/webp', 'image/avif']),
  ('category-images', 'category-images', true, 2 * 1024 * 1024,
     array['image/png', 'image/jpeg', 'image/webp', 'image/avif']),
  ('brand-images',    'brand-images',    true, 2 * 1024 * 1024,
     array['image/png', 'image/jpeg', 'image/webp', 'image/avif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Returns the tenant that owns an object path, or NULL when the path is malformed.
create or replace function app_private.storage_object_tenant(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_first text := split_part(p_name, '/', 1);
begin
  if v_first !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  -- Exactly two segments and a safe file name: {tenant}/{name}.{ext}
  if p_name !~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,80}\.(png|jpe?g|webp|avif|ico)$' then
    return null;
  end if;
  return v_first::uuid;
end;
$$;

grant execute on function app_private.storage_object_tenant(text) to anon, authenticated, service_role;

-- Minimum role to write files. Uploading alone changes nothing visible: branding only
-- changes when an admin saves settings that reference the file, so manager is enough
-- for every bucket (banners, a manager task, also live in tenant-assets).
create or replace function app_private.storage_min_role(p_bucket text)
returns public.member_role
language sql
immutable
set search_path = ''
as $$
  select 'manager'::public.member_role where p_bucket is not null;
$$;

grant execute on function app_private.storage_min_role(text) to anon, authenticated, service_role;

create policy "storage: members list their store files"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('tenant-assets', 'product-images', 'category-images', 'brand-images')
    and app_private.has_tenant_role(app_private.storage_object_tenant(name), 'staff')
  );

create policy "storage: managers upload to their store folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('tenant-assets', 'product-images', 'category-images', 'brand-images')
    and app_private.has_tenant_role(app_private.storage_object_tenant(name), app_private.storage_min_role(bucket_id))
  );

create policy "storage: managers replace files in their store folder"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('tenant-assets', 'product-images', 'category-images', 'brand-images')
    and app_private.has_tenant_role(app_private.storage_object_tenant(name), app_private.storage_min_role(bucket_id))
  )
  with check (
    bucket_id in ('tenant-assets', 'product-images', 'category-images', 'brand-images')
    and app_private.has_tenant_role(app_private.storage_object_tenant(name), app_private.storage_min_role(bucket_id))
  );

create policy "storage: managers delete files in their store folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('tenant-assets', 'product-images', 'category-images', 'brand-images')
    and app_private.has_tenant_role(app_private.storage_object_tenant(name), app_private.storage_min_role(bucket_id))
  );
