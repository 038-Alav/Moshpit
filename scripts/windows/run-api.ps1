$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $root
try {
    Write-Host 'Starting Moshpit API...' -ForegroundColor Cyan
    & pnpm --filter @moshpit/api dev
    if ($LASTEXITCODE -ne 0) {
        throw "Moshpit API exited with code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}
