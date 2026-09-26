require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');
const { setAuthCookie, clearAuthCookie, requireAuth, requireOwner } = require('./auth');
const { runDueReminders, createDebtReminder, sendSms } = require('./reminders');
const { BROILER_SCHEDULE, SCHEDULES, getSchedule, createLotReminders } = require('./broiler');
const { CURRENCIES } = require('./currency');
const { sendPasswordResetCodeEmail, sendVerificationCodeEmail } = require('./email');
const { isConfigured: pushConfigured, VAPID_PUBLIC_KEY } = require('./webpush');
const cron = require('node-cron');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

function badRequest(res, msg) { return res.status(400).json({ error: msg }); }

// Generates a 6-digit code, saves it against the user with a 15-minute
// expiry, and emails it. Used at registration and for manual resends.
async function issueVerificationCode(userId, email, farmName) {
  const code = String(crypto.randomInt(100000, 1000000));
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE id = ?')
    .run(code, expires, userId);
  try {
    await sendVerificationCodeEmail(email, code, farmName);
  } catch (err) {
    console.error('[email] failed to send verification code:', err.message);
  }
}

// Same idea as issueVerificationCode, but over SMS for the phone number.
async function issuePhoneVerificationCode(userId, phone, farmName) {
  const code = String(crypto.randomInt(100000, 1000000));
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET phone_verification_code = ?, phone_verification_code_expires = ? WHERE id = ?')
    .run(code, expires, userId);
  const message = `Your Shamba Secure verification code${farmName ? ` for ${farmName}` : ''} is ${code}. It expires in 15 minutes.`;
  try {
    await sendSms([phone], message);
  } catch (err) {
    console.error('[sms] failed to send phone verification code:', err.message);
  }
}

// ---------------- AUTH ----------------

