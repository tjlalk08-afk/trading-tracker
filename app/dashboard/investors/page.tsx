import Link from "next/link";
import { getInvestorPnlData } from "@/lib/getInvestorPnlData";
import InvestorRequestForms from "@/components/InvestorRequestForms";

function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtPct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function statusClass(status: string) {
  if (status === "pending") return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
  if (status === "approved") return "bg-cyan-500/10 text-cyan-300 border-cyan-500/20";
  if (status === "completed") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  if (status === "rejected") return "bg-red-500/10 text-red-300 border-red-500/20";
  return "bg-white/5 text-neutral-300 border-white/10";
}

export default async function InvestorsPage() {
  const data = await getInvestorPnlData();

  const pendingRequests = data.requests.filter((r) => r.status === "pending");
  const latestRequests = data.requests.slice(0, 8);
  const latestTransactions = data.transactions.slice(-8).reverse();

  return (
    <div className="space-y-8">
      <section className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">Investor P/L</h1>
          <p className="max-w-2xl text-sm text-neutral-400">
            Units-based ownership with deposits, withdrawals, grants, and investor capital requests.
          </p>
        </div>

        <Link
          href="/dashboard/investors/admin"
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
        >
          Open Admin Queue
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_0_40px_rgba(16,185,129,0.05)]">
          <div className="text-sm text-neutral-400">Fund Equity</div>
          <div className="mt-2 text-4xl font-semibold">{fmtMoney(data.totalEquity)}</div>
          <div className="mt-2 text-xs text-neutral-500">Latest dashboard snapshot</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-neutral-400">Total Units</div>
          <div className="mt-2 text-4xl font-semibold">{data.totalUnits.toFixed(2)}</div>
          <div className="mt-2 text-xs text-neutral-500">Ownership base across all members</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-neutral-400">Unit Price</div>
          <div className="mt-2 text-4xl font-semibold">{fmtMoney(data.unitPrice)}</div>
          <div className="mt-2 text-xs text-neutral-500">Fund equity ÷ total units</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-neutral-400">Net Contributed Capital</div>
          <div className="mt-2 text-4xl font-semibold">{fmtMoney(data.netContributedCapital)}</div>
          <div className="mt-2 text-xs text-neutral-500">Cash in minus withdrawals</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-neutral-400">Pending Requests</div>
          <div className="mt-2 text-4xl font-semibold">{pendingRequests.length}</div>
          <div className="mt-2 text-xs text-neutral-500">Awaiting review or completion</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <div className="text-xl font-semibold">Capital Actions</div>
            <div className="mt-1 text-sm text-neutral-400">
              Submit investor requests for deposits, withdrawals, or transfers.
            </div>
          </div>

          <InvestorRequestForms
            members={data.members.map((m) => ({ id: m.id, name: m.name }))}
          />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-xl font-semibold">Request Queue</div>
          <div className="mt-1 text-sm text-neutral-400">
            Recent investor requests and current status.
          </div>

          <div className="mt-4 space-y-3">
            {latestRequests.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-neutral-400">
                No requests yet.
              </div>
            ) : (
              latestRequests.map((req) => {
                const member = data.members.find((m) => m.id === req.member_id);
                const target = data.members.find((m) => m.id === req.target_member_id);

                return (
                  <div
                    key={req.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {member?.name ?? "Unknown"} · {req.request_type}
                        </div>
                        <div className="mt-1 text-sm text-neutral-400">
                          {req.amount != null ? fmtMoney(req.amount) : "—"}
                          {req.request_type === "transfer" && target
                            ? ` → ${target.name}`
                            : ""}
                        </div>
                        {req.note && (
                          <div className="mt-2 text-sm text-neutral-500">{req.note}</div>
                        )}
                      </div>

                      <div
                        className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${statusClass(req.status)}`}
                      >
                        {req.status}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="text-xl font-semibold">Ownership Table</div>
          <div className="mt-1 text-sm text-neutral-400">
            Live member ownership based on current unit pricing.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-black/30 text-neutral-400">
              <tr>
                <th className="px-4 py-4 text-left">Name</th>
                <th className="px-4 py-4 text-left">Role</th>
                <th className="px-4 py-4 text-right">Net Contributions</th>
                <th className="px-4 py-4 text-right">Granted Units</th>
                <th className="px-4 py-4 text-right">Total Units</th>
                <th className="px-4 py-4 text-right">Ownership</th>
                <th className="px-4 py-4 text-right">Current Value</th>
                <th className="px-4 py-4 text-right">P/L</th>
                <th className="px-4 py-4 text-right">Return</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-t border-white/10 hover:bg-white/[0.03]">
                  <td className="px-4 py-4 font-medium">{row.name}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wide text-neutral-300">
                      {row.role}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">{fmtMoney(row.netCashContributed)}</td>
                  <td className="px-4 py-4 text-right">{row.grantedUnits.toFixed(2)}</td>
                  <td className="px-4 py-4 text-right">{row.totalUnits.toFixed(2)}</td>
                  <td className="px-4 py-4 text-right">{fmtPct(row.ownershipPct)}</td>
                  <td className="px-4 py-4 text-right">{fmtMoney(row.currentValue)}</td>
                  <td className="px-4 py-4 text-right">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        row.pnlDollar >= 0
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-red-500/10 text-red-300"
                      }`}
                    >
                      {fmtMoney(row.pnlDollar)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {row.returnPct === null ? "—" : fmtPct(row.returnPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="text-xl font-semibold">Recent Capital Requests</div>
            <div className="mt-1 text-sm text-neutral-400">
              Latest deposit, withdrawal, and transfer requests.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-black/30 text-neutral-400">
                <tr>
                  <th className="px-4 py-4 text-left">Member</th>
                  <th className="px-4 py-4 text-left">Type</th>
                  <th className="px-4 py-4 text-right">Amount</th>
                  <th className="px-4 py-4 text-left">Status</th>
                  <th className="px-4 py-4 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {latestRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-neutral-400">
                      No requests yet.
                    </td>
                  </tr>
                ) : (
                  latestRequests.map((req) => {
                    const member = data.members.find((m) => m.id === req.member_id);
                    return (
                      <tr key={req.id} className="border-t border-white/10 hover:bg-white/[0.03]">
                        <td className="px-4 py-4">{member?.name ?? "Unknown"}</td>
                        <td className="px-4 py-4 capitalize">{req.request_type}</td>
                        <td className="px-4 py-4 text-right">
                          {req.amount == null ? "—" : fmtMoney(req.amount)}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium uppercase ${statusClass(req.status)}`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-neutral-400">
                          {new Date(req.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="text-xl font-semibold">Recent Posted Transactions</div>
            <div className="mt-1 text-sm text-neutral-400">
              Completed capital activity that already affected ownership.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-black/30 text-neutral-400">
                <tr>
                  <th className="px-4 py-4 text-left">Member</th>
                  <th className="px-4 py-4 text-left">Type</th>
                  <th className="px-4 py-4 text-right">Amount</th>
                  <th className="px-4 py-4 text-right">Units</th>
                  <th className="px-4 py-4 text-left">When</th>
                </tr>
              </thead>
              <tbody>
                {latestTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-neutral-400">
                      No transactions yet.
                    </td>
                  </tr>
                ) : (
                  latestTransactions.map((txn) => {
                    const member = data.members.find((m) => m.id === txn.member_id);
                    return (
                      <tr key={txn.id} className="border-t border-white/10 hover:bg-white/[0.03]">
                        <td className="px-4 py-4">{member?.name ?? "Unknown"}</td>
                        <td className="px-4 py-4 capitalize">{txn.txn_type}</td>
                        <td className="px-4 py-4 text-right">{fmtMoney(txn.amount)}</td>
                        <td className="px-4 py-4 text-right">{txn.units.toFixed(2)}</td>
                        <td className="px-4 py-4 text-neutral-400">
                          {new Date(txn.effective_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}