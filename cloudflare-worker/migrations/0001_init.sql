
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  installment_amount REAL,
  next_due_date TEXT,
  notes TEXT,
  pairing_code TEXT UNIQUE NOT NULL,
  device_model TEXT,
  fcm_token TEXT,
  device_secret TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_seen TEXT,
  release_token TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  released_at TEXT
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  reference TEXT,
  note TEXT,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_events_at ON events(at);
