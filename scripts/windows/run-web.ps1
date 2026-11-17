$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $root
try {
    Write-Host 'Starting Moshpit web client...' -ForegroundColor Cyan
    & pnpm --filter @moshpit/web dev
    if ($LASTEXITCODE -ne 0) {
        throw "Moshpit web client exited with code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}
