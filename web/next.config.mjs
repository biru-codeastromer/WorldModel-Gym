/** @type {import('next').NextConfig} */

// Restrictive Content-Security-Policy. The app talks to the backend only through
// the same-origin /api/proxy route, so `connect-src 'self'` is sufficient — no
// third-party origins are whitelisted. Next.js injects small inline bootstrap
// scripts/styles, hence 'unsafe-inline' for style and (in dev) script; styles
// also need 'unsafe-inline' for the styled font-variable spans. Fonts and images
// are self-hosted (next/font/local + /public), so 'self' + data: covers them.
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests"
].join("; ");

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
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
