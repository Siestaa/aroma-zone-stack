# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Turbopack dev server, http://localhost:3000
npm run build    # Turbopack production build
npm run start    # serve the production build
npm run lint      # ESLint (flat config, eslint-config-next) — next lint was removed in Next 16
npx tsc --noEmit  # typecheck (no dedicated package.json script yet)
npx next typegen  # regenerate .next/dev/types — run after adding/removing routes if tsc
                   # complains about a stale route module under app/**/page.tsx
```

No test runner is configured yet.

## Architecture

Next.js 16 App Router on Turbopack (the default bundler for both `dev` and `build` in this
version — do not add `--webpack` unless a specific incompatibility forces it). React 19.2.
Path alias `@/*` → `src/*`.

**State — Redux Toolkit + RTK Query** (`src/lib/redux/`):
- `store.ts` exports `makeStore()`, a factory, not a singleton store instance. This is
  required for the App Router: a module-level store would leak state across requests on
  the server. Every consumer must go through the factory.
- `api.ts` holds one base `createApi` slice (`fetchBaseQuery`, `baseUrl` from
  `NEXT_PUBLIC_API_URL`, defaults to `/api`, no endpoints defined on the base slice
  itself). Add endpoints elsewhere with `api.injectEndpoints(...)` per feature rather
  than editing this file directly — see `src/lib/redux/authApi.ts` / `settingsApi.ts` /
  `src/app/checkout/checkoutApi.ts` / `src/components/search/searchApi.ts` for the
  reference shape.
- The real backend is `api/` (sibling of `web/`, Fastify + Postgres — see its own
  CLAUDE.md). `baseUrl` defaulting to `/api` is deliberate: in prod, Nginx proxies
  `/api/*` to the Fastify process on the *same origin* as `web/`, so cookies work with
  zero CORS config and `NEXT_PUBLIC_API_URL` never needs to be set. In dev,
  `next.config.ts`'s `rewrites()` does the equivalent proxying to `localhost:4000`.
  Client components (RTK Query) always go through this same-origin path. Server
  Components can't — `rewrites()` only intercepts requests the Next.js *server*
  receives from a browser, not outbound `fetch()` calls made from within a Server
  Component's own Node process. Those use `src/lib/api/server.ts`'s `apiFetch`/`apiGet`
  instead, which hit the backend directly via `API_INTERNAL_URL` (defaults to
  `http://localhost:4000/api`, correct in both dev and prod since both processes run
  colocated on one VPS) and manually forward the incoming request's session cookie
  (`cookies()` from `next/headers` — server-to-server fetch doesn't carry browser
  cookies automatically).
- `cartSlice.ts` is a plain slice (not RTK Query) holding the cart as `CartLine[]`
  (`src/lib/api/types.ts` — one line per product *variant*, fully denormalized so cart/
  checkout UI never needs an extra fetch). It's the single source of truth Redux state
  for rendering in **both** modes — guest and logged-in — the difference is purely in
  how mutations reach it and what backs persistence:
  - **Never dispatch `addLine`/`setQty`/`removeLine` directly from a component.** Go
    through `useCartActions()` (`lib/redux/useCartActions.ts`) instead — it's the one
    place that knows whether to just dispatch locally (guest) or hit the server first
    and replace local state with the authoritative response (logged in). `ProductActions.tsx`
    and `cart/CartRow.tsx` are the reference call sites.
  - **`CartSync.tsx`** (mounted once in `providers.tsx`) owns the whole lifecycle:
    localStorage hydrate-on-mount + persist-on-change (via `store.subscribe(...)`, not a
    second `useEffect` keyed on the selected cart value — that shape races the hydration
    dispatch, since its first run sees the pre-hydration empty state before the
    hydration's re-render lands and clobbers `localStorage` back to `[]`; hit this bug
    once, `store.subscribe` only fires on *actual* subsequent changes so it can't race).
    It also watches `useMeQuery()`: the first time it sees a user it hasn't synced this
    session (ref keyed on user id, resets on logout), it pushes any local lines that
    don't yet have a `cartItemId` up to the server (`POST /api/cart/items` — real
    unsynced guest additions only) then replaces local state with the server's full,
    authoritative cart. **The unsynced-only filter matters**: every line already carries
    a `cartItemId` after its first successful sync (baked into what gets persisted to
    localStorage), so re-running the merge on a plain page reload must skip those — hit
    a bug where re-pushing already-synced lines doubled their qty server-side on every
    reload, since the backend's `addToCart` adds rather than replaces.
  - Checkout clears the server cart too (`useClearServerCartMutation`) after a
    logged-in order — otherwise the just-ordered items would still be sitting in
    `cart_items` next session. `LogoutLink`/`AccountNav`'s logout handler dispatches
    `clearCart()` (local only — the server side is untouched, it's still there next
    login) so a subsequent guest/different-account session on the same browser doesn't
    inherit someone else's cart.
  - Favorites (`lib/redux/favoritesApi.ts`, `components/product/FavoriteButton.tsx`,
    `/account/favorites`) are simpler — no local/guest mode at all, the heart toggle
    just redirects to `/account` if you're not logged in. `api/src/services/favoriteService.ts#listFavorites`
    returns `ProductListItem`-shaped rows (joins in price/image/stock), so the favorites
    page reuses `ProductGrid` directly instead of a separate rendering path.
- `hooks.ts` exports typed `useAppDispatch` / `useAppSelector` / `useAppStore` — use these,
  not the plain `react-redux` hooks.
- `src/app/providers.tsx` (`'use client'`) creates the store once via
  `useState(makeStore)` and wraps `children` in `<Provider>`. It's mounted once in
  `src/app/layout.tsx`. Store init uses `useState`, not `useRef` — reading `ref.current`
  during render trips the `react-hooks/refs` rule in this project's ESLint config.

**Forms**: react-hook-form + zod via `@hookform/resolvers` (`zodResolver`). Zod v4 API —
use `z.email()`, not the deprecated `z.string().email()`; `z.literal(true, "message")` for
a must-be-checked checkbox. See `src/app/checkout/schema.ts` for the reference pattern,
including a cross-field `.refine()` for a conditionally-required address.

**UI** (`src/components/ui/`): Radix UI primitives (the unified `radix-ui` package —
import from `"radix-ui"`, not individual `@radix-ui/react-*` packages) for
interactive/accessible components (Checkbox, RadioGroup, Accordion), styled with
co-located CSS Modules. No Tailwind, no CSS-in-JS, no component library — Chakra was
tried and reverted, see the `chakra-turbopack-incompatibility` memory if picking a UI kit
comes up again. `Button` is polymorphic: pass `href` to render a `next/link` styled as a
button (needed because nesting a real `<button>` inside a `<Link>`'s `<a>` is invalid
HTML) or omit it for a native `<button>`.

**CSS Modules pitfall**: a plain element selector alone (`table`, `th`, `td`, …) is
rejected by Turbopack's Lightning CSS with "selector is not pure" — every rule needs at
least one local class in it (`.table td`, not bare `td`). Also remember class names are
scoped per file: a literal `className="mono"` / `className="price"` from JSX only matches
a selector if that selector is `:global(.mono)` in a `.module.css`, or if it's the real
global `.mono` / `.price` utility defined in `globals.css` — a bare `.mono { … }` written
inside a CSS Module will *not* match a plain string className (hit this bug twice).

**View transitions**: `<ViewTransition>` from `react`, wrapped per-page via
`src/components/transitions/PageTransition.tsx` (directional `nav-forward`/`nav-back`,
tagged on the triggering `<Link transitionTypes={[...]}>`). Product thumbnails morph
across routes via a shared `name={`product-thumb-${id}`}` on both the card
(`ProductCard`) and the product page. No `experimental.viewTransition` config flag exists
in this Next version — `transitionTypes` on `next/link` works out of the box, confirmed
against the bundled docs and `node_modules/next/dist/client/link.js`, not the (older,
15-targeted) general guidance in the `vercel-react-view-transitions` skill.

**Theme toggle** (`src/components/theme/ThemeToggle.tsx`): light/dark with a circle-wipe
reveal from the click point, using the *raw* `document.startViewTransition()` API
directly — not React's `<ViewTransition>` component, which isn't the right tool for a
clip-path animation keyed to arbitrary click coordinates. Notes for anyone touching this:
- Colors are pure CSS: `:root[data-theme="dark"|"light"]` in `globals.css` override the
  `@media (prefers-color-scheme)` values in both directions. No saved preference → no
  attribute is set → the media query alone governs (so OS-level theme changes still take
  effect live). `ThemeToggle` only sets the attribute once the user actually clicks.
- Anti-FOUC: an inline `<Script strategy="beforeInteractive">` in `layout.tsx` applies a
  saved `localStorage` theme to `<html>` before hydration; `<html suppressHydrationWarning>`
  is required because of that pre-hydration mutation.
- Theme reads go through `useSyncExternalStore` (module-level listener array + a
  `matchMedia("(prefers-color-scheme: dark)")` change listener), not `useEffect` +
  `setState` — the latter trips this project's `react-hooks/set-state-in-effect` lint rule
  and is the wrong tool anyway for "external mutable value, needs an SSR-safe snapshot."
- The DOM mutation inside `startViewTransition()`'s callback is wrapped in `flushSync`
  (from `react-dom`) so the browser's before/after snapshots actually straddle the change;
  without it the state update is batched past the snapshot and nothing animates.
- `ready`/`updateCallbackDone`/`finished` are three independent promises on the returned
  `ViewTransition` and each needs its own `.catch()` or a rejection on any one of them
  surfaces as an unhandled promise rejection — this doesn't mean the toggle failed, the
  DOM/localStorage mutation already happened synchronously regardless. A concurrent
  transition (double-click) is guarded with a module-level `pendingTransition` +
  `skipTransition()`. The circle-wipe CSS itself lives in `globals.css` under `theme
  toggle`, keyed off `--theme-x/--theme-y/--theme-r` custom properties set from the click
  event right before `startViewTransition()` runs.
- An `InvalidStateError: Transition was aborted` was observed in `next dev` but not in a
  production build (`next build && next start`) when clicking the toggle — looked like
  dev-only tooling (Fast Refresh / React DevTools hook) interfering, not a real bug; the
  `.catch()` handlers above are good practice regardless and make it silent either way.

**Search** (`src/components/search/`): `SearchBox` is the shared debounced-autocomplete
input (`lib/hooks/useDebouncedValue.ts`, 300ms, `MIN_QUERY_LENGTH = 2`) backed by
`useSearchProductsQuery` against `GET /api/products?q=` (the same endpoint the catalog
page's search uses server-side — `searchApi.ts` just takes the first 8 results
client-side rather than adding a dedicated backend param for a small autocomplete
count). It's used two ways — pass `onSubmitQuery` to control submission yourself
(catalog's `CatalogSearch.tsx` folds the query into the existing `?q=` searchParam
alongside category/bio), or omit it and submitting `router.push`es to
`/catalog?q=...` (the home page hero's usage).

**Pagination** (catalog only): `?page=`, 20 per page (`PAGE_SIZE` in
`app/catalog/page.tsx`), computed server-side after the category/bio/q filtering — page 1
never appears in the URL (`buildPageHref` omits `page` when `page <= 1`), and an
out-of-range page (stale link, hand-edited URL) clamps to the last real page rather than
rendering empty. `Filters.tsx` and `CatalogSearch.tsx` both delete `page` from the URL
when they change category/bio/q — the previous page number almost certainly doesn't
apply to the new result set, so silently keeping it would strand the user on a
half-relevant or out-of-range page. `Pagination.tsx` renders plain `<Link>`s (server
component, no client state) with a compact `1 … 4 5 6 … 12` window past 7 pages.

**Sort** (`?sort=`, catalog only): `SortSelect.tsx` is a Radix `Select` (not a native
`<select>` — kept consistent with Checkbox/RadioGroup/Accordion elsewhere, and lets the
dropdown panel be themed instead of relying on the browser's unstylable native one).
`popular` (the default) omits the param entirely, same convention as `page=1`; sorts by
`bestSeller desc, ratingCount desc` in SQL (`api/src/services/productService.ts`) — no
fabricated rank field like the old mock data's hand-assigned `popularity` number, both
signals are real (Algolia's `attributes.best-seller` flag and its review count).
`price-asc`/`price-desc` sort by `min(price_eur_cents)` across each product's variants
(the "from X€" price shown on the card) — EUR is still the authoritative currency per
the group-buy model, not the derived `approxRub`. Selecting a sort also clears `page`,
same reasoning as Filters/CatalogSearch.

**Routes** (`src/app/`): `/`, `/catalog` (reads `?category=`/`?bio=`/`?q=`/`?page=`,
filtered server-side, category checkboxes and search both push via `router.replace`
inside `startTransition` for the list-reorder animation), `/product/[slug]`, `/cart`,
`/checkout`, `/account` (real register/login/logout against `api/`, session cookie —
`/account` is intentionally reachable while logged out, it's the login/register form
itself), `/account/orders` (server-rendered, forwards the session cookie via
`apiFetch`; redirects to `/account` on a 401), `/about`, `/contacts`, `/delivery`,
`/payment`. `src/app/_shared/` has the CSS module shared by the About/Delivery/Payment
info-page layout (underscore prefix opts it out of routing). There is no
`src/app/api/**` anymore — the one Route Handler that used to live there
(`/api/search`, reading `lib/mock/`) is gone now that `/api/products?q=` is real.

**Backend integration** (`api/`, see its own CLAUDE.md for the server-side details):
catalog, auth, cart, favorites and orders are all real — `src/lib/api/types.ts` mirrors
the API's response shapes (`ProductListItem`/`ProductDetail`/`ProductVariant`/
`Category`/`Order`/`CartLine`), replacing the old `lib/mock/types.ts` (deleted, along
with the rest of `lib/mock/`). All prices travel as integer EUR cents (`priceEurCents`
/ `minPriceEurCents`, matching the source data's minor units — avoids float rounding);
format with `src/lib/format.ts`'s `formatEurCents`, not the old mock's `formatEur`
(which took plain euro floats). `approxRub` is **never stored** — every API response
that includes it computes it live from the day's EUR/RUB rate
(`api/src/services/settingsService.ts`, refreshed daily alongside the catalog sync) —
see the `business-model` memory and the catalog footnote ("пересчитывается на день
выкупа") before changing how any of this reads. `ProductThumb.tsx` renders real Aroma-
Zone product photos (`imageUrl` from the cheapest variant) via a plain `<img>` — not
`next/image` (arbitrary external CDN domains, not worth a `remotePatterns` allowlist)
— replacing the old mock-phase CSS-illustration placeholder (`ThumbVariant`: jar/puck/
vial shapes). `Tag.tsx` is down to a single real value, `"bio"` (from Aroma-Zone's
`attributes.culture` certification field) — the old mock's `"new"`/`"sale"` tags never
had a real backing signal and aren't offered.

**No fabricated specifics**: don't invent concrete numbers/dates that read as real
business facts (a cycle number, an order-collection deadline, a "buyout happens within a
week" timeframe, etc.) — a "cycle #14, closes August 20" banner was built and then
removed because it wasn't sourced from anything real. The `10–14 days after buyout` and
`30-day unclaimed parcel` figures on `/delivery` and `/payment` *are* real, quoted from
the legacy site's О нас/Доставка/Оплата pages — keep the line between "quoted fact" and
"plausible-sounding placeholder" visible, and don't blend the two.
