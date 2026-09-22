/**
 * Checks the reopen grouping on fixtures, so the maths behind the notes is
 * exercised without a database. Run with:
 *
 *   TS_NODE_BASEURL=. npx ts-node -r tsconfig-paths/register \
 *     --compiler-options "{\"module\":\"CommonJS\"}" \
 *     scripts/reopen-history.check.ts
 *
 * TS_NODE_BASEURL is needed because tsconfig.json sets "paths" with no
 * "baseUrl": Next resolves the "@/" alias from that happily, ts-node does not.
 */
import assert from "node:assert/strict";
import { buildReopenHistory, countReopenNotes } from "../lib/reopenHistory";
import { buildReopenSummary, type TimeLogRow } from "../lib/reports";
import { splitReopenMinutes } from "../lib/duration";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const reopens = [
  {
    cycle: 1,
    reason: "Client wanted a different thumbnail",
    createdAt: day("2026-09-10"),
    user: { name: "Mubarak Ali" },
  },
  // Reopened from the task form, which has nowhere to ask for a reason.
  { cycle: 2, reason: null, createdAt: day("2026-09-18"), user: { name: "Sara R" } },
];

const logs = [
  { id: "l1", minutes: 240, date: day("2026-09-01"), note: null, reopenCycle: 0, user: { name: "Yaseen F" } },
  { id: "l3", minutes: 60, date: day("2026-09-12"), note: "Colour pass again", reopenCycle: 1, user: { name: "Yaseen F" } },
  { id: "l2", minutes: 90, date: day("2026-09-11"), note: "New thumbnail cut", reopenCycle: 1, user: { name: "Yaseen F" } },
  { id: "l4", minutes: 30, date: day("2026-09-19"), note: "Re-export at 4K", reopenCycle: 2, user: { name: "Sara R" } },
];

const history = buildReopenHistory(reopens, logs);

assert.equal(history.length, 2, "one entry per cycle");
assert.deepEqual(
  history.map((cycle) => cycle.cycle),
  [1, 2],
  "cycles ascend"
);
assert.equal(history[0].reason, "Client wanted a different thumbnail");
assert.equal(history[0].reopenedBy, "Mubarak Ali");
assert.equal(history[0].minutes, 150, "cycle 1 sums its own logs only");
assert.deepEqual(
  history[0].entries.map((entry) => entry.note),
  ["New thumbnail cut", "Colour pass again"],
  "entries run oldest first, not in query order"
);
assert.equal(history[1].reason, null, "a reasonless reopen still appears");
assert.equal(history[1].minutes, 30);
assert.equal(countReopenNotes(history), 4, "one reason plus three notes");

// A task reopened today, with nothing logged against the new cycle yet.
const fresh = buildReopenHistory(
  [{ cycle: 1, reason: "Needs subtitles", createdAt: day("2026-09-22"), user: { name: "Mubarak Ali" } }],
  []
);
assert.equal(fresh.length, 1, "a cycle with no hours is still shown");
assert.equal(fresh[0].minutes, 0);

const time = splitReopenMinutes(logs);
assert.deepEqual(
  time,
  { original: 240, reopen: 180, total: 420 },
  "rework is told apart but stays in the total"
);

// The same shape as the reports page feeds in.
const reportLogs: TimeLogRow[] = logs.map((log) => ({
  id: log.id,
  minutes: log.minutes,
  reopenCycle: log.reopenCycle,
  note: log.note,
  user: { id: "u1", name: log.user.name },
  task: {
    id: "t1",
    title: "Ar Raheem promo",
    clientWork: "Video Editing",
    reopenCount: 2,
    client: { id: "c1", name: "Ar Raheem" },
  },
}));

const [summary] = buildReopenSummary(reportLogs);

assert.equal(summary.originalMinutes, 240);
assert.equal(summary.reopenMinutes, 180);
assert.equal(summary.minutes, 420, "original plus rework is the task total");
assert.equal(summary.reopenCount, 2);
assert.deepEqual(
  summary.cycles.map((cycle) => [cycle.cycle, cycle.minutes]),
  [
    [1, 150],
    [2, 30],
  ]
);
assert.deepEqual(
  summary.cycles[0].notes.map((entry) => entry.note),
  ["Colour pass again", "New thumbnail cut"],
  "every note on the cycle is carried into the report"
);

// A task that was never reopened stays out of the reopen report entirely.
assert.equal(
  buildReopenSummary(
    reportLogs.map((log) => ({ ...log, reopenCycle: 0, task: { ...log.task, reopenCount: 0 } }))
  ).length,
  0
);

console.log("reopen history and summary: all checks passed");
