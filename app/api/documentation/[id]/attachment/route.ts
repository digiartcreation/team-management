import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fileResponseHeaders } from "@/lib/uploads";

type AttachmentRouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * A documentation page's attachment, for anyone signed in, as the page itself
 * is. The id is the page's.
 */
export async function GET(_request: Request, { params }: AttachmentRouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const attachment = await prisma.documentationAttachment.findUnique({
    where: { documentationId: id },
    select: { fileName: true, mimeType: true, size: true, data: true },
  });

  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(attachment.data, {
    headers: fileResponseHeaders(
      attachment.mimeType,
      attachment.size,
      attachment.fileName
    ),
  });
}
