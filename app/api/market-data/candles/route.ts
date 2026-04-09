import { NextRequest, NextResponse } from "next/server";
import { fetchJsonWithTimeout } from "@/lib/fetchJsonWithTimeout";
import { requireApprovedApiUser } from "@/lib/requireApprovedApiUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TwelveDataRow = {
  datetime?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
};

type TwelveDataResponse = {
  status?: string;
  message?: string;
  values?: TwelveDataRow[];
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatUtcForTwelveData(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return [
    date.getUTCFullYear(),
    "-",
    pad(date.getUTCMonth() + 1),
    "-",
    pad(date.getUTCDate()),
    " ",
    pad(date.getUTCHours()),
    ":",
    pad(date.getUTCMinutes()),
    ":",
    pad(date.getUTCSeconds()),
  ].join("");
}

function clampLimit(value: string | null) {
  const parsed = Number(value ?? 120);
  if (!Number.isFinite(parsed)) return 120;
  return Math.max(20, Math.min(500, Math.floor(parsed)));
}

function normalizeSymbol(symbol: string | null) {
  const clean = String(symbol ?? "").trim().toUpperCase();
  return clean || null;
}

export async function GET(req: NextRequest) {
  const auth = await requireApprovedApiUser(req);
  if ("error" in auth) return auth.error;

  try {
    const apiKey = (process.env.TWELVE_DATA_API_KEY ?? "").trim();
    if (!apiKey) {
      return auth.applyCookies(
        NextResponse.json(
          { ok: false, error: "TWELVE_DATA_API_KEY is not configured." },
          { status: 500 },
        ),
      );
    }

    const { searchParams } = new URL(req.url);
    const symbol = normalizeSymbol(searchParams.get("symbol"));
    const start = formatUtcForTwelveData(searchParams.get("start") ?? "");
    const end = formatUtcForTwelveData(searchParams.get("end") ?? "");
    const interval = (searchParams.get("interval") ?? "5min").trim();
    const limit = clampLimit(searchParams.get("limit"));

    if (!symbol) {
      return auth.applyCookies(
        NextResponse.json({ ok: false, error: "symbol is required" }, { status: 400 }),
      );
    }

    const params = new URLSearchParams({
      apikey: apiKey,
      symbol,
      interval,
      format: "JSON",
      timezone: "UTC",
      order: "ASC",
      outputsize: String(limit),
    });

    if (start) params.set("start_date", start);
    if (end) params.set("end_date", end);

    const json = await fetchJsonWithTimeout<TwelveDataResponse>(
      `https://api.twelvedata.com/time_series?${params.toString()}`,
      {
        cache: "no-store",
        timeoutMs: 15000,
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (json.status === "error") {
      return auth.applyCookies(
        NextResponse.json(
          { ok: false, error: json.message || "Twelve Data returned an error." },
          { status: 502 },
        ),
      );
    }

    const rows = (json.values ?? [])
      .map((row) => {
        const time = row.datetime ? new Date(`${row.datetime}Z`).toISOString() : null;
        const open = Number(row.open ?? NaN);
        const high = Number(row.high ?? NaN);
        const low = Number(row.low ?? NaN);
        const close = Number(row.close ?? NaN);
        const volume = row.volume == null ? null : Number(row.volume);

        if (
          !time ||
          !Number.isFinite(open) ||
          !Number.isFinite(high) ||
          !Number.isFinite(low) ||
          !Number.isFinite(close)
        ) {
          return null;
        }

        return {
          time,
          open,
          high,
          low,
          close,
          volume: Number.isFinite(volume) ? volume : null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return auth.applyCookies(
      NextResponse.json({
        ok: true,
        symbol,
        interval,
        data: rows,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown market-data candles error";
    const response = NextResponse.json({ ok: false, error: message }, { status: 500 });
    return auth.applyCookies(response);
  }
}
