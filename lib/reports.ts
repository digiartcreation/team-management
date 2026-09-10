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

export type TaskTotal = {
  taskId: string;
  title: string;
  work: string | null;
  minutes: number;
  people: PersonTotal[];
};

export type ClientTotal = {
  /** null for tasks with no client, grouped under "Internal". */
  clientId: string | null;
  clientName: string;
  minutes: number;
  tasks: TaskTotal[];
};

export const INTERNAL_LABEL = "Internal (no client)";

/** Largest total first, then alphabetical, so the ordering is never arbitrary. */
function byMinutesThenName<T extends { minutes: number }>(
  nameOf: (item: T) => string
) {
  return (a: T, b: T) =>
    b.minutes - a.minutes || nameOf(a).localeCompare(nameOf(b));
}

/**
 * Folds flat time-log rows into client -> task -> person totals, which is how
 * the report reads: how many hours went to each client, on which task, by whom.
 */
export function groupTimeByClient(logs: TimeLogRow[]): ClientTotal[] {
  const clients = new Map<
    string,
    {
      clientId: string | null;
      clientName: string;
      minutes: number;
      tasks: Map<
        string,
        {
          taskId: string;
          title: string;
          work: string | null;
          minutes: number;
          people: Map<string, PersonTotal>;
        }
      >;
    }
  >();

  for (const log of logs) {
    const clientKey = log.task.client?.id ?? "__internal__";

    let client = clients.get(clientKey);

    if (!client) {
      client = {
        clientId: log.task.client?.id ?? null,
        clientName: log.task.client?.name ?? INTERNAL_LABEL,
        minutes: 0,
        tasks: new Map(),
      };
      clients.set(clientKey, client);
    }

    client.minutes += log.minutes;

    let task = client.tasks.get(log.task.id);

    if (!task) {
      task = {
        taskId: log.task.id,
        title: log.task.title,
        work: log.task.clientWork,
        minutes: 0,
        people: new Map(),
      };
      client.tasks.set(log.task.id, task);
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

  return [...clients.values()]
    .map((client) => ({
      clientId: client.clientId,
      clientName: client.clientName,
      minutes: client.minutes,
      tasks: [...client.tasks.values()]
        .map((task) => ({
          taskId: task.taskId,
          title: task.title,
          work: task.work,
          minutes: task.minutes,
          people: [...task.people.values()].sort(
            byMinutesThenName<PersonTotal>((person) => person.name)
          ),
        }))
        .sort(byMinutesThenName<TaskTotal>((task) => task.title)),
    }))
    .sort(byMinutesThenName<ClientTotal>((client) => client.clientName));
}

/** Overall per-person totals across every client, for the summary table. */
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
