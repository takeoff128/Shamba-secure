const webpush = require('web-push');
const db = require('./db');

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

let configured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:admin@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  configured = true;
} else {
  console.log('[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — web push notifications are disabled. See .env.example.');
}

function isConfigured() {
  return configured;
}

// Sends a push notification to every device a specific user has subscribed
// from. Automatically forgets subscriptions that are no longer valid
// (the browser/OS reports 404/410 when a subscription has expired).
async function sendPushToUser(userId, payload) {
  if (!configured) return;
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  for (const sub of subs) {
    await deliverToSubscription(sub, payload);
  }
}

// Sends to every user on a farm — used for reminders that apply to the
// whole farm rather than one person.
async function sendPushToFarm(farmId, payload) {
  if (!configured) return;
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE farm_id = ?').all(farmId);
  for (const sub of subs) {
    await deliverToSubscription(sub, payload);
  }
}

async function deliverToSubscription(sub, payload) {
  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth }
  };
  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      // Subscription is gone (browser data cleared, uninstalled, etc.) — clean it up.
      db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
    } else {
      console.error('[push] failed to deliver:', err.message);
    }
  }
}

module.exports = { isConfigured, sendPushToUser, sendPushToFarm, VAPID_PUBLIC_KEY };
