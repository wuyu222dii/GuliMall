-- Existing demo database only. Check duplicate (sku_id, ware_id) rows first.
-- Do not merge or delete inventory automatically, and do not run twice.
USE gulimall_wms_demo;
ALTER TABLE wms_ware_sku ADD UNIQUE KEY uk_ware_sku (sku_id, ware_id);
ALTER TABLE wms_purchase_detail ADD COLUMN failure_reason VARCHAR(255) NULL;
