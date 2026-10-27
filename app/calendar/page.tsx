import { redirect } from "next/navigation";
import { auth } from "@/auth";
import DashboardCalendar from "@/components/dashboard/DashboardCalendar";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { loadCalendarProps } from "@/lib/calendarEvents";

/** The calendar on a page of its own, for every role. */
export default async function CalendarPage() {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & { id?: string; role?: string })
    | undefined;

  if (!sessionUser?.id) {
    redirect("/login");
  }

  const calendar = await loadCalendarProps({
    id: sessionUser.id,
    role: sessionUser.role,
  });

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <DashboardCalendar {...calendar} />
      </div>
    </DashboardLayout>
  );
}
