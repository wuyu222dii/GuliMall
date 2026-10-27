$ErrorActionPreference='Stop'
$migrationRoot=Split-Path $PSScriptRoot -Parent
$migrationTag=[guid]::NewGuid().ToString('N')
$migrationName='gulimall-migration-'+$migrationTag
$migrationId=$null
$migrationPreviousPassword=[Environment]::GetEnvironmentVariable('MYSQL_ROOT_PASSWORD','Process')
$migrationRandom=[Security.Cryptography.RandomNumberGenerator]::Create()
function Invoke-MigrationSql([string]$Sql,[switch]$Reject) {
    $previousPreference=$ErrorActionPreference
    try {
        $ErrorActionPreference='Continue'
        $output=$Sql|& docker exec -i $migrationId sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 --batch --skip-column-names' 2>&1
        $code=$LASTEXITCODE
    } finally { $ErrorActionPreference=$previousPreference }
    if($Reject){if($code -eq 0){throw 'Invalid duplicate migration was accepted'};return ($output -join "`n")}
    if($code -ne 0){throw 'Isolated migration SQL failed'}
    return ($output -join "`n")
}
try {
    $bytes=New-Object byte[] 24;$migrationRandom.GetBytes($bytes);$env:MYSQL_ROOT_PASSWORD=[Convert]::ToBase64String($bytes)
    $migrationId=(& docker run -d --rm --name $migrationName --label ('gulimall.migration-check='+$migrationTag) -e MYSQL_ROOT_PASSWORD mysql:8.0.36).Trim()
    if($LASTEXITCODE -ne 0 -or $migrationId -notmatch '^[a-f0-9]{64}$'){throw 'Cannot create isolated migration instance'}
    $ready=$false
    for($i=0;$i -lt 90;$i++){& docker exec $migrationId sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h127.0.0.1 -uroot -e "SELECT 1"' *> $null;if($LASTEXITCODE -eq 0){$ready=$true;break};Start-Sleep -Seconds 1}
    if(-not $ready){throw 'Migration instance not ready'}
    $null=Invoke-MigrationSql "CREATE DATABASE gulimall_pms_demo CHARACTER SET utf8mb4; USE gulimall_pms_demo; CREATE TABLE pms_spu_info(id BIGINT PRIMARY KEY,spu_name VARCHAR(100)); INSERT INTO pms_spu_info VALUES(1,'迁移前商品');"
    $before=Invoke-MigrationSql 'SELECT id,HEX(spu_name) FROM gulimall_pms_demo.pms_spu_info ORDER BY id;'
    $sql=[IO.File]::ReadAllText((Join-Path $migrationRoot 'infra/migrations/006-product-creation.sql'))
    $null=Invoke-MigrationSql $sql;$null=Invoke-MigrationSql $sql
    if((Invoke-MigrationSql 'SELECT id,HEX(spu_name) FROM gulimall_pms_demo.pms_spu_info ORDER BY id;') -ne $before){throw 'Migration changed old data'}
    $key=[guid]::NewGuid().ToString()
    $null=Invoke-MigrationSql "USE gulimall_pms_demo; ALTER TABLE pms_spu_info DROP INDEX uk_spu_creation_request; INSERT INTO pms_spu_info VALUES(2,'duplicate A','$key',REPEAT('a',64)),(3,'duplicate B','$key',REPEAT('b',64));"
    if((Invoke-MigrationSql $sql -Reject) -notmatch 'Duplicate product creation requests'){throw 'Migration did not reject duplicates before index creation'}
    $null=Invoke-MigrationSql "DELETE FROM gulimall_pms_demo.pms_spu_info WHERE id IN (2,3) AND creation_request_id='$key';"
    $null=Invoke-MigrationSql $sql
    $null=Invoke-MigrationSql "INSERT INTO gulimall_pms_demo.pms_spu_info VALUES(4,'first','$key',REPEAT('a',64));"
    $null=Invoke-MigrationSql "INSERT INTO gulimall_pms_demo.pms_spu_info VALUES(5,'second','$key',REPEAT('a',64));" -Reject
    if((Invoke-MigrationSql "SELECT COUNT(*) FROM gulimall_pms_demo.pms_spu_info WHERE creation_request_id='$key';") -ne '1'){throw 'Unique creation index did not hold'}
    Write-Output 'PASS: fresh unpublished MySQL, additive migration twice, UTF-8 preservation, duplicate precheck and actual unique constraint.'
} finally {
    try {
        if($migrationId -and $migrationId -match '^[a-f0-9]{64}$'){
            $owner=& docker inspect --format '{{index .Config.Labels "gulimall.migration-check"}}' $migrationId
            if($LASTEXITCODE -ne 0 -or $owner -ne $migrationTag){throw 'Refusing to stop an unowned migration instance'}
            & docker stop $migrationId | Out-Null
            if($LASTEXITCODE -ne 0){throw 'Migration instance cleanup failed'}
        }
    } finally {
        $migrationRandom.Dispose()
        if($null -eq $migrationPreviousPassword){Remove-Item Env:MYSQL_ROOT_PASSWORD -ErrorAction SilentlyContinue}else{[Environment]::SetEnvironmentVariable('MYSQL_ROOT_PASSWORD',$migrationPreviousPassword,'Process')}
    }
}
