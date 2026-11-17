"use client";

import { useCallback, useSyncExternalStore, type MouseEvent } from "react";
import { flushSync } from "react-dom";

export type Theme = "light" | "dark";

let listeners: Array<() => void> = [];
let pendingTransition: ViewTransition | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((listener) => listener !== callback);
  };
}

// "light" unless the user has explicitly toggled to dark — the OS/browser
// preference is intentionally not consulted here, matching layout.tsx's
// THEME_INIT_SCRIPT default. document.documentElement always carries a
// data-theme attribute by the time this runs (that script sets it before
// hydration), so this only reads the DOM, never matchMedia.
function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

// SSR has no window/document — this is only read on the server, never
// getSnapshot/subscribe above, so it's safe for those to assume a browser
function getServerSnapshot(): Theme {
  return "light";
}

// Shared by every clickable surface that toggles the theme (the compact
// icon button and the full-width mobile-menu row) — the circle-wipe view
// transition logic is the same regardless of what triggered it, only the
// markup differs.
export function useThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const next: Theme = theme === "dark" ? "light" : "dark";
      const root = document.documentElement;

      const x = event.clientX;
      const y = event.clientY;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      root.style.setProperty("--theme-x", `${x}px`);
      root.style.setProperty("--theme-y", `${y}px`);
      root.style.setProperty("--theme-r", `${endRadius}px`);

      const applyTheme = () => {
        root.setAttribute("data-theme", next);
        try {
          localStorage.setItem("theme", next);
        } catch {
          // localStorage unavailable (private mode, disabled storage) — theme
          // still applies for this load, just won't persist
        }
        notify();
      };

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion || !document.startViewTransition) {
        applyTheme();
        return;
      }

      // a transition already mid-flight (double click, or clicked again
      // before the last one settled) would otherwise reject the new one
      // with "invalid state" — finish the old one first instead of animating
      pendingTransition?.skipTransition();

      // Marks this specific transition so globals.css's root-level circle-
      // reveal rules only fire for it. Without the marker they're plain
      // unconditional `::view-transition-old/new(root)` rules — which also
      // catch the "root" bucket that any *route* navigation's unnamed chrome
      // (e.g. the account sidebar, which isn't wrapped in a named
      // ViewTransition) falls into, freezing it on screen instead of
      // fading it out. See globals.css for the html[data-theme-transition]
      // scoping and account/AccountNav.tsx for the chrome this broke.
      document.documentElement.setAttribute("data-theme-transition", "");

      const transition = document.startViewTransition(() => {
        flushSync(applyTheme);
      });
      pendingTransition = transition;

      // ready / updateCallbackDone / finished are three independent promises
      // — any of them can reject on their own (rapid re-click, reduced-motion
      // toggled mid-flight, tab backgrounded) and each needs its own handler
      // or it surfaces as an unhandled rejection. The DOM mutation above
      // already applied regardless, so there's nothing to recover here.
      const noop = () => {};
      transition.ready.catch(noop);
      transition.updateCallbackDone.catch(noop);
      transition.finished.catch(noop).finally(() => {
        // Guard against a rapid re-click's skipTransition() resolving this
        // (now-superseded) transition's `finished` *after* the next one has
        // already started and re-set the attribute for itself.
        if (pendingTransition !== transition) return;
        document.documentElement.removeAttribute("data-theme-transition");
        pendingTransition = null;
      });
    },
    [theme],
  );

  return { theme, toggle };
}
