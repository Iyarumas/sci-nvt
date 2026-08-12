param(
  [string]$SupabaseDatabaseUrl = $env:SUPABASE_DATABASE_URL,
  [switch]$ReplaceLocalData
)

$ErrorActionPreference = "Stop"

function Invoke-DockerCompose {
  param([string[]]$ComposeArgs)

  & docker compose @ComposeArgs
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose $($ComposeArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Invoke-Docker {
  param([string[]]$DockerArgs)

  & docker @DockerArgs
  if ($LASTEXITCODE -ne 0) {
    throw "docker $($DockerArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $projectRoot

if ([string]::IsNullOrWhiteSpace($SupabaseDatabaseUrl)) {
  $envPath = Join-Path $projectRoot ".env"

  if (Test-Path $envPath) {
    foreach ($line in Get-Content $envPath) {
      $trimmedLine = $line.Trim()

      if ($trimmedLine.Length -eq 0 -or $trimmedLine.StartsWith("#")) {
        continue
      }

      if ($trimmedLine -match "^SUPABASE_DATABASE_URL\s*=\s*(.*)$") {
        $SupabaseDatabaseUrl = $Matches[1].Trim().Trim('"').Trim("'")
        break
      }
    }
  }
}

if ([string]::IsNullOrWhiteSpace($SupabaseDatabaseUrl)) {
  throw "Set SUPABASE_DATABASE_URL in .env, set it in the shell, or pass -SupabaseDatabaseUrl with the Supabase PostgreSQL connection string."
}

if (-not $ReplaceLocalData) {
  throw "This import replaces local table data. Re-run with -ReplaceLocalData after confirming this is intended."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $projectRoot "backend\database\backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$localBackupContainer = "/tmp/sescinc-local-before-supabase-import-$timestamp.sql"
$supabaseDumpContainer = "/tmp/supabase-public-data-$timestamp.sql"
$truncateSqlContainer = "/tmp/truncate-public-data-$timestamp.sql"
$sequenceSqlContainer = "/tmp/fix-public-sequences-$timestamp.sql"

$localBackupHost = Join-Path $backupDir "local-before-supabase-import-$timestamp.sql"
$supabaseDumpHost = Join-Path $backupDir "supabase-public-data-$timestamp.sql"
$truncateSqlHost = Join-Path $backupDir "truncate-public-data-$timestamp.sql"
$sequenceSqlHost = Join-Path $backupDir "fix-public-sequences-$timestamp.sql"

$truncateSql = @'
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
'@

$sequenceSql = @'
DO $$
DECLARE
  sequence_record record;
  max_id bigint;
BEGIN
  FOR sequence_record IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS sequence_name,
      t.relname AS table_name,
      a.attname AS column_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_depend d ON d.objid = c.oid AND d.deptype = 'a'
    JOIN pg_class t ON t.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
    WHERE c.relkind = 'S'
      AND n.nspname = 'public'
  LOOP
    EXECUTE format(
      'SELECT max(%I) FROM %I.%I',
      sequence_record.column_name,
      sequence_record.schema_name,
      sequence_record.table_name
    ) INTO max_id;

    IF max_id IS NOT NULL THEN
      EXECUTE format(
        'SELECT setval(%L, %s, true)',
        sequence_record.schema_name || '.' || sequence_record.sequence_name,
        max_id
      );
    END IF;
  END LOOP;
END $$;
'@

Set-Content -Path $truncateSqlHost -Value $truncateSql -Encoding UTF8
Set-Content -Path $sequenceSqlHost -Value $sequenceSql -Encoding UTF8

Write-Host "Starting local PostgreSQL container..."
Invoke-DockerCompose @("up", "-d", "postgres")
Invoke-DockerCompose @("exec", "-T", "postgres", "pg_isready", "-U", "sescinc", "-d", "sescinc")

Write-Host "Backing up current local data to $localBackupHost ..."
Invoke-DockerCompose @(
  "exec", "-T", "postgres", "sh", "-lc",
  "pg_dump -U sescinc -d sescinc --schema=public --data-only --column-inserts --no-owner --no-privileges --exclude-table-data=public.schema_migrations > $localBackupContainer"
)
Invoke-Docker @("cp", "sescinc-postgres:$localBackupContainer", $localBackupHost)

Write-Host "Exporting Supabase public data to $supabaseDumpHost ..."
$dumpCommand = 'pg_dump "$SUPABASE_DATABASE_URL" --schema=public --data-only --column-inserts --no-owner --no-privileges --exclude-table-data=public.schema_migrations > ' + $supabaseDumpContainer
Invoke-DockerCompose @(
  "exec", "-T", "-e", "SUPABASE_DATABASE_URL=$SupabaseDatabaseUrl",
  "postgres", "sh", "-lc", $dumpCommand
)
Invoke-Docker @("cp", "sescinc-postgres:$supabaseDumpContainer", $supabaseDumpHost)

Write-Host "Replacing local data with Supabase data..."
Invoke-Docker @("cp", $truncateSqlHost, "sescinc-postgres:$truncateSqlContainer")
Invoke-DockerCompose @(
  "exec", "-T", "postgres", "psql", "-U", "sescinc", "-d", "sescinc",
  "-v", "ON_ERROR_STOP=1", "-f", $truncateSqlContainer
)

Invoke-DockerCompose @(
  "exec", "-T", "postgres", "psql", "-U", "sescinc", "-d", "sescinc",
  "-v", "ON_ERROR_STOP=1", "-f", $supabaseDumpContainer
)

Write-Host "Fixing local sequences..."
Invoke-Docker @("cp", $sequenceSqlHost, "sescinc-postgres:$sequenceSqlContainer")
Invoke-DockerCompose @(
  "exec", "-T", "postgres", "psql", "-U", "sescinc", "-d", "sescinc",
  "-v", "ON_ERROR_STOP=1", "-f", $sequenceSqlContainer
)

Write-Host "Cleaning temporary files inside the container..."
Invoke-DockerCompose @(
  "exec", "-T", "postgres", "sh", "-lc",
  "rm -f $localBackupContainer $supabaseDumpContainer $truncateSqlContainer $sequenceSqlContainer"
)

Remove-Item -LiteralPath $truncateSqlHost, $sequenceSqlHost -Force

Write-Host ""
Write-Host "Supabase data import completed."
Write-Host "Local backup: $localBackupHost"
Write-Host "Supabase dump: $supabaseDumpHost"
