"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GlobalRefreshSnapshotButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRefresh() {
    try {
      setLoading(true);

      const res = await fetch("/api/ingest/brother-dashboard", {
        method: "POST",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to refresh snapshot");
      }

      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to refresh snapshot");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      className="fixed bottom-20 right-4 z-50 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-3 text-sm font-medium text-white shadow-lg backdrop-blur hover:bg-emerald-500/25 disabled:opacity-50 sm:bottom-6 sm:right-6"
    >
      {loading ? "Refreshing..." : "Pull Snapshot"}
    </button>
  );
}
