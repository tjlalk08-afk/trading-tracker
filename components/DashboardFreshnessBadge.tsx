"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type LatestSnapshotPayload = {
  ok: boolean;
  data?: {
    snapshot_ts?: string;
    created_at?: string;
  } | null;
};

type LivePayload = {
  ok: boolean;
  ts?: string;
};

function timeAgo(dateStr?: string | null) {
  if (!dateStr) return "—";

  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(diffMs)) return "—";

  const secs = Math.floor(diffMs / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;

  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DashboardFreshnessBadge() {
  const pathname = usePathname();
  const isLivePage = pathname === "/dashboard/live";

  const [label, setLabel] = useState(isLivePage ? "Last poll" : "Last snapshot");
  const [value, setValue] = useState("—");

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        if (isLivePage) {
          const res = await fetch("/api/bot/dashboard", { cache: "no-store" });
          const json: LivePayload = await res.json();

          if (!res.ok || !json?.ok) {
            setLabel("Last poll");
            setValue("error");
            return;
          }

          setLabel("Last poll");
          setValue(new Date().toLocaleTimeString());
          return;
        }

        const res = await fetch("/api/dashboard-latest", { cache: "no-store" });
        const json: LatestSnapshotPayload = await res.json();

        if (!res.ok || !json?.ok || !json?.data) {
          setLabel("Last snapshot");
          setValue("—");
          return;
        }

        const ts = json.data.snapshot_ts ?? json.data.created_at ?? null;
        setLabel("Last snapshot");
        setValue(timeAgo(ts));
      } catch {
        setValue("—");
      }
    }

    load();
    timer = setInterval(load, isLivePage ? 1000 : 15000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLivePage]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
      {label}: {value}
    </div>
  );
}