import type { ReactNode } from "react";
import type { NoticeContent as NoticeContentData } from "@/lib/notices/type";

type NoticeMark = {
  type: string;
  attrs?: {
    href?: string;
  };
};

type NoticeNode = {
  type: string;
  text?: string;
  content?: NoticeNode[];
  marks?: NoticeMark[];
};

function renderNode(node: NoticeNode, key: string): ReactNode {
  if (node.type === "paragraph") {
    return (
      <p key={key} className="mb-2 whitespace-pre-wrap">
        {node.content?.map((child, index) => {
          return renderNode(child, `${key}-child-${index}`);
        })}
      </p>
    );
  }

  if (node.type === "text") {
    const link = node.marks?.find((mark) => {
      return mark.type === "link";
    });

    if (link?.attrs?.href) {
      return (
        <a
          key={key}
          href={link.attrs.href}
          className="text-blue-600 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {node.text}
        </a>
      );
    }

    return <span key={key}>{node.text}</span>;
  }

  return null;
}

export default function NoticeContent({
  content,
}: {
  content: NoticeContentData;
}) {
  const root = content as NoticeNode;

  return (
    <div className="space-y-2 text-sm text-zinc-700">
      {root.content?.map((node, index) => {
        return renderNode(node, `notice-node-${index}`);
      })}
    </div>
  );
}
