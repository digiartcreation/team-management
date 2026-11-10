import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sanitizeDocumentationHtml } from "@/lib/documentation";

/**
 * Server-only helpers that spare a document view work it repeats on every
 * open. (lib/documentation.ts is also used in the browser, so these live here.)
 */

/** Cleared by the documentation actions whenever a page is added, renamed or removed. */
export const DOCS_INDEX_TAG = "docs-index";

/**
 * The side index on a document page: titles A to Z, the first `limit`. The
 * same for every document, so it is cached rather than read on each view.
 */
export const getDocumentationIndex = unstable_cache(
  (limit: number) =>
    prisma.documentation.findMany({
      orderBy: { title: "asc" },
      take: limit,
      select: { id: true, title: true },
    }),
  ["docs-index"],
  { tags: [DOCS_INDEX_TAG], revalidate: 300 }
);

const cleaned = new Map<string, string>();
const CLEANED_LIMIT = 50;

/**
 * sanitizeDocumentationHtml, remembered per page version: the same id and
 * updatedAt always mean the same content, so a saved edit -- a new
 * updatedAt -- is never served stale. Keeps the 50 most recently read.
 */
export function sanitizeDocumentationHtmlCached(id: string, updatedAt: Date, html: string) {
  const key = `${id}:${updatedAt.getTime()}`;
  const hit = cleaned.get(key);

  if (hit !== undefined) {
    // Most recently used goes to the end.
    cleaned.delete(key);
    cleaned.set(key, hit);
    return hit;
  }

  const result = sanitizeDocumentationHtml(html);
  cleaned.set(key, result);

  if (cleaned.size > CLEANED_LIMIT) {
    cleaned.delete(cleaned.keys().next().value as string);
  }

  return result;
}
