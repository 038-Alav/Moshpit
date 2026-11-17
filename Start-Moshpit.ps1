[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts\windows\common.ps1')
$root = (Resolve-Path $PSScriptRoot).Path
$envPath = Join-Path $root '.env'

function Stop-MoshpitStartup {
    param([string]$Message)
    throw $Message
}

Write-Host 'Moshpit — Windows development launcher' -ForegroundColor Cyan
Write-Host 'Native mode: no Docker, Podman, WSL2 or Hyper-V required.' -ForegroundColor DarkGray

if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
    Copy-Item -LiteralPath (Join-Path $root '.env.example') -Destination $envPath
    Write-Host 'Se creó .env a partir de .env.example.' -ForegroundColor Green
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    Stop-MoshpitStartup 'No se encontró Node.js. Instala Node.js 24 y vuelve a abrir PowerShell.'
}
$nodeVersionText = (& node -p 'process.versions.node' 2>&1 | Out-String).Trim()
try { $nodeVersion = [version]$nodeVersionText } catch { Stop-MoshpitStartup "No se pudo interpretar la versión de Node.js: $nodeVersionText" }
if ($nodeVersion.Major -ne 24) {
    Stop-MoshpitStartup "Moshpit está fijado a Node.js 24. Detectado: $nodeVersionText. Instala Node.js 24 y vuelve a abrir PowerShell."
}

$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCommand) {
    Stop-MoshpitStartup 'No se encontró pnpm. Instálalo con: npm install --global pnpm@10.34.9'
}
$pnpmVersion = (& pnpm --version 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $pnpmVersion -ne '10.34.9') {
    Stop-MoshpitStartup "Este proyecto requiere pnpm 10.34.9. Detectado: $pnpmVersion. Ejecuta: npm install --global pnpm@10.34.9"
}
Write-Host "Node.js $nodeVersionText | pnpm $pnpmVersion" -ForegroundColor Green

# Validate the local PostgreSQL service with the restricted application account.
$psql = Get-MoshpitPsqlPath
$databaseUrl = Get-MoshpitDotEnvValue -Path $envPath -Name 'DATABASE_URL'
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    Stop-MoshpitStartup 'DATABASE_URL no está definido en .env.'
}
$databaseSettings = Get-MoshpitDatabaseSettings -DatabaseUrl $databaseUrl
$env:PGPASSWORD = $databaseSettings.Password
try {
    $databaseCheck = & $psql -X -v ON_ERROR_STOP=1 -h $databaseSettings.Host -p $databaseSettings.Port -U $databaseSettings.Username -d $databaseSettings.Database -tA -c 'SELECT 1;' 2>&1
    if ($LASTEXITCODE -ne 0 -or (($databaseCheck | Out-String).Trim() -ne '1')) {
        Write-Host ''
        Write-Host 'No se pudo validar la base de datos Moshpit.' -ForegroundColor Yellow
        Write-Host 'Asegúrate de que PostgreSQL esté iniciado y ejecuta primero:' -ForegroundColor Yellow
        Write-Host '  .\scripts\windows\Setup-Database.ps1' -ForegroundColor White
        Stop-MoshpitStartup (($databaseCheck | Out-String).Trim())
    }
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $databaseSettings.Password = $null
}

# Resolve and validate the Centrifugo executable before opening any process windows.
$centrifugoBin = Get-MoshpitDotEnvValue -Path $envPath -Name 'CENTRIFUGO_BIN'
if ([string]::IsNullOrWhiteSpace($centrifugoBin)) { $centrifugoBin = $env:CENTRIFUGO_BIN }
if ([string]::IsNullOrWhiteSpace($centrifugoBin)) {
    $centrifugoCommand = Get-Command centrifugo.exe -ErrorAction SilentlyContinue
    if (-not $centrifugoCommand) { $centrifugoCommand = Get-Command centrifugo -ErrorAction SilentlyContinue }
    if ($centrifugoCommand) { $centrifugoBin = $centrifugoCommand.Source }
}
if ([string]::IsNullOrWhiteSpace($centrifugoBin) -or -not (Test-Path -LiteralPath $centrifugoBin -PathType Leaf)) {
    Stop-MoshpitStartup 'No se encontró centrifugo.exe. Agrega su carpeta al PATH o configura CENTRIFUGO_BIN en .env con la ruta completa al ejecutable.'
}
$env:CENTRIFUGO_BIN = $centrifugoBin

