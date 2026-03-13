"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

type CapitalRequestType = "Deposit" | "Withdrawal" | "Transfer";
type CapitalRequestStatus = "Pending" | "Approved" | "Declined" | "Completed";
type TransactionType = "Deposit" | "Withdrawal" | "Grant" | "Transfer";

type CapitalRequestRow = {
  id: string;
  member: string;
  type: CapitalRequestType;
  amount: number;
  status: CapitalRequestStatus;
  createdAt: string;
  note?: string;
};

type PostedTransactionRow = {
  member: string;
  type: TransactionType;
  amount: number;
  units: number;
  when: string;
};

type InvestorRequestAdminClientProps = {
  initialRequests: CapitalRequestRow[];
  initialPostedTransactions: PostedTransactionRow[];
};

function money(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}

function number2(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
}

function typeBadgeClass(type: TransactionType | CapitalRequestType) {
  if (type === "Deposit") return "border-emerald-400/20 bg-emerald-500/12 text-emerald-300";
  if (type === "Withdrawal") return "border-amber-400/20 bg-amber-500/12 text-amber-300";
  if (type === "Transfer") return "border-cyan-400/20 bg-cyan-500/12 text-cyan-300";
  return "border-white/10 bg-white/[0.05] text-white/75";
}

function statusBadgeClass(status: CapitalRequestStatus) {
  if (status === "Pending") return "border-amber-400/20 bg-amber-500/12 text-amber-300";
  if (status === "Approved" || status === "Completed") {
    return "border-emerald-400/20 bg-emerald-500/12 text-emerald-300";
  }
  return "border-red-400/20 bg-red-500/12 text-red-300";
}

function Surface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-white/10",
        "bg-[linear-gradient(180deg,rgba(18,24,33,0.88),rgba(8,11,17,0.94))]",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_12px_30px_rgba(0,0,0,0.28)]",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.07),transparent_26%),radial-gradient(circle_at_bottom_center,rgba(59,130,246,0.05),transparent_30%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">{children}</div>;
}

function SmallEmptyState({
  title,
  sub,
}: {
  title: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center">
      <div className="text-sm font-medium text-white/80">{title}</div>
      <div className="mt-1 text-sm text-white/45">{sub}</div>
    </div>
  );
}

function ReviewButton({
  children,
  tone,
  onClick,
  disabled,
}: {
  children: ReactNode;
  tone: "approve" | "decline";
  onClick: () => void;
  disabled?: boolean;
}) {
  const cls =
    tone === "approve"
      ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/18"
      : "border-red-400/20 bg-red-500/12 text-red-300 hover:bg-red-500/18";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${cls} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {children}
    </button>
  );
}

