import Skeleton from "@/app/_components/Skeleton";

export default function BookDetailSkeleton() {
  return (
    <section
      className="space-y-6"
      role="status"
      aria-label="本詳細を読み込み中"
    >
      <Skeleton className="h-10 w-10 rounded-full" />

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex items-start justify-center">
            <Skeleton className="h-72 w-full max-w-[220px] rounded-xl" />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-36" />
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-7 w-16 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-14 rounded-full" />
              </div>
              <Skeleton className="h-10 w-24 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      <span className="sr-only">本詳細を読み込み中</span>
    </section>
  );
}
