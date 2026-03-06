"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: number | string;
  symbol: string;
  enabled: boolean;
  notes: string | null;
};

export default function SymbolsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/symbols", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load symbols");
      }

      const data: Row[] = json.data ?? [];
      setRows(data);

      const drafts: Record<string, string> = {};
      for (const row of data) {
        drafts[String(row.id)] = row.notes ?? "";
      }
      setNoteDrafts(drafts);
    } catch (err: any) {
      setError(err?.message || "Failed to load symbols");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addSymbol() {
    const s = symbol.trim().toUpperCase();
    if (!s) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/symbols", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: s }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to add symbol");
      }

      setSymbol("");
      setMessage(`${s} added`);
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to add symbol");
    } finally {
      setLoading(false);
    }
  }

  async function toggle(id: number | string, enabled: boolean) {
    setBusyId(id);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/symbols", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to update symbol");
      }

      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to update symbol");
    } finally {
      setBusyId(null);
    }
  }

  async function saveNotes(id: number | string) {
    setBusyId(id);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/symbols", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          notes: noteDrafts[String(id)] ?? "",
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to save notes");
      }

      setMessage("Notes saved");
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to save notes");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number | string) {
    setBusyId(id);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/symbols?id=${encodeURIComponent(String(id))}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to remove symbol");
      }

      setMessage("Symbol removed");
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to remove symbol");
    } finally {
      setBusyId(null);
    }
  }

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [rows]
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">Symbols</div>
        <div className="text-sm opacity-70">Manage your bot watchlist.</div>
      </div>

      <div className="flex gap-3">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addSymbol();
          }}
          placeholder="SPY, NVDA, META..."
          className="w-64 rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
        />
        <button
          onClick={addSymbol}
          disabled={loading}
          className="rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-4 py-2 hover:bg-emerald-500/25 disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-3 text-xs uppercase tracking-wider opacity-70 border-b border-white/10">
          <div className="col-span-2">Symbol</div>
          <div className="col-span-2">Enabled</div>
          <div className="col-span-6">Notes</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {sortedRows.length === 0 ? (
          <div className="px-4 py-6 opacity-70">No symbols yet.</div>
        ) : (
          sortedRows.map((r) => (
            <div
              key={String(r.id)}
              className="grid grid-cols-12 px-4 py-3 border-b border-white/5 items-center gap-2"
            >
              <div className="col-span-2 font-semibold">{r.symbol}</div>

              <div className="col-span-2">
                <button
                  onClick={() => toggle(r.id, !r.enabled)}
                  disabled={busyId === r.id}
                  className={`rounded-lg px-3 py-1 border disabled:opacity-50 ${
                    r.enabled
                      ? "border-emerald-400/30 bg-emerald-500/15"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {r.enabled ? "ON" : "OFF"}
                </button>
              </div>

              <div className="col-span-6 flex gap-2">
                <input
                  value={noteDrafts[String(r.id)] ?? ""}
                  onChange={(e) =>
                    setNoteDrafts((prev) => ({
                      ...prev,
                      [String(r.id)]: e.target.value,
                    }))
                  }
                  placeholder="Notes..."
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none text-sm"
                />
                <button
                  onClick={() => saveNotes(r.id)}
                  disabled={busyId === r.id}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                >
                  Save
                </button>
              </div>

              <div className="col-span-2 text-right">
                <button
                  onClick={() => remove(r.id)}
                  disabled={busyId === r.id}
                  className="text-sm opacity-70 hover:opacity-100 disabled:opacity-50"
                >
                  remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}