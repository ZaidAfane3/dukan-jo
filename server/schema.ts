/* The tables behind Diwan (Dukkan's staff console) and everything merchants send to Dukkan. Run after the first three
   tables in db.ts, inside the same advisory lock, on the first request. Every statement can run again safely
   (IF NOT EXISTS / ON CONFLICT), so an existing database just gains what is new. A "shop" is one merchant account:
   account_id is the shop's id everywhere. Money is in JOD with 3 decimals (fils). */

export const DIWAN_SCHEMA = `
  /* ---------- merchant accounts: sign-in history ---------- */
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_count   INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT now();
  /* impersonation_id was set when a staff member opened a session with "Log in as merchant", removed 2026-11-16: no
     session has had it since, so it goes (2026-11-23), with the impersonations table further down. */
  ALTER TABLE sessions DROP COLUMN IF EXISTS impersonation_id;

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
  /* the SHA-256 of each unused recovery code (server/recovery.ts): typed instead of the 6-digit code when the phone is lost */
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS totp_recovery TEXT[] NOT NULL DEFAULT '{}';

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
  /* the activity page's list of actions to filter by (one step through this index per action, not the whole log) */
  CREATE INDEX IF NOT EXISTS audit_log_action ON audit_log (action);
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
  /* finding a store by its link (every store page, visit, coupon and order asks lower(slug) = $1): the unique index above
     only covers non-empty links, so Postgres can't use it for a lookup by a parameter and read the whole table */
  CREATE INDEX IF NOT EXISTS shops_slug_find ON shops (lower(slug));

  /* ---------- payments ---------- */
  CREATE TABLE IF NOT EXISTS payments (
    id              BIGSERIAL PRIMARY KEY,
    account_id      BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
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

  /* ---------- tables gone on 2026-11-23 ----------
     Unused since 2026-11-16 and kept until now only for their old rows (a copy is taken before this goes live):
     plans and subscriptions (Dukkan has no plans and no free trial), with payments.subscription_id, their link that
     stayed empty; impersonations ("Log in as merchant" was removed); domains (Dukkan no longer sells domains or
     connects a store's own domain); feature_flags (the flags were removed); email_verifications (email codes live in
     email_codes since 2026-11-21). Their indexes go with them. The column goes before subscriptions, which it points
     at, and subscriptions before plans. Nothing happens on a database that never had them. */
  ALTER TABLE payments DROP COLUMN IF EXISTS subscription_id;
  DROP TABLE IF EXISTS subscriptions;
  DROP TABLE IF EXISTS plans;
  DROP TABLE IF EXISTS impersonations;
  DROP TABLE IF EXISTS domains;
  DROP TABLE IF EXISTS feature_flags;
  DROP TABLE IF EXISTS email_verifications;

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
  CREATE INDEX IF NOT EXISTS ticket_pictures_message ON ticket_pictures (message_id) WHERE message_id IS NOT NULL;

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
     stock_taken: whether the order took its stock (server/storeOrders.ts: an order placed since 2026-11-22 takes it only
     once it is confirmed or paid, and is saved with false until then; every order placed before took it when it was
     placed, so the default true is right for them). What an order took is counted on each product and coupon too
     (soldOnline, usedOnline), and that is what server/storeOrders.ts mergeOnlineSales uses. */
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
  /* each saved view asks whether this visitor opened anything in the last 30 minutes (server/storeVisits.ts) */
  CREATE INDEX IF NOT EXISTS store_visits_visitor ON store_visits (account_id, visitor, at);
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
  CREATE INDEX IF NOT EXISTS theme_purchases_theme ON theme_purchases (theme_id);

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
  /* draft: a courier proof Diwan doesn't see yet. Proofs used to be drafts until the merchant saved his delivery choice
     with his own courier; since 2026-11-24 none is made (app/api/documents POST) and start-up hands the old ones over
     (below, with sent_at). Kept so old rows and the NOT draft filters stay valid. */
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS draft BOOLEAN NOT NULL DEFAULT false;

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
  /* unused_since: when the sweep (server/media.ts sweepUnusedMedia) first found no saved page using the file, NULL
     while one uses it. A file goes only once it was unused that long (UNUSED_DAYS), not just once it is that old: a
     photo removed and brought back by Undo, or a picture re-used, stays. Files kept before this column start unmarked,
     so none goes sooner than it would have. */
  ALTER TABLE media ADD COLUMN IF NOT EXISTS unused_since TIMESTAMPTZ;

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
  /* an announcement's bell line, and its reads, are found by the announcement (Diwan's lists count them per row) */
  CREATE INDEX IF NOT EXISTS notifications_announcement ON notifications (announcement_id) WHERE announcement_id IS NOT NULL;
  /* "has the merchant an unread reply on this ticket" (the tickets list asks once per ticket) */
  CREATE INDEX IF NOT EXISTS notifications_account_kind ON notifications (account_id, kind);
  CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id BIGINT NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
    account_id      BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (notification_id, account_id)
  );
  /* What the merchant chose on Settings, Customize notifications (app/api/notification-prefs/route.ts):
     prefs = { "<event>": { "whatsapp": true|false, "email": true|false } } for the events in components/notifyPrefs.ts
     (newOrder, storeRating, productRating, shippingRating, customerQuestion, lowStock, outOfStock). No row, or an event
     missing from prefs: the default, both on. server/notify.ts reads the email choice of the events it emails
     (notifyPrefs.ts LIVE_EMAIL); WhatsApp is not sent yet. The bell does not use it. */
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
  /* Two rows nothing has read or written since 2026-11-16 go (2026-11-23): 'trial_days' (the free trial's length; Dukkan
     has no free trial) and 'site_content' (the landing page's words, once saved from Diwan > Website; the website's copy
     lives in code, components/siteContent.ts). */
  DELETE FROM platform_settings WHERE key IN ('trial_days', 'site_content');

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

  /* the language each merchant and staff member uses Dukkan in (server/lang.ts), saved when they sign in or switch it, so
     the emails sent while they are away come in that language alone. NULL until then: those emails come in both. */
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS lang TEXT CHECK (lang IN ('ar', 'en'));
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS lang TEXT CHECK (lang IN ('ar', 'en'));

  /* agent B: merchants' optional 2-step sign-in (totp_on). Since 2026-11-21 its codes come by email (server/emailVerify.ts,
     two_step_method below); totp_secret was the authenticator app's secret before that, is no longer written for
     merchants, and is cleared whenever 2-step is turned on or off (staff still use theirs for Diwan).
     pending_totp: the password was right, the session waits for the code (counts as signed out until then). */
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS totp_secret TEXT;
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS totp_on BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pending_totp BOOLEAN NOT NULL DEFAULT false;
  -- one device at a time (server/auth.ts onlyThisSession): when a newer sign-in took this session's place
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ;
  /* agent B: Diwan's shop list sorts and filters on these */
  CREATE INDEX IF NOT EXISTS shops_created ON shops (created_at DESC);
  /* "new stores" audiences count the accounts made since an announcement, pop-up or page went out (server/announce.ts) */
  CREATE INDEX IF NOT EXISTS accounts_created ON accounts (created_at);

  /* agent D: the rest of the merchant's profile from the settings page (all optional; dob as YYYY-MM-DD) */
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS city   TEXT NOT NULL DEFAULT '';
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS dob    DATE;
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT '' CHECK (gender IN ('', 'male', 'female'));
  /* agent D: Diwan's queues */
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

  /* ---------- store orders Dukkan Ship delivers (Diwan > Dukkan Ship > Orders) ----------
     ship_by: who takes the order to the customer, as it was when the order was placed (server/storeOrders.ts):
     'dukkan' (the store delivers with Dukkan Ship), 'own' (the merchant's own courier) or 'pickup' (the customer
     collects it). Orders placed before this column get it once from what their store uses now (ship_by is null only
     until then). ship_state: Dukkan's delivery of a 'dukkan' order, set by staff: 'waiting', 'delivered' or 'failed'
     (not delivered, with ship_note saying why, sealed); ship_at and ship_staff: when and by whom. */
  ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS ship_by TEXT CHECK (ship_by IN ('dukkan', 'own', 'pickup', 'none'));
  /* 'none': nothing in the order is delivered (codes, services). A database made before 'none' was allowed gets it once */
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_orders_ship_by_check' AND pg_get_constraintdef(oid) NOT LIKE '%none%') THEN
      ALTER TABLE store_orders DROP CONSTRAINT store_orders_ship_by_check;
      ALTER TABLE store_orders ADD CONSTRAINT store_orders_ship_by_check CHECK (ship_by IN ('dukkan', 'own', 'pickup', 'none'));
    END IF;
  END $$;
  ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS ship_state TEXT NOT NULL DEFAULT 'waiting' CHECK (ship_state IN ('waiting', 'delivered', 'failed'));
  ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS ship_note TEXT;
  ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS ship_at TIMESTAMPTZ;
  ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS ship_staff BIGINT REFERENCES staff (id) ON DELETE SET NULL;
  UPDATE store_orders o
     SET ship_by = CASE WHEN o.fulfil = 'pickup' THEN 'pickup' WHEN COALESCE(s.ship_mode, '') = 'own' THEN 'own' ELSE 'dukkan' END,
         /* an order its store already marked delivered was delivered: it never comes back as one to deliver */
         ship_state = CASE WHEN o.status = 'delivered' THEN 'delivered' ELSE o.ship_state END
    FROM shops s
   WHERE o.ship_by IS NULL AND s.account_id = o.account_id;
  CREATE INDEX IF NOT EXISTS store_orders_dukkan_ship ON store_orders (id DESC) WHERE ship_by = 'dukkan';

  /* ---------- announcements and pop-ups that were ended early ----------
     "End now" in Diwan keeps the row (it moves to the "Past" list) and says here when and by whom. Null: it ran to its
     own end, is still on, or was ended before these columns. "Start again" clears them. */
  ALTER TABLE announcements ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
  ALTER TABLE announcements ADD COLUMN IF NOT EXISTS ended_by BIGINT REFERENCES staff (id) ON DELETE SET NULL;
  ALTER TABLE popups ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
  ALTER TABLE popups ADD COLUMN IF NOT EXISTS ended_by BIGINT REFERENCES staff (id) ON DELETE SET NULL;
  /* restarted_at: when "Start again" last sent an ended announcement out again. Its start stays as it was (so "new
     stores" still means the stores made since it first went out); the bell dates it from this instead, so it is at the
     top again. Null: never started again. */
  ALTER TABLE announcements ADD COLUMN IF NOT EXISTS restarted_at TIMESTAMPTZ;

  /* ---------- store files: the platform's own, the way their bytes are kept, and files taken down ----------
     A file with no account (account_id NULL) is the platform's: a picture of a theme store design or of the starter
     design (server/media.ts adoptPlatformMedia). Staff upload those while signed in as some merchant, so the ones saved
     before this change are handed to the platform here (every start: it only moves what is still under an account).
     Bytes are kept uncompressed (STORAGE EXTERNAL; pictures and videos are already compressed), so a piece of a file
     (a video's Range, a piece of a stream) is read without reading the whole file first. Applies to files kept from
     now on. media_blocked: the bytes of files Diwan took down, which can't be kept again. */
  ALTER TABLE media ALTER COLUMN account_id DROP NOT NULL;
  ALTER TABLE media ALTER COLUMN data SET STORAGE EXTERNAL;
  UPDATE media SET account_id = NULL
   WHERE account_id IS NOT NULL AND id IN (
     SELECT (regexp_matches(x.v, '/media/([A-Za-z0-9_-]{24})', 'g'))[1]
       FROM (SELECT design::text AS v FROM catalog_themes WHERE design::text LIKE '%/media/%'
             UNION ALL SELECT value::text FROM platform_settings WHERE value::text LIKE '%/media/%') x);
  CREATE TABLE IF NOT EXISTS media_blocked (
    sha256     TEXT PRIMARY KEY,
    media_id   TEXT NOT NULL,
    staff_id   BIGINT REFERENCES staff (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  /* accounts.email_verified said the account proved it gets the email it signs in with. Since 2026-11-21 an account
     exists only once its email was confirmed at sign-up (see "email codes" below), so it was always true and nothing
     read it: it goes (2026-11-23). */
  ALTER TABLE accounts DROP COLUMN IF EXISTS email_verified;

  /* ---------- email codes: sign-up, 2-step sign-in, a new email (server/emailVerify.ts) ----------
     Since 2026-11-21 an account exists only once its email was confirmed at sign-up, so every account counts as
     confirmed.
     email_codes: every code sent by email. ref: what it is for ("s:" a sign-up waiting, "l:" a session waiting for its
     2-step code, "c:" an account's new email, "t:" turning 2-step on or off). Kept only as an HMAC (crypto.ts blind).
     new_email: for "c:", the address the account moves to (sealed). confirmed_at: the code was right (a second tab
     sending the same code at once is answered "ok" too). cancelled_at: the email change was given up.
     signup_pending: a sign-up whose email code isn't typed yet. Nothing in accounts until it is, so an address
     nobody confirmed holds nothing. Its browser holds the token (cookie dukkan-signup). Kept an hour.
     two_step_method: how a merchant with 2-step on (totp_on) gets the code: 'email' (WhatsApp later). The authenticator
     app is gone: accounts that used it get their codes by email. */
  CREATE TABLE IF NOT EXISTS email_codes (
    id           BIGSERIAL PRIMARY KEY,
    ref          TEXT NOT NULL,
    purpose      TEXT NOT NULL,
    email_hash   TEXT NOT NULL,
    new_email    TEXT,
    code_hash    TEXT NOT NULL,
    attempts     SMALLINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    used_at      TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS email_codes_ref ON email_codes (ref, id DESC);
  CREATE TABLE IF NOT EXISTS signup_pending (
    id            BIGSERIAL PRIMARY KEY,
    token_hash    TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL,
    email_hash    TEXT NOT NULL,
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL,
    phone_hash    TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    name_keys     TEXT[],
    name_keys_v   SMALLINT NOT NULL DEFAULT 0,
    account_id    BIGINT REFERENCES accounts (id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL
  );
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS two_step_method TEXT;
  /* accounts that used an authenticator app get their codes by email from now on. Their app's secret is kept, so the
     app's codes keep signing them in too (app/api/auth/totp): nobody loses their way in, even while email is down. It
     goes when 2-step is turned off or on again. */
  UPDATE accounts SET two_step_method = 'email' WHERE totp_on AND two_step_method IS NULL;

  /* ---------- the merchant log: what each merchant did with his account and store (server/merchantLog.ts) ----------
     Diwan's "Merchant log" and each store's page read it. Only what happened, never his products, orders or customers:
     signing up and in, his password, email, mobile and 2-step, his setup steps, going live, his store's name, link,
     theme and delivery. meta: the line's details (from / to), sealed. Lines are never changed (a trigger refuses it);
     they go with the account. */
  CREATE TABLE IF NOT EXISTS merchant_log (
    id         BIGSERIAL PRIMARY KEY,
    at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    action     TEXT NOT NULL,
    meta       TEXT
  );
  CREATE INDEX IF NOT EXISTS merchant_log_account ON merchant_log (account_id, id DESC);
  CREATE INDEX IF NOT EXISTS merchant_log_action ON merchant_log (action);
  CREATE INDEX IF NOT EXISTS merchant_log_at ON merchant_log (at);
  CREATE OR REPLACE FUNCTION merchant_log_frozen() RETURNS trigger AS $f$ BEGIN RAISE EXCEPTION 'merchant_log is append-only'; END $f$ LANGUAGE plpgsql;
  DROP TRIGGER IF EXISTS merchant_log_frozen ON merchant_log;
  CREATE TRIGGER merchant_log_frozen BEFORE UPDATE ON merchant_log FOR EACH ROW EXECUTE FUNCTION merchant_log_frozen();

  /* ---------- the emails visitors leave on a store (server/storeSignups.ts) ----------
     kind 'newsletter': an email left in the store's newsletter block; source: where the block was ('home', 'page': an
     info page, page_id its id, 'product'). kind 'back_in_stock': "Remind me when it's back" on a sold-out product;
     product_id, size (the sold-out size, '' for the whole product) and product_name (its name then, for when it is
     gone). Only the store's own merchant sees them (Marketing > Customer emails). email: sealed. email_hash: a keyed
     fingerprint of the email for this shop only (the same email in two shops gives two different ones): an email is
     kept once per shop in the newsletter, and once per product and size for back in stock. The merchant sees numbers
     only, never the addresses (owner decision 2026-11-24). Back in stock: when he says a product is back, Dukkan emails
     those waiting once (notified_at: when), and the address is then wiped (email ''): the row stays only to be counted
     ("told so far") and so the same email asking again for the same product is still one row (email_hash). They go
     with the account. */
  CREATE TABLE IF NOT EXISTS store_signups (
    id           BIGSERIAL PRIMARY KEY,
    account_id   BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    kind         TEXT NOT NULL CHECK (kind IN ('newsletter', 'back_in_stock')),
    email        TEXT NOT NULL,
    email_hash   TEXT NOT NULL,
    lang         TEXT NOT NULL CHECK (lang IN ('ar', 'en')),
    source       TEXT NOT NULL CHECK (source IN ('home', 'page', 'product')),
    page_id      BIGINT,
    product_id   BIGINT,
    size         TEXT NOT NULL DEFAULT '',
    product_name TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (kind <> 'back_in_stock' OR product_id IS NOT NULL)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS store_signups_newsletter ON store_signups (account_id, email_hash) WHERE kind = 'newsletter';
  CREATE UNIQUE INDEX IF NOT EXISTS store_signups_back ON store_signups (account_id, email_hash, product_id, size) WHERE kind = 'back_in_stock';
  CREATE INDEX IF NOT EXISTS store_signups_account ON store_signups (account_id, kind, id DESC);
  ALTER TABLE store_signups ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
  /* ---------- Diwan: 2-step sign-in by emailed code (server/staffSignin.ts) ----------
     Since 2026-11-22 every staff sign-in asks, after the password, for a 6-digit code sent to the member's email
     (email_codes, refs "sl:" and "sc:"). The authenticator app is gone for staff: staff.totp_on, totp_secret and
     totp_last_step stay but are no longer read or written.
     email_confirmed_at: when the member typed a code sent to their email (at a sign-in, or when they changed it). NULL:
     not confirmed yet (an owner typed it when adding them, or they haven't signed in since this came).
     staff_signins: a password that was right, waiting for its emailed code. No staff session (no dukkan-diwan cookie)
     exists until the code is typed; the browser holds this row's token (cookie dukkan-diwan-wait). password_hash: the
     hash the password matched; the sign-in finishes only while the account still has it. Kept 15 minutes. */
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;
  CREATE TABLE IF NOT EXISTS staff_signins (
    token_hash    TEXT PRIMARY KEY,
    staff_id      BIGINT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS staff_signins_staff ON staff_signins (staff_id);
  /* ---------- Diwan: remembered browsers (server/staffSignin.ts, owner decision 2026-11-22) ----------
     staff_devices: a browser where the member typed the emailed code; there the password alone signs them in later.
     The browser holds the token (cookie dukkan-diwan-device, sent only to the /api/diwan/auth routes); only its hash is kept.
     password_hash / email_hash: the account's when it was remembered; the row works only while the account still has
     both. A password change, an email change and taking access away delete the member's rows. 365 days, 10 a member. */
  CREATE TABLE IF NOT EXISTS staff_devices (
    token_hash    TEXT PRIMARY KEY,
    staff_id      BIGINT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    email_hash    TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS staff_devices_staff ON staff_devices (staff_id, last_used_at DESC);
  /* ---------- Store links given up (server/slugHolds.ts, owner decision 2026-11-22, testing S-2) ----------
     A live store that changes its link keeps its old one for 2 days (until): no other store can take it meanwhile, and a
     visit to it shows "this store moved" with the new address. slug: the old link, in small letters. After until it is
     free again (the row is only read while until is ahead, and old rows are cleared when a link is next given up). */
  CREATE TABLE IF NOT EXISTS slug_holds (
    slug       TEXT PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    until      TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS slug_holds_account ON slug_holds (account_id);
  /* ---------- where each account signed in from (server/auth.ts knownSigninPlace, security audit N05) ----------
     signin_places: who ("m:<account id>" or "s:<staff id>") fully signed in from which address: only a keyed
     fingerprint of the address (crypto.ts blind), never the address. While wrong passwords from everywhere hold an
     account's sign-in, a place listed here still gets through. 90 days, 20 a person (the newest). */
  CREATE TABLE IF NOT EXISTS signin_places (
    who      TEXT NOT NULL,
    place    TEXT NOT NULL,
    last_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (who, place)
  );
  CREATE INDEX IF NOT EXISTS signin_places_at ON signin_places (last_at);
  /* ---------- Diwan: correcting a recorded payment (app/api/diwan/payments/[id], testing D-5) ----------
     version: 1 when it was recorded, one more at each correction. A correction is saved only from the version its form
     showed, so two staff correcting the same payment at once can't overwrite each other. edited_at / edited_by: the
     last correction. The values before each one are kept in its activity-log line ("shop.payment_edit"). */
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS edited_by BIGINT REFERENCES staff (id);
  /* ---------- whether a store order's delivery fee was left for the store to confirm (server/storeOrders.ts) ----------
     fee_open: true when his own courier had no fee set and the delivery was not free (the customer was told "Confirmed by
     the store"), false when not. Empty on orders placed before it was kept: the Orders page works it out from the
     settings then, as before. Kept with the order, so changing the delivery settings later never changes what an order
     was told. */
  ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS fee_open BOOLEAN;
  /* ---------- Diwan: the red number beside a page in the sidebar (server/badges.ts) ----------
     staff_seen: when each staff member last opened each page that shows one ("tickets", "documents"...). What came in
     after it is new to them; opening the page again moves it to now. A page they never opened starts from the first
     time their Diwan asked for the numbers, so what was there before isn't counted as new. */
  CREATE TABLE IF NOT EXISTS staff_seen (
    staff_id BIGINT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
    tab      TEXT NOT NULL,
    seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (staff_id, tab)
  );
  /* ---------- the merchant dashboard's red numbers (server/merchantBadges.ts) ----------
     merchant_seen: when the merchant last opened each page that shows one ("orders", "carts", "signups"), or for "bell"
     the newest notification his bell's open panel showed. What came after it is new to him; opening the page again moves
     it. Kept here, not in his browser, so his phone and his computer agree. A page he never opened starts from the first
     time his dashboard asked for the numbers (what was there before isn't new); the bell starts with every unread
     notification. It goes with the account. */
  CREATE TABLE IF NOT EXISTS merchant_seen (
    account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    tab        TEXT NOT NULL,
    seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, tab)
  );
  /* sent_at: when a document reached Diwan: when it was sent, or for an old courier proof kept as a draft, when it was
     handed over (a save of his delivery choice, or the start-up below). Rows from before take the day they were sent. */
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
  UPDATE documents SET sent_at = created_at WHERE sent_at IS NULL;
  ALTER TABLE documents ALTER COLUMN sent_at SET DEFAULT now();
  /* Which courier a courier proof is for, by phone (sealed; server/courierProof.ts): partner_phone is the courier the
     merchant's delivery choice had when the proof reached Diwan, and follows his courier while the proof waits for a
     check (as partner does); approved_phone is the one Diwan approved it for, kept from the approval on. A different
     courier (another phone) needs a new proof (owner decision 2026-11-23). Rows from before have neither: an approval
     without approved_phone counts for whichever courier he has, so no store loses its delivery with this change. */
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS partner_phone TEXT;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS approved_phone TEXT;
  /* A courier proof is kept back only during the Undo countdown after its upload (app/api/documents/send, owner
     decision 2026-11-24). The drafts left from before (a merchant who uploaded during setup and never saved his
     delivery choice) go to Diwan now, as sent at this moment, when their file is still there and he didn't remove them.
     Runs again harmlessly: once handed over no row is a draft.
     hold_until: until when a just-uploaded proof is kept back for its page (server/courierProof.ts HOLD_MINUTES from
     the upload, moved on by the page while its Undo toast still counts, app/api/documents/send "hold"). Rows from before
     have none and wait 2 minutes from their upload, as they did. A proof still within its hold is left for its page. */
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS hold_until TIMESTAMPTZ;
  UPDATE documents SET draft = false, sent_at = now()
   WHERE draft AND removed_at IS NULL AND (data IS NOT NULL OR file_key IS NOT NULL)
     AND COALESCE(hold_until, created_at + interval '2 minutes') < now();
  /* the numbers look only at what came in lately, so each count goes through a short index rather than the whole table */
  CREATE INDEX IF NOT EXISTS documents_waiting_sent ON documents (sent_at) WHERE status = 'waiting' AND NOT draft AND removed_at IS NULL;
  CREATE INDEX IF NOT EXISTS ticket_messages_merchant ON ticket_messages (created_at) WHERE author = 'merchant';
  CREATE INDEX IF NOT EXISTS store_orders_ship_new ON store_orders (created_at) WHERE ship_by = 'dukkan';
  /* ship_ready_at: when a store order became Dukkan Ship's to deliver: when it was placed, or for a big order that waited
     for the merchant ("review"), or one brought back from cancelled or refunded, when he moved it on (server/storeOrders.ts
     setStoreOrderStatus). Diwan's red number beside Dukkan Ship counts from it, so an order confirmed after staff last
     opened the page is still new to them. Orders from before it was kept take the time they were placed. */
  ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS ship_ready_at TIMESTAMPTZ;
  ALTER TABLE store_orders ALTER COLUMN ship_ready_at SET DEFAULT now();
  UPDATE store_orders SET ship_ready_at = created_at WHERE ship_ready_at IS NULL;
  CREATE INDEX IF NOT EXISTS store_orders_ship_ready ON store_orders (ship_ready_at) WHERE ship_by = 'dukkan';
  CREATE INDEX IF NOT EXISTS shops_created ON shops (created_at);
  CREATE INDEX IF NOT EXISTS store_reports_created ON store_reports (created_at);
  CREATE INDEX IF NOT EXISTS payments_created ON payments (created_at);
  CREATE INDEX IF NOT EXISTS theme_purchases_paid ON theme_purchases (paid_at) WHERE price > 0;

  /* ---------- carts customers leave on a store (server/storeCarts.ts, Marketing > Abandoned carts) ----------
     A visitor's basket, kept once he has typed a valid email or Jordan mobile at checkout, so the merchant can remind
     him of it. key_hash: a keyed fingerprint of the random key his browser keeps for this store's basket (never the key
     itself). items: the lines as the server priced them from the store's own products (id, name, qty, price, size,
     picture), never the browser's prices; subtotal: their sum then. email, phone, name: sealed; email_hash: a keyed
     fingerprint of the email for this shop only (as store_signups), phone_hash the same for the mobile, so an order
     with that email or mobile marks his carts here as recovered. lang: the language he shopped in (the reminder's language). recovered_at / order_number: the order
     that ended it. reminders / reminded_at: emails sent (at most 3, one a day: storeCarts.ts). A cart with no change
     for an hour counts as abandoned; carts untouched for 30 days are deleted. They go with the account.
     abandoned_at: when a cart left an hour came back to life (he returned and the basket was saved again), so it still
     counts as abandoned, and as recovered if he then orders; null while it was never left that long. */
  CREATE TABLE IF NOT EXISTS store_carts (
    id           BIGSERIAL PRIMARY KEY,
    account_id   BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    key_hash     TEXT NOT NULL,
    email        TEXT,
    email_hash   TEXT,
    phone        TEXT,
    phone_hash   TEXT,
    name         TEXT,
    lang         TEXT NOT NULL DEFAULT 'ar' CHECK (lang IN ('ar', 'en')),
    items        JSONB NOT NULL DEFAULT '[]',
    subtotal     NUMERIC(12, 3) NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    recovered_at TIMESTAMPTZ,
    order_number INTEGER,
    reminders    INTEGER NOT NULL DEFAULT 0,
    reminded_at  TIMESTAMPTZ
  );
  CREATE UNIQUE INDEX IF NOT EXISTS store_carts_key ON store_carts (account_id, key_hash);
  CREATE INDEX IF NOT EXISTS store_carts_account ON store_carts (account_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS store_carts_email ON store_carts (account_id, email_hash) WHERE recovered_at IS NULL;
  CREATE INDEX IF NOT EXISTS store_carts_phone ON store_carts (account_id, phone_hash) WHERE recovered_at IS NULL;
  CREATE INDEX IF NOT EXISTS store_carts_updated ON store_carts (updated_at);
  ALTER TABLE store_carts ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ;

  /* ---------- marketing campaigns (server/campaigns.ts, Marketing > Campaigns) ----------
     store_campaigns: one message a merchant writes once for his store's customers. channel 'email', or 'mobile' (SMS /
     WhatsApp: written and saved only, until a provider is plugged in). status: 'draft' (being written), 'sending'
     (started: its recipients are in store_campaign_recipients and go out in batches), 'sent' (all went out, or as many
     as could), 'failed' (none could: note says why), 'stopped' (Dukkan's staff stopped it from Diwan, stopped_by; or the
     store was suspended meanwhile, note 'suspended'). subject, heading, body, button_label, button_url: the merchant's
     words, sealed like the store's other data. audience: who it is for (components/campaignRules.ts cleanAudience).
     recipients, sent, failed, skipped: counts only (skipped: unsubscribed meanwhile, or never reached because it was
     stopped). sender: the store's name when it started, the emails' sender (fixed, so a batch sent again is the very same
     email). started_at counts towards the store's 3 campaigns a day (not one that failed with none sent). They go with the account. */
  CREATE TABLE IF NOT EXISTS store_campaigns (
    id           BIGSERIAL PRIMARY KEY,
    account_id   BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    channel      TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'mobile')),
    status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed', 'stopped')),
    subject      TEXT,
    heading      TEXT,
    body         TEXT,
    button_label TEXT,
    button_url   TEXT,
    audience     JSONB NOT NULL DEFAULT '{}',
    recipients   INTEGER NOT NULL DEFAULT 0,
    sent         INTEGER NOT NULL DEFAULT 0,
    failed       INTEGER NOT NULL DEFAULT 0,
    skipped      INTEGER NOT NULL DEFAULT 0,
    note         TEXT,
    sender       TEXT,
    stopped_by   BIGINT REFERENCES staff (id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at   TIMESTAMPTZ,
    finished_at  TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS store_campaigns_account ON store_campaigns (account_id, id DESC);
  CREATE INDEX IF NOT EXISTS store_campaigns_started ON store_campaigns (account_id, started_at) WHERE started_at IS NOT NULL;
  CREATE INDEX IF NOT EXISTS store_campaigns_sending ON store_campaigns (started_at) WHERE status = 'sending';
  /* store_campaign_recipients: who a started campaign goes to, fixed when it starts, each address (or mobile) once
     (contact_hash: a keyed fingerprint of it for this shop only). contact: the address itself, sealed, kept only until
     its message went out (or failed, or was skipped), then emptied: afterwards only the fingerprint and the outcome stay.
     lang: the reader's language (the newsletter's, else the campaign's). status: 'waiting', 'sending' (in a batch handed
     to the email service, batch: that batch's key, claimed_at: when it was last handed over, key_at: when its key was
     first used), 'sent', 'failed', 'skipped'. A batch left in 'sending' by a restart is sent again with the same key,
     which the email service answers without sending twice, until the key is 23 hours old (key_at; the service keeps a
     key 24). */
  CREATE TABLE IF NOT EXISTS store_campaign_recipients (
    campaign_id  BIGINT NOT NULL REFERENCES store_campaigns (id) ON DELETE CASCADE,
    contact_hash TEXT NOT NULL,
    contact      TEXT,
    lang         TEXT NOT NULL DEFAULT 'ar' CHECK (lang IN ('ar', 'en')),
    status       TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'sending', 'sent', 'failed', 'skipped')),
    batch        TEXT,
    claimed_at   TIMESTAMPTZ,
    sent_at      TIMESTAMPTZ,
    PRIMARY KEY (campaign_id, contact_hash)
  );
  /* added after the table first shipped: a row from before has none, and its claimed_at stands in (resumeStale) */
  ALTER TABLE store_campaign_recipients ADD COLUMN IF NOT EXISTS key_at TIMESTAMPTZ;
  CREATE INDEX IF NOT EXISTS store_campaign_recipients_waiting ON store_campaign_recipients (campaign_id) WHERE status = 'waiting';
  CREATE INDEX IF NOT EXISTS store_campaign_recipients_sending ON store_campaign_recipients (claimed_at) WHERE status = 'sending';
  /* store_unsubscribes: the store's customers who asked for no more of its campaigns (the link in each campaign email,
     or their mail app's own "Unsubscribe"): a keyed fingerprint of the address or mobile for this shop only, never the
     address. Every later campaign of the store leaves them out. They go with the account. */
  CREATE TABLE IF NOT EXISTS store_unsubscribes (
    account_id   BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    contact_hash TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, contact_hash)
  );

  /* ---------- Dukkan's campaigns to merchants (server/merchantCampaigns.ts, Diwan > Marketing > Campaigns to merchants) ----------
     accounts.marketing_off_at: when the merchant stopped Dukkan's marketing emails (the link in each of these emails,
     /unsubscribe/dukkan); null: on. accounts.marketing_paused_until: he paused them until then (30 days); they come again
     after it. Every campaign meanwhile leaves him out. His account's own emails (codes, orders, tickets) are not
     marketing and still come.
     merchant_campaigns: one email Dukkan's team writes in Arabic and in English for merchants; each gets one of them. status: 'draft', 'sending'
     (its recipients are fixed in merchant_campaign_recipients and go out in batches), 'sent', 'failed' (none could: note
     says why), 'stopped' (stopped_by). audience: the filters it was sent with (components/merchantCampaignRules.ts).
     recipients, sent, failed, skipped: counts only. started_at counts towards the team's campaigns of the day. */
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS marketing_off_at TIMESTAMPTZ;
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS marketing_paused_until TIMESTAMPTZ;
  CREATE TABLE IF NOT EXISTS merchant_campaigns (
    id              BIGSERIAL PRIMARY KEY,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed', 'stopped')),
    subject_en      TEXT NOT NULL DEFAULT '',
    subject_ar      TEXT NOT NULL DEFAULT '',
    heading_en      TEXT NOT NULL DEFAULT '',
    heading_ar      TEXT NOT NULL DEFAULT '',
    body_en         TEXT NOT NULL DEFAULT '',
    body_ar         TEXT NOT NULL DEFAULT '',
    button_label_en TEXT NOT NULL DEFAULT '',
    button_label_ar TEXT NOT NULL DEFAULT '',
    button_url      TEXT NOT NULL DEFAULT '',
    audience        JSONB NOT NULL DEFAULT '{}',
    recipients      INTEGER NOT NULL DEFAULT 0,
    sent            INTEGER NOT NULL DEFAULT 0,
    failed          INTEGER NOT NULL DEFAULT 0,
    skipped         INTEGER NOT NULL DEFAULT 0,
    note            TEXT,
    created_by      BIGINT REFERENCES staff (id) ON DELETE SET NULL,
    started_by      BIGINT REFERENCES staff (id) ON DELETE SET NULL,
    stopped_by      BIGINT REFERENCES staff (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS merchant_campaigns_started ON merchant_campaigns (started_at) WHERE started_at IS NOT NULL;
  CREATE INDEX IF NOT EXISTS merchant_campaigns_sending ON merchant_campaigns (started_at) WHERE status = 'sending';
  /* merchant_campaign_recipients: the merchants a started campaign goes to, fixed when it starts, each account once.
     Never their address while waiting: email is a sealed copy of the account's address taken when its batch is handed
     to the email service (so a batch sent again is the very same request), emptied once its outcome is known. lang: the
     one language his email is in ('ar' for a merchant who never chose). status and batch as in store_campaign_recipients. */
  CREATE TABLE IF NOT EXISTS merchant_campaign_recipients (
    campaign_id BIGINT NOT NULL REFERENCES merchant_campaigns (id) ON DELETE CASCADE,
    account_id  BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    lang        TEXT NOT NULL DEFAULT 'ar' CHECK (lang IN ('ar', 'en')),
    email       TEXT,
    status      TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'sending', 'sent', 'failed', 'skipped')),
    batch       TEXT,
    claimed_at  TIMESTAMPTZ,
    sent_at     TIMESTAMPTZ,
    PRIMARY KEY (campaign_id, account_id)
  );
  CREATE INDEX IF NOT EXISTS merchant_campaign_recipients_waiting ON merchant_campaign_recipients (campaign_id) WHERE status = 'waiting';
  CREATE INDEX IF NOT EXISTS merchant_campaign_recipients_sending ON merchant_campaign_recipients (claimed_at) WHERE status = 'sending';
  /* merchant_marketing_reasons: why a merchant last paused ('pause') or stopped ('off') Dukkan's marketing emails, picked
     on the unsubscribe page (optional; reason NULL: none given). One row per merchant, the latest. Diwan shows counts per
     reason among the merchants who have them paused or stopped now, never who. */
  CREATE TABLE IF NOT EXISTS merchant_marketing_reasons (
    account_id BIGINT PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
    action     TEXT NOT NULL CHECK (action IN ('pause', 'off')),
    reason     TEXT CHECK (reason IN ('too_many', 'not_relevant', 'never_asked', 'other')),
    at         TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;
