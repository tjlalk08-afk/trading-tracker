import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trading Tracker",
    short_name: "Tracker",
    description: "Track trading performance, dashboards, and investor activity.",
    start_url: "/",
    display: "standalone",
    background_color: "#061018",
    theme_color: "#061018",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
