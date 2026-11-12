-- Forward-only: test this migration first, and cold-back up Demo before applying it.
USE gulimall_ums_demo;
DROP PROCEDURE IF EXISTS gulimall_migrate_address_creation_008;
DELIMITER //
CREATE PROCEDURE gulimall_migrate_address_creation_008()
BEGIN
  -- There is deliberately no address FK: physical deletion must retain the receipt.
  CREATE TABLE IF NOT EXISTS ums_address_creation_receipt (
    member_id BIGINT NOT NULL,
    creation_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    creation_request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    address_id BIGINT NOT NULL,
    PRIMARY KEY (member_id,creation_request_id)
  ) ENGINE=InnoDB;
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='ums_address_creation_receipt')<>4
     OR (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='ums_address_creation_receipt' AND is_nullable='NO' AND
        ((column_name IN ('member_id','address_id') AND data_type='bigint')
         OR (column_name='creation_request_id' AND data_type='char' AND character_maximum_length=36 AND collation_name='ascii_bin')
         OR (column_name='creation_request_hash' AND data_type='char' AND character_maximum_length=64 AND collation_name='ascii_bin')))<>4
     OR (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='ums_address_creation_receipt' AND index_name='PRIMARY')<>2
     OR (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='ums_address_creation_receipt' AND index_name='PRIMARY' AND
         ((seq_in_index=1 AND column_name='member_id') OR (seq_in_index=2 AND column_name='creation_request_id')))<>2
     OR EXISTS(SELECT 1 FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() AND table_name='ums_address_creation_receipt')
     OR NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='ums_address_creation_receipt' AND engine='InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unexpected address receipt structure; inspect without replacing existing data';
  END IF;
  IF EXISTS(SELECT 1 FROM ums_address_creation_receipt WHERE member_id<1 OR address_id<1
      OR NOT REGEXP_LIKE(creation_request_id,'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$','c')
      OR NOT REGEXP_LIKE(creation_request_hash,'^[a-f0-9]{64}$','c')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid address receipt metadata; inspect before migration';
  END IF;
END//
DELIMITER ;
CALL gulimall_migrate_address_creation_008();
DROP PROCEDURE gulimall_migrate_address_creation_008;

USE gulimall_wms_demo;
DROP PROCEDURE IF EXISTS gulimall_migrate_warehouse_creation_008;
DELIMITER //
CREATE PROCEDURE gulimall_migrate_warehouse_creation_008()
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wms_ware_info' AND column_name='creation_request_id') THEN
    ALTER TABLE wms_ware_info ADD COLUMN creation_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wms_ware_info' AND column_name='creation_request_hash') THEN
    ALTER TABLE wms_ware_info ADD COLUMN creation_request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL;
  END IF;
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wms_ware_info' AND is_nullable='YES' AND data_type='char' AND collation_name='ascii_bin' AND
      ((column_name='creation_request_id' AND character_maximum_length=36) OR (column_name='creation_request_hash' AND character_maximum_length=64)))<>2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unexpected warehouse creation columns; inspect without replacing existing data';
  END IF;
  IF EXISTS(SELECT creation_request_id FROM wms_ware_info WHERE creation_request_id IS NOT NULL GROUP BY creation_request_id HAVING COUNT(*)>1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Duplicate warehouse creation requests; inspect before adding uniqueness';
  END IF;
  IF EXISTS(SELECT 1 FROM wms_ware_info WHERE (creation_request_id IS NULL AND creation_request_hash IS NOT NULL)
      OR (creation_request_id IS NOT NULL AND (creation_request_hash IS NULL
          OR NOT REGEXP_LIKE(creation_request_id,'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$','c')
          OR NOT REGEXP_LIKE(creation_request_hash,'^[a-f0-9]{64}$','c')))) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid warehouse creation metadata; inspect before migration';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='wms_ware_info' AND index_name='uk_ware_creation_request') THEN
    ALTER TABLE wms_ware_info ADD UNIQUE KEY uk_ware_creation_request(creation_request_id);
  END IF;
  IF (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='wms_ware_info' AND index_name='uk_ware_creation_request')<>1
     OR NOT EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='wms_ware_info' AND index_name='uk_ware_creation_request' AND non_unique=0 AND column_name='creation_request_id' AND sub_part IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unexpected warehouse creation index; inspect without dropping existing indexes';
  END IF;
END//
DELIMITER ;
CALL gulimall_migrate_warehouse_creation_008();
DROP PROCEDURE gulimall_migrate_warehouse_creation_008;
