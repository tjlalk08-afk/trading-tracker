import { redirect } from "next/navigation";
import InvestorRequestAdminClient from "@/components/InvestorRequestAdminClient";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type ProfileRow = {
  role: string | null;
  approved: boolean | null;
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

export default async function InvestorsAdminPage() {
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

  if (!isAdmin) {
    redirect("/dashboard/investors");
  }

  const { data: requestRows } = await admin
    .from("investor_requests")
    .select("id, member_name, request_type, amount, status, note, created_at, to_member_name")
    .order("created_at", { ascending: false });

  const { data: postedTransactionRows } = await admin
    .from("investor_posted_transactions")
    .select("id, member_name, transaction_type, amount, units, posted_at, to_member_name")
    .order("posted_at", { ascending: false });

  const initialRequests =
    (requestRows as InvestorRequestRow[] | null)?.map((row) => ({
      id: row.id,
      member: row.member_name ?? "",
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
    <InvestorRequestAdminClient
      initialRequests={initialRequests}
      initialPostedTransactions={initialPostedTransactions}
    />
  );
}
