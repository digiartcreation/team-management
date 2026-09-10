-- Fix DailyUpdate text columns that were varchar(191) instead of TEXT.
--
-- prisma/schema.prisma has always declared these four as @db.Text, but the
-- production database u230921990_office had them as varchar(191). Any daily
-- update longer than 191 characters therefore failed to save, or was
-- truncated -- and the longest surviving `workedOn` value was exactly 191
-- characters, so this had already happened at least once.
--
-- Pre-existing drift, unrelated to the client/task/time features. Found with:
--   npx prisma migrate diff --from-url <database> \
--       --to-schema-datamodel prisma/schema.prisma --script
--
-- Widening only: varchar(191) -> TEXT loses no data and no row is rewritten.
-- Already-truncated text cannot be recovered; only future writes are fixed.
--
-- APPLIED to u230921990_office on 2026-09-10.
-- u230921990_office_testing already had the correct types.
--
-- Verified afterwards with the same migrate diff, which then reported
-- "This is an empty migration." for both databases.

ALTER TABLE `DailyUpdate` MODIFY `workedOn` TEXT NOT NULL,
    MODIFY `completedTasks` TEXT NULL,
    MODIFY `blockers` TEXT NULL,
    MODIFY `tomorrowPlan` TEXT NULL;

-- Verification (avoids information_schema, which shared-hosting users
-- cannot read -- MySQL error #1044).
-- Expect all four to read `text`.
SHOW COLUMNS FROM `DailyUpdate`;
