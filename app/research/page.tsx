import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PaginationControls from "@/components/layout/PaginationControls";
import { getPage, getPagination, PAGE_SIZE } from "@/lib/pagination";
import ActionMenu from "@/components/ui/ActionMenu";

type ResearchPageProps = { searchParams: Promise<{ q?: string; category?: string; page?: string }> };

export default async function ResearchPage({ searchParams }: ResearchPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const sessionUser = session.user as typeof session.user & { id?: string; role?: string };
  const showEmployeeColumn = sessionUser.role !== "member";
  const { q, category } = await searchParams;
  const page = getPage((await searchParams).page);
  const currentUser = sessionUser.role === "manager" ? await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { teamId: true } }) : null;
  const where: Prisma.ResearchDocumentWhereInput = sessionUser.role === "admin" ? {} : sessionUser.role === "manager" ? { user: { teamId: currentUser?.teamId ?? "__no_team__" } } : { userId: sessionUser.id };
  if (q?.trim()) where.title = { contains: q.trim() };
  if (category?.trim()) where.category = category.trim();
  const [documents, totalDocuments, categories] = await Promise.all([
    prisma.researchDocument.findMany({ where, ...getPagination(page), orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true } } } }),
    prisma.researchDocument.count({ where }),
    prisma.researchDocument.findMany({ select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
  ]);
  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium uppercase text-slate-500">Research Docs</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">Research Documents</h1></div>{sessionUser.role !== "admin" ? <Link href="/research/new" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">Add Document</Link> : null}</header>
        <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_220px_auto_auto]"><input name="q" defaultValue={q ?? ""} placeholder="Search by title" className="rounded-md border border-slate-300 px-3 py-2 text-sm" /><select name="category" defaultValue={category ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">All categories</option>{categories.map((item: { category: string }) => <option key={item.category} value={item.category}>{item.category}</option>)}</select><button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">Filter</button><Link href="/research" className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Reset</Link></form>
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">{documents.length === 0 ? <div className="p-8 text-center"><p className="text-sm font-medium text-slate-700">No research documents found.</p><p className="mt-1 text-sm text-slate-500">Documents will appear here after they are added.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Title</th>{showEmployeeColumn ? <th className="px-4 py-3">Employee</th> : null}<th className="px-4 py-3">Category</th><th className="px-4 py-3">File</th><th className="px-4 py-3"><span className="sr-only">Row menu</span></th></tr></thead><tbody className="divide-y divide-slate-200">{documents.map((document) => <tr key={document.id} className="hover:bg-slate-50"><td className="px-4 py-4"><div className="font-medium text-slate-950">{document.title}</div><div className="mt-1 whitespace-pre-line break-words text-slate-500">{document.description}</div></td>{showEmployeeColumn ? <td className="px-4 py-4 text-slate-600">{document.user.name}</td> : null}<td className="px-4 py-4 text-slate-600">{document.category}</td><td className="px-4 py-4"><a href={document.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-700 hover:text-slate-950">Open</a></td><td className="px-4 py-4">{document.user.id === sessionUser.id ? <ActionMenu><Link href={`/research/${document.id}/edit`} className="rounded px-3 py-2 text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]">Edit</Link></ActionMenu> : <span className="text-sm text-slate-400">View only</span>}</td></tr>)}</tbody></table></div>}</section>
        <PaginationControls page={page} total={totalDocuments} pageSize={PAGE_SIZE} basePath="/research" searchParams={await searchParams} />
      </div>
    </DashboardLayout>
  );
}
