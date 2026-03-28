import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { Nav } from "@/components/nav";
import { Providers } from "@/components/providers";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://world-model-gym.vercel.app"),
  title: {
    default: "WorldModel Gym",
    template: "%s | WorldModel Gym"
  },
  description:
    "Production-ready benchmark and leaderboard for long-horizon planning agents under sparse rewards and partial observability.",
  keywords: [
    "world models",
    "planning benchmark",
    "reinforcement learning",
    "FastAPI",
    "Next.js",
    "leaderboard"
  ],
  openGraph: {
    title: "WorldModel Gym",
    description:
      "Evaluate imagination-based agents with reproducible benchmark tracks, planner traces, and a public leaderboard.",
    url: "https://world-model-gym.vercel.app",
    siteName: "WorldModel Gym",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "WorldModel Gym",
    description:
      "Benchmark long-horizon planning agents with reproducible tracks, trace uploads, and a public dashboard."
  },
  alternates: {
    canonical: "/"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${plexMono.variable}`}>
      <body className="font-[var(--font-space)]">
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
