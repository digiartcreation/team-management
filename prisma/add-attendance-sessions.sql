-- Multiple check-ins and check-outs per day.
--
-- AttendanceRecord stays one row per person per day -- status, first check-in,
-- last check-out, late and early-departure minutes. Each in -> out stretch is
-- now its own AttendanceSession row, so someone can check out for lunch or a
-- client visit and check back in as many times as the day needs.
--
-- Run against BOTH databases:
--   u230921990_office          (production)
--   u230921990_office_testing  (whatever local .env points at)
--
-- Nothing is dropped and no existing row changes. Step 3 copies each existing
-- day's single check-in / check-out into one session, so old days read the same.
-- (The page also falls back to that pair for a day with no sessions.)


-- ---------------------------------------------------------------------------
-- STEP 1 - preflight. Expect EMPTY. A row means step 2 is already applied.
-- ---------------------------------------------------------------------------
SHOW TABLES LIKE 'AttendanceSession';


-- ---------------------------------------------------------------------------
-- STEP 2 - the migration.
-- ---------------------------------------------------------------------------
-- CreateTable
-- Guarded by IF NOT EXISTS and safe to re-run. The foreign key below is not: a
-- second run fails with #1826 (duplicate foreign key), or errno 121 on MariaDB.
-- Either error is harmless and means it is already there.
CREATE TABLE IF NOT EXISTS `AttendanceSession` (
    `id` VARCHAR(191) NOT NULL,
    `attendanceId` VARCHAR(191) NOT NULL,
    `checkInTime` DATETIME(3) NOT NULL,
    `checkOutTime` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AttendanceSession_attendanceId_idx`(`attendanceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
-- CASCADE: deleting a day's attendance removes its sessions with it.
ALTER TABLE `AttendanceSession` ADD CONSTRAINT `AttendanceSession_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `AttendanceRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- STEP 3 - backfill. One session per existing day that has a check-in.
-- Safe to re-run: a day that already has a session is skipped.
-- ---------------------------------------------------------------------------
INSERT INTO `AttendanceSession` (`id`, `attendanceId`, `checkInTime`, `checkOutTime`)
SELECT UUID(), r.`id`, r.`actualCheckInTime`, r.`actualCheckOutTime`
FROM `AttendanceRecord` r
WHERE r.`actualCheckInTime` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `AttendanceSession` s WHERE s.`attendanceId` = r.`id`
  );


-- ---------------------------------------------------------------------------
-- STEP 4 - verify.
-- ---------------------------------------------------------------------------
-- Expect all 5 columns, the index, and the CONSTRAINT line referencing
-- AttendanceRecord.
SHOW CREATE TABLE `AttendanceSession`;

-- Expect the two counts to match.
SELECT
  (SELECT COUNT(*) FROM `AttendanceRecord` WHERE `actualCheckInTime` IS NOT NULL) AS days_with_check_in,
  (SELECT COUNT(DISTINCT `attendanceId`) FROM `AttendanceSession`) AS days_with_sessions;
