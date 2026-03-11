import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SymbolRow = {
  symbol: string;
  realizedPL: number;
  openPL: number;
  totalPL: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
};

function buildRows(days: number): SymbolRow[] {
  if (days <= 7) {
    return [
      {
        symbol: "SPY",
        realizedPL: 482.35,
        openPL: 64.2,
        totalPL: 546.55,
        trades: 11,
        wins: 8,
        losses: 3,
        winRate: 72.7,
        avgWin: 86.4,
        avgLoss: -69.6,
      },
      {
        symbol: "NVDA",
        realizedPL: 214.8,
        openPL: -28.5,
        totalPL: 186.3,
        trades: 6,
        wins: 4,
        losses: 2,
        winRate: 66.7,
        avgWin: 79.2,
        avgLoss: -51.0,
      },
      {
        symbol: "PLTR",
        realizedPL: 128.1,
        openPL: 15.9,
        totalPL: 144.0,
        trades: 5,
        wins: 4,
        losses: 1,
        winRate: 80.0,
        avgWin: 41.8,
        avgLoss: -39.1,
      },
      {
        symbol: "AAPL",
        realizedPL: -96.4,
        openPL: 12.0,
        totalPL: -84.4,
        trades: 4,
        wins: 1,
        losses: 3,
        winRate: 25.0,
        avgWin: 58.4,
        avgLoss: -51.6,
      },
    ];
  }

  if (days <= 30) {
    return [
      {
        symbol: "SPY",
        realizedPL: 1642.75,
        openPL: 64.2,
        totalPL: 1706.95,
        trades: 34,
        wins: 25,
        losses: 9,
        winRate: 73.5,
        avgWin: 92.4,
        avgLoss: -74.1,
      },
      {
        symbol: "NVDA",
        realizedPL: 938.4,
        openPL: -28.5,
        totalPL: 909.9,
        trades: 18,
        wins: 12,
        losses: 6,
        winRate: 66.7,
        avgWin: 101.7,
        avgLoss: -47.0,
      },
      {
        symbol: "PLTR",
        realizedPL: 711.2,
        openPL: 15.9,
        totalPL: 727.1,
        trades: 17,
        wins: 13,
        losses: 4,
        winRate: 76.5,
        avgWin: 68.6,
        avgLoss: -45.2,
      },
      {
        symbol: "AAPL",
        realizedPL: 304.5,
        openPL: 12.0,
        totalPL: 316.5,
        trades: 12,
        wins: 7,
        losses: 5,
        winRate: 58.3,
        avgWin: 61.5,
        avgLoss: -25.2,
      },
      {
        symbol: "META",
        realizedPL: -188.3,
        openPL: 0,
        totalPL: -188.3,
        trades: 9,
        wins: 4,
        losses: 5,
        winRate: 44.4,
        avgWin: 56.8,
        avgLoss: -83.1,
      },
    ];
  }

  return [
    {
      symbol: "SPY",
      realizedPL: 6248.9,
      openPL: 64.2,
      totalPL: 6313.1,
      trades: 126,
      wins: 91,
      losses: 35,
      winRate: 72.2,
      avgWin: 97.5,
      avgLoss: -75.3,
    },
    {
      symbol: "NVDA",
      realizedPL: 3418.7,
      openPL: -28.5,
      totalPL: 3390.2,
      trades: 62,
      wins: 41,
      losses: 21,
      winRate: 66.1,
      avgWin: 109.4,
      avgLoss: -50.2,
    },
    {
      symbol: "PLTR",
      realizedPL: 2895.4,
      openPL: 15.9,
      totalPL: 2911.3,
      trades: 58,
      wins: 43,
      losses: 15,
      winRate: 74.1,
      avgWin: 78.7,
      avgLoss: -32.6,
    },
    {
      symbol: "AAPL",
      realizedPL: 1216.3,
      openPL: 12.0,
      totalPL: 1228.3,
      trades: 39,
      wins: 23,
      losses: 16,
      winRate: 59.0,
      avgWin: 69.3,
      avgLoss: -23.6,
    },
    {
      symbol: "META",
      realizedPL: 508.4,
      openPL: 0,
      totalPL: 508.4,
      trades: 28,
      wins: 14,
      losses: 14,
      winRate: 50.0,
      avgWin: 73.5,
      avgLoss: -37.2,
    },
    {
      symbol: "QQQ",
      realizedPL: -244.6,
      openPL: 0,
      totalPL: -244.6,
      trades: 17,
      wins: 7,
      losses: 10,
      winRate: 41.2,
      avgWin: 66.9,
      avgLoss: -71.3,
    },
  ];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") || "30");

    const rows = buildRows(days).sort((a, b) => b.realizedPL - a.realizedPL);

    return NextResponse.json({
      ok: true,
      mock: true,
      timeframeDays: days,
      rows,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.message || "Unexpected server error",
        rows: [],
      },
      { status: 500 }
    );
  }
}