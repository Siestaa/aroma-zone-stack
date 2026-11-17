import { AccountNav } from "../AccountNav";
import styles from "./layout.module.css";

// Persists AccountNav across client-side navigation between orders/favorites
// (a Next.js route group — doesn't affect the URL) instead of each page
// mounting its own copy inside a per-page <main>. Before this, switching
// tabs unmounted and remounted the whole sidebar along with the page
// content, which is what read as the nav "jumping" — it never actually
// moved, but a full remount mid-navigation reads as one.
//
// No PageTransition wrapper here — per Next's view-transitions guide, the
// ViewTransition boundary has to live in each page.tsx, not a persisting
// layout: a layout doesn't unmount/remount between sibling routes, so a
// wrapper placed here never sees an enter/exit to animate (confirmed: tab
// switches played no animation at all with it here). Each page under this
// shell (orders/favorites/profile/addresses) wraps its own content in
// PageTransition instead, exactly like every other route in the app —
// AccountNav, being outside all of them, just never re-renders.
export default function AccountShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.layout}>
      <AccountNav />
      <div>{children}</div>
    </main>
  );
}
