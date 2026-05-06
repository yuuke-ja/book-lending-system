import BookDetailSkeleton from "@/app/_components/BookDetailSkeleton";
import BookGridSkeleton from "@/app/_components/BookGridSkeleton";
import ThreadDetailSkeleton from "@/app/_components/ThreadDetailSkeleton";
import ThreadListSkeleton from "@/app/_components/ThreadListSkeleton";

export default function LoadingPreviewPage() {
  return (
    <section className="space-y-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500">
          LOADING PREVIEW
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          スケルトン表示確認
        </h1>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">本一覧</h2>
        <BookGridSkeleton count={8} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">本詳細</h2>
        <BookDetailSkeleton />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">投稿一覧</h2>
        <ThreadListSkeleton count={3} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">投稿詳細</h2>
        <ThreadDetailSkeleton />
      </section>
    </section>
  );
}
