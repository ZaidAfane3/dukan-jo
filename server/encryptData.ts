import type { Pool } from "pg";
import { emailKey, open, phoneKey, PRIVATE_PARAMS, seal, sealDeep } from "./crypto";

/* Runs once each time the server starts (from db()), after the tables exist: seals every private value still stored
   as plain text (rows written before encryption existed), gives every account and staff member their email/mobile
   fingerprints, then makes the fingerprints unique and drops the old unique rules on the plain values. Safe to run
   again and again: rows already sealed are skipped. Done in one transaction under the schema lock, so two servers
   starting together don't both do it, and a failure leaves the database as it was. */

/* table -> its key columns and the private columns to seal */
const SEALED: { table: string; key: string[]; cols: string[] }[] = [
  { table: "accounts", key: ["id"], cols: ["email", "name", "phone", "totp_secret", "city", "dob", "gender"] },
  { table: "staff", key: ["id"], cols: ["email", "totp_secret"] },
  { table: "store_data", key: ["account_id", "key"], cols: ["value"] },
  { table: "shops", key: ["account_id"], cols: ["phone", "pickup_address"] },
  { table: "tickets", key: ["id"], cols: ["subject", "where_text"] },
  { table: "ticket_messages", key: ["id"], cols: ["body"] },
  { table: "ticket_pictures", key: ["id"], cols: ["data"] },
  { table: "store_reports", key: ["id"], cols: ["reporter_contact", "body", "notes", "ip"] },
  { table: "order_deletions", key: ["id"], cols: ["reason", "deleted_by"] },
  { table: "payments", key: ["id"], cols: ["note"] }, // the bank reference stays plain: Dukkan's own code, searched by staff
  { table: "documents", key: ["id"], cols: ["name", "note"] },
  { table: "impersonations", key: ["id"], cols: ["reason", "ip"] },
];

export async function encryptOldRows(pool: Pool): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(71001)");

    /* the size limit counts what the merchant saved, not the longer encrypted text */
    await c.query(`UPDATE store_data SET plain_len = length(value) WHERE plain_len IS NULL AND value NOT LIKE 'e1:%'`);

    for (const t of SEALED) {
      const plain = t.cols.map((col) => `(${col} IS NOT NULL AND ${col} <> '' AND ${col} NOT LIKE 'e1:%')`).join(" OR ");
      /* the answers of this client are opened automatically, so read the raw values with ::text casts under other names */
      const { rows } = await c.query(`SELECT ${t.key.join(", ")}, ${t.cols.map((col, i) => `${col}::text AS raw${i}`).join(", ")} FROM ${t.table} WHERE ${plain}`);
      for (const r of rows) {
        const sets = t.cols.map((col, i) => `${col} = $${i + 1}`).join(", ");
        const where = t.key.map((k, i) => `${k} = $${t.cols.length + i + 1}`).join(" AND ");
        /* values already sealed came back opened: seal them again (a new IV, same meaning) */
        await c.query(`UPDATE ${t.table} SET ${sets} WHERE ${where}`, [...t.cols.map((_, i) => seal(r[`raw${i}`] as string | null)), ...t.key.map((k) => r[k])]);
      }
    }

    /* notifications: only their free-text details (server/notify.ts PRIVATE_PARAMS) */
    for (const k of PRIVATE_PARAMS) {
      const n = await c.query(`SELECT id, params->>'${k}' AS raw FROM notifications WHERE jsonb_typeof(params->'${k}') = 'string' AND params->>'${k}' <> '' AND params->>'${k}' NOT LIKE 'e1:%'`);
      /* raw came back opened if it was sealed, but those rows are filtered out above */
      for (const r of n.rows) await c.query(`UPDATE notifications SET params = jsonb_set(params, $2::text[], to_jsonb($3::text)) WHERE id = $1`, [r.id, [k], seal(r.raw)]);
    }

    /* the activity log: its reason, address and the texts in its details (audit() seals new lines the same way). The log
       refuses changes, so its trigger is off only inside this transaction, and only to seal what it already says. */
    const plainLog = `(reason IS NOT NULL AND reason <> '' AND reason NOT LIKE 'e1:%') OR (ip <> '' AND ip NOT LIKE 'e1:%')
      OR jsonb_path_exists(meta, 'strict $.** ? (@.type() == "string" && @ != "" && !(@ starts with "e1:"))')`;
    const log = await c.query(`SELECT id, reason::text AS raw_reason, ip::text AS raw_ip, meta::text AS raw_meta FROM audit_log WHERE ${plainLog}`);
    if (log.rows.length) {
      await c.query(`ALTER TABLE audit_log DISABLE TRIGGER audit_log_frozen`);
      /* raw_meta is JSON text (not a sealed value), so it comes back exactly as stored; reason and ip come back opened */
      for (const r of log.rows)
        await c.query(`UPDATE audit_log SET reason = $2, ip = $3, meta = $4::jsonb WHERE id = $1`, [
          r.id, seal(r.raw_reason as string | null), seal(r.raw_ip as string), r.raw_meta == null ? null : JSON.stringify(sealDeep(JSON.parse(r.raw_meta as string), true)),
        ]);
      await c.query(`ALTER TABLE audit_log ENABLE TRIGGER audit_log_frozen`);
    }

    /* fingerprints for finding and uniqueness (the values come back opened) */
    const acc = await c.query(`SELECT id, email, phone FROM accounts WHERE email_hash IS NULL OR (phone_hash IS NULL AND phone <> '')`);
    for (const r of acc.rows) await c.query(`UPDATE accounts SET email_hash = $2, phone_hash = $3 WHERE id = $1`, [r.id, emailKey(open(r.email)), phoneKey(open(r.phone))]);
    const st = await c.query(`SELECT id, email FROM staff WHERE email_hash IS NULL`);
    for (const r of st.rows) await c.query(`UPDATE staff SET email_hash = $2 WHERE id = $1`, [r.id, emailKey(open(r.email))]);

    await c.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_hash ON accounts (email_hash);
      CREATE UNIQUE INDEX IF NOT EXISTS accounts_phone_hash ON accounts (phone_hash) WHERE phone_hash IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS staff_email_hash ON staff (email_hash);
      ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_email_key;
      DROP INDEX IF EXISTS accounts_phone;
      ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_email_key;
    `);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
