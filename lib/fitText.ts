/**
 * `text` cut to `max` characters, ending in "…" when it was longer. For the
 * one-line summaries kept in VARCHAR(191) columns -- an activity log line, a
 * notification -- which quote a title that itself has no length limit. The
 * full text stays on the record the line points at.
 */
export function fitText(text: string, max = 191) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
