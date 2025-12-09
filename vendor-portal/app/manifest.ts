import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ibimina Staff Console",
    short_name: "Ibimina",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    description: "A fast, installable PWA for Umurenge SACCO ibimina staff hosted on Node.",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-1024.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "View SACCO operations dashboard",
        url: "/dashboard",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Groups",
        short_name: "Groups",
        description: "Manage Ikimina groups",
        url: "/groups",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Reports",
        short_name: "Reports",
        description: "View financial reports",
        url: "/reports",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
