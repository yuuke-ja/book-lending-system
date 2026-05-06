import Skeleton from "@/app/_components/Skeleton";

type BookGridSkeletonProps = {
  count?: number;
};

export default function BookGridSkeleton({ count = 12 }: BookGridSkeletonProps) {
  return (
    <section
      className="space-y-5"
      role="status"
      aria-label="本一覧を読み込み中"
    >
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="space-y-2">
          <Skeleton className="h-3 w-10" />
          <div className="flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-lg" />
            <Skeleton className="h-11 w-14 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="grid gap-2 [grid-template-columns:repeat(3,minmax(0,1fr))] sm:gap-3 sm:[grid-template-columns:repeat(4,minmax(0,1fr))] md:gap-4 md:[grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className="flex h-full min-w-0 flex-col rounded-md border border-zinc-200 bg-white p-2 shadow-sm md:p-3"
          >
            <Skeleton className="h-32 w-full rounded sm:h-40 md:h-56" />
            <div className="mt-2 flex flex-1 flex-col gap-2 md:mt-3">
              <Skeleton className="h-3 w-full md:h-4" />
              <Skeleton className="h-3 w-4/5 md:h-4" />
              <div className="mt-1 hidden flex-wrap gap-1 md:flex">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="hidden h-3 w-2/3 md:block" />
              <Skeleton className="mt-1 h-4 w-16 md:w-28" />
              <Skeleton className="mt-auto hidden h-3 w-24 md:block" />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">本一覧を読み込み中</span>
    </section>
  );
}
