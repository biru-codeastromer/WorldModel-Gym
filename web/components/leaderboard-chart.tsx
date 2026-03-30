"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { LeaderboardRow } from "@/lib/api";

export function LeaderboardChart({ data }: { data: LeaderboardRow[] }) {
  return (
    <div className="site-panel paper-matrix h-80 w-full rounded-[30px] p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="section-kicker">Signal</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">Success Rate Trend</h3>
        </div>
        <p className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-4 py-2 text-xs font-medium text-[var(--muted)]">
          Higher is better
        </p>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="successFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#b89972" stopOpacity={0.48} />
              <stop offset="95%" stopColor="#b89972" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(138, 122, 104, 0.22)" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="run_id"
            tick={{ fontSize: 10, fill: "#6d655d" }}
            interval={0}
            angle={-25}
            height={50}
            textAnchor="end"
          />
          <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: "#6d655d" }} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="success_rate"
            stroke="#151412"
            fill="url(#successFill)"
            strokeWidth={3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
