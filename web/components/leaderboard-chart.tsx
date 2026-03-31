"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { LeaderboardRow } from "@/lib/api";

export function LeaderboardChart({ data }: { data: LeaderboardRow[] }) {
  return (
    <div className="h-80 w-full rounded-[32px] border border-[rgba(185,174,195,0.46)] bg-[rgba(255,255,255,0.74)] p-6 shadow-[0_20px_60px_rgba(33,24,43,0.06)]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="section-kicker">Signal</p>
          <h3 className="mt-4 font-[var(--font-serif)] text-3xl leading-none text-[var(--ink)]">Success Rate Trend</h3>
        </div>
        <p className="rounded-full border border-[rgba(185,174,195,0.46)] bg-[rgba(255,255,255,0.8)] px-4 py-2 text-xs font-medium text-[var(--muted)]">
          Higher is better
        </p>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="successFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#3d68dc" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#3d68dc" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(185, 174, 195, 0.3)" strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="run_id"
            tick={{ fontSize: 10, fill: "#6a6472" }}
            interval={0}
            angle={-25}
            height={50}
            textAnchor="end"
          />
          <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: "#6a6472" }} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="success_rate"
            stroke="#1d1a24"
            fill="url(#successFill)"
            strokeWidth={3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
