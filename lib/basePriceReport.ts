import { monthKeyOf, monthLabel } from "@/lib/attendance";
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

/** One time log in the report's range, with what pricing it needs. */
export type ReportLog = {
  minutes: number;
  /** The work day, stored as its UTC midnight. */
  date: Date;
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

/** Minutes logged on one task on one day, whoever logged them. */
export type TaskHistory = {
  taskId: string;
  clientId: string | null;
  clientWork: string | null;
  date: Date;
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
  /** The time logs in the chosen range, client, service and employee. */
  logs: ReportLog[];
  /** Service payments of every client in the logs. */
  mappings: ReportMapping[];
  basePrices: ReportBasePrice[];
  /**
   * Every minute ever logged on those clients' tasks, by anyone. Amounts are
   * shared over all the hours they pay for, not only the ones on screen.
   */
  history: TaskHistory[];
};

/** Minutes the amounts are shared over, from the whole history. */
type Pools = {
  task: Map<string, number>;
  service: Map<string, number>;
  serviceMonth: Map<string, number>;
};

function serviceNameOf(work: string | null) {
  return work ? splitService(work).name : null;
}

function poolKey(clientId: string, service: string) {
  return `${clientId}\u0000${service}`;
}

function monthPoolKey(clientId: string, service: string, month: string) {
  return `${poolKey(clientId, service)}\u0000${month}`;
}

function rateKey(service: string, sector: string, designation: string) {
  return `${service}\u0000${sector}\u0000${designation}`;
}

function add(map: Map<string, number>, key: string, minutes: number) {
  map.set(key, (map.get(key) ?? 0) + minutes);
}

type Income = { amount: number; rule: string } | { issue: string };

/**
 * An amount that pays for more hours than the ones on screen takes their
 * share by hours: `part` is this task's minutes in the report and `whole`
 * the minutes the amount is spread over.
 */
function shared(full: number, rule: string, part: number, whole: number, wholeLabel = "") {
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
  clientId: string,
  service: string,
  mapping: ServiceMapping,
  logs: ReportLog[],
  minutes: number,
  pools: Pools
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
      minutes,
      pools.task.get(task.id) ?? minutes
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
      minutes,
      pools.task.get(task.id) ?? minutes
    );
  }

  if (mapping.paymentType === PACKAGE) {
    const amount = mapping.packageAmount;

    if (amount === null) {
      return { issue: "Package amount not set on the client" };
    }

    if (mapping.billingCycle === "One-time") {
      return shared(
        amount,
        `${formatInr(amount)} one-time`,
        minutes,
        pools.service.get(poolKey(clientId, service)) ?? minutes,
        " all time"
      );
    }

    // Each calendar month pays its own package, shared by that month's hours.
    const byMonth = new Map<string, number>();

    for (const log of logs) {
      add(byMonth, monthKeyOf(log.date), log.minutes);
    }

    const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
    const pieces = months.map(([month, part]) =>
      shared(
        amount,
        `${formatInr(amount)} monthly`,
        part,
        pools.serviceMonth.get(monthPoolKey(clientId, service, month)) ?? part
      )
    );

    return {
      amount: pieces.reduce((sum, piece) => sum + piece.amount, 0),
      rule:
        pieces.length === 1
          ? pieces[0].rule
          : pieces.map((piece, index) => `${monthLabel(months[index][0])}: ${piece.rule}`).join(" + "),
    };
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
 * Prices the logged work. Income comes from each client's service payment and
 * effort from hours times the base price for the task's service and the
 * employee's domain and designation. An amount that pays for more hours than
 * the ones in the report -- a per-count task worked over two months, a one-time
 * package, a monthly package shared by several tasks or several people -- goes
 * to them by their share of those hours.
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

  const pools: Pools = { task: new Map(), service: new Map(), serviceMonth: new Map() };

  for (const item of input.history) {
    add(pools.task, item.taskId, item.minutes);
    const service = serviceNameOf(item.clientWork);

    if (item.clientId && service) {
      add(pools.service, poolKey(item.clientId, service), item.minutes);
      add(
        pools.serviceMonth,
        monthPoolKey(item.clientId, service, monthKeyOf(item.date)),
        item.minutes
      );
    }
  }

  const tasks = new Map<string, { task: ReportLog["task"]; logs: ReportLog[]; minutes: number }>();

  for (const log of input.logs) {
    let entry = tasks.get(log.task.id);

    if (!entry) {
      entry = { task: log.task, logs: [], minutes: 0 };
      tasks.set(log.task.id, entry);
    }

    entry.logs.push(log);
    entry.minutes += log.minutes;
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
      const mapping = mappings.get(poolKey(task.client.id, service)) ?? null;

      if (!mapping) {
        row.issues.push(`${service} is not set up for this client`);
      } else {
        row.payment = mapping;
        const income = incomeFor(task, task.client.id, service, mapping, logs, minutes, pools);

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
