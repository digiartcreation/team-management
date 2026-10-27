"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// CKEditor works on the browser's DOM, so it is loaded there and never
// rendered on the server.
const RichTextEditor = dynamic(
  () => import("@/components/documentation/RichTextEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-sm text-slate-400">
        Loading editor...
      </div>
    ),
  }
);

/**
 * The client's SOP, written in the same editor as documentation pages but
 * without images. Posted as HTML in a hidden field and sanitised on the
 * server (app/clients/actions.ts).
 */
export default function SopField({ initialContent }: { initialContent: string }) {
  const [content, setContent] = useState(initialContent);

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">
        SOP <span className="font-normal text-slate-400">(optional)</span>
      </span>
      <input type="hidden" name="sopContent" value={content} />
      <RichTextEditor
        initialData={initialContent}
        onChange={setContent}
        images={false}
        placeholder="How this client's work is done: steps, points to check, who to ask."
      />
    </div>
  );
}
