param(
  [int]$Port = 5173
)

$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location $projectRoot
$env:WRANGLER_LOG_PATH = Join-Path $projectRoot ".wrangler\wrangler.log"
$env:XDG_CONFIG_HOME = Join-Path $projectRoot ".sites-runtime\xdg"

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  throw "Node.js is not installed. Install Node.js 22.13 or newer and run this script again."
}

$nodeVersion = [Version]((& node.exe --version).Trim().TrimStart("v"))
if ($nodeVersion -lt [Version]"22.13.0") {
  throw "Node.js 22.13 or newer is required. Installed version: $nodeVersion"
}

$installedLock = Join-Path $projectRoot "node_modules\.package-lock.json"
$sourceLock = Join-Path $projectRoot "package-lock.json"
$needsInstall = -not (Test-Path $installedLock)
if (-not $needsInstall) {
  $needsInstall = (Get-Item $sourceLock).LastWriteTimeUtc -gt (Get-Item $installedLock).LastWriteTimeUtc
}

if ($needsInstall) {
  Write-Host "Installing project dependencies..." -ForegroundColor Cyan
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
}

$devVarsPath = Join-Path $projectRoot ".dev.vars"
if (-not (Test-Path $devVarsPath)) {
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $passwordBytes = New-Object byte[] 12
    $secretBytes = New-Object byte[] 32
    $rng.GetBytes($passwordBytes)
    $rng.GetBytes($secretBytes)
  } finally {
    $rng.Dispose()
  }
  $adminPassword = ([Convert]::ToBase64String($passwordBytes)).TrimEnd("=").Replace("+", "x").Replace("/", "y")
  $sessionSecret = ([BitConverter]::ToString($secretBytes)).Replace("-", "").ToLowerInvariant()
  $devVars = "ADMIN_USERNAME=admin`nADMIN_PASSWORD=$adminPassword`nADMIN_SESSION_SECRET=$sessionSecret`n"
  [System.IO.File]::WriteAllText($devVarsPath, $devVars, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "Created local administrator credentials:" -ForegroundColor Green
  Write-Host "  Login: admin"
  Write-Host "  Password: $adminPassword"
  Write-Host "They are stored in .dev.vars."
}

Write-Host "Checking local database migrations..." -ForegroundColor Cyan
$schemaQuery = @"
SELECT
  (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('preorders', 'catalog_products', 'catalog_settings', 'admin_audit_events', 'suppliers')) AS core_table_count,
  (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations') AS migration_table_count;
"@
$schemaOutput = & node.exe "node_modules\wrangler\bin\wrangler.js" d1 execute DB --local --config wrangler.local.jsonc --persist-to .wrangler\state --command $schemaQuery --json
if ($LASTEXITCODE -ne 0) { throw "Could not inspect the local database." }
$schemaState = (($schemaOutput -join "`n") | ConvertFrom-Json)[0].results[0]

if ($schemaState.core_table_count -eq 5 -and $schemaState.migration_table_count -eq 0) {
  Write-Host "Registering migrations from an existing local database..." -ForegroundColor Cyan
  $registerMigrations = @"
CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL);
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0000_little_scourge.sql'), ('0001_amused_khan.sql'), ('0002_nice_stark_industries.sql'), ('0003_redundant_grey_gargoyle.sql'), ('0004_dark_daredevil.sql');
"@
  & node.exe "node_modules\wrangler\bin\wrangler.js" d1 execute DB --local --config wrangler.local.jsonc --persist-to .wrangler\state --command $registerMigrations
  if ($LASTEXITCODE -ne 0) { throw "Could not register existing local migrations." }
} elseif ($schemaState.core_table_count -gt 0 -and $schemaState.migration_table_count -eq 0) {
  throw "The local database contains only part of the expected schema. Back it up and recreate .wrangler\state."
}

& node.exe "node_modules\wrangler\bin\wrangler.js" d1 migrations apply DB --local --config wrangler.local.jsonc --persist-to .wrangler\state
if ($LASTEXITCODE -ne 0) { throw "Local database migration failed." }

Write-Host "Starting Food Preorder at http://127.0.0.1:$Port/" -ForegroundColor Green
& node.exe "node_modules\vite\bin\vite.js" --host 127.0.0.1 --port $Port
if ($LASTEXITCODE -ne 0) { throw "Development server stopped with an error." }
