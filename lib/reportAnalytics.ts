import {
  INTERNAL_LABEL,
  UNMAPPED_SERVICE_LABEL,
  buildReopenSummary,
  serviceNameOf,
  type ReportView,
  type TimeLogRow,
} from "@/lib/reports";

/** A time log as the report page loads it: the flat row plus its work date. */
export type ReportLogRow = TimeLogRow & { date: Date };

export type Granularity = "day" | "week" | "month";

/** First pass and rework minutes for one slice of the report. */
export type SplitMinutes = { firstPass: number; rework: number };

export type TrendBucket = SplitMinutes & {
  key: string;
  label: string;
};

export type RankedItem = SplitMinutes & {
  key: string;
  label: string;
  minutes: number;
};

export type ShareSlice = { label: string; minutes: number };

/** One employee's minutes per weekday, Monday first. */
export type WeekdayRow = { name: string; minutes: number[] };

export type ReopenBar = {
  taskId: string;
  title: string;
  client: string;
  reopenCount: number;
  originalMinutes: number;
  reopenMinutes: number;
};

export type ReportKpis = {
  total: number;
  firstPass: number;
  rework: number;
  /** Rework as a percentage of all logged time, 0 when nothing is logged. */
  reworkRate: number;
  entries: number;
  tasks: number;
  employees: number;
  clients: number;
  services: number;
  reopenedTasks: number;
  activeDays: number;
  averagePerTask: number;
  averagePerDay: number;
  /** The same totals for the equal-length period before, when a range is set. */
  previous: { total: number; rework: number; label: string } | null;
};

/** One row of the raw time-entry sheet in the Excel export. */
export type ExportEntry = {
  date: string;
  employee: string;
  client: string;
  service: string;
  work: string;
  task: string;
  minutes: number;
  cycle: number;
  note: string;
};

