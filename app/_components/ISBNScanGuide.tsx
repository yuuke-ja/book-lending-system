const barcodeBars = [
  3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2,
  1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4,
];

function Barcode() {
  return (
    <div className="flex h-14 items-end justify-center gap-px">
      {barcodeBars.map((width, index) => (
        <span
          key={`${width}-${index}`}
          className="block h-full rounded-[1px] bg-zinc-900"
          style={{ width: `${width}px` }}
        />
      ))}
    </div>
  );
}

export default function ISBNScanGuide() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm text-zinc-700">
        978もしくは979から始まりバーコードを読み取ってください。
      </p>

      <div className="mt-4 flex justify-center">

        <div className="space-y-4">
          <div className="w-fit max-w-full rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <Barcode />
            <p className="mt-2 text-center font-mono text-xs tracking-[0.2em] text-zinc-500">
              978 / 979
            </p>
          </div>

          <div className="w-fit max-w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <Barcode />
          </div>
        </div>

      </div>
    </section>
  );
}
