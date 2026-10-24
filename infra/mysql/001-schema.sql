-- Empty DEMO databases only. Never apply this baseline to an existing installation.

SET NAMES utf8mb4;

USE `gulimall_pms_demo`;

CREATE TABLE `pms_attr_attrgroup_relation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `attr_id` BIGINT,
  `attr_group_id` BIGINT,
  `attr_sort` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_attr` (
  `attr_id` BIGINT NOT NULL AUTO_INCREMENT,
  `attr_name` VARCHAR(255),
  `search_type` INT,
  `value_type` INT,
  `icon` VARCHAR(1024),
  `value_select` VARCHAR(255),
  `attr_type` INT,
  `enable` BIGINT,
  `catelog_id` BIGINT,
  `show_desc` INT,
  PRIMARY KEY (`attr_id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_attr_group` (
  `attr_group_id` BIGINT NOT NULL AUTO_INCREMENT,
  `attr_group_name` VARCHAR(255),
  `sort` INT NOT NULL DEFAULT 0,
  `descript` TEXT,
  `icon` VARCHAR(1024),
  `catelog_id` BIGINT,
  PRIMARY KEY (`attr_group_id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_brand` (
  `brand_id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255),
  `logo` VARCHAR(1024),
  `descript` TEXT,
  `show_status` INT,
  `first_letter` VARCHAR(255),
  `sort` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`brand_id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_category_brand_relation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `brand_id` BIGINT,
  `catelog_id` BIGINT,
  `brand_name` VARCHAR(255),
  `catelog_name` VARCHAR(255),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_category` (
  `cat_id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255),
  `parent_cid` BIGINT,
  `cat_level` INT,
  `show_status` INT,
  `sort` INT NOT NULL DEFAULT 0,
  `icon` VARCHAR(1024),
  `product_unit` VARCHAR(255),
  `product_count` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`cat_id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_comment_replay` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `comment_id` BIGINT,
  `reply_id` BIGINT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_product_attr_value` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `spu_id` BIGINT,
  `attr_id` BIGINT,
  `attr_name` VARCHAR(255),
  `attr_value` VARCHAR(255),
  `attr_sort` INT,
  `quick_show` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_sku_images` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sku_id` BIGINT,
  `img_url` VARCHAR(1024),
  `img_sort` INT,
  `default_img` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_sku_info` (
  `sku_id` BIGINT NOT NULL AUTO_INCREMENT,
  `spu_id` BIGINT,
  `sku_name` VARCHAR(255),
  `sku_desc` TEXT,
  `catalog_id` BIGINT,
  `brand_id` BIGINT,
  `sku_default_img` VARCHAR(1024),
  `sku_title` VARCHAR(255),
  `sku_subtitle` VARCHAR(255),
  `price` DECIMAL(20,2),
  `sale_count` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`sku_id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_sku_sale_attr_value` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sku_id` BIGINT,
  `attr_id` BIGINT,
  `attr_name` VARCHAR(255),
  `attr_value` VARCHAR(255),
  `attr_sort` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_spu_comment` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sku_id` BIGINT,
  `spu_id` BIGINT,
  `spu_name` VARCHAR(255),
  `member_nick_name` VARCHAR(255),
  `star` INT,
  `member_ip` VARCHAR(255),
  `create_time` DATETIME,
  `show_status` INT,
  `spu_attributes` VARCHAR(255),
  `likes_count` INT,
  `reply_count` INT,
  `resources` VARCHAR(255),
  `content` TEXT,
  `member_icon` VARCHAR(1024),
  `comment_type` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_spu_images` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `spu_id` BIGINT,
  `img_name` VARCHAR(1024),
  `img_url` VARCHAR(1024),
  `img_sort` INT,
  `default_img` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_spu_info_desc` (
  `spu_id` BIGINT NOT NULL AUTO_INCREMENT,
  `decript` TEXT,
  PRIMARY KEY (`spu_id`)
) ENGINE=InnoDB;

CREATE TABLE `pms_spu_info` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `spu_name` VARCHAR(255),
  `spu_description` TEXT,
  `catalog_id` BIGINT,
  `brand_id` BIGINT,
  `weight` DECIMAL(20,4),
  `publish_status` INT,
  `create_time` DATETIME,
  `update_time` DATETIME,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

GRANT ALL PRIVILEGES ON `gulimall_pms_demo`.* TO 'gulimall'@'%';

CREATE DATABASE `gulimall_sms_demo` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `gulimall_sms_demo`;

CREATE TABLE `sms_coupon` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `coupon_type` INT,
  `coupon_img` VARCHAR(1024),
  `coupon_name` VARCHAR(255),
  `num` INT,
  `amount` DECIMAL(20,2),
  `per_limit` INT,
  `min_point` DECIMAL(20,4),
  `start_time` DATETIME,
  `end_time` DATETIME,
  `use_type` INT,
  `note` VARCHAR(255),
  `publish_count` INT,
  `use_count` INT,
  `receive_count` INT,
  `enable_start_time` DATETIME,
  `enable_end_time` DATETIME,
  `code` VARCHAR(255),
  `member_level` INT,
  `publish` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_coupon_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `coupon_id` BIGINT,
  `member_id` BIGINT,
  `member_nick_name` VARCHAR(255),
  `get_type` INT,
  `create_time` DATETIME,
  `use_type` INT,
  `use_time` DATETIME,
  `order_id` BIGINT,
  `order_sn` BIGINT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_coupon_spu_category_relation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `coupon_id` BIGINT,
  `category_id` BIGINT,
  `category_name` VARCHAR(255),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_coupon_spu_relation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `coupon_id` BIGINT,
  `spu_id` BIGINT,
  `spu_name` VARCHAR(255),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_home_adv` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255),
  `pic` VARCHAR(255),
  `start_time` DATETIME,
  `end_time` DATETIME,
  `status` INT,
  `click_count` INT,
  `url` VARCHAR(1024),
  `note` VARCHAR(255),
  `sort` INT NOT NULL DEFAULT 0,
  `publisher_id` BIGINT,
  `auth_id` BIGINT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_home_subject` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255),
  `title` VARCHAR(255),
  `sub_title` VARCHAR(255),
  `status` INT,
  `url` VARCHAR(1024),
  `sort` INT NOT NULL DEFAULT 0,
  `img` VARCHAR(1024),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_home_subject_spu` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255),
  `subject_id` BIGINT,
  `spu_id` BIGINT,
  `sort` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_member_price` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sku_id` BIGINT,
  `member_level_id` BIGINT,
  `member_level_name` VARCHAR(255),
  `member_price` DECIMAL(20,2),
  `add_other` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_seckill_promotion` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255),
  `start_time` DATETIME,
  `end_time` DATETIME,
  `status` INT,
  `create_time` DATETIME,
  `user_id` BIGINT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_seckill_session` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255),
  `start_time` DATETIME,
  `end_time` DATETIME,
  `status` INT,
  `create_time` DATETIME,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_seckill_sku_notice` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `member_id` BIGINT,
  `sku_id` BIGINT,
  `session_id` BIGINT,
  `subcribe_time` DATETIME,
  `send_time` DATETIME,
  `notice_type` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_seckill_sku_relation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `promotion_id` BIGINT,
  `promotion_session_id` BIGINT,
  `sku_id` BIGINT,
  `seckill_price` DECIMAL(20,2),
  `seckill_count` INT,
  `seckill_limit` INT,
  `seckill_sort` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_sku_full_reduction` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sku_id` BIGINT,
  `full_price` DECIMAL(20,2),
  `reduce_price` DECIMAL(20,2),
  `add_other` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_sku_ladder` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sku_id` BIGINT,
  `full_count` INT,
  `discount` DECIMAL(20,4),
  `price` DECIMAL(20,2),
  `add_other` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_spu_bounds` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `spu_id` BIGINT,
  `grow_bounds` DECIMAL(20,4),
  `buy_bounds` DECIMAL(20,4),
  `work` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

GRANT ALL PRIVILEGES ON `gulimall_sms_demo`.* TO 'gulimall'@'%';

CREATE DATABASE `gulimall_ums_demo` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `gulimall_ums_demo`;

CREATE TABLE `ums_growth_change_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `member_id` BIGINT,
  `create_time` DATETIME,
  `change_count` INT,
  `note` VARCHAR(255),
  `source_type` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `ums_integration_change_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `member_id` BIGINT,
  `create_time` DATETIME,
  `change_count` INT,
  `note` VARCHAR(255),
  `source_tyoe` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `ums_member_collect_spu` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `member_id` BIGINT,
  `spu_id` BIGINT,
  `spu_name` VARCHAR(255),
  `spu_img` VARCHAR(1024),
  `create_time` DATETIME,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `ums_member_collect_subject` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `subject_id` BIGINT,
  `subject_name` VARCHAR(255),
  `subject_img` VARCHAR(1024),
  `subject_urll` VARCHAR(1024),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `ums_member` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `level_id` BIGINT,
  `username` VARCHAR(255),
  `password` VARCHAR(255),
  `nickname` VARCHAR(255),
  `mobile` VARCHAR(255),
  `email` VARCHAR(255),
  `header` VARCHAR(1024),
  `gender` INT,
  `birth` DATETIME,
  `city` VARCHAR(255),
  `job` VARCHAR(255),
  `sign` VARCHAR(255),
  `source_type` INT,
  `integration` INT,
  `growth` INT,
  `status` INT,
  `create_time` DATETIME,
  `social_uid` VARCHAR(255),
  `access_token` VARCHAR(1024),
  `expires_in` VARCHAR(255),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_username` (`username`),
  UNIQUE KEY `uk_member_mobile` (`mobile`)
) ENGINE=InnoDB;

CREATE TABLE `ums_member_level` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255),
  `growth_point` INT,
  `default_status` INT,
  `free_freight_point` DECIMAL(20,4),
  `comment_growth_point` INT,
  `priviledge_free_freight` INT,
  `priviledge_member_price` INT,
  `priviledge_birthday` INT,
  `note` VARCHAR(255),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `ums_member_login_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `member_id` BIGINT,
  `create_time` DATETIME,
  `ip` VARCHAR(255),
  `city` VARCHAR(255),
  `login_type` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `ums_member_receive_address` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `member_id` BIGINT,
  `name` VARCHAR(255),
  `phone` VARCHAR(255),
  `post_code` VARCHAR(255),
  `province` VARCHAR(255),
  `city` VARCHAR(255),
  `region` VARCHAR(255),
  `detail_address` VARCHAR(255),
  `areacode` VARCHAR(255),
  `default_status` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `ums_member_statistics_info` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `member_id` BIGINT,
  `consume_amount` DECIMAL(20,2),
  `coupon_amount` DECIMAL(20,2),
  `order_count` INT,
  `coupon_count` INT,
  `comment_count` INT,
  `return_order_count` INT,
  `login_count` INT,
  `attend_count` INT,
  `fans_count` INT,
  `collect_product_count` INT,
  `collect_subject_count` INT,
  `collect_comment_count` INT,
  `invite_friend_count` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_coupon` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `coupon_type` INT,
  `coupon_img` VARCHAR(1024),
  `coupon_name` VARCHAR(255),
  `num` INT,
  `amount` DECIMAL(20,2),
  `per_limit` INT,
  `min_point` DECIMAL(20,4),
  `start_time` DATETIME,
  `end_time` DATETIME,
  `use_type` INT,
  `note` VARCHAR(255),
  `publish_count` INT,
  `use_count` INT,
  `receive_count` INT,
  `enable_start_time` DATETIME,
  `enable_end_time` DATETIME,
  `code` VARCHAR(255),
  `member_level` INT,
  `publish` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_coupon_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `coupon_id` BIGINT,
  `member_id` BIGINT,
  `member_nick_name` VARCHAR(255),
  `get_type` INT,
  `create_time` DATETIME,
  `use_type` INT,
  `use_time` DATETIME,
  `order_id` BIGINT,
  `order_sn` BIGINT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_coupon_spu_category_relation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `coupon_id` BIGINT,
  `category_id` BIGINT,
  `category_name` VARCHAR(255),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_coupon_spu_relation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `coupon_id` BIGINT,
  `spu_id` BIGINT,
  `spu_name` VARCHAR(255),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_home_adv` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255),
  `pic` VARCHAR(255),
  `start_time` DATETIME,
  `end_time` DATETIME,
  `status` INT,
  `click_count` INT,
  `url` VARCHAR(1024),
  `note` VARCHAR(255),
  `sort` INT NOT NULL DEFAULT 0,
  `publisher_id` BIGINT,
  `auth_id` BIGINT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_home_subject` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255),
  `title` VARCHAR(255),
  `sub_title` VARCHAR(255),
  `status` INT,
  `url` VARCHAR(1024),
  `sort` INT NOT NULL DEFAULT 0,
  `img` VARCHAR(1024),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_home_subject_spu` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255),
  `subject_id` BIGINT,
  `spu_id` BIGINT,
  `sort` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_member_price` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sku_id` BIGINT,
  `member_level_id` BIGINT,
  `member_level_name` VARCHAR(255),
  `member_price` DECIMAL(20,2),
  `add_other` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_seckill_promotion` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255),
  `start_time` DATETIME,
  `end_time` DATETIME,
  `status` INT,
  `create_time` DATETIME,
  `user_id` BIGINT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_seckill_session` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255),
  `start_time` DATETIME,
  `end_time` DATETIME,
  `status` INT,
  `create_time` DATETIME,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_seckill_sku_notice` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `member_id` BIGINT,
  `sku_id` BIGINT,
  `session_id` BIGINT,
  `subcribe_time` DATETIME,
  `send_time` DATETIME,
  `notice_type` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_seckill_sku_relation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `promotion_id` BIGINT,
  `promotion_session_id` BIGINT,
  `sku_id` BIGINT,
  `seckill_price` DECIMAL(20,2),
  `seckill_count` INT,
  `seckill_limit` INT,
  `seckill_sort` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_sku_full_reduction` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sku_id` BIGINT,
  `full_price` DECIMAL(20,2),
  `reduce_price` DECIMAL(20,2),
  `add_other` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_sku_ladder` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sku_id` BIGINT,
  `full_count` INT,
  `discount` DECIMAL(20,4),
  `price` DECIMAL(20,2),
  `add_other` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sms_spu_bounds` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `spu_id` BIGINT,
  `grow_bounds` DECIMAL(20,4),
  `buy_bounds` DECIMAL(20,4),
  `work` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

