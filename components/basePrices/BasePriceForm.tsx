"use client";

import { useState } from "react";
import SectorDesignationField from "@/components/employees/SectorDesignationField";
import SubmitButton from "@/components/ui/SubmitButton";
import { ALL_SERVICE_OPTIONS } from "@/lib/services";

type BasePriceFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  basePrice?: {
    id: string;
    service: string;
    sector: string;
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
  // Every field is required, so Save stays off until each one has a value.
  const [sector, setSector] = useState(basePrice?.sector ?? "");
  const [designation, setDesignation] = useState(basePrice?.designation ?? "");
  const [service, setService] = useState(basePrice?.service ?? "");
  const [amount, setAmount] = useState(
    basePrice ? String(basePrice.basePrice) : ""
  );
  const complete = Boolean(
    sector && designation && service && amount.trim() !== ""
  );

  return (
    <form
      action={action}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      {basePrice ? (
        <input type="hidden" name="id" value={basePrice.id} />
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <SectorDesignationField
          selectedSector={basePrice?.sector ?? null}
          selectedDesignation={basePrice?.designation ?? null}
          required
          onChange={(value) => {
            setSector(value.sector);
            setDesignation(value.designation);
          }}
        />

        <label className="grid content-start gap-2">
          <span className="text-sm font-medium text-slate-700">Service</span>
          <select
            name="service"
            value={service}
            onChange={(event) => setService(event.target.value)}
            required
            className={fieldClassName}
          >
            <option value="" disabled>
              Select a service
            </option>
            {/* Internal-only services too: their tasks are costed for reference. */}
            {ALL_SERVICE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="grid content-start gap-2">
          <span className="text-sm font-medium text-slate-700">
            Base Price per Hour (₹)
          </span>
          <input
            name="basePrice"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            placeholder="Enter hourly price"
            className={fieldClassName}
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <SubmitButton
          disabled={!complete}
          pendingLabel="Saving..."
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
