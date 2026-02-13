"use client";

import ISBNImportModal from "@/app/_components/ISBNImportModal";
import Link from "next/link";
import { useCallback, useState } from "react";

type Book = {
  id: string;
  title: string;
  authors: string[];
  isbn13: string;
  description?: string | null;
  thumbnail?: string | null;
};

export default function LoanQrPage() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [successTitle, setSuccessTitle] = useState<string | null>(null);

  // スキャン開始時に画面状態を初期化してカメラを開く。
  const startScan = () => {
    setError(null);
    setBook(null);
    setSuccessTitle(null);
    setIsScannerOpen(true);
  };

  // 共通スキャナで取得したISBNから、本情報APIで貸出対象の本を特定する。
  const onDetected = useCallback(async (isbn: string) => {
    try {
      const res = await fetch(`/api/book/borrow?isbn13=${encodeURIComponent(isbn)}`);
      if (res.status === 404) {
        setError("この本は未登録です");
        setBook(null);
        return;
      }
      if (!res.ok) throw new Error();
      const found: Book = await res.json();
      setError(null);
      setBook(found);
    } catch {
      setError("本情報の取得に失敗しました");
    }
  }, []);

  // 確認中の本を貸出APIに送信して、成功時は完了表示に切り替える。
  const borrowBook = async () => {
    if (!book || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch("/api/book/loan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookId: book.id }),
      });

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error("この本はすでに貸出中です");
        }
        throw new Error("貸出に失敗しました");
      }

      setSuccessTitle(book.title);
      setBook(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "貸出に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-900">QRコードで貸出</h1>
        <p className="text-sm text-zinc-600">
          ISBNバーコードを読み取って本を確認し、貸出を確定します。
        </p>

        {!book && !successTitle && (
          <button
            type="button"
            onClick={startScan}
            className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800"
          >
            ISBNを読み取る
          </button>
        )}

        {book && (
          <div className="space-y-3 rounded-lg border bg-white p-4">
            <p className="text-sm font-semibold text-zinc-900">この本を貸し出しますか？</p>
            <div className="flex gap-4">
              {book.thumbnail && (
                <img
                  src={book.thumbnail}
                  alt={book.title}
                  className="h-40 w-28 rounded object-contain"
                />
              )}
              <div className="space-y-2">
                <p className="font-semibold text-zinc-900">{book.title}</p>
                <p className="text-sm text-zinc-600">{book.authors.join(", ")}</p>
                <p className="text-xs text-zinc-500">ISBN: {book.isbn13}</p>
                {book.description && (
                  <p className="text-sm text-zinc-700">{book.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={borrowBook}
                disabled={isSubmitting}
                className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {isSubmitting ? "貸出中..." : "借りる"}
              </button>
              <button
                type="button"
                onClick={startScan}
                className="rounded-md bg-zinc-200 px-4 py-2 text-zinc-900 hover:bg-zinc-300"
              >
                読み取り直す
              </button>
            </div>
          </div>
        )}

        {successTitle && (
          <div className="space-y-3 rounded-lg border bg-white p-4">
            <p className="text-lg font-semibold text-emerald-700">貸出が完了しました</p>
            <p className="text-sm text-zinc-700">{successTitle}</p>
            <button
              type="button"
              onClick={startScan}
              className="rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800"
            >
              続けて読み取る
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Link
          href="/"
          className="inline-flex items-center rounded-md bg-zinc-200 px-4 py-2 text-zinc-900 hover:bg-zinc-300"
        >
          戻る
        </Link>
      </div>

      <ISBNImportModal
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={onDetected}
      />
    </main>
  );
}
