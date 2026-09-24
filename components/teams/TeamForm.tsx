import TextareaWithBullet from "@/components/ui/TextareaWithBullet";

type TeamFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  employees: {
    id: string;
    name: string;
    email: string;
  }[];
  team?: {
    id: string;
    name: string;
    description: string | null;
    members: {
      id: string;
    }[];
  };
};

export default function TeamForm({
  action,
  submitLabel,
  employees,
  team,
}: TeamFormProps) {
  const selectedMemberIds = new Set(team?.members.map((member) => member.id));

  return (
    <form
      action={action}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      {team ? <input type="hidden" name="id" value={team.id} /> : null}

      <div className="grid gap-5">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Name</span>
          <input
            name="name"
            type="text"
            defaultValue={team?.name}
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
            defaultValue={team?.description ?? ""}
            rows={4}
            className="resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </label>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium text-slate-700">
            Team Members
          </legend>
          {employees.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No employees available.
            </p>
          ) : (
            <div className="grid gap-2 rounded-md border border-slate-200 p-3">
              {employees.map((employee) => (
                <label
                  key={employee.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-slate-50"
                >
                  <input
                    name="memberIds"
                    type="checkbox"
                    value={employee.id}
                    defaultChecked={selectedMemberIds.has(employee.id)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    <span className="font-medium text-slate-800">
                      {employee.name}
                    </span>
                    <span className="ml-2 text-slate-500">
                      {employee.email}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
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
