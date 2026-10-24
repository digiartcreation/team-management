import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fileResponseHeaders } from "@/lib/uploads";

type ImageRouteContext = {
  params: Promise<{ id: string }>;
};

/** An image in a documentation page, for anyone signed in. */
export async function GET(_request: Request, { params }: ImageRouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const image = await prisma.documentationImage.findUnique({
    where: { id },
    select: { mimeType: true, size: true, data: true },
  });

  if (!image) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const headers = fileResponseHeaders(image.mimeType, image.size);
  // An id always names the same bytes, so the browser may keep its copy.
  headers.set("Cache-Control", "private, max-age=31536000, immutable");

  return new Response(image.data, { headers });
}