$configPath = Join-Path $root 'infra\centrifugo\config.json'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$apiKey = Get-MoshpitDotEnvValue -Path $envPath -Name 'CENTRIFUGO_API_KEY'
$tokenSecret = Get-MoshpitDotEnvValue -Path $envPath -Name 'CENTRIFUGO_TOKEN_HMAC_SECRET_KEY'
if ($apiKey -and $config.http_api.key -ne $apiKey) {
    Stop-MoshpitStartup 'CENTRIFUGO_API_KEY en .env no coincide con http_api.key en infra/centrifugo/config.json.'
}
if ($tokenSecret -and $config.client.token.hmac_secret_key -ne $tokenSecret) {
    Stop-MoshpitStartup 'CENTRIFUGO_TOKEN_HMAC_SECRET_KEY en .env no coincide con client.token.hmac_secret_key en infra/centrifugo/config.json.'
}

foreach ($port in @(3000, 5173, 8000)) {
    if (-not (Test-MoshpitPortAvailable -Port $port)) {
        $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        Stop-MoshpitStartup "El puerto $port ya está ocupado (PID $($listener.OwningProcess)). Cierra el proceso que lo utiliza y vuelve a intentarlo."
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $root 'node_modules'))) {
    Write-Host 'Instalando dependencias del monorepo (primera ejecución)...' -ForegroundColor Cyan
    Push-Location $root
    try {
        & pnpm install
        if ($LASTEXITCODE -ne 0) { Stop-MoshpitStartup 'Falló pnpm install.' }
    }
    finally { Pop-Location }
}

$currentShell = (Get-Process -Id $PID).Path
if (-not $currentShell) { $currentShell = (Get-Command powershell.exe).Source }
$centrifugoRunner = Join-Path $root 'scripts\windows\start-centrifugo.ps1'
$apiRunner = Join-Path $root 'scripts\windows\run-api.ps1'
$webRunner = Join-Path $root 'scripts\windows\run-web.ps1'

Write-Host 'Iniciando Centrifugo...' -ForegroundColor Cyan
Start-Process -FilePath $currentShell -ArgumentList "-NoExit -ExecutionPolicy Bypass -File `"$centrifugoRunner`"" -WorkingDirectory $root

$centrifugoReady = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (-not (Test-MoshpitPortAvailable -Port 8000)) {
        $centrifugoReady = $true
        break
    }
}
if (-not $centrifugoReady) {
    Stop-MoshpitStartup 'Centrifugo no abrió el puerto 8000. Revisa la ventana de Centrifugo y su configuración.'
}

Start-Process -FilePath $currentShell -ArgumentList "-NoExit -ExecutionPolicy Bypass -File `"$apiRunner`"" -WorkingDirectory $root
Start-Sleep -Seconds 2
Start-Process -FilePath $currentShell -ArgumentList "-NoExit -ExecutionPolicy Bypass -File `"$webRunner`"" -WorkingDirectory $root

Write-Host ''
Write-Host 'Moshpit se está iniciando en tres ventanas de PowerShell.' -ForegroundColor Green
Write-Host 'Web:               http://localhost:5173'
Write-Host 'API health:        http://localhost:3000/api/health'
Write-Host 'API readiness:     http://localhost:3000/api/ready'
Write-Host 'Centrifugo WebSocket: ws://localhost:8000/connection/websocket'
Write-Host ''
Write-Host 'Para detener cada proceso, usa Ctrl+C en su ventana. PostgreSQL permanece activo como servicio de Windows.'
