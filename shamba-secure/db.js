const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// On a managed platform (Railway, Render, Fly.io) the app's own folder gets
// wiped on every redeploy — only an attached persistent volume survives.
// Set DATA_DIR to that volume's mount path in production; defaults to a
// local folder for development, unchanged from before.
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'shamba.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS farms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  country TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'worker',
  reset_token TEXT,
  reset_token_expires TEXT,
  email_verified INTEGER NOT NULL DEFAULT 1,
  verification_code TEXT,
  verification_code_expires TEXT,
  phone_verified INTEGER NOT NULL DEFAULT 1,
  phone_verification_code TEXT,
  phone_verification_code_expires TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK(type IN ('income','expense')),
  amount REAL NOT NULL,
  category TEXT,
  description TEXT,
  livestock_type TEXT CHECK(livestock_type IS NULL OR livestock_type IN ('chicken','goat','cow')),
  quantity INTEGER,
  lot_id INTEGER REFERENCES broiler_lots(id) ON DELETE SET NULL,
  tx_date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK(direction IN ('owed_to_me','i_owe')),
  person TEXT NOT NULL,
  phone TEXT,
  amount REAL NOT NULL,
  description TEXT,
  livestock_type TEXT CHECK(livestock_type IS NULL OR livestock_type IN ('chicken','goat','cow')),
  quantity INTEGER,
  lot_id INTEGER REFERENCES broiler_lots(id) ON DELETE SET NULL,
  incurred_date TEXT,
  due_date TEXT,
  settled INTEGER NOT NULL DEFAULT 0,
  settlement_tx_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS animals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT,
  sex TEXT,
  dob TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','sold','deceased')),
  acquired_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS animal_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  animal_id INTEGER NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK(event_type IN ('health','breeding','production','weight','other')),
  event_date TEXT NOT NULL,
  detail TEXT,
  value REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subject_type TEXT NOT NULL DEFAULT 'custom',
  subject_id INTEGER,
  remind_date TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS broiler_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  poultry_type TEXT NOT NULL DEFAULT 'broiler' CHECK(poultry_type IN ('broiler','layer')),
  quantity INTEGER,
  start_date TEXT NOT NULL,
  cycle_days INTEGER NOT NULL DEFAULT 28,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS broiler_mortality (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  lot_id INTEGER NOT NULL REFERENCES broiler_lots(id) ON DELETE CASCADE,
  event_date TEXT NOT NULL,
  quantity_lost INTEGER NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pending_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  code_expires TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tx_farm ON transactions(farm_id);
CREATE INDEX IF NOT EXISTS idx_debts_farm ON debts(farm_id);
CREATE INDEX IF NOT EXISTS idx_animals_farm ON animals(farm_id);
CREATE INDEX IF NOT EXISTS idx_events_animal ON animal_events(animal_id);
CREATE INDEX IF NOT EXISTS idx_reminders_farm ON reminders(farm_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(remind_date, sent_at);
CREATE INDEX IF NOT EXISTS idx_broiler_lots_farm ON broiler_lots(farm_id);
CREATE INDEX IF NOT EXISTS idx_broiler_mortality_lot ON broiler_mortality(lot_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_farm ON push_subscriptions(farm_id);
`);

module.exports = db;

// ---- Migrations for databases created before a column existed ----

const debtCols = db.prepare("PRAGMA table_info(debts)").all().map(c => c.name);
if (!debtCols.includes('phone')) {
  db.exec('ALTER TABLE debts ADD COLUMN phone TEXT');
}
if (!debtCols.includes('settlement_tx_id')) {
  db.exec('ALTER TABLE debts ADD COLUMN settlement_tx_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL');
}
if (!debtCols.includes('livestock_type')) {
  db.exec('ALTER TABLE debts ADD COLUMN livestock_type TEXT');
}
if (!debtCols.includes('quantity')) {
  db.exec('ALTER TABLE debts ADD COLUMN quantity INTEGER');
}
if (!debtCols.includes('lot_id')) {
  db.exec('ALTER TABLE debts ADD COLUMN lot_id INTEGER REFERENCES broiler_lots(id) ON DELETE SET NULL');
}
if (!debtCols.includes('incurred_date')) {
  db.exec('ALTER TABLE debts ADD COLUMN incurred_date TEXT');
}

const txCols = db.prepare("PRAGMA table_info(transactions)").all().map(c => c.name);
if (!txCols.includes('livestock_type')) {
  db.exec('ALTER TABLE transactions ADD COLUMN livestock_type TEXT');
}
if (!txCols.includes('quantity')) {
  db.exec('ALTER TABLE transactions ADD COLUMN quantity INTEGER');
}
if (!txCols.includes('lot_id')) {
  db.exec('ALTER TABLE transactions ADD COLUMN lot_id INTEGER REFERENCES broiler_lots(id) ON DELETE SET NULL');
}

const farmCols = db.prepare("PRAGMA table_info(farms)").all().map(c => c.name);
if (!farmCols.includes('currency')) {
  db.exec("ALTER TABLE farms ADD COLUMN currency TEXT NOT NULL DEFAULT 'KES'");
}
if (!farmCols.includes('country')) {
  db.exec('ALTER TABLE farms ADD COLUMN country TEXT');
}

const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!userCols.includes('email')) {
  db.exec('ALTER TABLE users ADD COLUMN email TEXT');
  // Unique index added separately so existing NULL emails don't conflict —
  // SQLite treats multiple NULLs as distinct under a UNIQUE index.
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)');
}
if (!userCols.includes('reset_token')) {
  db.exec('ALTER TABLE users ADD COLUMN reset_token TEXT');
}
if (!userCols.includes('reset_token_expires')) {
  db.exec('ALTER TABLE users ADD COLUMN reset_token_expires TEXT');
}

const lotCols = db.prepare("PRAGMA table_info(broiler_lots)").all().map(c => c.name);
if (!lotCols.includes('poultry_type')) {
  db.exec("ALTER TABLE broiler_lots ADD COLUMN poultry_type TEXT NOT NULL DEFAULT 'broiler'");
}

if (!userCols.includes('email_verified')) {
  // Existing accounts predate this feature — treat them as already verified
  // rather than suddenly locking anyone out.
  db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1');
}
if (!userCols.includes('verification_code')) {
  db.exec('ALTER TABLE users ADD COLUMN verification_code TEXT');
}
if (!userCols.includes('verification_code_expires')) {
  db.exec('ALTER TABLE users ADD COLUMN verification_code_expires TEXT');
}
if (!userCols.includes('phone_verified')) {
  // Existing accounts predate this feature — treat them as already verified
  // rather than suddenly locking anyone out.
  db.exec('ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 1');
}
if (!userCols.includes('phone_verification_code')) {
  db.exec('ALTER TABLE users ADD COLUMN phone_verification_code TEXT');
}
if (!userCols.includes('phone_verification_code_expires')) {
  db.exec('ALTER TABLE users ADD COLUMN phone_verification_code_expires TEXT');
}
