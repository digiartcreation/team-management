import sanitizeHtml from "sanitize-html";
import { documentationText } from "@/lib/documentation";

/**
 * A task's description is HTML from the task form's editor -- the basic
 * toolbar of components/documentation/RichTextEditor -- and nothing else gets
 * through. Tasks written before the editor hold plain text, which is turned
 * into the same HTML wherever it is shown or edited.
 */
const TASK_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    ol: ["start", "reversed"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  transformTags: {
    // Every link opens on its own tab, without a handle back on this one.
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...(attribs.href ? { href: attribs.href } : {}),
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
  },
};

/** The editor always starts with a block; plain text from before it does not. */
function isHtml(value: string) {
  return /^\s*<(p|ul|ol|h[2-4]|blockquote|div)[\s>]/i.test(value);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * An old plain-text description as HTML: a paragraph per line, and the
 * "• " lines the old Add bullet button made as a bulleted list.
 */
function plainTextToHtml(text: string) {
  const html: string[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length > 0) {
      html.push(`<ul>${bullets.map((item) => `<li>${item}</li>`).join("")}</ul>`);
      bullets = [];
    }
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const bullet = line.match(/^[•\-*]\s+(.*)$/);

    if (bullet) {
      bullets.push(escapeHtml(bullet[1]));
      continue;
    }

    flush();

    if (line) {
      html.push(`<p>${escapeHtml(line)}</p>`);
    }
  }

  flush();
  return html.join("");
}

/** A stored description as safe HTML to show or edit, or null when empty. */
export function taskDescriptionHtml(stored: string | null | undefined) {
  if (!stored || !stored.trim()) {
    return null;
  }

  const html = sanitizeHtml(
    isHtml(stored) ? stored : plainTextToHtml(stored),
    TASK_SANITIZE_OPTIONS
  ).trim();

  return documentationText(html) ? html : null;
}

/** What the task form posted, ready to store: clean HTML, or null when empty. */
export function sanitizeTaskDescription(posted: string) {
  return taskDescriptionHtml(posted);
}

/** A description as one line of plain text, for previews such as search. */
export function taskDescriptionText(stored: string | null | undefined) {
  const html = taskDescriptionHtml(stored);
  return html ? documentationText(html) : "";
}
