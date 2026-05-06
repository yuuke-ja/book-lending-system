import Skeleton from "@/app/_components/Skeleton";

type ThreadListSkeletonProps = {
  count?: number;
};

export default function ThreadListSkeleton({
  count = 4,
}: ThreadListSkeletonProps) {
  return (
    <section
      className="space-y-6"
      role="status"
      aria-label="投稿一覧を読み込み中"
    >
      <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <div className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="flex justify-end">
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="border-b border-zinc-200 p-7 last:border-b-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
            </div>
            {index === 0 && (
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
            )}
          </div>
        ))}
      </section>

      <span className="sr-only">投稿一覧を読み込み中</span>
    </section>
  );
}
