-- One person on several teams.
--
-- Until now each User carried a single `teamId`, so adding someone to a second
-- team silently took them off the first. Membership moves to its own table,
-- TeamMember, with one row per person per team.
--
-- Run against BOTH databases:
--   u230921990_office          (production)
--   u230921990_office_testing  (whatever local .env points at)
--
-- Run it BEFORE deploying the code that reads TeamMember: without the table,
-- every page that scopes by team fails.
--
-- Nothing is deleted. Step 3 copies every existing User.teamId into
-- TeamMember, so everyone keeps the team they have today. User.teamId itself
-- stays in place (the app no longer reads or writes it) so this can be rolled
-- back; only its foreign key is dropped in step 4, so deleting a team is not
-- blocked by a column nothing maintains any more.


-- ---------------------------------------------------------------------------
-- STEP 1 - preflight. Expect EMPTY. A row means step 2 is already applied.
-- ---------------------------------------------------------------------------
SHOW TABLES LIKE 'TeamMember';


-- ---------------------------------------------------------------------------
-- STEP 2 - the migration.
-- ---------------------------------------------------------------------------
-- CreateTable
-- Guarded by IF NOT EXISTS and safe to re-run. The foreign keys below are not:
-- a second run fails with #1826 (duplicate foreign key), or errno 121 on
-- MariaDB. Either error is harmless and means they are already there.
CREATE TABLE IF NOT EXISTS `TeamMember` (
    `userId` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TeamMember_teamId_idx`(`teamId`),
    PRIMARY KEY (`userId`, `teamId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
-- CASCADE both ways: deleting a user or a team removes the memberships with it.
ALTER TABLE `TeamMember` ADD CONSTRAINT `TeamMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `TeamMember` ADD CONSTRAINT `TeamMember_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- STEP 3 - backfill. One membership per user who has a team today.
-- Safe to re-run: INSERT IGNORE skips memberships that already exist.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `TeamMember` (`userId`, `teamId`)
SELECT u.`id`, u.`teamId`
FROM `User` u
JOIN `Team` t ON t.`id` = u.`teamId`;


-- ---------------------------------------------------------------------------
-- STEP 4 - retire the old column's foreign key. The column and its data stay.
-- If this fails with #1091 (can't DROP), the key is already gone -- harmless.
-- ---------------------------------------------------------------------------
ALTER TABLE `User` DROP FOREIGN KEY `User_teamId_fkey`;


-- ---------------------------------------------------------------------------
-- STEP 5 - verify.
-- ---------------------------------------------------------------------------
-- Expect the 3 columns, the composite PRIMARY KEY, the index, and two
-- CONSTRAINT lines referencing User and Team.
SHOW CREATE TABLE `TeamMember`;

-- Expect the two counts to match.
SELECT
  (SELECT COUNT(*) FROM `User` u JOIN `Team` t ON t.`id` = u.`teamId`) AS users_with_a_team,
  (SELECT COUNT(*) FROM `TeamMember`) AS memberships;


-- ---------------------------------------------------------------------------
-- ROLLBACK (only if the previous code has to go back out).
-- The old code reads User.teamId, which step 3 never changed. Memberships
-- added after this migration are not copied back -- a second team has nowhere
-- to go in a single column.
-- ---------------------------------------------------------------------------
-- DROP TABLE `TeamMember`;
-- ALTER TABLE `User` ADD CONSTRAINT `User_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
