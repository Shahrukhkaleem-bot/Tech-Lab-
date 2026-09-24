-- =============================================================================
-- 0003 CATALOG: categories, brands, products, product_costs, product_images,
--               reviews, inventory_movements (+ search, rating, stock triggers)
-- =============================================================================
-- Every child table carries tenant_id and uses a composite FK (tenant_id, parent_id)
-- so a row can never reference a parent that belongs to a different tenant.

-- ---------------------------------------------------------------------------
-- categories (nested via parent_id, max depth 3)
-- ---------------------------------------------------------------------------
create table public.categories (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  parent_id        uuid,
  name             text not null check (char_length(name) between 1 and 120),
  slug             text not null check (app_private.is_valid_slug(slug)),
  description      text check (description is null or char_length(description) <= 2000),
  icon_url         text,
  image_url        text,
  display_order    int not null default 0,
  is_active        boolean not null default true,
  seo_title        text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description  text check (seo_description is null or char_length(seo_description) <= 160),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (tenant_id, id),
  unique (tenant_id, slug),
  constraint categories_parent_fk foreign key (tenant_id, parent_id)
    references public.categories (tenant_id, id) on delete set null (parent_id),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id)
);

create index categories_tenant_parent_idx on public.categories (tenant_id, parent_id, display_order);
create index categories_tenant_active_idx on public.categories (tenant_id) where is_active;

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function app_private.set_updated_at();

-- Reject cycles and trees deeper than 3 levels.
create or replace function app_private.categories_guard_tree()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_depth int;
  v_cycle boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  with recursive ancestors as (
    select c.id, c.parent_id, 1 as depth
    from public.categories c
    where c.id = new.parent_id and c.tenant_id = new.tenant_id
    union all
    select c.id, c.parent_id, a.depth + 1
    from public.categories c
    join ancestors a on c.id = a.parent_id
    where a.depth < 10
  )
  select max(depth), bool_or(id = new.id) into v_depth, v_cycle from ancestors;

  if coalesce(v_cycle, false) then
    raise exception 'CATEGORY_CYCLE' using errcode = '23514';
  end if;
  if coalesce(v_depth, 0) >= 3 then
    raise exception 'CATEGORY_TOO_DEEP' using errcode = '23514', hint = 'Maximum depth is 3 levels.';
  end if;
  return new;
end;
$$;

create trigger categories_guard_tree
  before insert or update of parent_id on public.categories
  for each row execute function app_private.categories_guard_tree();

-- ---------------------------------------------------------------------------
-- brands
-- ---------------------------------------------------------------------------
create table public.brands (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 120),
  slug           text not null check (app_private.is_valid_slug(slug)),
  logo_url       text,
  description    text check (description is null or char_length(description) <= 2000),
  display_order  int not null default 0,
  is_featured    boolean not null default false,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (tenant_id, id),
  unique (tenant_id, slug)
);

create index brands_tenant_active_idx on public.brands (tenant_id, display_order) where is_active;

create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants (id) on delete cascade,
  brand_id             uuid,
  category_id          uuid,
  name                 text not null check (char_length(name) between 1 and 200),
  slug                 text not null check (app_private.is_valid_slug(slug)),
  short_description    text check (short_description is null or char_length(short_description) <= 500),
  description          text check (description is null or char_length(description) <= 20000),
  sku                  text check (sku is null or sku ~ '^[A-Za-z0-9._/-]{1,64}$'),

  original_price       numeric(12, 2) not null check (original_price >= 0),
  sale_price           numeric(12, 2) check (sale_price is null or (sale_price >= 0 and sale_price < original_price)),
  -- Derived columns: indexable, and can never disagree with the prices above.
  price                numeric(12, 2) generated always as (coalesce(sale_price, original_price)) stored,
  is_on_sale           boolean generated always as (sale_price is not null) stored,

  track_inventory      boolean not null default true,
  stock_quantity       int not null default 0 check (stock_quantity >= 0),
  low_stock_threshold  int not null default 5 check (low_stock_threshold >= 0),

  is_featured          boolean not null default false,
  is_active            boolean not null default true,

  -- Maintained by triggers on reviews / place_order. Not client-writable (see guard trigger).
  rating               numeric(3, 2) not null default 0 check (rating between 0 and 5),
  review_count         int not null default 0 check (review_count >= 0),
  sales_count          int not null default 0 check (sales_count >= 0),

  -- Ordered list: [{ "name": "Battery", "value": "5000 mAh" }, ...]
  specifications       jsonb not null default '[]'::jsonb check (jsonb_typeof(specifications) = 'array'),
  tags                 text[] not null default '{}',
  seo_title            text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description      text check (seo_description is null or char_length(seo_description) <= 160),

  search_vector        tsvector,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (tenant_id, id),
  unique (tenant_id, slug),
  constraint products_brand_fk foreign key (tenant_id, brand_id)
    references public.brands (tenant_id, id) on delete set null (brand_id),
  constraint products_category_fk foreign key (tenant_id, category_id)
    references public.categories (tenant_id, id) on delete set null (category_id)
);

