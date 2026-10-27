-- Forward-only additive migration. Back up Demo first; never reinitialize an existing database.
USE gulimall_pms_demo;
DROP PROCEDURE IF EXISTS gulimall_migrate_product_creation_006;
DELIMITER //
CREATE PROCEDURE gulimall_migrate_product_creation_006()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='pms_spu_info' AND column_name='creation_request_id') THEN
    ALTER TABLE pms_spu_info ADD COLUMN creation_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='pms_spu_info' AND column_name='creation_request_hash') THEN
    ALTER TABLE pms_spu_info ADD COLUMN creation_request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL;
  END IF;
  IF EXISTS (SELECT creation_request_id FROM pms_spu_info WHERE creation_request_id IS NOT NULL GROUP BY creation_request_id HAVING COUNT(*)>1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Duplicate product creation requests; inspect before adding uniqueness';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='pms_spu_info' AND index_name='uk_spu_creation_request') THEN
    ALTER TABLE pms_spu_info ADD UNIQUE KEY uk_spu_creation_request (creation_request_id);
  END IF;
END//
DELIMITER ;
CALL gulimall_migrate_product_creation_006();
DROP PROCEDURE gulimall_migrate_product_creation_006;
