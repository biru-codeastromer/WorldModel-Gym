"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Home, RefreshCw, Trophy } from "lucide-react";

import { Badge, Button, Card, SectionHeader } from "@/components/ui";

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
    <section className="py-12 md:py-16">
      <Card elevation="raised" padding="lg">
        <SectionHeader
          as="h1"
          kicker="Something broke"
          title="This view hit an unexpected error."
          lede="The page failed to render. You can retry the request, or head back to a stable surface while we recover."
        />
        {error?.digest ? (
          <div className="mt-5">
            <Badge tone="warning" variant="outline">
              Reference: {error.digest}
            </Badge>
          </div>
        ) : null}
        <div className="mt-7 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => reset()}
            leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
          >
            Try again
          </Button>
          <Link href="/">
            <Button
              variant="secondary"
              leftIcon={<Home className="h-4 w-4" aria-hidden="true" />}
            >
              Back to home
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button
              variant="ghost"
              leftIcon={<Trophy className="h-4 w-4" aria-hidden="true" />}
            >
              Open leaderboard
            </Button>
          </Link>
        </div>
      </Card>
    </section>
  );
}
