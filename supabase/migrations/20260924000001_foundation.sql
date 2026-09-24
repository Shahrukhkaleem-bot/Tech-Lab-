-- =============================================================================
-- 0001 FOUNDATION: extensions, private schema, enums, generic helpers
-- =============================================================================
-- `app_private` holds helper functions used by RLS policies and triggers.
-- It is NOT in PostgREST's exposed schemas, so nothing here is callable over the API.

create extension if not exists pg_trgm with schema extensions;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.tenant_status as enum ('pending', 'active', 'suspended', 'archived');

-- Ordered from most to least privileged; see app_private.role_rank().
create type public.member_role as enum ('owner', 'admin', 'manager', 'staff');

-- A single lifecycle column covers fulfilment + delivery (see docs/02-database.md).
create type public.order_status as enum (
  'pending',          -- placed, awaiting store confirmation (or online payment)
  'confirmed',        -- accepted by store
  'processing',       -- being packed
  'shipped',          -- handed to courier
  'out_for_delivery',
  'delivered',
  'cancelled',        -- terminal; stock restored by cancel_order()
  'returned'          -- terminal; stock restored by admin return flow
);

create type public.payment_status as enum (
  'pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled'
);

-- 'wallet' reserved for local gateways (e.g. JazzCash / Easypaisa).
create type public.payment_method as enum ('cod', 'bank_transfer', 'card', 'wallet');

create type public.inventory_reason as enum (
  'initial', 'sale', 'cancellation', 'return', 'restock', 'adjustment'
);

create type public.discount_type as enum ('percentage', 'fixed');

create type public.transaction_type as enum ('payment', 'refund');

create type public.transaction_status as enum ('pending', 'succeeded', 'failed', 'cancelled');

create type public.nav_location as enum (
  'header', 'footer_help', 'footer_policies', 'footer_company'
);

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True when the current statement runs as a trusted backend role
-- (service_role via PostgREST, postgres in migrations or SECURITY DEFINER functions).
-- ONLY meaningful in triggers / SECURITY INVOKER code: inside a SECURITY DEFINER function
-- current_user is the function owner, so this is always true there. Use
-- is_service_caller() to authorise the API caller of a SECURITY DEFINER function.
create or replace function app_private.is_privileged()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('postgres', 'service_role', 'supabase_admin');
$$;

-- The role of the API caller, unaffected by SECURITY DEFINER.
-- PostgREST switches roles with set_config('role', ...), so the `role` setting holds
-- anon / authenticated / service_role; a direct superuser session reports 'none'.
create or replace function app_private.is_service_caller()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('role', true), 'none'), session_user::text)
         in ('service_role', 'postgres', 'supabase_admin');
$$;

-- Hostname / slug validation shared by several tables.
create or replace function app_private.is_valid_slug(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(p) between 1 and 120;
$$;

grant execute on all functions in schema app_private to anon, authenticated, service_role;
