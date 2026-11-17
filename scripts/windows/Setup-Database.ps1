[CmdletBinding()]
param(
    [string]$HostName,
    [int]$Port,
    [string]$AdminUser = 'postgres'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$envPath = Join-Path $root '.env'
$exampleEnvPath = Join-Path $root '.env.example'
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
    if (-not (Test-Path -LiteralPath $exampleEnvPath -PathType Leaf)) {
        throw 'No se encontró .env.example. No se puede crear la configuración local.'
    }
    Copy-Item -LiteralPath $exampleEnvPath -Destination $envPath
    Write-Host 'Se creó .env a partir de .env.example.' -ForegroundColor Green
}

$databaseUrl = Get-MoshpitDotEnvValue -Path $envPath -Name 'DATABASE_URL'
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    throw 'DATABASE_URL no está definido en .env.'
}
$databaseSettings = Get-MoshpitDatabaseSettings -DatabaseUrl $databaseUrl
if ([string]::IsNullOrWhiteSpace($HostName)) { $HostName = $databaseSettings.Host }
if (-not $Port) { $Port = $databaseSettings.Port }
$psql = Get-MoshpitPsqlPath
$psqlVersion = (& $psql --version 2>&1 | Out-String).Trim()

Write-Host "Herramienta PostgreSQL: $psql" -ForegroundColor Cyan
Write-Host "Cliente: $psqlVersion"
Write-Host "Servidor: ${HostName}:$Port | Base: $($databaseSettings.Database) | Rol de aplicación: $($databaseSettings.Username)"
Write-Host 'La contraseña del administrador se solicitará de forma segura y no se guardará.'

$secureAdminPassword = Read-Host "Contraseña del usuario PostgreSQL '$AdminUser'" -AsSecureString
$adminPassword = ConvertFrom-MoshpitSecureString -SecureValue $secureAdminPassword
$env:PGPASSWORD = $adminPassword

function Invoke-MoshpitAdminPsql {
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseName,
        [Parameter(Mandatory = $true)][string]$Sql
    )

    $result = & $psql -X -v ON_ERROR_STOP=1 -h $HostName -p $Port -U $AdminUser -d $DatabaseName -tA -c $Sql 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Falló la consulta PostgreSQL en '$DatabaseName':`n$($result | Out-String)"
    }
    return (($result | Out-String).Trim())
}

try {
    $connectionTest = Invoke-MoshpitAdminPsql -DatabaseName 'postgres' -Sql 'SELECT 1;'
    if ($connectionTest -ne '1') {
        throw 'No se pudo validar la conexión con PostgreSQL.'
    }

    $roleIdentifier = ConvertTo-MoshpitSqlIdentifier -Value $databaseSettings.Username
    $roleLiteral = ConvertTo-MoshpitSqlLiteral -Value $databaseSettings.Username
    $passwordLiteral = ConvertTo-MoshpitSqlLiteral -Value $databaseSettings.Password
    $databaseIdentifier = ConvertTo-MoshpitSqlIdentifier -Value $databaseSettings.Database
    $databaseLiteral = ConvertTo-MoshpitSqlLiteral -Value $databaseSettings.Database

    $roleExists = Invoke-MoshpitAdminPsql -DatabaseName 'postgres' -Sql "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $roleLiteral) THEN 'true' ELSE 'false' END;"
    if ($roleExists -eq 'true') {
        Write-Host "Actualizando permisos y contraseña del rol '$($databaseSettings.Username)'..." -ForegroundColor Cyan
        [void](Invoke-MoshpitAdminPsql -DatabaseName 'postgres' -Sql "ALTER ROLE $roleIdentifier WITH LOGIN PASSWORD $passwordLiteral NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;")
    }
    else {
        Write-Host "Creando rol '$($databaseSettings.Username)'..." -ForegroundColor Cyan
        [void](Invoke-MoshpitAdminPsql -DatabaseName 'postgres' -Sql "CREATE ROLE $roleIdentifier WITH LOGIN PASSWORD $passwordLiteral NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;")
    }

    $databaseExists = Invoke-MoshpitAdminPsql -DatabaseName 'postgres' -Sql "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_database WHERE datname = $databaseLiteral) THEN 'true' ELSE 'false' END;"
    if ($databaseExists -ne 'true') {
        Write-Host "Creando base de datos '$($databaseSettings.Database)'..." -ForegroundColor Cyan
        [void](Invoke-MoshpitAdminPsql -DatabaseName 'postgres' -Sql "CREATE DATABASE $databaseIdentifier OWNER $roleIdentifier;")
    }
    else {
        Write-Host "La base '$($databaseSettings.Database)' ya existe; se conservarán sus datos." -ForegroundColor Green
        [void](Invoke-MoshpitAdminPsql -DatabaseName 'postgres' -Sql "ALTER DATABASE $databaseIdentifier OWNER TO $roleIdentifier;")
    }

    # Verify using the restricted application role, not the postgres administrator.
    $env:PGPASSWORD = $databaseSettings.Password
    $verification = & $psql -X -v ON_ERROR_STOP=1 -h $HostName -p $Port -U $databaseSettings.Username -d $databaseSettings.Database -tA -c "SELECT current_user || ':' || current_database();" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "La base y el rol se crearon, pero no se pudo verificar el acceso de la API:`n$($verification | Out-String)"
    }

    Write-Host ''
    Write-Host 'Base de datos Moshpit preparada correctamente.' -ForegroundColor Green
    Write-Host "Conexión validada: $(($verification | Out-String).Trim())"
    Write-Host 'Las migraciones del dominio se aplican automáticamente al iniciar la API.'
    Write-Host 'La contraseña del administrador no se guardó en archivos del proyecto.'
}
catch {
    Write-Host ''
    Write-Host 'No se pudo preparar PostgreSQL.' -ForegroundColor Yellow
    Write-Host 'Comprueba que el servicio PostgreSQL esté iniciado (services.msc), que el puerto sea correcto y que la contraseña de postgres sea válida.' -ForegroundColor Yellow
    throw $_
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $adminPassword = $null
    $secureAdminPassword = $null
    $databaseSettings.Password = $null
    $passwordLiteral = $null
}
