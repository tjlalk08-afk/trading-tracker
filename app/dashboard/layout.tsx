import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-neutral-200">
      {/* Top Nav */}
      <nav className="flex items-center justify-between px-10 py-5 border-b border-neutral-800">
        <div className="text-xl font-semibold tracking-widest">TRADING DESK</div>

        <div className="flex gap-8 text-sm uppercase tracking-wider">
          <Link href="/dashboard" className="hover:text-emerald-400">
            Overview
          </Link>

          <Link href="/dashboard/strategy" className="hover:text-emerald-400">
            Strategy
          </Link>

          <Link href="/dashboard/symbols" className="hover:text-emerald-400">
            Symbols
          </Link>

          <Link href="/dashboard/compare" className="hover:text-emerald-400">
            Compare
          </Link>

          <Link
            href="/dashboard/performance"
            className="hover:text-emerald-400"
          >
            Performance
          </Link>

          <Link href="/dashboard/bot" className="hover:text-emerald-400">
            Bot
          </Link>
        </div>
      </nav>

      {/* Page Content */}
      <div className="p-12">{children}</div>
    </div>
  );
}