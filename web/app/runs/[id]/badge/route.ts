import { fetchRun, toFiniteNumber } from "@/lib/api";
import {
  BADGE_HEADERS,
  buildBadgeSvg,
  buildUnknownBadge,
  formatSuccessPct,
  toneForSuccess
} from "@/lib/badge";

// Node runtime so the API client's server-side `getApiBase()` (INTERNAL/NEXT_PUBLIC)
// fetch works the same way the page does. The handler never throws: any failure
// degrades to a neutral "unknown" badge so an embedded <img> never shows a 500.
export const runtime = "nodejs";
// Always render fresh on the origin; the CDN caches via the Cache-Control header.
export const dynamic = "force-dynamic";

/**
 * Per-run embeddable badge.
 *
 *   GET /runs/<id>/badge            → "WorldModel Gym | <agent> <success%>"
 *   GET /runs/<id>/badge?label=env  → "WorldModel Gym | <env> <success%>"
 *
 * Returns image/svg+xml, cache-friendly + cross-origin permissive so it embeds
 * in any README, page, or chat via a plain <img>.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const runId = params.id;
  const { searchParams } = new URL(request.url);
  // `?label=env` swaps the agent name for the environment in the value cell.
  const useEnv = searchParams.get("label") === "env";

  const run = await fetchRun(runId).catch(() => null);

  if (!run) {
    return new Response(buildUnknownBadge("run not found"), { headers: BADGE_HEADERS });
  }

  const rate = toFiniteNumber(run.metrics?.success_rate);
  const subject = (useEnv ? run.env : run.agent)?.trim() || "run";
  const message = `${subject} ${formatSuccessPct(rate)}`;

  const svg = buildBadgeSvg({
    label: "WorldModel Gym",
    message,
    tone: toneForSuccess(rate),
    title: `WorldModel Gym run ${runId}: ${subject} success ${formatSuccessPct(rate)}`
  });

  return new Response(svg, { headers: BADGE_HEADERS });
}
