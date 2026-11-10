import { redirect } from "next/navigation";
import { getShellSession, preloadShell } from "@/lib/shell";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ChangePasswordForm from "@/components/profile/ChangePasswordForm";
import Avatar from "@/components/ui/Avatar";
import { formatRole } from "@/lib/roles";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm text-slate-800">{children}</dd>
    </div>
  );
}

/** Everyone's own page: who they are here, and changing their password. */
export default async function ProfilePage() {
  const session = await getShellSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    redirect("/login");
  }

  preloadShell(session);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      role: true,
      sector: true,
      designation: true,
      createdAt: true,
      team: { select: { name: true } },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const notSet = <span className="text-slate-400">Not set</span>;

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
            Profile
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
            My Profile
          </h1>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} size="lg" />
            <div className="min-w-0">
              <h2 className="break-words text-lg font-semibold text-slate-950">
                {user.name}
              </h2>
              <p className="break-all text-sm text-slate-500">{user.email}</p>
              <span className="mt-2 inline-block rounded-full bg-[#F3E8FF] px-2.5 py-0.5 text-xs font-medium text-[#770FC2]">
                {formatRole(user.role)}
              </span>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-4">
            <Detail label="Team">{user.team?.name ?? notSet}</Detail>
            <Detail label="Domain">{user.sector ?? notSet}</Detail>
            <Detail label="Designation">{user.designation ?? notSet}</Detail>
            <Detail label="Member since">{dateFormatter.format(user.createdAt)}</Detail>
          </dl>
          <p className="mt-5 text-xs text-slate-500">
            Your name, email and role are set by a super admin. Ask them if
            something here is wrong.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-slate-950">Change password</h2>
          <p className="mb-5 mt-1 text-sm text-slate-500">
            Enter your current password, then the new one twice.
          </p>
          <ChangePasswordForm />
        </section>
      </div>
    </DashboardLayout>
  );
}