create unique index products_tenant_sku_key on public.products (tenant_id, sku) where sku is not null;
create index products_tenant_listing_idx on public.products (tenant_id, created_at desc) where is_active;
create index products_tenant_category_idx on public.products (tenant_id, category_id) where is_active;
create index products_tenant_brand_idx on public.products (tenant_id, brand_id) where is_active;
create index products_tenant_price_idx on public.products (tenant_id, price) where is_active;
create index products_tenant_featured_idx on public.products (tenant_id) where is_active and is_featured;
create index products_tenant_sale_idx on public.products (tenant_id) where is_active and is_on_sale;
create index products_tenant_best_sellers_idx on public.products (tenant_id, sales_count desc) where is_active;
create index products_low_stock_idx on public.products (tenant_id) where track_inventory and stock_quantity <= low_stock_threshold;
create index products_search_idx on public.products using gin (search_vector);
create index products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function app_private.set_updated_at();

-- Search document: name (A), sku + brand (A), category + tags (B), short description (C), description (D).
-- 'simple' config: language-agnostic, works for any tenant locale.
create or replace function app_private.products_build_search_vector()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_brand text;
  v_category text;
begin
  select b.name into v_brand from public.brands b where b.id = new.brand_id;
  select c.name into v_category from public.categories c where c.id = new.category_id;

  new.search_vector :=
      setweight(to_tsvector('simple', coalesce(new.name, '')), 'A')
   || setweight(to_tsvector('simple', coalesce(new.sku, '') || ' ' || coalesce(v_brand, '')), 'A')
   || setweight(to_tsvector('simple', coalesce(v_category, '') || ' ' || array_to_string(new.tags, ' ')), 'B')
   || setweight(to_tsvector('simple', coalesce(new.short_description, '')), 'C')
   || setweight(to_tsvector('simple', left(coalesce(new.description, ''), 5000)), 'D');
  return new;
end;
$$;

create trigger products_build_search_vector
  before insert or update of name, sku, brand_id, category_id, tags, short_description, description
  on public.products
  for each row execute function app_private.products_build_search_vector();

-- Renaming a brand/category re-indexes its products.
create or replace function app_private.refresh_product_search_on_rename()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    if tg_table_name = 'brands' then
      update public.products set brand_id = brand_id where tenant_id = new.tenant_id and brand_id = new.id;
    else
      update public.products set category_id = category_id where tenant_id = new.tenant_id and category_id = new.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger brands_refresh_product_search
  after update of name on public.brands
  for each row execute function app_private.refresh_product_search_on_rename();

create trigger categories_refresh_product_search
  after update of name on public.categories
  for each row execute function app_private.refresh_product_search_on_rename();

-- Aggregates are system-maintained; client roles cannot forge ratings or sales counts.
create or replace function app_private.products_guard_aggregates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app_private.is_privileged() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.rating := 0;
    new.review_count := 0;
    new.sales_count := 0;
  else
    new.rating := old.rating;
    new.review_count := old.review_count;
    new.sales_count := old.sales_count;
  end if;
  return new;
end;
$$;

create trigger products_guard_aggregates
  before insert or update on public.products
  for each row execute function app_private.products_guard_aggregates();

-- ---------------------------------------------------------------------------
-- product_costs: staff-only commercial data
-- ---------------------------------------------------------------------------
-- RLS is row-level, so a cost_price column on products would be readable by anyone
-- who can read the product (every visitor). A separate table keeps margins private.
create table public.product_costs (
  product_id   uuid primary key,
  tenant_id    uuid not null,
  cost_price   numeric(12, 2) not null check (cost_price >= 0),
  supplier     text check (supplier is null or char_length(supplier) <= 200),
  updated_at   timestamptz not null default now(),
  constraint product_costs_product_fk foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete cascade
);

create index product_costs_tenant_idx on public.product_costs (tenant_id);

create trigger product_costs_set_updated_at
  before update on public.product_costs
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
create table public.product_images (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  product_id     uuid not null,
  image_url      text not null check (image_url ~ '^https://'),
  -- Storage object path when hosted in our bucket; used to delete the file with the row.
  storage_path   text,
  alt_text       text check (alt_text is null or char_length(alt_text) <= 200),
  is_primary     boolean not null default false,
  display_order  int not null default 0,
  created_at     timestamptz not null default now(),
  constraint product_images_product_fk foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete cascade
);

