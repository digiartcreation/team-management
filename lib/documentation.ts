import sanitizeHtml from "sanitize-html";

/**
 * Who may change a documentation page: whoever wrote it, and admins. Everyone
 * signed in can read every page and start new ones.
 */
export function canManageDocumentation(
  user: { id?: string; role?: string },
  page: { createdById: string | null }
) {
  return (
    user.role === "admin" ||
    (Boolean(user.id) && page.createdById === user.id)
  );
}

const lengthPattern = /^\d+(\.\d+)?(px|%)$/;

/**
 * What the documentation editor (components/documentation/RichTextEditor)
 * produces, and nothing else. The HTML is rendered straight into the page for
 * everyone who reads it, so anything posted around the editor -- a script, an
 * event handler, a javascript: link, a data: image -- is stripped here, on the
 * server, before it is stored.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2",
    "h3",
    "h4",
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "sub",
    "sup",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "hr",
    "figure",
    "figcaption",
    "img",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "colgroup",
    "col",
    "span",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height", "style"],
    figure: ["style"],
    ol: ["start", "reversed"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan", "scope"],
    col: ["style"],
    pre: ["data-language", "spellcheck"],
    p: ["style"],
    h2: ["style"],
    h3: ["style"],
    h4: ["style"],
    li: ["style"],
  },
  allowedClasses: {
    figure: [
      "image",
      "image_resized",
      "image-style-side",
      "image-style-align-left",
      "image-style-align-right",
      "image-style-align-center",
      "image-style-block-align-left",
      "image-style-block-align-right",
      "table",
    ],
    img: [
      "image_resized",
      "image-style-align-left",
      "image-style-align-right",
      "image-style-align-center",
    ],
    code: [/^language-[\w-]+$/],
  },
  allowedStyles: {
    "*": { "text-align": [/^(left|right|center|justify)$/] },
    figure: { width: [lengthPattern] },
    img: {
      width: [lengthPattern],
      "aspect-ratio": [/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/],
    },
    col: { width: [lengthPattern] },
  },
  // Relative links, such as an uploaded image's /api/documentation/images/...,
  // have no scheme and pass; data: and javascript: do not.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  transformTags: {
    // A link opening a new tab never hands that tab a handle on this one.
    a: (tagName, attribs) => {
      const next: Record<string, string> = {};

      if (attribs.href) {
        next.href = attribs.href;
      }

      if (attribs.target === "_blank") {
        next.target = "_blank";
        next.rel = "noopener noreferrer";
      }

      return { tagName, attribs: next };
    },
  },
};

export function sanitizeDocumentationHtml(html: string) {
  return sanitizeHtml(html, SANITIZE_OPTIONS).trim();
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * The page as plain text, for the list's preview and the empty check. The
 * sanitiser escapes the text it keeps, so the entities are turned back into
 * characters for React, which escapes them again itself.
 */
export function documentationText(html: string) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity])
    .replace(/\s+/g, " ")
    .trim();
}

/** Whether the sanitised page holds anything: some text, or an image. */
export function hasDocumentationContent(html: string) {
  return documentationText(html).length > 0 || /<img\s/i.test(html);
}
