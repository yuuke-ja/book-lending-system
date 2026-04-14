import ThreadComposer from "./_components/ThreadComposer";
import ThreadList from "./_components/ThreadList";
import type { CommunityThread } from "./_components/types";
import { getThreadList } from "@/lib/community/get-thread-list";

export default async function CommunityPage() {
  let threads: CommunityThread[] = [];
  let error: string | null = null;

  try {
    threads = await getThreadList();
  } catch (caughtError) {
    console.error("スレッドの取得に失敗しました:", caughtError);
    error = "スレッドの取得に失敗しました";
  }

  return (
    <section className="space-y-6">
      <ThreadComposer />

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <ThreadList threads={threads} />
      )}
    </section>
  );
}
