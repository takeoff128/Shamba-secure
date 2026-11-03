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

// Africa's Talking per-recipient status codes (sending API response).
// 100 Processed, 101 Sent, 102 Queued are fine; everything else failed.
const AT_OK_CODES = new Set([100, 101, 102]);
const AT_FAILURE_HINTS = {
  401: "RiskHold: Africa's Talking is reviewing the account. Contact their support.",
  402: 'InvalidSenderId: AT_SENDER_ID is not approved or not mapped to this account. Remove AT_SENDER_ID or finish the sender ID registration.',
  403: 'InvalidPhoneNumber: check the number (07XX/01XX or +254...).',
  404: 'UnsupportedNumberType.',
  405: "InsufficientBalance: top up the Africa's Talking account.",
  406: 'UserInBlacklist: this subscriber has blocked messages from this sender (for example Safaricom promotional/DND blocking). Use a registered transactional sender ID.',
  407: 'CouldNotRoute: the network could not route the message.',
  409: 'DoNotDisturbRejection: the subscriber is on Do-Not-Disturb for this sender. Use a registered transactional sender ID.',
  500: 'InternalServerError at the gateway: try again.',
  501: 'GatewayError: try again.',
  502: 'RejectedByGateway: the sender ID is not mapped to this account.'
};
// Kenyan mobile network codes reported in delivery reports.
const NETWORKS = { '63902': 'Safaricom', '63903': 'Airtel', '63907': 'Telkom', '63910': 'Faiba' };

if (AT_USERNAME === 'sandbox') {
  console.log("[sms] AT_USERNAME=sandbox: messages only appear in the Africa's Talking simulator, never on real phones.");
}

function logSms(row) {
  try {
    db.prepare('INSERT INTO sms_log (message_id, phone, purpose, status, status_code, failure_reason) VALUES (?,?,?,?,?,?)')
      .run(row.messageId || null, row.phone, row.purpose || null, row.status || null, row.statusCode || null, row.failureReason || null);
  } catch (e) { /* logging must never break sending */ }
}

// Sends one message to one or more phones. Resolves with { sent, failed }
// when at least one recipient was accepted; throws (with a readable reason)
// when every recipient was rejected, so callers can tell the user.
async function sendSms(phones, message, purpose = 'reminder') {
  const recipients = phones.map(normalizePhone);
  if (!sms) {
    console.log(`[sms:not-configured] to=${recipients.join(',')} message="${message}"`);
    return { simulated: true, recipients, message, sent: recipients, failed: [] };
  }
  const opts = { to: recipients, message };
  if (process.env.AT_SENDER_ID) opts.from = process.env.AT_SENDER_ID;
  const resp = await sms.send(opts);
  const list = (resp && resp.SMSMessageData && Array.isArray(resp.SMSMessageData.Recipients)) ? resp.SMSMessageData.Recipients : [];
  const sent = [], failed = [];
  list.forEach(r => {
    const code = Number(r.statusCode);
    const ok = AT_OK_CODES.has(code);
    const reason = ok ? null : (AT_FAILURE_HINTS[code] || r.status || 'Unknown failure');
    logSms({ messageId: r.messageId, phone: r.number, purpose, status: r.status, statusCode: code, failureReason: reason });
    if (ok) sent.push(r.number);
    else { failed.push({ number: r.number, reason }); console.error(`[sms] ${purpose} to ${r.number} rejected (${code} ${r.status}): ${reason}`); }
  });
  if (!list.length) {
    const why = (resp && resp.SMSMessageData && resp.SMSMessageData.Message) || 'No recipients accepted';
    console.error(`[sms] ${purpose} not sent: ${why}`);
    throw new Error(why);
  }
  if (!sent.length) throw new Error(failed[0].reason);
  return { sent, failed };
}

// Delivery report from Africa's Talking (configure the callback URL in the
// AT dashboard: SMS > Callback URLs > Delivery Reports).
function recordDeliveryReport(body) {
  const id = body && String(body.id || '');
  if (!id) return false;
  const status = String(body.status || '').slice(0, 40);
  const reason = body.failureReason ? String(body.failureReason).slice(0, 80) : null;
  const network = body.networkCode ? String(body.networkCode).slice(0, 10) : null;
  const res = db.prepare("UPDATE sms_log SET status = ?, failure_reason = COALESCE(?, failure_reason), network_code = ?, updated_at = datetime('now') WHERE message_id = ?")
    .run(status, reason, network, id);
  if (status && status !== 'Success' && status !== 'Sent' && status !== 'Submitted' && status !== 'Buffered') {
    console.error(`[sms:delivery] ${id} to ${body.phoneNumber || '?'} on ${NETWORKS[network] || network || 'unknown network'}: ${status}${reason ? ' (' + reason + ')' : ''}`);
  }
  return res.changes > 0;
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
        await sendSms([debt.phone], reminder.message, 'debtor-reminder');
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
  // SMS and push are independent: a failed SMS must not stop the push alert.
  let delivered = false;
  try { await sendSms(phones, reminder.message, 'reminder'); delivered = true; }
  catch (err) { console.error(`[sms] failed to send reminder ${reminder.id}:`, err.message); }
  try { if (await sendPushToFarm(reminder.farm_id, { title: 'Shamba Secure reminder', body: reminder.message }) > 0) delivered = true; }
  catch (err) { console.error(`[push] failed to send reminder ${reminder.id}:`, err.message); }
  if (delivered) db.prepare("UPDATE reminders SET sent_at = datetime('now') WHERE id = ?").run(reminder.id);
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

module.exports = { sendSms, normalizePhone, runDueReminders, createDebtReminder, recordDeliveryReport };