GRANT ALL PRIVILEGES ON `gulimall_ums_demo`.* TO 'gulimall'@'%';

CREATE DATABASE `gulimall_oms_demo` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `gulimall_oms_demo`;

CREATE TABLE `oms_order` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `member_id` BIGINT,
  `order_sn` VARCHAR(255),
  `coupon_id` BIGINT,
  `create_time` DATETIME,
  `member_username` VARCHAR(255),
  `total_amount` DECIMAL(20,2),
  `pay_amount` DECIMAL(20,2),
  `freight_amount` DECIMAL(20,2),
  `promotion_amount` DECIMAL(20,2),
  `integration_amount` DECIMAL(20,2),
  `coupon_amount` DECIMAL(20,2),
  `discount_amount` DECIMAL(20,2),
  `pay_type` INT,
  `source_type` INT,
  `status` INT,
  `delivery_company` VARCHAR(255),
  `delivery_sn` VARCHAR(255),
  `auto_confirm_day` INT,
  `integration` INT,
  `growth` INT,
  `bill_type` INT,
  `bill_header` VARCHAR(1024),
  `bill_content` TEXT,
  `bill_receiver_phone` VARCHAR(255),
  `bill_receiver_email` VARCHAR(255),
  `receiver_name` VARCHAR(255),
  `receiver_phone` VARCHAR(255),
  `receiver_post_code` VARCHAR(255),
  `receiver_province` VARCHAR(255),
  `receiver_city` VARCHAR(255),
  `receiver_region` VARCHAR(255),
  `receiver_detail_address` VARCHAR(255),
  `note` VARCHAR(255),
  `confirm_status` INT,
  `delete_status` INT,
  `use_integration` INT,
  `payment_time` DATETIME,
  `delivery_time` DATETIME,
  `receive_time` DATETIME,
  `comment_time` DATETIME,
  `modify_time` DATETIME,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `oms_order_item` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT,
  `order_sn` VARCHAR(255),
  `spu_id` BIGINT,
  `spu_name` VARCHAR(255),
  `spu_pic` VARCHAR(255),
  `spu_brand` VARCHAR(255),
  `category_id` BIGINT,
  `sku_id` BIGINT,
  `sku_name` VARCHAR(255),
  `sku_pic` VARCHAR(255),
  `sku_price` DECIMAL(20,2),
  `sku_quantity` INT,
  `sku_attrs_vals` TEXT,
  `promotion_amount` DECIMAL(20,2),
  `coupon_amount` DECIMAL(20,2),
  `integration_amount` DECIMAL(20,2),
  `real_amount` DECIMAL(20,2),
  `gift_integration` INT,
  `gift_growth` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `oms_order_operate_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT,
  `operate_man` VARCHAR(255),
  `create_time` DATETIME,
  `order_status` INT,
  `note` VARCHAR(255),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `oms_order_return_apply` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT,
  `sku_id` BIGINT,
  `order_sn` VARCHAR(255),
  `create_time` DATETIME,
  `member_username` VARCHAR(255),
  `return_amount` DECIMAL(20,2),
  `return_name` VARCHAR(255),
  `return_phone` VARCHAR(255),
  `status` INT,
  `handle_time` DATETIME,
  `sku_img` VARCHAR(1024),
  `sku_name` VARCHAR(255),
  `sku_brand` VARCHAR(255),
  `sku_attrs_vals` TEXT,
  `sku_count` INT,
  `sku_price` DECIMAL(20,2),
  `sku_real_price` DECIMAL(20,2),
  `reason` VARCHAR(255),
  `description` TEXT,
  `desc_pics` TEXT,
  `handle_note` VARCHAR(255),
  `handle_man` VARCHAR(255),
  `receive_man` VARCHAR(255),
  `receive_time` DATETIME,
  `receive_note` VARCHAR(255),
  `receive_phone` VARCHAR(255),
  `company_address` VARCHAR(255),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `oms_order_return_reason` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255),
  `sort` INT NOT NULL DEFAULT 0,
  `status` INT,
  `create_time` DATETIME,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `oms_order_setting` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `flash_order_overtime` INT,
  `normal_order_overtime` INT,
  `confirm_overtime` INT,
  `finish_overtime` INT,
  `comment_overtime` INT,
  `member_level` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `oms_payment_info` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_sn` VARCHAR(255),
  `order_id` BIGINT,
  `alipay_trade_no` VARCHAR(255),
  `total_amount` DECIMAL(20,2),
  `subject` VARCHAR(255),
  `payment_status` VARCHAR(255),
  `create_time` DATETIME,
  `confirm_time` DATETIME,
  `callback_content` TEXT,
  `callback_time` DATETIME,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `oms_refund_info` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_return_id` BIGINT,
  `refund` DECIMAL(20,4),
  `refund_sn` VARCHAR(255),
  `refund_status` INT,
  `refund_channel` INT,
  `refund_content` TEXT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

GRANT ALL PRIVILEGES ON `gulimall_oms_demo`.* TO 'gulimall'@'%';

CREATE DATABASE `gulimall_wms_demo` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `gulimall_wms_demo`;

CREATE TABLE `wms_purchase_detail` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `purchase_id` BIGINT,
  `sku_id` BIGINT,
  `sku_num` INT,
  `sku_price` DECIMAL(20,2),
  `ware_id` BIGINT,
  `status` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `wms_purchase` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `assignee_id` BIGINT,
  `assignee_name` VARCHAR(255),
  `phone` VARCHAR(255),
  `priority` INT,
  `status` INT,
  `ware_id` BIGINT,
  `amount` DECIMAL(20,2),
  `create_time` DATETIME,
  `update_time` DATETIME,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `wms_ware_info` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255),
  `address` VARCHAR(255),
  `areacode` VARCHAR(255),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `wms_ware_order_task_detail` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sku_id` BIGINT,
  `sku_name` VARCHAR(255),
  `sku_num` INT,
  `task_id` BIGINT,
  `ware_id` BIGINT,
  `lock_status` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `wms_ware_order_task` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT,
  `order_sn` VARCHAR(255),
  `consignee` VARCHAR(255),
  `consignee_tel` VARCHAR(255),
  `delivery_address` VARCHAR(255),
  `order_comment` VARCHAR(255),
  `payment_way` INT,
  `task_status` INT,
  `order_body` VARCHAR(255),
  `tracking_no` VARCHAR(255),
  `create_time` DATETIME,
  `ware_id` BIGINT,
  `task_comment` VARCHAR(255),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `wms_ware_sku` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sku_id` BIGINT,
  `ware_id` BIGINT,
  `stock` INT NOT NULL DEFAULT 0,
  `sku_name` VARCHAR(255),
  `stock_locked` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

GRANT ALL PRIVILEGES ON `gulimall_wms_demo`.* TO 'gulimall'@'%';
