import { formatDuration } from "@/lib/duration";
import {
  INCLUDED,
  PACKAGE,
  PERCENTAGE,
  PER_COUNT,
  POSTER_DESIGN,
  VIDEO_EDITING,
  formatInr,
  formatPercentage,
  splitService,
  type ServiceMapping,
} from "@/lib/services";

export type RatioBand = {
  /** The colour as the scale names it. */
  colorName: string;
  /** What the band means for the business. */
  label: string;
  range: string;
  color: string;
};

/**
 * The five-step scale a ratio is coloured on, lowest first. The ratio is total
 * income divided by work effort, where effort is hours priced at base price.
 */
export const RATIO_BANDS: RatioBand[] = [
  { colorName: "Dark red", label: "Heavy loss", range: "Below 0.9", color: "#B42318" },
  { colorName: "Light red", label: "Small loss", range: "0.9 – 1.0", color: "#F0877D" },
  { colorName: "Yellow", label: "Thin margin", range: "1.0 – 1.29", color: "#F2C230" },
  { colorName: "Light green", label: "Healthy", range: "1.29 – 1.6", color: "#7CC995" },
  { colorName: "Dark green", label: "Strong", range: "Above 1.6", color: "#1E7F45" },
];

/** Two decimals, the precision every ratio is shown at. */
export function roundRatio(ratio: number) {
  return Math.round(ratio * 100) / 100;
}

/**
 * The band a ratio falls in, read off the ratio as shown: 1.289 displays as
 * 1.29, so it sits in light green rather than yellow.
 */
export function ratioBand(ratio: number) {
  const shown = roundRatio(ratio);

  if (shown < 0.9) return RATIO_BANDS[0];
  if (shown < 1) return RATIO_BANDS[1];
  if (shown < 1.29) return RATIO_BANDS[2];
  if (shown <= 1.6) return RATIO_BANDS[3];
  return RATIO_BANDS[4];
}

/** One time log of the month, with what pricing it needs. */
export type ReportLog = {
  minutes: number;
  user: {
    id: string;
    name: string;
    sector: string | null;
    designation: string | null;
  };
  task: {
    id: string;
    title: string;
    clientWork: string | null;
    videoWeightage: number | null;
    posterCount: number | null;
    digitalMarketingAmount: number | null;
    client: { id: string; name: string } | null;
  };
};

export type ReportBasePrice = {
  service: string;
  sector: string;
  designation: string;
  basePrice: number;
};

export type ReportMapping = ServiceMapping & { clientId: string };

/** Minutes ever logged on one task, whichever month they fell in. */
export type TaskHistory = {
  taskId: string;
  clientId: string | null;
  clientWork: string | null;
  minutes: number;
};

export type EmployeeLine = {
  userId: string;
  name: string;
  designation: string | null;
  minutes: number;
  /** Base price per hour, or null when none is set for this employee and service. */
  rate: number | null;
  effort: number | null;
};

/**
 * counted: billable and fully priced, so it is in every total and chart.
 * included: Client Management -- no income, but its effort counts for the client.
 * internal: no client, so nothing to bill; shown but kept out of the totals.
 * issue: missing data stops it being priced; shown but kept out of the totals.
 */
export type TaskRowStatus = "counted" | "included" | "internal" | "issue";

export type TaskRow = {
  taskId: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  /** The task's work as stored, focus area included. */
  work: string | null;
  payment: ServiceMapping | null;
  incomeRule: string | null;
  income: number | null;
  minutes: number;
  effort: number | null;
  employees: EmployeeLine[];
  ratio: number | null;
  status: TaskRowStatus;
  issues: string[];
};

export type ClientTotal = {
  clientId: string;
  name: string;
  income: number;
  effort: number;
  minutes: number;
  /** Null only if the client's effort is zero. */
  ratio: number | null;
};

export type BasePriceReport = {
  rows: TaskRow[];
  /** Highest income first. */
  clients: ClientTotal[];
  totals: { income: number; effort: number; minutes: number; ratio: number | null; tasks: number };
  leftOut: { tasks: number; minutes: number };
  internal: { tasks: number; minutes: number };
};

type ReportInput = {
  /** The month's time logs. */
  logs: ReportLog[];
  /** Service payments of every client in the month. */
  mappings: ReportMapping[];
  basePrices: ReportBasePrice[];
  /** Every task of the clients in the month, for amounts shared across months. */
  history: TaskHistory[];
};

function serviceNameOf(work: string | null) {
  return work ? splitService(work).name : null;
}

function poolKey(clientId: string, service: string) {
  return `${clientId}\u0000${service}`;
}

