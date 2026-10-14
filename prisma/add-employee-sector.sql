-- Adds the employee sector and moves the old job levels onto the new
-- sector designations (see SECTORS in lib/designations.ts).
-- Run once in phpMyAdmin against each application database, BEFORE deploying
-- the code that adds `sector`: login reads every User column, so it fails
-- until this column exists.
-- Do not run again after the column appears in the SHOW output below.

ALTER TABLE `User`
  ADD COLUMN `sector` VARCHAR(191) NULL;

-- "Engineer" is now "Software Engineer". Junior Engineer, Senior Engineer and
-- Intern keep their names.
UPDATE `User` SET `designation` = 'Software Engineer'
  WHERE `designation` = 'Engineer';

-- The old engineer levels belong to Technology & Engineering. Interns can sit
-- in any sector, so theirs is left for an admin to choose.
UPDATE `User` SET `sector` = 'Technology & Engineering'
  WHERE `designation` IN ('Junior Engineer', 'Software Engineer', 'Senior Engineer');

-- Base prices for Engineer carry over to Software Engineer.
UPDATE `BasePrice` SET `designation` = 'Software Engineer'
  WHERE `designation` = 'Engineer';

SHOW COLUMNS FROM `User` LIKE 'sector';
SELECT `sector`, `designation`, COUNT(*) AS `employees`
  FROM `User` GROUP BY `sector`, `designation`;
