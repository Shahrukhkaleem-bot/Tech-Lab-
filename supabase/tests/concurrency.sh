#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Race-condition test: two sessions try to buy the LAST unit at the same time.
# Exactly one must succeed; the other must fail with INSUFFICIENT_STOCK;
# stock must end at 0 (never negative, never oversold).
# Usage: DB=<database> ./supabase/tests/concurrency.sh   (PG* env vars as for psql)
# -----------------------------------------------------------------------------
set -euo pipefail
DB="${DB:?set DB}"
Q=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -tA)

"${Q[@]}" -c "update public.products set stock_quantity = 1 where slug = 'arcwave-studio-h1';" >/dev/null
PID=$("${Q[@]}" -c "select id from public.products where slug = 'arcwave-studio-h1'")

buy() {
  # Session holds its locks for 1s before committing, forcing real overlap.
  psql -X -q -d "$DB" -tA 2>&1 <<SQL
set role service_role;
begin;
select case when (public.place_order('11111111-1111-4111-8111-111111111111',
  '[{"product_id":"$PID","quantity":1}]'::jsonb,
  '{"name":"Racer $1","email":"racer$1@test.local","phone":"03000000000","address":"Race street 1","city":"Lahore"}'::jsonb,
  'cod', 0, null, gen_random_uuid(), null, null) ->> 'order_id') is not null then 'OK' end;
select pg_sleep(1);
commit;
SQL
}

buy 1 > /tmp/race1.$$ & p1=$!
buy 2 > /tmp/race2.$$ & p2=$!
wait $p1 $p2 || true

ok=$(cat /tmp/race1.$$ /tmp/race2.$$ | grep -c '^OK$' || true)
oversold=$(cat /tmp/race1.$$ /tmp/race2.$$ | grep -c 'ERROR: *INSUFFICIENT_STOCK' || true)
stock=$("${Q[@]}" -c "select stock_quantity from public.products where id = '$PID'")
rm -f /tmp/race1.$$ /tmp/race2.$$

# Clean up the winning order so the DB stays reusable.
"${Q[@]}" -c "set role service_role; select public.cancel_order(id, 'race test cleanup') from public.orders where customer_email like 'racer%@test.local' and order_status = 'pending';" >/dev/null

if [[ "$ok" == "1" && "$oversold" == "1" && "$stock" == "0" ]]; then
  echo "  ✔ concurrency: 1 winner, 1 rejected, stock never negative"
else
  echo "  ✖ concurrency: winners=$ok rejected=$oversold stock=$stock"
  exit 1
fi
