param([ValidateSet('Build','Environment','Simulation')][string]$Mode='Build',[switch]$Json)
$ErrorActionPreference='Stop'
$preflightRoot=Split-Path $PSScriptRoot -Parent
$preflightOriginal=@{};Get-ChildItem Env:|ForEach-Object {$preflightOriginal[$_.Name]=$_.Value}
$preflightChecks=New-Object Collections.Generic.List[object]
function Preflight-Check([string]$Name,[bool]$Ready,[string]$Detail){$preflightChecks.Add([pscustomobject]@{name=$Name;ready=$Ready;detail=$Detail})}
function Preflight-Version([string]$Command,[string[]]$Arguments){$ErrorActionPreference='Continue';$result=& $Command @Arguments 2>&1|ForEach-Object {$_.ToString()}|Out-String;if($LASTEXITCODE -ne 0){throw 'Version command failed'};return $result.Trim()}
Push-Location $preflightRoot
try {
    try {
        . "$PSScriptRoot/env.ps1"
        foreach($key in @('DB_PASSWORD','MYSQL_ROOT_PASSWORD','REDIS_PASSWORD','RABBITMQ_PASSWORD','INTERNAL_API_TOKEN')){if([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($key,'Process')) -or [Environment]::GetEnvironmentVariable($key,'Process') -eq 'CHANGE_ME'){throw 'Required local secret is missing'}}
        Preflight-Check 'configuration' $true '.env syntax and required local secrets are valid; values are hidden'
    } catch {Preflight-Check 'configuration' $false 'Run setup.ps1; check .env syntax, duplicate keys and required secret fields; values are hidden'}
    try {
        if(-not $env:JAVA_HOME -or -not(Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/javac.exe'))){throw 'Missing JDK'}
        $version=Preflight-Version (Join-Path $env:JAVA_HOME 'bin/java.exe') @('-version')
        if($version -notmatch 'version "(1\.8\.[^"]+)"'){throw 'Wrong Java'}
        Preflight-Check 'JDK' $true $Matches[1]
    } catch {Preflight-Check 'JDK' $false 'Install JDK 8 and set JAVA_HOME to its directory (javac is required)'}
    foreach($tool in @('mvn','node','npm')){
        try {
            $command=Get-Command $tool -ErrorAction Stop
            $version=Preflight-Version $command.Source @('--version')
            $pattern=if($tool -eq 'mvn'){'Apache Maven (\d+\.\d+\.\d+)'}else{'v?(\d+\.\d+\.\d+)'}
            if($version -notmatch $pattern){throw 'Unknown version'}
            $number=[version]$Matches[1]
            if(($tool -eq 'mvn' -and ($number -lt [version]'3.6.0' -or $number.Major -ne 3)) -or ($tool -eq 'node' -and $number -lt [version]'20.19.0') -or ($tool -eq 'npm' -and $number.Major -lt 9)){throw 'Unsupported version'}
            if($tool -eq 'mvn' -and $version -notmatch 'Java version: 1\.8\.'){throw 'Maven uses wrong Java'}
            Preflight-Check $tool $true $number.ToString()
        } catch {Preflight-Check $tool $false 'Add Maven 3.6+ (3.x, JDK 8), Node 20.19+ and npm 9+ to PATH'}
    }
    if($Mode -ne 'Build'){
        $local=$true
        foreach($key in @('DB_HOST','REDIS_HOST','RABBITMQ_HOST')){if([Environment]::GetEnvironmentVariable($key,'Process') -ne '127.0.0.1'){$local=$false}}
        if($env:DB_PORT -ne '3307' -or $env:REDIS_PORT -ne '6380' -or $env:RABBITMQ_PORT -ne '5673' -or $env:NACOS_ADDR -ne '127.0.0.1:18848' -or $env:ELASTICSEARCH_URL -ne 'http://127.0.0.1:19200' -or $env:PRODUCT_PORT -ne '10001'){$local=$false}
        foreach($key in @('SPRING_APPLICATION_JSON','SPRING_CONFIG_LOCATION','SPRING_CONFIG_ADDITIONAL_LOCATION','SPRING_DATASOURCE_URL','JAVA_TOOL_OPTIONS','JDK_JAVA_OPTIONS','_JAVA_OPTIONS')){if([Environment]::GetEnvironmentVariable($key,'Process')){$local=$false}}
        if($env:GULIMALL_TEST -eq '1' -or ($env:AUTH_SMS_MODE -and $env:AUTH_SMS_MODE -ne 'development') -or ($env:OSS_ENABLED -and $env:OSS_ENABLED -ne 'false') -or ($env:SMS_ENABLED -and $env:SMS_ENABLED -ne 'false') -or ($env:NACOS_CONFIG_ENABLED -and $env:NACOS_CONFIG_ENABLED -ne 'false') -or ($env:IMAGE_STORAGE -and $env:IMAGE_STORAGE -ne 'local')){$local=$false}
        Preflight-Check 'local-mode' $local 'Use documented loopback ports, development SMS, disabled cloud/config-center and no external Java/Spring overrides'
        if($Mode -eq 'Simulation'){
        $admin=$env:ADMIN_USER -and $env:ADMIN_PASSWORD_HASH -match '^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$'
        Preflight-Check 'administrator' ([bool]$admin) 'Configure ADMIN_USER and a BCrypt ADMIN_PASSWORD_HASH with the interactive password tool; never put plaintext in .env'
        $built=Test-Path -LiteralPath 'gulimall-web/dist/index.html'
        foreach($module in @('product','member','coupon','ware','order','search','auth-server','third-party','cart','gateway')){if(-not(Test-Path -LiteralPath "gulimall-$module/target/gulimall-$module-0.0.1-SNAPSHOT.jar")){$built=$false}}
        Preflight-Check 'build-artifacts' $built 'Run dev.ps1 Build before starting; ten jars and frontend dist are required'
        }
        try {
            $engine=Preflight-Version (Get-Command docker -ErrorAction Stop).Source @('info','--format','{{.OSType}}')
            if($engine -ne 'linux'){throw 'Linux engine unavailable'}
            $compose=Preflight-Version (Get-Command docker).Source @('compose','version','--short')
            if($compose -notmatch '^v?(\d+)' -or [int]$Matches[1] -lt 2){throw 'Old Compose'}
            $null=Preflight-Version (Get-Command docker).Source @('compose','-f',(Join-Path $preflightRoot 'compose.yaml'),'config','--quiet')
            Preflight-Check 'Docker' $true ('Linux engine; Compose '+$compose)
        } catch {Preflight-Check 'Docker' $false 'Start Docker Desktop Linux engine with Compose v2+, then check compose.yaml; no resources were changed'}
        if($Mode -eq 'Simulation'){
        $marker='-Dgulimall.workspace='+$preflightRoot.Replace('\','/')
        foreach($port in @(88,8080,18170,10001,8000,7001,11000,9000,12000,20000,30000,18000)){
            $owned=$true
            foreach($listener in @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)){
                $owner=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
                if(-not $owner.CommandLine -or -not (($owner.Name -eq 'java.exe' -and $owner.CommandLine.Contains($marker) -and $owner.CommandLine.Contains($preflightRoot+'\gulimall-')) -or ($owner.Name -eq 'node.exe' -and (($port -eq 8080 -and $owner.CommandLine.Contains((Join-Path $PSScriptRoot 'serve-demo.mjs'))) -or ($port -eq 18170 -and $owner.CommandLine.Contains((Join-Path $PSScriptRoot 'payment-test-gateway.mjs')) -and $owner.CommandLine.Contains('--simulation')))))){$owned=$false}
            }
            Preflight-Check ('port-'+$port) $owned 'Free or owned by this workspace; unknown owners are never stopped'
        }
        }
    }
    $report=[pscustomobject]@{mode=$Mode;ready=@($preflightChecks|Where-Object {-not $_.ready}).Count -eq 0;checks=@($preflightChecks.ToArray())}
    if($Json){$report|ConvertTo-Json -Depth 5}else{foreach($check in $preflightChecks){$label=if($check.ready){'PASS'}else{'FAIL'};Write-Output ($label+' '+$check.name+': '+$check.detail)}}
} finally {
    Get-ChildItem Env:|Where-Object {-not $preflightOriginal.ContainsKey($_.Name)}|ForEach-Object {Remove-Item -LiteralPath ('Env:'+ $_.Name) -ErrorAction SilentlyContinue}
    foreach($key in $preflightOriginal.Keys){[Environment]::SetEnvironmentVariable($key,$preflightOriginal[$key],'Process')}
    Pop-Location
}
if(-not $report.ready){exit 1}
$global:LASTEXITCODE=0
