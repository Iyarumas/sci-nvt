param(
  [string]$OutputPath
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

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $projectRoot "backend\database\backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $backupDir "local-public-data-$timestamp.sql"
}

$resolvedOutput = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$containerPath = "/tmp/sescinc-local-public-data-$timestamp.sql"

Write-Host "Starting local PostgreSQL container..."
Invoke-DockerCompose @("up", "-d", "postgres")
Invoke-DockerCompose @("exec", "-T", "postgres", "pg_isready", "-U", "sescinc", "-d", "sescinc")

Write-Host "Exporting local public data to $resolvedOutput ..."
Invoke-DockerCompose @(
  "exec", "-T", "postgres", "sh", "-lc",
  "pg_dump -U sescinc -d sescinc --schema=public --data-only --column-inserts --no-owner --no-privileges --exclude-table-data=public.schema_migrations > $containerPath"
)
Invoke-Docker @("cp", "sescinc-postgres:$containerPath", $resolvedOutput)
Invoke-DockerCompose @("exec", "-T", "postgres", "rm", "-f", $containerPath)

Write-Host ""
Write-Host "Local data export completed."
Write-Host "Dump: $resolvedOutput"

