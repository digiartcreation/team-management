/**
 * Files people upload: a client's SOP document and the images in documentation
 * pages. Both are kept in the database (see ClientSop and DocumentationImage in
 * prisma/schema.prisma) and only ever served with a type decided here, never
 * the one the browser claimed, so an upload cannot pass itself off as a page.
 *
 * The size limits sit under next.config.ts's serverActions.bodySizeLimit and
 * middlewareClientMaxBodySize, which have to stay above them.
 */

export const MAX_SOP_BYTES = 10 * 1024 * 1024;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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

/** For the file input's accept attribute: ".pdf,.doc,.docx,...". */
export const SOP_ACCEPT = Object.keys(SOP_TYPES)
  .map((extension) => `.${extension}`)
  .join(",");

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
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim();

  if (cleaned.length <= 150) {
    return cleaned;
  }

  const extension = extensionOf(cleaned);
  return `${cleaned.slice(0, 140)}.${extension}`;
}

export type SopUpload = {
  fileName: string;
  mimeType: string;
  size: number;
  data: Uint8Array<ArrayBuffer>;
};

/**
 * The SOP picked on the client form, or null when none was. A file input left
 * empty still posts an empty, nameless file, which counts as none.
 */
/**
 * What is wrong with a file picked as an SOP, or null when it will do. Shared
 * by the server and the file input (components/clients/SopFileInput), which
 * says so the moment the file is picked -- in a production build the server's
 * own message never reaches the page.
 */
export function sopFileProblem(fileName: string, size: number) {
  if (!SOP_TYPES[extensionOf(cleanFileName(fileName))]) {
    return `The SOP must be one of: ${SOP_TYPE_LABEL}.`;
  }

  if (size > MAX_SOP_BYTES) {
    return `The SOP must be ${formatFileSize(MAX_SOP_BYTES)} or smaller.`;
  }

  return null;
}

export async function readSopUpload(
  value: FormDataEntryValue | null
): Promise<SopUpload | null> {
  if (!value || typeof value === "string" || value.size === 0) {
    return null;
  }

  const problem = sopFileProblem(value.name, value.size);

  if (problem) {
    throw new Error(problem);
  }

  const fileName = cleanFileName(value.name);
  const mimeType = SOP_TYPES[extensionOf(fileName)];

  return {
    fileName,
    mimeType,
    size: value.size,
    data: new Uint8Array(await value.arrayBuffer()),
  };
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
 * Headers for sending a stored file back. A PDF opens in the browser's own
 * viewer; everything else downloads. nosniff holds the browser to the type.
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
    const disposition = mimeType === "application/pdf" ? "inline" : "attachment";
    // An ASCII fallback for old clients, and the real name in UTF-8.
    const ascii = fileName.replace(/[^\x20-\x7e]/g, "_");

    headers.set(
      "Content-Disposition",
      `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
  }

  return headers;
}