// Sends a 6-digit code to an email or phone number BEFORE any account
// exists, so registration can require proof of ownership as part of the
// same form. Also used for "resend code" — calling it again with the same
// channel/contact just overwrites the pending code.
app.post('/api/register/send-code', async (req, res) => {
  const { channel, contact, farmName } = req.body || {};
  if (!['email', 'phone'].includes(channel)) return badRequest(res, 'Invalid verification channel.');
  if (!contact) return badRequest(res, channel === 'email' ? 'Enter your email address.' : 'Enter your phone number.');
  if (channel === 'email' && !/^\S+@\S+\.\S+$/.test(contact)) return badRequest(res, 'Enter a valid email address.');

  const existing = channel === 'email'
    ? db.prepare('SELECT id FROM users WHERE email = ?').get(contact)
    : db.prepare('SELECT id FROM users WHERE phone = ?').get(contact);
  if (existing) return badRequest(res, channel === 'email' ? 'That email is already registered.' : 'That phone number is already registered.');

  const code = String(crypto.randomInt(100000, 1000000));
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO pending_registrations (channel, contact, code, code_expires) VALUES (?, ?, ?, ?)
     ON CONFLICT(channel, contact) DO UPDATE SET code = excluded.code, code_expires = excluded.code_expires`
  ).run(channel, contact, code, expires);

  try {
    if (channel === 'email') {
      await sendVerificationCodeEmail(contact, code, farmName || null);
    } else {
      await sendSms([contact], `Your Shamba Secure verification code${farmName ? ` for ${farmName}` : ''} is ${code}. It expires in 15 minutes.`);
    }
  } catch (err) {
    console.error(`[${channel}] failed to send pre-registration verification code:`, err.message);
    return res.status(500).json({ error: `Could not send the verification ${channel === 'email' ? 'email' : 'text'}. Try again in a moment.` });
  }

  res.json({ ok: true });
});

app.post('/api/register', async (req, res) => {
  const { farmName, name, phone, email, password, currency, country, code, verify_channel } = req.body || {};
  if (!farmName || !name || !phone || !email || !password) return badRequest(res, 'All fields are required.');
  if (password.length < 6) return badRequest(res, 'Password must be at least 6 characters.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return badRequest(res, 'Enter a valid email address.');
  if (!['email', 'phone'].includes(verify_channel)) return badRequest(res, 'Choose how to verify your account.');
  if (!code) return badRequest(res, 'Enter the verification code you were sent.');

  const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existingPhone) return badRequest(res, 'That phone number is already registered.');
  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingEmail) return badRequest(res, 'That email is already registered.');

  const contact = verify_channel === 'email' ? email : phone;
  const pending = db.prepare('SELECT * FROM pending_registrations WHERE channel = ? AND contact = ?').get(verify_channel, contact);
  if (!pending) return badRequest(res, 'Send yourself a verification code first.');
  if (pending.code !== code) return badRequest(res, 'That code is incorrect.');
  if (new Date(pending.code_expires) < new Date()) return badRequest(res, 'That code has expired. Request a new one.');

  const currencyCode = CURRENCIES[currency] ? currency : 'KES';

  const insertFarm = db.prepare('INSERT INTO farms (name, currency, country) VALUES (?, ?, ?)');
  const farmInfo = insertFarm.run(farmName, currencyCode, country || null);
  const farmId = farmInfo.lastInsertRowid;

  const hash = bcrypt.hashSync(password, 12);
  // Only the channel that was just verified is marked verified here — the
  // other one still gets its own banner/resend flow after login, same as
  // before. reset_channel records the pick as the account's password-reset
  // method going forward.
  const insertUser = db.prepare(
    'INSERT INTO users (farm_id, name, phone, email, password_hash, role, email_verified, phone_verified, reset_channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const userInfo = insertUser.run(
    farmId, name, phone, email, hash, 'owner',
    verify_channel === 'email' ? 1 : 0,
    verify_channel === 'phone' ? 1 : 0,
    verify_channel
  );

  db.prepare('DELETE FROM pending_registrations WHERE channel = ? AND contact = ?').run(verify_channel, contact);

  setAuthCookie(res, { userId: userInfo.lastInsertRowid, farmId, name, role: 'owner' });
  // Prime the OTHER channel's verification code too, so its banner/resend
  // works right away without an extra click — same as before this change.
  if (verify_channel === 'email') {
    await issuePhoneVerificationCode(userInfo.lastInsertRowid, phone, farmName);
  } else {
    await issueVerificationCode(userInfo.lastInsertRowid, email, farmName);
  }
  res.json({ ok: true, farmName, name, role: 'owner', currency: currencyCode });
});

app.post('/api/users', requireAuth, requireOwner, async (req, res) => {
  const { name, phone, email, password } = req.body || {};
  if (!name || !phone || !password) return badRequest(res, 'Name, phone, and password are required.');
  if (password.length < 6) return badRequest(res, 'Password must be at least 6 characters.');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return badRequest(res, 'Enter a valid email address.');

  const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existingPhone) return badRequest(res, 'That phone number is already registered.');
  if (email) {
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) return badRequest(res, 'That email is already registered.');
  }

  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare(
    'INSERT INTO users (farm_id, name, phone, email, password_hash, role, email_verified, phone_verified, reset_channel) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)'
  ).run(req.user.farmId, name, phone, email || null, hash, 'worker', email ? 0 : 1, email ? 'email' : 'phone');

  const farm = db.prepare('SELECT name FROM farms WHERE id = ?').get(req.user.farmId);
  if (email) {
    await issueVerificationCode(info.lastInsertRowid, email, farm ? farm.name : null);
  }
  await issuePhoneVerificationCode(info.lastInsertRowid, phone, farm ? farm.name : null);

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
  const { identifier, password } = req.body || {};
  if (!identifier || !password) return badRequest(res, 'Enter your phone or email, and your password.');

  const user = db.prepare('SELECT * FROM users WHERE phone = ? OR email = ?').get(identifier, identifier);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect phone/email or password.' });
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
  const user = db.prepare('SELECT phone, email, email_verified, phone_verified FROM users WHERE id = ?').get(req.user.userId);
  res.json({
    name: req.user.name, role: req.user.role, farmName: farm ? farm.name : '',
    currency: farm ? farm.currency : 'KES', country: farm ? farm.country : null,
    email: user ? user.email : null, emailVerified: user ? !!user.email_verified : true,
    phone: user ? user.phone : null, phoneVerified: user ? !!user.phone_verified : true
  });
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

// ---------------- PASSWORD RESET ----------------

app.post('/api/forgot-password', async (req, res) => {
  const { identifier } = req.body || {};
  if (!identifier) return badRequest(res, 'Enter your phone number or email address.');

  const user = db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(identifier, identifier);

  // Always respond the same way whether or not the account exists —
  // otherwise this endpoint could be used to check who has an account here.
  const genericResponse = { ok: true, message: "If that account exists, we've sent a reset code." };

  if (!user) return res.json(genericResponse);

  const code = String(crypto.randomInt(100000, 1000000));
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?')
    .run(code, expires, user.id);

  const farm = db.prepare('SELECT name FROM farms WHERE id = ?').get(user.farm_id);

  try {
    if (user.reset_channel === 'phone') {
      await sendSms([user.phone], `Your Shamba Secure password reset code is ${code}. It expires in 15 minutes. If you didn't request this, ignore this text.`);
    } else {
      await sendPasswordResetCodeEmail(user.email, code, farm ? farm.name : null);
    }
  } catch (err) {
    console.error(`[${user.reset_channel || 'email'}] failed to send password reset code:`, err.message);
    // Still return the generic response — don't reveal delivery failures either.
  }

  res.json(genericResponse);
});

