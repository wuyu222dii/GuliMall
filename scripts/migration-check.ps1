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
    if($code -ne 0){throw ('Isolated migration SQL failed: '+($output -join "`n"))}
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
    $null=Invoke-MigrationSql "CREATE DATABASE gulimall_wms_demo CHARACTER SET utf8mb4; USE gulimall_wms_demo; CREATE TABLE wms_purchase_detail(id BIGINT PRIMARY KEY,sku_num INT); INSERT INTO wms_purchase_detail VALUES(1,3);"
    $demandSql=[IO.File]::ReadAllText((Join-Path $migrationRoot 'infra/migrations/007-procurement-creation.sql'))
    $null=Invoke-MigrationSql $demandSql;$null=Invoke-MigrationSql $demandSql
    if((Invoke-MigrationSql 'SELECT CONCAT(id,CHAR(44),sku_num,CHAR(44),deleted) FROM gulimall_wms_demo.wms_purchase_detail WHERE id=1;') -ne '1,3,0'){throw 'Demand migration changed historical fields'}
    $null=Invoke-MigrationSql "USE gulimall_wms_demo; ALTER TABLE wms_purchase_detail DROP INDEX uk_demand_creation_request; INSERT INTO wms_purchase_detail(id,sku_num,creation_request_id) VALUES(2,1,'$key'),(3,2,'$key');"
    if((Invoke-MigrationSql $demandSql -Reject) -notmatch 'Duplicate demand creation requests'){throw 'Demand migration did not reject duplicates'}
    $null=Invoke-MigrationSql 'DELETE FROM gulimall_wms_demo.wms_purchase_detail WHERE id=3;'
    $null=Invoke-MigrationSql $demandSql
    $null=Invoke-MigrationSql "USE gulimall_wms_demo; UPDATE wms_purchase_detail SET deleted=1 WHERE id=2; INSERT INTO wms_purchase_detail(id,sku_num,creation_request_id) VALUES(4,3,'$key');" -Reject
    if((Invoke-MigrationSql "SELECT COUNT(*) FROM gulimall_wms_demo.wms_purchase_detail WHERE creation_request_id='$key';") -ne '1'){throw 'Deleted demand lost its unique request reservation'}
    Write-Output 'PASS: product/demand additive migrations twice, old fields, duplicate prechecks, unique constraints including deleted demand.'
    $null=Invoke-MigrationSql "CREATE USER 'gulimall'@'%' ACCOUNT LOCK; CREATE DATABASE gulimall_pms_test CHARACTER SET utf8mb4;"
    $fullSql=[IO.File]::ReadAllText((Join-Path $migrationRoot 'infra/mysql/001-schema.sql')) -replace 'gulimall_(pms|sms|ums|oms|wms)_demo','gulimall_$1_test'
    $null=Invoke-MigrationSql $fullSql
    & node (Join-Path $migrationRoot 'scripts/schema-version.mjs') $migrationId test 2
    if($LASTEXITCODE -ne 0){throw 'Empty 72-table Test schema did not match structure version 2'}
    # Construct a legacy fixture only in this newly owned, portless MySQL instance.
    $null=Invoke-MigrationSql 'DROP TABLE gulimall_ums_test.ums_address_creation_receipt; ALTER TABLE gulimall_wms_test.wms_ware_info DROP INDEX uk_ware_creation_request,DROP COLUMN creation_request_id,DROP COLUMN creation_request_hash;'
    & node (Join-Path $migrationRoot 'scripts/schema-version.mjs') $migrationId test 1
    if($LASTEXITCODE -ne 0){throw 'Legacy 71-table Test fixture did not match structure version 1'}
    $null=Invoke-MigrationSql "INSERT INTO gulimall_wms_test.wms_ware_info(id,name,address,areacode) VALUES(1,'迁移前仓库','保留的旧资料','100'); INSERT INTO gulimall_ums_test.ums_member_receive_address(id,member_id,name,phone,province,detail_address,default_status) VALUES(1,1,'旧地址','13800000001','旧省份','不进入回执的正文',1);"
    $wareFields='SELECT id,HEX(name),HEX(address),HEX(areacode) FROM gulimall_wms_test.wms_ware_info ORDER BY id;'
    $addressFields='SELECT id,member_id,HEX(name),HEX(phone),HEX(post_code),HEX(province),HEX(city),HEX(region),HEX(detail_address),HEX(areacode),default_status FROM gulimall_ums_test.ums_member_receive_address ORDER BY id;'
    $wareBefore=Invoke-MigrationSql $wareFields;$addressesBefore=Invoke-MigrationSql $addressFields
    $creationSql=[IO.File]::ReadAllText((Join-Path $migrationRoot 'infra/migrations/008-address-warehouse-creation.sql')) -replace 'gulimall_(ums|wms)_demo','gulimall_$1_test'
    $null=Invoke-MigrationSql $creationSql;$null=Invoke-MigrationSql $creationSql
    if((Invoke-MigrationSql $wareFields) -cne $wareBefore -or (Invoke-MigrationSql $addressFields) -cne $addressesBefore){throw 'Creation receipt migration changed old warehouse or address fields'}
    & node (Join-Path $migrationRoot 'scripts/schema-version.mjs') $migrationId test 2
    if($LASTEXITCODE -ne 0){throw 'Migrated Test schema did not match the exact receipt structure'}
    $null=Invoke-MigrationSql "UPDATE gulimall_wms_test.wms_ware_info SET creation_request_id='$key',creation_request_hash=REPEAT('a',64) WHERE id=1; INSERT INTO gulimall_ums_test.ums_address_creation_receipt VALUES(1,'$key',REPEAT('a',64),1),(2,'$key',REPEAT('b',64),2); DELETE FROM gulimall_ums_test.ums_member_receive_address WHERE id=1;"
    if((Invoke-MigrationSql "INSERT INTO gulimall_ums_test.ums_address_creation_receipt VALUES(1,'$key',REPEAT('a',64),3);" -Reject) -notmatch 'Duplicate entry'){throw 'Member/request receipt uniqueness was not enforced'}
    if((Invoke-MigrationSql "SELECT COUNT(*) FROM gulimall_ums_test.ums_address_creation_receipt WHERE member_id=1 AND creation_request_id='$key';") -ne '1'){throw 'Physical address deletion lost its receipt'}
    if((Invoke-MigrationSql "INSERT INTO gulimall_wms_test.wms_ware_info(id,name,creation_request_id,creation_request_hash) VALUES(2,'重复请求','$key',REPEAT('a',64));" -Reject) -notmatch 'Duplicate entry'){throw 'Warehouse request uniqueness was not enforced'}
    $null=Invoke-MigrationSql "ALTER TABLE gulimall_wms_test.wms_ware_info DROP INDEX uk_ware_creation_request; INSERT INTO gulimall_wms_test.wms_ware_info(id,name,creation_request_id,creation_request_hash) VALUES(3,'预检冲突','$key',REPEAT('b',64));"
    if((Invoke-MigrationSql $creationSql -Reject) -notmatch 'Duplicate warehouse creation requests'){throw 'Warehouse migration did not stop at duplicate metadata'}
    $null=Invoke-MigrationSql 'DELETE FROM gulimall_wms_test.wms_ware_info WHERE id=3;'
    $null=Invoke-MigrationSql $creationSql
    $null=Invoke-MigrationSql 'ALTER TABLE gulimall_ums_test.ums_address_creation_receipt ADD COLUMN address_body TEXT;'
    if((Invoke-MigrationSql $creationSql -Reject) -notmatch 'Unexpected address receipt structure'){throw 'Unexpected receipt body column was silently accepted'}
    $null=Invoke-MigrationSql 'ALTER TABLE gulimall_ums_test.ums_address_creation_receipt DROP COLUMN address_body;'
    $null=Invoke-MigrationSql $creationSql
    & node (Join-Path $migrationRoot 'scripts/schema-version.mjs') $migrationId test 2
    if($LASTEXITCODE -ne 0){throw 'Final Test receipt structure was not valid'}
    Write-Output 'PASS: 008 empty schema, legacy 71 to 72 migration twice, original fields, physical deletion receipts, member/request and warehouse uniqueness, duplicate prechecks and foreign structure rejection.'
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
