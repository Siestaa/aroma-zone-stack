import { ViewTransition } from "react";

/**
 * Directional slide for hierarchical navigation (catalog -> product, etc).
 * Tag the triggering <Link> with transitionTypes={["nav-forward"]} or
 * ["nav-back"]; links without a type (or browser back/forward) don't
 * trigger this and just cross-fade via the default browser transition.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
