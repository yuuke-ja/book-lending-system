"use client";

import ISBNImportModal from "@/app/_components/ISBNImportModal";
import { useCallback, useEffect, useState } from "react";

type PendingBook = {
  id: string;
  title: string;
  authors: string[];
  isbn13: string;
  thumbnail?: string | null;
  description?: string | null;
};

export default function QRCodeReader() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingBook[]>([]);

  useEffect(() => {
    fetch("/api/admin/pendingbook", { method: "GET" })
      .then((res) => res.json())
      .then((data) => setPending(data))
      .catch(() => setPending([]));
  }, []);

  // 取得したISBNを使って書誌情報を取り込み、仮登録へ追加する。
  const onDetected = useCallback(async (isbn: string) => {
    if (isDetecting) return;
    try {
      setIsDetecting(true);
      setError(null);
      const res = await fetch(`/api/admin/qrcode/book?isbn=${encodeURIComponent(isbn)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const resbook = await fetch("/api/admin/pendingbook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          googleBookId: data.googleBookId,
          isbn13: data.isbn13,
          title: data.title,
          authors: data.authors,
          description: data.description,
          thumbnail: data.thumbnail,
        }),
      });
      if (!resbook.ok) throw new Error();
      const saved = await resbook.json();
      setPending((prev) => [saved, ...prev]);
    } catch {
      setError("本の情報を取得できませんでした");
    } finally {
      setIsDetecting(false);
    }
  }, [isDetecting]);

  function pendingdelete(id: string) {
    fetch("/api/admin/pendingbook", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    }).then((res) => {
      if (!res.ok) throw new Error();
      setPending((prev) => prev.filter((pb) => pb.id !== id));
    });
  }

  function Bookregistration() {
    fetch("/api/admin/book-registration", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => {
      if (!res.ok) throw new Error();
      setPending([]);
    });
  }

  return (
    <div className="mt-6 space-y-3">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsScannerOpen(true);
        }}
        disabled={isDetecting}
        className="rounded-md bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {isDetecting ? "読み取り中..." : "QRコードを読み取る"}
      </button>
      <button
        className="rounded-md bg-green-600 px-4 py-2 text-white"
        onClick={() => Bookregistration()}
      >
        登録
      </button>

      {pending.length > 0 && (
        <div className="mt-6 space-y-2">
          {pending.map((pb) => (
            <div key={pb.id} className="rounded border p-2">
              <p className="font-semibold">{pb.title}</p>
              <div className="flex items-center justify-between">
                {pb.thumbnail && <img src={pb.thumbnail} className="mt-2 w-32" />}
                {pb.description && (
                  <p className="px-4 text-sm text-zinc-600">{pb.description}</p>
                )}
                <button
                  className="mt-2 rounded bg-red-500 px-2 py-1 text-xs text-white"
                  onClick={() => pendingdelete(pb.id)}
                >
                  削除
                </button>
              </div>
              {pb.authors?.length > 0 && (
                <p className="text-sm text-zinc-600">{pb.authors.join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ISBNImportModal
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={onDetected}
      />
    </div>
  );
}