function rateKey(service: string, sector: string, designation: string) {
  return `${service}\u0000${sector}\u0000${designation}`;
}

type Income = { amount: number; rule: string } | { issue: string };

/**
 * An amount that belongs to more hours than this month's: the month takes its
 * share by hours. `part` is this task's minutes in the month and `whole` the
 * minutes the amount is spread over.
 */
function shared(full: number, rule: string, part: number, whole: number, wholeLabel = ""): Income {
  if (whole <= part) {
    return { amount: full, rule };
  }

  return {
    amount: (full * part) / whole,
    rule: `${rule} × ${formatDuration(part)} ÷ ${formatDuration(whole)}${wholeLabel}`,
  };
}

function incomeFor(
  task: ReportLog["task"],
  service: string,
  mapping: ServiceMapping,
  monthMinutes: number,
  taskMinutes: number,
  monthPoolMinutes: number,
  allTimePoolMinutes: number
): Income {
  if (mapping.paymentType === INCLUDED) {
    return { amount: 0, rule: "Included, no charge" };
  }

  if (mapping.paymentType === PER_COUNT) {
    if (mapping.perUnitAmount === null) {
      return { issue: "Per-count rate not set on the client" };
    }

    let count = 1;
    let countText = "1";

    if (service === POSTER_DESIGN) {
      if (!task.posterCount) {
        return { issue: "Poster count not set on the task" };
      }

      count = task.posterCount;
      countText = `${count} ${count === 1 ? "poster" : "posters"}`;
    } else if (service === VIDEO_EDITING) {
      // A video's weightage is how many videos it bills as.
      count = task.videoWeightage ?? 1;
      countText = `weightage ${count}`;
    }

    return shared(
      count * mapping.perUnitAmount,
      `${countText} × ${formatInr(mapping.perUnitAmount)}`,
      monthMinutes,
      taskMinutes
    );
  }

  if (mapping.paymentType === PERCENTAGE) {
    if (mapping.percentage === null) {
      return { issue: "Percentage not set on the client" };
    }

    if (task.digitalMarketingAmount === null) {
      return { issue: "Digital Marketing amount not set on the task" };
    }

    return shared(
      (task.digitalMarketingAmount * mapping.percentage) / 100,
      `${formatInr(task.digitalMarketingAmount)} × ${formatPercentage(mapping.percentage)}`,
      monthMinutes,
      taskMinutes
    );
  }

  if (mapping.paymentType === PACKAGE) {
    if (mapping.packageAmount === null) {
      return { issue: "Package amount not set on the client" };
    }

    if (mapping.billingCycle === "One-time") {
      return shared(
        mapping.packageAmount,
        `${formatInr(mapping.packageAmount)} one-time`,
        monthMinutes,
        allTimePoolMinutes,
        " all time"
      );
    }

    return shared(
      mapping.packageAmount,
      `${formatInr(mapping.packageAmount)} monthly`,
      monthMinutes,
      monthPoolMinutes
    );
  }

  return { issue: `Payment type "${mapping.paymentType}" cannot be billed` };
}

const STATUS_ORDER: Record<TaskRowStatus, number> = {
  counted: 0,
  included: 0,
  issue: 1,
  internal: 2,
};

/**
 * Prices a month of work. Income comes from each client's service payment and
 * effort from hours times the base price for the task's service and the
 * employee's domain and designation. Amounts that cover more than one month's
 * hours -- a per-count task worked over two months, a one-time package, a
 * monthly package shared by several tasks -- are split by hours logged.
 */
