"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * Layout-level error boundary. This catches errors thrown in the root layout
 * itself, so it must render its own <html>/<body> — the normal RootLayout is
 * not available here. Styling is inline (the editorial palette) so it stays
 * self-contained even if font variables never got applied.
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#fef7ff",
          color: "#1d1a24",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px",
          fontFamily: "Georgia, 'Times New Roman', serif"
        }}
      >
        <main style={{ maxWidth: "640px", width: "100%" }}>
          <p
            style={{
              fontStyle: "italic",
              color: "#6a6472",
              letterSpacing: "0.01em",
              margin: 0
            }}
          >
            — Critical error
          </p>
          <h1
            style={{
              marginTop: "24px",
              fontSize: "3rem",
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              fontWeight: 500
            }}
          >
            The application failed to load.
          </h1>
          <p style={{ marginTop: "20px", fontSize: "1.05rem", lineHeight: 1.6, color: "#6a6472" }}>
            A top-level error prevented the page shell from rendering. Reloading often clears it.
          </p>
          {error?.digest ? (
            <p
              style={{
                marginTop: "16px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "#6a6472"
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "32px",
              borderRadius: "999px",
              border: "none",
              background: "#3d68dc",
              color: "#fffdfa",
              padding: "16px 24px",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
