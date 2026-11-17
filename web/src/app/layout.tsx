import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Аромазон-тут — совместные закупки Aroma-Zone", template: "%s | Аромазон-тут" },
};

// viewportFit: "cover" lets the safe-area-inset-* env() vars used by
// MobileTabBar resolve on notched/home-indicator devices instead of
// defaulting to 0.
export const viewport: Viewport = {
  themeColor: "#2e8350",
  viewportFit: "cover",
};

// Runs before hydration so the theme applies before first paint — without
// it the page would flash one theme then snap to another once React
// mounts. Defaults to "light" regardless of the OS/browser preference
// (product decision: light is the intended first-visit look), only
// deferring to a saved choice once the user has actually toggled — see
// useThemeToggle.ts's getSnapshot(), which mirrors this same default.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem("theme");
    document.documentElement.setAttribute("data-theme", saved === "dark" ? "dark" : "light");
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body>
        <Providers>
          <SiteHeader />
          {children}
          <SiteFooter />
          <MobileTabBar />
        </Providers>
      </body>
    </html>
  );
}
