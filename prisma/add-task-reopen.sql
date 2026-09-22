-- Reopening a completed task.
--
-- A completed task can be sent back for more work. The rework has to stay
-- separable from the original run -- how many times a task came back, how many
-- hours went into each return -- while still counting towards the task's grand
-- total. Three pieces:
--
--   Task.reopenCount         how many times this task has been reopened. Also
--                            the cycle that new time logs are stamped with, so
--                            0 means the task is still on its original run.
--   TaskTimeLog.reopenCycle  which run the entry belongs to: 0 original, 1
--                            after the first reopen, and so on.
--   TaskReopen               one row per reopening, with who sent it back, when
--                            and why.
--
-- Run against BOTH databases:
--   u230921990_office          (production, used by the live site)
--   u230921990_office_testing  (whatever local .env points at)
--
-- Nothing is dropped and no existing row changes meaning. Every task already in
-- the database gets reopenCount 0 and every existing time entry reopenCycle 0,
-- which is exactly what they are: original work, never reopened.


-- ---------------------------------------------------------------------------
-- STEP 1 - preflight. Expect EMPTY on all three. A row means that part of
-- step 2 is already applied and must be skipped.
-- ---------------------------------------------------------------------------
SHOW COLUMNS FROM `Task` LIKE 'reopenCount';
SHOW COLUMNS FROM `TaskTimeLog` LIKE 'reopenCycle';
SHOW TABLES LIKE 'TaskReopen';


-- ---------------------------------------------------------------------------
-- STEP 2 - the migration.
-- ---------------------------------------------------------------------------
-- The two ALTERs are not re-runnable: a second run fails with #1060 (duplicate
-- column), which is harmless and means the column is already there.

-- AlterTable
ALTER TABLE `Task`
  ADD COLUMN `reopenCount` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `TaskTimeLog`
  ADD COLUMN `reopenCycle` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
-- Guarded by IF NOT EXISTS and safe to re-run. The foreign keys below are not:
-- a second run fails with #1826 (duplicate foreign key), or errno 121 on
-- MariaDB. Either error is harmless and means they are already there.
CREATE TABLE IF NOT EXISTS `TaskReopen` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `cycle` INTEGER NOT NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TaskReopen_taskId_cycle_key`(`taskId`, `cycle`),
    INDEX `TaskReopen_taskId_fkey`(`taskId`),
    INDEX `TaskReopen_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
-- CASCADE on both: deleting a task or a user removes their reopen records,
-- which would otherwise point at rows that no longer exist.
ALTER TABLE `TaskReopen` ADD CONSTRAINT `TaskReopen_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `TaskReopen` ADD CONSTRAINT `TaskReopen_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- STEP 3 - verify. Uses SHOW rather than information_schema, which
-- shared-hosting users cannot read (MySQL error #1044).
-- ---------------------------------------------------------------------------
-- Expect one row each, both INT NOT NULL DEFAULT 0.
SHOW COLUMNS FROM `Task` LIKE 'reopenCount';
SHOW COLUMNS FROM `TaskTimeLog` LIKE 'reopenCycle';

-- Expect all 6 columns, the unique index on (taskId, cycle), and both
-- CONSTRAINT lines, referencing Task and User.
SHOW CREATE TABLE `TaskReopen`;
