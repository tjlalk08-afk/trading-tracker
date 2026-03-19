import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSubmitterLabelsByUserId } from "@/lib/investorRequestIdentity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FUND_EQUITY = 7691.68;
const TOTAL_UNITS = 10000;
const UNIT_PRICE = FUND_EQUITY / TOTAL_UNITS;

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
  created_by?: string | null;
};

type PostedTransactionRow = {
  member_name: string | null;
  transaction_type: string | null;
  amount: number | string | null;
  units: number | string | null;
  posted_at: string | null;
  to_member_name: string | null;
};

type InvestorMemberRow = {
  id: string;
  name: string | null;
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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const supabase = await supabaseServer();
    const admin = getSupabaseAdmin();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role, approved")
      .eq("id", user.id)
      .maybeSingle();

    const profileRow = profile as ProfileRow | null;
    const isAdmin =
      profileRow?.role === "admin" && profileRow?.approved === true;

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const action = String(body?.action || "").trim();

    if (action !== "approve" && action !== "decline") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const { data: existingRequest, error: existingError } = await admin
      .from("investor_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    const existingRequestRow = existingRequest as InvestorRequestRow | null;

    if (existingRequestRow?.status !== "Pending") {
      return NextResponse.json(
        { error: "Only pending requests can be updated." },
        { status: 400 }
      );
    }

    if (action === "decline") {
      const { data: declinedRequest, error: declineError } = await admin
        .from("investor_requests")
        .update({
          status: "Declined",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq("id", id)
        .select("*")
        .single();

      if (declineError || !declinedRequest) {
        return NextResponse.json(
          { error: declineError?.message || "Failed to decline request." },
          { status: 500 }
        );
      }

      const declinedRequestRow = declinedRequest as InvestorRequestRow | null;

      await admin.from("investor_request_audit_log").insert({
        request_id: declinedRequestRow?.id,
        action: "DECLINED",
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        snapshot: declinedRequestRow,
      } as never);

      return NextResponse.json({
        ok: true,
        request: {
          id: declinedRequestRow?.id,
          member: declinedRequestRow?.member_name,
          submittedBy:
            (await getSubmitterLabelsByUserId([declinedRequestRow?.created_by])).get(
              declinedRequestRow?.created_by ?? ""
            ) ?? "Unknown user",
          type: declinedRequestRow?.request_type,
          amount: Number(declinedRequestRow?.amount ?? 0),
          status: declinedRequestRow?.status,
          createdAt: formatDisplayDate(declinedRequestRow?.created_at),
          note: declinedRequestRow?.note ?? undefined,
          transferTo: declinedRequestRow?.to_member_name ?? undefined,
        },
      });
    }

    const nowIso = new Date().toISOString();

    const { data: completedRequest, error: approveError } = await admin
      .from("investor_requests")
      .update({
        status: "Completed",
        reviewed_by: user.id,
        reviewed_at: nowIso,
        completed_at: nowIso,
      } as never)
      .eq("id", id)
      .select("*")
      .single();

    if (approveError || !completedRequest) {
      return NextResponse.json(
        { error: approveError?.message || "Failed to approve request." },
        { status: 500 }
      );
    }

    const completedRequestRow = completedRequest as InvestorRequestRow | null;

    const participantNames = [
      completedRequestRow?.member_name,
      completedRequestRow?.to_member_name,
    ].filter((value): value is string => Boolean(value && value.trim()));

    const { data: participantMembers, error: participantMembersError } = await admin
      .from("investor_members")
      .select("id, name")
      .in("name", participantNames)
      .eq("active", true);

    if (participantMembersError) {
      return NextResponse.json(
        { error: participantMembersError.message || "Failed to load investor members." },
        { status: 500 }
      );
    }

    const memberIdByName = new Map(
      ((participantMembers as InvestorMemberRow[] | null) ?? []).map((member) => [
        member.name ?? "",
        member.id,
      ])
    );

    const requestingMemberId = memberIdByName.get(completedRequestRow?.member_name ?? "");

    if (!requestingMemberId) {
      return NextResponse.json(
        { error: "Approved request member is not linked to an active investor member." },
        { status: 400 }
      );
    }

    const ledgerInserts: Array<{
      member_id: string;
      txn_type: "deposit" | "withdrawal" | "grant";
      amount: number;
      units: number;
      notes: string | null;
      effective_at: string;
    }> = [];

    const requestType = String(completedRequestRow?.request_type ?? "").toLowerCase();
    const amountValue = Number(completedRequestRow?.amount ?? 0);
    const unitsValue = amountValue / UNIT_PRICE;

    if (requestType === "deposit") {
      ledgerInserts.push({
        member_id: requestingMemberId,
        txn_type: "deposit",
        amount: amountValue,
        units: unitsValue,
        notes: completedRequestRow?.note ?? null,
        effective_at: nowIso,
      });
    }

    if (requestType === "withdrawal") {
      ledgerInserts.push({
        member_id: requestingMemberId,
        txn_type: "withdrawal",
        amount: amountValue,
        units: unitsValue,
        notes: completedRequestRow?.note ?? null,
        effective_at: nowIso,
      });
    }

    if (requestType === "transfer") {
      const targetMemberId = memberIdByName.get(completedRequestRow?.to_member_name ?? "");

      if (!targetMemberId) {
        return NextResponse.json(
          { error: "Transfer target is not linked to an active investor member." },
          { status: 400 }
        );
      }

      ledgerInserts.push({
        member_id: requestingMemberId,
        txn_type: "withdrawal",
        amount: amountValue,
        units: unitsValue,
        notes: completedRequestRow?.note ?? "Transfer out",
        effective_at: nowIso,
      });
      ledgerInserts.push({
        member_id: targetMemberId,
        txn_type: "deposit",
        amount: amountValue,
        units: unitsValue,
        notes: completedRequestRow?.note ?? "Transfer in",
        effective_at: nowIso,
      });
    }

    if (ledgerInserts.length > 0) {
      const { error: ledgerInsertError } = await admin
        .from("investor_transactions")
        .insert(ledgerInserts as never);

      if (ledgerInsertError) {
        return NextResponse.json(
          { error: ledgerInsertError.message || "Failed to update investor ledger." },
          { status: 500 }
        );
      }
    }

    const { data: postedTransaction, error: postedError } = await admin
      .from("investor_posted_transactions")
      .insert({
        request_id: completedRequestRow?.id,
        member_name: completedRequestRow?.member_name,
        transaction_type: completedRequestRow?.request_type,
        amount: completedRequestRow?.amount,
        units: Number(completedRequestRow?.amount ?? 0) / UNIT_PRICE,
        posted_by: user.id,
        to_member_name: completedRequestRow?.to_member_name ?? null,
      } as never)
      .select("*")
      .single();

    if (postedError || !postedTransaction) {
      return NextResponse.json(
        { error: postedError?.message || "Failed to create posted transaction." },
        { status: 500 }
      );
    }

    const postedTransactionRow = postedTransaction as PostedTransactionRow | null;

    await admin.from("investor_request_audit_log").insert({
      request_id: completedRequestRow?.id,
      action: "APPROVED",
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      snapshot: {
        request: completedRequestRow,
        postedTransaction: postedTransactionRow,
      },
    } as never);

    return NextResponse.json({
      ok: true,
      request: {
        id: completedRequestRow?.id,
        member: completedRequestRow?.member_name,
        submittedBy:
          (await getSubmitterLabelsByUserId([completedRequestRow?.created_by])).get(
            completedRequestRow?.created_by ?? ""
          ) ?? "Unknown user",
        type: completedRequestRow?.request_type,
        amount: Number(completedRequestRow?.amount ?? 0),
        status: completedRequestRow?.status,
        createdAt: formatDisplayDate(completedRequestRow?.created_at),
        note: completedRequestRow?.note ?? undefined,
        transferTo: completedRequestRow?.to_member_name ?? undefined,
      },
      postedTransaction: {
        member: postedTransactionRow?.member_name,
        type: postedTransactionRow?.transaction_type,
        amount: Number(postedTransactionRow?.amount ?? 0),
        units: Number(postedTransactionRow?.units ?? 0),
        when: formatDisplayDate(postedTransactionRow?.posted_at),
        transferTo: postedTransactionRow?.to_member_name ?? undefined,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
