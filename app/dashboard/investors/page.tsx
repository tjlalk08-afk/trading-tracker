import { redirect } from "next/navigation";
import { getInvestorPnlData } from "@/lib/getInvestorPnlData";
import InvestorDashboardClient from "@/components/InvestorDashboardClient";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "—";

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

  const isAdmin = profile?.role === "admin" && profile?.approved === true;

  let initialData: unknown = null;
  try {
    initialData = await getInvestorPnlData();
  } catch {
    initialData = null;
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

  const { data: postedTransactionRows } = await admin
    .from("investor_posted_transactions")
    .select("id, member_name, transaction_type, amount, units, posted_at, to_member_name")
    .order("posted_at", { ascending: false });

  const initialRequests =
    requestRows?.map((row) => ({
      id: row.id,
      member: row.member_name,
      type: row.request_type as "Deposit" | "Withdrawal" | "Transfer",
      amount: Number(row.amount ?? 0),
      status: row.status as "Pending" | "Approved" | "Declined" | "Completed",
      createdAt: formatDisplayDate(row.created_at),
      note: row.note ?? undefined,
      transferTo: row.to_member_name ?? undefined,
    })) ?? [];

  const initialPostedTransactions =
    postedTransactionRows?.map((row) => ({
      member: row.member_name,
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
    />
  );
}