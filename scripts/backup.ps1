param([ValidateSet('Demo','Test')][string]$Environment='Demo',[string]$Destination)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
. "$PSScriptRoot/env.ps1"
$taskExpected=if($Environment -eq 'Test'){'gulimall-test'}else{'gulimall-demo'}
if($env:COMPOSE_PROJECT_NAME -and $env:COMPOSE_PROJECT_NAME -ne $taskExpected){throw 'Backup environment does not match active Compose project'}
$taskCompose=& docker compose config --format json | ConvertFrom-Json
if($LASTEXITCODE -ne 0 -or $taskCompose.name -ne $taskExpected){throw 'Compose configuration does not match the requested backup environment'}
if($Environment -eq 'Test'){
    & node --input-type=module -e "import {assertTestEnvironment} from './scripts/test-environment.mjs';await assertTestEnvironment()"
    if($LASTEXITCODE -ne 0){throw 'Test database verification failed'}
}
$taskSuffix=if($Environment -eq 'Test'){'test'}else{'demo'}
$taskSchemas=@('pms','sms','ums','oms','wms') | ForEach-Object {"gulimall_${_}_$taskSuffix"}
if(-not $Destination){$Destination=Join-Path $taskRoot ('.data/backups/'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))}
$Destination=[IO.Path]::GetFullPath($Destination)
if(Test-Path -LiteralPath $Destination){throw 'Backup destination must be a new directory; existing backups are never overwritten'}
New-Item -ItemType Directory -Path $Destination | Out-Null
$taskUpload=if($env:UPLOAD_DIR){if([IO.Path]::IsPathRooted($env:UPLOAD_DIR)){$env:UPLOAD_DIR}else{Join-Path $taskRoot $env:UPLOAD_DIR}}else{Join-Path $taskRoot '.data/uploads'}
$taskTemporary='/tmp/gulimall-backup-'+[guid]::NewGuid().ToString('N')+'.sql'
$taskComplete=$false
Push-Location $taskRoot
try {
    & "$PSScriptRoot/services.ps1" Stop
    $taskDump='MYSQL_PWD="$MYSQL_PASSWORD" mysqldump -ugulimall --single-transaction --no-tablespaces --hex-blob --set-gtid-purged=OFF --routines --events --triggers --databases '+($taskSchemas -join ' ')+' > '+$taskTemporary
    & docker compose exec -T mysql sh -c $taskDump
    if($LASTEXITCODE -ne 0){throw 'Database dump failed'}
    & docker compose cp ("mysql:"+$taskTemporary) (Join-Path $Destination 'database.sql')
    if($LASTEXITCODE -ne 0){throw 'Database backup copy failed'}
    & docker compose exec -T redis redis-cli SAVE
    if($LASTEXITCODE -ne 0){throw 'Redis snapshot failed'}
    & docker compose cp redis:/data/dump.rdb (Join-Path $Destination 'redis.rdb')
    if($LASTEXITCODE -ne 0){throw 'Redis backup copy failed'}
    if(Test-Path -LiteralPath $taskUpload){Copy-Item -LiteralPath $taskUpload -Destination (Join-Path $Destination 'uploads') -Recurse}else{New-Item -ItemType Directory (Join-Path $Destination 'uploads') | Out-Null}
    $taskFiles=@(Get-ChildItem -LiteralPath $Destination -File -Recurse | ForEach-Object {@{path=$_.FullName.Substring($Destination.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}})
    $taskManifest=@{format=1;createdUtc=[DateTime]::UtcNow.ToString('o');environment=$Environment;schemas=$taskSchemas;files=$taskFiles;mysql='8.0.36';redis='6.2.16';queueRecovery='SQL outbox and order scanner';searchRecovery='rebuild from product database'}
    [IO.File]::WriteAllText((Join-Path $Destination 'manifest.json'),($taskManifest|ConvertTo-Json -Depth 6),(New-Object Text.UTF8Encoding($false)))
    $taskComplete=$true;Write-Output "Consistent database, Redis and uploads backup saved: $Destination"
}finally{
    & docker compose exec -T mysql rm -f -- $taskTemporary
    & "$PSScriptRoot/services.ps1" Start
    Pop-Location
    if(-not $taskComplete){Write-Warning 'Backup incomplete; no valid manifest was written. Source data was not overwritten.'}
}
