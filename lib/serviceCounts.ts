import { ratioBand, type GroupTotal } from "@/lib/basePriceReport";
import {
  DIGITAL_MARKETING,
  POSTER_DESIGN,
  VIDEO_EDITING,
  splitService,
} from "@/lib/services";

/** A client task completed in the period, with what Services Count adds up. */
export type CompletedTask = {
  clientId: string;
  clientName: string;
  clientWork: string | null;
  videoWeightage: number | null;
  posterCount: number | null;
  digitalMarketingAmount: number | null;
};

export type ServiceCountRow = {
  clientId: string;
  name: string;
  /** Video Editing tasks completed. */
  videos: number;
  /** Their weightage added up: how many videos they bill as. */
  videoWeightage: number;
  /** Posters across the Poster Design tasks completed. */
  posters: number;
  /** The Digital Marketing amount on the DM tasks completed, in INR. */
  dmAmount: number;
  /**
   * Income and cost of the hours logged in the period, priced as the Base
   * Price Report prices them. Null when the client had no priced hours.
   */
  income: number | null;
  cost: number | null;
  /**
   * (income - cost) / cost, as a percentage. Null with no cost to set it
   * against, or when the only work was Client Management, which is never billed.
   */
  profitPercent: number | null;
};

export type ServiceCountTotals = Omit<ServiceCountRow, "clientId" | "name" | "income" | "cost"> & {
  income: number;
  cost: number;
};

export type ServiceCountReport = {
  /** By client name. */
  rows: ServiceCountRow[];
  totals: ServiceCountTotals;
  /** Completed Poster Design tasks saved before a poster count was asked for. */
  postersWithoutCount: number;
};

/** Profit on cost: 29% when income is 1.29 times the cost. */
export function profitPercentOf(income: number, cost: number) {
  return cost > 0 ? ((income - cost) / cost) * 100 : null;
}

/**
 * The Base Price Report's colour band for a profit. Profit on cost is the
 * ratio less one, so 29% sits where a ratio of 1.29 does.
 */
export function profitBand(profitPercent: number) {
  return ratioBand(1 + profitPercent / 100);
}

/** "29.4%", "-8.0%". */
export function formatProfitPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

/** "3", "7.5": weightage comes in half steps. */
export function formatCount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Per client: what was delivered (tasks completed in the period) next to
 * what the period's hours earned and cost (`priced`, the Base Price Report's
 * client totals for the same range). A client shows up if it has either.
 */
export function buildServiceCounts(
  tasks: CompletedTask[],
  priced: GroupTotal[]
): ServiceCountReport {
  const rows = new Map<string, ServiceCountRow>();
  let postersWithoutCount = 0;

  const rowFor = (clientId: string, name: string) => {
    let row = rows.get(clientId);

    if (!row) {
      row = {
        clientId,
        name,
        videos: 0,
        videoWeightage: 0,
        posters: 0,
        dmAmount: 0,
        income: null,
        cost: null,
        profitPercent: null,
      };
      rows.set(clientId, row);
    }

    return row;
  };

  for (const task of tasks) {
    const service = task.clientWork ? splitService(task.clientWork).name : null;
    const row = rowFor(task.clientId, task.clientName);

    if (service === VIDEO_EDITING) {
      row.videos += 1;
      // Unset only on tasks from before weightage, which billed as one video.
      row.videoWeightage += task.videoWeightage ?? 1;
    } else if (service === POSTER_DESIGN) {
      if (task.posterCount === null) {
        postersWithoutCount += 1;
      } else {
        row.posters += task.posterCount;
      }
    } else if (service === DIGITAL_MARKETING) {
      row.dmAmount += task.digitalMarketingAmount ?? 0;
    }
  }

  // Tasks of other services leave nothing to count; a client with only those
  // and no priced hours is dropped again below.
  for (const group of priced) {
    const row = rowFor(group.key, group.name);
    row.income = group.income;
    row.cost = group.effort;
    row.profitPercent = group.costOnly ? null : profitPercentOf(group.income, group.effort);
  }

  const list = [...rows.values()]
    .filter(
      (row) =>
        row.videos > 0 ||
        row.posters > 0 ||
        row.dmAmount > 0 ||
        row.income !== null
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const totals: ServiceCountTotals = {
    videos: 0,
    videoWeightage: 0,
    posters: 0,
    dmAmount: 0,
    income: 0,
    cost: 0,
    profitPercent: null,
  };

  for (const row of list) {
    totals.videos += row.videos;
    totals.videoWeightage += row.videoWeightage;
    totals.posters += row.posters;
    totals.dmAmount += row.dmAmount;
    totals.income += row.income ?? 0;
    totals.cost += row.cost ?? 0;
  }

  totals.profitPercent = profitPercentOf(totals.income, totals.cost);

  return { rows: list, totals, postersWithoutCount };
}
