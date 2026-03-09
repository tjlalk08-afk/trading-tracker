import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  computeInvestorRows,
  InvestorMember,
  InvestorTransaction,
} from "@/lib/investorPnl";

type SnapshotRow = {
  live_equity?: number | null;
  equity?: number | null;
  account_equity?: number | null;
  created_at?: string;
};

type InvestorRequest = {
  id: string;
  member_id: string;
  request_type: "deposit" | "withdrawal" | "transfer";
  amount: number | null;
  units: number | null;
  target_member_id: string | null;
  status: "pending" | "approved" | "rejected" | "completed";
  note: string | null;
  created_at: string;
};

export async function getInvestorPnlData() {
  const supabase = supabaseAdmin;

  const { data: membersRaw, error: membersError } = await supabase
    .from("investor_members")
    .select("id, name, role, active")
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (membersError) {
    throw new Error(`Members load failed: ${membersError.message}`);
  }

  const { data: txnsRaw, error: txnsError } = await supabase
    .from("investor_transactions")
    .select("id, member_id, txn_type, amount, units, notes, effective_at")
    .order("effective_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (txnsError) {
    throw new Error(`Transactions load failed: ${txnsError.message}`);
  }

  const { data: requestsRaw, error: requestsError } = await supabase
    .from("investor_requests")
    .select("id, member_id, request_type, amount, units, target_member_id, status, note, created_at")
    .order("created_at", { ascending: false });

  if (requestsError) {
    throw new Error(`Requests load failed: ${requestsError.message}`);
  }

  const { data: latestSnapshot, error: snapshotError } = await supabase
    .from("dashboard_snapshots")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError) {
    throw new Error(`Snapshot load failed: ${snapshotError.message}`);
  }

  const members: InvestorMember[] = (membersRaw ?? []) as InvestorMember[];
  const transactions: InvestorTransaction[] = ((txnsRaw ?? []) as any[]).map((t) => ({
    ...t,
    amount: Number(t.amount ?? 0),
    units: Number(t.units ?? 0),
  }));

  const requests: InvestorRequest[] = ((requestsRaw ?? []) as any[]).map((r) => ({
    ...r,
    amount: r.amount == null ? null : Number(r.amount),
    units: r.units == null ? null : Number(r.units),
  }));

  const snap = (latestSnapshot ?? {}) as SnapshotRow;

  const totalEquity = Number(
    snap.live_equity ?? snap.equity ?? snap.account_equity ?? 0
  );

  const result = computeInvestorRows({
    members,
    transactions,
    totalEquity,
  });

  return {
    totalEquity,
    snapshot: latestSnapshot,
    requests,
    members,
    transactions,
    ...result,
  };
}