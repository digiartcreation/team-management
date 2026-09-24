import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PaginationControls from "@/components/layout/PaginationControls";
import { getPage, getPagination, PAGE_SIZE } from "@/lib/pagination";
import ModuleReviewMarker from "@/components/layout/ModuleReviewMarker";
import ActionMenu from "@/components/ui/ActionMenu";
import DeleteMenuAction from "@/components/ui/DeleteMenuAction";
import { deleteToolUsage } from "@/app/tools/actions";

type ToolsPageProps = { searchParams: Promise<{ q?: string; category?: string; page?: string }> };
const dateFormatter = new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" });

export default async function ToolsPage({ searchParams }: ToolsPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const sessionUser = session.user as typeof session.user & { id?: string; role?: string };
  const showEmployeeColumn = sessionUser.role !== "member";
  const { q, category } = await searchParams;
  const page = getPage((await searchParams).page);
  const currentUser = sessionUser.role === "manager" ? await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { teamId: true } }) : null;
  const where: Prisma.ToolUsageWhereInput = sessionUser.role === "admin" ? {} : sessionUser.role === "manager" ? { user: { teamId: currentUser?.teamId ?? "__no_team__" } } : { userId: sessionUser.id };
  if (q?.trim()) where.toolName = { contains: q.trim() };
  if (category?.trim()) where.category = category.trim();
  const [entries, totalEntries] = await Promise.all([
    prisma.toolUsage.findMany({ where, ...getPagination(page), orderBy: { date: "desc" }, include: { user: { select: { id: true, name: true } } } }),
    prisma.toolUsage.count({ where }),
  ]);
  const categories = await prisma.toolUsage.findMany({ select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } });

  return (
    <DashboardLayout>
      <ModuleReviewMarker module="tools" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-medium uppercase tracking-normal text-slate-500">AI Tools</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">AI & Tools Usage</h1></div>
          {sessionUser.role !== "admin" ? <Link href="/tools/new" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">Add Tool Usage</Link> : null}
        </header>
        <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_220px_auto_auto]">
          <input name="q" defaultValue={q ?? ""} placeholder="Search by tool name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select name="category" defaultValue={category ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">All categories</option>{categories.map((item: { category: string }) => <option key={item.category} value={item.category}>{item.category}</option>)}</select>
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">Filter</button>
          <Link href="/tools" className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Reset</Link>
        </form>
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {entries.length === 0 ? <div className="p-8 text-center"><p className="text-sm font-medium text-slate-700">No tool usage entries found.</p><p className="mt-1 text-sm text-slate-500">Entries will appear here after they are added.</p></div> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[840px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Tool</th>{showEmployeeColumn ? <th className="px-4 py-3">Employee</th> : null}<th className="px-4 py-3">Category</th><th className="px-4 py-3">Purpose</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Created On</th><th className="px-4 py-3"><span className="sr-only">Row menu</span></th></tr></thead><tbody className="divide-y divide-slate-200">{entries.map((entry) => <tr key={entry.id} className="hover:bg-slate-50"><td className="px-4 py-4 font-medium text-slate-950">{entry.toolName}</td>{showEmployeeColumn ? <td className="px-4 py-4 text-slate-600">{entry.user.name}</td> : null}<td className="px-4 py-4 text-slate-600">{entry.category}</td><td className="px-4 py-4 text-slate-600"><div className="whitespace-pre-line break-words">{entry.purpose}</div>{entry.outcome ? <div className="mt-2 whitespace-pre-line break-words text-xs text-slate-500">{entry.outcome}</div> : null}</td><td className="px-4 py-4 text-slate-600">{entry.timeSpent}</td><td className="px-4 py-4 text-slate-600"><div>{dateFormatter.format(entry.createdAt)}</div>{entry.updatedAt.getTime() !== entry.createdAt.getTime() ? <div className="mt-1 text-xs text-slate-500">Edited on {dateFormatter.format(entry.updatedAt)}</div> : null}</td><td className="px-4 py-4">{entry.user.id === sessionUser.id ? <ActionMenu><Link href={`/tools/${entry.id}/edit`} className="rounded px-3 py-2 text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]">Edit</Link><DeleteMenuAction id={entry.id} action={deleteToolUsage} message="Are you sure you want to delete this tool usage entry?" /></ActionMenu> : <span className="text-sm text-slate-400">View only</span>}</td></tr>)}</tbody></table></div>
          )}
        </section>
        <PaginationControls page={page} total={totalEntries} pageSize={PAGE_SIZE} basePath="/tools" searchParams={await searchParams} />
      </div>
    </DashboardLayout>
  );
}
