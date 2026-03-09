import Link from "next/link";
import { getInvestorPnlData } from "@/lib/getInvestorPnlData";
import InvestorRequestAdminActions from "@/components/InvestorRequestAdminActions";
import { requireAdminPage } from "@/lib/requireAdmin";

function fmtMoney(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function statusClass(status: string) {
  if (status === "pending") return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
  if (status === "approved") return "bg-cyan-500/10 text-cyan-300 border-cyan-500/20";
  if (status === "completed") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  if (status === "rejected") return "bg-red-500/10 text-red-300 border-red-500/20";
  return "bg-white/5 text-neutral-300 border-white/10";
}

export default async function InvestorAdminPage() {
  await requireAdminPage();

  const data = await getInvestorPnlData();
  const requests = data.requests;

  return (
    <div className="space-y-8">
      <section className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Investor Admin</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Review, approve, reject, and complete investor capital requests.
          </p>
        </div>

        <Link
          href="/dashboard/investors"
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
        >
          Back to Investors
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-neutral-400">All Requests</div>
          <div className="mt-2 text-4xl font-semibold">{requests.length}</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-neutral-400">Pending</div>
          <div className="mt-2 text-4xl font-semibold">
            {requests.filter((r) => r.status === "pending").length}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-neutral-400">Approved</div>
          <div className="mt-2 text-4xl font-semibold">
            {requests.filter((r) => r.status === "approved").length}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-neutral-400">Completed</div>
          <div className="mt-2 text-4xl font-semibold">
            {requests.filter((r) => r.status === "completed").length}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="text-xl font-semibold">Request Approval Queue</div>
          <div className="mt-1 text-sm text-neutral-400">
            Completing a deposit or withdrawal will post a real transaction using the current unit price.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-black/30 text-neutral-400">
              <tr>
                <th className="px-4 py-4 text-left">Member</th>
                <th className="px-4 py-4 text-left">Type</th>
                <th className="px-4 py-4 text-right">Amount</th>
                <th className="px-4 py-4 text-left">Target</th>
                <th className="px-4 py-4 text-left">Status</th>
                <th className="px-4 py-4 text-left">Note</th>
                <th className="px-4 py-4 text-left">Created</th>
                <th className="px-4 py-4 text-left">Admin Actions</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((req) => {
                const member = data.members.find((m) => m.id === req.member_id);
                const target = data.members.find((m) => m.id === req.target_member_id);

                return (
                  <tr key={req.id} className="border-t border-white/10 hover:bg-white/[0.03]">
                    <td className="px-4 py-4">{member?.name ?? "Unknown"}</td>
                    <td className="px-4 py-4 capitalize">{req.request_type}</td>
                    <td className="px-4 py-4 text-right">{fmtMoney(req.amount)}</td>
                    <td className="px-4 py-4">{target?.name ?? "—"}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium uppercase ${statusClass(req.status)}`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-neutral-400">{req.note ?? "—"}</td>
                    <td className="px-4 py-4 text-neutral-400">
                      {new Date(req.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-4">
                      <InvestorRequestAdminActions
                        requestId={req.id}
                        status={req.status}
                        requestType={req.request_type}
                      />
                    </td>
                  </tr>
                );
              })}

              {requests.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-neutral-400">
                    No investor requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}