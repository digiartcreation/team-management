"use client";

import { useMemo } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Alignment,
  AutoLink,
  Autoformat,
  BlockQuote,
  Bold,
  ClassicEditor,
  Code,
  CodeBlock,
  Essentials,
  Heading,
  HorizontalLine,
  Image,
  ImageCaption,
  ImageResize,
  ImageStyle,
  ImageTextAlternative,
  ImageToolbar,
  ImageUpload,
  Indent,
  Italic,
  Link,
  List,
  Paragraph,
  PasteFromOffice,
  RemoveFormat,
  SimpleUploadAdapter,
  Strikethrough,
  Table,
  TableToolbar,
  Underline,
  type EditorConfig,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";

type RichTextEditorProps = {
  /** The page's saved HTML; empty for a new page. */
  initialData: string;
  onChange: (html: string) => void;
  /**
   * Whether images can be put in. Off for a client's SOP: its images would be
   * stored with the documentation's, which everyone can open, and a file for
   * the SOP has its own field on the client form.
   */
  images?: boolean;
  placeholder?: string;
};

/**
 * Everything the toolbar offers has to survive the server's sanitiser
 * (lib/documentation.ts) -- a button added here needs its tags and classes
 * allowed there too, or its formatting is dropped on save.
 */
const EDITOR_CONFIG: EditorConfig = {
  // The open-source licence. A commercial key from ckeditor.com goes here
  // instead if the app is ever distributed under other terms.
  licenseKey: "GPL",
  plugins: [
    Alignment,
    AutoLink,
    Autoformat,
    BlockQuote,
    Bold,
    Code,
    CodeBlock,
    Essentials,
    Heading,
    HorizontalLine,
    Image,
    ImageCaption,
    ImageResize,
    ImageStyle,
    ImageTextAlternative,
    ImageToolbar,
    ImageUpload,
    Indent,
    Italic,
    Link,
    List,
    Paragraph,
    PasteFromOffice,
    RemoveFormat,
    SimpleUploadAdapter,
    Strikethrough,
    Table,
    TableToolbar,
    Underline,
  ],
  toolbar: {
    items: [
      "heading",
      "|",
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "code",
      "removeFormat",
      "|",
      "link",
      "uploadImage",
      "insertTable",
      "blockQuote",
      "codeBlock",
      "horizontalLine",
      "|",
      "bulletedList",
      "numberedList",
      "outdent",
      "indent",
      "alignment",
      "|",
      "undo",
      "redo",
    ],
    shouldNotGroupWhenFull: false,
  },
  // The page title is the h1, so the editor's headings start at h2.
  heading: {
    options: [
      { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
      { model: "heading2", view: "h2", title: "Heading 1", class: "ck-heading_heading2" },
      { model: "heading3", view: "h3", title: "Heading 2", class: "ck-heading_heading3" },
      { model: "heading4", view: "h4", title: "Heading 3", class: "ck-heading_heading4" },
    ],
  },
  image: {
    toolbar: [
      "imageStyle:inline",
      "imageStyle:block",
      "imageStyle:side",
      "|",
      "toggleImageCaption",
      "imageTextAlternative",
    ],
  },
  table: {
    contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
  },
  link: {
    addTargetToExternalLinks: true,
    defaultProtocol: "https://",
  },
  // Images go to app/api/documentation/images, which stores them and answers
  // with the URL the page keeps. Same origin, so the session cookie goes along.
  simpleUpload: {
    uploadUrl: "/api/documentation/images",
  },
  placeholder: "Write the page here. Paste or drop images straight in.",
};

const IMAGE_PLUGINS = new Set<unknown>([
  Image,
  ImageCaption,
  ImageResize,
  ImageStyle,
  ImageTextAlternative,
  ImageToolbar,
  ImageUpload,
  SimpleUploadAdapter,
]);

/** The same editor with every way of adding an image taken out. */
const TEXT_ONLY_CONFIG: EditorConfig = {
  ...EDITOR_CONFIG,
  plugins: EDITOR_CONFIG.plugins?.filter(
    (plugin) => typeof plugin === "string" || !IMAGE_PLUGINS.has(plugin)
  ),
  toolbar: {
    items: (EDITOR_CONFIG.toolbar as { items: string[] }).items.filter(
      (item) => item !== "uploadImage"
    ),
    shouldNotGroupWhenFull: false,
  },
  image: undefined,
  simpleUpload: undefined,
  placeholder: "Write here.",
};

export default function RichTextEditor({
  initialData,
  onChange,
  images = true,
  placeholder,
}: RichTextEditorProps) {
  // Built once: the editor reads its config when it starts and not after.
  const config = useMemo(
    () => ({
      ...(images ? EDITOR_CONFIG : TEXT_ONLY_CONFIG),
      initialData,
      ...(placeholder ? { placeholder } : {}),
    }),
    [initialData, images, placeholder]
  );

  return (
    <div className="doc-editor">
      <CKEditor
        editor={ClassicEditor}
        config={config}
        onChange={(_event, editor) => onChange(editor.getData())}
      />
    </div>
  );
}
