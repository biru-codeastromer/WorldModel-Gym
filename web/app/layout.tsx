import type { Metadata } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Mono } from "next/font/google";

import { Nav } from "@/components/nav";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const josefinSans = localFont({
  src: [
    { path: "./fonts/JosefinSans-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/JosefinSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/JosefinSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/JosefinSans-SemiBold.ttf", weight: "600", style: "normal" }
  ],
  variable: "--font-sans",
  display: "swap"
});
const yesevaOne = localFont({
  src: [{ path: "./fonts/YesevaOne-Regular.ttf", weight: "400", style: "normal" }],
  variable: "--font-serif",
  display: "swap"
});
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
    <html lang="en" className={`${josefinSans.variable} ${yesevaOne.variable} ${plexMono.variable}`}>
      <body className="font-[var(--font-sans)] text-[var(--ink)]">
        <Providers>
          <Nav />
          <main className="site-shell pt-8">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