export default function InvestorRequestAdminClient({
  initialRequests,
  initialPostedTransactions,
}: InvestorRequestAdminClientProps) {
  const router = useRouter();

  const [requests, setRequests] = useState<CapitalRequestRow[]>(initialRequests);
  const [postedTransactions, setPostedTransactions] = useState<PostedTransactionRow[]>(
    initialPostedTransactions
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  useEffect(() => {
    setPostedTransactions(initialPostedTransactions);
  }, [initialPostedTransactions]);

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === "Pending"),
    [requests]
  );

  async function updateRequest(id: string, action: "approve" | "decline") {
    if (busyId) return;

    try {
      setBusyId(id);
      setActionError(null);

      const res = await fetch(`/api/investor-requests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update request.");
      }

      setRequests((prev) =>
        prev.map((request) => (request.id === id ? payload.request : request))
      );

      if (payload.postedTransaction) {
        setPostedTransactions((prev) => [payload.postedTransaction, ...prev]);
      }

      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative isolate space-y-2 overflow-hidden pt-2">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.12),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.08),transparent_30%)]" />

      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white xl:text-4xl">Investor Admin Review</h1>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">
              Review Queue
            </div>
          </div>

          <div className="max-w-4xl text-sm text-white/58">
            Review pending capital requests and post approved items into transaction history.
          </div>
        </div>

        <Link
          href="/dashboard/investors"
          className="inline-flex rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08]"
        >
          Back to Investors
        </Link>
      </div>

      <Surface className="p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <SectionLabel>Pending Queue</SectionLabel>
            <div className="mt-1 text-[1.5rem] font-semibold text-white sm:text-[1.7rem]">Approve or Decline Requests</div>
            <div className="mt-1 text-sm text-white/55">
              Approved requests are moved into posted transactions and logged in Supabase.
            </div>
          </div>

          <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">
            {pendingRequests.length} Pending
          </div>
        </div>

        {actionError ? (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {actionError}
          </div>
        ) : null}

        <div className="mt-3">
          {pendingRequests.length ? (
            <div className="space-y-2.5">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-white/10 bg-black/20 px-3.5 py-3"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-medium text-white">{request.member}</div>
                        <div
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${typeBadgeClass(
                            request.type
                          )}`}
                        >
                          {request.type}
                        </div>
                        <div
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${statusBadgeClass(
                            request.status
                          )}`}
                        >
                          {request.status}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/55">
                        <span>
                          Amount: <span className="font-medium text-white">{money(request.amount)}</span>
                        </span>
                        <span>
                          Created: <span className="font-medium text-white">{request.createdAt}</span>
                        </span>
                      </div>

                      {request.note ? (
                        <div className="mt-2 text-sm text-white/50">{request.note}</div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ReviewButton
                        tone="approve"
                        onClick={() => updateRequest(request.id, "approve")}
                        disabled={busyId === request.id}
                      >
                        {busyId === request.id ? "Working..." : "Approve"}
                      </ReviewButton>
                      <ReviewButton
                        tone="decline"
                        onClick={() => updateRequest(request.id, "decline")}
                        disabled={busyId === request.id}
                      >
                        {busyId === request.id ? "Working..." : "Decline"}
                      </ReviewButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <SmallEmptyState
              title="No pending requests"
              sub="New deposit, withdrawal, and transfer requests will appear here."
            />
          )}
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
        <Surface className="overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3.5">
            <SectionLabel>All Capital Requests</SectionLabel>
            <div className="mt-1 text-[1.45rem] font-semibold text-white sm:text-[1.6rem]">Request History</div>
            <div className="mt-1 text-sm text-white/55">
              Pending, completed, and declined requests.
            </div>
          </div>

          {requests.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/45">
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} className="border-b border-white/8 text-white/85 last:border-b-0">
                      <td className="px-4 py-4">{request.member}</td>
                      <td className="px-4 py-4">
                        <div
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${typeBadgeClass(
                            request.type
                          )}`}
                        >
                          {request.type}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">{money(request.amount)}</td>
                      <td className="px-4 py-4">
                        <div
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${statusBadgeClass(
                            request.status
                          )}`}
                        >
                          {request.status}
                        </div>
                      </td>
                      <td className="px-4 py-4">{request.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <SmallEmptyState
                title="No requests yet"
                sub="Request history will show up here once capital requests are submitted."
              />
            </div>
          )}
        </Surface>

        <Surface className="overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3.5">
            <SectionLabel>Posted Transactions</SectionLabel>
            <div className="mt-1 text-[1.45rem] font-semibold text-white sm:text-[1.6rem]">Posted Transactions</div>
            <div className="mt-1 text-sm text-white/55">
              Approved requests converted into posted capital activity.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/45">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Units</th>
                  <th className="px-4 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {postedTransactions.map((tx, idx) => (
                  <tr key={`${tx.member}-${tx.when}-${idx}`} className="border-b border-white/8 text-white/85 last:border-b-0">
                    <td className="px-4 py-4 font-medium">{tx.member}</td>
                    <td className="px-4 py-4">
                      <div
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${typeBadgeClass(
                          tx.type
                        )}`}
                      >
                        {tx.type}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">{money(tx.amount)}</td>
                    <td className="px-4 py-4 text-right">{number2(tx.units)}</td>
                    <td className="px-4 py-4 text-white/65">{tx.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      </div>
    </div>
  );
}
