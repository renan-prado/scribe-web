"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Markdown } from "tiptap-markdown";

type Props = {
  value: string;
  onChange: (value: string) => void;
  minHeight?: number;
  placeholder?: string;
};

/**
 * Notion-style WYSIWYG editor driven purely by markdown shortcuts:
 *   #, ##, ###           → h1, h2, h3
 *   -                    → bulleted list
 *   1.                   → ordered list
 *   > space              → blockquote
 *   ```                  → code block
 *   **word**, *word*     → bold, italic
 *   `word`               → inline code
 *
 * These are the input rules that ship with @tiptap/starter-kit — we
 * do NOT add slash menus or block-picker UI. The persisted value is a
 * plain markdown string, produced by the `tiptap-markdown` extension.
 *
 * StarterKit heading is capped at level 3 to keep the visual hierarchy
 * simple. Tables, task lists, images and other richer nodes are
 * deliberately omitted — chunking is paragraph-based, so bells and
 * whistles here would not survive the ingest anyway.
 */
export function MarkdownEditor({
  value,
  onChange,
  minHeight = 420,
  placeholder = "Comece a escrever… (# para título, - para lista, > para citação)",
}: Props) {
  const editor = useEditor({
    // Avoid SSR hydration mismatches (Tiptap mounts ProseMirror in the client)
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: "scriba-md-code" } },
      }),
      Markdown.configure({
        html: false,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => {
      const md = (
        e.storage as unknown as { markdown: { getMarkdown(): string } }
      ).markdown.getMarkdown();
      onChange(md);
    },
    editorProps: {
      attributes: {
        class: "scriba-md-content focus:outline-none",
      },
    },
  });

  // Keep the editor content in sync when the parent resets `value`
  // externally (e.g. after a save/reset). Do NOT overwrite while the
  // user is actively typing — that would clobber their input.
  useEffect(() => {
    if (!editor) return;
    const current = (
      editor.storage as unknown as { markdown: { getMarkdown(): string } }
    ).markdown.getMarkdown();
    if (value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div
      className="scriba-md-editor overflow-hidden rounded-lg border bg-white transition-colors focus-within:ring-2 focus-within:ring-[color:var(--scriba-blue)]/25"
      style={{ borderColor: "var(--scriba-hairline)", minHeight }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
