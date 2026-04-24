import { auth } from "@/lib/auth";
import { getThreadDetail } from "@/lib/community/get-thread-detail";
import { recordResearchEvent } from "@/lib/research-event.server";
import CommentComposer from "./_components/CommentComposer";
import CommentTree, { type ThreadCommentNode } from "./_components/CommentTree";
import ThreadLinkedBookCard from "./_components/ThreadLinkedBookCard";
import ThreadBackButton from "./_components/ThreadBackButton";
import { type LinkedBook } from "../_components/types";

type Thread = {
  id: string;
  content: string;
  bookId: string | null;
  kind: string;
  createdAt: string;
  nickname: string | null;
  authorAvatarUrl: string | null;
  linkedBook: LinkedBook | null;
};

type ThreadComment = {
  id: string;
  threadId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  nickname: string | null;
  authorAvatarUrl: string | null;
  linkedBooks: LinkedBook[];
};

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;

  try {
    const [session, data] = await Promise.all([auth(), getThreadDetail(threadId)]);

    if (!data) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          スレッドが見つかりません
        </div>
      );
    }

    const thread: Thread | null = data.thread ?? null;
    const commentList: ThreadComment[] = Array.isArray(data.comments) ? data.comments : [];
    const list: Record<string, ThreadCommentNode> = {};
    commentList.forEach((item) => {
      list[item.id] = { ...item, children: [] };
    });

    const rootList: ThreadCommentNode[] = [];
    commentList.forEach((item) => {
      if (item.parentCommentId && list[item.parentCommentId]) {
        list[item.parentCommentId].children.push(list[item.id]);
      } else {
        rootList.push(list[item.id]);
      }
    });

    const userEmail = session?.user?.email ?? null;
    if (userEmail && thread?.bookId) {
      await recordResearchEvent({
        eventType: "post_view",
        userEmail,
        bookId: thread.bookId,
        sourceType: "thread",
        sourceId: threadId,
      });
    }

    return (
      <section className="space-y-6">
        <header className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
          <ThreadBackButton />
          <p className="text-xs font-semibold tracking-[0.08em] text-zinc-500">
            THREAD
          </p>
          <div className="mt-4 flex items-center gap-3">
            <img
              src={thread.authorAvatarUrl || "/default-avatar.svg"}
              alt={thread.nickname ?? "投稿者"}
              className="h-12 w-12 rounded-full border border-zinc-200 bg-zinc-100 object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {thread.nickname || "未設定"}
              </p>
              <p className="text-xs text-zinc-500">
                {new Date(thread.createdAt).toLocaleString("ja-JP")}
              </p>
            </div>
          </div>
          <div className="mt-5 whitespace-pre-wrap text-lg leading-8 text-zinc-800 font-bold">
            {thread.content || "スレッド本文がありません"}
          </div>

          {thread.linkedBook && (
            <ThreadLinkedBookCard book={thread.linkedBook} threadId={threadId} />
          )}
        </header>

        <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-bold text-zinc-900">コメント投稿</h2>
          <CommentComposer threadId={threadId} />
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-zinc-900">コメント</h2>
          </div>

          <div className="mt-6 space-y-5">
            {rootList.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 p-5 text-sm text-zinc-600">
                コメントはまだありません
              </div>
            ) : (
              <CommentTree comments={rootList} threadId={threadId} />
            )}
          </div>
        </section>
      </section>
    );
  } catch (error) {
    console.error("スレッド詳細の取得に失敗しました:", error);

    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        スレッドの取得に失敗しました
      </div>
    );
  }
}