app.post('/api/reset-password', (req, res) => {
  const { identifier, code, password } = req.body || {};
  if (!identifier || !code || !password) return badRequest(res, 'Missing your phone/email, code, or new password.');
  if (password.length < 6) return badRequest(res, 'Password must be at least 6 characters.');

  const user = db.prepare('SELECT * FROM users WHERE (email = ? OR phone = ?) AND reset_token = ?').get(identifier, identifier, code);
  if (!user || !user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
    return res.status(400).json({ error: 'That code is invalid or has expired. Request a new one.' });
  }

  const hash = bcrypt.hashSync(password, 12);
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?')
    .run(hash, user.id);

  res.json({ ok: true });
});

// ---------------- EMAIL VERIFICATION ----------------

app.post('/api/verify-email', requireAuth, (req, res) => {
  const { code } = req.body || {};
  if (!code) return badRequest(res, 'Enter the code from your email.');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
  if (user.email_verified) return res.json({ ok: true, alreadyVerified: true });

  if (!user.verification_code || user.verification_code !== code) {
    return res.status(400).json({ error: 'That code is incorrect.' });
  }
  if (!user.verification_code_expires || new Date(user.verification_code_expires) < new Date()) {
    return res.status(400).json({ error: 'That code has expired. Request a new one.' });
  }

  db.prepare('UPDATE users SET email_verified = 1, verification_code = NULL, verification_code_expires = NULL WHERE id = ?')
    .run(user.id);
  res.json({ ok: true });
});

app.post('/api/resend-verification', requireAuth, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
  if (user.email_verified) return res.json({ ok: true, alreadyVerified: true });
  if (!user.email) return badRequest(res, 'No email address on this account to verify.');

  const farm = db.prepare('SELECT name FROM farms WHERE id = ?').get(req.user.farmId);
  await issueVerificationCode(user.id, user.email, farm ? farm.name : null);
  res.json({ ok: true });
});

app.post('/api/verify-phone', requireAuth, (req, res) => {
  const { code } = req.body || {};
  if (!code) return badRequest(res, 'Enter the code from your text message.');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
  if (user.phone_verified) return res.json({ ok: true, alreadyVerified: true });

  if (!user.phone_verification_code || user.phone_verification_code !== code) {
    return res.status(400).json({ error: 'That code is incorrect.' });
  }
  if (!user.phone_verification_code_expires || new Date(user.phone_verification_code_expires) < new Date()) {
    return res.status(400).json({ error: 'That code has expired. Request a new one.' });
  }

  db.prepare('UPDATE users SET phone_verified = 1, phone_verification_code = NULL, phone_verification_code_expires = NULL WHERE id = ?')
    .run(user.id);
  res.json({ ok: true });
});

