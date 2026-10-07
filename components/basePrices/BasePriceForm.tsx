import { DESIGNATION_OPTIONS } from "@/lib/designations";
import { SERVICE_OPTIONS } from "@/lib/services";

type BasePriceFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  basePrice?: {
    id: string;
    service: string;
    designation: string;
    basePrice: number;
  };
};

const fieldClassName =
  "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export default function BasePriceForm({
  action,
  submitLabel,
  basePrice,
}: BasePriceFormProps) {
  return (
    <form
      action={action}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      {basePrice ? (
        <input type="hidden" name="id" value={basePrice.id} />
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Service</span>
          <select
            name="service"
            defaultValue={basePrice?.service ?? ""}
            required
            className={fieldClassName}
          >
            <option value="" disabled>
              Select a service
            </option>
            {SERVICE_OPTIONS.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">
            Designation
          </span>
          <select
            name="designation"
            defaultValue={basePrice?.designation ?? ""}
            required
            className={fieldClassName}
          >
            <option value="" disabled>
              Select a designation
            </option>
            {DESIGNATION_OPTIONS.map((designation) => (
              <option key={designation} value={designation}>
                {designation}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">
            Base Price per Hour (₹)
          </span>
          <input
            name="basePrice"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={basePrice?.basePrice}
            required
            placeholder="Enter hourly price"
            className={fieldClassName}
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
