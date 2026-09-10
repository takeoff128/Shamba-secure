require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');
const { setAuthCookie, clearAuthCookie, requireAuth, requireOwner } = require('./auth');
const { runDueReminders, createDebtReminder } = require('./reminders');
const { BROILER_SCHEDULE, createLotReminders } = require('./broiler');
const { CURRENCIES } = require('./currency');
const cron = require('node-cron');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

function badRequest(res, msg) { return res.status(400).json({ error: msg }); }

// ---------------- AUTH ----------------

// Create a brand new farm + its first (owner) user
app.post('/api/register', (req, res) => {
  const { farmName, name, phone, password, currency, country } = req.body || {};
  if (!farmName || !name || !phone || !password) return badRequest(res, 'All fields are required.');
  if (password.length < 6) return badRequest(res, 'Password must be at least 6 characters.');

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing) return badRequest(res, 'That phone number is already registered.');

  const currencyCode = CURRENCIES[currency] ? currency : 'KES';

  const insertFarm = db.prepare('INSERT INTO farms (name, currency, country) VALUES (?, ?, ?)');
  const farmInfo = insertFarm.run(farmName, currencyCode, country || null);
  const farmId = farmInfo.lastInsertRowid;

  const hash = bcrypt.hashSync(password, 12);
  const insertUser = db.prepare(
    'INSERT INTO users (farm_id, name, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  );
  const userInfo = insertUser.run(farmId, name, phone, hash, 'owner');

  setAuthCookie(res, { userId: userInfo.lastInsertRowid, farmId, name, role: 'owner' });
  res.json({ ok: true, farmName, name, role: 'owner', currency: currencyCode });
});

// Owner adds a worker to the same farm
app.post('/api/users', requireAuth, requireOwner, (req, res) => {
  const { name, phone, password } = req.body || {};
  if (!name || !phone || !password) return badRequest(res, 'All fields are required.');
  if (password.length < 6) return badRequest(res, 'Password must be at least 6 characters.');

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing) return badRequest(res, 'That phone number is already registered.');

  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare(
    'INSERT INTO users (farm_id, name, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.farmId, name, phone, hash, 'worker');

  res.json({ ok: true, id: info.lastInsertRowid, name, phone, role: 'worker' });
});

app.get('/api/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, name, phone, role FROM users WHERE farm_id = ?').all(req.user.farmId);
  res.json(users);
});

app.delete('/api/users/:id', requireAuth, requireOwner, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ? AND farm_id = ?').get(req.params.id, req.user.farmId);
  if (!target) return res.status(404).json({ error: 'Person not found.' });
  if (target.role === 'owner') return res.status(400).json({ error: "Can't remove the farm owner." });

  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) return badRequest(res, 'Phone and password are required.');

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect phone number or password.' });
  }
  const farm = db.prepare('SELECT * FROM farms WHERE id = ?').get(user.farm_id);
  setAuthCookie(res, { userId: user.id, farmId: user.farm_id, name: user.name, role: user.role });
  res.json({ ok: true, name: user.name, role: user.role, farmName: farm.name, currency: farm.currency });
});

app.post('/api/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const farm = db.prepare('SELECT name, currency, country FROM farms WHERE id = ?').get(req.user.farmId);
  res.json({ name: req.user.name, role: req.user.role, farmName: farm ? farm.name : '', currency: farm ? farm.currency : 'KES', country: farm ? farm.country : null });
});

app.get('/api/currencies', (req, res) => {
  res.json(CURRENCIES);
});

app.patch('/api/farm', requireAuth, requireOwner, (req, res) => {
  const { currency, country, name } = req.body || {};
  if (currency && !CURRENCIES[currency]) return badRequest(res, 'Unsupported currency.');
  db.prepare('UPDATE farms SET currency = COALESCE(?, currency), country = COALESCE(?, country), name = COALESCE(?, name) WHERE id = ?')
    .run(currency || null, country || null, name || null, req.user.farmId);
  res.json({ ok: true });
});

