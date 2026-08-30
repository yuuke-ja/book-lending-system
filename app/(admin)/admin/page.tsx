import {
  ArrowLeft,
  BarChart2,
  Bell,
  BookOpen,
  CalendarDays,
  Folder,
  History,
  Search,
  Tags,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

const adminMenu: {
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
}[] = [
  {
    label: "本登録",
    href: "/admin/registration",
    icon: BookOpen,
    color: "border-blue-100 bg-blue-50 text-blue-600",
  },
  {
    label: "本一覧",
    href: "/admin/books",
    icon: Folder,
    color: "border-indigo-100 bg-indigo-50 text-indigo-600",
  },
  {
    label: "ジャンル管理",
    href: "/admin/tags",
    icon: Tags,
    color: "border-purple-100 bg-purple-50 text-purple-600",
  },
  {
    label: "貸出ルール",
    href: "/admin/loan-settings",
    icon: CalendarDays,
    color: "border-orange-100 bg-orange-50 text-orange-600",
  },
  {
    label: "お知らせ管理",
    href: "/admin/notices",
    icon: Bell,
    color: "border-pink-100 bg-pink-50 text-pink-600",
  },
  {
    label: "貸出・利用状況",
    href: "/admin/statistics",
    icon: BarChart2,
    color: "border-emerald-100 bg-emerald-50 text-emerald-600",
  },
  {
    label: "分析",
    href: "/admin/events",
    icon: TrendingUp,
    color: "border-amber-100 bg-amber-50 text-amber-600",
  },
  {
    label: "貸出履歴",
    href: "/admin/history",
    icon: History,
    color: "border-rose-100 bg-rose-50 text-rose-600",
  },
  {
    label: "検索履歴",
    href: "/admin/seachhistory",
    icon: Search,
    color: "border-sky-100 bg-sky-50 text-sky-600",
  },
];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#f0f4f8] pb-16 text-slate-900">
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 sm:pt-10">
        <header className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">
                管理者ダッシュボード
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                システムの各種設定やデータ管理を直感的に行えます。
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              トップページに戻る
            </Link>
          </div>

          <nav className="mt-8 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
            {adminMenu.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex min-h-24 flex-col items-center justify-center gap-2.5 rounded-xl border border-slate-100 bg-white p-4 text-center transition hover:border-blue-200 hover:bg-blue-50/30"
                >
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-transform group-hover:scale-105 ${item.color}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-bold text-slate-700 group-hover:text-slate-950">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </header>
      </div>
    </main>
  );
}
