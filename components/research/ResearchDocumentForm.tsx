import TextareaWithBullet from "@/components/ui/TextareaWithBullet";
import SubmitButton from "@/components/ui/SubmitButton";

type ResearchDocumentFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  document?: {
    id: string;
    title: string;
    description: string;
    category: string;
    fileUrl: string;
  };
};

const categories = ["Product", "Market", "Technical", "User Research", "Competitor", "Other"];

export default function ResearchDocumentForm({ action, submitLabel, document }: ResearchDocumentFormProps) {
  return (
    <form action={action} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {document ? <input type="hidden" name="id" value={document.id} /> : null}
      <div className="grid gap-5">
        <label className="grid gap-2"><span className="text-sm font-medium text-slate-700">Title</span><input name="title" defaultValue={document?.title} required className="rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="grid gap-2"><span className="text-sm font-medium text-slate-700">Description</span><TextareaWithBullet name="description" defaultValue={document?.description ?? ""} rows={4} required /></label>
        <label className="grid gap-2"><span className="text-sm font-medium text-slate-700">Category</span><select name="category" defaultValue={document?.category ?? "Product"} required className="rounded-md border border-slate-300 px-3 py-2 text-sm">{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <label className="grid gap-2"><span className="text-sm font-medium text-slate-700">File URL</span><input name="fileUrl" type="url" defaultValue={document?.fileUrl} required className="rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
      </div>
      <div className="mt-6 flex justify-end">{/* Locks while saving: a second click added the document twice. */}<SubmitButton pendingLabel="Saving..." className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">{submitLabel}</SubmitButton></div>
    </form>
  );
}
