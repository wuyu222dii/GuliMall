param([Parameter(Mandatory=$true)][string]$Backup)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
if($env:GULIMALL_TEST -ne '1' -or $env:COMPOSE_PROJECT_NAME -ne 'gulimall-test'){throw 'Restore rehearsal runs only inside scripts/test.ps1 -Suite Recovery'}
$Backup=(Resolve-Path -LiteralPath $Backup).Path
$taskManifest=Get-Content -LiteralPath (Join-Path $Backup 'manifest.json') -Raw | ConvertFrom-Json
if($taskManifest.format -ne 1 -or $taskManifest.environment -ne 'Test' -or @($taskManifest.schemas | Where-Object {$_ -notmatch '^gulimall_(pms|sms|ums|oms|wms)_test$'}).Count){throw 'Only verified test backups can be rehearsed automatically'}
foreach($taskFile in $taskManifest.files){$taskPath=[IO.Path]::GetFullPath((Join-Path $Backup $taskFile.path));if(-not $taskPath.StartsWith($Backup+[IO.Path]::DirectorySeparatorChar) -or (Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash -ne $taskFile.sha256){throw 'Backup path or checksum failed; nothing restored'}}
foreach($taskPort in @(3317,6390)){if(Get-NetTCPConnection -LocalPort $taskPort -State Listen -ErrorAction SilentlyContinue){throw "Restore port $taskPort is in use"}}
$taskOriginal=@{};Get-ChildItem Env: | ForEach-Object {$taskOriginal[$_.Name]=$_.Value}
$taskTag='gulimall-restore-'+[guid]::NewGuid().ToString('N')
$taskMysql=$taskTag+'-mysql';$taskRedis=$taskTag+'-redis';$taskVhost='restore_'+[guid]::NewGuid().ToString('N')
$taskDirectory=Join-Path $taskRoot ('.data/'+$taskTag)
$taskGatewayProcess=$null
function Docker-Checked([string[]]$Arguments){& docker @Arguments;if($LASTEXITCODE -ne 0){throw 'Restore rehearsal operation failed'}}
Push-Location $taskRoot
try {
    & "$PSScriptRoot/services.ps1" Stop
    $env:MYSQL_PASSWORD=$env:DB_PASSWORD;$env:REDISCLI_AUTH=$env:REDIS_PASSWORD
    Docker-Checked -Arguments @('run','-d','--name',$taskMysql,'-p','127.0.0.1:3317:3306','-e','MYSQL_ROOT_PASSWORD','-e','MYSQL_PASSWORD','-e','MYSQL_USER=gulimall','-e','MYSQL_DATABASE=restore_empty','-v',($taskMysql+':/var/lib/mysql'),'mysql:8.0.36')
    # The official image reads MYSQL_PASSWORD; it stays in the process environment, never in an argument value.
    $taskMysqlReady=$false
    for($taskTry=0;$taskTry -lt 90;$taskTry++){& docker exec $taskMysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h127.0.0.1 -uroot -e "SELECT 1"' *> $null;if($LASTEXITCODE -eq 0){$taskMysqlReady=$true;break};Start-Sleep -Seconds 1}
    if(-not $taskMysqlReady){throw 'Fresh restore MySQL not ready'}
    Docker-Checked -Arguments @('cp',(Join-Path $Backup 'database.sql'),($taskMysql+':/tmp/restore.sql'))
    Docker-Checked -Arguments @('exec',$taskMysql,'sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 < /tmp/restore.sql')
    foreach($taskSchema in $taskManifest.schemas){$taskGrant="GRANT ALL PRIVILEGES ON ``$taskSchema``.* TO 'gulimall'@'%';";$taskGrant | & docker exec -i $taskMysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot';if($LASTEXITCODE -ne 0){throw 'Restore user grant failed'}}
    [IO.File]::ReadAllText((Join-Path $taskRoot 'infra/migrations/006-product-creation.sql')).Replace('gulimall_pms_demo','gulimall_pms_test') | & docker exec -i $taskMysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -ugulimall --default-character-set=utf8mb4'
    if($LASTEXITCODE -ne 0){throw 'Restored Test migration failed before service startup'}
    Docker-Checked -Arguments @('create','--name',$taskRedis,'-p','127.0.0.1:6390:6379','-e','REDIS_PASSWORD','-e','REDISCLI_AUTH','-v',($taskRedis+':/data'),'redis:6.2.16-alpine','sh','-c','exec redis-server --appendonly no --requirepass "$REDIS_PASSWORD"')
    Docker-Checked -Arguments @('cp',(Join-Path $Backup 'redis.rdb'),($taskRedis+':/data/dump.rdb'))
    Docker-Checked -Arguments @('start',$taskRedis)
    Start-Sleep -Seconds 2
    Docker-Checked -Arguments @('exec',$taskRedis,'redis-cli','CONFIG','SET','appendonly','yes')
    Docker-Checked -Arguments @('exec',$taskRedis,'redis-cli','SET','gulimall:restore:aof-proof','restored')
    $taskAofReady=$false
    for($taskTry=0;$taskTry -lt 30;$taskTry++){$taskPersistence=& docker exec $taskRedis redis-cli INFO persistence;if(($taskPersistence -join "`n") -match 'aof_rewrite_in_progress:0' -and ($taskPersistence -join "`n") -match 'aof_last_bgrewrite_status:ok'){$taskAofReady=$true;break};Start-Sleep -Seconds 1}
    if(-not $taskAofReady){throw 'Restored Redis AOF rewrite did not finish'}
    Docker-Checked -Arguments @('rm','-f',$taskRedis)
    Docker-Checked -Arguments @('run','-d','--name',$taskRedis,'-p','127.0.0.1:6390:6379','-e','REDIS_PASSWORD','-e','REDISCLI_AUTH','-v',($taskRedis+':/data'),'redis:6.2.16-alpine','sh','-c','exec redis-server --appendonly yes --requirepass "$REDIS_PASSWORD"')
    Start-Sleep -Seconds 2
    $taskProof=& docker exec $taskRedis redis-cli --raw GET gulimall:restore:aof-proof
    if($LASTEXITCODE -ne 0 -or $taskProof -ne 'restored'){throw 'Restored Redis AOF did not survive container recreation'}
    New-Item -ItemType Directory -Path $taskDirectory | Out-Null
    Copy-Item -LiteralPath (Join-Path $Backup 'uploads') -Destination (Join-Path $taskDirectory 'uploads') -Recurse
    Docker-Checked -Arguments @('compose','exec','-T','rabbitmq','rabbitmqctl','add_vhost',$taskVhost)
    Docker-Checked -Arguments @('compose','exec','-T','rabbitmq','rabbitmqctl','set_permissions','-p',$taskVhost,$env:RABBITMQ_USER,'.*','.*','.*')
    $env:DB_PORT='3317';$env:REDIS_PORT='6390';$env:UPLOAD_DIR=Join-Path $taskDirectory 'uploads';$env:SPRING_RABBITMQ_VIRTUAL_HOST=$taskVhost
    $env:GULIMALL_RESTORE_MYSQL=$taskMysql
    if($taskManifest.simulationPayments) {
        Copy-Item -LiteralPath (Join-Path $Backup 'payment-ledger.json') -Destination (Join-Path $taskDirectory 'payment-ledger.json')
        $taskPayment=Get-Content (Join-Path $taskRoot '.tools/test/demo-payment.json') -Raw|ConvertFrom-Json
        $env:PAYMENT_TEST_CONFIG=Join-Path $taskRoot '.tools/test/demo-payment.json';$env:PAYMENT_TEST_DATA=Join-Path $taskDirectory 'payment-ledger.json';$env:PAYMENT_TEST_PORT='18170';$env:GULIMALL_SIMULATION='1'
        $env:SPRING_PROFILES_ACTIVE='dev,test,payment-test';$env:ALIPAY_APP_ID=$taskPayment.appId;$env:ALIPAY_PRIVATE_KEY=$taskPayment.merchantPrivate;$env:ALIPAY_PUBLIC_KEY=$taskPayment.providerPublic;$env:ALIPAY_SELLER_ID=$taskPayment.sellerId
        $env:ALIPAY_GATEWAY_URL='http://127.0.0.1:18170/gateway.do';$env:ALIPAY_NOTIFY_URL='http://127.0.0.1:88/api/payments/alipay/notify';$env:ALIPAY_RETURN_URL=$taskPayment.returnUrl
        if(Get-NetTCPConnection -LocalPort 18170 -State Listen -ErrorAction SilentlyContinue){throw 'Restore simulation port is occupied'}
        $taskGatewayProcess=Start-Process -FilePath (Get-Command node).Source -ArgumentList @('"'+(Join-Path $taskRoot 'scripts/payment-test-gateway.mjs')+'"','--simulation') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskDirectory 'gateway.log') -RedirectStandardError (Join-Path $taskDirectory 'gateway.err.log') -PassThru
    }
    & "$PSScriptRoot/services.ps1" Start
    & node scripts/restore-check.mjs
    if($LASTEXITCODE -ne 0){throw 'Restored business state did not verify'}
    Write-Output 'PASS: fresh restore instances, saved Session, uploaded image, completed order and pending release event recovered.'
}finally{
    & "$PSScriptRoot/services.ps1" Stop
    if($taskGatewayProcess -and -not $taskGatewayProcess.HasExited){Stop-Process -Id $taskGatewayProcess.Id}
    foreach($taskResource in @($taskMysql,$taskRedis)){
        & docker inspect $taskResource *> $null
        if($LASTEXITCODE -eq 0){& docker rm -f $taskResource}
        & docker volume inspect $taskResource *> $null
        if($LASTEXITCODE -eq 0){& docker volume rm $taskResource}
    }
    & docker compose exec -T rabbitmq rabbitmqctl delete_vhost $taskVhost
    Get-ChildItem Env: | Where-Object {-not $taskOriginal.ContainsKey($_.Name)} | ForEach-Object {Remove-Item -LiteralPath ('Env:'+ $_.Name) -ErrorAction SilentlyContinue}
    foreach($taskKey in $taskOriginal.Keys){[Environment]::SetEnvironmentVariable($taskKey,$taskOriginal[$taskKey],'Process')}
    & "$PSScriptRoot/services.ps1" Start
    Pop-Location
}
