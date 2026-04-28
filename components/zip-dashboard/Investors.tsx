"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Users, UserPlus, DollarSign } from "lucide-react";
import { loadInvestorPnl, money, pnlClass, type InvestorPnlData } from "./data";

export default function Investors() {
  const [data, setData] = useState<InvestorPnlData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        setData(await loadInvestorPnl(controller.signal));
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load investors.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const avgReturn = useMemo(() => {
    const valid = rows.map((row) => row.returnPct).filter((value): value is number => value !== null && Number.isFinite(value));
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
  }, [rows]);

  if (loading) return <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900 p-8 text-zinc-400">Loading real investor data...</div>;
  if (error) return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-red-300">{error}</div>;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">Investor Management</h1>
          <p className="text-zinc-400">Track real investor capital and returns</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors font-semibold">
          <UserPlus className="w-5 h-5" />
          Add Investor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard icon={Users} title="Total Investors" value={String(rows.length)} sub="Active accounts" tone="text-blue-400" />
        <SummaryCard icon={DollarSign} title="Total Capital" value={money(data?.netContributedCapital)} sub="Net contributed capital" tone="text-emerald-400" />
        <SummaryCard icon={DollarSign} title="Average Return" value={`${avgReturn.toFixed(2)}%`} sub="Across all investors" tone={pnlClass(avgReturn)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {rows.map((investor, idx) => (
          <motion.div key={investor.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * idx }} whileHover={{ y: -4 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-zinc-700/50 shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300">
            <div className="flex items-start justify-between mb-6">
              <div><div className="text-2xl font-bold mb-1">{investor.name}</div><div className="text-sm text-zinc-400">Share: {investor.ownershipPct.toFixed(2)}%</div></div>
              <div className="w-12 h-12 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-full flex items-center justify-center"><Users className="w-6 h-6 text-zinc-400" /></div>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-zinc-800/50 rounded-xl"><div className="text-xs text-zinc-400 mb-1">Net Cash Contributed</div><div className="text-2xl font-bold">{money(investor.netCashContributed)}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-800/50 rounded-xl"><div className="text-xs text-zinc-400 mb-1">Current Equity</div><div className="text-lg font-bold">{money(investor.currentValue)}</div></div>
                <div className="p-3 bg-zinc-800/50 rounded-xl"><div className="text-xs text-zinc-400 mb-1">Units</div><div className="text-lg font-bold text-emerald-400">{investor.totalUnits.toFixed(4)}</div></div>
              </div>
              <div className="h-px bg-zinc-700" />
              <div className="flex justify-between items-center"><span className="text-sm text-zinc-400">Total P/L</span><span className={`font-bold ${pnlClass(investor.pnlDollar)}`}>{money(investor.pnlDollar)}</span></div>
              <div className="p-4 bg-gradient-to-r from-zinc-800 to-zinc-900 rounded-xl border border-zinc-700"><div className="text-xs text-zinc-400 mb-1">Return on Investment</div><div className={`text-2xl font-bold ${pnlClass(investor.returnPct ?? 0)}`}>{investor.returnPct == null ? "-" : `${investor.returnPct.toFixed(2)}%`}</div></div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-8 border border-zinc-700/50 shadow-2xl">
        <h3 className="text-2xl font-bold mb-6">Investor Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-zinc-700">{["Name", "Net Cash", "Share", "Current Equity", "Granted Units", "Total Units", "Total P/L", "Returns"].map((head) => <th key={head} className="text-left py-4 px-4 text-sm text-zinc-400 font-medium">{head}</th>)}</tr></thead>
            <tbody>
              {rows.map((investor) => (
                <tr key={investor.id} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                  <td className="py-5 px-4 font-bold text-lg">{investor.name}</td><td className="py-5 px-4 text-zinc-300">{money(investor.netCashContributed)}</td><td className="py-5 px-4 text-zinc-300">{investor.ownershipPct.toFixed(2)}%</td><td className="py-5 px-4 text-zinc-300 font-semibold">{money(investor.currentValue)}</td><td className="py-5 px-4 text-zinc-300">{investor.grantedUnits.toFixed(4)}</td><td className="py-5 px-4 text-zinc-300">{investor.totalUnits.toFixed(4)}</td><td className={`py-5 px-4 font-bold ${pnlClass(investor.pnlDollar)}`}>{money(investor.pnlDollar)}</td><td className={`py-5 px-4 font-bold text-lg ${pnlClass(investor.returnPct ?? 0)}`}>{investor.returnPct == null ? "-" : `${investor.returnPct.toFixed(2)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function SummaryCard({ icon: Icon, title, value, sub, tone }: { icon: typeof Users; title: string; value: string; sub: string; tone: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-zinc-700/50 shadow-2xl">
      <div className="flex items-start justify-between mb-4"><div className="p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl"><Icon className={`w-6 h-6 ${tone}`} /></div></div>
      <div className="text-zinc-400 text-sm mb-2">{title}</div><div className={`text-3xl font-bold ${tone}`}>{value}</div><div className="text-xs text-zinc-400 mt-1">{sub}</div>
    </motion.div>
  );
}
