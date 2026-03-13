import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  TradeJournalDetailRow,
  TradeJournalCandle,
  TradeJournalLinePoint,
} from "@/lib/tradeJournal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: {
      description?: string;
    } | null;
  };
};

function normalizeChartSymbol(
  trade: Pick<TradeJournalDetailRow, "option_symbol" | "chart_symbol" | "display_symbol" | "symbol">,
) {
  return (trade.option_symbol ?? trade.chart_symbol ?? trade.display_symbol ?? trade.symbol ?? "SPY")
    .replace(/\s+/g, "")
    .replace(
    /_TEST$/i,
    "",
  );
}

function buildWindow(openedAt: string | null, closedAt: string | null) {
  const openMs = openedAt ? new Date(openedAt).getTime() : Date.now();
  const closeMs = closedAt ? new Date(closedAt).getTime() : openMs + 60 * 60 * 1000;
  const safeOpen = Number.isFinite(openMs) ? openMs : Date.now();
  const safeClose = Number.isFinite(closeMs) ? closeMs : safeOpen + 60 * 60 * 1000;
  const durationMs = Math.max(safeClose - safeOpen, 60 * 1000);
  const beforeMs = Math.min(Math.max(durationMs * 3, 15 * 60 * 1000), 35 * 60 * 1000);
  const afterMs = Math.min(Math.max(durationMs * 2, 10 * 60 * 1000), 25 * 60 * 1000);

  return {
    period1: Math.floor((safeOpen - beforeMs) / 1000),
    period2: Math.floor((safeClose + afterMs) / 1000),
  };
}

function mapYahooCandles(payload: YahooChartResponse): TradeJournalCandle[] {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const opens = quote?.open ?? [];
  const highs = quote?.high ?? [];
  const lows = quote?.low ?? [];
  const closes = quote?.close ?? [];
  const volumes = quote?.volume ?? [];

  const candles: TradeJournalCandle[] = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const open = opens[index];
    const high = highs[index];
    const low = lows[index];
    const close = closes[index];

    if (
      open === null ||
      high === null ||
      low === null ||
      close === null ||
      open === undefined ||
      high === undefined ||
      low === undefined ||
      close === undefined
    ) {
      continue;
    }

    candles.push({
      time: new Date(timestamps[index] * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume: volumes[index] ?? null,
    });
  }

  return candles;
}

function buildEma(candles: TradeJournalCandle[], period: number): TradeJournalLinePoint[] {
  if (candles.length === 0) return [];

  const smoothing = 2 / (period + 1);
  let ema = candles[0].close;

  return candles.map((candle, index) => {
    if (index === 0) {
      ema = candle.close;
    } else {
      ema = candle.close * smoothing + ema * (1 - smoothing);
    }

    return {
      time: candle.time,
      value: ema,
    };
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const admin = getSupabaseAdmin();

    const tradeResult = await admin
      .from("trade_journal_trades")
      .select("id, symbol, display_symbol, chart_symbol, opened_at, closed_at, chart_timeframe, option_symbol")
      .eq("id", id)
      .maybeSingle();

    if (tradeResult.error) {
      return NextResponse.json(
        { ok: false, error: `Failed to load trade for candles: ${tradeResult.error.message}` },
        { status: 500 },
      );
    }

    const trade = tradeResult.data as Pick<
      TradeJournalDetailRow,
      "id" | "symbol" | "display_symbol" | "chart_symbol" | "opened_at" | "closed_at" | "chart_timeframe" | "option_symbol"
    > | null;

    if (!trade) {
      return NextResponse.json({ ok: false, error: "Trade not found" }, { status: 404 });
    }

    const symbol = normalizeChartSymbol(trade);
    const { period1, period2 } = buildWindow(trade.opened_at ?? null, trade.closed_at ?? null);

    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?interval=5m&period1=${period1}&period2=${period2}&includePrePost=true&events=div,splits`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0",
      },
    });

    const payload = (await response.json()) as YahooChartResponse;
    if (!response.ok || payload.chart?.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            payload.chart?.error?.description ||
            `Failed to fetch candle data for ${symbol}`,
        },
        { status: 502 },
      );
    }

    const candles = mapYahooCandles(payload);

    return NextResponse.json({
      ok: true,
      symbol,
      interval: trade.chart_timeframe ?? "5m",
      candles,
      overlays: {
        ema10: buildEma(candles, 10),
      },
      option_symbol: trade.option_symbol ?? null,
      opened_at: trade.opened_at,
      closed_at: trade.closed_at,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected candle fetch error",
      },
      { status: 500 },
    );
  }
}
