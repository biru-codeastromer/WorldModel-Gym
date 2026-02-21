"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { LeaderboardRow } from "@/lib/api";

export function LeaderboardChart({ data }: { data: LeaderboardRow[] }) {
  return (
    <div className="h-64 w-full rounded-2xl bg-white p-4 shadow-card">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
          <XAxis
            dataKey="run_id"
            tick={{ fontSize: 10 }}
            interval={0}
            angle={-25}
            height={50}
            textAnchor="end"
          />
          <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="success_rate"
            stroke="#ff7a3d"
            fill="rgba(255, 122, 61, 0.35)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
