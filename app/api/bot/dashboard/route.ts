import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM =
  process.env.BOT_DASHBOARD_UPSTREAM ?? "https://dashboard.ngtdashboard.com";

export async function GET() {
  try {
    const res = await fetch(`${UPSTREAM}/api/dashboard`, {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Upstream bot dashboard failed",
          status: res.status,
        },
        {
          status: 502,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const upstream = await res.json();

    return NextResponse.json(
      {
        ok: upstream?.ok ?? true,
        data: upstream?.data ?? upstream,
        ts: new Date().toISOString(),
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Unknown error",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}