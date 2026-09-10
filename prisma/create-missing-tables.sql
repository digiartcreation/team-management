-- Tables present in prisma/schema.prisma but MISSING from the production
-- database u230921990_office. Generated with:
--   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- then reduced to the 4 absent tables.
--
-- Client             -> V2.1 (commit f533e4d) : /clients
-- FeedbackSubmission -> V2   (commit f587363) : /feedback/*
-- AttendanceRecord   -> V2   (commit f587363) : /attendance
-- PushSubscription   -> V2   (commit f587363) : push notifications
--
-- Safe to run on a database that already has the other 11 tables.
-- Foreign keys (Client already had its FK created inline earlier) are added last, after all 4 tables exist.

CREATE TABLE IF NOT EXISTS `Client` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contactPerson` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `services` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
    `notes` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Client_name_key`(`name`),
    INDEX `Client_createdById_fkey`(`createdById`),
    INDEX `Client_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `FeedbackSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'Medium',
    `status` VARCHAR(191) NOT NULL DEFAULT 'Open',
    `adminResponse` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FeedbackSubmission_userId_idx`(`userId`),
    INDEX `FeedbackSubmission_type_idx`(`type`),
    INDEX `FeedbackSubmission_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AttendanceRecord` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `scheduledStartTime` VARCHAR(191) NOT NULL DEFAULT '09:00',
    `actualCheckInTime` DATETIME(3) NULL,
    `scheduledEndTime` VARCHAR(191) NOT NULL DEFAULT '18:00',
    `actualCheckOutTime` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `lateDurationMinutes` INTEGER NULL,
    `earlyDepartureMinutes` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AttendanceRecord_date_idx`(`date`),
    INDEX `AttendanceRecord_status_idx`(`status`),
    UNIQUE INDEX `AttendanceRecord_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PushSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `endpointHash` VARCHAR(191) NOT NULL,
    `endpoint` TEXT NOT NULL,
    `p256dh` TEXT NOT NULL,
    `auth` TEXT NOT NULL,
    `userAgent` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PushSubscription_endpointHash_key`(`endpointHash`),
    INDEX `PushSubscription_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys (Client already had its FK created inline earlier)
ALTER TABLE `FeedbackSubmission` ADD CONSTRAINT `FeedbackSubmission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PushSubscription` ADD CONSTRAINT `PushSubscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Verification (avoids information_schema, which shared-hosting users
-- cannot read -- MySQL error #1044).
SHOW TABLES;
SHOW CREATE TABLE `Client`;
SHOW CREATE TABLE `FeedbackSubmission`;
SHOW CREATE TABLE `AttendanceRecord`;
SHOW CREATE TABLE `PushSubscription`;
