"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { date: "Start", equity: 10000 },
];

export default function PerformancePage() {
  return (
    <>
      <h1 className="text-3xl font-bold mb-10 tracking-wide">
        Equity Curve
      </h1>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-10 h-[450px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="date" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="equity"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}