// ---------------- TRANSACTIONS ----------------

app.get('/api/transactions', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM transactions WHERE farm_id = ? ORDER BY tx_date DESC, id DESC'
  ).all(req.user.farmId);
  res.json(rows);
});

app.post('/api/transactions', requireAuth, (req, res) => {
  const { type, amount, category, description, tx_date } = req.body || {};
  if (!['income', 'expense'].includes(type)) return badRequest(res, 'Invalid transaction type.');
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return badRequest(res, 'Enter a valid amount.');
  if (!tx_date) return badRequest(res, 'Date is required.');

  const info = db.prepare(
    'INSERT INTO transactions (farm_id, user_id, type, amount, category, description, tx_date) VALUES (?,?,?,?,?,?,?)'
  ).run(req.user.farmId, req.user.userId, type, amt, category || 'Other', description || '', tx_date);

  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/transactions/:id', requireAuth, requireOwner, (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ? AND farm_id = ?').run(req.params.id, req.user.farmId);
  res.json({ ok: true });
});

// ---------------- DEBTS ----------------

app.get('/api/debts', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM debts WHERE farm_id = ? ORDER BY settled ASC, id DESC'
  ).all(req.user.farmId);
  res.json(rows);
});

app.post('/api/debts', requireAuth, (req, res) => {
  const { direction, person, phone, amount, description, due_date } = req.body || {};
  if (!['owed_to_me', 'i_owe'].includes(direction)) return badRequest(res, 'Invalid debt direction.');
  if (!person) return badRequest(res, 'Enter a name.');
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return badRequest(res, 'Enter a valid amount.');

  const info = db.prepare(
    'INSERT INTO debts (farm_id, user_id, direction, person, phone, amount, description, due_date) VALUES (?,?,?,?,?,?,?,?)'
  ).run(req.user.farmId, req.user.userId, direction, person, phone || null, amt, description || '', due_date || null);

  if (due_date) {
    createDebtReminder(
      { farm_id: req.user.farmId, id: info.lastInsertRowid, amount: amt, direction, person, phone: phone || null, due_date },
      req.user.userId
    );
  }

  res.json({ id: info.lastInsertRowid });
});

app.patch('/api/debts/:id/settle', requireAuth, (req, res) => {
  const debt = db.prepare('SELECT * FROM debts WHERE id = ? AND farm_id = ?').get(req.params.id, req.user.farmId);
  if (!debt) return res.status(404).json({ error: 'Debt not found.' });
  db.prepare('UPDATE debts SET settled = ? WHERE id = ?').run(debt.settled ? 0 : 1, debt.id);
  res.json({ ok: true });
});

app.delete('/api/debts/:id', requireAuth, requireOwner, (req, res) => {
  db.prepare('DELETE FROM debts WHERE id = ? AND farm_id = ?').run(req.params.id, req.user.farmId);
  res.json({ ok: true });
});

// ---------------- ANIMALS ----------------

app.get('/api/animals', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM animals WHERE farm_id = ? ORDER BY id DESC').all(req.user.farmId);
  res.json(rows);
});

app.post('/api/animals', requireAuth, (req, res) => {
  const { tag_id, species, breed, sex, dob, acquired_date, notes } = req.body || {};
  if (!tag_id || !species) return badRequest(res, 'Tag ID and species are required.');

  const info = db.prepare(
    'INSERT INTO animals (farm_id, tag_id, species, breed, sex, dob, acquired_date, notes) VALUES (?,?,?,?,?,?,?,?)'
  ).run(req.user.farmId, tag_id, species, breed || '', sex || '', dob || null, acquired_date || null, notes || '');

  res.json({ id: info.lastInsertRowid });
});

