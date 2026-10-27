import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { isCalendarMonth } from "@/lib/calendar";
import { loadCalendarMonth } from "@/lib/calendarEvents";

/**
 * One month of the calendar, for when it is paged to another month:
 * GET /api/calendar?month=2026-11. The month it opens on comes with the page.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & { id?: string; role?: string })
    | undefined;

  if (!sessionUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get("month") ?? "";

  if (!isCalendarMonth(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const entries = await loadCalendarMonth(
    { id: sessionUser.id, role: sessionUser.role },
    month
  );

  return NextResponse.json({ entries });
}
