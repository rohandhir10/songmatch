import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SongMatch — Sing what suits your voice",
    short_name: "SongMatch",
    description:
      "Scan your vocal range, get songs matched to your voice, and perform them in karaoke mode.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070708",
    theme_color: "#070708",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
