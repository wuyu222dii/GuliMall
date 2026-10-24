param(
    [ValidateSet('Check', 'Up', 'Down', 'Status', 'Build', 'Run', 'Smoke')]
    [string]$Action = 'Check',
    [ValidateSet('gulimall-product', 'gulimall-member', 'gulimall-coupon', 'gulimall-ware', 'gulimall-search', 'gulimall-order', 'gulimall-auth-server', 'gulimall-third-party', 'gulimall-gateway', 'renren-generator')]
    [string]$Module
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'env.ps1')
Push-Location $taskRoot
try {
    foreach ($taskKey in @('DB_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'REDIS_PASSWORD', 'RABBITMQ_PASSWORD', 'INTERNAL_API_TOKEN')) {
        $taskValue = [Environment]::GetEnvironmentVariable($taskKey, 'Process')
        if ([string]::IsNullOrWhiteSpace($taskValue) -or $taskValue -eq 'CHANGE_ME') { throw "Configure $taskKey in .env first." }
    }
    if ($Action -in @('Up', 'Down', 'Status', 'Check', 'Smoke')) {
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker CLI not found. Install and start Docker Desktop with Linux containers.' }
        & docker compose config --quiet
        if ($LASTEXITCODE -ne 0) { throw 'Compose configuration failed.' }
        if ($Action -eq 'Up') { & docker compose up -d --wait --wait-timeout 300 }
        elseif ($Action -eq 'Down') { & docker compose down }
        elseif ($Action -eq 'Status') { & docker compose ps }
        else { & docker info --format '{{.ServerVersion}}' }
        if ($LASTEXITCODE -ne 0) { throw 'Docker operation failed. Check Docker Desktop and service health.' }
    }
    if ($Action -in @('Build', 'Run', 'Check')) {
        if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/java.exe'))) { throw 'Set JAVA_HOME to a JDK 8 installation.' }
        $taskJavaVersion = & (Join-Path $env:JAVA_HOME 'bin/java.exe') -version 2>&1 | Out-String
        if ($taskJavaVersion -notmatch 'version "1\.8\.') { throw 'This baseline requires JDK 8.' }
        if (-not (Get-Command mvn -ErrorAction SilentlyContinue)) { throw 'Add Maven 3.6+ to PATH.' }
        if ($Action -eq 'Build') {
            & mvn -B '-Dfile.encoding=UTF-8' install
            if ($LASTEXITCODE -ne 0) { throw 'Backend build/tests failed.' }
            & npm ci --prefix gulimall-web --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
            & npm run build --prefix gulimall-web
            if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
        } elseif ($Action -eq 'Run') {
            if (-not $Module) { throw 'Run requires -Module.' }
            & mvn -f "$Module/pom.xml" spring-boot:run
            if ($LASTEXITCODE -ne 0) { throw 'Service exited with an error.' }
        } else {
            & mvn -version
            & node --version
            & npm --version
            if ($LASTEXITCODE -ne 0) { throw 'Node/npm is unavailable.' }
        }
    }
    if ($Action -eq 'Smoke') {
        $taskCatalog = Invoke-RestMethod 'http://127.0.0.1:88/api/product/category/list/tree' -TimeoutSec 15
        if ($taskCatalog.code -ne 0 -or -not ($taskCatalog.data | Where-Object catId -eq 900001)) { throw 'Gateway/category demo smoke check failed.' }
        $taskSku = Invoke-RestMethod 'http://127.0.0.1:88/api/product/skuinfo/info/900001' -TimeoutSec 15
        if ($taskSku.code -ne 0 -or $taskSku.skuInfo.price -ne 1999) { throw 'Demo SKU smoke check failed.' }
        Write-Output 'Gateway, product database and demo SKU checks passed.'
    }
} finally { Pop-Location }
