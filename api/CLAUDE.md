# CLAUDE.md

Backend for аромазон-тут — catalog, users, cart/favorites, orders. Fastify + TypeScript +
Drizzle + Postgres. Sibling of `web/` (the Next.js frontend, see its own CLAUDE.md) and
`scraper/` (the catalog source this backend's cron job wraps).

## Commands

```bash
npm run dev          # tsx watch src/index.ts
npm run build         # tsc -> dist/
npm run start          # node dist/index.js (run build first)
npm run db:generate    # drizzle-kit generate — after editing src/db/schema.ts
npm run db:migrate     # tsx src/db/migrate.ts — applies pending migrations
npm run db:studio      # drizzle-kit studio
npm run sync:catalog    # tsx src/jobs/syncCatalog.ts — one-off manual catalog+FX sync
npm run seed:admin       # tsx src/db/seedAdmin.ts <email> <password> — create/reset an admin_users row
```

`.env.example` has the required vars (`DATABASE_URL`, `PORT`, `SESSION_COOKIE_NAME`,
`ADMIN_SESSION_COOKIE_NAME`, `ADMIN_ORIGIN`) — copy to `.env` for local dev. No test
runner configured yet.

Local dev needs a Postgres instance; nothing in this repo starts one automatically. Example:
`docker run -d --name aroma-zone-postgres-dev -e POSTGRES_USER=aromazone -e POSTGRES_PASSWORD=devpassword -e POSTGRES_DB=aromazone -p 55432:5432 postgres:16-alpine`
(matches the connection string already in `.env.example`).

## Architecture

Layered, no framework magic: `src/routes/*` (Fastify route registration, request
parsing/validation) → `src/services/*` (business logic, all DB access via Drizzle) →
`src/db/schema.ts`. Chose Fastify over NestJS to match the rest of the project's
minimal-dependency style (`web/CLAUDE.md`'s "no Tailwind, no CSS-in-JS, no component
library" ethos extends here); chose Drizzle over Prisma for the same reason (no binary
engine daemon, stays close to SQL).

**Auth**: opaque session tokens (`sessions` table, `token` PK) in an httpOnly/
SameSite=Lax cookie — not JWT, nothing here needs stateless cross-service verification,
and DB-backed sessions make logout trivial (just delete the row). Passwords hashed with
`argon2` (argon2id). `src/services/authMiddleware.ts` exports `requireUser` (401s and
returns null if not logged in — callers must `if (!user) return;` right after, the
reply is already sent) and `getOptionalUser` (returns null silently — used by `/orders`
POST, which accepts both guest and authenticated requests on one code path).

**Same-origin deployment**: routes are registered *with* the `/api` prefix baked in
(`app.register(productRoutes, { prefix: "/api" })` etc. in `src/index.ts`), because in
production Nginx proxies `/api/*` straight through to this process unmodified (see
`deploy/nginx.conf` at the repo root) — no path rewriting anywhere. This is also why
`web/`'s RTK Query `baseUrl` can stay defaulted to `/api` with zero config.

**Catalog data**: one row per Algolia `objectID` in `products` (a "product family"),
one row per SKU in `product_variants` — verified empirically before building this that
products commonly have multiple variants (different bottle sizes, each its own SKU/
price), so a flat one-row-per-product schema would have been wrong. `products.bio` is a
real signal (Algolia's `attributes.culture`, e.g. "BIO cosmétique"/"Cosmos organic" vs
"Conventionnelle"), computed by `src/jobs/syncCatalog.ts`'s `isBio()`.

**Categories** (`categories` table + `src/db/categoryDirectory.ts`): sourced directly
from Aroma-Zone's own `categoryKeys` tags — verified against the live site's own facet
counts (not an invented taxonomy; an earlier heuristic keyword-classifier version was
scrapped in favor of this once it became clear the numbers matched exactly). A product
naturally carries ~13–50 of these tags at once (real categories mixed with AZ's own
marketing/audience/occasion/attribute-facet tags, e.g. "Idées cadeaux", "Exclusivité
Web", "Par type de peau" — no signal in the source data for which is which), so
category membership is **many-to-many**, computed live via JSONB containment
(`products.categories_raw @> jsonb_build_array(categories.name_fr)`, GIN-indexed) —
there is no `products.category_slug` column and never a single "the" category for a
product. `categories.is_product_type` is the one piece of real curation on top of AZ's
own data: it flags which of the ~410 tags are genuine "what kind of product is this"
categories (Huiles essentielles, Hydrolats, Savons, ...) versus AZ's marketing/audience/
facet tags — only `is_product_type = true` rows (87 of 410) drive real navigation
(`GET /api/categories`, the catalog filter sidebar, the homepage's top-5). Re-seed via
`tsx src/db/seedCategories.ts` whenever `categoryDirectory.ts` changes — slugs are
generated (transliterated from the Russian name, see `src/db/slugify.ts`), not
hand-picked, and stay stable across re-seeds via `onConflictDoUpdate` keyed on the
French tag string (`name_fr`, the one thing that can't drift).

**Money**: everything is integer EUR cents (`price_eur_cents`, matching the source
data's own minor-unit representation — avoids float rounding). `approxRub` is **never
stored** — `src/services/settingsService.ts#getCurrentFxRate` reads the current rate
from the `settings` table (a plain key/value store, `{key: "fx_rate_eur_rub", value:
{rate, updatedAt}}`) and every read endpoint that needs it (`productService.ts`,
`orderService.ts`) computes it fresh at request time. `orders.fx_rate_used` is the one
exception — that's a historical snapshot of what rate was actually used to compute a
specific order's total, recorded once at order-creation time, not a live value.

**Order snapshots**: `order_items` duplicates `sku`/`name`/`price_eur_cents`/`capacity`
onto each row at order-creation time (`*_snapshot` columns) rather than relying purely
on the `product_variant_id` FK — verified this matters by writing an integration test
that changes a variant's live price after placing an order and confirming the order's
total/line items don't change. The daily catalog sync will absolutely change prices/
names out from under existing orders; order history must show what was actually bought.

**Catalog + FX sync** (`src/jobs/syncCatalog.ts`): imports `fetchAllProducts()` from
`../../../scraper/algolia-client.js` (a plain relative import across sibling project
folders — no npm workspace/monorepo tooling, matches the rest of the repo's "no
monorepo" decision; typed via a hand-written `scraper/algolia-client.d.ts` companion
file rather than `allowJs` in `tsconfig.json`, because turning on `allowJs` made `tsc`
try to emit a transpiled copy of the sibling `.js` file outside `rootDir` and fail with
"would overwrite input file" — a companion `.d.ts` next to a `.js` file is TypeScript's
supported pattern for "give me types for this JS module without compiling it").
Upserts products/variants (`onConflictDoUpdate` on `object_id`/`sku`), then fetches the
day's EUR/RUB rate from `cbr-xml-daily.ru/daily_json.js` (a JSON mirror of the Bank of
Russia's official daily rate — verified live before wiring it in) into `settings`.
Scheduled via `node-cron` *inside* the long-running Fastify process (`src/index.ts`,
04:00 Europe/Moscow) — no separate systemd timer/OS cron unit exists or is needed; also
runnable once by hand via `npm run sync:catalog` (used to seed a fresh DB — categories
have no FK relationship to products anymore, so `seedCategories.ts` and `sync:catalog`
can run in either order).

**Cart** (`src/routes/cart.ts`, session-authenticated): `GET /api/cart`,
`POST /api/cart/items`, `PATCH/DELETE /api/cart/items/:id`, `DELETE /api/cart` (clear
all — used after a logged-in checkout completes). Every mutation returns the *full*
current items list, not just the changed row — `web/`'s `CartSync.tsx` relies on this to
replace its local Redux state wholesale after each call rather than reimplementing the
merge/qty logic client-side. `addToCart` **adds** to an existing line's qty rather than
replacing it (mirrors `cartSlice`'s guest-mode `addLine` semantics) — this is exactly
why the frontend must not blindly re-POST already-synced lines on every page load, see
`web/CLAUDE.md`'s `CartSync` note.

**Favorites** (`src/routes/favorites.ts`, session-authenticated): `GET /api/favorites`,
`POST/DELETE /api/favorites/:productId`. `listFavorites` joins `product_variants` (same
`min`/`bool_or`/`array_agg` aggregation as `productService.listProducts`) so the
response is `ProductListItem`-shaped — `web/` reuses `ProductGrid` directly for the
favorites page instead of a bespoke rendering path.

**Admin backend** (`src/routes/admin*.ts`, `src/services/admin*.ts`, under `/api/admin`):
serves the separate `admin/` staff panel (its own Vite+React repo, not part of `web/`).
Deliberately its own parallel auth stack, not a role flag reusing `users`/`sessions`:
`admin_users`/`admin_sessions` tables, a different cookie name
(`ADMIN_SESSION_COOKIE_NAME`, default `az_admin_session`) via `adminAuthMiddleware.ts`'s
`requireAdmin`/`getOptionalAdmin`, so an admin session can never be read by storefront
code or vice versa. Login is two-step: password (`POST /api/admin/auth/login`), then
TOTP (`otplib`, Google Authenticator-compatible) — if `totp_enabled` is false (always
true for a brand-new `seed:admin` row), the login response itself returns a QR code and
the *same* pending login must be confirmed via `/setup-totp` instead of `/verify-totp`;
this both proves the admin saved the secret and flips `totp_enabled` on. The gap between
password and TOTP steps is tracked by an in-memory `pendingLogins` map
(`adminAuthService.ts`, 5 min TTL) — deliberately not a DB table, it only needs to
survive one login attempt, and a single-process internal tool doesn't need it to survive
a restart. There's no self-registration route by design; accounts are provisioned via
`npm run seed:admin <email> <password>`, which also resets 2FA on password reset (no
recovery flow exists, so a lost password + still-enabled TOTP would otherwise be a
permanent lockout).

Since `admin/` runs as a separate app/origin (different Vite dev port locally, likely a
subdomain in prod), `/api/admin/*` is the only part of this backend that needs CORS
(`@fastify/cors`, origin allowlist from `ADMIN_ORIGIN`, `credentials: true` for the
cookie) — **remember its default `methods` is `GET,HEAD,POST` only**, PATCH/DELETE must
be listed explicitly (`src/index.ts`) or every mutating admin request fails preflight
with a CORS error, not a 4xx from the route handler itself (hit this once — the request
never reaches Fastify's logs, only the browser console shows it). Every route that
returns an `Order`/`AdminProduct` must return the *full* shape including relations
(`with: { items: true }` for orders) — the admin frontend does
`queryClient.setQueryData` with the mutation response to avoid a full refetch, so a
partial row (e.g. a bare `.returning()` from an `UPDATE`) silently blows away already-
loaded relations in the client cache and crashes the next render (hit this with
`updateOrderStatus` returning a row with no `items`; fixed by having it re-fetch via
`getOrderById` after the update instead of trusting `.returning()`).

`products.hidden` (admin-only visibility toggle, `adminProductRoutes.ts`'s
`PATCH /products/:id`) is filtered out of every storefront read path
(`productService.ts`'s `listProducts`/`getProductBySlug`) but is **not** a column
`syncCatalog.ts`'s upsert ever touches — omitting it from both the insert `values` and
the `onConflictDoUpdate` `set` is what makes a hidden product survive the next daily
re-sync instead of quietly reappearing. Admin product editing is deliberately narrow:
only `nameRu`/`descriptionRu` (the translation columns) and `hidden` are writable — every
other product field is Algolia-sourced and would just get overwritten by the next sync,
so there's no edit UI for them (see the `nameRu IS NULL` untranslated-filter in
`adminProductService.ts`, which doubles as "what did last night's sync add").

## Verifying end-to-end

No test suite yet — verify by hand against a local Postgres: `npm run build`, run the
server, and curl through register → login → `/me` → logout, plus a product list/detail
fetch and a guest + authenticated order creation (`POST /api/orders` with/without the
session cookie). `web/`'s dev server proxies `/api/*` to `localhost:4000` (see its
`next.config.ts`), so the real click-through (browse catalog → add to cart → checkout →
order shows in `/account/orders`) exercises this backend through the actual frontend.
