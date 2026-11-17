import type { MetadataRoute } from "next";

// Next.js file-convention route — auto-served at /manifest.webmanifest and
// auto-linked from <head>, no manual metadata.manifest field needed.
// icon.png/apple-icon.png/favicon.ico/icon-512*.png are all generated from
// the client's own real logo artwork (2026-08-19) — replacing an earlier
// placeholder "AT" monogram, which itself had replaced the legacy site's
// favicon (borrowed real Aroma-Zone branding, see brand-and-trademark-
// caution) now that there's a proper original asset to use everywhere.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "аромазон-тут",
    short_name: "аромазон-тут",
    description:
      "Полный каталог Aroma-Zone (Франция) на русском. Выкупаем товар во Франции после оплаты, доставляем из Омска.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f1f2",
    theme_color: "#2e8350",
    lang: "ru",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
