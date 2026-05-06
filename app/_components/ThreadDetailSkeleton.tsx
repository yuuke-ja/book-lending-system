import Skeleton from "@/app/_components/Skeleton";

export default function ThreadDetailSkeleton() {
  return (
    <section
      className="space-y-6"
      role="status"
      aria-label="投稿詳細を読み込み中"
    >
      <header className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <Skeleton className="mb-4 h-10 w-10 rounded-full" />
        <Skeleton className="h-3 w-16" />
        <div className="mt-4 flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-6 w-2/3" />
        </div>
        <div className="mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-5">
            <Skeleton className="h-32 w-24 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-3/5" />
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-5 h-28 w-full rounded-xl" />
        <div className="mt-4 flex justify-end">
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <Skeleton className="h-8 w-28" />
        <div className="mt-6 space-y-5">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </section>

      <span className="sr-only">投稿詳細を読み込み中</span>
    </section>
  );
}
