-- Existing demo database only; verify the table is absent and back up first. Run once.
USE gulimall_pms_demo;
CREATE TABLE `pms_search_sync` (
  `spu_id` BIGINT NOT NULL,
  `version` BIGINT NOT NULL,
  `state` INT NOT NULL DEFAULT 0,
  `attempts` INT NOT NULL DEFAULT 0,
  `last_error` VARCHAR(255),
  `next_attempt` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`spu_id`),
  KEY `idx_search_pending` (`state`, `next_attempt`)
) ENGINE=InnoDB;
