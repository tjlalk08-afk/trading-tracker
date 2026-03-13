"use client";

import { useMemo } from "react";
import type { TradeJournalCandle, TradeJournalLinePoint } from "@/lib/tradeJournal";

function formatLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function markerX(
  time: string | null,
  minTime: number,
  maxTime: number,
  width: number,
  padLeft: number,
  padRight: number,
) {
  if (!time) return null;
  const ms = new Date(time).getTime();
  if (!Number.isFinite(ms) || maxTime === minTime) return null;
  return padLeft + ((ms - minTime) / (maxTime - minTime)) * (width - padLeft - padRight);
}

export default function TradeCandleChart({
  candles,
  openedAt,
  closedAt,
  ema10 = [],
}: {
  candles: TradeJournalCandle[];
  openedAt: string | null;
  closedAt: string | null;
  ema10?: TradeJournalLinePoint[];
}) {
  const width = 980;
  const height = 420;
  const padLeft = 18;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 28;

  const chart = useMemo(() => {
    if (!candles.length) return null;

    const times = candles.map((candle) => new Date(candle.time).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const lows = candles.map((candle) => candle.low);
    const highs = candles.map((candle) => candle.high);
    const minPrice = Math.min(...lows);
    const maxPrice = Math.max(...highs);
    const spread = maxPrice - minPrice || 1;
    const innerWidth = width - padLeft - padRight;
    const innerHeight = height - padTop - padBottom;
    const candleWidth = Math.max(6, Math.min(18, innerWidth / Math.max(candles.length * 1.15, 1)));

    const y = (price: number) =>
      padTop + (1 - (price - minPrice) / spread) * innerHeight;

    const x = (index: number) =>
      padLeft + (index / Math.max(candles.length - 1, 1)) * innerWidth;

    const entryX = markerX(openedAt, minTime, maxTime, width, padLeft, padRight);
    const exitX = markerX(closedAt, minTime, maxTime, width, padLeft, padRight);

    return {
      minPrice,
      maxPrice,
      y,
      x,
      candleWidth,
      entryX,
      exitX,
    };
  }, [candles, closedAt, openedAt]);

  if (!chart || candles.length === 0) {
    return (
      <div className="flex h-[460px] items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm text-white/55">
        No 5-minute candle data was available for this trade window.
      </div>
    );
  }

  const axisLabels = [
    chart.maxPrice,
    chart.maxPrice - (chart.maxPrice - chart.minPrice) / 2,
    chart.minPrice,
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[460px] w-full">
        <rect x="0" y="0" width={width} height={height} fill="transparent" />

        {axisLabels.map((price, index) => {
          const y = chart.y(price);
          return (
            <g key={price}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray={index === 1 ? "4 8" : "3 9"}
              />
              <text x={width - 4} y={y + 4} fill="rgba(255,255,255,0.55)" fontSize="11" textAnchor="end">
                {price.toFixed(2)}
              </text>
            </g>
          );
        })}

        {chart.entryX !== null ? (
          <g>
            <line
              x1={chart.entryX}
              x2={chart.entryX}
              y1={padTop}
              y2={height - padBottom}
              stroke="rgba(34,197,94,0.9)"
              strokeDasharray="5 5"
            />
            <text x={chart.entryX + 6} y={padTop + 12} fill="rgba(110,231,183,0.95)" fontSize="11">
              Entry
            </text>
          </g>
        ) : null}

        {chart.exitX !== null ? (
          <g>
            <line
              x1={chart.exitX}
              x2={chart.exitX}
              y1={padTop}
              y2={height - padBottom}
              stroke="rgba(251,191,36,0.9)"
              strokeDasharray="5 5"
            />
            <text x={chart.exitX + 6} y={padTop + 28} fill="rgba(253,224,71,0.95)" fontSize="11">
              Exit
            </text>
          </g>
        ) : null}

        {candles.map((candle, index) => {
          const x = chart.x(index);
          const openY = chart.y(candle.open);
          const closeY = chart.y(candle.close);
          const highY = chart.y(candle.high);
          const lowY = chart.y(candle.low);
          const up = candle.close >= candle.open;
          const color = up ? "#15dcff" : "#ff00b8";
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(Math.abs(closeY - openY), 1.5);

          return (
            <g key={candle.time}>
              <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth="1.2" />
              <rect
                x={x - chart.candleWidth / 2}
                y={bodyTop}
                width={chart.candleWidth}
                height={bodyHeight}
                fill={color}
                rx="0.8"
              />
            </g>
          );
        })}

        {ema10.length > 1 ? (
          <polyline
            fill="none"
            stroke="rgba(84,160,255,0.92)"
            strokeWidth="1.4"
            points={ema10
              .map((point, index) => `${chart.x(index)},${chart.y(point.value)}`)
              .join(" ")}
          />
        ) : null}

        {candles
          .filter((_, index) => index % Math.max(Math.floor(candles.length / 6), 1) === 0)
          .map((candle) => {
            const index = candles.findIndex((row) => row.time === candle.time);
            const x = chart.x(index);
            return (
              <text
                key={`label-${candle.time}`}
                x={x}
                y={height - 8}
                fill="rgba(255,255,255,0.55)"
                fontSize="11"
                textAnchor="middle"
              >
                {formatLabel(candle.time)}
              </text>
            );
          })}

        <text x={padLeft + 4} y={padTop + 14} fill="rgba(84,160,255,0.92)" fontSize="11">
          EMA 10
        </text>
      </svg>
    </div>
  );
}
