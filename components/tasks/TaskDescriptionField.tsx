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
      <div className="flex h-48 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-sm text-slate-400">
        Loading editor...
      </div>
    ),
  }
);

/**
 * A task's description, in the editor's basic toolbar. Posted as HTML in a
 * hidden field and sanitised on the server (lib/taskDescription.ts); there is
 * no length limit.
 */
export default function TaskDescriptionField({
  initialContent,
}: {
  /** The saved description as HTML; empty for a new task. */
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">Description</span>
      <input type="hidden" name="description" value={content} />
      <RichTextEditor initialData={initialContent} onChange={setContent} variant="basic" />
    </div>
  );
}
