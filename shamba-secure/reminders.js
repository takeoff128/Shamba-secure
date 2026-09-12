const db = require('./db');
const { formatMoney } = require('./currency');
const { sendPushToFarm } = require('./webpush');

// ---------------- Africa's Talking setup ----------------
// If credentials aren't set, we log to the console instead of sending —
// this lets the app run locally without an Africa's Talking account.
let sms = null;
const AT_USERNAME = process.env.AT_USERNAME;
const AT_API_KEY = process.env.AT_API_KEY;

if (AT_USERNAME && AT_API_KEY) {
  const AfricasTalking = require('africastalking')({ username: AT_USERNAME, apiKey: AT_API_KEY });
  sms = AfricasTalking.SMS;
} else {
  console.log('[sms] AT_USERNAME/AT_API_KEY not set — reminders will be logged, not sent. See .env.example.');
}

// Turns "0712345678" or "+254712345678" or "254712345678" into "+254712345678"
function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('254')) return '+' + digits;
  if (digits.startsWith('0')) return '+254' + digits.slice(1);
  if (digits.startsWith('7') || digits.startsWith('1')) return '+254' + digits;
  return '+' + digits;
}

async function sendSms(phones, message) {
  const recipients = phones.map(normalizePhone);
  if (!sms) {
    console.log(`[sms:not-configured] to=${recipients.join(',')} message="${message}"`);
    return { simulated: true, recipients, message };
  }
  const opts = { to: recipients, message };
  if (process.env.AT_SENDER_ID) opts.from = process.env.AT_SENDER_ID;
  return sms.send(opts);
}

// Sends one reminder — to the debtor directly if it's a debt someone owes
// the farm (with a phone on file), otherwise to everyone on the farm via
// both SMS and a push notification for anyone with the app installed.
async function deliverReminder(reminder) {
  if (reminder.subject_type === 'debt' && reminder.subject_id) {
    const debt = db.prepare('SELECT * FROM debts WHERE id = ? AND farm_id = ?')
      .get(reminder.subject_id, reminder.farm_id);

    if (debt && debt.settled) {
      db.prepare("UPDATE reminders SET sent_at = datetime('now') WHERE id = ?").run(reminder.id);
      return;
    }

    if (debt && debt.direction === 'owed_to_me' && debt.phone) {
      // The debtor isn't a user of the app, so this is SMS-only — no push subscription exists for them.
      try {
        await sendSms([debt.phone], reminder.message);
        db.prepare("UPDATE reminders SET sent_at = datetime('now') WHERE id = ?").run(reminder.id);
      } catch (err) {
        console.error(`[sms] failed to send debtor reminder ${reminder.id}:`, err.message);
      }
      return;
    }
  }

  const users = db.prepare('SELECT phone FROM users WHERE farm_id = ?').all(reminder.farm_id);
  const phones = users.map(u => u.phone);
  if (phones.length === 0) return;
  try {
    await sendSms(phones, reminder.message);
    await sendPushToFarm(reminder.farm_id, {
      title: 'Shamba Secure reminder',
      body: reminder.message
    });
    db.prepare("UPDATE reminders SET sent_at = datetime('now') WHERE id = ?").run(reminder.id);
  } catch (err) {
    console.error(`[sms] failed to send reminder ${reminder.id}:`, err.message);
  }
}

async function runDueReminders() {
  const today = new Date().toISOString().slice(0, 10);
  const due = db.prepare(
    'SELECT * FROM reminders WHERE remind_date <= ? AND sent_at IS NULL'
  ).all(today);
  for (const reminder of due) {
    await deliverReminder(reminder);
  }
  return due.length;
}

// Called whenever a debt with a due_date is created, so a reminder exists automatically.
function createDebtReminder(debt, userId) {
  if (!debt.due_date) return;

  const farm = db.prepare('SELECT name, currency FROM farms WHERE id = ?').get(debt.farm_id);
  const amountStr = formatMoney(debt.amount, farm ? farm.currency : 'KES');

  let message;
  if (debt.direction === 'owed_to_me' && debt.phone) {
    message = `Hello ${debt.person}, this is a reminder that ${amountStr} ` +
      `owed to ${farm ? farm.name : 'us'} was due today. Kindly settle when able. Thank you.`;
  } else {
    message = `Shamba Secure reminder: payment of ${amountStr} ` +
      `${debt.direction === 'owed_to_me' ? 'from' : 'to'} ${debt.person} is due today.`;
  }

  db.prepare(
    'INSERT INTO reminders (farm_id, created_by, subject_type, subject_id, remind_date, message) VALUES (?,?,?,?,?,?)'
  ).run(debt.farm_id, userId, 'debt', debt.id, debt.due_date, message);
}

module.exports = { sendSms, normalizePhone, runDueReminders, createDebtReminder };
