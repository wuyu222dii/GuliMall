param([Parameter(Mandatory=$true)][string]$Backup)
$ErrorActionPreference='Stop'
$auditRoot=Split-Path $PSScriptRoot -Parent
$auditOriginal=@{};Get-ChildItem Env:|ForEach-Object {$auditOriginal[$_.Name]=$_.Value}
$auditContainers=@();$auditVolumes=@();$auditDirectory=$null
$auditTag='gulimall-audit-'+[guid]::NewGuid().ToString('N')
function Audit-Docker([string[]]$Arguments){& docker @Arguments;if($LASTEXITCODE -ne 0){throw 'Isolated audit operation failed'}}
Push-Location $auditRoot
try {
    . "$PSScriptRoot/env.ps1"
    if($env:GULIMALL_TEST -eq '1'){throw 'Finish isolated business tests before auditing a Demo backup'}
    $Backup=(Resolve-Path -LiteralPath $Backup).Path
    & node scripts/backup-audit.mjs verify $Backup
    if($LASTEXITCODE -ne 0){throw 'Backup validation failed; no audit resources created'}
    foreach($port in @(3317,6390)){if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "Audit port $port is occupied; no resources created"}}
    $env:MYSQL_PASSWORD=$env:DB_PASSWORD;$env:REDISCLI_AUTH=$env:REDIS_PASSWORD
    $auditMysql=$auditTag+'-mysql';$auditRedis=$auditTag+'-redis'
    $auditContainers=@($auditMysql,$auditRedis)
    $auditDirectory=Join-Path $auditRoot ('.data/'+$auditTag)
    New-Item -ItemType Directory -Path $auditDirectory | Out-Null
    $auditManifest=Get-Content (Join-Path $Backup 'manifest.json') -Raw|ConvertFrom-Json
    foreach($volume in @($auditMysql,$auditRedis)){Audit-Docker -Arguments @('volume','create','--label',('gulimall.audit='+$auditTag),$volume);$auditVolumes+=$volume}
    Audit-Docker -Arguments @('run','-d','--name',$auditMysql,'--label',('gulimall.audit='+$auditTag),'-p','127.0.0.1:3317:3306','-e','MYSQL_ROOT_PASSWORD','-e','MYSQL_PASSWORD','-e','MYSQL_USER=gulimall','-e','MYSQL_DATABASE=restore_empty','-v',($auditMysql+':/var/lib/mysql'),'mysql:8.0.36','--event-scheduler=OFF')
    $ready=$false
    for($attempt=0;$attempt -lt 90;$attempt++){& docker exec $auditMysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h127.0.0.1 -uroot -e "SELECT 1"' *> $null;if($LASTEXITCODE -eq 0){$ready=$true;break};Start-Sleep -Seconds 1}
    if(-not $ready){throw 'Audit MySQL did not initialize'}
    Audit-Docker -Arguments @('cp',(Join-Path $Backup 'database.sql'),($auditMysql+':/tmp/snapshot.sql'))
    Audit-Docker -Arguments @('exec',$auditMysql,'sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot < /tmp/snapshot.sql')
    $grants="REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'gulimall'@'%';"
    foreach($schema in $auditManifest.schemas){$grants+="GRANT SELECT ON ``$schema``.* TO 'gulimall'@'%';"}
    $grants+='SET GLOBAL read_only=ON; SET GLOBAL super_read_only=ON;'
    $grants|& docker exec -i $auditMysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'
    if($LASTEXITCODE -ne 0){throw 'Could not enforce read-only audit access'}
    $hash=[Security.Cryptography.SHA256]::Create()
    try{$passwordHash=([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($env:REDIS_PASSWORD)))).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose()}
    [IO.File]::WriteAllText((Join-Path $auditDirectory 'users.acl'),("user default on #$passwordHash ~* -@all +@read +ping +info +dbsize +scan"+"`n"),(New-Object Text.UTF8Encoding($false)))
    [IO.File]::WriteAllText((Join-Path $auditDirectory 'redis.conf'),"appendonly no`nsave `"`"`naclfile /data/users.acl`n",(New-Object Text.UTF8Encoding($false)))
    Audit-Docker -Arguments @('create','--name',$auditRedis,'--label',('gulimall.audit='+$auditTag),'-p','127.0.0.1:6390:6379','-e','REDISCLI_AUTH','-v',($auditRedis+':/data'),'redis:6.2.16-alpine','redis-server','/data/redis.conf')
    foreach($file in @('users.acl','redis.conf')){Audit-Docker -Arguments @('cp',(Join-Path $auditDirectory $file),($auditRedis+':/data/'+$file))}
    Audit-Docker -Arguments @('cp',(Join-Path $Backup 'redis.rdb'),($auditRedis+':/data/dump.rdb'))
    Audit-Docker -Arguments @('start',$auditRedis)
    $ready=$false
    for($attempt=0;$attempt -lt 30;$attempt++){$pong=& docker exec $auditRedis redis-cli --raw PING 2>$null;if($LASTEXITCODE -eq 0 -and $pong -eq 'PONG'){$ready=$true;break};Start-Sleep -Seconds 1}
    if(-not $ready){throw 'Audit Redis did not load its snapshot'}
    $report=Join-Path $auditRoot ('.tools/'+$auditTag+'.json')
    & node scripts/backup-audit.mjs inspect $Backup $auditMysql $auditRedis $report
    if($LASTEXITCODE -ne 0){throw 'Read-only snapshot audit failed'}
    Write-Output "Audit report saved: $report"
} finally {
    foreach($container in $auditContainers){$owner=& docker inspect --format '{{ index .Config.Labels "gulimall.audit" }}' $container 2>$null;if($LASTEXITCODE -eq 0 -and $owner -eq $auditTag){& docker rm -f $container}}
    foreach($volume in $auditVolumes){$owner=& docker volume inspect --format '{{ index .Labels "gulimall.audit" }}' $volume 2>$null;if($LASTEXITCODE -eq 0 -and $owner -eq $auditTag){& docker volume rm $volume}}
    if($auditDirectory -and (Test-Path -LiteralPath $auditDirectory)){$resolved=[IO.Path]::GetFullPath($auditDirectory);$allowed=[IO.Path]::GetFullPath((Join-Path $auditRoot '.data'))+[IO.Path]::DirectorySeparatorChar;if(-not $resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -ne $auditTag){throw 'Unsafe audit cleanup path'};Remove-Item -LiteralPath $resolved -Recurse -Force}
    Get-ChildItem Env:|Where-Object {-not $auditOriginal.ContainsKey($_.Name)}|ForEach-Object {Remove-Item -LiteralPath ('Env:'+ $_.Name) -ErrorAction SilentlyContinue}
    foreach($key in $auditOriginal.Keys){[Environment]::SetEnvironmentVariable($key,$auditOriginal[$key],'Process')}
    Pop-Location
}
