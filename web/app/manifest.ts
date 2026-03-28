import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WorldModel Gym",
    short_name: "WMG",
    description: "Benchmark and leaderboard for imagination-based planning agents.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef4ff",
    theme_color: "#11223a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
