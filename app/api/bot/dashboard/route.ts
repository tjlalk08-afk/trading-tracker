import { NextRequest, NextResponse } from "next/server";
import { getBotDashboardUrl } from "@/lib/botDashboardUrl";
import { fetchJsonWithTimeout } from "@/lib/fetchJsonWithTimeout";
import { requireApprovedApiUser } from "@/lib/requireApprovedApiUser";
import { detectBotMode } from "@/lib/botMode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let auth: Awaited<ReturnType<typeof requireApprovedApiUser>> | null = null;
  try {
    auth = await requireApprovedApiUser(req);
    if ("error" in auth) return auth.error;

    const upstream = await fetchJsonWithTimeout<Record<string, unknown>>(getBotDashboardUrl(), {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
      timeoutMs: 15000,
    });

    const payload =
      typeof upstream?.data === "object" && upstream?.data !== null ? upstream.data : upstream;
    const upstreamOk = upstream?.ok;

    if (upstreamOk === false) {
      return auth.applyCookies(
        NextResponse.json(
          {
            ok: false,
            error: "Upstream bot dashboard reported failure",
          },
          {
            status: 502,
            headers: { "Cache-Control": "no-store" },
          }
        )
      );
    }

    const mode = detectBotMode(upstream);

    return auth.applyCookies(
      NextResponse.json(
        {
          ok: upstreamOk ?? true,
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
