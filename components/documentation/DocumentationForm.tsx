"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useActionState, useState } from "react";
import ClickToSubmitForm from "@/components/ui/ClickToSubmitForm";
import FileInput from "@/components/ui/FileInput";
import SubmitButton from "@/components/ui/SubmitButton";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_IMAGE_BYTES,
  formatFileSize,
} from "@/lib/uploads";
import type { DocumentationFormState } from "@/app/documentation/actions";

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

type DocumentationFormProps = {
  action: (
    previous: DocumentationFormState,
    formData: FormData
  ) => Promise<DocumentationFormState>;
  submitLabel: string;
  pendingLabel: string;
  /** Where Cancel leads: the page being edited, or the list. */
  cancelHref: string;
  page?: {
    id: string;
    title: string;
    content: string;
    attachment: { fileName: string; size: number } | null;
  };
};

export default function DocumentationForm({
  action,
  submitLabel,
  pendingLabel,
  cancelHref,
  page,
}: DocumentationFormProps) {
  const [state, formAction] = useActionState(action, null);
  // Both held here rather than left to the inputs: React resets a form after
  // its action runs, and a rejected save must not wipe what was written.
  const [title, setTitle] = useState(page?.title ?? "");
  const [content, setContent] = useState(page?.content ?? "");
  const [removeAttachment, setRemoveAttachment] = useState(false);

  return (
    <ClickToSubmitForm
      action={formAction}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      {page ? <input type="hidden" name="id" value={page.id} /> : null}
      <input type="hidden" name="content" value={content} />

      <div className="grid gap-5">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Heading</span>
          <input
            name="title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={191}
            placeholder="Eg: How we hand over a finished video"
            className="rounded-md border border-slate-300 px-3 py-2 text-base font-medium outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Content</span>
          <RichTextEditor initialData={page?.content ?? ""} onChange={setContent} />
          <span className="text-xs text-slate-500">
            Use the image button, or paste or drop images in. PNG, JPEG, GIF or
            WebP, up to {formatFileSize(MAX_IMAGE_BYTES)} each.
          </span>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-slate-700">
            Attachment{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </legend>
          {page?.attachment ? (
            <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <a
                  href={`/api/documentation/${page.id}/attachment`}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-medium text-[#770FC2] hover:underline"
                >
                  {page.attachment.fileName}
                </a>
                <span className="ml-2 text-xs text-slate-500">
                  {formatFileSize(page.attachment.size)}
                </span>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-sm text-slate-700">
                <input
                  name="removeAttachment"
                  type="checkbox"
                  checked={removeAttachment}
                  onChange={(event) => setRemoveAttachment(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Remove the current attachment
              </label>
            </div>
          ) : null}
          <FileInput name="attachment" kind="attachment" />
          <span className="text-xs text-slate-500">
            {page?.attachment
              ? "Choose a file to replace the current attachment. "
              : ""}
            An image, a PDF or any other file, up to{" "}
            {formatFileSize(MAX_ATTACHMENT_BYTES)}. Images and PDFs open in the
            browser; anything else downloads.
          </span>
        </fieldset>

        {state?.error ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </Link>
        <SubmitButton
          pendingLabel={pendingLabel}
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:hover:bg-slate-950"
        >
          {submitLabel}
        </SubmitButton>
      </div>
    </ClickToSubmitForm>
  );
}
