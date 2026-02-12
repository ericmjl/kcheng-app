import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "China Trip Planner",
    short_name: "Trip Planner",
    description: "Plan your China trip: calendar, contacts, meetings, trains, and more.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5e6df",
    theme_color: "#c5e5d4",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
