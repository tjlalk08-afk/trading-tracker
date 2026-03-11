import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TradeRow = {
  symbol: string | null;
  realized_pl: number | null;
  source: string | null;
  trade_day: string | null;
  closed_at: string | null;
};

function startDateFromRange(range: string): string {
  const now = new Date();
  const d = new Date(now);

  switch (range) {
    case "7d":
      d.setDate(d.getDate() - 7);
      break;
    case "30d":
      d.setDate(d.getDate() - 30);
      break;
    case "1y":
    default:
      d.setFullYear(d.getFullYear() - 1);
      break;
  }

  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") ?? "30d";
    const startDate = startDateFromRange(range);

    const { data, error } = await supabaseAdmin
      .from("trade_history")
      .select("symbol, realized_pl, source, trade_day, closed_at")
      .eq("source", "brother_live")
      .gte("trade_day", startDate)
      .order("trade_day", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as TradeRow[];

    const bySymbol = new Map<
      string,
      {
        symbol: string;
        trades: number;
        wins: number;
        losses: number;
        flat: number;
        realized_pl: number;
        gross_wins: number;
        gross_losses: number;
      }
    >();

    for (const row of rows) {
      const symbol = (row.symbol ?? "").trim().toUpperCase();
      if (!symbol) continue;

      const realized = Number(row.realized_pl ?? 0);

      if (!bySymbol.has(symbol)) {
        bySymbol.set(symbol, {
          symbol,
          trades: 0,
          wins: 0,
          losses: 0,
          flat: 0,
          realized_pl: 0,
          gross_wins: 0,
          gross_losses: 0,
        });
      }

      const bucket = bySymbol.get(symbol)!;
      bucket.trades += 1;
      bucket.realized_pl += realized;

      if (realized > 0) {
        bucket.wins += 1;
        bucket.gross_wins += realized;
      } else if (realized < 0) {
        bucket.losses += 1;
        bucket.gross_losses += realized;
      } else {
        bucket.flat += 1;
      }
    }

    const symbols = Array.from(bySymbol.values())
      .map((row) => {
        const decisiveTrades = row.wins + row.losses;
        const winRate =
          decisiveTrades > 0 ? (row.wins / decisiveTrades) * 100 : 0;

        const avgWin = row.wins > 0 ? row.gross_wins / row.wins : 0;
        const avgLoss = row.losses > 0 ? row.gross_losses / row.losses : 0;

        return {
          symbol: row.symbol,
          trades: row.trades,
          wins: row.wins,
          losses: row.losses,
          flat: row.flat,
          win_rate: Number(winRate.toFixed(1)),
          realized_pl: Number(row.realized_pl.toFixed(2)),
          avg_win: Number(avgWin.toFixed(2)),
          avg_loss: Number(avgLoss.toFixed(2)),
        };
      })
      .sort((a, b) => b.realized_pl - a.realized_pl);

    const totalTrades = symbols.reduce((sum, s) => sum + s.trades, 0);
    const totalWins = symbols.reduce((sum, s) => sum + s.wins, 0);
    const totalLosses = symbols.reduce((sum, s) => sum + s.losses, 0);
    const totalRealized = symbols.reduce((sum, s) => sum + s.realized_pl, 0);

    const decisive = totalWins + totalLosses;
    const overallWinRate = decisive > 0 ? (totalWins / decisive) * 100 : 0;

    return NextResponse.json({
      ok: true,
      range,
      start_date: startDate,
      summary: {
        symbols: symbols.length,
        trades: totalTrades,
        realized_pl: Number(totalRealized.toFixed(2)),
        win_rate: Number(overallWinRate.toFixed(1)),
      },
      rows: symbols,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown symbols error";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}