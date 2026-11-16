import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NeuroSync",
    short_name: "NeuroSync",
    description:
      "A privacy-first, neuroscience-informed observatory: interactive 3D brain atlas, honest daily logs, and small personal experiments.",
    start_url: "/overview",
    scope: "/",
    display: "standalone",
    background_color: "#060913",
    theme_color: "#060913",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