app.post('/api/resend-phone-verification', requireAuth, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
  if (user.phone_verified) return res.json({ ok: true, alreadyVerified: true });

  const farm = db.prepare('SELECT name FROM farms WHERE id = ?').get(req.user.farmId);
  await issuePhoneVerificationCode(user.id, user.phone, farm ? farm.name : null);
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
  const { type, amount, category, description, tx_date, livestock_type, quantity, lot_id } = req.body || {};
  if (!['income', 'expense'].includes(type)) return badRequest(res, 'Invalid transaction type.');
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return badRequest(res, 'Enter a valid amount.');
  if (!tx_date) return badRequest(res, 'Date is required.');

  let animalType = null;
  if (livestock_type) {
    if (!['chicken', 'goat', 'cow'].includes(livestock_type)) return badRequest(res, 'Invalid animal type.');
    animalType = livestock_type;
  }
  let qty = null;
  if (quantity !== undefined && quantity !== null && quantity !== '') {
    qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) return badRequest(res, 'Enter a valid number of pieces.');
  }

  // Optional — lets a transaction be tied to a specific broiler/layer lot so
  // its income/expenses can be tracked separately from the farm's finances
  // as a whole. Must belong to this farm if provided.
  let lotId = null;
  if (lot_id !== undefined && lot_id !== null && lot_id !== '') {
    const lot = db.prepare('SELECT id FROM broiler_lots WHERE id = ? AND farm_id = ?').get(lot_id, req.user.farmId);
    if (!lot) return badRequest(res, 'That lot was not found.');
    lotId = lot.id;
  }

  const info = db.prepare(
    'INSERT INTO transactions (farm_id, user_id, type, amount, category, description, livestock_type, quantity, lot_id, tx_date) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(req.user.farmId, req.user.userId, type, amt, category || 'Other', description || '', animalType, qty, lotId, tx_date);

  res.json({ id: info.lastInsertRowid });
});

app.patch('/api/transactions/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND farm_id = ?').get(req.params.id, req.user.farmId);
  if (!existing) return res.status(404).json({ error: 'Transaction not found.' });

  const { type, amount, category, description, tx_date, livestock_type, quantity, lot_id } = req.body || {};

  if (type !== undefined && !['income', 'expense'].includes(type)) return badRequest(res, 'Invalid transaction type.');
  let amt = existing.amount;
  if (amount !== undefined) {
    amt = parseFloat(amount);
    if (!amt || amt <= 0) return badRequest(res, 'Enter a valid amount.');
  }
  if (tx_date !== undefined && !tx_date) return badRequest(res, 'Date is required.');

  let animalType = existing.livestock_type;
  if (livestock_type !== undefined) {
    if (livestock_type === null || livestock_type === '') {
      animalType = null;
    } else if (!['chicken', 'goat', 'cow'].includes(livestock_type)) {
      return badRequest(res, 'Invalid animal type.');
    } else {
      animalType = livestock_type;
    }
  }
  let qty = existing.quantity;
  if (quantity !== undefined) {
    if (quantity === null || quantity === '') {
      qty = null;
    } else {
      qty = parseInt(quantity, 10);
      if (!qty || qty <= 0) return badRequest(res, 'Enter a valid number of pieces.');
    }
  }
  let lotId = existing.lot_id;
  if (lot_id !== undefined) {
    if (lot_id === null || lot_id === '') {
      lotId = null;
    } else {
      const lot = db.prepare('SELECT id FROM broiler_lots WHERE id = ? AND farm_id = ?').get(lot_id, req.user.farmId);
      if (!lot) return badRequest(res, 'That lot was not found.');
      lotId = lot.id;
    }
  }

  db.prepare(
    'UPDATE transactions SET type=?, amount=?, category=?, description=?, tx_date=?, livestock_type=?, quantity=?, lot_id=? WHERE id=?'
  ).run(
    type !== undefined ? type : existing.type,
    amt,
    category !== undefined ? category : existing.category,
    description !== undefined ? description : existing.description,
    tx_date !== undefined ? tx_date : existing.tx_date,
    animalType,
    qty,
    lotId,
    existing.id
  );

  res.json({ ok: true });
});

