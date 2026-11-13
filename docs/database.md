# Database and accounts

Merchants' accounts and their stores are kept in PostgreSQL. A merchant can sign up, set up the store and pick a theme,
close the site, and come back days later (in the same browser or on another device) to carry on where they stopped.

## How it runs

`docker-compose.yml` starts two containers:

| Container | What it is |
| --- | --- |
| `dukkan-jo` | The Next.js app. It reaches the database through `DATABASE_URL`. |
| `dukkan-db` | PostgreSQL 16. No port is opened to the outside, so only the app can reach it. |

The data lives in the Docker volume `dukkan-db`. Rebuilds, `docker compose up -d`, restarts and the auto-deploy
(`deploy/deploy.sh`) all keep it. **`docker compose down -v` or `docker volume rm` deletes every account, so don't use them.**

The tables are created by the app on its first request (`server/db.ts`), so there is no migration step.

## The database password

Put a `.env` file next to `docker-compose.yml` on the server (it is git-ignored):

```
POSTGRES_PASSWORD=a-long-random-password
```

Without it, a built-in default is used. That only works because the database is not reachable from outside the
server, so set a real password.

Postgres takes the password only the first time it starts with an empty volume. If the database is already running
with the default password, change it on the server like this:

```bash
docker exec -it dukkan-db psql -U dukkan -d dukkan -c "ALTER USER dukkan PASSWORD 'the-new-password';"
# put the same password in .env, then:
docker compose up -d
```

## Tables

| Table | What it holds |
| --- | --- |
| `accounts` | Email (unique), name, mobile (unique, `+9627XXXXXXXX`), the password hash (scrypt, salted), created date. |
| `sessions` | Sign-ins. The browser holds a random token in an http-only cookie (`dukkan-session`); the table keeps only its SHA-256. Lasts 60 days and is renewed while it is used. |
| `store_data` | Everything a store saves, one row per key (`seen-setup`, `seen-themes`, the store design, products, orders...). |

## How a store is saved

The pages still save to the browser (`localStorage`) as before. While an account is signed in, the browser storage
(`installAccounts` in `components/demoSandbox.ts`) also passes each change to `components/serverSync.ts`, which sends
the changes to `PUT /api/store` in small batches (and right away when the tab is closed or hidden).

- **Sign up:** the account is created on the server and the store starts empty.
- **Log in:** the whole store is loaded from `GET /api/store` into the browser.
- **Opening the site later:** once per tab, the session is checked (`/api/auth/me`) and the store is compared with the
  server's copy. If it changed on another device, the page reloads with it. If the session ran out, the merchant is
  sent to sign in again.

## API

| Route | Does |
| --- | --- |
| `POST /api/auth/signup` | `{ name, email, phone, password }` → `ok`, `taken`, `taken-phone`, `invalid` |
| `POST /api/auth/login` | `{ id, password }` (email or mobile) → `ok`, `none`, `wrong` |
| `POST /api/auth/logout` | Ends the session |
| `GET /api/auth/me` | The signed-in account, or 401 |
| `GET /api/store` / `PUT /api/store` | The account's saved data / `{ set: { key: value }, remove: [key] }` |

Requests that change something must come from the site itself (checked against the `Origin` header). Sign-up and
log-in are rate-limited per visitor. Store data is capped at 3 MB per key and 20 MB per account.

## Not done yet

- Uploaded videos and large pictures are kept in the browser's IndexedDB (`components/storefront/mediaStore.ts`) and
  are not on the server yet. They need file storage (S3 or Cloudflare R2, see `security-checklist.md`).
- The settings page's profile and password forms don't change the account on the server yet.
- There is no "forgot password" yet.
