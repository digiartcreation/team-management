import BackLink from "@/components/ui/BackLink";

/** The top of an add or edit page: the way back, the title, and a line on it. */
export default function FormPageHeader({
  backHref,
  backLabel,
  title,
  description,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  description: string;
}) {
  return (
    <header className="grid gap-3">
      <BackLink href={backHref}>{backLabel}</BackLink>
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </header>
  );
}
