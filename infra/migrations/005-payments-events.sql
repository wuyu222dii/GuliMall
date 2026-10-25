-- Existing demo database: stop services, back up, inspect duplicates, then run once.
USE gulimall_oms_demo;
DELIMITER $$
CREATE PROCEDURE stage7_check_unique()
BEGIN
 IF EXISTS(SELECT alipay_trade_no FROM oms_payment_info WHERE alipay_trade_no IS NOT NULL GROUP BY alipay_trade_no HAVING COUNT(*)>1)
 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Duplicate payment trade numbers; inspect without deleting data'; END IF;
END$$
DELIMITER ;
CALL stage7_check_unique();
DROP PROCEDURE stage7_check_unique;
ALTER TABLE oms_payment_info ADD UNIQUE KEY uk_payment_trade(alipay_trade_no),
 ADD exception_reason VARCHAR(255) NULL;
ALTER TABLE oms_order ADD payment_started INT NOT NULL DEFAULT 0,
 ADD payment_trade_no VARCHAR(255) NULL, ADD inventory_status INT NOT NULL DEFAULT 0;
CREATE TABLE oms_trade_event (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 order_sn VARCHAR(255) NOT NULL,
 event_type VARCHAR(32) NOT NULL,
 created_at DATETIME NOT NULL,
 next_attempt DATETIME NOT NULL,
 attempts INT NOT NULL DEFAULT 0,
 sent_at DATETIME NULL,
 consumed_at DATETIME NULL,
 last_error VARCHAR(255) NULL,
 UNIQUE KEY uk_trade_event(order_sn,event_type),
 KEY idx_trade_event_due(consumed_at,next_attempt)
) ENGINE=InnoDB;
