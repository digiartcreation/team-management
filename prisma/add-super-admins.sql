-- Make Shakir, Basha and Mubarak super admins.
--
-- Their existing accounts are promoted in place: same email, same password,
-- nothing else changes. A super admin keeps every admin permission
-- and also sees everyone's attendance and the Base Price menu.
--
-- Run against BOTH databases:
--   u230921990_office          (production)
--   u230921990_office_testing  (whatever local .env points at)
--
-- Safe to re-run. They pick up the new role the next time they sign in.


-- ---------------------------------------------------------------------------
-- STEP 1 - preview. Expect one 'admin' row each for Shakir and Basha, and one
-- row for Mubarak (a 'member' on the testing database). If an email differs on
-- this database, or Mubarak's email has more than one account, fix STEP 2
-- before running it.
-- ---------------------------------------------------------------------------
SELECT `id`, `name`, `email`, `role`
FROM `User`
WHERE `email` IN (
  'mdshakeer91@gmail.com',
  'hameedofficial.01@gmail.com',
  'mubarakali.student.edu@gmail.com'
);


-- ---------------------------------------------------------------------------
-- STEP 2 - the promotion. Expect 2 rows, then 1 row affected (0 on a re-run).
-- ---------------------------------------------------------------------------
UPDATE `User`
SET `role` = 'superadmin'
WHERE `email` IN ('mdshakeer91@gmail.com', 'hameedofficial.01@gmail.com')
  AND `role` = 'admin';

-- Mubarak's account is not an admin, so it is promoted from whatever it is.
UPDATE `User`
SET `role` = 'superadmin'
WHERE `email` = 'mubarakali.student.edu@gmail.com'
  AND `role` <> 'superadmin';


-- ---------------------------------------------------------------------------
-- STEP 3 - verify. Re-run STEP 1: every row should now read 'superadmin'.
-- ---------------------------------------------------------------------------
