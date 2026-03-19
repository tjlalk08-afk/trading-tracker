import { redirect } from "next/navigation";
import { getInvestorPnlData } from "@/lib/getInvestorPnlData";
import InvestorDashboardClient from "@/components/InvestorDashboardClient";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  getSubmitterLabelsByUserId,
  resolveInvestorRequestIdentity,
} from "@/lib/investorRequestIdentity";

export const dynamic = "force-dynamic";

type ProfileRow = {
  role: string | null;
  approved: boolean | null;
  investor_member_id?: string | null;
};

type InvestorRequestRow = {
  id: string;
  member_name: string | null;
  request_type: string | null;
  amount: number | string | null;
  status: string | null;
  note: string | null;
  created_at: string | null;
  to_member_name: string | null;
  created_by: string | null;
};

type PostedTransactionRow = {
  id: string;
  member_name: string | null;
  transaction_type: string | null;
  amount: number | string | null;
  units: number | string | null;
  posted_at: string | null;
  to_member_name: string | null;
};

type InvestorClientData = {
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
};

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export default async function InvestorsPage() {
  const supabase = await supabaseServer();
  const admin = getSupabaseAdmin();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role, approved")
    .eq("id", user.id)
    .maybeSingle();

  const profileRow = profile as ProfileRow | null;
  const isAdmin = profileRow?.role === "admin" && profileRow?.approved === true;
  const identity = await resolveInvestorRequestIdentity(user);

  let initialData: InvestorClientData | null = null;
  try {
    const investorData = await getInvestorPnlData();
    initialData = {
      fundEquity: investorData.totalEquity,
      equity: investorData.totalEquity,
      totalUnits: investorData.totalUnits,
      netContributedCapital: investorData.netContributedCapital,
      rows: investorData.rows.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        netCashContributed: row.netCashContributed,
        grantedUnits: row.grantedUnits,
        totalUnits: row.totalUnits,
        ownershipPct: row.ownershipPct,
        currentValue: row.currentValue,
        pnlDollar: row.pnlDollar,
        returnPct: row.returnPct,
      })),
      loadError: null,
    };
  } catch (error) {
    initialData = {
      fundEquity: 0,
      equity: 0,
      totalUnits: 0,
      netContributedCapital: 0,
      rows: [],
      loadError: error instanceof Error ? error.message : "Failed to load investor ownership data.",
    };
  }

  let requestsQuery = admin
    .from("investor_requests")
    .select(
      "id, member_name, request_type, amount, status, note, created_at, created_by, to_member_name"
    )
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    requestsQuery = requestsQuery.eq("created_by", user.id);
  }

  const { data: requestRows } = await requestsQuery;
  const submitterLabels = await getSubmitterLabelsByUserId(
    ((requestRows as InvestorRequestRow[] | null) ?? []).map((row) => row.created_by),
  );

  const { data: postedTransactionRows } = await admin
    .from("investor_posted_transactions")
    .select("id, member_name, transaction_type, amount, units, posted_at, to_member_name")
    .order("posted_at", { ascending: false });

  const initialRequests =
    (requestRows as InvestorRequestRow[] | null)?.map((row) => ({
      id: row.id,
      member: row.member_name ?? "",
      submittedBy:
        row.created_by === user.id
          ? identity.submitterLabel
          : submitterLabels.get(row.created_by ?? "") ?? "Unknown user",
      type: row.request_type as "Deposit" | "Withdrawal" | "Transfer",
      amount: Number(row.amount ?? 0),
      status: row.status as "Pending" | "Approved" | "Declined" | "Completed",
      createdAt: formatDisplayDate(row.created_at),
      note: row.note ?? undefined,
      transferTo: row.to_member_name ?? undefined,
    })) ?? [];

  const initialPostedTransactions =
    (postedTransactionRows as PostedTransactionRow[] | null)?.map((row) => ({
      member: row.member_name ?? "",
      type: row.transaction_type as "Deposit" | "Withdrawal" | "Grant" | "Transfer",
      amount: Number(row.amount ?? 0),
      units: Number(row.units ?? 0),
      when: formatDisplayDate(row.posted_at),
      transferTo: row.to_member_name ?? undefined,
    })) ?? [];

  return (
    <InvestorDashboardClient
      initialData={initialData}
      initialRequests={initialRequests}
      initialPostedTransactions={initialPostedTransactions}
      isAdmin={isAdmin}
      currentMemberName={identity.matchedMemberName}
    />
  );
}
