import type { LinkedBook } from "../../_components/types";

export type ThreadCommentNode = {
  id: string;
  threadId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  nickname: string | null;
  authorAvatarUrl: string | null;
  linkedBooks: LinkedBook[];
  children: ThreadCommentNode[];
};
