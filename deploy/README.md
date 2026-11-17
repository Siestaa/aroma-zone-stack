# Deploy reference

Reference configs for running аромазон-тут on a single VPS. None of this is applied
automatically — copy the relevant file, adjust paths/domain, and apply it by hand.

**Needs a real VPS with root/SSH access** (Timeweb Cloud "Облачный сервер" — Ubuntu
24.04), not shared/PHP hosting. This stack needs a self-managed Postgres (own schema,
migrations), two long-running Node processes (Fastify `api/`, includes the nightly
catalog-sync cron; Next.js `web/`), and persistent disk for downloaded product images —
none of that exists on a shared plan. `admin/` is the one piece that's just static files
after build and doesn't itself need a Node process.

## Layout

- `nginx.conf` — same-origin reverse proxy for the main domain: `/api/*` → Fastify
  (`api/`, :4000), everything else → Next.js (`web/`, :3000). Same-origin means cookies
  work with zero CORS config, and `NEXT_PUBLIC_API_URL` never needs to be set (it
  already defaults to `/api`). Also has a separate server block for
  `admin.аромазон-тут.рф` that serves `admin/dist` as static files (no Node process —
  it's a Vite SPA calling the main domain's `/api/admin/*` cross-origin, CORS already
  handled backend-side via `ADMIN_ORIGIN`).
- `aroma-zone-api.service` / `aroma-zone-web.service` — systemd units for the two Node
  processes. The daily catalog + FX-rate sync (`api/src/jobs/syncCatalog.ts`) runs
  inside the API process via `node-cron` — no separate cron/timer unit exists or is
  needed.

## 1. Order the VPS

Timeweb Cloud → Облачный сервер → **Ubuntu 24.04 LTS**. For this project's actual load
(Next.js SSR + Fastify + Postgres, all on one box, no heavy traffic expected) a small
tier is enough to start: **1–2 vCPU / 2 GB RAM / 20–30 GB SSD**. Can be resized later
without reinstalling — start small, scale if `htop`/disk usage says so.

Keep the current PHP hosting running until the new server is fully verified — don't
cancel it until after DNS has been cut over and you've confirmed the new site works.

## 2. DNS

Two A records need to point at the new server's IP once it's ready:

