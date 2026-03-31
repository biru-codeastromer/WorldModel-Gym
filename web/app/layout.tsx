import type { Metadata } from "next";
import localFont from "next/font/local";

import { Nav } from "@/components/nav";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const cmuSerif = localFont({
  src: [
    { path: "./fonts/CMUSerif-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/CMUSerif-Italic.ttf", weight: "400", style: "italic" },
    { path: "./fonts/CMUSerif-Bold.ttf", weight: "700", style: "normal" }
  ],
  variable: "--font-serif",
  display: "swap"
});
const plexMono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexMono-SemiBold.woff2", weight: "600", style: "normal" }
  ],
  variable: "--font-mono",
  display: "swap"
});

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
    <html lang="en" className={`${cmuSerif.variable} ${plexMono.variable}`}>
      <body className="text-[var(--ink)]">
        <Providers>
          <Nav />
          <main className="site-shell pt-[108px] md:pt-[124px]">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
