export default function ComparePage() {
  return (
    <>
      <h1 className="text-3xl font-bold mb-10 tracking-wide">
        Live vs Paper
      </h1>

      <div className="grid grid-cols-3 gap-6">
        <Comparison label="Net PnL" live="$0.00" paper="$0.00" />
        <Comparison label="Win Rate" live="0%" paper="0%" />
        <Comparison label="Sharpe" live="0.00" paper="0.00" />
      </div>

      <div className="mt-16 bg-neutral-900 border border-neutral-800 rounded-xl p-10 text-neutral-500 text-center">
        No comparison data yet.
      </div>
    </>
  );
}

function Comparison({
  label,
  live,
  paper,
}: {
  label: string;
  live: string;
  paper: string;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl">
      <p className="text-xs text-neutral-500 uppercase tracking-wider mb-4">
        {label}
      </p>

      <div className="flex justify-between">
        <span className="text-emerald-400 font-semibold">
          LIVE {live}
        </span>
        <span className="text-sky-400 font-semibold">
          PAPER {paper}
        </span>
      </div>
    </div>
  );
}