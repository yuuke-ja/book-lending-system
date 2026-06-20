export type NoticeContent = {
  type: string;
  content?: unknown[];
};

export type LinkedBook = {
  id: string;
  title: string;
  thumbnail: string | null;
};

export type NoticeRow = {
  id: string;
  title: string;
  content: NoticeContent;
  bookId: string | null;
  createdAt: Date;
  linkedBookTitle: string | null;
  linkedBookThumbnail: string | null;
};

export type Notice = {
  id: string;
  title: string;
  content: NoticeContent;
  createdAt: Date;
  linkedBook: LinkedBook | null;
};
