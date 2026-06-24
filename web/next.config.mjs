/** @type {import('next').NextConfig} */

// The Content-Security-Policy is intentionally NOT defined here. It is generated
// per-request (with a fresh nonce) in `middleware.ts`, because a nonce-based CSP
// cannot be expressed as a static header. The remaining security headers below
// are request-independent, so they stay as static headers for every route.

const nextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker image
  // can ship only the traced runtime files instead of the full node_modules.
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    typedRoutes: false
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
