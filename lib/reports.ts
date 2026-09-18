import { splitService } from "@/lib/services";

export type TimeLogRow = {
  minutes: number;
  user: { id: string; name: string };
  task: {
    id: string;
    title: string;
    clientWork: string | null;
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
  people: PersonTotal[];
};

/** A client, an employee or a service, with the tasks its time went to. */
export type ReportGroup = {
  key: string;
  label: string;
  minutes: number;
  tasks: TaskTotal[];
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
      tasks: Map<
        string,
        {
          taskId: string;
          title: string;
          details: (string | null)[];
          minutes: number;
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
        people: new Map(),
      };
      group.tasks.set(log.task.id, task);
    }

    task.minutes += log.minutes;

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
      tasks: [...group.tasks.values()]
        .map((task) => ({
          taskId: task.taskId,
          title: task.title,
          details: task.details,
          minutes: task.minutes,
          people: [...task.people.values()].sort(
            byMinutesThenName<PersonTotal>((person) => person.name)
          ),
        }))
        .sort(byMinutesThenName<TaskTotal>((task) => task.title)),
    }))
    .sort(byMinutesThenName<ReportGroup>((group) => group.label));
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
