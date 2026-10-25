-- Run once on an existing demo database after backup. Duplicate checks precede DDL.
USE gulimall_oms_demo;
DELIMITER $$
CREATE PROCEDURE stage6_check_unique()
BEGIN
 IF EXISTS(SELECT order_sn FROM oms_order WHERE order_sn IS NOT NULL GROUP BY order_sn HAVING COUNT(*)>1)
 OR EXISTS(SELECT order_sn FROM gulimall_wms_demo.wms_ware_order_task WHERE order_sn IS NOT NULL GROUP BY order_sn HAVING COUNT(*)>1)
 OR EXISTS(SELECT task_id,sku_id FROM gulimall_wms_demo.wms_ware_order_task_detail GROUP BY task_id,sku_id HAVING COUNT(*)>1)
 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Duplicate order/task records: inspect before migration; no data was removed'; END IF;
END$$
DELIMITER ;
CALL stage6_check_unique();
DROP PROCEDURE stage6_check_unique;
ALTER TABLE oms_order ADD UNIQUE KEY uk_order_sn(order_sn),
 ADD creation_deadline DATETIME NULL, ADD payment_deadline DATETIME NULL,
 ADD cart_cleaned INT NOT NULL DEFAULT 1, ADD failure_reason VARCHAR(255) NULL, ADD recovery_after DATETIME NULL,
 ADD KEY idx_order_recovery(status,cart_cleaned,creation_deadline);
CREATE TABLE oms_order_submit (
 token CHAR(36) NOT NULL PRIMARY KEY,
 member_id BIGINT NOT NULL,
 items_json MEDIUMTEXT NOT NULL,
 expires_at DATETIME NOT NULL,
 address_id BIGINT NULL,
 order_sn VARCHAR(255) NULL,
 UNIQUE KEY uk_submit_order(order_sn), KEY idx_submit_member(member_id,expires_at)
) ENGINE=InnoDB;
ALTER TABLE oms_order_item ADD cart_revision VARCHAR(255) NULL, ADD KEY idx_item_order(order_sn);
USE gulimall_wms_demo;
ALTER TABLE wms_ware_order_task ADD UNIQUE KEY uk_task_order(order_sn), ADD lock_payload MEDIUMTEXT NULL;
ALTER TABLE wms_ware_order_task_detail ADD UNIQUE KEY uk_task_sku(task_id,sku_id);
