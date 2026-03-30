import type { Metadata } from "next";
import { Cormorant_Garamond, IBM_Plex_Mono, Manrope } from "next/font/google";

import { Nav } from "@/components/nav";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["600", "700"]
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
    <html lang="en" className={`${manrope.variable} ${cormorant.variable} ${plexMono.variable}`}>
      <body className="font-[var(--font-sans)]">
        <Providers>
          <Nav />
          <main className="site-shell pt-8">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
