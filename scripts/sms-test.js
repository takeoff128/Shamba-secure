// Sends one test SMS through Africa's Talking and prints exactly what the
// gateway said, so you can see why a Safaricom number is not receiving codes.
//   Usage (on the server, with the same env vars as the app):
//     node scripts/sms-test.js 0712345678
require('dotenv').config();
const { sendSms } = require('../reminders');

const phone = process.argv[2];
if (!phone) { console.log('Usage: node scripts/sms-test.js 07XXXXXXXX'); process.exit(1); }

console.log('AT_USERNAME   :', process.env.AT_USERNAME || '(not set)');
console.log('AT_SENDER_ID  :', process.env.AT_SENDER_ID || "(not set: Africa's Talking shared sender is used)");
if (process.env.AT_USERNAME === 'sandbox') console.log('NOTE: sandbox only delivers to the AT simulator, not real phones.');

sendSms([phone], 'Shamba Secure: your verification code is 123456. It expires in 15 minutes. Do not share this code.', 'test')
  .then(r => {
    console.log('\nAccepted by the gateway:', r.sent.join(', ') || '-');
    if (r.failed.length) console.log('Rejected:', r.failed);
    console.log('\nAccepted is not the same as delivered. Check the final status in the AT dashboard (SMS > Outbox),');
    console.log('or set the delivery report callback to https://YOUR-DOMAIN/api/sms/delivery-report and watch the logs.');
    process.exit(0);
  })
  .catch(e => { console.error('\nNOT SENT:', e.message); process.exit(2); });
