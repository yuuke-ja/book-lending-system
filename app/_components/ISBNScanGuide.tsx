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
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm text-zinc-700">
          978もしくは979から始まるバーコードを読み取ってください。
        </p>

        <div className="mt-4 flex flex-col items-center gap-4">
          <div className="w-fit max-w-full rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <Barcode />
            <p className="mt-2 text-center font-mono text-xs tracking-[0.2em] text-zinc-500">
              978 / 979
            </p>
          </div>
          <div className="w-fit max-w-full rounded-lg border border-amber-200 bg-amber-50 p-3">
            <Barcode />
            <p className="mt-2 text-center font-mono text-xs tracking-[0.2em] text-zinc-500">

            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm text-zinc-700">
          雑誌は491から始まるJANコードを読み取ってください。
        </p>

        <div className="mt-4 flex justify-center">
          <div className="w-fit max-w-full rounded-lg border border-amber-200 bg-amber-50 p-3">
            <Barcode />
            <p className="mt-2 text-center font-mono text-xs tracking-[0.2em] text-zinc-500">
              491
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
