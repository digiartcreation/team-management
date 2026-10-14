"use client";

import { useState } from "react";
import {
  INTERN,
  SECTOR_OPTIONS,
  getSectorDesignations,
} from "@/lib/designations";

type SectorDesignationFieldProps = {
  selectedSector: string | null;
  selectedDesignation: string | null;
  /** A designation must be picked (base prices); employees may have none. */
  required?: boolean;
};

const selectClassName =
  "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export default function SectorDesignationField({
  selectedSector,
  selectedDesignation,
  required = false,
}: SectorDesignationFieldProps) {
  const [sector, setSector] = useState(selectedSector ?? "");
  const [designation, setDesignation] = useState(selectedDesignation ?? "");

  const designations = getSectorDesignations(sector);

  return (
    <>
      <label className="grid content-start gap-2">
        <span className="text-sm font-medium text-slate-700">Sector</span>
        <select
          name="sector"
          value={sector}
          onChange={(event) => {
            const nextSector = event.target.value;
            setSector(nextSector);
            // Designations belong to a sector; only Intern fits every one.
            if (designation !== INTERN) {
              setDesignation("");
            }
          }}
          className={selectClassName}
        >
          <option value="" disabled={required}>
            {required ? "Select a sector" : "No sector"}
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
          onChange={(event) => setDesignation(event.target.value)}
          required={required}
          className={selectClassName}
        >
          <option value="" disabled={required}>
            {required ? "Select a designation" : "No designation"}
          </option>
          {/* A record saved before the sector list changed can hold a
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
            Choose a sector to see its designations.
          </span>
        )}
      </label>
    </>
  );
}
