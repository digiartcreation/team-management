import TextareaWithBullet from "@/components/ui/TextareaWithBullet";
import ServicesField from "@/components/clients/ServicesField";
import SopField from "@/components/clients/SopField";
import FileInput from "@/components/ui/FileInput";
import { CLIENT_STATUS_OPTIONS, type ServiceMapping } from "@/lib/services";
import { MAX_SOP_BYTES, SOP_TYPE_LABEL, formatFileSize } from "@/lib/uploads";

type ClientFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  /** Employee names to pick Owner and Communication Person from. */
  people?: string[];
  client?: {
    id: string;
    name: string;
    contactPerson: string | null;
    owner: string | null;
    communicationPerson: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    notes: string | null;
    sopContent: string | null;
    serviceMappings: ServiceMapping[];
    sop: { fileName: string; size: number } | null;
  };
};

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

/**
 * Owner or Communication Person, picked from the employees. A name saved
 * before these were dropdowns, or of someone no longer listed, stays an option
 * so saving the form does not quietly clear it.
 */
function PersonSelect({
  name,
  value,
  people,
}: {
  name: string;
  value: string | null | undefined;
  people: string[];
}) {
  const options =
    value && !people.includes(value)
      ? [...people, value].sort((a, b) => a.localeCompare(b))
      : people;

  return (
    <select name={name} defaultValue={value ?? ""} className={inputClass}>
      <option value="">Not set</option>
      {options.map((person) => (
        <option key={person} value={person}>
          {person}
        </option>
      ))}
    </select>
  );
}

export default function ClientForm({
  action,
  submitLabel,
  people = [],
  client,
}: ClientFormProps) {
  return (
    <form
      action={action}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      {client ? <input type="hidden" name="id" value={client.id} /> : null}

      <div className="grid gap-5">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">
            Client Name
          </span>
          <input
            name="name"
            type="text"
            defaultValue={client?.name}
            required
            placeholder="Eg: Leo Car Accessories"
            className={inputClass}
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              Contact Person
            </span>
            <input
              name="contactPerson"
              type="text"
              defaultValue={client?.contactPerson ?? ""}
              className={inputClass}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              name="status"
              defaultValue={client?.status ?? "Active"}
              className={inputClass}
            >
              {CLIENT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Owner</span>
            <PersonSelect name="owner" value={client?.owner} people={people} />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              Communication Person
            </span>
            <PersonSelect
              name="communicationPerson"
              value={client?.communicationPerson}
              people={people}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              name="email"
              type="email"
              defaultValue={client?.email ?? ""}
              className={inputClass}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Phone</span>
            <input
              name="phone"
              type="tel"
              defaultValue={client?.phone ?? ""}
              className={inputClass}
            />
          </label>
        </div>

        <ServicesField mappings={client?.serviceMappings ?? []} />

        <SopField initialContent={client?.sopContent ?? ""} />

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-slate-700">
            File Upload{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </legend>
          {client?.sop ? (
            <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <a
                  href={`/api/clients/${client.id}/sop`}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-medium text-[#770FC2] hover:underline"
                >
                  {client.sop.fileName}
                </a>
                <span className="ml-2 text-xs text-slate-500">
                  {formatFileSize(client.sop.size)}
                </span>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-sm text-slate-700">
                <input
                  name="removeSop"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                />
                Remove the current file
              </label>
            </div>
          ) : null}
          <FileInput name="sop" kind="sop" />
          <span className="text-xs text-slate-500">
            {client?.sop
              ? "Choose a file to replace the current one. "
              : ""}
            {SOP_TYPE_LABEL}, up to {formatFileSize(MAX_SOP_BYTES)}.
          </span>
        </fieldset>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Comments</span>
          <TextareaWithBullet
            name="notes"
            defaultValue={client?.notes ?? ""}
            rows={4}
            className="resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </label>
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