app.delete('/api/transactions/:id', requireAuth, requireOwner, (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ? AND farm_id = ?').run(req.params.id, req.user.farmId);
  res.json({ ok: true });
});

// Wipes every transaction for the farm in one go, instead of one-by-one.
// Any debt that was marked settled via one of these transactions reverts to
// unsettled, since the record backing that settlement no longer exists —
// keeps the ledger internally consistent rather than leaving a phantom
// "settled" status with nothing behind it.
app.delete('/api/transactions', requireAuth, requireOwner, (req, res) => {
  const farmId = req.user.farmId;
  const wipe = db.transaction(() => {
    db.prepare('UPDATE debts SET settled = 0, settlement_tx_id = NULL WHERE farm_id = ? AND settlement_tx_id IS NOT NULL')
      .run(farmId);
    const info = db.prepare('DELETE FROM transactions WHERE farm_id = ?').run(farmId);
    return info.changes;
  });
  const deleted = wipe();
  res.json({ ok: true, deleted });
});

// ---------------- DEBTS ----------------

app.get('/api/debts', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM debts WHERE farm_id = ? ORDER BY settled ASC, id DESC'
  ).all(req.user.farmId);
  res.json(rows);
});

app.post('/api/debts', requireAuth, (req, res) => {
  const { direction, person, phone, amount, description, due_date, livestock_type, quantity, lot_id, incurred_date } = req.body || {};
  if (!['owed_to_me', 'i_owe'].includes(direction)) return badRequest(res, 'Invalid debt direction.');
  if (!person) return badRequest(res, 'Enter a name.');
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return badRequest(res, 'Enter a valid amount.');

  let animalType = null;
  if (livestock_type) {
    if (!['chicken', 'goat', 'cow'].includes(livestock_type)) return badRequest(res, 'Invalid animal type.');
    animalType = livestock_type;
  }
  let qty = null;
  if (quantity !== undefined && quantity !== null && quantity !== '') {
    qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) return badRequest(res, 'Enter a valid number of pieces.');
  }

  // Optional — ties the debt to a specific broiler/layer lot so it counts
  // toward that lot's own income/expense calculator, same as transactions.
  let lotId = null;
  if (lot_id !== undefined && lot_id !== null && lot_id !== '') {
    const lot = db.prepare('SELECT id FROM broiler_lots WHERE id = ? AND farm_id = ?').get(lot_id, req.user.farmId);
    if (!lot) return badRequest(res, 'That lot was not found.');
    lotId = lot.id;
  }

  const incurredDate = incurred_date || new Date().toISOString().slice(0, 10);

  const info = db.prepare(
    'INSERT INTO debts (farm_id, user_id, direction, person, phone, amount, description, livestock_type, quantity, lot_id, incurred_date, due_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(req.user.farmId, req.user.userId, direction, person, phone || null, amt, description || '', animalType, qty, lotId, incurredDate, due_date || null);

  if (due_date) {
    createDebtReminder(
      { farm_id: req.user.farmId, id: info.lastInsertRowid, amount: amt, direction, person, phone: phone || null, due_date },
      req.user.userId
    );
  }

  res.json({ id: info.lastInsertRowid });
});

