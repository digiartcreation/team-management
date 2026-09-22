import { splitService } from "@/lib/services";

export type TimeLogRow = {
  minutes: number;
  /** 0 for the original run, 1 for work after the first reopen, and so on. */
  reopenCycle: number;
  user: { id: string; name: string };
  task: {
    id: string;
    title: string;
    clientWork: string | null;
    reopenCount: number;
    client: { id: string; name: string } | null;
  };
};

export type PersonTotal = {
  userId: string;
  name: string;
  minutes: number;
};

/** One task inside a group, carrying the detail columns its view asks for. */
export type TaskTotal = {
  taskId: string;
  title: string;
  /** Secondary column values, in the same order as the view's detailHeadings. */
  details: (string | null)[];
  minutes: number;
  /**
   * The share of those minutes logged after a reopen. It is part of minutes,
   * not on top of it: rework is still time the task cost, only time that says
   * the work had to be done twice.
   */
  reopenMinutes: number;
  /** How many times the task has been sent back, 0 for most of them. */
  reopenCount: number;
  people: PersonTotal[];
};

/** A client, an employee or a service, with the tasks its time went to. */
export type ReportGroup = {
  key: string;
  label: string;
  minutes: number;
  reopenMinutes: number;
  tasks: TaskTotal[];
};

/**
 * One reopened task, as the reopen summary reports it: what the first pass
 * cost, what each return added, and the total the two come to.
 */
export type ReopenTotal = {
  taskId: string;
  title: string;
  client: string;
  reopenCount: number;
  originalMinutes: number;
  reopenMinutes: number;
  minutes: number;
  /** Hours per return, cycle 1 first. */
  cycles: { cycle: number; minutes: number }[];
};

export const REPORT_VIEWS = ["client", "employee", "service"] as const;

export type ReportView = (typeof REPORT_VIEWS)[number];

export const DEFAULT_REPORT_VIEW: ReportView = "client";

export const INTERNAL_LABEL = "Internal (no client)";
export const UNMAPPED_SERVICE_LABEL = "No service mapped";

type ViewDefinition = {
  /** Tab label. */
  tab: string;
  /** Page heading and blurb, so the report says what it is showing. */
  heading: string;
  description: string;
  /** Heading of the first column, which carries both group and task rows. */
  groupHeading: string;
  /** Headings for the secondary columns, left to right. */
  detailHeadings: string[];
  /**
   * Whether who logged the time deserves its own column. On the employee
   * report it never does -- every row under a group is that one person.
   */
  showPeople: boolean;
  groupKey: (log: TimeLogRow) => string;
  groupLabel: (log: TimeLogRow) => string;
  details: (log: TimeLogRow) => (string | null)[];
};

/** Service without its focus area: "Digital Marketing (SEO)" -> "Digital Marketing". */
export function serviceNameOf(clientWork: string | null) {
  return clientWork ? splitService(clientWork).name : null;
}

function clientLabel(log: TimeLogRow) {
  return log.task.client?.name ?? INTERNAL_LABEL;
}

export const REPORT_VIEW_DEFINITIONS: Record<ReportView, ViewDefinition> = {
  client: {
    tab: "Client wise",
    heading: "Time Spent by Client",
    description:
      "Hours logged against each client, broken down by task and by the person who did the work.",
    groupHeading: "Client / Task",
    detailHeadings: ["Work"],
    showPeople: true,
    groupKey: (log) => log.task.client?.id ?? "__internal__",
    groupLabel: clientLabel,
    details: (log) => [log.task.clientWork],
  },
  employee: {
    tab: "Employee wise",
    heading: "Time Spent by Employee",
    description:
      "Hours each employee logged, broken down by the task and the client the time went to.",
    groupHeading: "Employee / Task",
    detailHeadings: ["Client", "Work"],
    showPeople: false,
    groupKey: (log) => log.user.id,
    groupLabel: (log) => log.user.name,
    details: (log) => [clientLabel(log), log.task.clientWork],
  },
  service: {
    tab: "Service wise",
    heading: "Time Spent by Service",
    description:
      "Hours logged against each service, broken down by task, client and the person who did the work.",
    groupHeading: "Service / Task",
    detailHeadings: ["Client", "Work"],
    showPeople: true,
    groupKey: (log) => serviceNameOf(log.task.clientWork) ?? "__unmapped__",
    groupLabel: (log) =>
      serviceNameOf(log.task.clientWork) ?? UNMAPPED_SERVICE_LABEL,
    details: (log) => [clientLabel(log), log.task.clientWork],
  },
};

export function isReportView(value: string | undefined): value is ReportView {
  return REPORT_VIEWS.includes(value as ReportView);
}

/** Largest total first, then alphabetical, so the ordering is never arbitrary. */
function byMinutesThenName<T extends { minutes: number }>(
  nameOf: (item: T) => string
) {
  return (a: T, b: T) =>
    b.minutes - a.minutes || nameOf(a).localeCompare(nameOf(b));
}

/**
 * Folds flat time-log rows into group -> task -> person totals. The group is
 * whichever dimension the chosen view reports on, which is how each report
 * reads: how many hours went to this client / this employee / this service, on
 * which task, and by whom.
 */
