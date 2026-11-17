function Get-MoshpitPsqlPath {
    $command = Get-Command psql.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $command) {
        $command = Get-Command psql -ErrorAction SilentlyContinue | Select-Object -First 1
    }
    if ($command) {
        return $command.Source
    }

    $candidatePaths = @()
    if ($env:ProgramFiles) {
        $postgresRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
        if (Test-Path -LiteralPath $postgresRoot) {
            $installations = Get-ChildItem -LiteralPath $postgresRoot -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '^\d+' } |
                Sort-Object { [int]($_.Name -replace '^(\d+).*$', '$1') } -Descending
            foreach ($installation in $installations) {
                $candidatePaths += Join-Path $installation.FullName 'bin\psql.exe'
            }
        }
    }

    $candidatePaths += @(
        'C:\Program Files\PostgreSQL\17\bin\psql.exe',
        'C:\Program Files\PostgreSQL\16\bin\psql.exe'
    )

    foreach ($candidate in ($candidatePaths | Select-Object -Unique)) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return $candidate
        }
    }

    throw 'No se encontró psql.exe. Instala PostgreSQL para Windows o agrega su carpeta bin al PATH.'
}

function Get-MoshpitDotEnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "No se encontró el archivo de configuración: $Path"
    }

    $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } | Select-Object -First 1
    if (-not $line) {
        return $null
    }

    $value = ($line -replace "^\s*$([regex]::Escape($Name))\s*=", '').Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    return $value
}

function Get-MoshpitDatabaseSettings {
    param([Parameter(Mandatory = $true)][string]$DatabaseUrl)

    try {
        $uri = [Uri]$DatabaseUrl
    }
    catch {
        throw 'DATABASE_URL no es una URL PostgreSQL válida. Revisa el archivo .env.'
    }

    if ($uri.Scheme -notin @('postgres', 'postgresql')) {
        throw 'DATABASE_URL debe utilizar el esquema postgres:// o postgresql://.'
    }

    $userInfo = $uri.UserInfo -split ':', 2
    if ($userInfo.Count -ne 2) {
        throw 'DATABASE_URL debe incluir usuario y contraseña.'
    }

    $username = [Uri]::UnescapeDataString($userInfo[0])
    $password = [Uri]::UnescapeDataString($userInfo[1])
    $database = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))

    foreach ($identifier in @($username, $database)) {
        if ($identifier -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
            throw 'El usuario y la base indicados en DATABASE_URL deben usar solo letras, números y guion bajo, y no comenzar con un número.'
        }
    }

    if ([string]::IsNullOrWhiteSpace($password)) {
        throw 'DATABASE_URL no contiene una contraseña.'
    }

    $resolvedHost = $uri.Host
    if ([string]::IsNullOrWhiteSpace($resolvedHost)) { $resolvedHost = '127.0.0.1' }
    $resolvedPort = $uri.Port
    if ($resolvedPort -le 0) { $resolvedPort = 5432 }

    return [pscustomobject]@{
        Host = $resolvedHost
        Port = $resolvedPort
        Username = $username
        Password = $password
        Database = $database
    }
}

function ConvertTo-MoshpitSqlLiteral {
    param([Parameter(Mandatory = $true)][string]$Value)
    return "'" + $Value.Replace("'", "''") + "'"
}

function ConvertTo-MoshpitSqlIdentifier {
    param([Parameter(Mandatory = $true)][string]$Value)
    if ($Value -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
        throw "Identificador PostgreSQL no permitido: $Value"
    }
    return '"' + $Value.Replace('"', '""') + '"'
}

function ConvertFrom-MoshpitSecureString {
    param([Parameter(Mandatory = $true)][System.Security.SecureString]$SecureValue)
    $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Test-MoshpitPortAvailable {
    param([Parameter(Mandatory = $true)][int]$Port)
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    return ($null -eq $listener)
}
