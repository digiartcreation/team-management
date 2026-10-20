-- Gives every employee a domain (sector) and designation, and adds the hourly
-- base prices the Base Price Report needs to price their hours. Data only:
-- no table or column changes.
--
--   Fayaz            Media Production      · Video Editor         (video editing)
--   Siraj (both)     Digital Marketing     · Marketing Executive  (DM, posters)
--   Rifai            Digital Marketing     · Marketing Executive
--   Mubarak          Technology & Engineering · Software Engineer (developer)
--   Afzal            Administration        · Office Manager       (admin, management)
--   Basha, Shakir    Executive Management  · Manager
--
-- Names are matched in lower case, with the spellings in use ("Fayaz" /
-- "Fayas", "Afzal" / "Afsal", "Siraj" / "Siraj - admin"). Mubarak's accounts
-- only change where no designation is set yet, so one already chosen (such as
-- mubarak ali, Junior Engineer) stays.
--
-- Base prices are INR per hour. A price that already exists for the same
-- service + domain + designation is left exactly as it is; only missing ones
-- are added. Change any of them later on the Base Price page.
--
-- Already applied to u230921990_office_testing. Run in phpMyAdmin
-- (hPanel -> Databases -> Enter phpMyAdmin -> SQL tab) against:
--   u230921990_office          (production, used by the live site)
-- Running it again, or on the testing database, changes nothing further.


-- ---------------------------------------------------------------------------
-- STEP 1 - preflight. Read the output before running step 2.
-- ---------------------------------------------------------------------------
-- Every employee with their current domain and designation. Check the names
-- in step 2 match the people here; anyone not named there keeps what they have.
SELECT `name`, `role`, `sector`, `designation`
FROM `User`
ORDER BY `name`;

-- How many base prices exist now. Step 2 adds up to 27.
SELECT COUNT(*) AS base_prices FROM `BasePrice`;


-- ---------------------------------------------------------------------------
-- STEP 2 - set domains and designations, add missing base prices.
-- ---------------------------------------------------------------------------
UPDATE `User`
SET `sector` = 'Media Production', `designation` = 'Video Editor', `updatedAt` = NOW(3)
WHERE LOWER(`name`) IN ('fayaz', 'fayas');

UPDATE `User`
SET `sector` = 'Digital Marketing', `designation` = 'Marketing Executive', `updatedAt` = NOW(3)
WHERE LOWER(`name`) IN ('siraj', 'siraj - admin', 'rifai');

UPDATE `User`
SET `sector` = 'Administration', `designation` = 'Office Manager', `updatedAt` = NOW(3)
WHERE LOWER(`name`) IN ('afzal', 'afsal');

UPDATE `User`
SET `sector` = 'Executive Management', `designation` = 'Manager', `updatedAt` = NOW(3)
WHERE LOWER(`name`) IN ('basha', 'shakir');

UPDATE `User`
SET `sector` = 'Technology & Engineering', `designation` = 'Software Engineer', `updatedAt` = NOW(3)
WHERE LOWER(`name`) LIKE 'mubarak%'
  AND (`sector` IS NULL OR `designation` IS NULL);

-- `id = id` makes a duplicate a no-op, so an existing price is never changed.
INSERT INTO `BasePrice` (`id`, `service`, `sector`, `designation`, `basePrice`, `updatedAt`) VALUES
  (REPLACE(UUID(), '-', ''), 'Video Editing', 'Creative & Design', 'Intern', 150.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Video Editing', 'Creative & Design', 'Designer', 225.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Video Editing', 'Creative & Design', 'Senior Designer', 350.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Video Editing', 'Technology & Engineering', 'Software Engineer', 250.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Video Editing', 'Digital Marketing', 'Marketing Executive', 200.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Video Editing', 'Media Production', 'Video Editor', 350.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Digital Marketing', 'Technology & Engineering', 'Software Engineer', 250.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Digital Marketing', 'Digital Marketing', 'Marketing Executive', 200.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Digital Marketing', 'Executive Management', 'Manager', 500.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Web Development', 'Technology & Engineering', 'Software Engineer', 400.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Web Application', 'Technology & Engineering', 'Software Engineer', 450.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Social Media Management', 'Digital Marketing', 'Marketing Executive', 200.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Client Management', 'Technology & Engineering', 'Software Engineer', 450.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Client Management', 'Digital Marketing', 'Marketing Executive', 300.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Client Management', 'Business & Operations', 'Business Development Executive', 550.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Client Management', 'Executive Management', 'Manager', 600.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Client Management', 'Administration', 'Office Manager', 550.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Graphic Design', 'Digital Marketing', 'Marketing Executive', 200.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Graphic Design', 'Media Production', 'Video Editor', 350.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Poster Design', 'Creative & Design', 'Intern', 150.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Poster Design', 'Creative & Design', 'Designer', 225.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Poster Design', 'Creative & Design', 'Senior Designer', 350.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Poster Design', 'Technology & Engineering', 'Software Engineer', 250.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Poster Design', 'Digital Marketing', 'Marketing Executive', 200.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Poster Design', 'Business & Operations', 'Business Development Executive', 250.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Poster Design', 'Media Production', 'Video Editor', 350.00, NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Other', 'Administration', 'Office Manager', 400.00, NOW(3))
ON DUPLICATE KEY UPDATE `id` = `id`;


-- ---------------------------------------------------------------------------
-- STEP 3 - verify.
-- ---------------------------------------------------------------------------
-- Expect EMPTY. Anyone listed still has no domain or designation, so their
-- hours stay out of the report: set them on the Employees page.
SELECT `name`, `role`, `sector`, `designation`
FROM `User`
WHERE `sector` IS NULL OR `designation` IS NULL
ORDER BY `name`;

-- Every base price, as the Base Price page lists them.
SELECT `service`, `sector`, `designation`, `basePrice`
FROM `BasePrice`
ORDER BY `service`, `sector`, `designation`;


-- ---------------------------------------------------------------------------
-- STEP 4 - optional. Read-only: Poster Design tasks with no poster count.
-- ---------------------------------------------------------------------------
-- The report leaves these out ("Poster count not set on the task"). EMPTY
-- means nothing to do; otherwise open each on the Tasks page and set its count.
SELECT t.`title`, c.`name` AS client
FROM `Task` t
LEFT JOIN `Client` c ON c.`id` = t.`clientId`
WHERE t.`clientWork` LIKE 'Poster Design%'
  AND t.`posterCount` IS NULL
ORDER BY c.`name`, t.`title`;