create index product_images_product_idx on public.product_images (product_id, display_order);
create unique index product_images_one_primary on public.product_images (product_id) where is_primary;

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  product_id     uuid not null,
  user_id        uuid references auth.users (id) on delete set null,
  customer_name  text not null check (char_length(customer_name) between 1 and 80),
  rating         smallint not null check (rating between 1 and 5),
  title          text check (title is null or char_length(title) <= 120),
  comment        text check (comment is null or char_length(comment) <= 2000),
  is_verified    boolean not null default false,
  is_approved    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint reviews_product_fk foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete cascade
);

create unique index reviews_one_per_user_product on public.reviews (product_id, user_id) where user_id is not null;
create index reviews_product_approved_idx on public.reviews (product_id, created_at desc) where is_approved;
create index reviews_tenant_approved_idx on public.reviews (tenant_id, created_at desc) where is_approved;
create index reviews_tenant_pending_idx on public.reviews (tenant_id, created_at desc) where not is_approved;

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function app_private.set_updated_at();

-- Customers cannot self-approve or self-verify. Verification is derived from a delivered order.
create or replace function app_private.reviews_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app_private.is_privileged() or app_private.has_tenant_role(new.tenant_id, 'manager') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.user_id := (select auth.uid());
    new.is_approved := false;
    new.is_verified := exists (
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.tenant_id = new.tenant_id
        and o.customer_id = new.user_id
        and o.order_status = 'delivered'
        and oi.product_id = new.product_id
    );
  else
    -- Authors may edit text/rating; edits send the review back to moderation.
    new.user_id := old.user_id;
    new.product_id := old.product_id;
    new.tenant_id := old.tenant_id;
    new.is_verified := old.is_verified;
    new.is_approved := false;
  end if;
  return new;
end;
$$;

create trigger reviews_guard
  before insert or update on public.reviews
  for each row execute function app_private.reviews_guard();

-- Rating aggregates only count approved reviews.
create or replace function app_private.refresh_product_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set rating = coalesce(s.avg_rating, 0),
      review_count = coalesce(s.cnt, 0)
  from (
    select round(avg(r.rating)::numeric, 2) as avg_rating, count(*)::int as cnt
    from public.reviews r
    where r.product_id = v_product and r.is_approved
  ) s
  where p.id = v_product;
  return null;
end;
$$;

create trigger reviews_refresh_product_rating
  after insert or delete or update of rating, is_approved on public.reviews
  for each row execute function app_private.refresh_product_rating();

-- ---------------------------------------------------------------------------
-- inventory_movements: append-only stock ledger
-- ---------------------------------------------------------------------------
create table public.inventory_movements (
  id               bigint generated always as identity primary key,
  tenant_id        uuid not null,
  product_id       uuid not null,
  quantity_change  int not null check (quantity_change <> 0),
  quantity_after   int not null check (quantity_after >= 0),
  reason           public.inventory_reason not null,
  order_id         uuid,
  note             text check (note is null or char_length(note) <= 500),
  created_by       uuid,
  created_at       timestamptz not null default now(),
  constraint inventory_movements_product_fk foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete cascade
);

create index inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);
create index inventory_movements_tenant_idx on public.inventory_movements (tenant_id, created_at desc);

-- Every stock change is logged, whatever path made it.
-- Callers that know the reason set (transaction-local) app.inventory_reason / app.inventory_order_id.
create or replace function app_private.log_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta int;
  v_reason public.inventory_reason;
begin
  if tg_op = 'INSERT' then
    v_delta := new.stock_quantity;
    v_reason := 'initial';
  else
    v_delta := new.stock_quantity - old.stock_quantity;
    v_reason := coalesce(nullif(current_setting('app.inventory_reason', true), ''), 'adjustment')::public.inventory_reason;
  end if;

  if v_delta <> 0 then
    insert into public.inventory_movements
      (tenant_id, product_id, quantity_change, quantity_after, reason, order_id, created_by)
    values
      (new.tenant_id, new.id, v_delta, new.stock_quantity, v_reason,
       nullif(current_setting('app.inventory_order_id', true), '')::uuid,
       (select auth.uid()));
  end if;
  return null;
end;
$$;

create trigger products_log_inventory
  after insert or update of stock_quantity on public.products
  for each row execute function app_private.log_inventory_movement();

grant execute on all functions in schema app_private to anon, authenticated, service_role;
