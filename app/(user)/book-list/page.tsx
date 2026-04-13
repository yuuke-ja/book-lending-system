import BookListClient from "./_components/BookListClient";
import { getBookList } from "@/lib/books/get-book-list";
import { getLoanedBookIds } from "@/lib/books/get-loaned-book-ids";
import { getTagList } from "@/lib/books/get-tag-list";

async function getInitialBookListData() {
  try {
    const [initialBooks, initialLoanedBookIds, initialTags] = await Promise.all([
      getBookList(),
      getLoanedBookIds(),
      getTagList(),
    ]);

    return { initialBooks, initialLoanedBookIds, initialTags };
  } catch (error) {
    console.error("本一覧ページの初期表示に失敗:", error);
    return null;
  }
}

export default async function BookListPage() {
  const initialData = await getInitialBookListData();

  if (!initialData) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        エラー: 本一覧の取得に失敗しました
      </div>
    );
  }

  return (
    <BookListClient
      initialBooks={initialData.initialBooks}
      initialLoanedBookIds={initialData.initialLoanedBookIds}
      initialTags={initialData.initialTags}
    />
  );
}
