-- Adds the poster count recorded only for Poster Design tasks.
-- Run once in phpMyAdmin against each application database.
-- Do not run again after the column appears in SHOW COLUMNS FROM `Task`.

ALTER TABLE `Task`
  ADD COLUMN `posterCount` INT NULL;

SHOW COLUMNS FROM `Task` LIKE 'posterCount';
