-- Recompute lateness, early departure and status on the office clock (IST).
--
-- The server runs on UTC, and until now check-in and check-out read the
-- server's clock, so every saved day's late / early-departure minutes and its
-- Late / Present status were worked out 5h30m behind the office. The check-in
-- and check-out timestamps themselves are true UTC and were always right; this
-- only rebuilds the three columns derived from them.
--
-- Run against BOTH databases:
--   u230921990_office          (production)
--   u230921990_office_testing  (whatever local .env points at)
--
-- Safe to re-run: every value is recomputed from the timestamps, so a second
-- run changes nothing. Days recorded locally on an IST machine already have the
-- right numbers and come out the same.
--
-- IST has no daylight saving, so a fixed +05:30 is exact.


-- ---------------------------------------------------------------------------
-- STEP 1 - preview. Current values next to the corrected ones.
-- ---------------------------------------------------------------------------
SELECT
  r.`id`,
  r.`date`,
  TIME(ADDTIME(r.`actualCheckInTime`, '05:30:00'))  AS first_in_ist,
  TIME(ADDTIME(r.`actualCheckOutTime`, '05:30:00')) AS last_out_ist,
  r.`status`,
  r.`lateDurationMinutes`   AS late_now,
  NULLIF(GREATEST(0,
    HOUR(ADDTIME(r.`actualCheckInTime`, '05:30:00')) * 60
      + MINUTE(ADDTIME(r.`actualCheckInTime`, '05:30:00'))
      - (CAST(SUBSTRING_INDEX(r.`scheduledStartTime`, ':', 1) AS SIGNED) * 60
         + CAST(SUBSTRING_INDEX(r.`scheduledStartTime`, ':', -1) AS SIGNED))
  ), 0)                     AS late_fixed,
  r.`earlyDepartureMinutes` AS early_now,
  NULLIF(GREATEST(0,
    CAST(SUBSTRING_INDEX(r.`scheduledEndTime`, ':', 1) AS SIGNED) * 60
      + CAST(SUBSTRING_INDEX(r.`scheduledEndTime`, ':', -1) AS SIGNED)
      - (HOUR(ADDTIME(r.`actualCheckOutTime`, '05:30:00')) * 60
         + MINUTE(ADDTIME(r.`actualCheckOutTime`, '05:30:00')))
  ), 0)                     AS early_fixed
FROM `AttendanceRecord` r
WHERE r.`actualCheckInTime` IS NOT NULL
ORDER BY r.`date` DESC;


-- ---------------------------------------------------------------------------
-- STEP 2 - the fix.
-- ---------------------------------------------------------------------------
-- Late minutes, from the day's first check-in.
UPDATE `AttendanceRecord` r
SET r.`lateDurationMinutes` = NULLIF(GREATEST(0,
  HOUR(ADDTIME(r.`actualCheckInTime`, '05:30:00')) * 60
    + MINUTE(ADDTIME(r.`actualCheckInTime`, '05:30:00'))
    - (CAST(SUBSTRING_INDEX(r.`scheduledStartTime`, ':', 1) AS SIGNED) * 60
       + CAST(SUBSTRING_INDEX(r.`scheduledStartTime`, ':', -1) AS SIGNED))
), 0)
WHERE r.`actualCheckInTime` IS NOT NULL;

-- Status follows lateness. Only Late / Present are touched -- those are the
-- only two check-in ever sets.
UPDATE `AttendanceRecord` r
SET r.`status` = IF(r.`lateDurationMinutes` IS NULL, 'Present', 'Late')
WHERE r.`actualCheckInTime` IS NOT NULL
  AND r.`status` IN ('Late', 'Present');

-- Early departure, from the day's last check-out. A day still checked in has
-- none yet, the same as the app leaves it.
UPDATE `AttendanceRecord` r
SET r.`earlyDepartureMinutes` = NULLIF(GREATEST(0,
  CAST(SUBSTRING_INDEX(r.`scheduledEndTime`, ':', 1) AS SIGNED) * 60
    + CAST(SUBSTRING_INDEX(r.`scheduledEndTime`, ':', -1) AS SIGNED)
    - (HOUR(ADDTIME(r.`actualCheckOutTime`, '05:30:00')) * 60
       + MINUTE(ADDTIME(r.`actualCheckOutTime`, '05:30:00')))
), 0)
WHERE r.`actualCheckOutTime` IS NOT NULL;


-- ---------------------------------------------------------------------------
-- STEP 3 - verify. Re-run STEP 1: late_now / early_now should now match
-- late_fixed / early_fixed on every row.
-- ---------------------------------------------------------------------------
