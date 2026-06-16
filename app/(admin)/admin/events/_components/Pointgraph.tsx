import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type GenrePointRow = {
  month: string;
  tagId: string;
  tagName: string;
  points: number;
};

type PointgraphProps = {
  data: GenrePointRow[];
};

const LINE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#4f46e5",
  "#be123c",
];
const PERIOD_CONFIG = {
  w6: { label: "6ヶ月", months: 6, bucketSize: 1 },
  y1: { label: "1年", months: 12, bucketSize: 2 },
  y2: { label: "2年", months: 24, bucketSize: 4 },
} as const;

type Period = keyof typeof PERIOD_CONFIG;

// 月をグラフ表示用の文字列に整える。
function formatMonth(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-");
    return `${year}/${Number(month)}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
  });
}

// APIの日付を月比較用のキーに変換する。
function toMonthKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// / 選択された期間分の月一覧
function getRecentMonthKeys(months: number) {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthKeys: string[] = [];

  for (let index = 0; index < months; index += 1) {
    const date = new Date(base);
    const monthsAgo = months - 1 - index;

    date.setMonth(base.getMonth() - monthsAgo);
    monthKeys.push(toMonthKey(date.toISOString()));
  }

  return monthKeys;
}

// 月キーを指定月数ごとのまとまりに分ける。
function chunkMonths(monthKeys: string[], bucketSize: number) {
  const buckets: string[][] = [];

  for (let index = 0; index < monthKeys.length; index += bucketSize) {
    buckets.push(monthKeys.slice(index, index + bucketSize));
  }

  return buckets;
}

export default function Pointgraph({ data }: PointgraphProps) {
  const [period, setPeriod] = useState<Period>("y1");
  const tagNames = useMemo(() => {
    const totals = new Map<string, number>();

    for (const row of data) {
      totals.set(row.tagName, (totals.get(row.tagName) ?? 0) + row.points);
    }

    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tagName]) => tagName);
  }, [data]);

  // 選択期間に合わせてRecharts用の集計データを作る。
  const chartData = useMemo(() => {
    const config = PERIOD_CONFIG[period];

    const monthKeys = getRecentMonthKeys(config.months);
    const buckets = chunkMonths(monthKeys, config.bucketSize);

    const nextChartData = buckets.map((bucket) => {
      const labelMonth = bucket[bucket.length - 1] ?? "";
      const item: Record<string, string | number> = {
        month: labelMonth,
      };

      // 各タグの初期値を0にする。
      for (const tagName of tagNames) {
        item[tagName] = 0;
      }

      return item;
    });

    // APIの各行を該当する月のまとまりに加算する。
    for (const row of data) {
      const rowMonth = toMonthKey(row.month);
      let bucketIndex = -1;

      // この行の月が入るまとまりを探す。
      for (let index = 0; index < buckets.length; index += 1) {
        const bucket = buckets[index];

        if (bucket.includes(rowMonth)) {
          bucketIndex = index;
          break;
        }
      }

      if (bucketIndex === -1) continue;
      if (!tagNames.includes(row.tagName)) continue;

      const currentPoint = nextChartData[bucketIndex][row.tagName];
      const currentPointNumber =
        typeof currentPoint === "number" ? currentPoint : 0;

      nextChartData[bucketIndex][row.tagName] =
        currentPointNumber + row.points;
    }

    return nextChartData;
  }, [data, period, tagNames]);

  if (data.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          ジャンルポイント推移
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          月ごとのタグ別ポイントです。
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        {Object.entries(PERIOD_CONFIG).map(([key, option]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key as Period)}
            className={`rounded-md border px-3 py-1 text-sm ${period === key
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-700"
              }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-5 h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickFormatter={(value) => formatMonth(String(value))}
            />
            <YAxis />
            <Tooltip labelFormatter={(value) => formatMonth(String(value))} />
            <Legend />
            {tagNames.map((tagName, index) => (
              <Line
                key={tagName}
                type="monotone"
                dataKey={tagName}
                name={tagName}
                stroke={LINE_COLORS[index % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
