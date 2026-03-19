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

    return auth.applyCookies(
      NextResponse.json(
        {
          ok: upstream?.ok ?? true,
          data: upstream?.data ?? upstream,
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
