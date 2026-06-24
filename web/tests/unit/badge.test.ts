import { describe, expect, it } from "vitest";

import {
  approxTextWidth,
  buildBadgeSvg,
  buildUnknownBadge,
  escapeXml,
  formatSuccessPct,
  toneForSuccess
} from "@/lib/badge";

describe("badge svg builder", () => {
  it("renders a two-cell svg with both label and message text", () => {
    const svg = buildBadgeSvg({ label: "WorldModel Gym", message: "search_mcts 82%" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("WorldModel Gym");
    expect(svg).toContain("search_mcts 82%");
    // It declares an explicit width/height + viewBox so it scales crisply.
    expect(svg).toMatch(/width="\d+" height="28" viewBox="0 0 \d+ 28"/);
    expect(svg).toContain("role=\"img\"");
  });

  it("sizes the badge wider for longer text (no clipping)", () => {
    const short = buildBadgeSvg({ label: "WMG", message: "a 1%" });
    const long = buildBadgeSvg({ label: "WMG", message: "a_very_long_agent_name 100%" });
    const widthOf = (svg: string) => Number(/width="(\d+)"/.exec(svg)?.[1]);
    expect(widthOf(long)).toBeGreaterThan(widthOf(short));
  });

  it("escapes XML-significant characters in untrusted names", () => {
    const svg = buildBadgeSvg({ label: "a&b", message: "<x> \"q\" 'r' 50%" });
    expect(svg).not.toContain("<x>");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&lt;x&gt;");
    expect(svg).toContain("&quot;");
    expect(svg).toContain("&apos;");
  });

  it("falls back to safe defaults for blank label/message", () => {
    const svg = buildBadgeSvg({ label: "   ", message: "" });
    expect(svg).toContain("badge");
    expect(svg).toContain("unknown");
  });

  it("escapeXml handles all five entities", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
  });

  it("approxTextWidth grows monotonically with length and never returns 0", () => {
    expect(approxTextWidth("")).toBe(0);
    expect(approxTextWidth("WWWW")).toBeGreaterThan(approxTextWidth("iiii"));
    expect(approxTextWidth("hello world")).toBeGreaterThan(approxTextWidth("hello"));
  });
});

describe("badge value helpers", () => {
  it("formats success rate as whole percent, with n/a fallback", () => {
    expect(formatSuccessPct(0.823)).toBe("82%");
    expect(formatSuccessPct(1)).toBe("100%");
    expect(formatSuccessPct(0)).toBe("0%");
    expect(formatSuccessPct(null)).toBe("n/a");
    expect(formatSuccessPct(Number.NaN)).toBe("n/a");
  });

  it("maps success rate to a semantic tone", () => {
    expect(toneForSuccess(null)).toBe("accent");
    expect(toneForSuccess(0.9)).toBe("success");
    expect(toneForSuccess(0.5)).toBe("warning");
    expect(toneForSuccess(0.1)).toBe("danger");
  });

  it("buildUnknownBadge is a neutral WorldModel Gym badge", () => {
    const svg = buildUnknownBadge("run not found");
    expect(svg).toContain("WorldModel Gym");
    expect(svg).toContain("run not found");
  });
});
