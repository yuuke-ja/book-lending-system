"use client";

import { useEffect, useState } from "react";
import EventActivity from "./_components/EventActivity";
import EventDashboard from "./_components/EventDashboard";
import type { EventDashboardData } from "./_components/types";
import Pointgraph from "./_components/Pointgraph";

const DEFAULT_DASHBOARD_URL =
  "/api/admin/events/dashboard" +
  "?postToLoanImpactTime=7days" +
  "&bookDetailToLoanImpactTime=7days" +
  "&threadLinkClickToLoanImpactTime=7days" +
  "&aiRecommendationDisplayToLoanImpactTime=7days" +
  "&aiRecommendationToLoanImpactTime=7days";
const GENRE_POINT_URL = "/api/admin/genre-points";

type GenrePointRow = {
  month: string;
  tagId: string;
  tagName: string;
  points: number;
};

type GenrePointResponse = {
  weights: Record<string, number>;
  rows: GenrePointRow[];
};

export default function AdminEventsPage() {
  const [data, setData] = useState<EventDashboardData | null>(null);
  const [point, setpoint] = useState<GenrePointRow[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function fetchDashboard(url: string, signal?: AbortSignal) {
    setIsLoading(true);
    setError("");

    try {
      const [dashboardResponse, genrePointResponse] = await Promise.all([
        fetch(url, { cache: "no-store", signal }),
        fetch(GENRE_POINT_URL, { cache: "no-store", signal }),
      ]);

      if (!dashboardResponse.ok) {
        throw new Error("イベントの取得に失敗しました");
      }
      if (!genrePointResponse.ok) {
        throw new Error("ジャンルポイントの取得に失敗しました");
      }

      const [nextData, genrePointData]: [
        EventDashboardData,
        GenrePointResponse
      ] = await Promise.all([
        dashboardResponse.json(),
        genrePointResponse.json(),
      ]);

      setData(nextData);
      setpoint(Array.isArray(genrePointData.rows) ? genrePointData.rows : []);
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

    fetchDashboard(DEFAULT_DASHBOARD_URL, controller.signal);

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
            onApplyImpactTime={(url) => {
              fetchDashboard(url);
            }}
          />
          {point.length > 0 ? (
            <Pointgraph data={point} />
          ) : null}
          <EventActivity data={data} />
        </>
      ) : null}
    </section>
  );
}