app.patch('/api/animals/:id', requireAuth, (req, res) => {
  const animal = db.prepare('SELECT * FROM animals WHERE id = ? AND farm_id = ?').get(req.params.id, req.user.farmId);
  if (!animal) return res.status(404).json({ error: 'Animal not found.' });
  const { status, notes } = req.body || {};
  if (status && !['active', 'sold', 'deceased'].includes(status)) return badRequest(res, 'Invalid status.');
  db.prepare('UPDATE animals SET status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE id = ?')
    .run(status || null, notes ?? null, animal.id);
  res.json({ ok: true });
});

app.delete('/api/animals/:id', requireAuth, requireOwner, (req, res) => {
  db.prepare('DELETE FROM animals WHERE id = ? AND farm_id = ?').run(req.params.id, req.user.farmId);
  res.json({ ok: true });
});

app.get('/api/animals/:id/events', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM animal_events WHERE animal_id = ? AND farm_id = ? ORDER BY event_date DESC, id DESC'
  ).all(req.params.id, req.user.farmId);
  res.json(rows);
});

app.post('/api/animals/:id/events', requireAuth, (req, res) => {
  const animal = db.prepare('SELECT * FROM animals WHERE id = ? AND farm_id = ?').get(req.params.id, req.user.farmId);
  if (!animal) return res.status(404).json({ error: 'Animal not found.' });

  const { event_type, event_date, detail, value } = req.body || {};
  if (!['health', 'breeding', 'production', 'weight', 'other'].includes(event_type)) return badRequest(res, 'Invalid event type.');
  if (!event_date) return badRequest(res, 'Event date is required.');

  const info = db.prepare(
    'INSERT INTO animal_events (farm_id, animal_id, event_type, event_date, detail, value) VALUES (?,?,?,?,?,?)'
  ).run(req.user.farmId, animal.id, event_type, event_date, detail || '', value != null ? parseFloat(value) : null);

  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/events/:id', requireAuth, requireOwner, (req, res) => {
  db.prepare('DELETE FROM animal_events WHERE id = ? AND farm_id = ?').run(req.params.id, req.user.farmId);
  res.json({ ok: true });
});

// ---------------- BROILER LOTS ----------------

app.get('/api/broiler-schedule', requireAuth, (req, res) => {
  res.json(BROILER_SCHEDULE);
});

