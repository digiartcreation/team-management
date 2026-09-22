import TextareaWithBullet from "@/components/ui/TextareaWithBullet";
import ClientWorkField, {
  type TaskClientOption,
} from "@/components/tasks/ClientWorkField";
import { TASK_STATUS_OPTIONS, canReopenFrom } from "@/lib/taskStatus";

type TaskFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  employees: {
    id: string;
    name: string;
    email: string;
  }[];
  teams: {
    id: string;
    name: string;
  }[];
  clients: TaskClientOption[];
  task?: {
    id: string;
    title: string;
    description: string | null;
    assignedToId: string | null;
    teamId: string | null;
    clientId: string | null;
    clientWork: string | null;
    digitalMarketingAmount: number | null;
    status: string;
    priority: string;
  };
};

const priorities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export default function TaskForm({
  action,
  submitLabel,
  employees,
  teams,
  clients,
  task,
}: TaskFormProps) {
  // Reopening is a return trip, so the option only exists on a task that was
  // called finished -- or on one already sitting in Reopened, whose own status
  // has to stay selectable.
  const statuses = TASK_STATUS_OPTIONS.filter(
    (status) =>
      status.value !== "reopened" ||
      canReopenFrom(task?.status ?? "") ||
      task?.status === "reopened"
  );

  return (
    <form
      action={action}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      {task ? <input type="hidden" name="id" value={task.id} /> : null}

      <div className="grid gap-5">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Title</span>
          <input
            name="title"
            type="text"
            defaultValue={task?.title}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">
            Description
          </span>
          <TextareaWithBullet
            name="description"
            defaultValue={task?.description ?? ""}
            rows={4}
            className="resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </label>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              Assigned Employee
            </span>
            <select
              name="assignedToId"
              defaultValue={task?.assignedToId ?? ""}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              <option value="">Unassigned</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.email})
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Team</span>
            <select
              name="teamId"
              defaultValue={task?.teamId ?? ""}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ClientWorkField
          clients={clients}
          selectedClientId={task?.clientId ?? null}
          selectedWork={task?.clientWork ?? null}
          digitalMarketingAmount={task?.digitalMarketingAmount ?? null}
        />

        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              name="status"
              defaultValue={task?.status ?? "pending"}
              required
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              Priority
            </span>
            <select
              name="priority"
              defaultValue={task?.priority ?? "medium"}
              required
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              {priorities.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
