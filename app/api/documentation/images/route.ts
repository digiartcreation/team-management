import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  MAX_IMAGE_BYTES,
  detectImageType,
  formatFileSize,
} from "@/lib/uploads";

/** The shape CKEditor's SimpleUploadAdapter reads a failed upload from. */
function uploadError(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

/**
 * Takes one image from the documentation editor and answers with the URL the
 * editor puts in the page. Any signed-in user may upload, as any of them may
 * write documentation.
 */
export async function POST(request: Request) {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & { id?: string })
    | undefined;

  if (!sessionUser?.id) {
    return uploadError("Sign in again to upload images.", 401);
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("upload");

  if (!file || typeof file === "string" || file.size === 0) {
    return uploadError("No image was received.", 400);
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return uploadError(
      `Images must be ${formatFileSize(MAX_IMAGE_BYTES)} or smaller.`,
      413
    );
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectImageType(data);

  if (!mimeType) {
    return uploadError("Only PNG, JPEG, GIF and WebP images can be uploaded.", 415);
  }

  const image = await prisma.documentationImage.create({
    data: {
      mimeType,
      size: data.byteLength,
      data,
      uploadedById: sessionUser.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ url: `/api/documentation/images/${image.id}` });
}
