import Link from "next/link";
import { Compass, Home, Trophy } from "lucide-react";

import { Button, Card, SectionHeader } from "@/components/ui";
import { GridWorld } from "@/components/visuals";

export default function NotFound() {
  return (
    <section className="py-12 md:py-16">
      <Card elevation="raised" padding="lg" className="overflow-hidden">
        <div className="grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <SectionHeader
              as="h1"
              kicker="404 — page not found"
              title="This surface does not exist."
              lede="The link may be stale, or the run you were looking for was never published. Pick a live surface below to get back on track."
            />
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/">
                <Button leftIcon={<Home className="h-4 w-4" aria-hidden="true" />}>
                  Back to home
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button
                  variant="secondary"
                  leftIcon={<Trophy className="h-4 w-4" aria-hidden="true" />}
                >
                  Open leaderboard
                </Button>
              </Link>
              <Link href="/tasks">
                <Button
                  variant="ghost"
                  leftIcon={<Compass className="h-4 w-4" aria-hidden="true" />}
                >
                  Browse tasks
                </Button>
              </Link>
            </div>
          </div>
          <div className="hidden justify-end md:flex" aria-hidden="true">
            <GridWorld className="h-40 w-40 text-fg-subtle" />
          </div>
        </div>
      </Card>
    </section>
  );
}
