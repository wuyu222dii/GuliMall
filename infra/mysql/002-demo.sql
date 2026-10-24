-- Fixtures for freshly initialized demo databases only. Not an upgrade script.
SET NAMES utf8mb4;
START TRANSACTION;
USE gulimall_pms_demo;

INSERT INTO pms_category (cat_id, name, parent_cid, cat_level, show_status, sort, product_unit, product_count) VALUES
  (900001, '演示数码', 0, 1, 1, 0, '件', 1),
  (900002, '演示手机', 900001, 2, 1, 0, '件', 1),
  (900003, '智能手机', 900002, 3, 1, 0, '件', 1);
INSERT INTO pms_brand (brand_id, name, logo, descript, show_status, first_letter, sort) VALUES
  (900001, 'DemoTech', '/demo-product.svg', '演示品牌', 1, 'D', 0);
INSERT INTO pms_category_brand_relation (id, brand_id, catelog_id, brand_name, catelog_name) VALUES
  (900001, 900001, 900003, 'DemoTech', '智能手机');
INSERT INTO pms_attr_group (attr_group_id, attr_group_name, sort, descript, icon, catelog_id) VALUES
  (900001, '基本参数', 0, '演示规格参数', '', 900003);
INSERT INTO pms_attr (attr_id, attr_name, search_type, value_type, value_select, attr_type, enable, catelog_id, show_desc) VALUES
  (900001, '内存', 1, 0, '8GB;16GB', 1, 1, 900003, 1),
  (900002, '颜色', 0, 1, '红色;蓝色', 0, 1, 900003, 1);
INSERT INTO pms_attr_attrgroup_relation (id, attr_id, attr_group_id, attr_sort) VALUES
  (900001, 900001, 900001, 0);
INSERT INTO pms_spu_info (id, spu_name, spu_description, catalog_id, brand_id, weight, publish_status, create_time, update_time) VALUES
  (900001, 'Demo Phone', '仅用于本地开发和验收的多 SKU 商品', 900003, 900001, 0.2, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP());
INSERT INTO pms_spu_info_desc (spu_id, decript) VALUES (900001, '/demo-product.svg');
INSERT INTO pms_spu_images (id, spu_id, img_name, img_url, img_sort, default_img) VALUES
  (900001, 900001, 'Demo Phone', '/demo-product.svg', 0, 1);
INSERT INTO pms_product_attr_value (id, spu_id, attr_id, attr_name, attr_value, attr_sort, quick_show) VALUES
  (900001, 900001, 900001, '内存', '8GB', 0, 1);
INSERT INTO pms_sku_info (sku_id, spu_id, sku_name, sku_desc, catalog_id, brand_id, sku_default_img, sku_title, sku_subtitle, price, sale_count) VALUES
  (900001, 900001, 'Demo Phone 红色 8GB', '演示 SKU 红色', 900003, 900001, '/demo-product.svg', 'Demo Phone 红色 8GB', '演示商品', 1999.00, 0),
  (900002, 900001, 'Demo Phone 蓝色 8GB', '演示 SKU 蓝色', 900003, 900001, '/demo-product.svg', 'Demo Phone 蓝色 8GB', '演示商品', 2099.00, 0);
INSERT INTO pms_sku_images (id, sku_id, img_url, img_sort, default_img) VALUES
  (900001, 900001, '/demo-product.svg', 0, 1),
  (900002, 900002, '/demo-product.svg', 0, 1);
INSERT INTO pms_sku_sale_attr_value (id, sku_id, attr_id, attr_name, attr_value, attr_sort) VALUES
  (900001, 900001, 900002, '颜色', '红色', 0),
  (900002, 900002, 900002, '颜色', '蓝色', 0);

USE gulimall_ums_demo;
INSERT INTO ums_member_level (id, name, growth_point, default_status) VALUES (900001, '演示会员', 0, 1);
-- Both demo accounts: Demo12345! (BCrypt). Login is implemented in stage 1.
INSERT INTO ums_member (id, level_id, username, password, nickname, mobile, status, integration, growth, create_time) VALUES
  (900001, 900001, 'demo_a', '$2a$10$PsG6KDbwvIJge8jv6eTqyOoRK.Rdh2ySm6QorJ3jfigbot1xAhFs2', '演示会员 A', '13900000001', 1, 0, 0, UTC_TIMESTAMP()),
  (900002, 900001, 'demo_b', '$2a$10$PsG6KDbwvIJge8jv6eTqyOoRK.Rdh2ySm6QorJ3jfigbot1xAhFs2', '演示会员 B', '13900000002', 1, 0, 0, UTC_TIMESTAMP());
INSERT INTO ums_member_receive_address (id, member_id, name, phone, post_code, province, city, region, detail_address, default_status) VALUES
  (900001, 900001, '演示收件人 A', '13900000001', '100000', '演示省', '演示市', '演示区', '演示路 1 号', 1),
  (900002, 900002, '演示收件人 B', '13900000002', '100000', '演示省', '演示市', '演示区', '演示路 2 号', 1);

USE gulimall_wms_demo;
INSERT INTO wms_ware_info (id, name, address, areacode) VALUES (900001, '演示仓库', '演示仓库地址', '000000');
INSERT INTO wms_ware_sku (id, sku_id, ware_id, stock, sku_name, stock_locked) VALUES
  (900001, 900001, 900001, 10, 'Demo Phone 红色 8GB', 0),
  (900002, 900002, 900001, 1, 'Demo Phone 蓝色 8GB', 0);
COMMIT;
