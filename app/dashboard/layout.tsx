"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import GlobalRefreshSnapshotButton from "@/components/GlobalRefreshSnapshotButton";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/live", label: "Live" },
  { href: "/dashboard/paper", label: "Paper" },
  { href: "/dashboard/trades", label: "Trades" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/investors", label: "Investors" },
];

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/live", label: "Live" },
  { href: "/dashboard/paper", label: "Paper" },
  { href: "/dashboard/trades", label: "Trades" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/investors", label: "Investors" },
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
    <div className="min-h-screen bg-[#0b1016] text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(60,163,123,0.08),transparent_20%),radial-gradient(circle_at_left,rgba(59,130,246,0.05),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%,transparent_76%,rgba(255,255,255,0.012))]" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.15) 45%, rgba(0,0,0,0))",
          }}
        />
      </div>

      <div className="relative z-10">
        <header className="sticky top-0 z-40 border-b border-slate-700/40 bg-[#0b1016]/86 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1880px] flex-col gap-2.5 px-3 py-2.5 sm:px-4 sm:py-3 xl:flex-row xl:items-center xl:justify-between xl:px-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(60,163,123,0.28)] bg-[rgba(60,163,123,0.12)] text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  TD
                </div>

                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">
                    Automated Fund Monitor
                  </div>
                  <div className="mt-0.5 text-lg font-semibold tracking-[0.05em] text-slate-100 sm:text-[1.45rem]">
                    Trading Desk
                  </div>
                </div>
              </div>

              <div className="hidden h-12 w-px bg-slate-700/40 xl:block" />

              <div className="hidden rounded-full border border-[rgba(60,163,123,0.22)] bg-[rgba(60,163,123,0.08)] px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] text-[var(--accent-strong)] xl:block">
                Operator + Investor View
              </div>
            </div>

            <div className="hidden xl:flex xl:min-w-[260px] xl:justify-end">
              <div className="rounded-xl border border-slate-700/40 bg-slate-900/50 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  Operating Mode
                </div>
                <div className="mt-1 text-[13px] font-medium text-slate-200">
                  Performance oversight, symbol governance, investor reporting
                </div>
              </div>
            </div>

            <nav className="hidden xl:flex xl:items-center xl:gap-2">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "shrink-0 rounded-xl px-3.5 py-2 text-[13px] font-medium transition",
                      active
                        ? "border border-[rgba(60,163,123,0.24)] bg-[rgba(60,163,123,0.1)] text-[var(--accent-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        : "border border-slate-700/40 bg-slate-900/45 text-slate-300 hover:border-slate-600/50 hover:bg-slate-800/65 hover:text-slate-100",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-[1880px] px-3 py-3 pb-24 sm:px-4 sm:py-4 sm:pb-24 xl:px-5 xl:py-5 xl:pb-8">
          {children}
        </main>

        <GlobalRefreshSnapshotButton />

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-700/40 bg-[#0b1016]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 backdrop-blur-xl xl:hidden">
          <div className="mx-auto grid max-w-[1880px] grid-cols-5 gap-2">
            {MOBILE_NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex min-h-10 items-center justify-center rounded-xl px-2 text-[10px] font-medium transition",
                    active
                      ? "border border-[rgba(60,163,123,0.24)] bg-[rgba(60,163,123,0.1)] text-[var(--accent-strong)]"
                      : "border border-slate-700/40 bg-slate-900/45 text-slate-300",
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
