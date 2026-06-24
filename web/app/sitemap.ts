import type { MetadataRoute } from "next";

import { DOC_SLUGS } from "@/content/docs";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://world-model-gym.vercel.app";
  const now = new Date();

  const docs: MetadataRoute.Sitemap = [
    { url: `${base}/docs`, lastModified: now },
    ...DOC_SLUGS.map((slug) => ({ url: `${base}/docs/${slug}`, lastModified: now }))
  ];

  return [
    { url: `${base}/`, lastModified: now },
    { url: `${base}/tasks`, lastModified: now },
    { url: `${base}/leaderboard`, lastModified: now },
    { url: `${base}/upload`, lastModified: now },
    ...docs
  ];
}
