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

type InvestorTransactionRow = {
  id: string;
  member_id: string;
  txn_type: "deposit" | "withdrawal" | "grant";
  amount: number | string | null;
  units: number | string | null;
  notes: string | null;
  effective_at: string;
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
  const transactions: InvestorTransaction[] = ((txnsRaw ?? []) as InvestorTransactionRow[]).map((t) => ({
    ...t,
    amount: Number(t.amount ?? 0),
    units: Number(t.units ?? 0),
  }));

  const snap = (latestSnapshot ?? {}) as SnapshotRow;

  const totalEquity = Number(
    snap.equity ?? snap.live_equity ?? snap.account_equity ?? 0
  );

  const result = computeInvestorRows({
    members,
    transactions,
    totalEquity,
  });

  return {
    totalEquity,
    snapshot: latestSnapshot,
    members,
    transactions,
    ...result,
  };
}
