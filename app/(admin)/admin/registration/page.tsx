"use client";

import ISBNImportModal from "@/app/_components/ISBNImportModal";
import { useCallback, useEffect, useState, type SVGProps } from "react";

type PendingBook = {
  id: string;
  title: string;
  authors: string[];
  isbn13: string;
  thumbnail?: string | null;
  description?: string | null;
};

function CameraIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      fill="currentColor"
      {...props}
    >
      <path d="M480-260q75 0 127.5-52.5T660-440q0-75-52.5-127.5T480-620q-75 0-127.5 52.5T300-440q0 75 52.5 127.5T480-260Zm0-80q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM160-120q-33 0-56.5-23.5T80-200v-480q0-33 23.5-56.5T160-760h126l74-80h240l74 80h126q33 0 56.5 23.5T880-680v480q0 33-23.5 56.5T800-120H160Zm0-80h640v-480H638l-73-80H395l-73 80H160v480Zm320-240Z" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m5 12 4.2 4.2L19 6.5" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      fill="currentColor"
      {...props}
    >
      <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
    </svg>
  );
}

function BookOpenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 6.5C10.6 5.6 8.9 5 7 5 5.3 5 3.7 5.4 2.3 6.2A1 1 0 0 0 2 7v11a1 1 0 0 0 1.5.9A7.6 7.6 0 0 1 7 18c1.9 0 3.6.6 5 1.5" />
      <path d="M12 6.5C13.4 5.6 15.1 5 17 5c1.7 0 3.3.4 4.7 1.2A1 1 0 0 1 22 7v11a1 1 0 0 1-1.5.9A7.6 7.6 0 0 0 17 18c-1.9 0-3.6.6-5 1.5" />
      <path d="M12 6.5V19.5" />
    </svg>
  );
}

export default function QRCodeReader() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingBook[]>([]);

  useEffect(() => {
    fetch("/api/admin/pendingbook", { method: "GET" })
      .then((res) => res.json())
      .then((data) => setPending(data))
      .catch(() => setPending([]));
  }, []);

  useEffect(() => {
    if (!error) return;
    const timerId = setTimeout(() => {
      setError(null);
    }, 5000);
    return () => clearTimeout(timerId);
  }, [error]);

  // 取得したISBNを使って書誌情報を取り込み、仮登録へ追加する。
  const onDetected = useCallback(async (isbn: string) => {
    if (isDetecting) return;
    try {
      setIsDetecting(true);
      setError(null);
      const res = await fetch(`/api/admin/qrcode/book?isbn=${encodeURIComponent(isbn)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : "本の情報を取得できませんでした");
      }
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
      if (!resbook.ok) {
        const data = await resbook.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : "仮登録に失敗しました");
      }
      const saved = await resbook.json();
      //置き換える
      setPending((prev) => {
        const double = prev.some((pb) => pb.isbn13 === saved.isbn13);
        if (double) {
          return prev.map((pb) => (pb.isbn13 === saved.isbn13 ? saved : pb));
        }
        return [saved, ...prev];
      });

    } catch (error) {
      setError(error instanceof Error ? error.message : "エラーが発生しました");
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
    if (isRegistering) return;
    setIsRegistering(true);
    fetch("/api/admin/book-registration", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : "本登録に失敗しました");
      }
      setPending([]);
    }).catch((error) => {
      setError(error instanceof Error ? error.message : "本登録に失敗しました");
    }).finally(() => {
      setIsRegistering(false);
    });
  }

  return (
    <section className="space-y-8 rounded-[28px] bg-slate-50 p-6 text-slate-900 md:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-emerald-100 p-2 text-emerald-700">
              <BookOpenIcon className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">書籍の登録</h1>

            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setIsScannerOpen(true);
            }}
            disabled={isDetecting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto"
          >
            <CameraIcon className="h-4 w-4" />
            {isDetecting ? "読み取り中..." : "ISBNを読み取る"}
          </button>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300 sm:w-auto"
            onClick={() => Bookregistration()}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <CheckIcon className="h-4 w-4" />
            )}
            {isRegistering ? "登録中..." : "登録する"}
          </button>
        </div>
      </div>

      <div className="flex min-h-6 items-center">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </div>

      {pending.length > 0 && (
        <div className="space-y-6">
          {pending.map((pb) => (
            <div
              key={pb.id}
              className="group relative flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:flex-row"
            >
              <button
                className="absolute right-4 top-4 rounded-full p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                onClick={() => pendingdelete(pb.id)}
                aria-label={`${pb.title} を削除`}
              >
                <TrashIcon className="h-5 w-5" />
              </button>

              <div className="mx-auto w-32 shrink-0 sm:mx-0 sm:w-40">
                <div className="aspect-[1/1.4] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
                  {pb.thumbnail ? (
                    <img
                      src={pb.thumbnail}
                      alt={pb.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                      <BookOpenIcon className="h-10 w-10" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="pr-10">
                  <h2 className="text-xl font-bold leading-tight text-slate-800">{pb.title}</h2>
                  {pb.authors?.length > 0 && (
                    <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                      {pb.authors.join(", ")}
                    </div>
                  )}
                </div>

                {pb.description && (
                  <p className="mt-4 text-sm leading-7 text-slate-800">{pb.description}</p>
                )}

                <p className="mt-4 text-xs font-medium tracking-wide text-slate-400">
                  ISBN: {pb.isbn13}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {pending.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
          <BookOpenIcon className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-800">登録する書籍がありません</h2>
          <p className="mt-2 text-sm text-slate-500">
            「ISBNを読み取る」ボタンから書籍を追加してください。
          </p>
        </div>
      )}

      <ISBNImportModal
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={onDetected}
      />
    </section>
  );
}
