/* The tables behind Diwan (Dukkan's staff console) and everything merchants send to Dukkan. Run after the first three
   tables in db.ts, inside the same advisory lock, on the first request. Every statement can run again safely
   (IF NOT EXISTS / ON CONFLICT), so an existing database just gains what is new. A "shop" is one merchant account:
   account_id is the shop's id everywhere. Money is in JOD with 3 decimals (fils). */

export const DIWAN_SCHEMA = `
  /* ---------- merchant accounts: sign-in history and impersonation ---------- */
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_count   INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT now();
  /* set when a staff member opened this session with "Log in as merchant" (impersonations.id). Unused since 2026-11-16,
     when that was removed: no new session gets it, and server/auth.ts never accepts a session that has it. */
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS impersonation_id BIGINT;

  /* ---------- staff ---------- */
  CREATE TABLE IF NOT EXISTS staff (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('owner', 'support', 'developer')),
    password_hash TEXT NOT NULL,
    totp_secret   TEXT,
    totp_on       BOOLEAN NOT NULL DEFAULT false,
    active        BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  /* verified: the 2-step code was given for this sign-in */
  CREATE TABLE IF NOT EXISTS staff_sessions (
    token_hash   TEXT PRIMARY KEY,
    staff_id     BIGINT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
    verified     BOOLEAN NOT NULL DEFAULT false,
    ip           TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS staff_sessions_staff ON staff_sessions (staff_id);
  /* when this sign-in last typed its password again for a change every new store gets (server/staffConfirm.ts) */
  ALTER TABLE staff_sessions ADD COLUMN IF NOT EXISTS password_confirmed_at TIMESTAMPTZ;

  /* everything staff open or change. Only ever added to: a trigger refuses UPDATE and DELETE. */
  /* the newest 2-step code each staff member and each merchant signed in with (its 30-second step): a code is accepted
     once (server/staff.ts useTotpCode) */
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;

  CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    staff_id    BIGINT REFERENCES staff (id),
    action      TEXT NOT NULL,
    target_type TEXT,
    target_id   TEXT,
    reason      TEXT,
    ip          TEXT NOT NULL DEFAULT '',
    meta        JSONB
  );
  CREATE INDEX IF NOT EXISTS audit_log_target ON audit_log (target_type, target_id, at DESC);
  CREATE INDEX IF NOT EXISTS audit_log_staff ON audit_log (staff_id, at DESC);
  CREATE OR REPLACE FUNCTION audit_log_frozen() RETURNS trigger AS $f$ BEGIN RAISE EXCEPTION 'audit_log is append-only'; END $f$ LANGUAGE plpgsql;
  DROP TRIGGER IF EXISTS audit_log_frozen ON audit_log;
  CREATE TRIGGER audit_log_frozen BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_frozen();

  /* ---------- shops: one row per merchant account, kept up to date from what the merchant syncs ---------- */
  CREATE TABLE IF NOT EXISTS shops (
    account_id       BIGINT PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
    name             TEXT NOT NULL DEFAULT '',
    slug             TEXT,
    phone            TEXT NOT NULL DEFAULT '',
    color            TEXT NOT NULL DEFAULT '',
    city             TEXT NOT NULL DEFAULT '',
    category         TEXT NOT NULL DEFAULT '',
    setup_done       SMALLINT NOT NULL DEFAULT 0,
    published        BOOLEAN NOT NULL DEFAULT false,
    paused           BOOLEAN NOT NULL DEFAULT false,
    ship_mode        TEXT NOT NULL DEFAULT '',
    pickup_city      TEXT NOT NULL DEFAULT '',
    pickup_address   TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    suspend_reason   TEXT,
    suspended_at     TIMESTAMPTZ,
    product_count    INTEGER NOT NULL DEFAULT 0,
    order_count      INTEGER NOT NULL DEFAULT 0,
    total_sales      NUMERIC(14, 3) NOT NULL DEFAULT 0,
    first_product_at TIMESTAMPTZ,
    published_at     TIMESTAMPTZ,
    first_order_at   TIMESTAMPTZ,
    last_seen_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  /* a store link belongs to one shop only */
  CREATE UNIQUE INDEX IF NOT EXISTS shops_slug ON shops (lower(slug)) WHERE slug IS NOT NULL AND slug <> '';

  /* ---------- plans, subscriptions, payments ----------
     The plans and subscriptions tables are unused since 2026-11-16: Dukkan has no plans and no free trial, so nothing
     reads or writes them any more (and a new database no longer gets the 'trial' plan row). They are left in place with
     their rows, rather than dropped, so no history is lost; payments.subscription_id stays empty for new payments. */
  CREATE TABLE IF NOT EXISTS plans (
    id            BIGSERIAL PRIMARY KEY,
    key           TEXT NOT NULL UNIQUE,
    name_en       TEXT NOT NULL,
    name_ar       TEXT NOT NULL,
    price_month   NUMERIC(10, 3) NOT NULL DEFAULT 0,
    price_year    NUMERIC(10, 3) NOT NULL DEFAULT 0,
    max_products  INTEGER,            -- NULL: no limit
    custom_domain BOOLEAN NOT NULL DEFAULT true, -- no longer used: no store can use its own domain
    max_staff     INTEGER,            -- NULL: no limit
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id         BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    plan_id    BIGINT NOT NULL REFERENCES plans (id),
    status     TEXT NOT NULL CHECK (status IN ('trial', 'active', 'expired', 'cancelled')),
    starts_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at    TIMESTAMPTZ,
    set_by     BIGINT REFERENCES staff (id),
    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  /* one current subscription per shop; older ones stay as history */
  CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_current ON subscriptions (account_id) WHERE status IN ('trial', 'active');

  CREATE TABLE IF NOT EXISTS payments (
    id              BIGSERIAL PRIMARY KEY,
    account_id      BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    subscription_id BIGINT REFERENCES subscriptions (id),
    amount          NUMERIC(10, 3) NOT NULL CHECK (amount >= 0),
    method          TEXT NOT NULL CHECK (method IN ('bank', 'cliq', 'cash', 'card')),
    reference       TEXT NOT NULL DEFAULT '',
    paid_on         DATE NOT NULL,
    marked_by       BIGINT REFERENCES staff (id),
    note            TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS payments_account ON payments (account_id, paid_on DESC);
  /* one key per "Mark a payment as received" form: the same press sent twice (a double click, a retry after a lost
     answer) saves one payment, never two (QA 31) */
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS request_key TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS payments_request ON payments (account_id, request_key) WHERE request_key IS NOT NULL;

  /* ---------- log in as merchant ---------- */
  /* Unused since 2026-11-16, when "Log in as merchant" was removed: no new rows are written. Kept with its old rows. */
  CREATE TABLE IF NOT EXISTS impersonations (
    id         BIGSERIAL PRIMARY KEY,
    staff_id   BIGINT NOT NULL REFERENCES staff (id),
    account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    reason     TEXT NOT NULL,
    view_only  BOOLEAN NOT NULL DEFAULT true,
    ip         TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at    TIMESTAMPTZ NOT NULL,
    ended_at   TIMESTAMPTZ
  );

  /* ---------- tickets, bug reports and ideas ---------- */
  CREATE SEQUENCE IF NOT EXISTS ticket_number START 1001;
  CREATE TABLE IF NOT EXISTS tickets (
    id          BIGSERIAL PRIMARY KEY,
    number      BIGINT NOT NULL UNIQUE DEFAULT nextval('ticket_number'),
    account_id  BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    kind        TEXT NOT NULL DEFAULT 'support' CHECK (kind IN ('support', 'bug', 'idea')),
    category    SMALLINT NOT NULL DEFAULT 5,
    subject     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'open', 'waiting_merchant', 'waiting_dukkan', 'resolved', 'closed')),
    priority    TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assignee_id BIGINT REFERENCES staff (id),
    where_text  TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS tickets_account ON tickets (account_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS tickets_status ON tickets (status, updated_at DESC);
  /* internal: a staff note the merchant never sees */
  CREATE TABLE IF NOT EXISTS ticket_messages (
    id         BIGSERIAL PRIMARY KEY,
    ticket_id  BIGINT NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    author     TEXT NOT NULL CHECK (author IN ('merchant', 'staff', 'system')),
    staff_id   BIGINT REFERENCES staff (id),
    internal   BOOLEAN NOT NULL DEFAULT false,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS ticket_messages_ticket ON ticket_messages (ticket_id, created_at);
  /* pictures are data URLs (JPEG) until file storage exists; size checked by the route */
  CREATE TABLE IF NOT EXISTS ticket_pictures (
    id         BIGSERIAL PRIMARY KEY,
    ticket_id  BIGINT NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    message_id BIGINT REFERENCES ticket_messages (id) ON DELETE CASCADE,
    data       TEXT NOT NULL,
    mime       TEXT NOT NULL,
    bytes      INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  /* a ticket's pictures are found by their ticket (the chat and the Bugs and ideas board), without reading the table */
  CREATE INDEX IF NOT EXISTS ticket_pictures_ticket ON ticket_pictures (ticket_id, id);

  /* ---------- deleted orders: the number and the reason only, never the order ---------- */
  CREATE TABLE IF NOT EXISTS order_deletions (
    id         BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    order_id   BIGINT NOT NULL,
    order_no   TEXT NOT NULL,
    reason     TEXT NOT NULL,
    deleted_by TEXT NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, order_id)
  );

  /* ---------- orders placed by customers on a store's public page (app/[slug]) ----------
     server/storeOrders.ts writes them. number counts per shop and goes on from the shop's own orders (it is what the
     customer and the merchant see). The customer's details are sealed (server/crypto.ts); items are the products as
     priced by the server (id, name, qty, price, size, image). No payment is taken online yet: payment_status is 'test',
     and 'paid' for a cash order while it is marked delivered.
     stock_taken: the order took its products out of the shop's saved stock, so a merchant's save made before he saw
     the order gets it taken again (server/storeOrders.ts mergeOnlineSales). */
  CREATE TABLE IF NOT EXISTS store_orders (
    id               BIGSERIAL PRIMARY KEY,
    account_id       BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    number           INTEGER NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'review', 'processing', 'shipping', 'delivered', 'cancelled', 'refunded')),
    items            JSONB NOT NULL DEFAULT '[]',
    subtotal         NUMERIC(12, 3) NOT NULL,
    discount         NUMERIC(12, 3) NOT NULL DEFAULT 0,
    delivery_fee     NUMERIC(12, 3) NOT NULL DEFAULT 0,
    total            NUMERIC(12, 3) NOT NULL,
    coupon           TEXT,
    fulfil           TEXT NOT NULL DEFAULT 'delivery' CHECK (fulfil IN ('delivery', 'pickup')),
    customer_name    TEXT NOT NULL,
    customer_phone   TEXT,
    customer_email   TEXT,
    city             TEXT,
    address          TEXT,
    notes            TEXT,
    payment_method   TEXT NOT NULL CHECK (payment_method IN ('cliq', 'cash', 'card')),
    payment_status   TEXT NOT NULL DEFAULT 'test' CHECK (payment_status IN ('unpaid', 'test', 'paid')),
    source           TEXT NOT NULL DEFAULT 'storefront' CHECK (source IN ('storefront')),
    stock_taken      BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (account_id, number)
  );
  CREATE INDEX IF NOT EXISTS store_orders_account ON store_orders (account_id, id DESC);
  /* 'paid': a cash order the merchant marked delivered (the courier took the cash; server/storeOrders.ts
     setStoreOrderStatus). A database made before it allows it too. */
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_orders_payment_status_check' AND pg_get_constraintdef(oid) NOT LIKE '%''paid''%') THEN
      ALTER TABLE store_orders DROP CONSTRAINT store_orders_payment_status_check;
      ALTER TABLE store_orders ADD CONSTRAINT store_orders_payment_status_check CHECK (payment_status IN ('unpaid', 'test', 'paid'));
    END IF;
  END $$;

  /* ---------- visitors of the stores at their addresses (server/storeVisits.ts) ----------
     store_visits: one row per page a visitor opened, kept only for yesterday and today (Jordan time). No IP address,
     browser name or page address: visitor is a keyed fingerprint that changes every day and differs per shop, source is
     one word. new_visit: the visitor had opened nothing in this store for 30 minutes (or it is a new day).
     store_visit_days: the older days rolled up, one row per shop per day, kept for good. sources: visits by source
     word; products: views of the day's 20 most viewed products, by product id. */
  CREATE TABLE IF NOT EXISTS store_visits (
    account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    visitor    TEXT NOT NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('home', 'product', 'page', 'cart')),
    product_id BIGINT,
    source     TEXT NOT NULL CHECK (source IN ('whatsapp', 'instagram', 'facebook', 'tiktok', 'google', 'direct', 'other')),
    new_visit  BOOLEAN NOT NULL
  );
  CREATE INDEX IF NOT EXISTS store_visits_shop_at ON store_visits (account_id, at);
  CREATE TABLE IF NOT EXISTS store_visit_days (
    account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    day        DATE NOT NULL,
    visitors   INTEGER NOT NULL DEFAULT 0,
    visits     INTEGER NOT NULL DEFAULT 0,
    views      INTEGER NOT NULL DEFAULT 0,
    sources    JSONB NOT NULL DEFAULT '{}',
    products   JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (account_id, day)
  );

  /* ---------- domains ----------
     Kept only for the rows already saved: Dukkan no longer sells domains or connects a store's own domain (every store
     lives at the site address/<its link>), so nothing adds to this table or shows it any more. */
  CREATE TABLE IF NOT EXISTS domains (
    id            BIGSERIAL PRIMARY KEY,
    account_id    BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    client_id     BIGINT,             -- the id the merchant's page gave it
    name          TEXT NOT NULL,
    kind          TEXT NOT NULL CHECK (kind IN ('connect', 'bought')),
    status        TEXT NOT NULL DEFAULT 'awaiting' CHECK (status IN ('awaiting', 'checking', 'active', 'failed', 'removed')),
    years         SMALLINT,
    renews_at     TIMESTAMPTZ,
    auto_renew    BOOLEAN NOT NULL DEFAULT true,
    paid          NUMERIC(10, 3) NOT NULL DEFAULT 0,
    papers_needed BOOLEAN NOT NULL DEFAULT false,
    note          TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS domains_name ON domains (lower(name)) WHERE status <> 'removed';

  /* ---------- themes bought ---------- */
  CREATE TABLE IF NOT EXISTS theme_purchases (
    id         BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    theme_id   TEXT NOT NULL,
    price      NUMERIC(10, 3) NOT NULL DEFAULT 0,
    paid_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, theme_id)
  );
  -- the way it was paid (card or cliq), for the payment numbers in Diwan; purchases from before have none
  ALTER TABLE theme_purchases ADD COLUMN IF NOT EXISTS method TEXT;

  /* ---------- papers staff check (courier proof, commercial registration) ---------- */
  CREATE TABLE IF NOT EXISTS documents (
    id          BIGSERIAL PRIMARY KEY,
    account_id  BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('courier_proof', 'commercial_registration', 'other')),
    name        TEXT NOT NULL,
    file_key    TEXT,                 -- set once file storage exists
    status      TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'approved', 'rejected')),
    reviewed_by BIGINT REFERENCES staff (id),
    note        TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  /* The file itself, kept in the database like ticket pictures (there is no separate file storage): its bytes encrypted
     with server/crypto.ts sealBytes(), the type read from those bytes, and its size. partner and partner_kind say which
     delivery partner a courier proof is for (the name sealed; kind 0 a shipping company, 1 a person), as the merchant
     named them when the file was sent. Rows from before have no file (data IS NULL). */
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS data BYTEA;
  /* A document's address in every link (its file, its review): a random code of 32 letters and digits, never the
     counting number, so no one can find a document by trying the next number. Older rows get one here. */
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS public_id TEXT;
  ALTER TABLE documents ALTER COLUMN public_id SET DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  UPDATE documents SET public_id = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') WHERE public_id IS NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS documents_public_id ON documents (public_id);
  /* A rejected document is shown to its merchant once in a pop-up with the reason (components/DocumentRejected.tsx):
     this is set when they close it, and cleared each time Diwan rejects it again. */
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS rejection_seen BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime TEXT;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS bytes INTEGER;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS partner TEXT NOT NULL DEFAULT '';
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS partner_kind SMALLINT;
  CREATE INDEX IF NOT EXISTS documents_account ON documents (account_id, kind, created_at);
  /* A document's number among its account's documents of the same kind ("Proof of delivery #002"), kept for good: it was
     counted on every read before, so removing one renumbered the rest and the merchant and staff no longer meant the
     same file by the same number. A new document takes the next number after every one of its kind, removed ones too,
     so a number is never given twice. Rows from before get the number they showed until now (their place in the order
     they were sent), after any number already given in their account, before the unique index needs them. */
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS seq INTEGER;
  UPDATE documents d SET seq = n.seq
    FROM (SELECT x.id,
                 COALESCE((SELECT max(m.seq) FROM documents m WHERE m.account_id = x.account_id AND m.kind = x.kind), 0)
                   + row_number() OVER (PARTITION BY x.account_id, x.kind ORDER BY x.created_at, x.id) AS seq
            FROM documents x WHERE x.seq IS NULL) n
   WHERE d.id = n.id;
  CREATE UNIQUE INDEX IF NOT EXISTS documents_seq ON documents (account_id, kind, seq);
  /* Set when the merchant removes a document. Its file goes (data and file_key are cleared, as the merchant asked, once
     the few minutes he can undo it in are over: server/documents.ts RESTORE_MINUTES; it is never served meanwhile) but
     the row stays as a record for staff: a proof staff were checking, or already approved, doesn't vanish from Diwan
     without a trace. The merchant's own pages and limits never count it again. */
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

  /* ---------- pictures and videos of the stores (product photos, logos, designs, page backgrounds) ---------- */
  /* One row per file a merchant's store shows, served to anyone at /media/<id> (server/media.ts). The id is random and
     long, so a file can't be guessed. The bytes are kept here (data) while MEDIA_BACKEND is postgres; with another
     backend this row keeps only what the file is and the bytes live there (data stays NULL). sha256 lets the same file
     sent twice by one store be kept once. Not encrypted, on purpose: every storefront visitor sees these pictures. */
  CREATE TABLE IF NOT EXISTS media (
    id          TEXT PRIMARY KEY,
    account_id  BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('product', 'logo', 'design', 'background')),
    mime        TEXT NOT NULL,
    bytes       INTEGER NOT NULL CHECK (bytes > 0),
    sha256      TEXT NOT NULL,
    backend     TEXT NOT NULL DEFAULT 'postgres',
    data        BYTEA,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS media_account_sha ON media (account_id, sha256);
  CREATE INDEX IF NOT EXISTS media_account_created ON media (account_id, created_at);

  /* ---------- messages to merchants ---------- */
  CREATE TABLE IF NOT EXISTS announcements (
    id         BIGSERIAL PRIMARY KEY,
    title_en   TEXT NOT NULL,
    title_ar   TEXT NOT NULL,
    body_en    TEXT NOT NULL DEFAULT '',
    body_ar    TEXT NOT NULL DEFAULT '',
    audience   JSONB NOT NULL DEFAULT '{"all": true}',   -- {"all":true}, {"newStores":true} or {"accounts":[ids]}
    banner     BOOLEAN NOT NULL DEFAULT true,
    starts_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at    TIMESTAMPTZ,
    created_by BIGINT REFERENCES staff (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  /* the merchant's bell. account_id NULL with an announcement_id: shown to whoever the announcement is for */
  CREATE TABLE IF NOT EXISTS notifications (
    id              BIGSERIAL PRIMARY KEY,
    account_id      BIGINT REFERENCES accounts (id) ON DELETE CASCADE,
    announcement_id BIGINT REFERENCES announcements (id) ON DELETE CASCADE,
    kind            TEXT NOT NULL,
    params          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS notifications_account ON notifications (account_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id BIGINT NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
    account_id      BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (notification_id, account_id)
  );
  /* What the merchant chose on Settings, Customize notifications (app/api/notification-prefs/route.ts):
     prefs = { "<event>": { "whatsapp": true|false, "email": true|false } } for the events in components/notifyPrefs.ts
     (newOrder, storeRating, productRating, shippingRating, customerQuestion, lowStock, outOfStock). No row, or an event
     missing from prefs: the default, both on. Nothing sends WhatsApp or email messages yet: this is what a future sender
     reads before it sends one. The bell does not use it. */
  CREATE TABLE IF NOT EXISTS notification_prefs (
    account_id BIGINT PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
    prefs      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  /* ---------- complaints about stores ---------- */
  CREATE TABLE IF NOT EXISTS store_reports (
    id               BIGSERIAL PRIMARY KEY,
    account_id       BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    reporter_kind    TEXT NOT NULL CHECK (reporter_kind IN ('customer', 'staff')),
    reporter_contact TEXT NOT NULL DEFAULT '',
    reason           TEXT NOT NULL CHECK (reason IN ('scam', 'fake', 'banned', 'other')),
    body             TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'checking', 'closed')),
    notes            TEXT NOT NULL DEFAULT '',
    handled_by       BIGINT REFERENCES staff (id),
    ip               TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  /* ---------- platform-wide settings and features ---------- */
  CREATE TABLE IF NOT EXISTS platform_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_by BIGINT REFERENCES staff (id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  /* The 'trial_days' row (the free trial's length) is no longer used since 2026-11-16: Dukkan has no free trial. It is
     left in place where it exists, but nothing reads or writes it any more. */
  /* The 'site_content' row (the landing page's words, once saved from Diwan > Website) is no longer used since
     2026-11-16: the website's copy lives in code (components/siteContent.ts). The row is left in place rather than
     deleted, but nothing reads or writes it any more. */

  /* unused since flags were removed; kept so existing data isn't dropped */
  CREATE TABLE IF NOT EXISTS feature_flags (
    key         TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    mode        TEXT NOT NULL DEFAULT 'off' CHECK (mode IN ('off', 'some', 'all')),
    account_ids BIGINT[] NOT NULL DEFAULT '{}',
    updated_by  BIGINT REFERENCES staff (id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  /* ---------- theme and app marketplace ---------- */
  CREATE TABLE IF NOT EXISTS developers (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    company    TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'approved', 'blocked')),
    share_pct  NUMERIC(5, 2) NOT NULL DEFAULT 70,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS marketplace_items (
    id           BIGSERIAL PRIMARY KEY,
    developer_id BIGINT REFERENCES developers (id),   -- NULL: made by Dukkan
    kind         TEXT NOT NULL CHECK (kind IN ('theme', 'app')),
    key          TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    price        NUMERIC(10, 3) NOT NULL DEFAULT 0,
    version      TEXT NOT NULL DEFAULT '1.0',
    status       TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'checking', 'approved', 'rejected', 'live', 'removed')),
    reviewed_by  BIGINT REFERENCES staff (id),
    note         TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  /* agent A: a staff member given a temporary password by an owner picks their own at the first sign-in */
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

  /* agent B: merchants' optional 2-step codes. totp_secret is kept while it is being set up (totp_on false) and once on.
     pending_totp: the password was right, the session waits for the code (counts as signed out until then). */
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS totp_secret TEXT;
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS totp_on BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pending_totp BOOLEAN NOT NULL DEFAULT false;
  -- one device at a time (server/auth.ts onlyThisSession): when a newer sign-in took this session's place
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ;
  /* agent B: Diwan's shop list sorts and filters on these */
  CREATE INDEX IF NOT EXISTS shops_created ON shops (created_at DESC);
  CREATE INDEX IF NOT EXISTS subscriptions_account ON subscriptions (account_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS impersonations_account ON impersonations (account_id, started_at DESC);

  /* agent D: the rest of the merchant's profile from the settings page (all optional; dob as YYYY-MM-DD) */
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS city   TEXT NOT NULL DEFAULT '';
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS dob    DATE;
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT '' CHECK (gender IN ('', 'male', 'female'));
  /* agent D: Diwan's queues */
  CREATE INDEX IF NOT EXISTS domains_status ON domains (status, updated_at DESC);
  CREATE INDEX IF NOT EXISTS domains_account ON domains (account_id, created_at);
  CREATE INDEX IF NOT EXISTS documents_status ON documents (status, created_at DESC);
  CREATE INDEX IF NOT EXISTS store_reports_status ON store_reports (status, created_at DESC);
  CREATE INDEX IF NOT EXISTS store_reports_account ON store_reports (account_id, created_at DESC);

  /* encryption (server/crypto.ts): private columns hold sealed text, so they must be TEXT without value checks, and
     emails and mobiles are found by their fingerprints. The unique indexes on the fingerprints are made by
     encryptOldRows (server/encryptData.ts) once every row has one. */
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_hash TEXT;
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS phone_hash TEXT;
  ALTER TABLE staff    ADD COLUMN IF NOT EXISTS email_hash TEXT;
  ALTER TABLE accounts ALTER COLUMN dob TYPE TEXT USING dob::text;
  ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_gender_check;
  ALTER TABLE store_data ADD COLUMN IF NOT EXISTS plain_len INT;
  /* the theme the store's design is built on (seen-themes: the active one, or the theme a saved copy came from) */
  ALTER TABLE shops ADD COLUMN IF NOT EXISTS theme_id TEXT NOT NULL DEFAULT 'dukkan';
  /* the ways to pay the merchant chose ("cliq,cash"; "" none yet); NULL: an older store that never chose (every way Dukkan has on) */
  ALTER TABLE shops ADD COLUMN IF NOT EXISTS store_pays TEXT;

  /* The theme store's list, run from Diwan (components/themeListing.ts). A "code" theme's look is in the code and its
     empty words fall back to the code's; a "design" theme is all here (design: the whole store design, as JSON). The
     two code themes sold today start live at their prices. Dukkan's free designs (dukkan, mada) are every store's and
     are not listed. */
  CREATE TABLE IF NOT EXISTS catalog_themes (
    id          TEXT PRIMARY KEY,
    source      TEXT NOT NULL CHECK (source IN ('code', 'design')),
    status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'live', 'hidden')),
    name        JSONB,
    tagline     JSONB,
    about       JSONB,
    features    JSONB,
    tags        JSONB,
    price       NUMERIC(10, 3) NOT NULL DEFAULT 0 CHECK (price >= 0),
    sort        INT NOT NULL DEFAULT 100,
    featured    BOOLEAN NOT NULL DEFAULT false,
    demo        JSONB,
    design      JSONB,
    released_at TIMESTAMPTZ,
    created_by  BIGINT REFERENCES staff (id),
    updated_by  BIGINT REFERENCES staff (id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS catalog_themes_store ON catalog_themes (status, sort);
  -- themes are only live or hidden now: a draft or a theme in review becomes hidden (still only staff see it)
  UPDATE catalog_themes SET status = 'hidden' WHERE status IN ('draft', 'review');

  /* Pages Dukkan's team publishes for merchants, read inside their dashboard (guides, news, rules). Made in Diwan's
     marketing pages (/diwan/pages): draft → live → hidden. audience as in announcements (server/announce.ts). Not
     private, so not sealed. */
  /* the Developer role (components/diwan/perms.ts): a database made before it allows it too */
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_role_check' AND pg_get_constraintdef(oid) NOT LIKE '%developer%') THEN
      ALTER TABLE staff DROP CONSTRAINT staff_role_check;
      ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('owner', 'support', 'developer'));
    END IF;
  END $$;
  -- Diwan has no roles any more (2026-11-19): every staff member is an owner
  UPDATE staff SET role = 'owner' WHERE role <> 'owner';

  CREATE TABLE IF NOT EXISTS dukkan_pages (
    id           BIGSERIAL PRIMARY KEY,
    slug         TEXT NOT NULL UNIQUE,
    title_en     TEXT NOT NULL,
    title_ar     TEXT NOT NULL,
    summary_en   TEXT NOT NULL DEFAULT '',
    summary_ar   TEXT NOT NULL DEFAULT '',
    body_en      TEXT NOT NULL DEFAULT '',
    body_ar      TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'hidden')),
    in_menu      BOOLEAN NOT NULL DEFAULT false,
    sort         INT NOT NULL DEFAULT 100,
    audience     JSONB NOT NULL DEFAULT '{"all": true}',
    published_at TIMESTAMPTZ,
    created_by   BIGINT REFERENCES staff (id),
    updated_by   BIGINT REFERENCES staff (id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS dukkan_page_views (
    page_id    BIGINT NOT NULL REFERENCES dukkan_pages (id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (page_id, account_id)
  );

  /* Pop-ups Dukkan's team shows merchants in their dashboard (an offer, a new feature, a notice), made in Diwan's
     marketing pages (/diwan/popups): draft → live → ended, between starts_at and ends_at, to an audience as in
     announcements. Each merchant sees one at most once (popup_views); "clicked" counts its button. */
  CREATE TABLE IF NOT EXISTS popups (
    id          BIGSERIAL PRIMARY KEY,
    title_en    TEXT NOT NULL,
    title_ar    TEXT NOT NULL,
    body_en     TEXT NOT NULL DEFAULT '',
    body_ar     TEXT NOT NULL DEFAULT '',
    image       TEXT NOT NULL DEFAULT '',
    button_en   TEXT NOT NULL DEFAULT '',
    button_ar   TEXT NOT NULL DEFAULT '',
    button_link TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'ended')),
    audience    JSONB NOT NULL DEFAULT '{"all": true}',
    starts_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at     TIMESTAMPTZ,
    priority    INT NOT NULL DEFAULT 0,
    created_by  BIGINT REFERENCES staff (id),
    updated_by  BIGINT REFERENCES staff (id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS popup_views (
    popup_id   BIGINT NOT NULL REFERENCES popups (id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    clicked_at TIMESTAMPTZ,
    PRIMARY KEY (popup_id, account_id)
  );
  /* A pop-up is drawn by one of the coded templates (components/popupTemplateRules.ts: "card", "theme-gift", ...) with
     its slots filled in (slots: { key: {en, ar} | "text" | {en: [...], ar: [...]} }, checked by server/popups.ts).
     title_en/title_ar keep its title for Diwan's lists and the activity log; the other text columns are a card's, kept
     filled for cards. placement: 'home' (the dashboard home only) or 'any' (any merchant page after sign-in). Not
     private, so not sealed (like the columns above). */
  ALTER TABLE popups ADD COLUMN IF NOT EXISTS template  TEXT NOT NULL DEFAULT 'card';
  ALTER TABLE popups ADD COLUMN IF NOT EXISTS slots     JSONB NOT NULL DEFAULT '{}';
  ALTER TABLE popups ADD COLUMN IF NOT EXISTS placement TEXT NOT NULL DEFAULT 'home';
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'popups_placement_check') THEN
      ALTER TABLE popups ADD CONSTRAINT popups_placement_check CHECK (placement IN ('home', 'any'));
    END IF;
  END $$;
  -- pop-ups made before templates were cards: their words move into the card's slots (once: only while slots are empty)
  UPDATE popups SET slots = jsonb_build_object(
      'title', jsonb_build_object('en', title_en, 'ar', title_ar),
      'body', jsonb_build_object('en', body_en, 'ar', body_ar),
      'image', image,
      'button', jsonb_build_object('en', button_en, 'ar', button_ar),
      'buttonLink', button_link)
   WHERE template = 'card' AND slots = '{}'::jsonb;

  /* What start-up put in once (a pop-up, an announcement), by name, so it is never put in again: not even after staff
     delete or end it. */
  CREATE TABLE IF NOT EXISTS start_seeds (
    key     TEXT PRIMARY KEY,
    done_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  DO $$
  DECLARE nid BIGINT;
  BEGIN
    /* The founders' gift (Mada, Dukkan's free theme) used to be written into the pages (components/ThemePopup.tsx) and
       shown once to every account after it signed in. It is a pop-up run from Diwan now, with the same words, for the
       stores that sign up while it is live, on whichever merchant page they open first. */
    IF NOT EXISTS (SELECT 1 FROM start_seeds WHERE key = 'founders-gift') THEN
      INSERT INTO popups (template, slots, title_en, title_ar, status, audience, placement, priority)
      VALUES ('theme-gift', jsonb_build_object(
          'badge', jsonb_build_object('en', 'A gift for you', 'ar', 'هدية لك'),
          'title', jsonb_build_object('en', 'Dukkan Founders', 'ar', 'مؤسسو دكان'),
          'body', jsonb_build_object('en', 'Because you are one of Dukkan''s founders, we are gifting you this free theme for your store.', 'ar', 'لأنك من مؤسسي دكان، نهديك هذا التصميم مجانًا لتستخدمه في متجرك.'),
          'note', jsonb_build_object('en', 'It stays in My themes, so you can use it any time.', 'ar', 'يبقى في «ثيماتي» لتستخدمه في أي وقت.'),
          'theme', 'mada',
          'image', '/themes/mada.jpg',
          'use', jsonb_build_object('en', 'Use it on my store', 'ar', 'استخدمه في متجري'),
          'preview', jsonb_build_object('en', 'Preview', 'ar', 'معاينة'),
          'later', jsonb_build_object('en', 'Later', 'ar', 'لاحقًا')),
        'Dukkan Founders', 'مؤسسو دكان', 'live', '{"newStores": true}', 'any', 10);
      INSERT INTO start_seeds (key) VALUES ('founders-gift');
    END IF;
    /* The welcome in the bell used to be added by the page itself (components/DashboardBar.tsx). It is an announcement
       now (bell only, no banner) for the stores that sign up while it runs; each store reads it once, as any other. */
    IF NOT EXISTS (SELECT 1 FROM start_seeds WHERE key = 'welcome-note') THEN
      INSERT INTO announcements (title_en, title_ar, body_en, body_ar, audience, banner)
      VALUES ('Welcome to Dukkan!', 'أهلًا بك في دكان!', 'Finish setting up your store to start selling.', 'أكمل إعداد متجرك لتبدأ البيع.', '{"newStores": true}', false)
      RETURNING id INTO nid;
      INSERT INTO notifications (account_id, announcement_id, kind) VALUES (NULL, nid, 'announcement');
      INSERT INTO start_seeds (key) VALUES ('welcome-note');
    END IF;
  END $$;
  INSERT INTO catalog_themes (id, source, status, price, sort, released_at) VALUES
    ('atelier', 'code', 'live', 19.99, 10, now()), ('lamma', 'code', 'live', 39, 20, now())
  ON CONFLICT (id) DO NOTHING;

  /* ---------- store orders: one order per checkout ----------
     The cart sends a key of its own with an order and keeps it until it hears the order is in (server/storeOrders.ts):
     the same key sent again (its answer was lost) gets the order already saved, never a second one. */
  ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS attempt_key TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS store_orders_attempt ON store_orders (account_id, attempt_key) WHERE attempt_key IS NOT NULL;
  /* Diwan's Payment methods card counts the orders of the last 30, 90 or 365 days by way to pay
     (app/api/diwan/payment-methods): read by when they were placed, never the whole table for a short window */
  CREATE INDEX IF NOT EXISTS store_orders_created ON store_orders (created_at, payment_method);

  /* ---------- forgotten passwords: a one-time code sent to the email or mobile (server/passwordReset.ts) ----------
     One row per code asked for. contact_hash: the fingerprint of the email or mobile it was asked for (crypto.ts
     emailKey / phoneKey), which the code is checked against. account_id is NULL when nobody has that email or mobile:
     the row is still made (with a code that can never match), so asking for and checking a code answer the same whether
     there is an account or not. code_hash: an HMAC of the code with the server's key, never the code. Only the newest
     code of an account (and of a contact) is good: asking again marks the older ones used. A right code gives a reset
     token (only its SHA-256 kept here) good for one password change within 15 minutes. ip_hash: a keyed fingerprint of
     the address that asked, never the address. Rows are cleared a day after they ran out. */
  CREATE TABLE IF NOT EXISTS password_resets (
    id               BIGSERIAL PRIMARY KEY,
    account_id       BIGINT REFERENCES accounts (id) ON DELETE CASCADE,
    contact_hash     TEXT NOT NULL,
    code_hash        TEXT NOT NULL,
    channel          TEXT NOT NULL CHECK (channel IN ('email', 'phone')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at       TIMESTAMPTZ NOT NULL,
    attempts         SMALLINT NOT NULL DEFAULT 0,
    verified_at      TIMESTAMPTZ,
    token_hash       TEXT,
    token_expires_at TIMESTAMPTZ,
    used_at          TIMESTAMPTZ,
    ip_hash          TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS password_resets_contact ON password_resets (contact_hash, id DESC);
  CREATE INDEX IF NOT EXISTS password_resets_account ON password_resets (account_id) WHERE account_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS password_resets_token ON password_resets (token_hash) WHERE token_hash IS NOT NULL;

  /* ---------- finding a shop by its owner's name ----------
     The name is sealed, so Diwan finds it by the fingerprints of its words (server/crypto.ts nameKeys): written at sign-up
     and on every name change. NULL: not worked out yet (an account from before this column), filled in batches by
     prepareShops (server/shops.ts) before Diwan's lists read it. */
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS name_keys TEXT[];
  CREATE INDEX IF NOT EXISTS accounts_name_keys ON accounts USING GIN (name_keys);
  /* the form of those fingerprints (server/crypto.ts NAME_KEYS_VERSION): 2 adds each word without its "ال"/"al-", 3 the
     joined form of a compound name ("عبد الله" also as "عبدالله"). The partial index finds the rows still to fill. */
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS name_keys_v SMALLINT NOT NULL DEFAULT 0;
  DROP INDEX IF EXISTS accounts_name_keys_old;
  CREATE INDEX IF NOT EXISTS accounts_name_keys_old3 ON accounts (id) WHERE name_keys_v < 3;

  /* ---------- the rule a shops row's order_count and total_sales were counted by (server/shops.ts SHOP_COUNTS_VERSION) ----------
     1: the merchant's own rule (no card/CliQ test orders; sales are the orders his Home calls sales). A row counted by
     an older rule is counted again by prepareShops, in batches. */
  ALTER TABLE shops ADD COLUMN IF NOT EXISTS counts_v SMALLINT NOT NULL DEFAULT 0;
  /* the store's delivery way, for Diwan's store page (filled with counts_v 1): its own courier's name (ship_mode 'own';
     a company or person the merchant works with, made safe like the store's name) and whether customers may pick up */
  ALTER TABLE shops ADD COLUMN IF NOT EXISTS ship_name TEXT NOT NULL DEFAULT '';
  ALTER TABLE shops ADD COLUMN IF NOT EXISTS pickup BOOLEAN NOT NULL DEFAULT false;
`;