app.get('/api/broiler-lots', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT bl.*,
      COALESCE((SELECT SUM(quantity_lost) FROM broiler_mortality WHERE lot_id = bl.id), 0) AS total_lost
    FROM broiler_lots bl
    WHERE bl.farm_id = ?
    ORDER BY bl.id DESC
  `).all(req.user.farmId);
  res.json(rows);
});

app.post('/api/broiler-lots', requireAuth, (req, res) => {
  const { name, quantity, start_date } = req.body || {};
  if (!name) return badRequest(res, 'Give this lot a name or tag.');
  if (!start_date) return badRequest(res, 'Pick a start date.');

  const info = db.prepare(
    'INSERT INTO broiler_lots (farm_id, name, quantity, start_date) VALUES (?,?,?,?)'
  ).run(req.user.farmId, name, quantity ? parseInt(quantity, 10) : null, start_date);

  const lot = { id: info.lastInsertRowid, farm_id: req.user.farmId, name, start_date };
  createLotReminders(lot, req.user.userId);

  res.json({ id: info.lastInsertRowid });
});

app.patch('/api/broiler-lots/:id', requireAuth, (req, res) => {
  const lot = db.prepare('SELECT * FROM broiler_lots WHERE id = ? AND farm_id = ?').get(req.params.id, req.user.farmId);
  if (!lot) return res.status(404).json({ error: 'Lot not found.' });
  const { status, notes } = req.body || {};
  if (status && !['active', 'closed'].includes(status)) return badRequest(res, 'Invalid status.');
  db.prepare('UPDATE broiler_lots SET status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE id = ?')
    .run(status || null, notes ?? null, lot.id);
  res.json({ ok: true });
});

app.delete('/api/broiler-lots/:id', requireAuth, requireOwner, (req, res) => {
  db.prepare('DELETE FROM broiler_lots WHERE id = ? AND farm_id = ?').run(req.params.id, req.user.farmId);
  db.prepare("DELETE FROM reminders WHERE farm_id = ? AND subject_type = 'broiler_lot' AND subject_id = ?")
    .run(req.user.farmId, req.params.id);
  res.json({ ok: true });
});

app.get('/api/broiler-lots/:id/reminders', requireAuth, (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM reminders WHERE farm_id = ? AND subject_type = 'broiler_lot' AND subject_id = ? ORDER BY remind_date ASC, id ASC"
  ).all(req.user.farmId, req.params.id);
  res.json(rows);
});

// ---------------- BROILER MORTALITY ----------------

app.get('/api/broiler-lots/:id/mortality', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM broiler_mortality WHERE farm_id = ? AND lot_id = ? ORDER BY event_date DESC, id DESC'
  ).all(req.user.farmId, req.params.id);
  res.json(rows);
});

app.post('/api/broiler-lots/:id/mortality', requireAuth, (req, res) => {
  const lot = db.prepare('SELECT * FROM broiler_lots WHERE id = ? AND farm_id = ?').get(req.params.id, req.user.farmId);
  if (!lot) return res.status(404).json({ error: 'Lot not found.' });

  const { event_date, quantity_lost, note } = req.body || {};
  const qty = parseInt(quantity_lost, 10);
  if (!event_date) return badRequest(res, 'Pick a date.');
  if (!qty || qty <= 0) return badRequest(res, 'Enter how many were lost.');

  const info = db.prepare(
    'INSERT INTO broiler_mortality (farm_id, lot_id, event_date, quantity_lost, note) VALUES (?,?,?,?,?)'
  ).run(req.user.farmId, lot.id, event_date, qty, note || '');

  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/broiler-lots/:id/mortality/:mortId', requireAuth, requireOwner, (req, res) => {
  db.prepare('DELETE FROM broiler_mortality WHERE id = ? AND farm_id = ? AND lot_id = ?')
    .run(req.params.mortId, req.user.farmId, req.params.id);
  res.json({ ok: true });
});

// ---------------- REMINDERS ----------------

app.get('/api/reminders', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM reminders WHERE farm_id = ? ORDER BY remind_date ASC, id DESC'
  ).all(req.user.farmId);
  res.json(rows);
});

app.post('/api/reminders', requireAuth, (req, res) => {
  const { remind_date, message, subject_type, subject_id } = req.body || {};
  if (!remind_date) return badRequest(res, 'Pick a date for this reminder.');
  if (!message) return badRequest(res, 'Enter a reminder message.');
  const type = ['debt', 'animal', 'broiler_lot', 'custom'].includes(subject_type) ? subject_type : 'custom';

  const info = db.prepare(
    'INSERT INTO reminders (farm_id, created_by, subject_type, subject_id, remind_date, message) VALUES (?,?,?,?,?,?)'
  ).run(req.user.farmId, req.user.userId, type, subject_id || null, remind_date, message);

  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/reminders/:id', requireAuth, requireOwner, (req, res) => {
  db.prepare('DELETE FROM reminders WHERE id = ? AND farm_id = ?').run(req.params.id, req.user.farmId);
  res.json({ ok: true });
});

// Lets the owner trigger today's SMS batch on demand, e.g. to confirm setup works.
app.post('/api/reminders/run-now', requireAuth, requireOwner, async (req, res) => {
  const count = await runDueReminders();
  res.json({ ok: true, sent: count });
});

// Fallback to the app shell for any other route (simple SPA)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Shamba Secure running on http://localhost:${PORT}`);
});

// Check for due reminders every day at 7:00am (Africa/Nairobi)
cron.schedule('0 7 * * *', async () => {
  const count = await runDueReminders();
  if (count > 0) console.log(`[reminders] sent ${count} reminder(s)`);
}, { timezone: 'Africa/Nairobi' });
