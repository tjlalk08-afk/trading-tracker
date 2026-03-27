import { NextRequest, NextResponse } from "next/server";
import { getBotDashboardUrl } from "@/lib/botDashboardUrl";
import { requireApprovedApiUser } from "@/lib/requireApprovedApiUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof requireApprovedApiUser>> | null = null;
  try {
    auth = await requireApprovedApiUser(req);
    if ("error" in auth) return auth.error;

    const res = await fetch(getBotDashboardUrl(), {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });

    if (!res.ok) {
      return auth.applyCookies(
        NextResponse.json(
          {
            ok: false,
            error: "Upstream bot dashboard failed",
            status: res.status,
          },
          {
            status: 502,
            headers: { "Cache-Control": "no-store" },
          }
        )
      );
    }

    const upstream = await res.json();

    const payload =
      typeof upstream?.data === "object" && upstream?.data !== null ? upstream.data : upstream;
    const directEquity = Number((payload as Record<string, unknown>)?.equity ?? NaN);
    const directCash = Number((payload as Record<string, unknown>)?.cash ?? NaN);
    const liveEquity = Number((payload as Record<string, unknown>)?.live_equity ?? NaN);
    const testEquity = Number((payload as Record<string, unknown>)?.test_equity ?? NaN);
    const mode =
      directEquity === 10000 ||
      directCash === 10000 ||
      (liveEquity === 0 && testEquity === 10000)
        ? "paper"
        : "live";

    return auth.applyCookies(
      NextResponse.json(
        {
          ok: upstream?.ok ?? true,
          data: {
            ...(payload as Record<string, unknown>),
            mode,
          },
          ts: new Date().toISOString(),
        },
        {
          headers: { "Cache-Control": "no-store" },
        }
      )
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    const response = NextResponse.json(
      {
        ok: false,
        error: `Bot dashboard upstream fetch failed: ${message}`,
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
    return auth && !("error" in auth) ? auth.applyCookies(response) : response;
  }
}
