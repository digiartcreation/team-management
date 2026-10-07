-- Adds employee designations, the Video Editing weightage on tasks, and the
-- BasePrice table behind the super admin's Base Price menu.
-- Run once in phpMyAdmin against each application database.
-- Do not run again after the columns and table appear in the SHOW output below.

ALTER TABLE `User`
  ADD COLUMN `designation` VARCHAR(191) NULL;

ALTER TABLE `Task`
  ADD COLUMN `videoWeightage` DECIMAL(3,1) NULL;

-- Existing Video Editing tasks start at the default weightage of 1.
UPDATE `Task` SET `videoWeightage` = 1.0
  WHERE `clientWork` LIKE 'Video Editing%' AND `videoWeightage` IS NULL;

-- basePrice is the amount in INR for one hour of work.
CREATE TABLE `BasePrice` (
  `id` VARCHAR(191) NOT NULL,
  `service` VARCHAR(191) NOT NULL,
  `designation` VARCHAR(191) NOT NULL,
  `basePrice` DECIMAL(12,2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `BasePrice_service_designation_key`(`service`, `designation`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Only if you already ran an earlier copy of this file that created BasePrice
-- with an `hours` column: skip the CREATE TABLE above and run these instead.
-- ALTER TABLE `BasePrice` DROP INDEX `BasePrice_service_hours_designation_key`;
-- ALTER TABLE `BasePrice` DROP COLUMN `hours`;
-- ALTER TABLE `BasePrice`
--   ADD UNIQUE INDEX `BasePrice_service_designation_key`(`service`, `designation`);

-- Nobody can pick the Super Admin role until one exists, so promote the first
-- one by hand. Replace the email, then run:
-- UPDATE `User` SET `role` = 'superadmin'
--   WHERE `email` = 'someone@example.com' AND `role` = 'admin';

SHOW COLUMNS FROM `User` LIKE 'designation';
SHOW COLUMNS FROM `Task` LIKE 'videoWeightage';
SHOW TABLES LIKE 'BasePrice';
