"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

type MemberRole = "OPERATOR" | "INVESTOR";
type CapitalRequestType = "Deposit" | "Withdrawal" | "Transfer";
type CapitalRequestStatus = "Pending" | "Approved" | "Declined" | "Completed";
type TransactionType = "Deposit" | "Withdrawal" | "Grant" | "Transfer";

type MemberRow = {
  id: string;
  name: string;
  role: MemberRole;
  netContributions: number;
  grantedUnits: number;
  totalUnits: number;
};

type CapitalRequestRow = {
  id: string;
  member: string;
  submittedBy?: string;
  type: CapitalRequestType;
  amount: number;
  status: CapitalRequestStatus;
  createdAt: string;
  note?: string;
  transferTo?: string;
};

type PostedTransactionRow = {
  member: string;
  type: TransactionType;
  amount: number;
  units: number;
  when: string;
  transferTo?: string;
};

type InvestorDashboardClientProps = {
  initialData?: {
    fundEquity?: number | null;
    equity?: number | null;
    totalUnits?: number | null;
    netContributedCapital?: number | null;
    loadError?: string | null;
    rows?: {
      id: string;
      name: string;
      role: string;
      netCashContributed: number;
      grantedUnits: number;
      totalUnits: number;
      ownershipPct: number;
      currentValue: number;
      pnlDollar: number;
      returnPct: number | null;
    }[];
  } | null;
  initialRequests: CapitalRequestRow[];
  initialPostedTransactions: PostedTransactionRow[];
  isAdmin: boolean;
  currentMemberName?: string | null;
};

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

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

