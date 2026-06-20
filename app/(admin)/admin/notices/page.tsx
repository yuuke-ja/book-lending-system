import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Trash2 } from "lucide-react";
import NoticeForm from "./_components/NoticeForm";
import { getNotices } from "@/lib/notices/get-notices";

async function deleteNotice(formData: FormData) {
  "use server";

  const noticeId = formData.get("noticeId");
  if (typeof noticeId !== "string" || noticeId === "") {
    return;
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const cookie = requestHeaders.get("cookie");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return;
  }

  const response = await fetch(
    `${protocol}://${host}/api/admin/notices/${encodeURIComponent(noticeId)}`,
    {
      method: "DELETE",
      headers: cookie ? { cookie } : undefined,
    }
  );

  if (!response.ok) {
    throw new Error("お知らせの削除に失敗しました");
  }

  revalidatePath("/admin/notices");
}

function extractText(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const node = value as {
    type?: unknown;
    text?: unknown;
    content?: unknown;
  };

  let ownText = "";
  if (typeof node.text === "string") {
    ownText = node.text;
  }

  let childText = "";
  if (Array.isArray(node.content)) {
    const separator = node.type === "doc" ? "\n" : "";
    childText = node.content
      .map(extractText)
      .filter(Boolean)
      .join(separator);
  }

  return [ownText, childText].filter(Boolean).join("");
}

export default async function AdminNoticesPage() {
  const notices = await getNotices();

  return (
    <main className="min-h-screen bg-zinc-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-900">お知らせ管理</h1>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            お知らせを登録
          </h2>
          <NoticeForm />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              登録済みのお知らせ
            </h2>
            <span className="text-sm text-zinc-500">{notices.length}件</span>
          </div>

          {notices.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
              登録済みのお知らせはありません。
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map((notice) => (
                <article
                  key={notice.id}
                  className="rounded-lg border border-zinc-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold text-zinc-900">
                      {notice.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <time className="text-xs text-zinc-500">
                        {notice.createdAt.toLocaleString("ja-JP", {
                          timeZone: "Asia/Tokyo",
                        })}
                      </time>
                      <form action={deleteNotice}>
                        <input
                          type="hidden"
                          name="noticeId"
                          value={notice.id}
                        />
                        <button
                          type="submit"
                          aria-label={`${notice.title}を削除`}
                          title="削除"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </form>
                    </div>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">
                    {extractText(notice.content) || "本文なし"}
                  </p>

                  {notice.linkedBook && (
                    <div className="mt-4 flex items-center gap-3 border-t border-zinc-100 pt-3">
                      <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-zinc-50">
                        {notice.linkedBook.thumbnail ? (
                          <img
                            src={notice.linkedBook.thumbnail}
                            alt={notice.linkedBook.title}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-[9px] text-zinc-400">
                            NO IMAGE
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-zinc-800">
                        {notice.linkedBook.title}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
