# Database migrations

This folder contains the SQL migrations that came from the original Supabase setup, plus `000_postgres_compat.sql` for plain PostgreSQL compatibility.

Run them against the Docker database with:

```bash
npm run db:migrate --workspace backend
```

The runner stores applied files in `schema_migrations`. Some old migrations contain duplicate permissive RLS policy creation; known idempotency conflicts are tolerated so the full history can be replayed on a local PostgreSQL container.