export function buildReport(
  logs: TimeLogRow[],
  view: ReportView
): ReportGroup[] {
  const definition = REPORT_VIEW_DEFINITIONS[view];

  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      minutes: number;
      reopenMinutes: number;
      tasks: Map<
        string,
        {
          taskId: string;
          title: string;
          details: (string | null)[];
          minutes: number;
          reopenMinutes: number;
          reopenCount: number;
          people: Map<string, PersonTotal>;
        }
      >;
    }
  >();

  for (const log of logs) {
    const key = definition.groupKey(log);

    let group = groups.get(key);

    if (!group) {
      group = {
        key,
        label: definition.groupLabel(log),
        minutes: 0,
        reopenMinutes: 0,
        tasks: new Map(),
      };
      groups.set(key, group);
    }

    group.minutes += log.minutes;

    let task = group.tasks.get(log.task.id);

    if (!task) {
      task = {
        taskId: log.task.id,
        title: log.task.title,
        details: definition.details(log),
        minutes: 0,
        reopenMinutes: 0,
        reopenCount: log.task.reopenCount,
        people: new Map(),
      };
      group.tasks.set(log.task.id, task);
    }

    task.minutes += log.minutes;

    if (log.reopenCycle > 0) {
      group.reopenMinutes += log.minutes;
      task.reopenMinutes += log.minutes;
    }

    const person = task.people.get(log.user.id);

    if (person) {
      person.minutes += log.minutes;
    } else {
      task.people.set(log.user.id, {
        userId: log.user.id,
        name: log.user.name,
        minutes: log.minutes,
      });
    }
  }

  return [...groups.values()]
    .map((group) => ({
      key: group.key,
      label: group.label,
      minutes: group.minutes,
      reopenMinutes: group.reopenMinutes,
      tasks: [...group.tasks.values()]
        .map((task) => ({
          taskId: task.taskId,
          title: task.title,
          details: task.details,
          minutes: task.minutes,
          reopenMinutes: task.reopenMinutes,
          reopenCount: task.reopenCount,
          people: [...task.people.values()].sort(
            byMinutesThenName<PersonTotal>((person) => person.name)
          ),
        }))
        .sort(byMinutesThenName<TaskTotal>((task) => task.title)),
    }))
    .sort(byMinutesThenName<ReportGroup>((group) => group.label));
}

/**
 * The reopen report: every task with time in range that has been sent back at
 * least once, with the original pass and each return priced separately and then
 * added up. It is built from the same filtered logs as the rest of the page, so
 * a task whose reopen hours fall outside the range still appears on the
 * strength of its original hours, showing no reopen time for the period -- the
 * honest answer rather than a silent omission.
 */
export function buildReopenSummary(logs: TimeLogRow[]): ReopenTotal[] {
  const tasks = new Map<
    string,
    ReopenTotal & { cycleTotals: Map<number, number> }
  >();

  for (const log of logs) {
    if (log.task.reopenCount === 0) {
      continue;
    }

    let task = tasks.get(log.task.id);

    if (!task) {
      task = {
        taskId: log.task.id,
        title: log.task.title,
        client: clientLabel(log),
        reopenCount: log.task.reopenCount,
        originalMinutes: 0,
        reopenMinutes: 0,
        minutes: 0,
        cycles: [],
        cycleTotals: new Map(),
      };
      tasks.set(log.task.id, task);
    }

    task.minutes += log.minutes;

    if (log.reopenCycle > 0) {
      task.reopenMinutes += log.minutes;
      task.cycleTotals.set(
        log.reopenCycle,
        (task.cycleTotals.get(log.reopenCycle) ?? 0) + log.minutes
      );
    } else {
      task.originalMinutes += log.minutes;
    }
  }

  return [...tasks.values()]
    .map(({ cycleTotals, ...task }) => ({
      ...task,
      cycles: [...cycleTotals.entries()]
        .map(([cycle, minutes]) => ({ cycle, minutes }))
        .sort((a, b) => a.cycle - b.cycle),
    }))
    .sort(
      (a, b) =>
        b.reopenMinutes - a.reopenMinutes ||
        b.reopenCount - a.reopenCount ||
        a.title.localeCompare(b.title)
    );
}

/** Hours in range that went into rework rather than the first pass. */
export function totalReopenMinutes(logs: TimeLogRow[]) {
  return logs
    .filter((log) => log.reopenCycle > 0)
    .reduce((sum, log) => sum + log.minutes, 0);
}

export function countReopenedTasks(logs: TimeLogRow[]) {
  return new Set(
    logs.filter((log) => log.task.reopenCount > 0).map((log) => log.task.id)
  ).size;
}

/** Overall per-person totals across every group, for the summary table. */
export function groupTimeByPerson(logs: TimeLogRow[]): PersonTotal[] {
  const people = new Map<string, PersonTotal>();

  for (const log of logs) {
    const person = people.get(log.user.id);

    if (person) {
      person.minutes += log.minutes;
    } else {
      people.set(log.user.id, {
        userId: log.user.id,
        name: log.user.name,
        minutes: log.minutes,
      });
    }
  }

  return [...people.values()].sort(
    byMinutesThenName<PersonTotal>((person) => person.name)
  );
}

export function countDistinctTasks(logs: TimeLogRow[]) {
  return new Set(logs.map((log) => log.task.id)).size;
}

export function countDistinctClients(logs: TimeLogRow[]) {
  return new Set(
    logs.filter((log) => log.task.client).map((log) => log.task.client!.id)
  ).size;
}

export function countDistinctServices(logs: TimeLogRow[]) {
  return new Set(
    logs
      .map((log) => serviceNameOf(log.task.clientWork))
      .filter((service): service is string => Boolean(service))
  ).size;
}
