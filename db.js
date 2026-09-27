const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "nadeem-mobiles.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  phone_number       TEXT NOT NULL,
  total_amount       REAL NOT NULL DEFAULT 0,
  paid_amount        REAL NOT NULL DEFAULT 0,
  installment_amount REAL,
  next_due_date      TEXT,
  notes              TEXT,
  pairing_code       TEXT UNIQUE NOT NULL,
  device_model       TEXT,
  fcm_token          TEXT,
  device_secret      TEXT,
  status             TEXT NOT NULL DEFAULT 'pending',
  last_seen          TEXT,
  release_token      TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  released_at        TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  amount      REAL NOT NULL CHECK(amount > 0),
  paid_at     TEXT NOT NULL DEFAULT (datetime('now')),
  reference   TEXT,
  note        TEXT,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  action      TEXT NOT NULL,
  detail      TEXT,
  at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_events_at ON events(at);
`);

function logEvent(customerId, action, detail = null) {
  db.prepare(`INSERT INTO events (customer_id, action, detail) VALUES (?, ?, ?)`).run(customerId ?? null, action, detail);
}

function recalcPaidAmount(customerId) {
  const row = db.prepare(`SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE customer_id = ?`).get(customerId);
  db.prepare(`UPDATE customers SET paid_amount = ? WHERE id = ?`).run(Number(row.paid || 0), customerId);
}

module.exports = { db, logEvent, recalcPaidAmount };
