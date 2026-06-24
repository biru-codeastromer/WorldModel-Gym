import { fetchLeaderboard, toFiniteNumber } from "@/lib/api";
import {
  BADGE_HEADERS,
  buildBadgeSvg,
  buildUnknownBadge,
  formatSuccessPct,
  toneForSuccess
} from "@/lib/badge";

// Node runtime so the server-side API base resolves like the rest of the app.
// Never throws — a missing/empty track degrades to a neutral "unknown" badge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tracks the leaderboard understands; anything else is treated as missing. */
const KNOWN_TRACKS = new Set(["test", "train", "continual"]);

/**
 * Per-track leaderboard badge — renders the current #1 agent + success rate.
 *
 *   GET /badge/test → "WorldModel Gym test | <#1 agent> <success%>"
 *
 * Returns image/svg+xml, cache-friendly + cross-origin permissive for <img>.
 */
export async function GET(
  _request: Request,
  { params }: { params: { track: string } }
): Promise<Response> {
  const track = (params.track || "").toLowerCase();

  if (!KNOWN_TRACKS.has(track)) {
    return new Response(buildUnknownBadge("unknown track"), { headers: BADGE_HEADERS });
  }

  const rows = await fetchLeaderboard(track).catch(() => null);

  if (!rows || rows.length === 0) {
    return new Response(
      buildBadgeSvg({
        label: `WorldModel Gym ${track}`,
        message: "no runs",
        tone: "neutral"
      }),
      { headers: BADGE_HEADERS }
    );
  }

  // Leaderboard rows arrive ranked; the first row is the leader. Guard anyway by
  // picking the highest finite success rate so a malformed lead row can't win.
  const leader = rows.reduce((best, row) => {
    const a = toFiniteNumber(best.success_rate) ?? -Infinity;
    const b = toFiniteNumber(row.success_rate) ?? -Infinity;
    return b > a ? row : best;
  }, rows[0]);

  const rate = toFiniteNumber(leader.success_rate);
  const agent = leader.agent?.trim() || "leader";
  const message = `${agent} ${formatSuccessPct(rate)}`;

  const svg = buildBadgeSvg({
    label: `WorldModel Gym ${track}`,
    message,
    tone: toneForSuccess(rate),
    title: `WorldModel Gym ${track} leader: ${agent} success ${formatSuccessPct(rate)}`
  });

  return new Response(svg, { headers: BADGE_HEADERS });
}
