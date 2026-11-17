[CmdletBinding()]
param(
    [string]$BinaryPath = $env:CENTRIFUGO_BIN
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BinaryPath)) {
    $command = Get-Command centrifugo.exe -ErrorAction SilentlyContinue
    if (-not $command) {
        $command = Get-Command centrifugo -ErrorAction SilentlyContinue
    }

    if (-not $command) {
        throw "Centrifugo was not found. Download the Windows binary or set CENTRIFUGO_BIN to its full path."
    }

    $BinaryPath = $command.Source
}

$resolvedCommand = Get-Command $BinaryPath -ErrorAction SilentlyContinue
if ($resolvedCommand) {
    $BinaryPath = $resolvedCommand.Source
}
elseif (-not (Test-Path -LiteralPath $BinaryPath -PathType Leaf)) {
    throw "Centrifugo executable not found at: $BinaryPath"
}

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$configPath = Join-Path $repositoryRoot "infra\centrifugo\config.json"

if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "Centrifugo config not found at: $configPath"
}

Write-Host "Starting Moshpit Centrifugo using $configPath"
Write-Host "Keep this terminal open. Press Ctrl+C to stop Centrifugo."

Push-Location $repositoryRoot
try {
    & $BinaryPath "-c" $configPath
    if ($LASTEXITCODE -ne 0) {
        throw "Centrifugo exited with code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}
