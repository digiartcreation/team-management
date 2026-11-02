import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadTaskDetails } from "@/lib/taskDetails";

type TaskRouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * One task's full details, for the dialog that opens from a task on the
 * dashboards and the Tasks page. A task the viewer may not see answers 404,
 * the same as one that does not exist.
 */
export async function GET(_request: Request, { params }: TaskRouteContext) {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;

  if (!sessionUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const task = await loadTaskDetails({ id: sessionUser.id, role: sessionUser.role }, id);

  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ task }, { headers: { "Cache-Control": "no-store" } });
}
