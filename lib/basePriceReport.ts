import { monthKeyOf, monthLabel } from "@/lib/attendance";
import { formatDuration } from "@/lib/duration";
import { includedMapping } from "@/lib/clientServices";
import {
  INCLUDED,
  PACKAGE,
  PERCENTAGE,
  PER_COUNT,
  POSTER_DESIGN,
  VIDEO_EDITING,
  formatInr,
  formatPercentage,
  isAlwaysIncluded,
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

/** Where each band starts and ends; the last is open-ended, drawn up to 3. */
const SCALE_EDGES = [0, 0.9, 1, 1.29, 1.6, 3];

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

/**
 * Where a ratio sits on a scale drawn as five equal bands, as a percentage of
 * its width: the band it falls in, then how far into that band.
 */
export function scalePosition(ratio: number) {
  const index = RATIO_BANDS.indexOf(ratioBand(ratio));
  const low = SCALE_EDGES[index];
  const high = SCALE_EDGES[index + 1];
  const within = Math.min(1, Math.max(0, (roundRatio(ratio) - low) / (high - low)));

  return ((index + within) * 100) / RATIO_BANDS.length;
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
  /** The employee's domain. */
  sector: string | null;
  designation: string | null;
  minutes: number;
  /** Base price per hour, or null when none is set for this employee and service. */
  rate: number | null;
  effort: number | null;
};

/**
 * The report's minutes of an amount that pays for more hours: `part` are the
 * ones on screen, `whole` all the hours the amount is shared over.
 */
export type HoursShare = { part: number; whole: number };

export type MonthShare = {
  /** "2026-10". */
  month: string;
  part: number;
  whole: number;
  income: number;
};

/** Each step of a task's income, so the page can show the working. */
export type IncomeBreakdown =
  | { kind: "included" }
  | {
      kind: "perCount";
      unit: "poster" | "video" | "item";
      count: number;
      rate: number;
      full: number;
      /** Null when the report holds all of the task's hours. */
      share: HoursShare | null;
    }
  | {
      kind: "percentage";
      /** The Digital Marketing amount recorded on the task. */
      base: number;
      percentage: number;
      full: number;
      share: HoursShare | null;
    }
  | { kind: "oneTime"; amount: number; share: HoursShare | null }
  | { kind: "monthly"; amount: number; months: MonthShare[] };

/** Where missing data is fixed. */
export type FixPlace = "task" | "client" | "employee" | "basePrice";

export type RowIssue = {
  message: string;
  fix: FixPlace;
  /** The employee to fix, when `fix` is "employee". */
  userId?: string;
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
  /** The service, without its focus area: "Digital Marketing". */
  service: string | null;
  /** The task's work as stored, focus area included. */
  work: string | null;
  payment: ServiceMapping | null;
  breakdown: IncomeBreakdown | null;
  incomeRule: string | null;
  income: number | null;
  minutes: number;
  effort: number | null;
  employees: EmployeeLine[];
  ratio: number | null;
  status: TaskRowStatus;
  issues: RowIssue[];
};

/** A client's or a service's share of the totals. */
export type GroupTotal = {
  /** Client id, or the service name. */
  key: string;
  name: string;
  income: number;
  effort: number;
  minutes: number;
  tasks: number;
  /**
   * Only Client Management work, which is never billed: there is effort but
   * nothing to set it against, so there is no ratio.
   */
  costOnly: boolean;
  ratio: number | null;
};

export type BasePriceReport = {
  rows: TaskRow[];
  /** Highest income first. */
  byClient: GroupTotal[];
  byService: GroupTotal[];
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

/** Null when the report already holds every hour the amount pays for. */
function shareOf(part: number, whole: number): HoursShare | null {
  return whole <= part ? null : { part, whole };
}

function shareOfAmount(amount: number, share: HoursShare | null) {
  return share ? (amount * share.part) / share.whole : amount;
}

export function incomeOf(breakdown: IncomeBreakdown) {
  switch (breakdown.kind) {
    case "included":
      return 0;
    case "perCount":
    case "percentage":
      return shareOfAmount(breakdown.full, breakdown.share);
    case "oneTime":
      return shareOfAmount(breakdown.amount, breakdown.share);
    case "monthly":
      return breakdown.months.reduce((sum, month) => sum + month.income, 0);
  }
}

export function countLabel(unit: "poster" | "video" | "item", count: number) {
  if (unit === "poster") return `${count} ${count === 1 ? "poster" : "posters"}`;
  if (unit === "video") return `weightage ${count}`;
  return `${count}`;
}

function withShare(rule: string, share: HoursShare | null, wholeLabel = "") {
  return share
    ? `${rule} × ${formatDuration(share.part)} ÷ ${formatDuration(share.whole)}${wholeLabel}`
    : rule;
}

/** The income as one line: "1 poster × ₹1,000", "₹7,978 monthly × 10h ÷ 16h". */
export function describeIncome(breakdown: IncomeBreakdown) {
  switch (breakdown.kind) {
    case "included":
      return "Included, no charge";
    case "perCount":
      return withShare(
        `${countLabel(breakdown.unit, breakdown.count)} × ${formatInr(breakdown.rate)}`,
        breakdown.share
      );
    case "percentage":
      return withShare(
        `${formatInr(breakdown.base)} × ${formatPercentage(breakdown.percentage)}`,
        breakdown.share
      );
    case "oneTime":
      return withShare(`${formatInr(breakdown.amount)} one-time`, breakdown.share, " all time");
    case "monthly": {
      const pieces = breakdown.months.map((month) =>
        withShare(`${formatInr(breakdown.amount)} monthly`, shareOf(month.part, month.whole))
      );

      return pieces.length === 1
        ? pieces[0]
        : pieces.map((piece, index) => `${monthLabel(breakdown.months[index].month)}: ${piece}`).join(" + ");
    }
  }
}

function breakdownFor(
  task: ReportLog["task"],
  clientId: string,
  service: string,
  mapping: ServiceMapping,
  logs: ReportLog[],
  minutes: number,
  pools: Pools
): IncomeBreakdown | RowIssue {
  if (mapping.paymentType === INCLUDED) {
    return { kind: "included" };
  }

  if (mapping.paymentType === PER_COUNT) {
    if (mapping.perUnitAmount === null) {
      return { message: "Per-count rate not set on the client", fix: "client" };
    }

    let unit: "poster" | "video" | "item" = "item";
    let count = 1;

    if (service === POSTER_DESIGN) {
      if (!task.posterCount) {
        return { message: "Poster count not set on the task", fix: "task" };
      }

      unit = "poster";
      count = task.posterCount;
    } else if (service === VIDEO_EDITING) {
      // A video's weightage is how many videos it bills as.
      unit = "video";
      count = task.videoWeightage ?? 1;
    }

    return {
      kind: "perCount",
      unit,
      count,
      rate: mapping.perUnitAmount,
      full: count * mapping.perUnitAmount,
      share: shareOf(minutes, pools.task.get(task.id) ?? minutes),
    };
  }

  if (mapping.paymentType === PERCENTAGE) {
    if (mapping.percentage === null) {
      return { message: "Percentage not set on the client", fix: "client" };
    }

    if (task.digitalMarketingAmount === null) {
      return { message: "Digital Marketing amount not set on the task", fix: "task" };
    }

    return {
      kind: "percentage",
      base: task.digitalMarketingAmount,
      percentage: mapping.percentage,
      full: (task.digitalMarketingAmount * mapping.percentage) / 100,
      share: shareOf(minutes, pools.task.get(task.id) ?? minutes),
    };
  }

  if (mapping.paymentType === PACKAGE) {
    const amount = mapping.packageAmount;

    if (amount === null) {
      return { message: "Package amount not set on the client", fix: "client" };
    }

    if (mapping.billingCycle === "One-time") {
      return {
        kind: "oneTime",
        amount,
        share: shareOf(minutes, pools.service.get(poolKey(clientId, service)) ?? minutes),
      };
    }

    // Each calendar month pays its own package, shared by that month's hours.
    const byMonth = new Map<string, number>();

    for (const log of logs) {
      add(byMonth, monthKeyOf(log.date), log.minutes);
    }

    return {
      kind: "monthly",
      amount,
      months: [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, part]) => {
          const whole = Math.max(
            part,
            pools.serviceMonth.get(monthPoolKey(clientId, service, month)) ?? part
          );

          return { month, part, whole, income: (amount * part) / whole };
        }),
    };
  }

  return { message: `Payment type "${mapping.paymentType}" cannot be billed`, fix: "client" };
}

