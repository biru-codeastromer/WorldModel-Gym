"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the boundary hit in the console for diagnostics. In production a
    // real reporter (Sentry, etc.) would hook in here.
    console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <section className="space-y-10 pb-8">
      <section className="border-b border-[rgba(185,174,195,0.46)] pb-12 pt-8">
        <p className="section-kicker">Something broke</p>
        <h1 className="mt-8 font-[var(--font-serif)] text-6xl font-medium leading-[0.92] tracking-[-0.04em] text-[var(--ink)] md:text-7xl">
          This view hit an unexpected error.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          The page failed to render. You can retry the request, or head back to a stable surface while we recover.
        </p>
        {error?.digest ? (
          <p className="mt-4 font-[var(--font-mono)] text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="button-primary px-6 py-4 text-sm font-semibold"
          >
            Try Again
          </button>
          <Link href="/" className="button-secondary px-6 py-4 text-sm font-semibold">
            Back to Home
          </Link>
          <Link href="/leaderboard" className="button-secondary px-6 py-4 text-sm font-semibold">
            Open Leaderboard
          </Link>
        </div>
      </section>
    </section>
  );
}
