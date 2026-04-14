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
