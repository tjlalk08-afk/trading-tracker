import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSubmitterLabelsByUserId } from "@/lib/investorRequestIdentity";

export const runtime = "nodejs";
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

type ApprovedRequestResult = {
  request_id: string;
  member_name: string | null;
  request_type: string | null;
  amount: number | string | null;
  status: string | null;
  created_at: string | null;
  note: string | null;
  to_member_name: string | null;
  created_by: string | null;
  posted_at: string | null;
  posted_units: number | string | null;
  unit_price: number | string | null;
};

type AdminRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => {
    single: () => Promise<{
      data: unknown;
      error: { message?: string } | null;
    }>;
  };
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

    const adminRpc = admin as unknown as AdminRpcClient;

    const { data: approvalResult, error: approvalRpcError } = await adminRpc
      .rpc("approve_investor_request", {
        p_request_id: id,
        p_reviewed_by: user.id,
      })
      .single();

    if (approvalRpcError || !approvalResult) {
      return NextResponse.json(
        { error: approvalRpcError?.message || "Failed to approve request." },
        { status: 500 }
      );
    }

    const completedRequestRow = approvalResult as ApprovedRequestResult;

    const postedTransactionRow: PostedTransactionRow = {
      member_name: completedRequestRow.member_name,
      transaction_type: completedRequestRow.request_type,
      amount: completedRequestRow.amount,
      units: completedRequestRow.posted_units,
      posted_at: completedRequestRow.posted_at,
      to_member_name: completedRequestRow.to_member_name,
    };

    await admin.from("investor_request_audit_log").insert({
      request_id: completedRequestRow.request_id,
      action: "APPROVED",
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      snapshot: {
        request: completedRequestRow,
        postedTransaction: postedTransactionRow,
        unitPrice: Number(completedRequestRow.unit_price ?? 0),
      },
    } as never);

    return NextResponse.json({
      ok: true,
      request: {
        id: completedRequestRow.request_id,
        member: completedRequestRow.member_name,
        submittedBy:
          (await getSubmitterLabelsByUserId([completedRequestRow.created_by])).get(
            completedRequestRow.created_by ?? ""
          ) ?? "Unknown user",
        type: completedRequestRow.request_type,
        amount: Number(completedRequestRow.amount ?? 0),
        status: completedRequestRow.status,
        createdAt: formatDisplayDate(completedRequestRow.created_at),
        note: completedRequestRow.note ?? undefined,
        transferTo: completedRequestRow.to_member_name ?? undefined,
      },
      postedTransaction: {
        member: postedTransactionRow.member_name,
        type: postedTransactionRow.transaction_type,
        amount: Number(postedTransactionRow.amount ?? 0),
        units: Number(postedTransactionRow.units ?? 0),
        when: formatDisplayDate(postedTransactionRow.posted_at),
        transferTo: postedTransactionRow.to_member_name ?? undefined,
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
