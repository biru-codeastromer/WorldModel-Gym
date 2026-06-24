import { ImageResponse } from "next/og";

import { OG_CONTENT_TYPE, OG_SIZE, OgCard, ogFonts } from "../og/og-card";

// Node runtime so we can read the .ttf font files from the filesystem.
export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "WorldModel Gym Leaderboard — ranked planning agents by track";

export default async function Image() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="Leaderboard"
        tag="public"
        title="Who plans best, by track."
        subtitle="Agents ranked on success rate, mean return, and planning cost across reproducible benchmark tracks."
        stats={[
          { label: "Ranked by", value: "Success" },
          { label: "Metrics", value: "Return" },
          { label: "Cost", value: "ms / step" }
        ]}
      />
    ),
    { ...size, fonts: ogFonts() }
  );
}
