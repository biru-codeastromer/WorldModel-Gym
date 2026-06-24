// ---------------------------------------------------------------------------
// Shields-style SVG badge renderer (no external dependency).
//
// We hand-render a small, crisp two-cell badge — a dark "label" cell and a
// brand-accent "value" cell with a rounded outer corner — entirely from a
// template string. Text width is *approximated* from a per-character average so
// the cells size themselves to their content and the text never clips. The
// output is deterministic and pure (no I/O), which keeps it unit-testable and
// safe to cache aggressively at the edge.
//
// Everything here is escaped for XML; the badge embeds anywhere via a plain
// <img>, so the only untrusted input (agent / env / track names) is sanitised
// before it reaches the markup.
// ---------------------------------------------------------------------------

/** Brand palette baked into the badge. Mirrors the light-theme design tokens
 * (lib does not have access to CSS variables at SVG-render time, and an <img>
 * badge must look identical regardless of the host page's theme). */
const COLORS = {
  /** Dark ink used for the label cell — matches `--dark`. */
  label: "#17151d",
  /** Brand accent used for the value cell — matches the light `--accent`. */
  accent: "#3760d0",
  /** Neutral value cell for the "unknown" / degraded badge. */
  neutral: "#5f5867",
  /** Text on dark/colored cells. */
  text: "#ffffff",
  /** Subtle shadow text for crispness. */
  shadow: "#0b0a0f"
} as const;

/** A semantic value-cell color, chosen by success rate. */
export type BadgeTone = "accent" | "success" | "warning" | "danger" | "neutral";

const TONE_FILL: Record<BadgeTone, string> = {
  accent: COLORS.accent,
  success: "#277548",
  warning: "#8f5f12",
  danger: "#b83a39",
  neutral: COLORS.neutral
};

/** Pick a value-cell tone from a 0..1 success rate (null → accent). */
export function toneForSuccess(rate: number | null): BadgeTone {
  if (rate === null) return "accent";
  if (rate >= 0.66) return "success";
  if (rate >= 0.33) return "warning";
  return "danger";
}

/** Escape the five XML-significant characters so names can't break the markup. */
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

// Average glyph advance widths (in px at 11px font-size) for the mono/sans
// stack. These are deliberately a touch generous so estimates round *up* and
// text gets a little breathing room rather than clipping. Wide glyphs (m, w, W,
// M) and narrow ones (i, l, j, punctuation) are handled explicitly; everything
// else uses a sensible default.
const WIDE = new Set([..."mwMW@%"]);
const NARROW = new Set([..."iIl.,:;'|! "]);

/** Approximate the rendered width (px) of a label at 11px font-size. */
export function approxTextWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    if (WIDE.has(ch)) width += 9.5;
    else if (NARROW.has(ch)) width += 3.4;
    else if (ch >= "A" && ch <= "Z") width += 7.6;
    else width += 6.6;
  }
  return Math.ceil(width);
}

export type BuildBadgeOptions = {
  /** Left (dark) cell text, e.g. "WorldModel Gym". */
  label: string;
  /** Right (colored) cell text, e.g. "search_mcts 82%". */
  message: string;
  /** Value-cell tone. Defaults to "accent". */
  tone?: BadgeTone;
  /** Accessible title baked into the SVG (<title>) and aria-ish hints. */
  title?: string;
};

const FONT_FAMILY =
  "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";
const HEIGHT = 28;
const PAD = 9; // horizontal padding inside each cell
const RADIUS = 6;

/**
 * Render a shields-style badge SVG string. Pure + deterministic: the same
 * inputs always yield byte-identical output, so it caches perfectly.
 */
export function buildBadgeSvg({ label, message, tone = "accent", title }: BuildBadgeOptions): string {
  const safeLabel = label.trim() || "badge";
  const safeMessage = message.trim() || "unknown";

  const labelW = approxTextWidth(safeLabel) + PAD * 2;
  const valueW = approxTextWidth(safeMessage) + PAD * 2;
  const totalW = labelW + valueW;
  const fill = TONE_FILL[tone];

  const a11yTitle = escapeXml(title ?? `${safeLabel}: ${safeMessage}`);
  const xLabel = escapeXml(safeLabel);
  const xMessage = escapeXml(safeMessage);

  // Text baseline is vertically centred; a 1px dark shadow offset improves
  // legibility on the colored cell (the classic shields look).
  const textY = 18;
  const labelCx = labelW / 2;
  const valueCx = labelW + valueW / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${HEIGHT}" viewBox="0 0 ${totalW} ${HEIGHT}" role="img" aria-label="${a11yTitle}">
  <title>${a11yTitle}</title>
  <defs>
    <linearGradient id="g" x2="0" y2="100%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".12"/>
      <stop offset="1" stop-opacity=".12"/>
    </linearGradient>
    <clipPath id="r">
      <rect width="${totalW}" height="${HEIGHT}" rx="${RADIUS}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="${HEIGHT}" fill="${COLORS.label}"/>
    <rect x="${labelW}" width="${valueW}" height="${HEIGHT}" fill="${fill}"/>
    <rect width="${totalW}" height="${HEIGHT}" fill="url(#g)"/>
  </g>
  <g fill="${COLORS.text}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="11" font-weight="600">
    <text x="${labelCx}" y="${textY + 1}" fill="${COLORS.shadow}" fill-opacity=".35">${xLabel}</text>
    <text x="${labelCx}" y="${textY}">${xLabel}</text>
    <text x="${valueCx}" y="${textY + 1}" fill="${COLORS.shadow}" fill-opacity=".35">${xMessage}</text>
    <text x="${valueCx}" y="${textY}">${xMessage}</text>
  </g>
</svg>`;
}

/** Format a 0..1 rate as a whole-percent string, or "n/a" when missing. */
export function formatSuccessPct(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return "n/a";
  return `${Math.round(rate * 100)}%`;
}

/** Standard cache headers for badges: cacheable + revalidate at the edge,
 * permissive cross-origin so a badge embeds in any README / page via <img>. */
export const BADGE_HEADERS: Record<string, string> = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  // Short fresh window, long stale-while-revalidate so badges stay snappy and
  // the API isn't hammered. `max-age=0` lets the *browser* always revalidate
  // while CDNs serve from `s-maxage`.
  "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
  "Access-Control-Allow-Origin": "*"
};

/** Build the neutral "unknown" badge used when a run/track can't be resolved. */
export function buildUnknownBadge(message = "unknown"): string {
  return buildBadgeSvg({
    label: "WorldModel Gym",
    message,
    tone: "neutral"
  });
}
