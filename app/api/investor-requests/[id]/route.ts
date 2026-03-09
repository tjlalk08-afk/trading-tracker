import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SnapshotRow = {
  live_equity?: number | null;
  equity?: number | null;
  account_equity?: number | null;
};

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdminApi();

    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const { id } = await context.params;
    const body = await req.json();
    const action = body?.action as "approve" | "reject" | "complete" | undefined;

    if (!id) {
      return NextResponse.json({ error: "Missing request id" }, { status: 400 });
    }

    if (!action || !["approve", "reject", "complete"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    const { data: requestRow, error: requestError } = await supabase
      .from("investor_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (requestError) {
      return NextResponse.json({ error: requestError.message }, { status: 500 });
    }

    if (!requestRow) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (action === "approve") {
      const { error } = await supabase
        .from("investor_requests")
        .update({
          status: "approved",
          reviewed_by: "Lucas",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, status: "approved" });
    }

    if (action === "reject") {
      const { error } = await supabase
        .from("investor_requests")
        .update({
          status: "rejected",
          reviewed_by: "Lucas",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, status: "rejected" });
    }

    if (action === "complete") {
      if (requestRow.status === "completed") {
        return NextResponse.json(
          { error: "Request already completed" },
          { status: 400 }
        );
      }

      if (requestRow.request_type === "transfer") {
        return NextResponse.json(
          { error: "Transfer completion not implemented yet" },
          { status: 400 }
        );
      }

      const { data: latestSnapshot, error: snapshotError } = await supabase
        .from("dashboard_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (snapshotError) {
        return NextResponse.json({ error: snapshotError.message }, { status: 500 });
      }

      const snap = (latestSnapshot ?? {}) as SnapshotRow;
      const totalEquity = Number(
        snap.live_equity ?? snap.equity ?? snap.account_equity ?? 0
      );

      const { data: allTxns, error: txnsError } = await supabase
        .from("investor_transactions")
        .select("txn_type, units");

      if (txnsError) {
        return NextResponse.json({ error: txnsError.message }, { status: 500 });
      }

      let totalUnits = 0;
      for (const txn of allTxns ?? []) {
        const units = Number(txn.units ?? 0);
        if (txn.txn_type === "withdrawal") totalUnits -= units;
        else totalUnits += units;
      }

      if (totalUnits <= 0) {
        return NextResponse.json(
          { error: "Cannot compute unit price: totalUnits <= 0" },
          { status: 400 }
        );
      }

      const unitPrice = totalEquity / totalUnits;
      const amount = Number(requestRow.amount ?? 0);

      if (!amount || amount <= 0) {
        return NextResponse.json(
          { error: "Request amount must be greater than 0" },
          { status: 400 }
        );
      }

      const units = amount / unitPrice;

      if (requestRow.request_type === "withdrawal") {
        const { data: memberTxns, error: memberTxnsError } = await supabase
          .from("investor_transactions")
          .select("txn_type, units")
          .eq("member_id", requestRow.member_id);

        if (memberTxnsError) {
          return NextResponse.json({ error: memberTxnsError.message }, { status: 500 });
        }

        let memberUnits = 0;
        for (const txn of memberTxns ?? []) {
          const txnUnits = Number(txn.units ?? 0);
          if (txn.txn_type === "withdrawal") memberUnits -= txnUnits;
          else memberUnits += txnUnits;
        }

        if (units > memberUnits) {
          return NextResponse.json(
            { error: "Withdrawal exceeds member's available units" },
            { status: 400 }
          );
        }
      }

      const txnType = requestRow.request_type === "deposit" ? "deposit" : "withdrawal";

      const { error: insertTxnError } = await supabase
        .from("investor_transactions")
        .insert({
          member_id: requestRow.member_id,
          txn_type: txnType,
          amount,
          units,
          notes: `Posted from investor request ${requestRow.id}`,
          effective_at: new Date().toISOString(),
        });

      if (insertTxnError) {
        return NextResponse.json({ error: insertTxnError.message }, { status: 500 });
      }

      const { error: updateReqError } = await supabase
        .from("investor_requests")
        .update({
          status: "completed",
          reviewed_by: "Lucas",
          reviewed_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          units,
        })
        .eq("id", id);

      if (updateReqError) {
        return NextResponse.json({ error: updateReqError.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        status: "completed",
        unitPrice,
        units,
      });
    }

    return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}