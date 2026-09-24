-- =============================================================================
-- 0002 TENANCY: tenants, profiles, tenant_members, membership helpers
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
create table public.tenants (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null check (char_length(name) between 1 and 120),
  slug                      text not null unique check (app_private.is_valid_slug(slug)),
  subdomain                 text not null unique,
  custom_domain             text unique,
  custom_domain_verified_at timestamptz,
  status                    public.tenant_status not null default 'pending',

  -- Visual identity only. Validated by Zod on write (src/features/tenants/schemas.ts).
  -- { primary_color, secondary_color, accent_color, logo_url, favicon_url, font_family, radius }
  brand_config              jsonb not null default '{}'::jsonb check (jsonb_typeof(brand_config) = 'object'),

  -- Contact info as columns (queryable, individually validated) instead of inside brand_config.
  contact_email             text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone             text check (contact_phone is null or char_length(contact_phone) <= 40),
  whatsapp_number           text check (whatsapp_number is null or char_length(whatsapp_number) <= 40),
  address                   text check (address is null or char_length(address) <= 500),
  -- { facebook, instagram, tiktok, youtube, x, linkedin, whatsapp }
  social_links              jsonb not null default '{}'::jsonb check (jsonb_typeof(social_links) = 'object'),

  currency                  char(3) not null default 'PKR' check (currency ~ '^[A-Z]{3}$'),
  locale                    text not null default 'en-PK' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  timezone                  text not null default 'Asia/Karachi',

  -- Per-tenant human-friendly order numbers (#1001, #1002 ...). Incremented by place_order().
  order_number_seq          bigint not null default 1000 check (order_number_seq >= 0),

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint tenants_subdomain_format check (
    subdomain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
    and subdomain not in ('www', 'app', 'api', 'admin', 'platform', 'mail', 'static', 'assets', 'cdn', 'auth', 'dashboard', 'status', 'docs')
  ),
  constraint tenants_custom_domain_format check (
    custom_domain is null
    or (custom_domain = lower(custom_domain)
        and custom_domain ~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$')
  )
);

comment on table public.tenants is 'One row per store. Everything tenant-owned references tenants.id.';

create index tenants_status_idx on public.tenants (status);

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users, platform-wide
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (full_name is null or char_length(full_name) <= 120),
  phone       text check (phone is null or char_length(phone) <= 40),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app_private.set_updated_at();

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(left(new.raw_user_meta_data ->> 'full_name', 120), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- ---------------------------------------------------------------------------
-- tenant_members: who can manage which store, and how much
-- ---------------------------------------------------------------------------
create table public.tenant_members (
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.member_role not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_members_user_idx on public.tenant_members (user_id);

create trigger tenant_members_set_updated_at
  before update on public.tenant_members
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers (used by every RLS policy)
-- ---------------------------------------------------------------------------
create or replace function app_private.role_rank(p_role public.member_role)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'owner'   then 4
    when 'admin'   then 3
    when 'manager' then 2
    when 'staff'   then 1
  end;
$$;

-- Tenants where the current user holds at least p_min_role.
-- Used as `tenant_id in (select app_private.member_tenant_ids('manager'))`, which Postgres
-- evaluates once per statement (InitPlan) instead of once per row.
create or replace function app_private.member_tenant_ids(p_min_role public.member_role)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.tenant_id
  from public.tenant_members m
  where m.user_id = (select auth.uid())
    and app_private.role_rank(m.role) >= app_private.role_rank(p_min_role);
$$;

create or replace function app_private.has_tenant_role(p_tenant_id uuid, p_min_role public.member_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_members m
    where m.tenant_id = p_tenant_id
      and m.user_id = (select auth.uid())
      and app_private.role_rank(m.role) >= app_private.role_rank(p_min_role)
  );
$$;

create or replace function app_private.is_tenant_active(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tenants t where t.id = p_tenant_id and t.status = 'active');
$$;

-- ---------------------------------------------------------------------------
-- Guard rails
-- ---------------------------------------------------------------------------

-- Store admins may edit branding/contact info, but not routing, lifecycle or counters.
create or replace function app_private.tenants_guard_protected_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app_private.is_privileged() then
    return new;
  end if;

  if new.slug is distinct from old.slug
     or new.subdomain is distinct from old.subdomain
     or new.custom_domain is distinct from old.custom_domain
     or new.custom_domain_verified_at is distinct from old.custom_domain_verified_at
     or new.status is distinct from old.status
     or new.order_number_seq is distinct from old.order_number_seq then
    raise exception 'PROTECTED_COLUMN' using
      errcode = '42501',
      hint = 'slug, subdomain, custom_domain, status and order_number_seq are platform-managed.';
  end if;
  return new;
end;
$$;

create trigger tenants_guard_protected_columns
  before update on public.tenants
  for each row execute function app_private.tenants_guard_protected_columns();

-- Never leave a store without an owner; only owners can create/remove/promote owners.
create or replace function app_private.tenant_members_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
  v_remaining int;
begin
  if not app_private.is_privileged() then
    if (tg_op in ('INSERT', 'UPDATE') and new.role = 'owner')
       or (tg_op in ('UPDATE', 'DELETE') and old.role = 'owner') then
      if not app_private.has_tenant_role(v_tenant, 'owner') then
        raise exception 'ONLY_OWNER_CAN_MANAGE_OWNERS' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Skip when the whole tenant is being deleted (ON DELETE CASCADE from tenants).
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.tenants t where t.id = old.tenant_id) then
    select count(*) into v_remaining
    from public.tenant_members
    where tenant_id = old.tenant_id and role = 'owner' and user_id <> old.user_id;

    if v_remaining = 0 then
      raise exception 'LAST_OWNER' using errcode = '23514',
        hint = 'Transfer ownership before removing the last owner.';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger tenant_members_guard
  before insert or update or delete on public.tenant_members
  for each row execute function app_private.tenant_members_guard();

grant execute on all functions in schema app_private to anon, authenticated, service_role;
