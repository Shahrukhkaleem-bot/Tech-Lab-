-- =============================================================================
-- 0004 STOREFRONT CONTENT: store_settings, banners, store_pages, navigation_items
-- =============================================================================
-- RULE: everything in these tables is PUBLIC (readable by any visitor of an active store).
-- Never store secrets here. Payment provider secrets live in environment variables;
-- per-tenant provider account IDs (non-secret) go in payment_config.

-- ---------------------------------------------------------------------------
-- store_settings: 1:1 with tenants. JSON shapes are validated by Zod on write
-- (src/features/tenants/schemas.ts); the DB guarantees the top-level JSON type.
-- ---------------------------------------------------------------------------
create table public.store_settings (
  tenant_id          uuid primary key references public.tenants (id) on delete cascade,
  tagline            text check (tagline is null or char_length(tagline) <= 160),
  announcement       text check (announcement is null or char_length(announcement) <= 200),

  -- [{ icon, title, description, href? }]  — "Express delivery", "Easy returns", ...
  trust_badges       jsonb not null default '[]'::jsonb check (jsonb_typeof(trust_badges) = 'array'),
  -- [{ type: featured|best_sellers|new_arrivals|on_sale|category, title, subtitle?, category_slug?, limit }]
  homepage_sections  jsonb not null default '[]'::jsonb check (jsonb_typeof(homepage_sections) = 'array'),
  -- [{ label, min?, max? }] — "Shop by price"
  price_ranges       jsonb not null default '[]'::jsonb check (jsonb_typeof(price_ranges) = 'array'),
  -- { address, map_url, embed_url, latitude, longitude, phone, hours: [{ label, value }] }
  store_location     jsonb not null default '{}'::jsonb check (jsonb_typeof(store_location) = 'object'),
  -- { flat_rate, free_shipping_threshold, city_rates: [{ city, rate }], estimated_days: { min, max }, couriers: [] }
  shipping_config    jsonb not null default '{}'::jsonb check (jsonb_typeof(shipping_config) = 'object'),
  -- { enabled_methods: ['cod', ...], bank_accounts: [{ bank_name, account_title, account_number, iban }],
  --   instructions?, stripe_account_id? }
  payment_config     jsonb not null default '{"enabled_methods": ["cod"]}'::jsonb check (jsonb_typeof(payment_config) = 'object'),
  -- [{ label, image_url? }] — payment / courier logos shown in the footer
  footer_badges      jsonb not null default '[]'::jsonb check (jsonb_typeof(footer_badges) = 'array'),
  shipping_info      text check (shipping_info is null or char_length(shipping_info) <= 2000),
  return_info        text check (return_info is null or char_length(return_info) <= 2000),
  -- { title, description, og_image_url }
  seo                jsonb not null default '{}'::jsonb check (jsonb_typeof(seo) = 'object'),
  updated_at         timestamptz not null default now()
);

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function app_private.set_updated_at();

-- Every tenant gets a settings row automatically.
create or replace function app_private.create_default_store_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.store_settings (tenant_id) values (new.id) on conflict do nothing;
  return null;
end;
$$;

create trigger tenants_create_store_settings
  after insert on public.tenants
  for each row execute function app_private.create_default_store_settings();

-- ---------------------------------------------------------------------------
-- banners: hero slides
-- ---------------------------------------------------------------------------
create table public.banners (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  heading             text not null check (char_length(heading) between 1 and 120),
  description         text check (description is null or char_length(description) <= 300),
  badge               text check (badge is null or char_length(badge) <= 40),
  cta_label           text check (cta_label is null or char_length(cta_label) <= 40),
  link_url            text check (link_url is null or link_url ~ '^(/|https://)'),
  desktop_image_url   text not null check (desktop_image_url ~ '^(/|https://)'),
  mobile_image_url    text check (mobile_image_url is null or mobile_image_url ~ '^(/|https://)'),
  display_order       int not null default 0,
  is_active           boolean not null default true,
  starts_at           timestamptz,
  ends_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint banners_schedule check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create index banners_tenant_active_idx on public.banners (tenant_id, display_order) where is_active;

create trigger banners_set_updated_at
  before update on public.banners
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- store_pages: policies & static content (privacy, returns, warranty, FAQ, about)
-- Content is plain text rendered as paragraphs — never injected as HTML.
-- ---------------------------------------------------------------------------
create table public.store_pages (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  slug             text not null check (app_private.is_valid_slug(slug)),
  title            text not null check (char_length(title) between 1 and 120),
  content          text not null default '' check (char_length(content) <= 50000),
  seo_description  text check (seo_description is null or char_length(seo_description) <= 160),
  is_published     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, slug)
);

create trigger store_pages_set_updated_at
  before update on public.store_pages
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- navigation_items: tenant-defined header links and footer link columns
-- (category mega-menu is generated from categories, not stored here)
-- ---------------------------------------------------------------------------
create table public.navigation_items (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  location       public.nav_location not null,
  label          text not null check (char_length(label) between 1 and 60),
  href           text not null check (href ~ '^(/|https://|mailto:|tel:)'),
  display_order  int not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index navigation_items_tenant_location_idx
  on public.navigation_items (tenant_id, location, display_order) where is_active;

create trigger navigation_items_set_updated_at
  before update on public.navigation_items
  for each row execute function app_private.set_updated_at();

grant execute on all functions in schema app_private to anon, authenticated, service_role;
