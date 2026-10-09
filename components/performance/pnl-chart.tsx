"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface PnlPoint {
  t: string;
  cumulative: number;
}

export function PnlChart({ points }: { points: PnlPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-xs text-zinc-500">
        no paper trades resolved yet
      </div>
    );
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="pnl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="2 4" />
          <XAxis
            dataKey="t"
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={(v: string) => new Date(v).toLocaleDateString()}
            minTickGap={64}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={(v: number) => `$${(v / 100).toFixed(0)}`}
            width={48}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#09090b", border: "1px solid #27272a", fontSize: 11 }}
            formatter={(v) => [`$${(typeof v === "number" ? v / 100 : 0).toFixed(2)}`, "cum. P&L"]}
            labelFormatter={(v) => new Date(String(v)).toLocaleString()}
          />
          <Area dataKey="cumulative" type="monotone" stroke="#34d399" fill="url(#pnl)" strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
