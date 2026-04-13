export type BookListTag = {
  id: string;
  tag: string;
};

export type BookListBook = {
  id: string;
  title: string;
  authors: string[];
  isbn13: string;
  thumbnail?: string | null;
  averageRating?: number | null;
  tags?: BookListTag[] | null;
};
