-- Forward-only additive migration. Back up Demo before applying; never reinitialize it.
USE gulimall_wms_demo;
DROP PROCEDURE IF EXISTS gulimall_migrate_demand_creation_007;
DELIMITER //
CREATE PROCEDURE gulimall_migrate_demand_creation_007()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wms_purchase_detail' AND column_name='creation_request_id') THEN
    ALTER TABLE wms_purchase_detail ADD COLUMN creation_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wms_purchase_detail' AND column_name='creation_request_hash') THEN
    ALTER TABLE wms_purchase_detail ADD COLUMN creation_request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wms_purchase_detail' AND column_name='deleted') THEN
    ALTER TABLE wms_purchase_detail ADD COLUMN deleted TINYINT NOT NULL DEFAULT 0;
  END IF;
  IF EXISTS (SELECT creation_request_id FROM wms_purchase_detail WHERE creation_request_id IS NOT NULL GROUP BY creation_request_id HAVING COUNT(*)>1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Duplicate demand creation requests; inspect before adding uniqueness';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='wms_purchase_detail' AND index_name='uk_demand_creation_request') THEN
    ALTER TABLE wms_purchase_detail ADD UNIQUE KEY uk_demand_creation_request (creation_request_id);
  END IF;
END//
DELIMITER ;
CALL gulimall_migrate_demand_creation_007();
DROP PROCEDURE gulimall_migrate_demand_creation_007;
