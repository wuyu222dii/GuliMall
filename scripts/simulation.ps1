param([ValidateSet('Start','Stop','Status','Diagnose')][string]$Action='Start',[switch]$Json,[ValidatePattern('^gulimall-(demo|handoff-[a-f0-9]{32})$')][string]$ProjectName='gulimall-demo')
$ErrorActionPreference='Stop'
$simulationRoot=Split-Path $PSScriptRoot -Parent
$simulationOriginal=@{};Get-ChildItem Env: | ForEach-Object {$simulationOriginal[$_.Name]=$_.Value}
$simulationDirectory=Join-Path $simulationRoot '.tools/simulation'
$simulationState=Join-Path $simulationDirectory 'state.json'
$simulationGateway=Join-Path $simulationRoot 'scripts/payment-test-gateway.mjs'
$simulationStatic=Join-Path $simulationRoot 'scripts/serve-demo.mjs'
$simulationMarker='-Dgulimall.workspace='+$simulationRoot.Replace('\','/')
function Simulation-WriteState([bool]$Active){[IO.File]::WriteAllText($simulationState,(@{active=$Active;workspace=$simulationRoot}|ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))}
function Simulation-GatewayProcesses { @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($simulationGateway) -and $_.CommandLine.Contains('--simulation')}) }
function Simulation-Healthy {
    try {
        $health=Invoke-RestMethod 'http://127.0.0.1:18170/health' -TimeoutSec 3
        if($health.mode -ne 'LOCAL_TEST' -or -not $health.ready -or -not $health.persistent){return $false}
        foreach($name in @('product','member','coupon','ware','order','search','auth-server','third-party','cart','gateway')) {
            $instances=Invoke-RestMethod ('http://127.0.0.1:18848/nacos/v1/ns/instance/list?serviceName=gulimall-'+$name+'&healthyOnly=true') -TimeoutSec 3
            if(@($instances.hosts | Where-Object {$_.healthy -and $_.ip -eq '127.0.0.1'}).Count -ne 1){return $false}
        }
        $null=Invoke-RestMethod 'http://127.0.0.1:8080/api/auth/csrf' -TimeoutSec 5
        $product=Invoke-RestMethod 'http://127.0.0.1:8080/api/product/items/900001' -TimeoutSec 5
        return $product.code -eq 0
    } catch {return $false}
}
Push-Location $simulationRoot
try {
    if($ProjectName -ne 'gulimall-demo'){
        $ownerFile=Join-Path $simulationRoot '.tools/handoff-owner.json'
        if(-not(Test-Path -LiteralPath $ownerFile)){throw 'Isolated simulation requires a clean-check ownership record.'}
        $ownerRecord=Get-Content -LiteralPath $ownerFile -Raw|ConvertFrom-Json
        if($ownerRecord.project -ne $ProjectName -or $ownerRecord.workspace -ne $simulationRoot){throw 'Isolated simulation ownership does not match this workspace.'}
    }
    if($Action -eq 'Diagnose') {
        . "$PSScriptRoot/env.ps1"
        $env:COMPOSE_PROJECT_NAME=$ProjectName
        if($Json){& node (Join-Path $PSScriptRoot 'simulation-diagnostics.mjs') --json}else{& node (Join-Path $PSScriptRoot 'simulation-diagnostics.mjs')}
        if($LASTEXITCODE -ne 0){exit $LASTEXITCODE};return
    }
    if($env:GULIMALL_TEST -eq '1' -or ($env:COMPOSE_PROJECT_NAME -and $env:COMPOSE_PROJECT_NAME -ne $ProjectName)){throw 'Leave the isolated test environment before operating the simulation.'}
    . "$PSScriptRoot/env.ps1"
    $env:COMPOSE_FILE=Join-Path $simulationRoot 'compose.yaml';$env:COMPOSE_PROJECT_NAME=$ProjectName
    if($Action -eq 'Status') {
        $active=(Test-Path -LiteralPath $simulationState) -and (Get-Content $simulationState -Raw|ConvertFrom-Json).active
        Write-Output ("Simulation requested: $active; healthy: $(Simulation-Healthy); gateway processes: $(@(Simulation-GatewayProcesses).Count)")
        return
    }
    New-Item -ItemType Directory -Force $simulationDirectory | Out-Null
    if($Action -eq 'Stop') {
        Simulation-WriteState $false
        & "$PSScriptRoot/deploy.ps1" Stop
        & "$PSScriptRoot/services.ps1" Stop
        foreach($process in Simulation-GatewayProcesses){Stop-Process -Id $process.ProcessId}
        Write-Output 'Simulation stopped; infrastructure, database, uploads and payment ledger preserved.'
        return
    }
    if(-not $env:JAVA_HOME -or -not(Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/java.exe'))){throw 'Set JAVA_HOME to JDK 8 before starting the simulation.'}
    foreach($name in @('DB_HOST','REDIS_HOST','RABBITMQ_HOST')){if([Environment]::GetEnvironmentVariable($name,'Process') -and [Environment]::GetEnvironmentVariable($name,'Process') -ne '127.0.0.1'){throw "Simulation requires loopback $name."}}
    if($env:NACOS_ADDR -and $env:NACOS_ADDR -notmatch '^127\.0\.0\.1:[0-9]+$'){throw 'Simulation requires loopback Nacos.'}
    if($env:ELASTICSEARCH_URL){$address=[uri]$env:ELASTICSEARCH_URL;if($address.Scheme -ne 'http' -or $address.Host -ne '127.0.0.1' -or $address.UserInfo){throw 'Simulation requires loopback Elasticsearch.'}}
    if($env:PRODUCT_PORT -and $env:PRODUCT_PORT -ne '10001'){throw 'Simulation uses product port 10001; resolve custom service ports before starting.'}
    foreach($name in @('SPRING_APPLICATION_JSON','SPRING_CONFIG_LOCATION','SPRING_CONFIG_ADDITIONAL_LOCATION','SPRING_DATASOURCE_URL')){if([Environment]::GetEnvironmentVariable($name,'Process')){throw "Clear $name before starting the controlled simulation."}}
    foreach($name in @('product','member','coupon','ware','order','search','auth-server','third-party','cart','gateway')) {
        if(-not(Test-Path -LiteralPath (Join-Path $simulationRoot "gulimall-$name/target/gulimall-$name-0.0.1-SNAPSHOT.jar"))){throw 'Build the backend before starting the simulation.'}
    }
    if(-not(Test-Path -LiteralPath (Join-Path $simulationRoot 'gulimall-web/dist/index.html'))){throw 'Build the frontend before starting the simulation.'}
    foreach($port in @(88,8080,18170,10001,8000,7001,11000,9000,12000,20000,30000,18000)) {
        foreach($listener in @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) {
            $owner=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
            $owned=$owner.CommandLine -and (($owner.Name -eq 'java.exe' -and $owner.CommandLine.Contains($simulationMarker) -and $owner.CommandLine.Contains($simulationRoot+'\gulimall-')) -or ($owner.Name -eq 'node.exe' -and (($port -eq 8080 -and $owner.CommandLine.Contains($simulationStatic)) -or ($port -eq 18170 -and $owner.CommandLine.Contains($simulationGateway) -and $owner.CommandLine.Contains('--simulation')))))
            if(-not $owned){throw "Port $port is occupied by an unmanaged process; nothing was stopped."}
        }
    }
    if((Test-Path -LiteralPath $simulationState) -and (Get-Content $simulationState -Raw|ConvertFrom-Json).active -and (Simulation-Healthy)){Write-Output 'Simulation already healthy at http://127.0.0.1:8080';return}
    $simulationConfig=Join-Path $simulationDirectory 'payment-config.json'
    if((Test-Path -LiteralPath (Join-Path $simulationRoot '.data/simulation/payment/trades.json')) -and -not(Test-Path -LiteralPath $simulationConfig)){throw 'Restore the original payment keys before opening an existing simulation ledger.'}
    $env:PAYMENT_TEST_CONFIG=$simulationConfig
    $env:PAYMENT_TEST_DATA=Join-Path $simulationRoot '.data/simulation/payment/trades.json'
    & node --input-type=module -e "import {testConfig,validatePaymentConfig} from './scripts/payment-test-gateway.mjs';import {paymentLedger} from './scripts/simulation-ledger.mjs';import {writeFileSync} from 'node:fs';const c=testConfig(process.env.PAYMENT_TEST_CONFIG);validatePaymentConfig(c);paymentLedger(c,process.env.PAYMENT_TEST_DATA);c.returnUrl='http://127.0.0.1:8080/payment/return';writeFileSync(process.env.PAYMENT_TEST_CONFIG,JSON.stringify(c,null,2));"
    if($LASTEXITCODE -ne 0){throw 'Simulation payment configuration invalid.'}
    $config=Get-Content -LiteralPath $simulationConfig -Raw|ConvertFrom-Json
    $env:SPRING_PROFILES_ACTIVE='dev,payment-test';$env:AUTH_SMS_MODE='development';$env:OSS_ENABLED='false';$env:SMS_ENABLED='false';$env:IMAGE_STORAGE='local'
    $env:NACOS_CONFIG_ENABLED='false';$env:SPRING_RABBITMQ_VIRTUAL_HOST='/';$env:ORDER_STOCK_URL='';$env:WARE_ORDER_EVENT_URL=''
    $env:ALIPAY_APP_ID=$config.appId;$env:ALIPAY_PRIVATE_KEY=$config.merchantPrivate;$env:ALIPAY_PUBLIC_KEY=$config.providerPublic;$env:ALIPAY_SELLER_ID=$config.sellerId
    $env:ALIPAY_GATEWAY_URL='http://127.0.0.1:18170/gateway.do';$env:ALIPAY_NOTIFY_URL='http://127.0.0.1:88/api/payments/alipay/notify';$env:ALIPAY_RETURN_URL='http://127.0.0.1:8080/payment/return'
    $env:PAYMENT_TEST_PORT='18170';$env:PAYMENT_TEST_DATA=Join-Path $simulationRoot '.data/simulation/payment/trades.json';$env:GULIMALL_ACCEPTANCE='1';$env:GULIMALL_SIMULATION='1'
    & docker compose up -d --wait --wait-timeout 300
    if($LASTEXITCODE -ne 0){throw 'Demo infrastructure failed to become healthy.'}
    & "$PSScriptRoot/services.ps1" Stop
    foreach($process in Simulation-GatewayProcesses){Stop-Process -Id $process.ProcessId}
    $null=Start-Process -FilePath (Get-Command node).Source -ArgumentList @('"'+$simulationGateway+'"','--simulation') -WorkingDirectory $simulationRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $simulationDirectory 'gateway.log') -RedirectStandardError (Join-Path $simulationDirectory 'gateway.err.log') -PassThru
    for($attempt=0;$attempt -lt 20;$attempt++){try{$health=Invoke-RestMethod 'http://127.0.0.1:18170/health' -TimeoutSec 2;if($health.ready){break}}catch{};Start-Sleep -Milliseconds 250}
    if(-not $health.ready){throw 'Simulation gateway failed; inspect .tools/simulation/gateway.err.log'}
    & "$PSScriptRoot/services.ps1" Start
    & "$PSScriptRoot/deploy.ps1" Start
    for($attempt=0;$attempt -lt 90;$attempt++){if(Simulation-Healthy){Simulation-WriteState $true;Write-Output 'LOCAL_TEST simulation ready at http://127.0.0.1:8080; no external services or real funds.';return};Start-Sleep -Seconds 1}
    throw 'Simulation services did not become ready; inspect .tools/runtime and .tools/simulation.'
} finally {
    Get-ChildItem Env: | Where-Object {-not $simulationOriginal.ContainsKey($_.Name)} | ForEach-Object {Remove-Item -LiteralPath ('Env:'+ $_.Name) -ErrorAction SilentlyContinue}
    foreach($key in $simulationOriginal.Keys){[Environment]::SetEnvironmentVariable($key,$simulationOriginal[$key],'Process')}
    Pop-Location
}
