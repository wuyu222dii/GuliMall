-- Apply once to the existing demo UMS database. Duplicate rows make ALTER fail;
-- never delete or merge existing accounts automatically.
USE gulimall_ums_demo;
ALTER TABLE ums_member ADD UNIQUE KEY uk_member_username (username);
ALTER TABLE ums_member ADD UNIQUE KEY uk_member_mobile (mobile);
