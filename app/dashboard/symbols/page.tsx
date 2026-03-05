"use client";

import { useEffect, useState } from "react";

type Row = { id: number; symbol: string; enabled: boolean; notes: string | null };

export default function SymbolsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/symbols", { cache: "no-store" });
    const json = await res.json();
    setRows(json?.data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addSymbol() {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    setLoading(true);
    await fetch("/api/symbols", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol: s }),
    });
    setSymbol("");
    await load();
    setLoading(false);
  }

  async function toggle(id: number, enabled: boolean) {
    await fetch("/api/symbols", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    await load();
  }

  async function remove(id: number) {
    await fetch(`/api/symbols?id=${id}`, { method: "DELETE" });
    await load();
  }

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
          placeholder="SPY, NVDA, META..."
          className="w-64 rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
        />
        <button
          onClick={addSymbol}
          disabled={loading}
          className="rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-4 py-2 hover:bg-emerald-500/25"
        >
          Add
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-3 text-xs uppercase tracking-wider opacity-70 border-b border-white/10">
          <div className="col-span-3">Symbol</div>
          <div className="col-span-2">Enabled</div>
          <div className="col-span-5">Notes</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-6 opacity-70">No symbols yet.</div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-12 px-4 py-3 border-b border-white/5 items-center"
            >
              <div className="col-span-3 font-semibold">{r.symbol}</div>

              <div className="col-span-2">
                <button
                  onClick={() => toggle(r.id, !r.enabled)}
                  className={`rounded-lg px-3 py-1 border ${
                    r.enabled
                      ? "border-emerald-400/30 bg-emerald-500/15"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {r.enabled ? "ON" : "OFF"}
                </button>
              </div>

              <div className="col-span-5 text-sm opacity-80">{r.notes ?? "—"}</div>

              <div className="col-span-2 text-right">
                <button
                  onClick={() => remove(r.id)}
                  className="text-sm opacity-70 hover:opacity-100"
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