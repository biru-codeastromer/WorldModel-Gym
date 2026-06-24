import { NextRequest, NextResponse } from "next/server";

// Per-request nonce-based Content-Security-Policy.
//
// Following the documented Next.js App Router pattern
// (https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy):
// a fresh random nonce is generated for every request, injected into the
// inbound request headers (so the root layout can read it via `headers()` and
// Next.js can stamp it onto the framework's own inline bootstrap scripts), and
// emitted in the response `Content-Security-Policy` header.
//
// `script-src` uses 'nonce-<nonce>' + 'strict-dynamic' so that only the
// nonce-tagged bootstrap script can run, and any scripts it loads inherit
// trust transitively — no 'unsafe-inline' for scripts. 'unsafe-eval' is added
// only in development because React's dev tooling / fast-refresh relies on it.
//
// `style-src` keeps 'unsafe-inline'. Next.js + Tailwind inject inline <style>
// tags (next/font's font-face/CSS-variable styles and the critical-CSS chunks)
// that are NOT nonce-tagged by the framework in the App Router, so a
// nonce-only style-src would drop the site's styling entirely. Inline styles
// cannot be combined with a nonce *and* a fallback, and 'strict-dynamic' has no
// effect on style-src, so 'unsafe-inline' is the tightest workable value here.
// The script-src nonce is what actually prevents XSS; inline styles are far
// lower risk.

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests"
  ].join("; ");
}

export function middleware(request: NextRequest): NextResponse {
  // 16 random bytes, base64-encoded — matches the Next.js documented recipe.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Forward the nonce to the rendering layer via request headers so the root
  // layout can read it and Next.js can apply it to its inline scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders }
  });
  // Also set the policy on the outgoing response so the browser enforces it.
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Apply to all routes except Next.js internal assets, the favicon, and
  // prefetches — these don't execute inline scripts and don't need a nonce.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" }
      ]
    }
  ]
};
