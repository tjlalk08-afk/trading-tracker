"use client";

import { useMemo, useState } from "react";

type Member = {
  id: string;
  name: string;
};

type Props = {
  members: Member[];
};

type RequestType = "deposit" | "withdrawal" | "transfer";

export default function InvestorRequestForms({ members }: Props) {
  const [openType, setOpenType] = useState<RequestType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const defaultMemberId = useMemo(() => members[0]?.id ?? "", [members]);

  const [memberId, setMemberId] = useState(defaultMemberId);
  const [amount, setAmount] = useState("");
  const [targetMemberId, setTargetMemberId] = useState("");
  const [note, setNote] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!openType) return;

    setSubmitting(true);
    setMessage("");

    try {
      const res = await fetch("/api/investor-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          request_type: openType,
          amount: amount ? Number(amount) : null,
          target_member_id: openType === "transfer" ? targetMemberId || null : null,
          note: note || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to submit request");
      }

      setMessage("Request submitted.");
      setAmount("");
      setTargetMemberId("");
      setNote("");
      setOpenType(null);
      window.location.reload();
    } catch (err: any) {
      setMessage(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setOpenType("deposit")}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/15"
        >
          Request Deposit
        </button>

        <button
          onClick={() => setOpenType("withdrawal")}
          className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-300 hover:bg-yellow-500/15"
        >
          Request Withdrawal
        </button>

        <button
          onClick={() => setOpenType("transfer")}
          className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/15"
        >
          Request Transfer
        </button>
      </div>

      {openType && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-4 text-lg font-semibold capitalize">
            {openType} Request
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-neutral-400">Member</label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-neutral-400">Amount</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
              />
            </div>

            {openType === "transfer" && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-neutral-400">Transfer To</label>
                <select
                  value={targetMemberId}
                  onChange={(e) => setTargetMemberId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
                >
                  <option value="">Select target member</option>
                  {members
                    .filter((m) => m.id !== memberId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-neutral-400">Note</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Optional note"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>

              <button
                type="button"
                onClick={() => setOpenType(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>

            {message && (
              <div className="md:col-span-2 text-sm text-neutral-300">
                {message}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}