function signedMoney(n: number | null | undefined) {
  const value = Number(n ?? 0);
  const abs = money(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

function signedPct(n: number | null | undefined) {
  const value = Number(n ?? 0);
  const fixed = value.toFixed(2);
  if (value > 0) return `+${fixed}%`;
  return `${fixed}%`;
}

function pnlTextClass(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (n > 0) return "text-emerald-300";
  if (n < 0) return "text-red-300";
  return "text-white";
}

function roleBadgeClass(role: MemberRole) {
  return role === "OPERATOR"
    ? "border-cyan-400/20 bg-cyan-500/12 text-cyan-300"
    : "border-white/10 bg-white/[0.05] text-white/75";
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

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <Surface className="p-3.5 sm:p-4">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-1.5 text-[1.55rem] font-semibold text-white sm:text-[1.8rem]">{value}</div>
      <div className="mt-1.5 text-xs text-white/55 sm:text-sm">{sub}</div>
    </Surface>
  );
}

function ActionButton({
  children,
  tone,
  onClick,
}: {
  children: ReactNode;
  tone: "deposit" | "withdrawal" | "transfer";
  onClick: () => void;
}) {
  const cls =
    tone === "deposit"
      ? "border-emerald-400/20 bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/18"
      : tone === "withdrawal"
      ? "border-amber-400/20 bg-amber-500/12 text-amber-300 hover:bg-amber-500/18"
      : "border-cyan-400/20 bg-cyan-500/12 text-cyan-300 hover:bg-cyan-500/18";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${cls}`}
    >
      {children}
    </button>
  );
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

export default function InvestorDashboardClient({
  initialData,
  initialRequests,
  initialPostedTransactions,
  isAdmin,
  currentMemberName,
}: InvestorDashboardClientProps) {
  const router = useRouter();

  const [requests, setRequests] = useState<CapitalRequestRow[]>(initialRequests);
  const [postedTransactions, setPostedTransactions] = useState<PostedTransactionRow[]>(
    initialPostedTransactions
  );
  const normalizedMembers = useMemo<MemberRow[]>(() => {
    return (
      initialData?.rows?.map((row) => ({
        id: row.id,
        name: row.name,
        role: String(row.role).toUpperCase() === "OPERATOR" ? "OPERATOR" : "INVESTOR",
        netContributions: row.netCashContributed,
        grantedUnits: row.grantedUnits,
        totalUnits: row.totalUnits,
      })) ?? []
    );
  }, [initialData?.rows]);

  const [activeAction, setActiveAction] = useState<CapitalRequestType | null>(null);
  const [requestMember, setRequestMember] = useState<string>(currentMemberName ?? normalizedMembers[0]?.name ?? "");
  const [requestTransferTo, setRequestTransferTo] = useState<string>("");
  const [requestAmount, setRequestAmount] = useState<string>("");
  const [requestNote, setRequestNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  useEffect(() => {
    setPostedTransactions(initialPostedTransactions);
  }, [initialPostedTransactions]);

  useEffect(() => {
    if (!normalizedMembers.length) {
      setRequestMember(currentMemberName ?? "");
      setRequestTransferTo("");
      return;
    }

    setRequestMember((current) => {
      if (!isAdmin && currentMemberName) {
        return currentMemberName;
      }
      if (current && normalizedMembers.some((member) => member.name === current)) {
        return current;
      }
      return normalizedMembers[0]?.name ?? "";
    });
  }, [currentMemberName, isAdmin, normalizedMembers]);

  const members = normalizedMembers;
  const fundEquity = pickNumber(initialData?.fundEquity, initialData?.equity, 0);
  const totalUnits = pickNumber(initialData?.totalUnits, 0);
  const unitPrice = totalUnits > 0 ? fundEquity / totalUnits : 0;

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === "Pending"),
    [requests]
  );

  const pendingRequestsCount = pendingRequests.length;
  const netContributedCapital = pickNumber(
    initialData?.netContributedCapital,
    members.reduce((sum, m) => sum + m.netContributions, 0)
  );

  const ownershipRows = members.map((member) => {
    const ownership = totalUnits > 0 ? member.totalUnits / totalUnits : 0;
    const currentValue = member.totalUnits * unitPrice;
    const pnl = currentValue - member.netContributions;
    const returnPct =
      member.netContributions > 0
        ? ((currentValue - member.netContributions) / member.netContributions) * 100
        : null;

    return {
      ...member,
      ownership,
      currentValue,
      pnl,
      returnPct,
    };
  });

  const memberOptions = members.filter((m) => m.role === "INVESTOR" || m.role === "OPERATOR");
  const transferOptions = memberOptions.filter((m) => m.name !== requestMember);
  const ownershipLoadError = initialData?.loadError ?? null;

  function openRequestForm(type: CapitalRequestType) {
    setActiveAction(type);
    setRequestAmount("");
    setRequestNote("");
    setSubmitError(null);

    const currentMember = requestMember || memberOptions[0]?.name || "";

    if (type === "Transfer") {
      const firstOther = memberOptions.find((m) => m.name !== currentMember)?.name ?? "";
      setRequestTransferTo(firstOther);
    } else {
      setRequestTransferTo("");
    }
  }

  function closeRequestForm() {
    setActiveAction(null);
    setRequestAmount("");
    setRequestNote("");
    setRequestTransferTo("");
    setSubmitError(null);
  }

  async function submitRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!activeAction || isSubmitting) return;

    const amountNumber = Number(requestAmount);
    if (!requestMember || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      setSubmitError("Enter a valid request amount.");
      return;
    }

    if (activeAction === "Transfer") {
      if (!requestTransferTo) {
        setSubmitError("Choose who the transfer is going to.");
        return;
      }

      if (requestTransferTo === requestMember) {
        setSubmitError("Transfer To must be a different member.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const res = await fetch("/api/investor-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberName: requestMember,
          requestType: activeAction,
          amount: amountNumber,
          note: requestNote,
          transferToMember: activeAction === "Transfer" ? requestTransferTo : null,
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.error || "Failed to submit request.");
      }

      setRequests((prev) => [payload.request, ...prev]);
      closeRequestForm();
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative isolate space-y-2 overflow-hidden pt-2">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.12),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.08),transparent_30%)]" />

      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white xl:text-4xl">Investors</h1>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">
              Units-Based Ownership
            </div>
          </div>

          <div className="max-w-3xl text-sm text-white/58">
            Units-based ownership with deposits, withdrawals, grants, and investor capital requests.
          </div>
        </div>

        {isAdmin ? (
          <Link
            href="/dashboard/investors/admin"
            className="inline-flex rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08]"
          >
            Admin Review
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-5">
        <StatCard title="Fund Equity" value={money(fundEquity)} sub="Latest dashboard snapshot" />
        <StatCard
          title="Total Units"
          value={number2(totalUnits)}
          sub="Ownership base across all members"
        />
        <StatCard title="Unit Price" value={money(unitPrice)} sub="Fund equity ÷ total units" />
        <StatCard
          title="Net Contributed Capital"
          value={money(netContributedCapital)}
          sub="Cash in minus withdrawals"
        />
        <StatCard
          title="Pending Requests"
          value={String(pendingRequestsCount)}
          sub={isAdmin ? "Awaiting admin review" : "Your pending requests"}
        />
      </div>

      <Surface className="p-3.5 sm:p-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div>
            <SectionLabel>Capital Actions</SectionLabel>
            <div className="mt-1 text-[1.4rem] font-semibold text-white sm:text-[1.6rem]">
              Capital Actions
            </div>
            <div className="mt-1 text-sm text-white/55">
              Submit investor requests for deposits, withdrawals, or transfers.
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton tone="deposit" onClick={() => openRequestForm("Deposit")}>
                Request Deposit
              </ActionButton>
              <ActionButton tone="withdrawal" onClick={() => openRequestForm("Withdrawal")}>
                Request Withdrawal
              </ActionButton>
              <ActionButton tone="transfer" onClick={() => openRequestForm("Transfer")}>
                Request Transfer
              </ActionButton>
            </div>

            {activeAction ? (
              <form
                onSubmit={submitRequest}
                className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/20 p-3.5"
              >
                <div className="text-sm font-medium text-white">New {activeAction} Request</div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <div className="text-xs uppercase tracking-[0.16em] text-white/45">Member</div>
                    {isAdmin ? (
                      <select
                        value={requestMember}
                        onChange={(e) => {
                          const nextMember = e.target.value;
                          setRequestMember(nextMember);

                          if (activeAction === "Transfer") {
                            const firstOther =
                              memberOptions.find((m) => m.name !== nextMember)?.name ?? "";
                            if (!requestTransferTo || requestTransferTo === nextMember) {
                              setRequestTransferTo(firstOther);
                            }
                          }
                        }}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none"
                      >
                        {memberOptions.map((member) => (
                          <option key={member.name} value={member.name} className="bg-[#0b1118]">
                            {member.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white">
                        {currentMemberName ?? "Contact an admin to link your investor member"}
                      </div>
                    )}
                  </label>

                  <label className="space-y-1.5">
                    <div className="text-xs uppercase tracking-[0.16em] text-white/45">Amount</div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={requestAmount}
                      onChange={(e) => setRequestAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                    />
                  </label>
                </div>

                {activeAction === "Transfer" ? (
                  <label className="block space-y-1.5">
                    <div className="text-xs uppercase tracking-[0.16em] text-white/45">Transfer To</div>
                    <select
                      value={requestTransferTo}
                      onChange={(e) => setRequestTransferTo(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none"
                    >
                      {transferOptions.map((member) => (
                        <option key={member.name} value={member.name} className="bg-[#0b1118]">
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="block space-y-1.5">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/45">Note</div>
                  <textarea
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    placeholder="Optional context for this request"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                  />
                </label>

                {!isAdmin && !currentMemberName ? (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    Your account is not linked to an investor member yet. Ask an admin to link it before submitting requests.
                  </div>
                ) : null}

                {submitError ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {submitError}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || (!isAdmin && !currentMemberName)}
                    className="rounded-xl border border-emerald-400/20 bg-emerald-500/12 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Request"}
                  </button>
                  <button
                    type="button"
                    onClick={closeRequestForm}
                    disabled={isSubmitting}
                    className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </div>

          <div className="border-t border-white/10 pt-4 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionLabel>Pending Request Queue</SectionLabel>
                <div className="mt-1 text-[1.4rem] font-semibold text-white sm:text-[1.6rem]">
                  Awaiting Review
                </div>
                <div className="mt-1 text-sm text-white/55">
                  {isAdmin
                    ? "Pending requests across the fund."
                    : "Your pending requests will stay here until an admin reviews them."}
                </div>
              </div>

              <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">
                {pendingRequestsCount} Pending
              </div>
            </div>

            <div className="mt-3">
              {pendingRequests.length ? (
                <div className="space-y-2.5">
                  {pendingRequests.slice(0, 3).map((request) => (
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
                            {request.submittedBy ? (
                              <span>
                                Submitted by: <span className="font-medium text-white">{request.submittedBy}</span>
                              </span>
                            ) : null}
                            {request.type === "Transfer" && request.transferTo ? (
                              <span>
                                To: <span className="font-medium text-white">{request.transferTo}</span>
                              </span>
                            ) : null}
                            <span>
                              Created: <span className="font-medium text-white">{request.createdAt}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <SmallEmptyState
                  title="No pending money actions"
                  sub="Deposits, withdrawals, and transfers waiting for review will appear here."
                />
              )}
            </div>
          </div>
        </div>
      </Surface>

      <Surface className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3.5">
          <SectionLabel>Ownership Table</SectionLabel>
          <div className="mt-1 text-[1.55rem] font-semibold text-white">Ownership Table</div>
          <div className="mt-1 text-sm text-white/55">
            Live member ownership based on current unit pricing.
          </div>
        </div>

        {ownershipLoadError ? (
          <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Investor ownership data could not be loaded: {ownershipLoadError}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/45">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium text-right">Net Contributions</th>
                <th className="px-4 py-3 font-medium text-right">Granted Units</th>
                <th className="px-4 py-3 font-medium text-right">Total Units</th>
                <th className="px-4 py-3 font-medium text-right">Ownership</th>
                <th className="px-4 py-3 font-medium text-right">Current Value</th>
                <th className="px-4 py-3 font-medium text-right">P/L</th>
                <th className="px-4 py-3 font-medium text-right">Return</th>
              </tr>
            </thead>
            <tbody>
              {ownershipRows.length ? (
                ownershipRows.map((row) => (
                  <tr key={row.name} className="border-b border-white/8 text-white/85 last:border-b-0">
                    <td className="px-4 py-4 font-medium">{row.name}</td>
                    <td className="px-4 py-4">
                      <div
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${roleBadgeClass(
                          row.role
                        )}`}
                      >
                        {row.role}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">{money(row.netContributions)}</td>
                    <td className="px-4 py-4 text-right">{number2(row.grantedUnits)}</td>
                    <td className="px-4 py-4 text-right">{number2(row.totalUnits)}</td>
                    <td className="px-4 py-4 text-right">{signedPct(row.ownership * 100)}</td>
                    <td className="px-4 py-4 text-right font-medium">{money(row.currentValue)}</td>
                    <td className={`px-4 py-4 text-right font-medium ${pnlTextClass(row.pnl)}`}>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 ${
                          row.pnl > 0
                            ? "bg-emerald-500/12"
                            : row.pnl < 0
                            ? "bg-red-500/12"
                            : "bg-white/[0.04]"
                        }`}
                      >
                        {signedMoney(row.pnl)}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-4 text-right ${
                        row.returnPct === null ? "text-white/40" : pnlTextClass(row.returnPct)
                      }`}
                    >
                      {row.returnPct === null ? "-" : signedPct(row.returnPct)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8">
                    <SmallEmptyState
                      title="No investor ownership data yet"
                      sub="Add active investor members and post capital transactions to populate the ownership table."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
        <Surface className="overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3.5">
            <SectionLabel>Recent Capital Requests</SectionLabel>
            <div className="mt-1 text-[1.45rem] font-semibold text-white sm:text-[1.6rem]">Recent Capital Requests</div>
            <div className="mt-1 text-sm text-white/55">
              {isAdmin
                ? "All recent deposit, withdrawal, and transfer requests."
                : "Your recent deposit, withdrawal, and transfer requests."}
            </div>
          </div>

          {requests.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/45">
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Submitted By</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">To</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} className="border-b border-white/8 text-white/85 last:border-b-0">
                      <td className="px-4 py-4">{request.member}</td>
                      <td className="px-4 py-4">{request.submittedBy ?? "-"}</td>
                      <td className="px-4 py-4">
                        <div
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${typeBadgeClass(
                            request.type
                          )}`}
                        >
                          {request.type}
                        </div>
                      </td>
                      <td className="px-4 py-4">{request.transferTo ?? "-"}</td>
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
                sub="Deposit, withdrawal, and transfer requests will show here."
              />
            </div>
          )}
        </Surface>

        <Surface className="overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3.5">
            <SectionLabel>Recent Posted Transactions</SectionLabel>
            <div className="mt-1 text-[1.45rem] font-semibold text-white sm:text-[1.6rem]">
              Recent Posted Transactions
            </div>
            <div className="mt-1 text-sm text-white/55">
              Completed capital activity that already affected ownership.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/45">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">To</th>
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
                    <td className="px-4 py-4">{tx.transferTo ?? "-"}</td>
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
