import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fileResponseHeaders } from "@/lib/uploads";

type SopRouteContext = {
  params: Promise<{ id: string }>;
};

/** A client's SOP, for the admins who manage clients. */
export async function GET(_request: Request, { params }: SopRouteContext) {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & { id?: string; role?: string })
    | undefined;

  if (!sessionUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (sessionUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const sop = await prisma.clientSop.findUnique({
    where: { clientId: id },
    select: { fileName: true, mimeType: true, size: true, data: true },
  });

  if (!sop) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(sop.data, {
    headers: fileResponseHeaders(sop.mimeType, sop.size, sop.fileName),
  });
}
