"use client";

import { useState } from "react";
import { UPLOAD_ACCEPT, uploadProblem, type UploadKind } from "@/lib/uploads";

type FileInputProps = {
  name: string;
  /** Which rules the file is held to; see lib/uploads.ts. */
  kind: UploadKind;
};

/**
 * A file picker for a client's SOP file or a documentation attachment. A
 * wrong type or an oversized file is flagged as soon as it is picked and holds
 * the form back, rather than being sent off and turned away by the server
 * with a page that cannot say why.
 */
export default function FileInput({ name, kind }: FileInputProps) {
  const [problem, setProblem] = useState<string | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    const next = file ? uploadProblem(kind, file.name, file.size) : null;

    input.setCustomValidity(next ?? "");
    setProblem(next);

    if (next) {
      input.reportValidity();
    }
  }

  return (
    <>
      <input
        name={name}
        type="file"
        accept={UPLOAD_ACCEPT[kind]}
        onChange={handleChange}
        aria-invalid={problem ? true : undefined}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-[#F3E8FF] file:px-3 file:py-1 file:text-sm file:font-medium file:text-[#770FC2]"
      />
      {problem ? (
        <span role="alert" className="text-xs font-medium text-red-600">
          {problem}
        </span>
      ) : null}
    </>
  );
}
