-- Two changes for this release. Run once in phpMyAdmin against each
-- application database, BEFORE deploying the code: task pages and base prices
-- read these columns and fail until they exist.
--
-- Run prisma/add-employee-sector.sql first if that database has not had it:
-- this file expects the old "Engineer" base prices already renamed.
--
-- 1. Task.completedAt - when a task was first completed, shown on the
--    completed cards of the dashboard board. Reopening does not change it.
-- 2. BasePrice.sector - the domain (sector) a base price belongs to. Every
--    domain now has its own Intern, so service + designation is no longer
--    enough to tell two prices apart.


-- ---------------------------------------------------------------------------
-- STEP 1 - preflight. Expect EMPTY for both. A row means STEP 2 already ran.
-- ---------------------------------------------------------------------------
SHOW COLUMNS FROM `Task` LIKE 'completedAt';
SHOW COLUMNS FROM `BasePrice` LIKE 'sector';


-- ---------------------------------------------------------------------------
-- STEP 2 - add the columns and fill them.
-- ---------------------------------------------------------------------------
ALTER TABLE `Task`
  ADD COLUMN `completedAt` DATETIME(3) NULL;

-- Tasks completed before this column have no record of when that first
-- happened, so it is estimated: the last time logged on the original run (the
-- entry is saved as the task is completed), never later than its first
-- reopen. A task with neither falls back to its last update. Reopened tasks
-- count too: they were completed once, and that date is the one kept.
UPDATE `Task` t SET t.`completedAt` = LEAST(
    COALESCE((SELECT MAX(l.`createdAt`) FROM `TaskTimeLog` l
              WHERE l.`taskId` = t.`id` AND l.`reopenCycle` = 0), t.`updatedAt`),
    COALESCE((SELECT MIN(r.`createdAt`) FROM `TaskReopen` r
              WHERE r.`taskId` = t.`id`), t.`updatedAt`)
  )
  WHERE t.`completedAt` IS NULL
    AND (t.`status` IN ('completed', 'closed') OR t.`reopenCount` > 0);

-- The old key (service + designation) goes first: copying the Intern prices
-- below puts several rows on the same service and designation. STEP 4 adds the
-- new key with the domain in it.
ALTER TABLE `BasePrice`
  ADD COLUMN `sector` VARCHAR(191) NULL AFTER `service`,
  DROP INDEX `BasePrice_service_designation_key`;

-- Every designation but Intern belongs to exactly one domain.
UPDATE `BasePrice` SET `sector` = CASE `designation`
    WHEN 'Designer' THEN 'Creative & Design'
    WHEN 'Senior Designer' THEN 'Creative & Design'
    WHEN 'Design Lead' THEN 'Creative & Design'
    WHEN 'Design Manager' THEN 'Creative & Design'
    WHEN 'Creative Director' THEN 'Creative & Design'
    WHEN 'Video & Motion Designer' THEN 'Creative & Design'
    WHEN 'UX Specialist' THEN 'Creative & Design'
    WHEN 'Illustrator' THEN 'Creative & Design'
    WHEN 'Junior Engineer' THEN 'Technology & Engineering'
    WHEN 'Software Engineer' THEN 'Technology & Engineering'
    WHEN 'Senior Engineer' THEN 'Technology & Engineering'
    WHEN 'Lead Engineer' THEN 'Technology & Engineering'
    WHEN 'Engineering Manager' THEN 'Technology & Engineering'
    WHEN 'Software Architect' THEN 'Technology & Engineering'
    WHEN 'QA Engineer' THEN 'Technology & Engineering'
    WHEN 'DevOps Engineer' THEN 'Technology & Engineering'
    WHEN 'Data Engineer' THEN 'Technology & Engineering'
    WHEN 'IT Support Specialist' THEN 'Technology & Engineering'
    WHEN 'Marketing Executive' THEN 'Digital Marketing'
    WHEN 'SEO Specialist' THEN 'Digital Marketing'
    WHEN 'Performance Marketing Specialist' THEN 'Digital Marketing'
    WHEN 'Social Media Specialist' THEN 'Digital Marketing'
    WHEN 'Content Specialist' THEN 'Digital Marketing'
    WHEN 'Marketing Analyst' THEN 'Digital Marketing'
    WHEN 'Marketing Strategist' THEN 'Digital Marketing'
    WHEN 'Marketing Manager' THEN 'Digital Marketing'
    WHEN 'Growth Marketing Lead' THEN 'Digital Marketing'
    WHEN 'Marketing Director' THEN 'Digital Marketing'
    WHEN 'Business Executive' THEN 'Business & Operations'
    WHEN 'Business Analyst' THEN 'Business & Operations'
    WHEN 'Business Development Executive' THEN 'Business & Operations'
    WHEN 'Business Development Manager' THEN 'Business & Operations'
    WHEN 'Project Coordinator' THEN 'Business & Operations'
    WHEN 'Project Manager' THEN 'Business & Operations'
    WHEN 'Product Manager' THEN 'Business & Operations'
    WHEN 'Operations Manager' THEN 'Business & Operations'
    WHEN 'Business Manager' THEN 'Business & Operations'
    WHEN 'Strategy Consultant' THEN 'Business & Operations'
    WHEN 'Team Lead' THEN 'Executive Management'
    WHEN 'Assistant Manager' THEN 'Executive Management'
    WHEN 'Manager' THEN 'Executive Management'
    WHEN 'Senior Manager' THEN 'Executive Management'
    WHEN 'Head of Department' THEN 'Executive Management'
    WHEN 'General Manager' THEN 'Executive Management'
    WHEN 'Director' THEN 'Executive Management'
    WHEN 'Vice President' THEN 'Executive Management'
    WHEN 'C-Level Executive' THEN 'Executive Management'
    WHEN 'Managing Director' THEN 'Executive Management'
    WHEN 'HR Executive' THEN 'Human Resources'
    WHEN 'HR Specialist' THEN 'Human Resources'
    WHEN 'HR Manager' THEN 'Human Resources'
    WHEN 'HR Lead' THEN 'Human Resources'
    WHEN 'Accountant' THEN 'Finance & Accounting'
    WHEN 'Finance Analyst' THEN 'Finance & Accounting'
    WHEN 'Finance Manager' THEN 'Finance & Accounting'
    WHEN 'Financial Controller' THEN 'Finance & Accounting'
    WHEN 'Sales Executive' THEN 'Sales'
    WHEN 'Sales Specialist' THEN 'Sales'
    WHEN 'Account Manager' THEN 'Sales'
    WHEN 'Sales Manager' THEN 'Sales'
    WHEN 'Support Executive' THEN 'Customer Support'
    WHEN 'Support Specialist' THEN 'Customer Support'
    WHEN 'Support Lead' THEN 'Customer Support'
    WHEN 'Support Manager' THEN 'Customer Support'
    WHEN 'Data Analyst' THEN 'Data & Analytics'
    WHEN 'Senior Analyst' THEN 'Data & Analytics'
    WHEN 'Data Scientist' THEN 'Data & Analytics'
    WHEN 'Analytics Lead' THEN 'Data & Analytics'
    WHEN 'Photographer' THEN 'Media Production'
    WHEN 'Videographer' THEN 'Media Production'
    WHEN 'Video Editor' THEN 'Media Production'
    WHEN 'Producer' THEN 'Media Production'
    WHEN 'Admin Executive' THEN 'Administration'
    WHEN 'Office Manager' THEN 'Administration'
    WHEN 'Facilities Manager' THEN 'Administration'
    WHEN 'Legal Executive' THEN 'Legal & Compliance'
    WHEN 'Legal Counsel' THEN 'Legal & Compliance'
    WHEN 'Compliance Specialist' THEN 'Legal & Compliance'
    WHEN 'Compliance Manager' THEN 'Legal & Compliance'
  END
  WHERE `sector` IS NULL AND `designation` <> 'Intern';

