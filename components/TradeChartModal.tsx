"use client";

import { useEffect, useMemo, useState } from "react";

type CandleRow = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

type CandlePayload = {
  ok: boolean;
  data?: CandleRow[];
  error?: string;
};

type TradeChartModalProps = {
  trade: {
    symbol?: string | null;
    side?: string | null;
    qty?: number | string | null;
    entry_price?: number | string | null;
    exit_price?: number | string | null;
    realized_pl?: number | null;
    opened_at?: string | null;
    closed_at?: string | null;
    source?: string | null;
  } | null;
  onClose: () => void;
};

type ChartCandle = CandleRow & {
  timestamp: number;
  chicagoDayKey: string;
  chicagoTimeLabel: string;
  ema9: number;
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function signedMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  const abs = money(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `-${abs}`;
  return abs;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function padRangeStart(value: string | null | undefined, minutes = 720) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
}

function padRangeEnd(
  openedAt: string | null | undefined,
  closedAt: string | null | undefined,
  minutes = 900,
) {
  const base = closedAt ?? openedAt;
  if (!base) return null;
  const date = new Date(base);
  if (Number.isNaN(date.getTime())) return null;
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function chicagoDayKey(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function chicagoTimeLabel(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function useViewportSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const sync = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return size;
}

function nearestIndex(rows: ChartCandle[], value: string | null | undefined) {
  if (!value || rows.length === 0) return -1;
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return -1;

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  rows.forEach((row, index) => {
    const distance = Math.abs(row.timestamp - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function withEma9(rows: CandleRow[]) {
  const multiplier = 2 / 10;
  let ema: number | null = null;

  return rows
    .map((row) => ({
      ...row,
      timestamp: new Date(row.time).getTime(),
      chicagoDayKey: chicagoDayKey(row.time),
      chicagoTimeLabel: chicagoTimeLabel(row.time),
    }))
    .filter((row) => Number.isFinite(row.timestamp))
    .map((row) => {
      ema = ema === null ? row.close : row.close * multiplier + ema * (1 - multiplier);
      return { ...row, ema9: ema } satisfies ChartCandle;
    });
}

export default function TradeChartModal({ trade, onClose }: TradeChartModalProps) {
  const [candles, setCandles] = useState<CandleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!trade) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, trade]);

  useEffect(() => {
    if (!trade?.symbol) return;
    const activeTrade = trade;
    let cancelled = false;

    async function loadCandles() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({
          symbol: String(activeTrade.symbol).trim().toUpperCase(),
          interval: "5min",
          limit: "500",
        });

        const start = padRangeStart(activeTrade.opened_at);
        const end = padRangeEnd(activeTrade.opened_at, activeTrade.closed_at);

        if (start) params.set("start", start);
        if (end) params.set("end", end);

        const res = await fetch(`/api/market-data/candles?${params.toString()}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as CandlePayload;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load candle data.");
        }

        if (!cancelled) {
          setCandles(json.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load candle data.");
          setCandles([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCandles();

    return () => {
      cancelled = true;
    };
  }, [trade]);

  if (!trade) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#060a0ff2] backdrop-blur-md">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 z-10 rounded-xl border border-white/10 bg-black/35 px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] hover:text-white"
      >
        Exit
      </button>

      <TradeReviewChart
        candles={candles}
        symbol={trade.symbol ?? "--"}
        side={trade.side ?? "--"}
        qty={String(Number(trade.qty ?? 0))}
        entryTime={trade.opened_at}
        exitTime={trade.closed_at}
        entryPrice={Number(trade.entry_price ?? NaN)}
        exitPrice={Number(trade.exit_price ?? NaN)}
        realizedPl={trade.realized_pl}
        loading={loading}
        error={error}
      />
    </div>
  );
}

function TradeReviewChart({
  candles,
  symbol,
  side,
  qty,
  entryTime,
  exitTime,
  entryPrice,
  exitPrice,
  realizedPl,
  loading,
  error,
}: {
  candles: CandleRow[];
  symbol: string;
  side: string;
  qty: string;
  entryTime: string | null | undefined;
  exitTime: string | null | undefined;
  entryPrice: number;
  exitPrice: number;
  realizedPl: number | null | undefined;
  loading: boolean;
  error: string;
}) {
  const viewport = useViewportSize();

  const chartCandles = useMemo(() => withEma9(candles), [candles]);
  const targetDay = chicagoDayKey(entryTime ?? exitTime);
  const dayCandles = useMemo(() => {
    const matching = chartCandles.filter((row) => row.chicagoDayKey === targetDay);
    return matching.length ? matching : chartCandles;
  }, [chartCandles, targetDay]);

  const visibleCandles = useMemo(() => dayCandles, [dayCandles]);

  const visibleEntryIndex = useMemo(() => nearestIndex(visibleCandles, entryTime), [visibleCandles, entryTime]);
  const visibleExitIndex = useMemo(() => nearestIndex(visibleCandles, exitTime), [visibleCandles, exitTime]);
  const entryCandle = visibleEntryIndex >= 0 ? visibleCandles[visibleEntryIndex] : null;
  const exitCandle = visibleExitIndex >= 0 ? visibleCandles[visibleExitIndex] : null;

  const width = Math.max(viewport.width - 24, 1280);
  const height = Math.max(viewport.height - 24, 760);
  const chartReady = viewport.width > 0 && viewport.height > 0;
  const margin = { top: 96, right: 92, bottom: 76, left: 48 };
  const innerWidth = Math.max(width - margin.left - margin.right, 240);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 280);
  const candleHeight = innerHeight;

  const low = visibleCandles.length ? Math.min(...visibleCandles.map((row) => Math.min(row.low, row.ema9))) : 0;
  const high = visibleCandles.length ? Math.max(...visibleCandles.map((row) => Math.max(row.high, row.ema9))) : 1;
  const priceSpan = Math.max(high - low, 0.01);
  const paddedLow = Math.max(0, low - priceSpan * 0.12);
  const paddedHigh = high + priceSpan * 0.12;
  const paddedSpan = Math.max(paddedHigh - paddedLow, 0.01);
  const step = innerWidth / Math.max(visibleCandles.length, 1);
  const candleWidth = Math.max(Math.min(step * 0.82, 12), 3.5);

  const xForIndex = (index: number) =>
    margin.left + (visibleCandles.length <= 1 ? innerWidth / 2 : (index / (visibleCandles.length - 1)) * innerWidth);
  const yForPrice = (price: number) => margin.top + ((paddedHigh - price) / paddedSpan) * candleHeight;
  return (
    <div className="flex h-full w-full flex-col bg-[linear-gradient(180deg,#101721,#0b121b)]">
      <div className="relative flex-1 p-4">
        <div className="h-full min-h-[760px] w-full overflow-hidden rounded-[28px] border border-white/8 bg-[#f7f3eb]">
          {chartReady && visibleCandles.length > 0 ? (
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              className="block h-full w-full"
              preserveAspectRatio="none"
            >
              <rect x="0" y="0" width={width} height={height} fill="#f7f3eb" />

              <text x={margin.left} y={42} fontSize="30" fontWeight="700" fill="#0f172a">
                {symbol}
              </text>
              <text x={margin.left} y={68} fontSize="13" fill="rgba(15,23,42,0.62)">
                {side} · Qty {qty} · 5 MIN · Entry {formatDate(entryTime)} · Exit {formatDate(exitTime)} · P/L {signedMoney(realizedPl)}
              </text>

              <text
                x={margin.left + innerWidth}
                y={68}
                textAnchor="end"
                fontSize="12"
                fontWeight="600"
                fill="#2563eb"
              >
                EMA 9
              </text>

              {Array.from({ length: 7 }).map((_, index) => {
                const y = margin.top + (index / 6) * candleHeight;
                return (
                  <line
                    key={`grid-${index}`}
                    x1={margin.left}
                    y1={y}
                    x2={margin.left + innerWidth}
                    y2={y}
                    stroke="rgba(15,23,42,0.08)"
                    strokeWidth="1"
                  />
                );
              })}

              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                points={visibleCandles.map((candle, index) => `${xForIndex(index)},${yForPrice(candle.ema9)}`).join(" ")}
              />

              {visibleCandles.map((candle, index) => {
                const x = xForIndex(index);
                const wickTop = yForPrice(candle.high);
                const wickBottom = yForPrice(candle.low);
                const openY = yForPrice(candle.open);
                const closeY = yForPrice(candle.close);
                const bodyTop = Math.min(openY, closeY);
                const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
                const color = candle.close >= candle.open ? "#2ca58d" : "#ef5350";

                return (
                  <g key={`${candle.time}-${index}`}>
                    <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={color} strokeWidth="1.5" />
                    <rect
                      x={x - candleWidth / 2}
                      y={bodyTop}
                      width={candleWidth}
                      height={bodyHeight}
                      rx="1"
                      fill={color}
                    />
                  </g>
                );
              })}

              {entryCandle ? (
                <MarkerBubble
                  x={xForIndex(visibleEntryIndex)}
                  y={yForPrice(entryCandle.close)}
                  label={`Entry ${entryPrice.toFixed(2)}`}
                  direction="up"
                  color="#2cc7c2"
                />
              ) : null}

              {exitCandle ? (
                <MarkerBubble
                  x={xForIndex(visibleExitIndex)}
                  y={yForPrice(exitCandle.close)}
                  label={`Exit ${exitPrice.toFixed(2)}`}
                  direction="down"
                  color="#a855f7"
                />
              ) : null}

              {Array.from({ length: 7 }).map((_, index) => {
                const price = paddedHigh - (index / 6) * paddedSpan;
                const y = margin.top + (index / 6) * candleHeight;
                return (
                  <text
                    key={`label-${index}`}
                    x={margin.left + innerWidth + 12}
                    y={y + 4}
                    fontSize="11"
                    fill="rgba(15,23,42,0.68)"
                  >
                    {price.toFixed(2)}
                  </text>
                );
              })}

              {visibleCandles
                .filter((_, index) => index % Math.max(Math.ceil(visibleCandles.length / 10), 1) === 0)
                .map((candle, index) => (
                  <text
                    key={`time-${candle.time}-${index}`}
                    x={xForIndex(visibleCandles.indexOf(candle))}
                    y={height - 14}
                    fontSize="11"
                    textAnchor="middle"
                    fill="rgba(15,23,42,0.62)"
                  >
                    {candle.chicagoTimeLabel}
                  </text>
                ))}
            </svg>
          ) : null}
        </div>

        {loading || !chartReady ? (
          <div className="absolute inset-4 flex items-center justify-center rounded-[28px] border border-white/8 bg-[#f7f3eb]/92 text-sm text-slate-600 backdrop-blur-sm">
            {loading ? "Loading 5-minute candles..." : "Preparing chart..."}
          </div>
        ) : null}

        {!loading && error ? (
          <div className="absolute inset-4 flex items-center justify-center rounded-[28px] border border-red-400/20 bg-[#081018]/92 px-6 backdrop-blur-sm">
            <div className="max-w-xl rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-center text-sm text-red-200">
              <div className="text-[10px] uppercase tracking-[0.22em] text-red-200/70">Chart Error</div>
              <div className="mt-2 break-words">{error}</div>
            </div>
          </div>
        ) : null}

        {!loading && !error && !visibleCandles.length ? (
          <div className="absolute inset-4 flex items-center justify-center rounded-[28px] border border-white/8 bg-[#f7f3eb]/92 px-6 text-center text-sm text-slate-600 backdrop-blur-sm">
            No candle data returned for this trade window yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MarkerBubble({
  x,
  y,
  label,
  direction,
  color,
}: {
  x: number;
  y: number;
  label: string;
  direction: "up" | "down";
  color: string;
}) {
  const bubbleWidth = Math.max(label.length * 6.2 + 20, 92);
  const bubbleHeight = 30;
  const bubbleX = x - bubbleWidth / 2;
  const bubbleY = direction === "up" ? y + 18 : y - bubbleHeight - 18;
  const pointerY = direction === "up" ? bubbleY : bubbleY + bubbleHeight;
  const pointerTipY = direction === "up" ? y + 4 : y - 4;

  return (
    <g>
      <line
        x1={x}
        y1={direction === "up" ? y + 8 : y - 8}
        x2={x}
        y2={direction === "up" ? bubbleY : bubbleY + bubbleHeight}
        stroke={color}
        strokeWidth="1.5"
        opacity="0.65"
      />
      <path d={`M ${x - 7} ${pointerY} L ${x} ${pointerTipY} L ${x + 7} ${pointerY}`} fill={color} opacity="0.95" />
      <rect x={bubbleX} y={bubbleY} width={bubbleWidth} height={bubbleHeight} rx="15" fill={color} />
      <text x={x} y={bubbleY + 20} textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff">
        {label}
      </text>
    </g>
  );
}
