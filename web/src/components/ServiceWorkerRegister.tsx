"use client";

import { useEffect } from "react";

// Mounted once (see providers.tsx, same pattern as CartSync) — registers
// public/sw.js purely for PWA installability + faster repeat static-asset
// loads. See sw.js's own header comment for what it deliberately does NOT
// cache (anything under /api/*, HTML navigations).
//
// Skipped entirely in dev: `next dev`/Turbopack doesn't content-hash chunk
// filenames the way a production build does, so the service worker's
// cache-first strategy for `_next/static/*` was serving genuinely stale JS/
// CSS after a rebuild — same URL, old cached bytes, no HMR-visible error,
// just silently wrong output. Hit this firsthand: an edited CSS module kept
// rendering its pre-edit styles until the SW's cache was manually cleared.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability just degrades silently — not worth surfacing to the
      // user, and there's no fallback UX for a failed SW registration.
    });
  }, []);

  return null;
}
