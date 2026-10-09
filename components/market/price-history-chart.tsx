"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface PricePoint {
  t: string;
  yes: number | null;
  model: number | null;
}

export function PriceHistoryChart({ data }: { data: PricePoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center text-xs text-zinc-500">
        not enough history yet — snapshots are collected on each refresh
      </div>
    );
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="2 4" />
          <XAxis
            dataKey="t"
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={(v: string) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            minTickGap={32}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={(v: number) => `${v}¢`}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#09090b",
              border: "1px solid #27272a",
              fontSize: 11,
            }}
            formatter={(value, name) => [`${typeof value === "number" ? value.toFixed(1) : value}¢`, name as string]}
            labelFormatter={(v) => new Date(String(v)).toLocaleString()}
          />
          <Line
            type="monotone"
            dataKey="yes"
            name="market"
            stroke="#60a5fa"
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="model"
            name="model"
            stroke="#34d399"
            dot={false}
            strokeWidth={1.5}
            strokeDasharray="4 2"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
