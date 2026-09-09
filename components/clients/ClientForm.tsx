import TextareaWithBullet from "@/components/ui/TextareaWithBullet";
import ServicesField from "@/components/clients/ServicesField";
import {
  CLIENT_STATUS_OPTIONS,
  getDigitalMarketingFocus,
  getServiceNames,
} from "@/lib/services";

type ClientFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  client?: {
    id: string;
    name: string;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    services: string | null;
    status: string;
    notes: string | null;
  };
};

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export default function ClientForm({
  action,
  submitLabel,
  client,
}: ClientFormProps) {
  const selectedServices = getServiceNames(client?.services ?? null);
  const digitalMarketingFocus = getDigitalMarketingFocus(
    client?.services ?? null
  );

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

        <ServicesField
          selected={selectedServices}
          digitalMarketingFocus={digitalMarketingFocus}
        />

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
