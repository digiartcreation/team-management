"use client";

import { useState } from "react";
import { SECTOR_OPTIONS, getSectorDesignations } from "@/lib/designations";

export type SectorDesignationValue = { sector: string; designation: string };

type SectorDesignationFieldProps = {
  selectedSector: string | null;
  selectedDesignation: string | null;
  /** Both must be picked (base prices); employees may have neither. */
  required?: boolean;
  /** Told about every change, for a form that tracks its own completeness. */
  onChange?: (value: SectorDesignationValue) => void;
};

const selectClassName =
  "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

/** Domain, then a designation from that domain. Stored as `sector`. */
export default function SectorDesignationField({
  selectedSector,
  selectedDesignation,
  required = false,
  onChange,
}: SectorDesignationFieldProps) {
  const [sector, setSector] = useState(selectedSector ?? "");
  const [designation, setDesignation] = useState(selectedDesignation ?? "");

  const designations = getSectorDesignations(sector);

  function update(next: SectorDesignationValue) {
    setSector(next.sector);
    setDesignation(next.designation);
    onChange?.(next);
  }

  return (
    <>
      <label className="grid content-start gap-2">
        <span className="text-sm font-medium text-slate-700">Domain</span>
        <select
          name="sector"
          value={sector}
          onChange={(event) => {
            const nextSector = event.target.value;
            // Designations belong to a domain; keep the pick only if the new
            // domain has it too, as every domain has an Intern.
            update({
              sector: nextSector,
              designation: getSectorDesignations(nextSector).includes(designation)
                ? designation
                : "",
            });
          }}
          required={required}
          className={selectClassName}
        >
          <option value="" disabled={required}>
            {required ? "Select a domain" : "No domain"}
          </option>
          {sector && !SECTOR_OPTIONS.includes(sector) ? (
            <option value={sector}>{sector}</option>
          ) : null}
          {SECTOR_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="grid content-start gap-2">
        <span className="text-sm font-medium text-slate-700">Designation</span>
        <select
          name="designation"
          value={designation}
          onChange={(event) =>
            update({ sector, designation: event.target.value })
          }
          required={required}
          className={selectClassName}
        >
          <option value="" disabled={required}>
            {required ? "Select a designation" : "No designation"}
          </option>
          {/* A record saved before the domain list changed can hold a
              designation that no longer fits; keep it so an unrelated edit
              does not drop it. */}
          {designation && !designations.includes(designation) ? (
            <option value={designation}>{designation}</option>
          ) : null}
          {designations.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {sector ? null : (
          <span className="text-xs text-slate-500">
            Choose a domain to see its designations.
          </span>
        )}
      </label>
    </>
  );
}
