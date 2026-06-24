import { ImageResponse } from "next/og";

import { OG_CONTENT_TYPE, OG_SIZE, OgCard, ogFonts } from "../og/og-card";

// Node runtime so we can read the .ttf font files from the filesystem.
export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "WorldModel Gym Tasks — benchmark environments for planning agents";

export default async function Image() {
  return new ImageResponse(
    (
      <OgCard
        eyebrow="Tasks"
        tag="environments"
        title="The benchmark task catalog."
        subtitle="Long-horizon environments with sparse rewards and partial observability — each with reproducible defaults for evaluation."
        stats={[
          { label: "Horizon", value: "Long" },
          { label: "Rewards", value: "Sparse" },
          { label: "State", value: "Partial" }
        ]}
      />
    ),
    { ...size, fonts: ogFonts() }
  );
}
