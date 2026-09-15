"use client";

import { useState } from "react";
import {
  BILLING_CYCLE_OPTIONS,
  DIGITAL_MARKETING,
  DIGITAL_MARKETING_OPTIONS,
  PACKAGE,
  PERCENTAGE,
  PER_COUNT,
  SERVICE_OPTIONS,
  paymentTypesForService,
  resolvePaymentType,
  serviceKey,
  type ServiceMapping,
} from "@/lib/services";

type ServicesFieldProps = {
  /** Payment mapping already saved for this client; empty when creating one. */
  mappings: ServiceMapping[];
};

type Row = {
  checked: boolean;
  focus: string;
  paymentType: string;
  percentage: string;
  packageAmount: string;
  perUnitAmount: string;
  billingCycle: string;
};

const controlClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

const labelClass =
  "text-xs font-medium uppercase tracking-normal text-slate-500";

function numberToInput(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function buildInitialRows(mappings: ServiceMapping[]) {
  const saved = new Map(mappings.map((mapping) => [mapping.service, mapping]));

  return SERVICE_OPTIONS.reduce<Record<string, Row>>((rows, service) => {
    const mapping = saved.get(service);

    rows[service] = {
      checked: Boolean(mapping),
      focus: mapping?.focus ?? "",
      paymentType: resolvePaymentType(service, mapping?.paymentType),
      percentage: numberToInput(mapping?.percentage),
      packageAmount: numberToInput(mapping?.packageAmount),
      perUnitAmount: numberToInput(mapping?.perUnitAmount),
      billingCycle: mapping?.billingCycle ?? BILLING_CYCLE_OPTIONS[0],
    };

    return rows;
  }, {});
}

export default function ServicesField({ mappings }: ServicesFieldProps) {
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    buildInitialRows(mappings)
  );

  function update(service: string, patch: Partial<Row>) {
    setRows((current) => ({
      ...current,
      [service]: { ...current[service], ...patch },
    }));
  }

  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium text-slate-700">
        Services &amp; Payment
      </legend>
      <p className="text-sm text-slate-500">
        Tick each service this client is engaged for, then set how that service
        is paid. Percentage applies to Digital Marketing only, and Video Editing
        is billed per count or as a package.
      </p>

      <div className="grid gap-3">
        {SERVICE_OPTIONS.map((service) => {
          const row = rows[service];
          const key = serviceKey(service);
          const paymentTypes = paymentTypesForService(service);

          return (
            <div
              key={service}
              className={
                row.checked
                  ? "grid gap-3 rounded-md border border-[#A05DD0]/40 bg-[#F8F7FB] p-3 transition"
                  : "grid gap-3 rounded-md border border-slate-200 p-3 transition"
              }
            >
              <label className="flex items-center gap-3 text-sm">
                <input
                  name="services"
                  type="checkbox"
                  value={service}
                  checked={row.checked}
                  onChange={(event) =>
                    update(service, { checked: event.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="font-medium text-slate-800">{service}</span>
              </label>

              {row.checked ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {service === DIGITAL_MARKETING ? (
                    <label className="grid gap-2 sm:col-span-2">
                      <span className={labelClass}>Focus area</span>
                      <select
                        name={"focus-" + key}
                        value={row.focus}
                        onChange={(event) =>
                          update(service, { focus: event.target.value })
                        }
                        required
                        className={controlClass}
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

                  {paymentTypes.length > 1 ? (
                    <label className="grid gap-2">
                      <span className={labelClass}>Payment type</span>
                      <select
                        name={"paymentType-" + key}
                        value={row.paymentType}
                        onChange={(event) =>
                          update(service, { paymentType: event.target.value })
                        }
                        required
                        className={controlClass}
                      >
                        {paymentTypes.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    // Package-only service: nothing to choose, so state the
                    // single type and still submit it with the form.
                    <div className="grid gap-2">
                      <span className={labelClass}>Payment type</span>
                      <p className="px-1 py-2 text-sm text-slate-700">
                        {row.paymentType}
                      </p>
                      <input
                        name={"paymentType-" + key}
                        type="hidden"
                        value={row.paymentType}
                      />
                    </div>
                  )}

                  {row.paymentType === PERCENTAGE ? (
                    <label className="grid gap-2">
                      <span className={labelClass}>Percentage (%)</span>
                      <input
                        name={"percentage-" + key}
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        max="100"
                        step="0.01"
                        placeholder="Eg: 20"
                        value={row.percentage}
                        onChange={(event) =>
                          update(service, { percentage: event.target.value })
                        }
                        required
                        className={controlClass}
                      />
                    </label>
                  ) : null}

                  {row.paymentType === PER_COUNT ? (
                    <label className="grid gap-2">
                      <span className={labelClass}>
                        Rate per count (&#8377;)
                      </span>
                      <input
                        name={"perUnitAmount-" + key}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        placeholder="Eg: 2000"
                        value={row.perUnitAmount}
                        onChange={(event) =>
                          update(service, { perUnitAmount: event.target.value })
                        }
                        required
                        className={controlClass}
                      />
                    </label>
                  ) : null}

                  {row.paymentType === PACKAGE ? (
                    <>
                      <label className="grid gap-2">
                        <span className={labelClass}>
                          Package amount (&#8377;)
                        </span>
                        <input
                          name={"packageAmount-" + key}
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          placeholder="Eg: 150000"
                          value={row.packageAmount}
                          onChange={(event) =>
                            update(service, {
                              packageAmount: event.target.value,
                            })
                          }
                          required
                          className={controlClass}
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className={labelClass}>Billing cycle</span>
                        <select
                          name={"billingCycle-" + key}
                          value={row.billingCycle}
                          onChange={(event) =>
                            update(service, {
                              billingCycle: event.target.value,
                            })
                          }
                          required
                          className={controlClass}
                        >
                          {BILLING_CYCLE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
