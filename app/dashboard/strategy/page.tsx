export default function StrategyPage() {
  return (
    <>
      <h1 className="text-3xl font-bold mb-10 tracking-wide">
        SPY Strategy v1
      </h1>

      {/* Mode Indicators */}
      <div className="flex gap-6 mb-12">
        <div className="bg-emerald-500 px-4 py-2 text-black text-xs font-bold rounded-md">
          LIVE
        </div>

        <div className="bg-sky-500 px-4 py-2 text-black text-xs font-bold rounded-md">
          PAPER
        </div>
      </div>

      {/* Placeholder */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-10 text-neutral-500 text-center">
        No trades executed yet.
      </div>
    </>
  );
}