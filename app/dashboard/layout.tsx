"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Briefcase,
  LayoutDashboard,
  Menu,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import GlobalRefreshSnapshotButton from "@/components/GlobalRefreshSnapshotButton";
import { loadLatest, money, signedMoney, type Snapshot } from "@/components/zip-dashboard/data";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/positions", label: "Positions", icon: Briefcase },
  { href: "/dashboard/trades", label: "Trades", icon: Activity },
  { href: "/dashboard/investors", label: "Investors", icon: Users },
  { href: "/dashboard/performance", label: "Performance", icon: TrendingUp },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [latest, setLatest] = useState<Snapshot | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadLatest(controller.signal)
      .then(setLatest)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const nav = (
    <nav className="flex-1 space-y-2 px-4">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={[
              "group flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-300",
              active
                ? "border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 shadow-[0_12px_30px_rgba(16,185,129,0.08),inset_0_1px_0_rgba(255,255,255,0.05)]"
                : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-800/50 hover:text-white",
            ].join(" ")}
          >
            <Icon className={["h-5 w-5 shrink-0", active ? "text-emerald-300" : "text-zinc-500 group-hover:text-white"].join(" ")} />
            <span>{item.label}</span>
            {active ? <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.7)]" /> : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-zinc-800 bg-gradient-to-b from-zinc-900 to-black lg:flex">
          <div className="p-8">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-[0_0_30px_rgba(16,185,129,0.18)]">
                <TrendingUp className="h-6 w-6 text-black" />
              </div>
              <div>
                <div className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-xl font-bold text-transparent">
                  TradeDash
                </div>
                <div className="text-xs text-zinc-500">Professional Trading</div>
              </div>
            </Link>
          </div>

          {nav}

          <div className="border-t border-zinc-800 p-6">
            <div className="rounded-xl border border-zinc-700 bg-gradient-to-br from-zinc-800 to-zinc-900 p-4">
              <div className="text-sm text-zinc-400 mb-1">Account Balance</div>
              <div className="text-2xl font-bold text-white">{money(latest?.equity)}</div>
              <div className="text-xs text-emerald-400 mt-1">{signedMoney(latest?.total_pl)} today</div>
            </div>
          </div>
        </aside>

        <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800 bg-black/95 backdrop-blur-lg lg:hidden">
          <div className="flex items-center justify-between p-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500">
                <TrendingUp className="h-5 w-5 text-black" />
              </div>
              <div className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-lg font-bold text-transparent">
                TradeDash
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
              aria-label={mobileMenuOpen ? "Close dashboard menu" : "Open dashboard menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </header>

        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label="Close dashboard menu"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="absolute inset-y-0 right-0 flex w-72 max-w-[82vw] flex-col border-l border-zinc-800 bg-gradient-to-b from-zinc-900 to-black pt-20 shadow-2xl">
              {nav}
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-[1600px] px-4 pb-8 pt-20 sm:px-6 lg:px-8 lg:pt-8">
            {children}
          </div>
        </main>

        <GlobalRefreshSnapshotButton />
      </div>
    </div>
  );
}