const STATUS_ORDER: Record<TaskRowStatus, number> = {
  counted: 0,
  included: 0,
  issue: 1,
  internal: 2,
};

/** Totals per client or per service, from the rows in the totals. */
function groupRows(rows: TaskRow[], keyOf: (row: TaskRow) => [string, string]) {
  const groups = new Map<string, GroupTotal & { billed: boolean }>();

  for (const row of rows) {
    if (row.status !== "counted" && row.status !== "included") {
      continue;
    }

    const [key, name] = keyOf(row);
    let group = groups.get(key);

    if (!group) {
      group = { key, name, income: 0, effort: 0, minutes: 0, tasks: 0, costOnly: false, ratio: null, billed: false };
      groups.set(key, group);
    }

    group.income += row.income ?? 0;
    group.effort += row.effort ?? 0;
    group.minutes += row.minutes;
    group.tasks += 1;
    group.billed ||= row.status === "counted";
  }

  return [...groups.values()]
    .map(({ billed, ...group }) => ({
      ...group,
      costOnly: !billed,
      ratio: billed && group.effort > 0 ? group.income / group.effort : null,
    }))
    .sort((a, b) => b.income - a.income || b.effort - a.effort || a.name.localeCompare(b.name));
}

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
          sector,
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
    const pricedEffort = employees.every((line) => line.effort !== null)
      ? employees.reduce((sum, line) => sum + (line.effort ?? 0), 0)
      : null;

    const row: TaskRow = {
      taskId: task.id,
      title: task.title,
      clientId: task.client?.id ?? null,
      clientName: task.client?.name ?? null,
      service,
      work: task.clientWork,
      payment: null,
      breakdown: null,
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
      // Its cost is shown for reference; internal work stays out of the totals.
      row.status = "internal";
      row.effort = pricedEffort;
      return row;
    }

    if (!service) {
      row.issues.push({ message: "No service chosen on the task", fix: "task" });
    } else {
      // A client saved before an always-included service existed has no row
      // for it, but is still under it.
      const mapping =
        mappings.get(poolKey(task.client.id, service)) ??
        (isAlwaysIncluded(service) ? includedMapping(service) : null);

      if (!mapping) {
        row.issues.push({ message: `${service} is not set up for this client`, fix: "client" });
      } else {
        row.payment = mapping;
        const result = breakdownFor(task, task.client.id, service, mapping, logs, minutes, pools);

        if ("message" in result) {
          row.issues.push(result);
        } else {
          row.breakdown = result;
          row.income = incomeOf(result);
          row.incomeRule = describeIncome(result);
        }

        if (mapping.paymentType === INCLUDED) {
          row.status = "included";
        }
      }

      for (const line of employees) {
        if (line.rate !== null) {
          continue;
        }

        const issue: RowIssue =
          !line.sector || !line.designation
            ? { message: `${line.name} has no domain or designation`, fix: "employee", userId: line.userId }
            : { message: `No base price for ${service} · ${line.sector} · ${line.designation}`, fix: "basePrice" };

        if (!row.issues.some((existing) => existing.message === issue.message)) {
          row.issues.push(issue);
        }
      }

      row.effort = pricedEffort;
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

  const totals = { income: 0, effort: 0, minutes: 0, ratio: null as number | null, tasks: 0 };
  const leftOut = { tasks: 0, minutes: 0 };
  const internal = { tasks: 0, minutes: 0 };

  for (const row of rows) {
    if (row.status === "internal") {
      internal.tasks += 1;
      internal.minutes += row.minutes;
    } else if (row.status === "issue") {
      leftOut.tasks += 1;
      leftOut.minutes += row.minutes;
    } else {
      totals.income += row.income ?? 0;
      totals.effort += row.effort ?? 0;
      totals.minutes += row.minutes;
      totals.tasks += 1;
    }
  }

  totals.ratio = totals.effort > 0 ? totals.income / totals.effort : null;

  return {
    rows,
    byClient: groupRows(rows, (row) => [row.clientId!, row.clientName!]),
    byService: groupRows(rows, (row) => [row.service!, row.service!]),
    totals,
    leftOut,
    internal,
  };
}
