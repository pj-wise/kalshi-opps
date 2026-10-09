"use client";

import {
  Bar,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";

export interface CalibrationBucket {
  bucket: string; // "10%", "20%", etc.
  predicted: number; // mid-of-bucket predicted probability 0-1
  observed: number | null; // observed hit rate 0-1
  count: number;
}

export function CalibrationChart({ buckets }: { buckets: CalibrationBucket[] }) {
  const data = buckets.map((b) => ({
    bucket: b.bucket,
    predicted: Math.round(b.predicted * 100),
    observed: b.observed == null ? null : Math.round(b.observed * 100),
    count: b.count,
  }));
  const hasAny = buckets.some((b) => b.count > 0);
  if (!hasAny) {
    return (
      <div className="flex h-56 items-center justify-center text-xs text-zinc-500">
        no resolved predictions yet
      </div>
    );
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="2 4" />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 10, fill: "#71717a" }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={(v: number) => `${v}%`}
            width={32}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#09090b", border: "1px solid #27272a", fontSize: 11 }}
            formatter={(value, name) => [value == null ? "—" : `${value}%`, name as string]}
          />
          <ReferenceLine
            segment={[{ x: "10%", y: 10 }, { x: "90%", y: 90 }]}
            stroke="#52525b"
            strokeDasharray="3 3"
          />
          <Bar dataKey="count" yAxisId="right" fill="#1e3a8a66" />
          <Line type="monotone" dataKey="observed" stroke="#34d399" strokeWidth={1.5} dot />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: "#71717a" }}
            axisLine={{ stroke: "#3f3f46" }}
            tickLine={false}
            width={30}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
