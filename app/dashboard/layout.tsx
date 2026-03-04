import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-neutral-100 relative overflow-hidden">
      {/* Background to match the embedded dashboard vibe */}
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 opacity-80 bg-[radial-gradient(1000px_500px_at_20%_10%,rgba(0,255,200,0.18),transparent_60%),radial-gradient(900px_500px_at_80%_20%,rgba(80,100,255,0.16),transparent_60%),radial-gradient(900px_700px_at_50%_90%,rgba(0,150,255,0.10),transparent_60%)]" />
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_55%)]" />

      {/* Content */}
      <div className="relative">
        <nav className="flex items-center justify-between px-12 py-6 border-b border-white/10 bg-black/30 backdrop-blur">
          <div className="text-xl font-semibold tracking-widest">TRADING DESK</div>

          <div className="flex gap-8 text-sm uppercase tracking-wider">
            <Link href="/dashboard" className="opacity-80 hover:opacity-100">
              Overview
            </Link>
            <Link href="/dashboard/strategy" className="opacity-80 hover:opacity-100">
              Strategy
            </Link>
            <Link href="/dashboard/symbols" className="opacity-80 hover:opacity-100">
              Symbols
            </Link>
            <Link href="/dashboard/compare" className="opacity-80 hover:opacity-100">
              Compare
            </Link>
            <Link href="/dashboard/performance" className="opacity-80 hover:opacity-100">
              Performance
            </Link>
            <Link href="/dashboard/bot" className="opacity-80 hover:opacity-100">
              Bot
            </Link>
          </div>
        </nav>

        <div className="px-12 py-10">{children}</div>
      </div>
    </div>
  );
}