"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/live", label: "Live" },
  { href: "/dashboard/symbols", label: "Symbols" },
  { href: "/dashboard/compare", label: "Compare" },
  { href: "/dashboard/performance", label: "Performance" },
  { href: "/dashboard/investors", label: "Investors" },
  { href: "/dashboard/bot", label: "Bot" },
];

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/live", label: "Live" },
  { href: "/dashboard/symbols", label: "Symbols" },
  { href: "/dashboard/performance", label: "Perf" },
  { href: "/dashboard/bot", label: "Bot" },
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

  return (
    <div className="min-h-screen bg-[#05080d] text-neutral-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_24%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.10),transparent_24%),radial-gradient(circle_at_bottom_center,rgba(99,102,241,0.08),transparent_32%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent_20%,transparent_80%,rgba(255,255,255,0.01))]" />
      </div>

      <div className="relative z-10">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05080d]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1880px] flex-col gap-2.5 px-4 py-3 sm:px-5 xl:flex-row xl:items-center xl:justify-between xl:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">
                  Platform
                </div>
                <div className="mt-1 text-lg font-semibold tracking-[0.12em] text-white sm:text-2xl">
                  TRADING DESK
                </div>
              </div>

              <div className="hidden h-10 w-px bg-white/10 xl:block" />

              <div className="hidden rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300 xl:block">
                Dashboard
              </div>
            </div>

            <nav className="hidden xl:flex xl:items-center xl:gap-1.5">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition",
                      active
                        ? "border border-emerald-400/20 bg-emerald-500/12 text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        : "border border-white/8 bg-white/[0.03] text-white/72 hover:border-white/10 hover:bg-white/[0.05] hover:text-white",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-[1880px] px-4 py-4 pb-24 sm:px-5 sm:py-5 sm:pb-24 xl:px-6 xl:py-6 xl:pb-8">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#05080d]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 backdrop-blur-xl xl:hidden">
          <div className="mx-auto grid max-w-[1880px] grid-cols-5 gap-2">
            {MOBILE_NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex min-h-11 items-center justify-center rounded-xl px-2 text-[11px] font-medium transition",
                    active
                      ? "border border-emerald-400/20 bg-emerald-500/12 text-emerald-300"
                      : "border border-white/8 bg-white/[0.03] text-white/68",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