- `аромазон-тут.рф` (+ `www`) → main site
- `admin.аромазон-тут.рф` → admin panel (new subdomain — add this record even though it
  didn't exist before)

**Punycode.** Nginx, certbot and the browser's `Origin` header all use the punycode
(IDNA) form of the domain, never the Cyrillic one. Everywhere a config file or command
needs the domain, use:

| Cyrillic                | Punycode                                |
| ----------------------- | --------------------------------------- |
| `аромазон-тут.рф`       | `xn----7sba2axiddn1aal.xn--p1ai`        |
| `www.аромазон-тут.рф`   | `www.xn----7sba2axiddn1aal.xn--p1ai`    |
| `admin.аромазон-тут.рф` | `admin.xn----7sba2axiddn1aal.xn--p1ai`  |

(Most registrar DNS panels accept either form for the record name.)

Don't flip these until step 8 (after the site is verified working by IP/hosts-file).
DNS propagation can take a few hours, so the actual cutover moment is somewhat out of
your control regardless of when you point the record.

## 3. Base server setup (SSH in as root the first time)

```bash
apt update && apt upgrade -y
adduser aromazone && usermod -aG sudo aromazone
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

# Node 22 (matches local dev)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Postgres 16
apt install -y postgresql postgresql-contrib

# Nginx + certbot
apt install -y nginx certbot python3-certbot-nginx
```

From here on, do everything as the `aromazone` user, not root.

## 4. Postgres

```bash
sudo -u postgres psql -c "CREATE USER aromazone WITH PASSWORD '<pick a real password>';"
sudo -u postgres psql -c "CREATE DATABASE aromazone OWNER aromazone;"
```

Note the password — it goes into `api/.env`'s `DATABASE_URL` in step 6.

## 5. Get the code onto the server

This repo isn't a git repository yet locally. Easiest path: `git init` it, push to a
**private** GitHub/GitLab repo, then on the server:

```bash
git clone <your-private-repo-url> /var/www/aroma-zone
```

If you'd rather not set up a remote yet, `rsync`/`scp` the whole tree once to get
started (excluding `node_modules`, `.next`, `dist`, `.env`) — but git makes every future
update a one-line `git pull` instead of re-uploading everything, so it's worth doing
before this gets tedious.

```bash
rsync -avz --exclude node_modules --exclude .next --exclude dist --exclude .env \
  /home/alexey/aroma-zone/ aromazone@<server-ip>:/var/www/aroma-zone/
```

## 6. Env files

`api/.env` (copy from `api/.env.example`, fill in real values):

```
DATABASE_URL=postgres://aromazone:<password from step 4>@localhost:5432/aromazone
PORT=4000
SESSION_COOKIE_NAME=az_session
ADMIN_SESSION_COOKIE_NAME=az_admin_session
ADMIN_ORIGIN=https://admin.xn----7sba2axiddn1aal.xn--p1ai
PUBLIC_WEB_URL=https://xn----7sba2axiddn1aal.xn--p1ai
NODE_ENV=production
```

(`NODE_ENV=production` matters — it's what flips the session cookies' `secure` flag on,
see `api/src/routes/adminAuth.ts` / `auth.ts`. Side effect: logging in only works over
https, so test logins after step 10, not before.)

`ADMIN_ORIGIN` **must be punycode**: the browser sends the `Origin` header in punycode
and `api/src/index.ts` compares it as a plain string — the Cyrillic form never matches,
so every admin request fails CORS.

`admin/.env` (copy from `admin/.env.example`) — baked in at build time, so set it
*before* `npm --prefix admin run build` (rebuild after any change):

```
VITE_API_URL=https://xn----7sba2axiddn1aal.xn--p1ai/api/admin
```

`web/` needs no `.env` — `API_INTERNAL_URL` defaults to `http://localhost:4000/api`,
correct here since both processes run on the same box.

## 7. Install deps + build

```bash
cd /var/www/aroma-zone
npm --prefix api install
npm --prefix web install
npm --prefix admin install

npm --prefix api run build     # tsc -> api/dist
npm --prefix web run build      # next build
npm --prefix admin run build     # tsc -b && vite build -> admin/dist
```

`scraper/` needs no install step — it has no dependencies of its own (plain Node
built-ins), `api/`'s sync job imports it directly via a relative path.

## 8. Database: migrate + seed

```bash
npm --prefix api run db:migrate
npm --prefix api exec tsx src/db/seedCategories.ts
npm --prefix api run sync:catalog      # populates products + first FX rate
npm --prefix api run seed:admin -- <your-email> <a-real-password>
```

The last command creates your first admin account — you'll get a fresh TOTP QR code on
first login to `https://admin.аромазон-тут.рф`, scan it with an authenticator app.

## 9. systemd services

```bash
sudo cp deploy/aroma-zone-api.service deploy/aroma-zone-web.service /etc/systemd/system/
# edit User/WorkingDirectory in both if paths differ from /var/www/aroma-zone
sudo systemctl daemon-reload
sudo systemctl enable --now aroma-zone-api aroma-zone-web
sudo systemctl status aroma-zone-api aroma-zone-web   # both should be "active (running)"
```

`journalctl -u aroma-zone-api -f` / `-u aroma-zone-web -f` to watch logs live.

## 10. Nginx + TLS

`deploy/nginx.conf` is deliberately **HTTP-only** (port 80). A `listen 443 ssl` block
whose certificate files don't exist yet fails `nginx -t`, which would stop nginx and
certbot alike — so nginx starts on plain http first, and certbot adds TLS on top.

**10a. Enable the site over http:**

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/aroma-zone
sudo ln -s /etc/nginx/sites-available/aroma-zone /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**10b. Point DNS at the server** (step 2) if you haven't yet, and wait until all three
names resolve to the new IP — Let's Encrypt validates over http, so issuance fails while
DNS still points at the old hosting:

```bash
dig +short xn----7sba2axiddn1aal.xn--p1ai
dig +short www.xn----7sba2axiddn1aal.xn--p1ai
dig +short admin.xn----7sba2axiddn1aal.xn--p1ai
curl -I http://xn----7sba2axiddn1aal.xn--p1ai     # should answer from Next.js
```

**10c. Issue certificates** (punycode names only — certbot rejects Cyrillic). One
certificate covers all three names; certbot edits the nginx config itself, adding
`listen 443 ssl`, the certificate paths and the http → https redirect:

```bash
sudo certbot --nginx --redirect \
  -d xn----7sba2axiddn1aal.xn--p1ai \
  -d www.xn----7sba2axiddn1aal.xn--p1ai \
  -d admin.xn----7sba2axiddn1aal.xn--p1ai
sudo nginx -t && sudo systemctl reload nginx
```

The first run asks for an email (expiry notices) and to accept the Let's Encrypt terms.

**10d. Check auto-renewal.** The `certbot` apt package installs a systemd timer that
renews twice a day when a certificate is within 30 days of expiry, and reloads nginx:

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

Note for later: if you ever re-copy `deploy/nginx.conf` over the live file, the
certbot-added TLS lines are lost — re-run the 10c command (it reuses the existing
certificate) instead of editing by hand.

## 11. Verify, then cut over

- `https://аромазон-тут.рф` — home page loads, catalog browses, guest checkout works.
- `https://admin.аромазон-тут.рф` — login screen loads, first login shows a TOTP QR,
  orders/products pages load after 2FA.
- Only once both check out: confirm DNS has actually propagated to the new IP, then
  decommission the old PHP hosting.

## Ongoing updates

```bash
cd /var/www/aroma-zone && git pull
npm --prefix api install && npm --prefix api run build
npm --prefix web install && npm --prefix web run build
npm --prefix admin install && npm --prefix admin run build
# new migration? npm --prefix api run db:migrate
sudo systemctl restart aroma-zone-api aroma-zone-web
```

`admin/dist` is served directly by Nginx (no restart needed there, just the rebuild) —
`nginx` picks up the new files on the next request automatically.
