"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshSnapshotButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRefresh() {
    try {
      setLoading(true);

      const res = await fetch("/api/ingest/brother-dashboard", {
        method: "GET",
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
      className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm hover:bg-emerald-500/20 disabled:opacity-50"
    >
      {loading ? "Refreshing..." : "Refresh Snapshot"}
    </button>
  );
}