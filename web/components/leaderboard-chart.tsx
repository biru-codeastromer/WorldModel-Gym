"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { LeaderboardRow } from "@/lib/api";

export function LeaderboardChart({ data }: { data: LeaderboardRow[] }) {
  return (
    <div className="glass-panel h-72 w-full rounded-[26px] p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Signal</p>
          <h3 className="text-lg font-semibold text-ink">Success Rate Trend</h3>
        </div>
        <p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          Higher is better
        </p>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="successFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#ff7a3d" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#ff7a3d" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(17, 28, 46, 0.08)" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="run_id"
            tick={{ fontSize: 10, fill: "#5f6c84" }}
            interval={0}
            angle={-25}
            height={50}
            textAnchor="end"
          />
          <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: "#5f6c84" }} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="success_rate"
            stroke="#ff7a3d"
            fill="url(#successFill)"
            strokeWidth={3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
