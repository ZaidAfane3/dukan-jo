/* The tables behind Diwan (Dukkan's staff console) and everything merchants send to Dukkan. Run after the first three
   tables in db.ts, inside the same advisory lock, on the first request. Every statement can run again safely
   (IF NOT EXISTS / ON CONFLICT), so an existing database just gains what is new. A "shop" is one merchant account:
   account_id is the shop's id everywhere. Money is in JOD with 3 decimals (fils). */

export const DIWAN_SCHEMA = `
  /* ---------- merchant accounts: sign-in history and impersonation ---------- */
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_count   INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT now();
  /* set when a staff member opened this session with "Log in as merchant" (impersonations.id) */
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

  /* everything staff open or change. Only ever added to: a trigger refuses UPDATE and DELETE. */
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

  /* ---------- plans, subscriptions, payments ---------- */
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
  INSERT INTO plans (key, name_en, name_ar) VALUES ('trial', 'Trial', 'تجريبية') ON CONFLICT (key) DO NOTHING;

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

  /* ---------- log in as merchant ---------- */
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

  /* ---------- domains ----------
     Kept only for the rows already saved: Dukkan no longer sells domains or connects a store's own domain (every store
     lives at dukkan.store/<its link>), so nothing adds to this table or shows it any more. */
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

  /* ---------- messages to merchants ---------- */
  CREATE TABLE IF NOT EXISTS announcements (
    id         BIGSERIAL PRIMARY KEY,
    title_en   TEXT NOT NULL,
    title_ar   TEXT NOT NULL,
    body_en    TEXT NOT NULL DEFAULT '',
    body_ar    TEXT NOT NULL DEFAULT '',
    audience   JSONB NOT NULL DEFAULT '{"all": true}',   -- {"all":true} or {"accounts":[ids]} or {"plans":[keys]}
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
  INSERT INTO platform_settings (key, value) VALUES ('trial_days', '14') ON CONFLICT (key) DO NOTHING;

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
  INSERT INTO catalog_themes (id, source, status, price, sort, released_at) VALUES
    ('atelier', 'code', 'live', 19.99, 10, now()), ('lamma', 'code', 'live', 39, 20, now())
  ON CONFLICT (id) DO NOTHING;
`;
