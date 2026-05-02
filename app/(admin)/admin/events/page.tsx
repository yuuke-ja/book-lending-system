"use client";

import { useEffect, useState } from "react";
import EventActivity from "./_components/EventActivity";
import EventDashboard from "./_components/EventDashboard";
import type { EventDashboardData } from "./_components/types";

const DEFAULT_DASHBOARD_URL =
  "/api/admin/events/dashboard" +
  "?postToBookDetailImpactTime=10minutes" +
  "&postToLoanImpactTime=1hours" +
  "&threadLinkToBookDetailImpactTime=5seconds" +
  "&bookDetailToLoanImpactTime=30minutes";

export default function AdminEventsPage() {
  const [data, setData] = useState<EventDashboardData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function fetchDashboard(url: string, signal?: AbortSignal) {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(url, { cache: "no-store", signal });

      if (!response.ok) {
        throw new Error("イベントの取得に失敗しました");
      }

      const nextData: EventDashboardData = await response.json();
      setData(nextData);
    } catch (error) {
      if (signal?.aborted) return;
      console.error(error);
      setError("イベントの取得に失敗しました");
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    void fetchDashboard(DEFAULT_DASHBOARD_URL, controller.signal);

    return () => controller.abort();
  }, []);

  return (
    <section className="space-y-6">


      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
          {error}
        </div>
      ) : null}

      {!data && isLoading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
          イベントを読み込み中です。
        </div>
      ) : null}

      {data ? (
        <>
          <EventDashboard
            data={data}
            isLoading={isLoading}
            onApplyImpactTime={(url) => void fetchDashboard(url)}
          />
          <EventActivity data={data} />
        </>
      ) : null}
    </section>
  );
}
