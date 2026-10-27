/**
 * Files people upload: a client's SOP file, and a documentation page's images
 * and attachment. All are kept in the database (see ClientSop,
 * DocumentationImage and DocumentationAttachment in prisma/schema.prisma) and
 * only ever served with a type decided here, never the one the browser
 * claimed, so an upload cannot pass itself off as a page.
 *
 * The size limits sit under next.config.ts's serverActions.bodySizeLimit and
 * middlewareClientMaxBodySize, which have to stay above them.
 */

export const MAX_SOP_BYTES = 10 * 1024 * 1024;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * The file fields: a client's SOP file, held to the document types below, and
 * a documentation page's attachment, which may be anything.
 */
export type UploadKind = "sop" | "attachment";

/** What an SOP may be, by extension. */
const SOP_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
};

/**
 * For the file input's accept attribute: ".pdf,.doc,.docx,..." for an SOP
 * file, and no filter for an attachment.
 */
export const UPLOAD_ACCEPT: Record<UploadKind, string | undefined> = {
  sop: Object.keys(SOP_TYPES)
    .map((extension) => `.${extension}`)
    .join(","),
  attachment: undefined,
};

/** "PDF, DOC, DOCX, ..." for the hint under the file input. */
export const SOP_TYPE_LABEL = Object.keys(SOP_TYPES)
  .map((extension) => extension.toUpperCase())
  .join(", ");

function extensionOf(fileName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

/**
 * The name to keep: no folders, no control characters, and short enough for
 * the VARCHAR(191) column with its extension intact.
 */
function cleanFileName(fileName: string) {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim() || "file";

  if (cleaned.length <= 150) {
    return cleaned;
  }

  const extension = extensionOf(cleaned);
  return extension
    ? `${cleaned.slice(0, 140)}.${extension}`
    : cleaned.slice(0, 150);
}

export type FileUpload = {
  fileName: string;
  mimeType: string;
  size: number;
  data: Uint8Array<ArrayBuffer>;
};

/**
 * What is wrong with a picked file, or null when it will do. Shared by the
 * server and the file input (components/ui/FileInput), which says so the
 * moment the file is picked -- in a production build the server's own message
 * never reaches the page.
 */
export function uploadProblem(kind: UploadKind, fileName: string, size: number) {
  if (kind === "sop") {
    if (!SOP_TYPES[extensionOf(cleanFileName(fileName))]) {
      return `The file must be one of: ${SOP_TYPE_LABEL}.`;
    }

    if (size > MAX_SOP_BYTES) {
      return `The file must be ${formatFileSize(MAX_SOP_BYTES)} or smaller.`;
    }

    return null;
  }

  if (size > MAX_ATTACHMENT_BYTES) {
    return `The attachment must be ${formatFileSize(MAX_ATTACHMENT_BYTES)} or smaller.`;
  }

  return null;
}

/**
 * The file picked in one of the file fields, or null when none was. A file
 * input left empty still posts an empty, nameless file, which counts as none.
 */
export async function readUpload(
  kind: UploadKind,
  value: FormDataEntryValue | null
): Promise<FileUpload | null> {
  if (!value || typeof value === "string" || value.size === 0) {
    return null;
  }

  const problem = uploadProblem(kind, value.name, value.size);

  if (problem) {
    throw new Error(problem);
  }

  const fileName = cleanFileName(value.name);
  const data = new Uint8Array(await value.arrayBuffer());

  return {
    fileName,
    mimeType:
      kind === "sop"
        ? SOP_TYPES[extensionOf(fileName)]
        : attachmentType(fileName, data),
    size: value.size,
    data,
  };
}

/**
 * The type an attachment is served with. An image or a PDF is taken only on
 * its own bytes, since those two open in the browser; a document type goes by
 * its extension; anything else is plain bytes, which only ever downloads.
 */
function attachmentType(fileName: string, data: Uint8Array) {
  const image = detectImageType(data);

  if (image) {
    return image;
  }

  // "%PDF-"
  if ([0x25, 0x50, 0x44, 0x46, 0x2d].every((byte, index) => data[index] === byte)) {
    return "application/pdf";
  }

  const byExtension = SOP_TYPES[extensionOf(fileName)];

  return byExtension && byExtension !== "application/pdf"
    ? byExtension
    : "application/octet-stream";
}

/**
 * The image type, read from the file's first bytes. SVG is left out on
 * purpose: it can carry script.
 */
export function detectImageType(bytes: Uint8Array) {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return "image/png";
  }

  if (startsWith(0xff, 0xd8, 0xff)) {
    return "image/jpeg";
  }

  if (startsWith(0x47, 0x49, 0x46, 0x38)) {
    return "image/gif";
  }

  // "RIFF", four bytes of length, then "WEBP".
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * What opens in the browser rather than downloading. The image types are only
 * ever stored after detectImageType has read them from the bytes.
 */
const INLINE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/** Whether an attachment shows as a picture on its page. */
export function isImageType(mimeType: string) {
  return mimeType.startsWith("image/") && INLINE_TYPES.has(mimeType);
}

/**
 * Headers for sending a stored file back. A PDF or an image opens in the
 * browser; everything else downloads. nosniff holds the browser to the type.
 */
export function fileResponseHeaders(
  mimeType: string,
  size: number,
  fileName?: string
) {
  const headers = new Headers({
    "Content-Type": mimeType,
    "Content-Length": String(size),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  });

  if (fileName) {
    const disposition = INLINE_TYPES.has(mimeType) ? "inline" : "attachment";
    // An ASCII fallback for old clients, and the real name in UTF-8.
    const ascii = fileName.replace(/[^\x20-\x7e]/g, "_");

    headers.set(
      "Content-Disposition",
      `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
  }

  return headers;
}
