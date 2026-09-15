"use client";

import { useState } from "react";
import { DIGITAL_MARKETING } from "@/lib/services";

export type TaskClientOption = {
  id: string;
  name: string;
  status: string;
  /** Services recorded on the client, focus areas included. */
  works: string[];
};

type ClientWorkFieldProps = {
  clients: TaskClientOption[];
  selectedClientId: string | null;
  selectedWork: string | null;
  digitalMarketingAmount?: number | null;
};

const selectClassName =
  "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400";

export default function ClientWorkField({
  clients,
  selectedClientId,
  selectedWork,
  digitalMarketingAmount,
}: ClientWorkFieldProps) {
  const [clientId, setClientId] = useState(selectedClientId ?? "");
  const [work, setWork] = useState(selectedWork ?? "");
  const [amount, setAmount] = useState(
    digitalMarketingAmount === null || digitalMarketingAmount === undefined
      ? ""
      : String(digitalMarketingAmount)
  );

  const selectedClient = clients.find((client) => client.id === clientId);
  const works = selectedClient?.works ?? [];

  // A task saved before the client's service list changed can point at work the
  // client no longer has. Keep showing it so editing an unrelated field does not
  // silently drop the mapping.
  const workOptions =
    work && !works.includes(work) ? [...works, work] : works;
  const isDigitalMarketing = work.startsWith(DIGITAL_MARKETING);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">Client</span>
        <select
          name="clientId"
          value={clientId}
          onChange={(event) => {
            setClientId(event.target.value);
            // Work belongs to the client, so a new client invalidates it.
            setWork("");
            setAmount("");
          }}
          className={selectClassName}
        >
          <option value="">No client (internal task)</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
              {client.status === "Active" ? "" : ` (${client.status})`}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">Work</span>
        <select
          name="clientWork"
          value={work}
          onChange={(event) => {
            const nextWork = event.target.value;
            setWork(nextWork);
            if (!nextWork.startsWith(DIGITAL_MARKETING)) {
              setAmount("");
            }
          }}
          disabled={!clientId || workOptions.length === 0}
          required={Boolean(clientId) && workOptions.length > 0}
          className={selectClassName}
        >
          <option value="">
            {!clientId
              ? "Select a client first"
              : workOptions.length === 0
                ? "No services on this client"
                : "Select the work"}
          </option>
          {workOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {clientId && workOptions.length === 0 ? (
          <span className="text-xs text-slate-500">
            Add services to {selectedClient?.name ?? "this client"} to map work.
          </span>
        ) : null}
      </label>

      {isDigitalMarketing ? (
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Amount (₹)</span>
          <input
            name="digitalMarketingAmount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            placeholder="Enter amount"
            className={selectClassName}
          />
        </label>
      ) : null}
    </div>
  );
}
