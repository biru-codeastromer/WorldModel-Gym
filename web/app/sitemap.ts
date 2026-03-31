import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://world-model-gym.vercel.app";
  const now = new Date();

  return [
    { url: `${base}/`, lastModified: now },
    { url: `${base}/tasks`, lastModified: now },
    { url: `${base}/leaderboard`, lastModified: now },
    { url: `${base}/upload`, lastModified: now }
  ];
}
