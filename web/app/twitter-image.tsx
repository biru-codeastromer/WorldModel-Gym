import { ImageResponse } from "next/og";

import { OG_CONTENT_TYPE, OG_SIZE, OgCard, ogFonts } from "./og/og-card";

// Node runtime so we can read the .ttf font files from the filesystem.
export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "WorldModel Gym — benchmark and leaderboard for long-horizon planning agents";

export default async function Image() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="Planning Benchmark"
        title="Evaluate imagination-based agents."
        subtitle="Reproducible benchmark tracks, planner traces, and a public leaderboard for long-horizon planning under sparse rewards."
        stats={[
          { label: "Tracks", value: "Reproducible" },
          { label: "Traces", value: "Step-level" },
          { label: "Leaderboard", value: "Public" }
        ]}
      />
    ),
    { ...size, fonts: ogFonts() }
  );
}
