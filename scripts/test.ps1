param([ValidateSet('All','Auth','Product','Admin','Search','Cart','Order','Payment','Fulfillment','Success','Failure','Recovery','Diagnostics','Browser')][string]$Suite='All')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$taskOriginal=@{}
Get-ChildItem Env: | ForEach-Object { $taskOriginal[$_.Name]=$_.Value }
function Restore-Environment {
    Get-ChildItem Env: | Where-Object { -not $taskOriginal.ContainsKey($_.Name) } | ForEach-Object { Remove-Item -LiteralPath ('Env:'+ $_.Name) -ErrorAction SilentlyContinue }
    foreach($taskKey in $taskOriginal.Keys) { [Environment]::SetEnvironmentVariable($taskKey,$taskOriginal[$taskKey],'Process') }
    if(@(Get-ChildItem Env: | Where-Object { -not $taskOriginal.ContainsKey($_.Name) }).Count){throw 'Environment restoration left additional variables; empty values must be removed, not retained'}
}
function Docker-Checked([string[]]$Arguments) {
    & docker @Arguments
    if($LASTEXITCODE -ne 0) { throw 'Docker test environment operation failed' }
}
function Wait-TestServices {
    for($taskTry=0;$taskTry -lt 90;$taskTry++) {
        & node --input-type=module -e "import {assertTestEnvironment} from './scripts/test-environment.mjs'; await assertTestEnvironment()" *> (Join-Path $taskDirectory 'readiness.log')
        if($LASTEXITCODE -eq 0) {
            try {
                $taskResponse=Invoke-WebRequest 'http://127.0.0.1:88/api/auth/csrf' -UseBasicParsing -TimeoutSec 5
                $taskProduct=Invoke-RestMethod 'http://127.0.0.1:88/api/product/items/900001' -TimeoutSec 5
                if($taskResponse.StatusCode -eq 200 -and $taskProduct.item.hasStock -eq $true){return}
            } catch { }
        }
        Start-Sleep -Seconds 1
    }
    throw 'Isolated test services did not become ready; inspect .tools/test/readiness.log'
}
Push-Location $taskRoot
$taskStopped=$false
$taskResumeSimulation=(Test-Path .tools/simulation/state.json) -and (Get-Content .tools/simulation/state.json -Raw|ConvertFrom-Json).active
try {
    . "$PSScriptRoot/env.ps1"
    if($Suite -eq 'Browser') {
        & node --input-type=module -e "import {chromium} from './gulimall-web/node_modules/@playwright/test/index.mjs';import {existsSync} from 'node:fs';if(!existsSync(chromium.executablePath())||!existsSync('gulimall-web/dist/index.html'))throw new Error('Build the frontend and install the locked Chromium browser before Browser acceptance');"
        if($LASTEXITCODE -ne 0){throw 'Browser prerequisites missing; the standing environment was not stopped'}
    }
    foreach($taskOverride in @('SPRING_APPLICATION_JSON','SPRING_CONFIG_LOCATION','SPRING_CONFIG_ADDITIONAL_LOCATION','SPRING_DATASOURCE_URL')){if([Environment]::GetEnvironmentVariable($taskOverride,'Process')){throw "Clear $taskOverride before isolated tests; externally supplied service configuration is not accepted"}}
    $taskDirectory=Join-Path $taskRoot '.tools/test'
    New-Item -ItemType Directory -Force $taskDirectory | Out-Null
    $taskConfigPath=Join-Path $taskDirectory 'environment.json'
    if(-not(Test-Path -LiteralPath $taskConfigPath)) {
        $taskHash=[regex]::Match([IO.File]::ReadAllText((Join-Path $taskRoot 'infra/mysql/002-demo.sql')),"'demo_a',\s*'([^']+)'").Groups[1].Value
        if(-not $taskHash.StartsWith('$2a$')) { throw 'Demo password hash fixture missing' }
        $taskConfig=[ordered]@{DB_HOST='127.0.0.1';DB_PORT='3307';DB_USER='gulimall';PRODUCT_PORT='10001';REDIS_HOST='127.0.0.1';REDIS_PORT='6380';NACOS_ADDR='127.0.0.1:18848';NACOS_CONFIG_ENABLED='false';ELASTICSEARCH_URL='http://127.0.0.1:19200';RABBITMQ_HOST='127.0.0.1';RABBITMQ_PORT='5673';RABBITMQ_USER='gulimall';ADMIN_USER='test_admin';ADMIN_PASSWORD_HASH=$taskHash;ADMIN_TEST_PASSWORD='Demo12345!';SPRING_PROFILES_ACTIVE='dev,test';UPLOAD_DIR=(Join-Path $taskRoot '.data/test-uploads');AUTH_SMS_MODE='development';OSS_ENABLED='false';SMS_ENABLED='false';ALIPAY_APP_ID='';ALIPAY_PRIVATE_KEY='';ALIPAY_PUBLIC_KEY='';ALIPAY_SELLER_ID='';ALIPAY_NOTIFY_URL='';ALIPAY_RETURN_URL='http://127.0.0.1:8080/payment/return';ALIPAY_GATEWAY_URL='https://openapi-sandbox.dl.alipaydev.com/gateway.do';SPRING_RABBITMQ_VIRTUAL_HOST='/';ORDER_STOCK_URL='';WARE_ORDER_EVENT_URL=''}
        $taskRandom=[Security.Cryptography.RandomNumberGenerator]::Create()
        try { foreach($taskKey in @('DB_PASSWORD','MYSQL_ROOT_PASSWORD','REDIS_PASSWORD','RABBITMQ_PASSWORD','INTERNAL_API_TOKEN')) { $taskBytes=New-Object byte[] 24; $taskRandom.GetBytes($taskBytes); $taskConfig[$taskKey]=[Convert]::ToBase64String($taskBytes) } } finally { $taskRandom.Dispose() }
        [IO.File]::WriteAllText($taskConfigPath,($taskConfig | ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
    }
    $taskConfig=Get-Content -LiteralPath $taskConfigPath -Raw | ConvertFrom-Json
    $taskInit=Join-Path $taskDirectory 'mysql-init'
    New-Item -ItemType Directory -Force $taskInit | Out-Null
    foreach($taskFile in Get-ChildItem (Join-Path $taskRoot 'infra/mysql') -Filter '*.sql') {
        $taskSql=[IO.File]::ReadAllText($taskFile.FullName) -replace 'gulimall_(pms|sms|ums|oms|wms)_demo','gulimall_$1_test'
        [IO.File]::WriteAllText((Join-Path $taskInit $taskFile.Name),$taskSql,(New-Object Text.UTF8Encoding($false)))
    }
    $taskAdminPath=Join-Path $taskDirectory 'admin-access.json'
    [IO.File]::WriteAllText($taskAdminPath,(@{username=$taskConfig.ADMIN_USER;password=$taskConfig.ADMIN_TEST_PASSWORD} | ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
    $env:COMPOSE_FILE=Join-Path $taskRoot 'compose.yaml';$env:COMPOSE_PROJECT_NAME='gulimall-demo'
    $taskStopped=$true
    if($taskResumeSimulation){& "$PSScriptRoot/simulation.ps1" Stop}else{& "$PSScriptRoot/services.ps1" Stop}
    Docker-Checked -Arguments @('compose','stop')
    foreach($taskProperty in $taskConfig.PSObject.Properties) { [Environment]::SetEnvironmentVariable($taskProperty.Name,[string]$taskProperty.Value,'Process') }
    $env:COMPOSE_FILE=(Join-Path $taskRoot 'compose.yaml')+';'+(Join-Path $taskRoot 'infra/compose.test.yaml')
    $env:COMPOSE_PROJECT_NAME='gulimall-test';$env:GULIMALL_TEST_INIT_DIR=$taskInit.Replace('\','/');$env:GULIMALL_ADMIN_ACCESS_FILE=$taskAdminPath
    $env:GULIMALL_TEST='1';$env:GULIMALL_ACCEPTANCE='1';$env:GULIMALL_FAULTS='1'
    New-Item -ItemType Directory -Force $env:UPLOAD_DIR | Out-Null
    Docker-Checked -Arguments @('compose','up','-d','--wait','--wait-timeout','300')
    & "$PSScriptRoot/services.ps1" Start
    Wait-TestServices
    & "$PSScriptRoot/search-index.ps1"
    if($Suite -eq 'Browser') {
        & node scripts/browser-run.mjs
        if($LASTEXITCODE -ne 0){throw 'Browser acceptance failed; inspect output/playwright (redacted artifacts)'}
    } elseif($Suite -eq 'Diagnostics') {
        & node scripts/diagnostics.acceptance.mjs
        if($LASTEXITCODE -ne 0){throw 'Diagnostics acceptance failed'}
    } elseif($Suite -in @('Success','Failure','Recovery')) {
        $taskStories=if($Suite -eq 'Recovery'){@('success','failure')}else{@($Suite.ToLower())}
        foreach($taskStory in $taskStories){Wait-TestServices;& node scripts/demo.mjs $taskStory;if($LASTEXITCODE -ne 0){throw 'Demo failed'}}
        if($Suite -eq 'Recovery'){
            $taskFailure=Get-Content .tools/test/demo-failure.json -Raw|ConvertFrom-Json
            $taskBadCopy=Join-Path $taskDirectory ('corrupt-backup-'+[guid]::NewGuid().ToString('N'))
            Copy-Item -LiteralPath $taskFailure.backup -Destination $taskBadCopy -Recurse
            $taskBadManifest=Get-Content (Join-Path $taskBadCopy 'manifest.json') -Raw|ConvertFrom-Json
            $taskBadManifest.files[0].sha256='0'*64
            [IO.File]::WriteAllText((Join-Path $taskBadCopy 'manifest.json'),($taskBadManifest|ConvertTo-Json -Depth 6),(New-Object Text.UTF8Encoding($false)))
            $taskRejected=$false
            try{& "$PSScriptRoot/restore-drill.ps1" -Backup $taskBadCopy}catch{if($_.Exception.Message -match 'checksum'){$taskRejected=$true}else{throw}}
            if(-not $taskRejected){throw 'Corrupt backup was not rejected'}
            Write-Output 'PASS: corrupted backup rejected before stopping services or creating restore containers.'
            & "$PSScriptRoot/restore-drill.ps1" -Backup $taskFailure.backup
        }
    } else {
        $taskSuites=if($Suite -eq 'All') {@('auth','product','admin','search','cart','order','payment','fulfillment')} else {@($Suite.ToLower())}
        foreach($taskName in $taskSuites) {
            Wait-TestServices
            Write-Output "Running isolated $taskName acceptance..."
            & node --test ("scripts/$taskName.acceptance.mjs") *> (Join-Path $taskDirectory "$taskName.log")
            if($LASTEXITCODE -ne 0) { Get-Content (Join-Path $taskDirectory "$taskName.log") -Tail 70;throw "$taskName acceptance failed" }
            Get-Content (Join-Path $taskDirectory "$taskName.log") -Tail 8
        }
    }
} finally {
    try {
        if($taskStopped) {
            & "$PSScriptRoot/services.ps1" Stop
            if($env:COMPOSE_PROJECT_NAME -eq 'gulimall-test') { Docker-Checked -Arguments @('compose','stop') }
            Restore-Environment
            . "$PSScriptRoot/env.ps1"
            $env:COMPOSE_FILE=Join-Path $taskRoot 'compose.yaml';$env:COMPOSE_PROJECT_NAME='gulimall-demo'
            Docker-Checked -Arguments @('compose','up','-d','--wait','--wait-timeout','300')
            if($taskResumeSimulation){& "$PSScriptRoot/simulation.ps1" Start}else{& "$PSScriptRoot/services.ps1" Start}
        }
    } finally {
        Restore-Environment
        Pop-Location
    }
}
