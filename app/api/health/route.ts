import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getBotDashboardUrl } from "@/lib/botDashboardUrl";
import { fetchJsonWithTimeout } from "@/lib/fetchJsonWithTimeout";
import { requireApprovedApiUser } from "@/lib/requireApprovedApiUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_TIMEZONE = "America/Chicago";

type CheckState = "ok" | "warn" | "error";

type CheckResult = {
  status: CheckState;
  message: string;
  detail?: string;
};

type LatestSnapshotRow = {
  id: number;
  snapshot_ts: string | null;
};

type LatestTradeRow = {
  id: number;
  closed_at: string | null;
};

function chicagoDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TARGET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${map.year}-${map.month}-${map.day}`;
}

function describeAge(timestamp: string | null | undefined) {
  if (!timestamp) return "No timestamp";

  const diffMs = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(diffMs)) return "Invalid timestamp";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function configCheck(): CheckResult {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.SB_SERVICE_ROLE_KEY ? "SB_SERVICE_ROLE_KEY" : "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    return {
      status: "error",
      message: "Missing required environment variables",
      detail: missing.join(", "),
    };
  }

  return {
    status: "ok",
    message: "Required environment variables are present",
  };
}

async function botCheck(): Promise<CheckResult> {
  try {
    await fetchJsonWithTimeout<Record<string, unknown>>(getBotDashboardUrl(), {
      cache: "no-store",
      headers: { accept: "application/json" },
      timeoutMs: 15000,
    });

    return {
      status: "ok",
      message: "Bot dashboard upstream reachable",
    };
  } catch (error) {
    return {
      status: "error",
      message: "Bot dashboard upstream unreachable",
      detail: error instanceof Error ? error.message : "Unknown fetch error",
    };
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireApprovedApiUser(req);
  if ("error" in auth) return auth.error;

  const checks: Record<string, CheckResult> = {
    config: configCheck(),
    bot: await botCheck(),
    supabase: {
      status: "error",
      message: "Supabase check did not run",
    },
    snapshot: {
      status: "warn",
      message: "Snapshot check did not run",
    },
    trades: {
      status: "warn",
      message: "Trade history check did not run",
    },
    cron: {
      status: "ok",
      message: "Cron schedules configured for poll and snapshot capture",
      detail: "Poll runs at 10:45 AM America/Chicago on weekdays via UTC schedules. Daily snapshot runs at 06:00 UTC Tuesday-Saturday.",
    },
  };

  let latestSnapshotTs: string | null = null;
  let latestTradeTs: string | null = null;
  let snapshotCount = 0;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const [
      latestSnapshotResult,
      latestTradeResult,
      snapshotCountResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("dashboard_snapshots")
        .select("id, snapshot_ts", { count: "exact" })
        .order("snapshot_ts", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("trade_history")
        .select("id, closed_at")
        .order("closed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("dashboard_snapshots")
        .select("id", { count: "exact", head: true }),
    ]);

    if (latestSnapshotResult.error) {
      throw new Error(latestSnapshotResult.error.message);
    }

    if (latestTradeResult.error) {
      throw new Error(latestTradeResult.error.message);
    }

    if (snapshotCountResult.error) {
      throw new Error(snapshotCountResult.error.message);
    }

    const latestSnapshot = latestSnapshotResult.data as LatestSnapshotRow | null;
    const latestTrade = latestTradeResult.data as LatestTradeRow | null;

    latestSnapshotTs = latestSnapshot?.snapshot_ts ?? null;
    latestTradeTs = latestTrade?.closed_at ?? null;
    snapshotCount = snapshotCountResult.count ?? 0;

    checks.supabase = {
      status: "ok",
      message: "Supabase reachable",
      detail: `${snapshotCount} snapshot${snapshotCount === 1 ? "" : "s"} stored`,
    };

    if (!latestSnapshotTs) {
      checks.snapshot = {
        status: "warn",
        message: "No dashboard snapshot saved yet",
      };
    } else {
      const todayChicago = chicagoDateKey();
      const latestChicago = chicagoDateKey(new Date(latestSnapshotTs));
      checks.snapshot = latestChicago === todayChicago
        ? {
            status: "ok",
            message: "Snapshot is current for today",
            detail: `Latest saved ${describeAge(latestSnapshotTs)}`,
          }
        : {
            status: "warn",
            message: "Latest snapshot is not from today",
            detail: `Latest saved ${describeAge(latestSnapshotTs)}`,
          };
    }

    checks.trades = latestTradeTs
      ? {
          status: "ok",
          message: "Trade history reachable",
          detail: `Latest trade closed ${describeAge(latestTradeTs)}`,
        }
      : {
          status: "warn",
          message: "No trade history rows found yet",
        };
  } catch (error) {
    checks.supabase = {
      status: "error",
      message: "Supabase check failed",
      detail: error instanceof Error ? error.message : "Unknown Supabase error",
    };
    checks.snapshot = {
      status: "warn",
      message: "Snapshot status unavailable because Supabase check failed",
    };
    checks.trades = {
      status: "warn",
      message: "Trade history status unavailable because Supabase check failed",
    };
  }

  const failed = Object.values(checks).some((check) => check.status === "error");

  return auth.applyCookies(
    NextResponse.json({
      ok: !failed,
      checked_at: new Date().toISOString(),
      latest_snapshot_ts: latestSnapshotTs,
      latest_trade_ts: latestTradeTs,
      snapshot_count: snapshotCount,
      checks,
    })
  );
}
