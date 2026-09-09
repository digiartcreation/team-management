import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function describe(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      code: (error as { code?: string }).code ?? null,
      message: error.message.split("\n").slice(0, 6).join(" | "),
    };
  }

  return { name: "unknown", code: null, message: String(error) };
}

export async function GET() {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & { role?: string })
    | undefined;

  if (sessionUser?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const report: Record<string, unknown> = {
    clientDelegate: typeof (prisma as unknown as { client?: unknown }).client,
    models: Object.keys(prisma).filter((key) => !key.startsWith("_") && !key.startsWith("$")),
  };

  try {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      "SELECT DATABASE() AS db, VERSION() AS version"
    );
    report.database = rows[0] ?? null;
  } catch (error) {
    report.database = describe(error);
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'Client'"
    );
    report.clientTableExists = rows[0] ?? null;
  } catch (error) {
    report.clientTableExists = describe(error);
  }

  try {
    report.clientCount = await prisma.client.count();
  } catch (error) {
    report.clientCount = describe(error);
  }

  try {
    const clients = await prisma.client.findMany({
      skip: 0,
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    report.findMany = { ok: true, rows: clients.length };
  } catch (error) {
    report.findMany = describe(error);
  }

  const safe = JSON.parse(
    JSON.stringify(report, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  return NextResponse.json(safe);
}
