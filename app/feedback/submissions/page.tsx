import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OWNED_BY_ACTIVE_USER } from "@/lib/activeUsers";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { MobileCard, MobileCardList, MobileField } from "@/components/ui/MobileCard";
import { updateFeedbackStatus } from "@/app/feedback/actions";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export default async function FeedbackSubmissionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
  };
  const isAdmin = sessionUser.role === "admin";
  const submissions = await prisma.feedbackSubmission.findMany({
    // An inactive employee's feedback is hidden until they are made active again.
    where: isAdmin ? OWNED_BY_ACTIVE_USER : { userId: sessionUser.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });

  // Status and a note back to whoever sent it, in the table and on a phone card.
  const reviewForm = (submission: (typeof submissions)[number]) => (
    <form action={updateFeedbackStatus} className="grid gap-2">
      <input type="hidden" name="id" value={submission.id} />
      <select
        name="status"
        defaultValue={submission.status}
        aria-label="Status"
        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
      >
        <option>Open</option>
        <option>Under Review</option>
        <option>Resolved</option>
        <option>Closed</option>
      </select>
      <input
        name="adminResponse"
        defaultValue={submission.adminResponse ?? ""}
        placeholder="Response note"
        aria-label="Response note"
        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
      />
      <button className="rounded-md bg-slate-950 px-2 py-1 text-xs font-medium text-white">
        Update
      </button>
    </form>
  );

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-slate-500">
              Feedback Center
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              {isAdmin ? "Team Submissions" : "My Submissions"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/feedback/suggestion" className="rounded-md border border-[#770FC2] px-4 py-2 text-sm font-medium text-[#770FC2]">
              Submit Suggestion
            </Link>
            <Link href="/feedback/issue" className="rounded-md bg-[#770FC2] px-4 py-2 text-sm font-medium text-white">
              Report an Issue
            </Link>
          </div>
        </header>
        {/* Phones get cards, the list below; the table is for wider screens. */}
        <section
          className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${
            submissions.length > 0 ? "hidden md:block" : ""
          }`}
        >
          {submissions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No feedback submissions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Type</th>
                    {isAdmin ? <th className="px-4 py-3">Submitted By</th> : null}
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created On</th>
                    {isAdmin ? <th className="px-4 py-3">Admin Review</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {submissions.map((submission) => (
                    <tr key={submission.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-950">
                          {submission.title}
                        </div>
                        <div className="mt-1 whitespace-pre-line break-words text-slate-500">
                          {submission.description}
                        </div>
                        {submission.adminResponse ? (
                          <div className="mt-2 rounded-md bg-[#F3E8FF] p-2 text-xs text-[#6B1BBD]">
                            {submission.adminResponse}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{submission.type}</td>
                      {isAdmin ? <td className="px-4 py-4 text-slate-600">{submission.user.name}</td> : null}
                      <td className="px-4 py-4 text-slate-600">{submission.priority}</td>
                      <td className="px-4 py-4 text-slate-600">{submission.status}</td>
                      <td className="px-4 py-4 text-slate-600">{dateFormatter.format(submission.createdAt)}</td>
                      {isAdmin ? (
                        <td className="px-4 py-4">
                          {reviewForm(submission)}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {submissions.length > 0 ? (
          <MobileCardList>
            {submissions.map((submission) => (
              <MobileCard
                key={submission.id}
                title={submission.title}
                subtitle={`${submission.type} · ${dateFormatter.format(submission.createdAt)}${
                  isAdmin ? ` · ${submission.user.name}` : ""
                }`}
                status={
                  <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {submission.status}
                  </span>
                }
              >
                <MobileField label="Description">
                  <span className="whitespace-pre-line">{submission.description}</span>
                </MobileField>
                {submission.adminResponse ? (
                  <MobileField label="Admin Response">
                    <span className="block rounded-md bg-[#F3E8FF] p-2 text-xs text-[#6B1BBD]">
                      {submission.adminResponse}
                    </span>
                  </MobileField>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <MobileField label="Type">{submission.type}</MobileField>
                  <MobileField label="Priority">{submission.priority}</MobileField>
                </div>
                {isAdmin ? (
                  <MobileField label="Admin Review">{reviewForm(submission)}</MobileField>
                ) : null}
              </MobileCard>
            ))}
          </MobileCardList>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
