#!/usr/bin/env sh
set -eu

dump_file="${1:-}"

if [ -z "$dump_file" ] || [ ! -f "$dump_file" ]; then
  echo "Usage: sh deploy/restore-data.sh path/to/dump.sql" >&2
  exit 1
fi

if [ ! -f ".env.production" ]; then
  echo ".env.production not found. Create it from .env.production.example first." >&2
  exit 1
fi

set -a
. ./.env.production
set +a

compose() {
  docker compose --env-file .env.production -f docker-compose.prod.yml "$@"
}

compose up -d postgres
compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "Clearing current production table data..."
compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'schema_migrations'
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', table_record.tablename);
  END LOOP;
END $$;
SQL

echo "Restoring data from $dump_file ..."
cat "$dump_file" | compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1

echo "Data restore completed."