app.patch('/api/debts/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM debts WHERE id = ? AND farm_id = ?').get(req.params.id, req.user.farmId);
  if (!existing) return res.status(404).json({ error: 'Debt not found.' });

  const { direction, person, phone, amount, description, due_date, livestock_type, quantity, lot_id, incurred_date } = req.body || {};

  // Once a debt is settled, its amount/direction/animal details are already
  // baked into a real transaction on the ledger. Changing them here would
  // silently desync the two — require un-settling first instead. Lot
  // tagging isn't baked into that transaction the same way (it's read
  // straight off the debt for the lot calculator, same as animal sales
  // are), so it stays editable regardless of settled status, same as
  // incurred/due date, person, phone, and reason.
  const financialFieldsTouched = [direction, amount, livestock_type, quantity].some(v => v !== undefined);
  if (existing.settled && financialFieldsTouched) {
    return badRequest(res, "This debt is settled — un-settle it first to change the amount, direction, or animal details.");
  }

  if (direction !== undefined && !['owed_to_me', 'i_owe'].includes(direction)) return badRequest(res, 'Invalid debt direction.');
  if (person !== undefined && !person) return badRequest(res, 'Enter a name.');
  let amt = existing.amount;
  if (amount !== undefined) {
    amt = parseFloat(amount);
    if (!amt || amt <= 0) return badRequest(res, 'Enter a valid amount.');
  }

  let animalType = existing.livestock_type;
  if (livestock_type !== undefined) {
    if (livestock_type === null || livestock_type === '') {
      animalType = null;
    } else if (!['chicken', 'goat', 'cow'].includes(livestock_type)) {
      return badRequest(res, 'Invalid animal type.');
    } else {
      animalType = livestock_type;
    }
  }
  let qty = existing.quantity;
  if (quantity !== undefined) {
    if (quantity === null || quantity === '') {
      qty = null;
    } else {
      qty = parseInt(quantity, 10);
      if (!qty || qty <= 0) return badRequest(res, 'Enter a valid number of pieces.');
    }
  }
  let lotId = existing.lot_id;
  if (lot_id !== undefined) {
    if (lot_id === null || lot_id === '') {
      lotId = null;
    } else {
      const lot = db.prepare('SELECT id FROM broiler_lots WHERE id = ? AND farm_id = ?').get(lot_id, req.user.farmId);
      if (!lot) return badRequest(res, 'That lot was not found.');
      lotId = lot.id;
    }
  }

  const newDirection = direction !== undefined ? direction : existing.direction;
  const newPerson = person !== undefined ? person : existing.person;
  const newPhone = phone !== undefined ? (phone || null) : existing.phone;
  const newDescription = description !== undefined ? description : existing.description;
  const newDueDate = due_date !== undefined ? (due_date || null) : existing.due_date;
  const newIncurredDate = incurred_date !== undefined ? (incurred_date || null) : existing.incurred_date;

  db.prepare(
    'UPDATE debts SET direction=?, person=?, phone=?, amount=?, description=?, livestock_type=?, quantity=?, lot_id=?, incurred_date=?, due_date=? WHERE id=?'
  ).run(newDirection, newPerson, newPhone, amt, newDescription, animalType, qty, lotId, newIncurredDate, newDueDate, existing.id);

  // The due date (or the details inside the reminder message) may have
  // changed — clear out the old not-yet-sent reminder for this debt and
  // regenerate it, so a pending reminder never fires with stale info.
  db.prepare("DELETE FROM reminders WHERE farm_id = ? AND subject_type = 'debt' AND subject_id = ? AND sent_at IS NULL")
    .run(req.user.farmId, existing.id);
  if (newDueDate && !existing.settled) {
    createDebtReminder(
      { farm_id: req.user.farmId, id: existing.id, amount: amt, direction: newDirection, person: newPerson, phone: newPhone, due_date: newDueDate },
      req.user.userId
    );
  }

  res.json({ ok: true });
});