export function buildBasePriceReport(input: ReportInput): BasePriceReport {
  const rates = new Map(
    input.basePrices.map((row) => [
      rateKey(row.service, row.sector, row.designation),
      row.basePrice,
    ])
  );
  const mappings = new Map(
    input.mappings.map((mapping) => [poolKey(mapping.clientId, mapping.service), mapping])
  );

  const taskMinutes = new Map<string, number>();
  const allTimePools = new Map<string, number>();

  for (const item of input.history) {
    taskMinutes.set(item.taskId, (taskMinutes.get(item.taskId) ?? 0) + item.minutes);
    const service = serviceNameOf(item.clientWork);

    if (item.clientId && service) {
      const key = poolKey(item.clientId, service);
      allTimePools.set(key, (allTimePools.get(key) ?? 0) + item.minutes);
    }
  }

  const tasks = new Map<string, { task: ReportLog["task"]; logs: ReportLog[]; minutes: number }>();
  const monthPools = new Map<string, number>();

  for (const log of input.logs) {
    let entry = tasks.get(log.task.id);

    if (!entry) {
      entry = { task: log.task, logs: [], minutes: 0 };
      tasks.set(log.task.id, entry);
    }

    entry.logs.push(log);
    entry.minutes += log.minutes;

    const service = serviceNameOf(log.task.clientWork);

    if (log.task.client && service) {
      const key = poolKey(log.task.client.id, service);
      monthPools.set(key, (monthPools.get(key) ?? 0) + log.minutes);
    }
  }

  const rows: TaskRow[] = [...tasks.values()].map(({ task, logs, minutes }) => {
    const service = serviceNameOf(task.clientWork);
    const lines = new Map<string, EmployeeLine>();

    for (const log of logs) {
      let line = lines.get(log.user.id);

      if (!line) {
        const { sector, designation } = log.user;
        const rate =
          service && sector && designation
            ? (rates.get(rateKey(service, sector, designation)) ?? null)
            : null;
        line = {
          userId: log.user.id,
          name: log.user.name,
          designation,
          minutes: 0,
          rate,
          effort: null,
        };
        lines.set(log.user.id, line);
      }

      line.minutes += log.minutes;
    }

    const employees = [...lines.values()]
      .map((line) => ({
        ...line,
        effort: line.rate === null ? null : (line.minutes / 60) * line.rate,
      }))
      .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));

    const row: TaskRow = {
      taskId: task.id,
      title: task.title,
      clientId: task.client?.id ?? null,
      clientName: task.client?.name ?? null,
      work: task.clientWork,
      payment: null,
      incomeRule: null,
      income: null,
      minutes,
      effort: null,
      employees,
      ratio: null,
      status: "counted",
      issues: [],
    };

    if (!task.client) {
      row.status = "internal";
      return row;
    }

    if (!service) {
      row.issues.push("No service chosen on the task");
    } else {
      const key = poolKey(task.client.id, service);
      const mapping = mappings.get(key) ?? null;

      if (!mapping) {
        row.issues.push(`${service} is not set up for this client`);
      } else {
        row.payment = mapping;
        const income = incomeFor(
          task,
          service,
          mapping,
          minutes,
          taskMinutes.get(task.id) ?? minutes,
          monthPools.get(key) ?? minutes,
          allTimePools.get(key) ?? minutes
        );

        if ("issue" in income) {
          row.issues.push(income.issue);
        } else {
          row.income = income.amount;
          row.incomeRule = income.rule;
        }

        if (mapping.paymentType === INCLUDED) {
          row.status = "included";
        }
      }

      const unpriced = employees.filter((line) => line.rate === null);

      if (unpriced.length > 0) {
        row.issues.push(
          `No base price for ${unpriced.map((line) => line.name).join(", ")}`
        );
      } else {
        row.effort = employees.reduce((sum, line) => sum + (line.effort ?? 0), 0);
      }
    }

    if (row.issues.length > 0) {
      row.status = "issue";
    } else if (row.status === "counted" && row.effort && row.income !== null) {
      row.ratio = row.income / row.effort;
    }

    return row;
  });

  rows.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.clientName ?? "").localeCompare(b.clientName ?? "") ||
      a.title.localeCompare(b.title)
  );

  const clients = new Map<string, ClientTotal>();
  const totals = { income: 0, effort: 0, minutes: 0, ratio: null as number | null, tasks: 0 };
  const leftOut = { tasks: 0, minutes: 0 };
  const internal = { tasks: 0, minutes: 0 };

  for (const row of rows) {
    if (row.status === "internal") {
      internal.tasks += 1;
      internal.minutes += row.minutes;
      continue;
    }

    if (row.status === "issue") {
      leftOut.tasks += 1;
      leftOut.minutes += row.minutes;
      continue;
    }

    const income = row.income ?? 0;
    const effort = row.effort ?? 0;
    let client = clients.get(row.clientId!);

    if (!client) {
      client = { clientId: row.clientId!, name: row.clientName!, income: 0, effort: 0, minutes: 0, ratio: null };
      clients.set(row.clientId!, client);
    }

    client.income += income;
    client.effort += effort;
    client.minutes += row.minutes;
    totals.income += income;
    totals.effort += effort;
    totals.minutes += row.minutes;
    totals.tasks += 1;
  }

  for (const client of clients.values()) {
    client.ratio = client.effort > 0 ? client.income / client.effort : null;
  }

  totals.ratio = totals.effort > 0 ? totals.income / totals.effort : null;

  return {
    rows,
    clients: [...clients.values()].sort(
      (a, b) => b.income - a.income || a.name.localeCompare(b.name)
    ),
    totals,
    leftOut,
    internal,
  };
}
