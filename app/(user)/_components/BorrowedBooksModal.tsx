"use client";

import { useEffect, useState } from "react";

type Loan = {
  id: string;
  loanedAt: string;
  dueAt?: string | null;
  returnedAt?: string | null;
  book: {
    title: string;
    authors: string[];
    isbn13: string;
    thumbnail?: string | null;
  };
};

export default function BorrowedBooksModal() {
  const [open, setOpen] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/book/loan")
      .then((res) => res.json())
      .then((data) => setLoans(Array.isArray(data) ? data : []))
      .catch(() => setLoans([]));
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)}>借りた本</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[520px] w-[720px] max-h-[90vh] max-w-[90vw] flex-col rounded-lg bg-white p-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-lg font-semibold">借りた本</h2>
              <button onClick={() => setOpen(false)}>閉じる</button>
            </div>
            <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
              {loans.length === 0 && (
                <p className="text-sm text-zinc-500">貸出中の本はありません</p>
              )}
              {loans.map((loan) => (
                <div key={loan.id} className="flex gap-4 rounded border p-2">
                  <img
                    src={loan.book.thumbnail || undefined}
                    alt={loan.book.title}
                    className="h-24 w-16 object-contain"
                  />
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold">{loan.book.title}</p>
                    <p className="text-xs text-zinc-500">
                      {loan.book.authors.join(", ")}
                    </p>
                    <p className="text-xs text-zinc-500">
                      ISBN: {loan.book.isbn13}
                    </p>
                    <p className="text-xs text-zinc-500">
                      借りた日: {new Date(loan.loanedAt).toLocaleDateString()}
                    </p>
                    {loan.dueAt ? (
                      <p className="text-xs text-zinc-500">
                        返却日: {new Date(loan.dueAt).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-xs text-red-500">未返却</p>
                    )}
                    {loan.dueAt && (
                      <p className="text-xs text-red-500">
                        あと {Math.ceil((new Date(loan.dueAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} 日
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
