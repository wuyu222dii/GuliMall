param([Parameter(Mandatory=$true)][string]$Backup,[Parameter(Mandatory=$true)][string]$PaymentConfig)
$ErrorActionPreference='Stop'
$restoreRoot=Split-Path $PSScriptRoot -Parent
$restoreOriginal=@{};Get-ChildItem Env:|ForEach-Object {$restoreOriginal[$_.Name]=$_.Value}
$restoreTag=[guid]::NewGuid().ToString('N');$restoreProject='gulimall-handoff-'+$restoreTag
$restoreDirectory=Join-Path $restoreRoot ('.tools/demo restore '+$restoreTag.Substring(0,8));$restoreSource=Join-Path $restoreDirectory 'source'
$restorePaused=$false;$restoreResources=$false;$restorePassed=$false;$restoreCleaned=$false;$restoreResumed=$false;$restoreHashes=@{};$restoreContainerIds=@()
function Restore-CallerEnvironment {
    Get-ChildItem Env:|Where-Object {-not $restoreOriginal.ContainsKey($_.Name)}|ForEach-Object {Remove-Item -LiteralPath ('Env:'+ $_.Name) -ErrorAction SilentlyContinue}
    foreach($key in $restoreOriginal.Keys){[Environment]::SetEnvironmentVariable($key,$restoreOriginal[$key],'Process')}
}
function Restore-LocalEnvironment {
    $keys=@(Get-Content (Join-Path $restoreRoot '.env.example')|ForEach-Object {if($_ -match '^([A-Z][A-Z0-9_]*)='){$Matches[1]}})
    foreach($key in @(Get-ChildItem Env:|Where-Object {$_.Name -in $keys -or $_.Name -match '^(GULIMALL_|COMPOSE_|SPRING_|ALIPAY_|PAYMENT_TEST|ORDER_STOCK|WARE_ORDER|SERVER_|MANAGEMENT_|IMAGE_STORAGE$|JAVA_TOOL_OPTIONS$|JDK_JAVA_OPTIONS$|_JAVA_OPTIONS$)'}|Select-Object -ExpandProperty Name)){Remove-Item -LiteralPath ('Env:'+$key)}
    . "$restoreSource/scripts/env.ps1"
    $env:COMPOSE_PROJECT_NAME=$restoreProject;$env:COMPOSE_FILE=Join-Path $restoreSource 'compose.yaml';$env:GULIMALL_DEMO_RESTORE_CONTEXT=Join-Path $restoreSource '.tools/demo-restore-context.json'
    $env:SPRING_PROFILES_ACTIVE='dev,payment-test';$env:SPRING_RABBITMQ_VIRTUAL_HOST='/';$env:IMAGE_STORAGE='local';$env:UPLOAD_DIR=Join-Path $restoreSource '.data/uploads'
    $config=Join-Path $restoreSource '.tools/simulation/payment-config.json'
    if(Test-Path -LiteralPath $config){$payment=Get-Content -LiteralPath $config -Raw|ConvertFrom-Json;$env:ALIPAY_APP_ID=$payment.appId;$env:ALIPAY_PRIVATE_KEY=$payment.merchantPrivate;$env:ALIPAY_PUBLIC_KEY=$payment.providerPublic;$env:ALIPAY_SELLER_ID=$payment.sellerId;$env:ALIPAY_GATEWAY_URL='http://127.0.0.1:18170/gateway.do';$env:ALIPAY_NOTIFY_URL=$payment.notifyUrl;$env:ALIPAY_RETURN_URL=$payment.returnUrl}
}
function Restore-Docker([string[]]$Arguments){& docker @Arguments;if($LASTEXITCODE -ne 0){throw 'Demo restore Docker operation failed; inspect the private run log'}}
function Restore-Dump([string]$Container,[string]$Destination){
    $temporary='/tmp/demo-restore-'+$restoreTag+'.sql'
    try{Restore-Docker -Arguments @('exec',$Container,'sh','-c',('MYSQL_PWD="$MYSQL_PASSWORD" mysqldump -ugulimall --default-character-set=utf8mb4 --single-transaction --no-tablespaces --hex-blob --set-gtid-purged=OFF --skip-comments --compact --order-by-primary --routines --events --triggers --databases gulimall_pms_demo gulimall_sms_demo gulimall_ums_demo gulimall_oms_demo gulimall_wms_demo > '+$temporary));Restore-Docker -Arguments @('cp',($Container+':'+$temporary),$Destination)}finally{Restore-Docker -Arguments @('exec',$Container,'rm','-f','--',$temporary)}
}
function Restore-RemoveResources {
    & "$restoreSource/scripts/simulation.ps1" Stop -ProjectName $restoreProject
    $containers=@(& docker ps -a --filter ('label=com.docker.compose.project='+$restoreProject) --format '{{.Names}}')
    foreach($container in $containers){$owner=& docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' $container;if($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($owner) -ne [IO.Path]::GetFullPath($restoreSource)){throw 'Refusing to remove an unowned restore container'}}
    foreach($volume in @(& docker volume ls --filter ('label=com.docker.compose.project='+$restoreProject) --format '{{.Name}}')){if(-not $volume.StartsWith($restoreProject+'_')){throw 'Refusing an unexpected restore volume'}}
    if($restoreProject -notmatch '^gulimall-handoff-[a-f0-9]{32}$'){throw 'Unsafe restoration cleanup project'}
    Restore-Docker -Arguments @('compose','down','--volumes')
    if(@(& docker ps -a --filter ('label=com.docker.compose.project='+$restoreProject) --format '{{.ID}}').Count -or @(& docker volume ls --filter ('label=com.docker.compose.project='+$restoreProject) --format '{{.Name}}').Count){throw 'Restore resources were not completely removed'}
}
function Restore-Import([string]$InputBackup,[int]$Phase){
    $context=Get-Content $env:GULIMALL_DEMO_RESTORE_CONTEXT -Raw|ConvertFrom-Json;$context.phase=$Phase;[IO.File]::WriteAllText($env:GULIMALL_DEMO_RESTORE_CONTEXT,($context|ConvertTo-Json -Depth 6),(New-Object Text.UTF8Encoding($false)))
    & node "$restoreSource/scripts/demo-restore-guard.mjs" prepare $env:GULIMALL_DEMO_RESTORE_CONTEXT $InputBackup $PaymentConfig
    if($LASTEXITCODE -ne 0){throw 'Restore copy validation failed'}
    Restore-LocalEnvironment
    Restore-Docker -Arguments @('compose','up','-d','mysql')
    $mysql=$restoreProject+'-mysql-1';$redis=$restoreProject+'-redis-1';$ready=$false
    for($i=0;$i -lt 90;$i++){& docker exec $mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h127.0.0.1 -uroot -e "SELECT 1"' *> $null;if($LASTEXITCODE -eq 0){$ready=$true;break};Start-Sleep -Seconds 1}
    if(-not $ready){throw 'New restore MySQL not ready'}
    & node "$restoreSource/scripts/demo-restore-guard.mjs" guard $env:GULIMALL_DEMO_RESTORE_CONTEXT mysql;if($LASTEXITCODE -ne 0){throw 'SQL destination ownership failed before import'}
    Restore-Docker -Arguments @('cp',(Join-Path $InputBackup 'database.sql'),($mysql+':/tmp/restored.sql'))
    Restore-Docker -Arguments @('exec',$mysql,'sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 < /tmp/restored.sql')
    $grants=(@('pms','sms','ums','oms','wms')|ForEach-Object {"GRANT ALL PRIVILEGES ON ``gulimall_${_}_demo``.* TO 'gulimall'@'%';"}) -join ''
    $grants|& docker exec -i $mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot';if($LASTEXITCODE -ne 0){throw 'Restored application grants failed'}
    if($Phase -eq 2){
        $roundtrip=Join-Path $restoreSource '.tools/checkpoint-reloaded.sql';Restore-Dump $mysql $roundtrip
        if((Get-FileHash -LiteralPath (Join-Path $InputBackup 'database.sql')).Hash -ne (Get-FileHash -LiteralPath $roundtrip).Hash){throw 'Restored SQL differs from its cold checkpoint, including text or timestamps'}
        Write-Output 'PASS: complete 71-table SQL cold checkpoint round-trip is byte-identical, including UTF-8 text'
    }
    Restore-Docker -Arguments @('compose','create','redis')
    & node "$restoreSource/scripts/demo-restore-guard.mjs" guard $env:GULIMALL_DEMO_RESTORE_CONTEXT redis;if($LASTEXITCODE -ne 0){throw 'Redis destination ownership failed before import'}
    $redisConfig=Join-Path $restoreSource '.data/restore.conf';[IO.File]::WriteAllText($redisConfig,("appendonly no`nsave `"`"`nrequirepass `""+$env:REDIS_PASSWORD+"`"`n"),(New-Object Text.UTF8Encoding($false)))
    Restore-Docker -Arguments @('cp',$redisConfig,($redis+':/data/restore.conf'));Restore-Docker -Arguments @('cp',(Join-Path $InputBackup 'redis.rdb'),($redis+':/data/dump.rdb'));Restore-Docker -Arguments @('compose','start','redis')
    $ready=$false;for($i=0;$i -lt 30;$i++){$pong=& docker exec $redis redis-cli --raw PING 2>$null;if($LASTEXITCODE -eq 0 -and $pong -eq 'PONG'){$ready=$true;break};Start-Sleep -Seconds 1};if(-not $ready){throw 'Restored Redis not ready'}
    Restore-Docker -Arguments @('exec',$redis,'redis-cli','CONFIG','SET','appendonly','yes');Restore-Docker -Arguments @('exec',$redis,'redis-cli','CONFIG','REWRITE')
    Restore-Docker -Arguments @('exec',$redis,'redis-cli','SET','gulimall:demo-restore:aof-proof',$restoreTag)
    $ready=$false;for($i=0;$i -lt 60;$i++){$aof=& docker exec $redis redis-cli INFO persistence;if(($aof -join "`n") -match 'aof_rewrite_in_progress:0' -and ($aof -join "`n") -match 'aof_last_bgrewrite_status:ok'){$ready=$true;break};Start-Sleep -Seconds 1};if(-not $ready){throw 'Restored Redis AOF did not persist'}
    Restore-Docker -Arguments @('compose','up','-d','--wait','--wait-timeout','300')
    & node "$restoreSource/scripts/demo-restore-runtime.mjs" snapshot;if($LASTEXITCODE -ne 0){throw 'Before-start snapshot or isolation guard failed'}
    $ids=@(& docker compose ps -a -q);$script:restoreContainerIds+=,@(& docker inspect --format '{{.Id}}' @ids)
    foreach($port in @(88,8080,18170,10001,8000,7001,11000,9000,12000,20000,30000,18000)){if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "Native port $port is occupied before restore startup; no unknown process was stopped"}}
    & "$restoreSource/scripts/simulation.ps1" Start -ProjectName $restoreProject
    if($LASTEXITCODE -ne 0){throw 'Restored services did not start'}
    $proof=& docker exec $redis redis-cli --raw GET 'gulimall:demo-restore:aof-proof';if($LASTEXITCODE -ne 0 -or $proof -ne $restoreTag){throw 'Restored Redis proof did not survive startup'}
    & "$restoreSource/scripts/search-index.ps1";if($LASTEXITCODE -ne 0){throw 'Isolated index initialization failed'}
    & node "$restoreSource/scripts/demo-restore-runtime.mjs" rebuild;if($LASTEXITCODE -ne 0){throw 'Search rebuild from the restored database failed'}
}
Push-Location $restoreRoot
try {
    if($env:GULIMALL_TEST -eq '1' -or ($env:COMPOSE_PROJECT_NAME -and $env:COMPOSE_PROJECT_NAME -ne 'gulimall-demo')){throw 'Leave isolated Test mode before a Demo restoration; Test protections are unchanged'}
    if($env:COMPOSE_FILE -and [IO.Path]::GetFullPath($env:COMPOSE_FILE) -ne (Join-Path $restoreRoot 'compose.yaml')){throw 'Clear external Compose configuration before a Demo restoration'}
    $Backup=(Resolve-Path -LiteralPath $Backup).Path;$PaymentConfig=(Resolve-Path -LiteralPath $PaymentConfig).Path
    & node scripts/demo-restore-guard.mjs verify $Backup $PaymentConfig;if($LASTEXITCODE -ne 0){throw 'Demo input validation failed; original environment was not stopped'}
    & git diff --quiet;if($LASTEXITCODE -ne 0){throw 'Stage reviewed tracked changes first; the restore uses an index snapshot'}
    $tree=(& git write-tree).Trim();if($LASTEXITCODE -ne 0){throw 'Git snapshot failed'}
    . "$PSScriptRoot/env.ps1"
    & "$PSScriptRoot/preflight.ps1" -Mode Simulation -Json *> .tools/stage20-preflight.json;if($LASTEXITCODE -ne 0){throw 'Original preflight failed'}
    if(-not(Test-Path .tools/simulation/state.json) -or -not(Get-Content .tools/simulation/state.json -Raw|ConvertFrom-Json).active){throw 'Demo restore requires the healthy standing simulation for mode restoration'}
    & "$PSScriptRoot/simulation.ps1" Diagnose -Json *> .tools/stage20-before-health.json;if($LASTEXITCODE -ne 0){throw 'Original simulation unhealthy'}
    & node --input-type=module -e "import {chromium} from './gulimall-web/node_modules/@playwright/test/index.mjs';const b=await chromium.launch({headless:true});await b.close();";if($LASTEXITCODE -ne 0){throw 'Install the locked Chromium prerequisites before restoration'}
    $rootIds=@(& docker compose ps -a -q);$originalIds=@(& docker inspect --format '{{.Id}}' @rootIds);if($originalIds.Count -ne 5){throw 'Five original infrastructure containers are required'}
    if(Test-Path -LiteralPath $restoreDirectory){throw 'Private restore directory already exists'}
    New-Item -ItemType Directory -Path $restoreDirectory|Out-Null
    $archive=Join-Path $restoreDirectory 'source.zip'
    & git archive --format=zip --output $archive $tree;if($LASTEXITCODE -ne 0){throw 'Source export failed'}
    Expand-Archive -LiteralPath (Join-Path $restoreDirectory 'source.zip') -DestinationPath $restoreSource
    foreach($module in @('product','member','coupon','ware','order','search','auth-server','third-party','cart','gateway')){New-Item -ItemType Directory -Path (Join-Path $restoreSource "gulimall-$module/target")|Out-Null;Copy-Item -LiteralPath (Join-Path $restoreRoot "gulimall-$module/target/gulimall-$module-0.0.1-SNAPSHOT.jar") -Destination (Join-Path $restoreSource "gulimall-$module/target/")}
    Copy-Item -LiteralPath (Join-Path $restoreRoot 'gulimall-web/dist') -Destination (Join-Path $restoreSource 'gulimall-web/dist') -Recurse
    & "$restoreSource/scripts/setup.ps1"
    $hash=[regex]::Match([IO.File]::ReadAllText((Join-Path $restoreSource 'infra/mysql/002-demo.sql')),"'demo_a',\s*'([^']+)'").Groups[1].Value;if(-not $hash.StartsWith('$2a$')){throw 'Restore admin fixture unavailable'}
    $envFile=Join-Path $restoreSource '.env';$content=[IO.File]::ReadAllText($envFile).Replace('ADMIN_USER=admin','ADMIN_USER=restore_admin').Replace('ADMIN_PASSWORD_HASH=',"ADMIN_PASSWORD_HASH='$hash'");[IO.File]::WriteAllText($envFile,$content,(New-Object Text.UTF8Encoding($false)))
    New-Item -ItemType Directory -Force (Join-Path $restoreSource '.tools'),(Join-Path $restoreSource '.data/empty-init')|Out-Null
    [IO.File]::WriteAllText((Join-Path $restoreSource '.tools/handoff-owner.json'),(@{project=$restoreProject;workspace=$restoreSource}|ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
    [IO.File]::WriteAllText((Join-Path $restoreSource '.tools/restore-admin.json'),(@{username='restore_admin';password='Demo12345!'}|ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
    $context=@{kind='DemoRestore';original=$restoreRoot;source=$restoreSource;project=$restoreProject;backup=$Backup;originalContainers=$originalIds;phase=1;tree=$tree}
    [IO.File]::WriteAllText((Join-Path $restoreSource '.tools/demo-restore-context.json'),($context|ConvertTo-Json -Depth 6),(New-Object Text.UTF8Encoding($false)))
    Restore-LocalEnvironment
    $compose=& docker compose config --format json|ConvertFrom-Json;if($LASTEXITCODE -ne 0){throw 'Isolated Compose derivation failed'}
    $compose.services.mysql.volumes|Where-Object target -eq '/docker-entrypoint-initdb.d'|ForEach-Object {$_.source=(Join-Path $restoreSource '.data/empty-init')}
    $compose.services.mysql.command+=@('--event-scheduler=OFF');$compose.services.redis.command=@('redis-server','/data/restore.conf')
    [IO.File]::WriteAllText((Join-Path $restoreSource 'compose.yaml'),($compose|ConvertTo-Json -Depth 30),(New-Object Text.UTF8Encoding($false)))
    Restore-CallerEnvironment
    $restorePaused=$true;& "$PSScriptRoot/simulation.ps1" Stop
    . "$PSScriptRoot/env.ps1"
    foreach($file in @('.env','.tools/simulation/payment-config.json','.data/simulation/payment/trades.json')){$restoreHashes[$file]=(Get-FileHash -LiteralPath (Join-Path $restoreRoot $file) -Algorithm SHA256).Hash}
    Restore-Dump 'gulimall-demo-mysql-1' (Join-Path $restoreDirectory 'original-before.sql')
    Restore-Docker -Arguments @('compose','stop')
    Restore-LocalEnvironment;$restoreResources=$true
    Restore-Import $Backup 1
    & node "$restoreSource/scripts/demo-restore-runtime.mjs" fixture;if($LASTEXITCODE -ne 0){throw 'Restored original data or fixture setup failed'}
    $env:GULIMALL_DEMO_RESTORE_PHASE='prepare'
    & node gulimall-web/node_modules/@playwright/test/cli.js test --config gulimall-web/demo-restore.config.mjs *> (Join-Path $restoreDirectory 'browser-before.log');if($LASTEXITCODE -ne 0){throw 'Restored browser trade or pending release setup failed'}
    & "$restoreSource/scripts/simulation.ps1" Stop -ProjectName $restoreProject
    $checkpoint=Join-Path $restoreSource '.data/checkpoint';New-Item -ItemType Directory -Path $checkpoint|Out-Null
    Restore-Dump ($restoreProject+'-mysql-1') (Join-Path $checkpoint 'database.sql')
    Restore-Docker -Arguments @('compose','exec','-T','redis','redis-cli','SAVE');Restore-Docker -Arguments @('compose','cp','redis:/data/dump.rdb',(Join-Path $checkpoint 'redis.rdb'))
    Copy-Item -LiteralPath (Join-Path $restoreSource '.data/uploads') -Destination (Join-Path $checkpoint 'uploads') -Recurse;Copy-Item -LiteralPath (Join-Path $restoreSource '.data/simulation/payment/trades.json') -Destination (Join-Path $checkpoint 'payment-ledger.json')
    & node "$restoreSource/scripts/demo-restore-runtime.mjs" checkpoint $checkpoint;if($LASTEXITCODE -ne 0){throw 'Cold checkpoint verification failed'}
    Restore-RemoveResources
    Restore-Import $checkpoint 2
    & node "$restoreSource/scripts/demo-restore-runtime.mjs" compensation;if($LASTEXITCODE -ne 0){throw 'Cold message compensation verification failed'}
    $env:GULIMALL_DEMO_RESTORE_PHASE='continue'
    & node gulimall-web/node_modules/@playwright/test/cli.js test --config gulimall-web/demo-restore.config.mjs *> (Join-Path $restoreDirectory 'browser-after.log');if($LASTEXITCODE -ne 0){throw 'Continuing restored browser trade failed'}
    & node "$restoreSource/scripts/demo-restore-runtime.mjs" final;if($LASTEXITCODE -ne 0){throw 'Final restored business verification failed'}
    & node scripts/demo-restore-guard.mjs verify $Backup $PaymentConfig;if($LASTEXITCODE -ne 0){throw 'Original backup or signing configuration changed'}
    $restorePassed=$true
} finally {
    try{
        if($restoreResources){
            try{& node --input-type=module -e "import {cleanRawBrowserArtifacts} from './scripts/browser-artifacts.mjs';cleanRawBrowserArtifacts()";if($LASTEXITCODE -ne 0){throw 'Raw browser artifact cleanup failed'}}
            finally{Restore-RemoveResources;$restoreCleaned=$true}
        }
    }finally{
        try{
            Restore-CallerEnvironment
            if($restorePaused){
                try{
                    . "$PSScriptRoot/env.ps1";Restore-Docker -Arguments @('compose','up','-d','--wait','--wait-timeout','300')
                    Restore-Dump 'gulimall-demo-mysql-1' (Join-Path $restoreDirectory 'original-after.sql')
                    if((Get-FileHash (Join-Path $restoreDirectory 'original-before.sql')).Hash -ne (Get-FileHash (Join-Path $restoreDirectory 'original-after.sql')).Hash){throw 'Original business SQL changed during isolation'}
                    foreach($file in $restoreHashes.Keys){if((Get-FileHash -LiteralPath (Join-Path $restoreRoot $file)).Hash -ne $restoreHashes[$file]){throw 'Original private configuration or ledger changed'}}
                }finally{& "$PSScriptRoot/simulation.ps1" Start;& "$PSScriptRoot/simulation.ps1" Diagnose -Json *> (Join-Path $restoreDirectory 'original-restored-health.json');if($LASTEXITCODE -ne 0){throw 'Standing simulation did not recover'};$restoreResumed=$true}
            }
            if(Test-Path -LiteralPath $restoreDirectory){[IO.File]::WriteAllText((Join-Path $restoreDirectory 'result.json'),(@{passed=$restorePassed;resourcesCleaned=$restoreCleaned;standingRestored=$restoreResumed;source=$restoreSource;project=$restoreProject;containerGenerations=$restoreContainerIds;realServices=$false}|ConvertTo-Json -Depth 6),(New-Object Text.UTF8Encoding($false)));Write-Output "Private Demo restore evidence: $restoreDirectory"}
        }finally{Restore-CallerEnvironment;Pop-Location}
    }
}
