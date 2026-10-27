import {
  DIGITAL_MARKETING,
  PERCENTAGE,
  PER_COUNT,
  POSTER_DESIGN,
  VIDEO_EDITING,
  formatInr,
  formatPaymentTerms,
  formatPercentage,
  splitService,
  type ServiceMapping,
} from "@/lib/services";

/** The services Services Count adds up, in the order it lists them. */
export const COUNTED_SERVICES = [VIDEO_EDITING, POSTER_DESIGN, DIGITAL_MARKETING] as const;

export type CountedService = (typeof COUNTED_SERVICES)[number];

/** A client task completed in the period. */
export type CompletedTask = {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  clientWork: string | null;
  videoWeightage: number | null;
  posterCount: number | null;
  digitalMarketingAmount: number | null;
  /** ISO, the moment it was first completed. */
  completedAt: string;
};

/** One task behind a line, with what it adds to the count. */
export type CountedTask = {
  id: string;
  title: string;
  quantity: number;
  completedAt: string;
};

/** One service of one client: how much, at what rate, for how much. */
export type ServiceLine = {
  service: CountedService;
  tasks: CountedTask[];
  /** Video weightage added up, posters added up, or the DM amount in INR. */
  quantity: number;
  /** How the client pays for the service; null when it is not set up. */
  payment: ServiceMapping | null;
  /**
   * quantity × the per-count rate, or for Digital Marketing the amount × the
   * percentage. Null when the client pays another way (a package) or the
   * rate is not set.
   */
  amount: number | null;
};

export type ClientCount = {
  clientId: string;
  name: string;
  lines: ServiceLine[];
  /** The line amounts added up. */
  total: number;
};

export type ServiceTotal = { tasks: number; quantity: number; amount: number };

export type ServiceCountReport = {
  /** By client name. */
  clients: ClientCount[];
  byService: Record<CountedService, ServiceTotal>;
  total: number;
  /** Completed Poster Design tasks saved before a poster count was asked for. */
  postersWithoutCount: number;
};

/** "3", "7.5": video weightage comes in half steps. */
export function formatCount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** "10", "5", "₹50,000": the line's quantity on its own. */
export function quantityLabel(service: CountedService, quantity: number) {
  return service === DIGITAL_MARKETING ? formatInr(quantity) : formatCount(quantity);
}

/** "8 tasks", for the brackets after the quantity. */
export function tasksLabel(tasks: number) {
  return plural(tasks, "task");
}

/** What the quantity is multiplied by: "₹1,000", "20%", or the client's terms. */
export function rateLabel(line: Pick<ServiceLine, "service" | "payment" | "amount">) {
  if (!line.payment) {
    return "Not set up on the client";
  }

  if (line.amount === null) {
    return formatPaymentTerms(line.payment);
  }

  return line.service === DIGITAL_MARKETING
    ? formatPercentage(line.payment.percentage ?? 0)
    : formatInr(line.payment.perUnitAmount ?? 0);
}

function amountOf(service: CountedService, quantity: number, payment: ServiceMapping | null) {
  if (!payment) {
    return null;
  }

  if (service === DIGITAL_MARKETING) {
    return payment.paymentType === PERCENTAGE && payment.percentage !== null
      ? (quantity * payment.percentage) / 100
      : null;
  }

  return payment.paymentType === PER_COUNT && payment.perUnitAmount !== null
    ? quantity * payment.perUnitAmount
    : null;
}

/**
 * Per client, what was delivered in the period and what it comes to at the
 * client's rate: videos by weightage (the number they bill as), posters by
 * count, Digital Marketing by amount.
 */
export function buildServiceCounts(
  tasks: CompletedTask[],
  mappings: (ServiceMapping & { clientId: string })[]
): ServiceCountReport {
  const payments = new Map(
    mappings.map((mapping) => [`${mapping.clientId}\u0000${mapping.service}`, mapping])
  );
  const clients = new Map<
    string,
    { name: string; tasks: Map<CountedService, CountedTask[]> }
  >();
  let postersWithoutCount = 0;

  for (const task of tasks) {
    const service = task.clientWork ? splitService(task.clientWork).name : null;

    if (!COUNTED_SERVICES.includes(service as CountedService)) {
      continue;
    }

    let quantity: number;

    if (service === VIDEO_EDITING) {
      // Unset only on tasks from before weightage, which billed as one video.
      quantity = task.videoWeightage ?? 1;
    } else if (service === POSTER_DESIGN) {
      if (task.posterCount === null) {
        postersWithoutCount += 1;
        continue;
      }

      quantity = task.posterCount;
    } else {
      quantity = task.digitalMarketingAmount ?? 0;
    }

    let client = clients.get(task.clientId);

    if (!client) {
      client = { name: task.clientName, tasks: new Map() };
      clients.set(task.clientId, client);
    }

    const list = client.tasks.get(service as CountedService) ?? [];
    list.push({ id: task.id, title: task.title, quantity, completedAt: task.completedAt });
    client.tasks.set(service as CountedService, list);
  }

  const byService = Object.fromEntries(
    COUNTED_SERVICES.map((service) => [service, { tasks: 0, quantity: 0, amount: 0 }])
  ) as Record<CountedService, ServiceTotal>;
  let total = 0;

  const list: ClientCount[] = [...clients.entries()]
    .map(([clientId, client]) => {
      const lines = COUNTED_SERVICES.flatMap((service): ServiceLine[] => {
        const counted = client.tasks.get(service);

        if (!counted) {
          return [];
        }

        const quantity = counted.reduce((sum, task) => sum + task.quantity, 0);
        const payment = payments.get(`${clientId}\u0000${service}`) ?? null;
        const amount = amountOf(service, quantity, payment);

        byService[service].tasks += counted.length;
        byService[service].quantity += quantity;
        byService[service].amount += amount ?? 0;

        return [
          {
            service,
            tasks: counted.sort((a, b) => a.completedAt.localeCompare(b.completedAt)),
            quantity,
            payment,
            amount,
          },
        ];
      });
      const clientTotal = lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
      total += clientTotal;

      return { clientId, name: client.name, lines, total: clientTotal };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { clients: list, byService, total, postersWithoutCount };
}