-- An Intern price used to cover every domain. Keep that: copy it into each
-- domain at the same amount, then drop the shared row.
INSERT INTO `BasePrice` (`id`, `service`, `sector`, `designation`, `basePrice`, `createdAt`, `updatedAt`)
SELECT UUID(), b.`service`, s.`name`, b.`designation`, b.`basePrice`, b.`createdAt`, CURRENT_TIMESTAMP(3)
FROM `BasePrice` b
CROSS JOIN (
  SELECT 'Creative & Design' AS `name`
  UNION ALL SELECT 'Technology & Engineering'
  UNION ALL SELECT 'Digital Marketing'
  UNION ALL SELECT 'Business & Operations'
  UNION ALL SELECT 'Executive Management'
  UNION ALL SELECT 'Human Resources'
  UNION ALL SELECT 'Finance & Accounting'
  UNION ALL SELECT 'Sales'
  UNION ALL SELECT 'Customer Support'
  UNION ALL SELECT 'Data & Analytics'
  UNION ALL SELECT 'Media Production'
  UNION ALL SELECT 'Administration'
  UNION ALL SELECT 'Legal & Compliance'
) s
WHERE b.`designation` = 'Intern' AND b.`sector` IS NULL;

DELETE FROM `BasePrice` WHERE `designation` = 'Intern' AND `sector` IS NULL;


-- ---------------------------------------------------------------------------
-- STEP 3 - check. Expect EMPTY: a row here is a base price whose designation
-- is not in any domain. Fix or delete it before STEP 4, which needs every row
-- to have a domain.
-- ---------------------------------------------------------------------------
SELECT `id`, `service`, `designation`, `basePrice` FROM `BasePrice` WHERE `sector` IS NULL;


-- ---------------------------------------------------------------------------
-- STEP 4 - make the domain required and part of the base price key.
-- ---------------------------------------------------------------------------
ALTER TABLE `BasePrice`
  MODIFY `sector` VARCHAR(191) NOT NULL,
  ADD UNIQUE INDEX `BasePrice_service_sector_designation_key`(`service`, `sector`, `designation`);


-- ---------------------------------------------------------------------------
-- STEP 5 - verify. Expect both columns, and the new key in place of the old.
-- ---------------------------------------------------------------------------
SHOW COLUMNS FROM `Task` LIKE 'completedAt';
SHOW COLUMNS FROM `BasePrice` LIKE 'sector';
SHOW INDEX FROM `BasePrice`;