app.patch('/api/debts/:id/settle', requireAuth, (req, res) => {
  const debt = db.prepare('SELECT * FROM debts WHERE id = ? AND farm_id = ?').get(req.params.id, req.user.farmId);
  if (!debt) return res.status(404).json({ error: 'Debt not found.' });

  if (!debt.settled) {
    // Settling now: record the actual cash movement so it shows up in
    // Total in/out and the net balance, not just the debt ledger.
    const type = debt.direction === 'owed_to_me' ? 'income' : 'expense';
    const description = debt.direction === 'owed_to_me'
      ? `Debt repayment received from ${debt.person}`
      : `Debt repayment made to ${debt.person}`;
    const txInfo = db.prepare(
      'INSERT INTO transactions (farm_id, user_id, type, amount, category, description, livestock_type, quantity, lot_id, tx_date) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(debt.farm_id, req.user.userId, type, debt.amount, 'Debt settlement', description, debt.livestock_type || null, debt.quantity || null, debt.lot_id || null, new Date().toISOString().slice(0, 10));

    db.prepare('UPDATE debts SET settled = 1, settlement_tx_id = ? WHERE id = ?').run(txInfo.lastInsertRowid, debt.id);
  } else {
    // Un-settling: remove the transaction that was created when it was settled,
    // so reversing a mistake doesn't leave a phantom entry in the cash ledger.
    if (debt.settlement_tx_id) {
      db.prepare('DELETE FROM transactions WHERE id = ? AND farm_id = ?').run(debt.settlement_tx_id, debt.farm_id);
    }
    db.prepare('UPDATE debts SET settled = 0, settlement_tx_id = NULL WHERE id = ?').run(debt.id);
  }

  res.json({ ok: true });
});

app.delete('/api/debts/:id', requireAuth, requireOwner, (req, res) => {
  db.prepare("DELETE FROM reminders WHERE farm_id = ? AND subject_type = 'debt' AND subject_id = ?")
    .run(req.user.farmId, req.params.id);
  db.prepare('DELETE FROM debts WHERE id = ? AND farm_id = ?').run(req.params.id, req.user.farmId);
  res.json({ ok: true });
});

// Wipes every debt for the farm in one go. Any transaction created by
// settling a debt is left alone — that's real cash history and shouldn't
// disappear just because the debt-tracking entry is cleared. Reminders
// tied to these debts are cleaned up too, so nothing orphaned is left
// behind pointing at a debt that no longer exists.
app.delete('/api/debts', requireAuth, requireOwner, (req, res) => {
  const farmId = req.user.farmId;
  const wipe = db.transaction(() => {
    db.prepare("DELETE FROM reminders WHERE farm_id = ? AND subject_type = 'debt'").run(farmId);
    const info = db.prepare('DELETE FROM debts WHERE farm_id = ?').run(farmId);
    return info.changes;
  });
  const deleted = wipe();
  res.json({ ok: true, deleted });
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
  const type = req.query.type === 'layer' ? 'layer' : 'broiler';
  res.json(getSchedule(type).schedule);
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
  const { name, quantity, start_date, poultry_type } = req.body || {};
  if (!name) return badRequest(res, 'Give this lot a name or tag.');
  if (!start_date) return badRequest(res, 'Pick a start date.');
  const type = poultry_type === 'layer' ? 'layer' : 'broiler';
  const { defaultCycleDays } = getSchedule(type);

  const info = db.prepare(
    'INSERT INTO broiler_lots (farm_id, name, poultry_type, quantity, start_date, cycle_days) VALUES (?,?,?,?,?,?)'
  ).run(req.user.farmId, name, type, quantity ? parseInt(quantity, 10) : null, start_date, defaultCycleDays);

  const lot = { id: info.lastInsertRowid, farm_id: req.user.farmId, name, start_date, poultry_type: type };
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

// ---------------- WEB PUSH ----------------

app.get('/api/push/vapid-public-key', requireAuth, (req, res) => {
  if (!pushConfigured()) return res.json({ configured: false });
  res.json({ configured: true, publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', requireAuth, (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) return badRequest(res, 'Invalid subscription.');

  // Re-subscribing with the same endpoint (e.g. re-enabling on the same
  // device) replaces the old row rather than erroring on the unique constraint.
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  db.prepare(
    'INSERT INTO push_subscriptions (farm_id, user_id, endpoint, p256dh, auth) VALUES (?,?,?,?,?)'
  ).run(req.user.farmId, req.user.userId, endpoint, keys.p256dh, keys.auth);

  res.json({ ok: true });
});

app.post('/api/push/unsubscribe', requireAuth, (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return badRequest(res, 'Missing endpoint.');
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, req.user.userId);
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
