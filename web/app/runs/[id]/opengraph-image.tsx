import { ImageResponse } from "next/og";

import { fetchRun, formatMetric } from "@/lib/api";

import { OG_CONTENT_TYPE, OG_SIZE, OgCard, ogFonts } from "../../og/og-card";

// Node runtime so we can read the .ttf font files from the filesystem.
export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "WorldModel Gym Run — planning agent evaluation result";

/** Shorten a long run id for the headline so it never overflows the card. */
function shortId(id: string): string {
  if (id.length <= 22) {
    return id;
  }
  return `${id.slice(0, 10)}…${id.slice(-8)}`;
}

export default async function Image({ params }: { params: { id: string } }) {
  const runId = params.id;

  // Null-safe: if the API is unreachable or the run is missing, render a
  // sensible fallback card rather than throwing (which would 500 the image).
  const run = await fetchRun(runId).catch(() => null);

  if (!run) {
    return new ImageResponse(
      (
        <OgCard
          eyebrow="Run"
          tag={shortId(runId)}
          title="Evaluation run"
          subtitle="A reproducible planning-agent evaluation on WorldModel Gym."
        />
      ),
      { ...size, fonts: ogFonts() }
    );
  }

  const metrics = run.metrics ?? {};
  const successPct = formatMetric(
    metrics.success_rate === null || metrics.success_rate === undefined
      ? null
      : metrics.success_rate * 100,
    1
  );

  return new ImageResponse(
    (
      <OgCard
        eyebrow="Run"
        tag={shortId(runId)}
        title={`${run.agent} on ${run.env}`}
        subtitle={`Track "${run.track}" · status ${run.status} · evaluated on WorldModel Gym.`}
        stats={[
          { label: "Success rate", value: successPct === "--" ? "--" : `${successPct}%` },
          { label: "Mean return", value: formatMetric(metrics.mean_return, 2) },
          { label: "Track", value: run.track }
        ]}
      />
    ),
    { ...size, fonts: ogFonts() }
  );
}
