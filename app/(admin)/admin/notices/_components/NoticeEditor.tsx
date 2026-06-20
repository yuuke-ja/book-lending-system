"use client";

import Document from "@tiptap/extension-document";
import Link from "@tiptap/extension-link";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useCallback } from "react";

type NoticeEditorProps = {
  onChange: (content: JSONContent) => void;
  initialContent: JSONContent | null;
};

export default function NoticeEditor({
  onChange,
  initialContent,
}: NoticeEditorProps) {
  const editor = useEditor({
    editable: true,
    immediatelyRender: false,
    extensions: [
      Document,
      Paragraph,
      Text,
      Link.configure({
        openOnClick: false,
        autolink: false,
        defaultProtocol: "https",
        protocols: ["http", "https"],
        isAllowedUri: (url, context) => {
          try {
            const parsedUrl = url.includes(":")
              ? new URL(url)
              : new URL(`${context.defaultProtocol}://${url}`);

            if (!context.defaultValidate(parsedUrl.href)) {
              return false;
            }

            const protocol = parsedUrl.protocol.replace(":", "");
            const allowedProtocols = context.protocols.map((item) =>
              typeof item === "string" ? item : item.scheme
            );

            return allowedProtocols.includes(protocol);
          } catch {
            return false;
          }
        },
      }),
    ],
    content: initialContent ?? {
        type: "doc",
        content: [{ type: "paragraph" }],
      },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getJSON());
    },
  });

  const setLink = useCallback(() => {
    if (!editor) {
      return;
    }

    if (editor.state.selection.empty) {
      window.alert("リンクにする文字を選択してください");
      return;
    }

    const { from, to } = editor.state.selection;
    const previousUrl = editor.getAttributes("link").href ?? "";
    const url = window.prompt("リンク先のURLを入力してください", previousUrl);

    if (url === null) {
      return;
    }

    if (url.trim() === "") {
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .unsetLink()
        .setTextSelection(to)
        .run();
      return;
    }

    try {
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .setLink({ href: url.trim() })
        .setTextSelection(to)
        .run();
      editor.view.dispatch(editor.state.tr.setStoredMarks([]));
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "リンクを設定できませんでした"
      );
    }
  }, [editor]);

  const editorState = useEditorState({
    editor,
    selector: (context) => ({
      isLink: context.editor?.isActive("link") ?? false,
    }),
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={setLink}
          className={
            editorState?.isLink
              ? "rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
              : "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700"
          }
        >
          リンク設定
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editorState?.isLink}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          リンク解除
        </button>
      </div>

      <EditorContent
        editor={editor}
        className="rounded-md border border-zinc-300 bg-white text-sm text-zinc-900 focus-within:border-zinc-500 [&_.ProseMirror]:min-h-32 [&_.ProseMirror]:cursor-text [&_.ProseMirror]:p-3 [&_.ProseMirror]:outline-none [&_.ProseMirror_a]:font-medium [&_.ProseMirror_a]:text-blue-600 [&_.ProseMirror_a]:underline [&_.ProseMirror_a]:decoration-2 [&_.ProseMirror_p]:min-h-5"
      />
    </div>
  );
}
