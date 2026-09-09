"use client";

import { useState } from "react";
import {
  DIGITAL_MARKETING,
  DIGITAL_MARKETING_OPTIONS,
  SERVICE_OPTIONS,
} from "@/lib/services";

type ServicesFieldProps = {
  selected: string[];
  digitalMarketingFocus: string | null;
};

export default function ServicesField({
  selected,
  digitalMarketingFocus,
}: ServicesFieldProps) {
  const selectedServices = new Set(selected);
  const [showFocus, setShowFocus] = useState(
    selectedServices.has(DIGITAL_MARKETING)
  );

  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium text-slate-700">Services</legend>
      <div className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2">
        {SERVICE_OPTIONS.map((service) => (
          <label
            key={service}
            className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-slate-50"
          >
            <input
              name="services"
              type="checkbox"
              value={service}
              defaultChecked={selectedServices.has(service)}
              onChange={
                service === DIGITAL_MARKETING
                  ? (event) => setShowFocus(event.target.checked)
                  : undefined
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="font-medium text-slate-800">{service}</span>
          </label>
        ))}

        {showFocus ? (
          <label className="grid gap-2 px-2 py-2 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Digital Marketing focus
            </span>
            <select
              name="digitalMarketingFocus"
              defaultValue={digitalMarketingFocus ?? ""}
              required
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              <option value="" disabled>
                Select a focus area
              </option>
              {DIGITAL_MARKETING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </fieldset>
  );
}
