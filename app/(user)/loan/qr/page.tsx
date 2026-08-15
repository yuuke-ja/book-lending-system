"use client";

import ISBNScanGuide from "@/app/_components/ISBNScanGuide";
import ISBNImportModal from "@/app/_components/ISBNImportModal";
import { loanBook } from "@/lib/action/loan";
import { useCallback, useState } from "react";
import Image from "next/image";

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
  const [book, setBook] = useState<Book | null>(null);
  const [successTitle, setSuccessTitle] = useState<string | null>(null);

  const showError = useCallback((message: string) => {
    window.alert(message);
  }, []);

  // スキャン開始時に画面状態を初期化してカメラを開く。
  const startScan = () => {
    setBook(null);
    setSuccessTitle(null);
    setIsScannerOpen(true);
  };

  // 共通スキャナで取得したISBNから、本情報APIで貸出対象の本を特定する。
  const onDetected = useCallback(async (isbn: string) => {
    try {
      const res = await fetch(`/api/book/borrow?isbn13=${encodeURIComponent(isbn)}`);
      if (res.status === 404) {
        showError("この本は未登録です");
        setBook(null);
        return;
      }
      if (!res.ok) throw new Error();
      const found: Book = await res.json();
      setBook(found);
    } catch {
      showError("本情報の取得に失敗しました");
    }
  }, [showError]);

  // 確認中の本をServer Actionで貸し出し、成功時は完了表示に切り替える。
  const borrowBook = async () => {
    if (!book || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const result = await loanBook(book.id);

      if (result.status !== 200) {
        throw new Error(result.error);
      }

      setSuccessTitle(book.title);
      setBook(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "貸出に失敗しました";
      showError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">QRコードで貸出</h1>
        <p className="text-sm text-zinc-600">
          ISBN/JANコードを読み取って本を確認し、貸出を確定します。
        </p>

        {!book && !successTitle && (
          <div className="space-y-4">
            <ISBNScanGuide />
            <button
              type="button"
              onClick={startScan}
              className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-zinc-800"
            >
              ISBN/JANを読み取る
            </button>
          </div>
        )}

        {book && (
          <div className="space-y-3 rounded-lg border bg-white p-4">
            <p className="text-sm font-semibold text-zinc-900">この本を貸し出しますか？</p>
            <div className="flex flex-col gap-4 sm:flex-row">
              {book.thumbnail && (
                <Image
                  src={book.thumbnail}
                  alt={book.title}
                  width={112}
                  height={160}
                  sizes="112px"
                  className="h-40 w-28 rounded object-contain"
                />
              )}
              <div className="space-y-2">
                <p className="font-semibold text-zinc-900">{book.title}</p>
                <p className="text-sm text-zinc-600">{book.authors.join(", ")}</p>
                <p className="text-xs text-zinc-500">ISBN/JAN: {book.isbn13}</p>
                {book.description && (
                  <p className="text-sm text-zinc-700">{book.description}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
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

      </section>

      <ISBNImportModal
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={onDetected}
      />
    </>
  );
}
