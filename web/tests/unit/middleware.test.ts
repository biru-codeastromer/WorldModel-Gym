import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";

function run(url = "http://localhost/leaderboard") {
  const request = new NextRequest(url);
  const response = middleware(request);
  return { request, response };
}

function parseCsp(header: string): Map<string, string> {
  const directives = new Map<string, string>();
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx === -1) {
      directives.set(trimmed, "");
    } else {
      directives.set(trimmed.slice(0, spaceIdx), trimmed.slice(spaceIdx + 1));
    }
  }
  return directives;
}

describe("CSP middleware", () => {
  it("sets a Content-Security-Policy response header containing a per-request nonce", () => {
    const { response } = run();
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();

    const directives = parseCsp(csp!);
    const scriptSrc = directives.get("script-src") ?? "";
    const match = scriptSrc.match(/'nonce-([^']+)'/);
    expect(match).not.toBeNull();
    // A base64-encoded random value, never empty.
    expect(match![1].length).toBeGreaterThan(0);
  });

  it("forwards the same nonce to the rendering layer via the x-nonce request header", () => {
    const { response } = run();
    const csp = response.headers.get("Content-Security-Policy")!;
    const nonce = csp.match(/'nonce-([^']+)'/)![1];

    // NextResponse exposes the rewritten request headers via the internal
    // `x-middleware-override-headers` / `x-middleware-request-*` mechanism.
    const forwarded = response.headers.get("x-middleware-request-x-nonce");
    expect(forwarded).toBe(nonce);
  });

  it("generates a fresh nonce on every request", () => {
    const a = run().response.headers.get("Content-Security-Policy")!;
    const b = run().response.headers.get("Content-Security-Policy")!;
    const nonceA = a.match(/'nonce-([^']+)'/)![1];
    const nonceB = b.match(/'nonce-([^']+)'/)![1];
    expect(nonceA).not.toBe(nonceB);
  });

  it("uses strict-dynamic for scripts and never 'unsafe-inline' for script-src", () => {
    const csp = run().response.headers.get("Content-Security-Policy")!;
    const directives = parseCsp(csp);
    const scriptSrc = directives.get("script-src") ?? "";
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("keeps the hardened static directives (object-src/base-uri/frame-ancestors)", () => {
    const csp = run().response.headers.get("Content-Security-Policy")!;
    const directives = parseCsp(csp);
    expect(directives.get("object-src")).toBe("'none'");
    expect(directives.get("base-uri")).toBe("'self'");
    expect(directives.get("frame-ancestors")).toBe("'none'");
    expect(directives.get("default-src")).toBe("'self'");
    expect(directives.has("upgrade-insecure-requests")).toBe(true);
  });

  it("scopes style-src to the nonce while still allowing the unavoidable Next/Tailwind inline styles", () => {
    const csp = run().response.headers.get("Content-Security-Policy")!;
    const styleSrc = parseCsp(csp).get("style-src") ?? "";
    expect(styleSrc).toContain("'self'");
    expect(styleSrc).toContain("'nonce-");
    expect(styleSrc).toContain("'unsafe-inline'");
  });
});
