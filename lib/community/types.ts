export type LinkedBook = {
  id: string;
  title: string;
  thumbnail: string | null;
};

export type CommunityThread = {
  id: string;
  content: string;
  bookId: string | null;
  kind: string;
  createdAt: string;
  linkedBook: LinkedBook | null;
  nickname: string | null;
  authorAvatarUrl: string | null;
};

export type CommunityComment = {
  id: string;
  threadId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  nickname: string | null;
  authorAvatarUrl: string | null;
  linkedBooks: LinkedBook[];
};

export type ThreadDetail = {
  thread: CommunityThread;
  comments: CommunityComment[];
};
