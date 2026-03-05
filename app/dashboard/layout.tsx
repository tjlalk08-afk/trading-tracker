import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-neutral-200 bg-black">
      {/* background glow */}
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute -top-24 right-0 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      {/* top nav */}
      <nav className="relative z-10 flex items-center justify-between px-10 py-5 border-b border-white/10">
        <div className="text-xl font-semibold tracking-widest">TRADING DESK</div>
        <div className="flex gap-8 text-sm uppercase tracking-wider">
          <Link href="/dashboard" className="hover:text-emerald-300">Overview</Link>
          <Link href="/dashboard/strategy" className="hover:text-emerald-300">Strategy</Link>
          <Link href="/dashboard/symbols" className="hover:text-emerald-300">Symbols</Link>
          <Link href="/dashboard/compare" className="hover:text-emerald-300">Compare</Link>
          <Link href="/dashboard/performance" className="hover:text-emerald-300">Performance</Link>
          <Link href="/dashboard/bot" className="hover:text-emerald-300">Bot</Link>
        </div>
      </nav>

      <main className="relative z-10 px-10 py-8">{children}</main>
    </div>
  );
}