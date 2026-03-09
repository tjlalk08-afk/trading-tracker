"use client";

import { useState } from "react";

type Props = {
  requestId: string;
  status: string;
  requestType: string;
};

export default function InvestorRequestAdminActions({
  requestId,
  status,
  requestType,
}: Props) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function runAction(action: "approve" | "reject" | "complete") {
    setLoadingAction(action);
    setMessage("");

    try {
      const res = await fetch(`/api/investor-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || `Failed to ${action} request`);
      }

      setMessage(`${action}d successfully`);
      window.location.reload();
    } catch (err: any) {
      setMessage(err.message || "Something went wrong");
    } finally {
      setLoadingAction(null);
    }
  }

  const isDone = status === "completed" || status === "rejected";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!isDone && status !== "approved" && (
          <button
            onClick={() => runAction("approve")}
            disabled={!!loadingAction}
            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/15 disabled:opacity-60"
          >
            {loadingAction === "approve" ? "Approving..." : "Approve"}
          </button>
        )}

        {!isDone && (
          <button
            onClick={() => runAction("reject")}
            disabled={!!loadingAction}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/15 disabled:opacity-60"
          >
            {loadingAction === "reject" ? "Rejecting..." : "Reject"}
          </button>
        )}

        {!isDone && requestType !== "transfer" && (
          <button
            onClick={() => runAction("complete")}
            disabled={!!loadingAction}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-60"
          >
            {loadingAction === "complete" ? "Completing..." : "Complete"}
          </button>
        )}
      </div>

      {requestType === "transfer" && !isDone && (
        <div className="text-xs text-yellow-300">
          Transfer completion not wired yet.
        </div>
      )}

      {message && <div className="text-xs text-neutral-400">{message}</div>}
    </div>
  );
}