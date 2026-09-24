#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Database test runner.
#
#   Plain Postgres (fast, no Docker):
#     PGHOST=localhost PGPORT=5432 PGUSER=postgres ./scripts/test-db.sh
#     -> creates a throwaway database, loads Supabase stubs, migrations, seed, tests.
#
#   Real Supabase stack (CI):
#     supabase start && TARGET=supabase ./scripts/test-db.sh
#     -> runs the tests against the local Supabase database (migrations + seed
#        already applied by `supabase start` / `supabase db reset`).
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${TARGET:-plain}"
PSQL_OPTS=(-v ON_ERROR_STOP=1 -q -X)

if [[ "$TARGET" == "supabase" ]]; then
  export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-54322}" PGUSER="${PGUSER:-postgres}" PGPASSWORD="${PGPASSWORD:-postgres}"
  DB="postgres"
else
  DB="commerce_test_$$"
  export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}"
  trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT
  createdb "$DB"
  echo "▶ bootstrap stubs"
  psql "${PSQL_OPTS[@]}" -d "$DB" -f "$ROOT/supabase/tests/bootstrap/supabase_stubs.sql"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "▶ migrate $(basename "$f")"
    psql "${PSQL_OPTS[@]}" -d "$DB" -f "$f"
  done
  echo "▶ seed"
  psql "${PSQL_OPTS[@]}" -d "$DB" -f "$ROOT/supabase/seed.sql"
fi

status=0
for t in "$ROOT"/supabase/tests/*.test.sql; do
  echo "▶ test $(basename "$t")"
  if ! psql "${PSQL_OPTS[@]}" -d "$DB" -f "$t"; then
    status=1
  fi
done

echo "▶ test concurrency.sh"
if ! DB="$DB" bash "$ROOT/supabase/tests/concurrency.sh"; then
  status=1
fi

if [[ $status -eq 0 ]]; then echo "✔ all database tests passed"; else echo "✖ database tests failed"; fi
exit $status
