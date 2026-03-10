"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type Summary = {
  thisWeekLoanCount: number;
  thisWeekUserCount: number;
  thisMonthLoanCount: number;
  thisMonthUserCount: number;
  activeLoanCount: number;
  bookCount: number;
};

type WeekStat = {
  weekStart: string;
  loanCount: number;
  userCount: number;
};

type MonthStat = {
  monthStart: string;
  loanCount: number;
  userCount: number;
};

type BarLabelProps = {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  value?: number | string | boolean | null;
};

//APIの日付を Date に直す
function parseApiDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

//Date を API の日付に戻す
function formatApiDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

//週送り用
function addDays(dateString: string, days: number): string {
  const date = parseApiDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return formatApiDate(date);
}

//月送り用
function addMonths(dateString: string, months: number): string {
  const date = parseApiDate(dateString);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  return formatApiDate(date);
}

//今日
function getTodayInJapan(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

//月日表示
function formatJapanMonthDay(value: string | Date): string {
  return new Date(value).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  });
}

//週ラベル
const formatWeekTickLabel = (value: string): string => {
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return value;
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${formatJapanMonthDay(start)}〜${formatJapanMonthDay(end)}`;
};

//月ラベル
const formatMonthTickLabel = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
  });
};

//棒の上の数字
const renderBarValueLabel = (props: BarLabelProps) => {
  const { x, y, width, value } = props ?? {};
  if (
    value == null ||
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number"
  ) {
    return null;
  }
  return (
    <text x={x + width / 2} y={y} fill="#666" textAnchor="middle" dy={-6}>
      {value}
    </text>
  );
};

export default function Statistics() {
  const [todayAnchorDate] = useState(getTodayInJapan);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [weekStats, setWeekStats] = useState<WeekStat[]>([]);
  const [monthStats, setMonthStats] = useState<MonthStat[]>([]);
  const [weekAnchorDate, setWeekAnchorDate] = useState(todayAnchorDate);
  const [monthAnchorDate, setMonthAnchorDate] = useState(todayAnchorDate);
  const [isLoading, setIsLoading] = useState(true);
  const [isWeekLoading, setIsWeekLoading] = useState(false);
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const [error, setError] = useState("");
  const [weekError, setWeekError] = useState("");
  const [monthError, setMonthError] = useState("");


  const fetchWeekStats = async (anchorDate: string) => {
    setIsWeekLoading(true);
    setWeekError("");
    try {
      const response = await fetch(
        `/api/statistics/week?anchorDate=${encodeURIComponent(anchorDate)}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        throw new Error("週次統計の取得に失敗しました");
      }
      const weekData = await response.json();
      setWeekStats(Array.isArray(weekData) ? weekData : []);
      return true;
    } catch (e) {
      console.error(e);
      setWeekError("週次統計の取得に失敗しました");
      return false;
    } finally {
      setIsWeekLoading(false);
    }
  };

  const fetchMonthStats = async (anchorDate: string) => {
    setIsMonthLoading(true);
    setMonthError("");
    try {
      const response = await fetch(
        `/api/statistics/month?anchorDate=${encodeURIComponent(anchorDate)}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        throw new Error("月次統計の取得に失敗しました");
      }
      const monthData = await response.json();
      setMonthStats(Array.isArray(monthData) ? monthData : []);
      return true;
    } catch (e) {
      console.error(e);
      setMonthError("月次統計の取得に失敗しました");
      return false;
    } finally {
      setIsMonthLoading(false);
    }
  };

  useEffect(() => {
    const fetchStatus = async () => {
      setIsLoading(true);
      setError("");

      try {
        const anchorDate = todayAnchorDate;
        const [weekRes, summaryRes, monthRes] = await Promise.all([
          fetch(`/api/statistics/week?anchorDate=${encodeURIComponent(anchorDate)}`, { cache: "no-store" }),
          fetch("/api/statistics/summary", { cache: "no-store" }),
          fetch(`/api/statistics/month?anchorDate=${encodeURIComponent(anchorDate)}`, { cache: "no-store" }),
        ]);

        if (!weekRes.ok || !summaryRes.ok || !monthRes.ok) {
          throw new Error("統計の取得に失敗しました");
        }

        const [weekData, summaryData, monthData] = await Promise.all([
          weekRes.json(),
          summaryRes.json(),
          monthRes.json(),
        ]);

        setWeekStats(Array.isArray(weekData) ? weekData : []);
        setSummary(summaryData ?? null);
        setMonthStats(Array.isArray(monthData) ? monthData : []);
      } catch (e) {
        console.error(e);
        setError("統計の取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, [todayAnchorDate]);

  if (isLoading) return <p>統計を読み込み中...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="space-y-3 text-sm text-zinc-700">
      <div className="grid grid-cols-2 gap-2 rounded-md border border-zinc-200 bg-white p-3 md:grid-cols-4">
        <p>今週貸出: {summary?.thisWeekLoanCount ?? 0}冊</p>
        <p>今週利用者: {summary?.thisWeekUserCount ?? 0}人</p>
        <p>今月貸出: {summary?.thisMonthLoanCount ?? 0}冊</p>
        <p>今月利用者: {summary?.thisMonthUserCount ?? 0}人</p>
      </div>

      {/* 小さい画面では縦、md以上で横並び */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0 rounded-md border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">今週の貸出/利用者</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const nextAnchorDate = addDays(weekAnchorDate, -7);
                  const success = await fetchWeekStats(nextAnchorDate);
                  if (success) {
                    setWeekAnchorDate(nextAnchorDate);
                  }
                }}
                disabled={isWeekLoading}
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 disabled:opacity-50"
              >
                前の週
              </button>
              <button
                type="button"
                onClick={async () => {
                  const success = await fetchWeekStats(todayAnchorDate);
                  if (success) {
                    setWeekAnchorDate(todayAnchorDate);
                  }
                }}
                disabled={isWeekLoading}
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 disabled:opacity-50"
              >
                今週
              </button>
            </div>
          </div>
          {weekError ? <p>{weekError}</p> : <WeekChart data={weekStats} />}
        </div>

        <div className="min-w-0 rounded-md border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">今月の貸出/利用者</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const nextAnchorDate = addMonths(monthAnchorDate, -1);
                  const success = await fetchMonthStats(nextAnchorDate);
                  if (success) {
                    setMonthAnchorDate(nextAnchorDate);
                  }
                }}
                disabled={isMonthLoading}
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 disabled:opacity-50"
              >
                前の月
              </button>
              <button
                type="button"
                onClick={async () => {
                  const success = await fetchMonthStats(todayAnchorDate);
                  if (success) {
                    setMonthAnchorDate(todayAnchorDate);
                  }
                }}
                disabled={isMonthLoading}
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 disabled:opacity-50"
              >
                今月
              </button>
            </div>
          </div>
          {monthError ? <p>{monthError}</p> : <MonthChart data={monthStats} />}
        </div>
      </div>
    </div>
  );
}

function WeekChart({ data }: { data: WeekStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={data}
        margin={{ top: 18, right: 12, left: 0, bottom: 10 }}
        barCategoryGap="20%"
      >
        <CartesianGrid strokeDasharray="3 3" syncWithTicks />
        <XAxis
          dataKey="weekStart"
          tickFormatter={formatWeekTickLabel}
          ticks={data.map((item) => item.weekStart)}
          interval={0}
          minTickGap={0}
        />
        <YAxis domain={[0, "dataMax + 5"]} />
        <Tooltip labelFormatter={(value) => formatWeekTickLabel(value)} />
        <Legend />
        <Bar dataKey="loanCount" name="貸出" fill="#8884d8" radius={[6, 6, 0, 0]} label={renderBarValueLabel} />
        <Bar dataKey="userCount" name="利用者" fill="#82ca9d" radius={[6, 6, 0, 0]} label={renderBarValueLabel} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MonthChart({ data }: { data: MonthStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={data}
        margin={{ top: 18, right: 12, left: 0, bottom: 10 }}
        barCategoryGap="20%"
      >
        <CartesianGrid strokeDasharray="3 3" syncWithTicks />
        <XAxis
          dataKey="monthStart"
          tickFormatter={formatMonthTickLabel}
          ticks={data.map((item) => item.monthStart)}
          interval={0}
          minTickGap={0}
        />
        <YAxis domain={[0, "dataMax + 5"]} />
        <Tooltip labelFormatter={(value) => formatMonthTickLabel(value)} />
        <Legend />
        <Bar dataKey="loanCount" name="貸出" fill="#8884d8" radius={[6, 6, 0, 0]} label={renderBarValueLabel} />
        <Bar dataKey="userCount" name="利用者" fill="#82ca9d" radius={[6, 6, 0, 0]} label={renderBarValueLabel} />
      </BarChart>
    </ResponsiveContainer>
  );
}
