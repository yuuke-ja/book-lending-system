"use client";

import { useState } from "react";

type CustomUnit = "minutes" | "hours" | "days";

type ImpactTimeSelectorProps = {
  isLoading: boolean;
  windowMinutes: number;
  onWindowMinutesChange: (minutes: number) => void;
};

const MAX_IMPACT_TIME_MINUTES = 30 * 24 * 60;

const IMPACT_TIME_PRESETS = [
  { label: "1分", minutes: 1 },
  { label: "5分", minutes: 5 },
  { label: "10分", minutes: 10 },
  { label: "30分", minutes: 30 },
  { label: "1時間", minutes: 60 },
  { label: "6時間", minutes: 6 * 60 },
  { label: "12時間", minutes: 12 * 60 },
  { label: "1日", minutes: 24 * 60 },
  { label: "3日", minutes: 3 * 24 * 60 },
  { label: "7日", minutes: 7 * 24 * 60 },
  { label: "14日", minutes: 14 * 24 * 60 },
  { label: "30日", minutes: 30 * 24 * 60 },
];

export function formatImpactTime(minutes: number) {
  if (minutes < 60) return `${minutes}分`;
  if (minutes % (24 * 60) === 0) return `${minutes / (24 * 60)}日`;
  if (minutes % 60 === 0) return `${minutes / 60}時間`;
  return `${minutes}分`;
}

function customImpactTimeToMinutes(amount: string, unit: CustomUnit) {
  const numberValue = Number(amount);
  if (!Number.isInteger(numberValue) || numberValue <= 0) return null;

  const multiplier =
    unit === "days" ? 24 * 60 : unit === "hours" ? 60 : 1;
  const minutes = numberValue * multiplier;

  if (minutes > MAX_IMPACT_TIME_MINUTES) return null;
  return minutes;
}

export default function ImpactTimeSelector({
  isLoading,
  windowMinutes,
  onWindowMinutesChange,
}: ImpactTimeSelectorProps) {
  const [customAmount, setCustomAmount] = useState("15");
  const [customUnit, setCustomUnit] = useState<CustomUnit>("minutes");
  const [customError, setCustomError] = useState("");

  function applyCustomImpactTime() {
    const minutes = customImpactTimeToMinutes(customAmount, customUnit);
    if (minutes == null) {
      setCustomError("1分から30日までの整数で指定してください");
      return;
    }

    setCustomError("");
    onWindowMinutesChange(minutes);
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">影響時間</h2>
          <p className="mt-1 text-sm text-zinc-600">
            この時間内の投稿閲覧や本詳細閲覧を、経路別集計の対象にします。
          </p>
        </div>
        {isLoading ? (
          <p className="text-sm text-zinc-500">更新中...</p>
        ) : (
          <p className="text-sm text-zinc-500">
            表示中: {formatImpactTime(windowMinutes)}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {IMPACT_TIME_PRESETS.map((preset) => {
          const picked = preset.minutes === windowMinutes;

          return (
            <button
              key={preset.minutes}
              type="button"
              onClick={() => {
                setCustomError("");
                onWindowMinutesChange(preset.minutes);
              }}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                picked
                  ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-sky-300 hover:bg-sky-50"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 md:flex-row md:items-start">
        <div className="flex flex-wrap gap-2">
          <input
            type="number"
            min={1}
            value={customAmount}
            onChange={(event) => setCustomAmount(event.target.value)}
            className="h-10 w-28 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            aria-label="カスタム影響時間"
          />
          <select
            value={customUnit}
            onChange={(event) => setCustomUnit(event.target.value as CustomUnit)}
            className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            aria-label="カスタム影響時間の単位"
          >
            <option value="minutes">分</option>
            <option value="hours">時間</option>
            <option value="days">日</option>
          </select>
          <button
            type="button"
            onClick={applyCustomImpactTime}
            className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            カスタム適用
          </button>
        </div>
        {customError ? (
          <p className="text-sm text-red-600">{customError}</p>
        ) : (
          <p className="text-sm text-zinc-500">最大30日まで指定できます。</p>
        )}
      </div>
    </section>
  );
}
