type SectionLoadingFallbackProps = {
  label: string;
  title: string;
  message?: string;
};

export default function SectionLoadingFallback({
  label,
  title,
  message = "読み込み中...",
}: SectionLoadingFallbackProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500">
          {label}
        </p>
        <h3 className="mt-1 text-lg font-semibold text-zinc-900">{title}</h3>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        {message}
      </div>
    </section>
  );
}