export type ReportAnalytics = {
  kpis: ReportKpis;
  granularity: Granularity;
  trend: TrendBucket[];
  ranking: RankedItem[];
  share: { title: string; slices: ShareSlice[] };
  weekdays: WeekdayRow[];
  reopens: ReopenBar[];
  entries: ExportEntry[];
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many rows a ranking shows before the rest fold into "Other". */
const RANKING_LIMIT = 10;
/** Donut slices before the rest fold into "Other" -- past six a donut stops reading. */
const SHARE_LIMIT = 5;
const WEEKDAY_ROW_LIMIT = 10;
const REOPEN_BAR_LIMIT = 8;

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Dates are stored as UTC midnights, so every bucket is worked out in UTC. */
function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Monday 0 ... Sunday 6. */
function weekdayIndex(date: Date) {
  return (date.getUTCDay() + 6) % 7;
}

function bucketStart(date: Date, granularity: Granularity) {
  const day = startOfUtcDay(date);

  if (granularity === "day") {
    return day;
  }

  if (granularity === "week") {
    return new Date(day.getTime() - weekdayIndex(day) * DAY_MS);
  }

  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
}

function nextBucket(date: Date, granularity: Granularity) {
  if (granularity === "day") {
    return new Date(date.getTime() + DAY_MS);
  }

  if (granularity === "week") {
    return new Date(date.getTime() + 7 * DAY_MS);
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function bucketLabel(date: Date, granularity: Granularity) {
  if (granularity === "month") {
    return monthFormatter.format(date);
  }

  return dayFormatter.format(date);
}

/**
 * Days for a month or so, weeks up to half a year, months beyond -- enough bars
 * to show a shape without turning into a barcode.
 */
function granularityFor(start: Date, end: Date): Granularity {
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;

  if (days <= 31) {
    return "day";
  }

  return days <= 182 ? "week" : "month";
}

function split(log: TimeLogRow): SplitMinutes {
  return log.reopenCycle > 0
    ? { firstPass: 0, rework: log.minutes }
    : { firstPass: log.minutes, rework: 0 };
}

function clientOf(log: TimeLogRow) {
  return log.task.client?.name ?? INTERNAL_LABEL;
}

function serviceOf(log: TimeLogRow) {
  return serviceNameOf(log.task.clientWork) ?? UNMAPPED_SERVICE_LABEL;
}

/** The dimension the ranking chart ranks on follows the chosen report tab. */
const RANKING_KEY: Record<
  ReportView,
  (log: TimeLogRow) => { key: string; label: string }
> = {
  client: (log) => ({
    key: log.task.client?.id ?? "__internal__",
    label: clientOf(log),
  }),
  employee: (log) => ({ key: log.user.id, label: log.user.name }),
  service: (log) => ({ key: serviceOf(log), label: serviceOf(log) }),
};

function buildTrend(
  logs: ReportLogRow[],
  from: Date | null,
  to: Date | null
): { granularity: Granularity; trend: TrendBucket[] } {
  if (logs.length === 0) {
    return { granularity: "day", trend: [] };
  }

  const times = logs.map((log) => log.date.getTime());
  // A set range is drawn in full, empty days included, so a quiet week shows as
  // a gap rather than disappearing.
  const start = startOfUtcDay(from ?? new Date(Math.min(...times)));
  const end = startOfUtcDay(to ?? new Date(Math.max(...times)));
  const granularity = granularityFor(start, end);

  const buckets = new Map<string, TrendBucket>();

  for (
    let cursor = bucketStart(start, granularity);
    cursor.getTime() <= end.getTime();
    cursor = nextBucket(cursor, granularity)
  ) {
    const key = isoDay(cursor);
    buckets.set(key, {
      key,
      label: bucketLabel(cursor, granularity),
      firstPass: 0,
      rework: 0,
    });
  }

  for (const log of logs) {
    const bucket = buckets.get(isoDay(bucketStart(log.date, granularity)));

    if (!bucket) {
      continue;
    }

    const minutes = split(log);
    bucket.firstPass += minutes.firstPass;
    bucket.rework += minutes.rework;
  }

  return { granularity, trend: [...buckets.values()] };
}

function buildRanking(logs: TimeLogRow[], view: ReportView): RankedItem[] {
  const items = new Map<string, RankedItem>();

  for (const log of logs) {
    const { key, label } = RANKING_KEY[view](log);
    let item = items.get(key);

    if (!item) {
      item = { key, label, firstPass: 0, rework: 0, minutes: 0 };
      items.set(key, item);
    }

    const minutes = split(log);
    item.firstPass += minutes.firstPass;
    item.rework += minutes.rework;
    item.minutes += log.minutes;
  }

  const sorted = [...items.values()].sort(
    (a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label)
  );

  if (sorted.length <= RANKING_LIMIT) {
    return sorted;
  }

  const head = sorted.slice(0, RANKING_LIMIT - 1);
  const tail = sorted.slice(RANKING_LIMIT - 1);

  return [
    ...head,
    tail.reduce<RankedItem>(
      (other, item) => ({
        ...other,
        firstPass: other.firstPass + item.firstPass,
        rework: other.rework + item.rework,
        minutes: other.minutes + item.minutes,
      }),
      {
        key: "__other__",
        label: `Other (${tail.length})`,
        firstPass: 0,
        rework: 0,
        minutes: 0,
      }
    ),
  ];
}

/**
 * The mix donut shows services, except on the service tab, where the ranking
 * already is the service split and the donut shows clients instead.
 */
function buildShare(logs: TimeLogRow[], view: ReportView) {
  const byClient = view === "service";
  const labelOf = byClient ? clientOf : serviceOf;
  const totals = new Map<string, number>();

  for (const log of logs) {
    const label = labelOf(log);
    totals.set(label, (totals.get(label) ?? 0) + log.minutes);
  }

  const sorted = [...totals.entries()]
    .map(([label, minutes]) => ({ label, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label));

  const slices =
    sorted.length <= SHARE_LIMIT + 1
      ? sorted
      : [
          ...sorted.slice(0, SHARE_LIMIT),
          {
            label: `Other (${sorted.length - SHARE_LIMIT})`,
            minutes: sorted
              .slice(SHARE_LIMIT)
              .reduce((sum, slice) => sum + slice.minutes, 0),
          },
        ];

  return { title: byClient ? "Client mix" : "Service mix", slices };
}

function buildWeekdays(logs: ReportLogRow[]): WeekdayRow[] {
  const people = new Map<string, { name: string; total: number; minutes: number[] }>();

  for (const log of logs) {
    let person = people.get(log.user.id);

    if (!person) {
      person = { name: log.user.name, total: 0, minutes: [0, 0, 0, 0, 0, 0, 0] };
      people.set(log.user.id, person);
    }

    person.total += log.minutes;
    person.minutes[weekdayIndex(log.date)] += log.minutes;
  }

  return [...people.values()]
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .slice(0, WEEKDAY_ROW_LIMIT)
    .map(({ name, minutes }) => ({ name, minutes }));
}

function buildEntries(logs: ReportLogRow[]): ExportEntry[] {
  return [...logs]
    .sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() ||
        a.user.name.localeCompare(b.user.name)
    )
    .map((log) => ({
      date: isoDay(log.date),
      employee: log.user.name,
      client: clientOf(log),
      service: serviceOf(log),
      work: log.task.clientWork ?? "",
      task: log.task.title,
      minutes: log.minutes,
      cycle: log.reopenCycle,
      note: log.note ?? "",
    }));
}

function distinct(values: (string | null)[]) {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

/**
 * Everything the charts, the KPI row and the exports need, worked out once on
 * the server from the same filtered logs the tables use, so no number on the
 * page can disagree with another.
 */
export function buildReportAnalytics({
  logs,
  view,
  from,
  to,
  previous,
}: {
  logs: ReportLogRow[];
  view: ReportView;
  from: Date | null;
  to: Date | null;
  previous: ReportKpis["previous"];
}): ReportAnalytics {
  let firstPass = 0;
  let rework = 0;

  for (const log of logs) {
    const minutes = split(log);
    firstPass += minutes.firstPass;
    rework += minutes.rework;
  }

  const total = firstPass + rework;
  const tasks = distinct(logs.map((log) => log.task.id));
  const activeDays = distinct(logs.map((log) => isoDay(log.date)));
  const { granularity, trend } = buildTrend(logs, from, to);

  const reopens = buildReopenSummary(logs)
    .filter((task) => task.reopenMinutes > 0)
    .slice(0, REOPEN_BAR_LIMIT)
    .map((task) => ({
      taskId: task.taskId,
      title: task.title,
      client: task.client,
      reopenCount: task.reopenCount,
      originalMinutes: task.originalMinutes,
      reopenMinutes: task.reopenMinutes,
    }));

  return {
    kpis: {
      total,
      firstPass,
      rework,
      reworkRate: total > 0 ? (rework / total) * 100 : 0,
      entries: logs.length,
      tasks,
      employees: distinct(logs.map((log) => log.user.id)),
      clients: distinct(logs.map((log) => log.task.client?.id ?? null)),
      services: distinct(logs.map((log) => serviceNameOf(log.task.clientWork))),
      reopenedTasks: distinct(
        logs.map((log) => (log.task.reopenCount > 0 ? log.task.id : null))
      ),
      activeDays,
      averagePerTask: tasks > 0 ? total / tasks : 0,
      averagePerDay: activeDays > 0 ? total / activeDays : 0,
      previous,
    },
    granularity,
    trend,
    ranking: buildRanking(logs, view),
    share: buildShare(logs, view),
    weekdays: buildWeekdays(logs),
    reopens,
    entries: buildEntries(logs),
  };
}

/**
 * The window of the same length directly before [from, to], for the
 * "vs previous period" deltas. Only a fully set range has one.
 */
export function previousPeriod(from: Date | null, to: Date | null) {
  if (!from || !to || to.getTime() < from.getTime()) {
    return null;
  }

  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
  const prevTo = new Date(from.getTime() - DAY_MS);
  const prevFrom = new Date(from.getTime() - days * DAY_MS);

  return {
    from: prevFrom,
    /** Inclusive of the whole last day. */
    toEnd: new Date(prevTo.getTime() + DAY_MS - 1),
    label: `previous ${days} ${days === 1 ? "day" : "days"}`,
  };
}

/** Quick range chips above the filters, all as "YYYY-MM-DD" pairs. */
export function datePresets(today: Date) {
  const day = startOfUtcDay(today);
  const year = day.getUTCFullYear();
  const month = day.getUTCMonth();
  const quarterStart = Math.floor(month / 3) * 3;
  const weekStart = new Date(day.getTime() - weekdayIndex(day) * DAY_MS);

  const range = (label: string, start: Date, end: Date) => ({
    label,
    from: isoDay(start),
    to: isoDay(end),
  });

  return [
    range("This week", weekStart, day),
    range("Last 7 days", new Date(day.getTime() - 6 * DAY_MS), day),
    range("This month", new Date(Date.UTC(year, month, 1)), day),
    range(
      "Last month",
      new Date(Date.UTC(year, month - 1, 1)),
      new Date(Date.UTC(year, month, 0))
    ),
    range("Last 30 days", new Date(day.getTime() - 29 * DAY_MS), day),
    range("This quarter", new Date(Date.UTC(year, quarterStart, 1)), day),
    range("This year", new Date(Date.UTC(year, 0, 1)), day),
  ];
}
