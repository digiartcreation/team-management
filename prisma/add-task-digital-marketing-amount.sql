-- Adds the optional amount recorded only for Digital Marketing tasks.
-- Run once in phpMyAdmin against each application database.
-- Do not run again after the column appears in SHOW COLUMNS FROM `Task`.

ALTER TABLE `Task`
  ADD COLUMN `digitalMarketingAmount` DECIMAL(12,2) NULL;

SHOW COLUMNS FROM `Task` LIKE 'digitalMarketingAmount';
