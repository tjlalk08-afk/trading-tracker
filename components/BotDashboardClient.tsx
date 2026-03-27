"use client";

import { useEffect, useMemo, useState } from "react";

type BotDashboardData = Record<string, unknown>;

type BotPayload = {
  ok: boolean;
  data?: BotDashboardData;
  ts?: string;
  error?: string;
  status?: number;
};

export default function BotDashboardClient({ initial }: { initial: BotPayload }) {
  const [, setPayload] = useState<BotPayload>(initial);
  const [tick, setTick] = useState(0);

  // Your legacy UI URL (the one that shows the full dashboard)
  const legacyUrl = useMemo(() => {
    // keep your theme param if you want; otherwise remove
    return "https://dashboard.ngtdashboard.com/dashboard";
  }, []);

  // If you still want your app to poll the JSON endpoint to show status badges later
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bot/dashboard", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setPayload(json);
      } catch (error: unknown) {
        if (!cancelled) {
          setPayload({
            ok: false,
            error: error instanceof Error ? error.message : "fetch failed",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <div className="space-y-4">
      {/* Small header that matches your app (no extra links) */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-semibold">Bot Dashboard</div>
          <div className="text-sm opacity-70">
            Live legacy UI embedded inside the app
          </div>
        </div>
        {/* removed "open in new tab" */}
      </div>

      {/* Embed container */}
      <div className="rounded-2xl border border-white/10 bg-black/30 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_30px_80px_rgba(0,0,0,0.55)] overflow-hidden">
        {/* keep aspect + height comfortable */}
        <div className="w-full h-[780px]">
          <iframe
            src={legacyUrl}
            className="w-full h-full"
            style={{
              border: 0,
              background: "transparent",
            }}
            allow="clipboard-read; clipboard-write"
          />
        </div>
      </div>
    </div>
  );
}
